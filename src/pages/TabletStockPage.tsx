import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { TabletLayout } from '../components/Layouts';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { Phone, PhoneColor } from '../types';
import { Package, Search, Send, X, ChevronLeft, Store, ShoppingCart, CheckCircle2, Eye } from 'lucide-react';
import ReactBarcode from 'react-barcode';
import {
  fetchPhoneReservationLocksFromDB,
  PhoneReservationLock,
  sendMessageToDB,
} from '../lib/authService';
import { buildPhoneTransferRequestContent } from '../lib/phoneRequestProtocol';
import { supabase } from '../lib/supabase';

type RequestColorState = PhoneColor & { selectedQty: number };

const getAvailableQty = (phone: Phone) => {
  if (phone.colors && phone.colors.length > 0) {
    // Colors are the source of truth for quantity — never cap by phone.quantity
    // to avoid stale data causing phantom "Épuisé" when some colors still have stock.
    return phone.colors.reduce((sum, c) => sum + c.qty, 0);
  }
  return phone.quantity;
};

const getPriceDisplay = (phone: Phone) => {
  if (phone.condition === 'Occasion' && phone.colors && phone.colors.some(c => c.price)) {
    const prices = phone.colors.filter(c => c.price && c.qty > 0).map(c => c.price!);
    if (prices.length === 0) return `${phone.price}€`;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? `${min}€` : `${min} – ${max}€`;
  }
  return `${phone.price}€`;
};

export const TabletStockPage = () => {
  const navigate = useNavigate();
  const { storeName } = useParams();
  const { currentUser, setCurrentStore, inventory, users, stores, attendance, updatePhone, addSale } = useStore();

  const [search, setSearch] = useState('');
  const [conditionFilter, setConditionFilter] = useState<'All' | 'Neuf' | 'Occasion'>('All');
  const [sourceStore, setSourceStore] = useState('');
  const [phoneLocks, setPhoneLocks] = useState<Record<string, PhoneReservationLock>>({});

  const [requestingPhone, setRequestingPhone] = useState<Phone | null>(null);
  const [requestColors, setRequestColors] = useState<RequestColorState[]>([]);
  const [selectedReceiverId, setSelectedReceiverId] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Sell state
  const [sellingPhone, setSellingPhone] = useState<Phone | null>(null);
  const [sellColorIndex, setSellColorIndex] = useState<number>(0);
  const [sellPrice, setSellPrice] = useState('');
  const [sellConfirmed, setSellConfirmed] = useState(false);
  const [sellEmployeeId, setSellEmployeeId] = useState('');

  // Detail modal state
  const [detailPhone, setDetailPhone] = useState<Phone | null>(null);

  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role !== 'Stock') return <Navigate to="/login" replace />;

  const activeStore = decodeURIComponent(storeName || '');
  if (!activeStore) return <Navigate to="/tablet/stores" replace />;

  const validStores = currentUser.stores.length > 0 ? currentUser.stores : stores.map(s => s.name);
  const isAllowedStore = validStores.includes(activeStore);
  if (!isAllowedStore) return <Navigate to="/tablet/stores" replace />;

  const allStoreNames = stores.map(s => s.name);

  useEffect(() => {
    if (currentUser.currentStore !== activeStore) {
      setCurrentStore(activeStore);
    }
  }, [activeStore, currentUser.currentStore]);

  useEffect(() => {
    if (!sourceStore) {
      setSourceStore(activeStore);
    }
  }, [activeStore, sourceStore]);

  const isOwnStore = sourceStore === activeStore;

  const refreshLocks = async () => {
    const locks = await fetchPhoneReservationLocksFromDB();
    setPhoneLocks(locks);
  };

  useEffect(() => {
    refreshLocks();
    const timer = window.setInterval(refreshLocks, 8000);
    return () => window.clearInterval(timer);
  }, []);

  const receiverCandidates = useMemo(() => {
    if (!sourceStore || isOwnStore) return [];
    return users.filter(u => u.id !== currentUser.id && u.stores.includes(sourceStore));
  }, [users, currentUser.id, sourceStore, isOwnStore]);

  useEffect(() => {
    if (receiverCandidates.length > 0 && !receiverCandidates.find(u => u.id === selectedReceiverId)) {
      setSelectedReceiverId(receiverCandidates[0].id);
    }
    if (receiverCandidates.length === 0) setSelectedReceiverId('');
  }, [receiverCandidates, selectedReceiverId]);

  // Employees present today in the active store
  const todayStr = new Date().toISOString().slice(0, 10);
  const presentEmployees = useMemo(() => {
    return users.filter(u => {
      if (u.id === currentUser?.id) return false;
      if (!u.stores.includes(activeStore)) return false;
      // Check if they have an attendance entry today (present/en cours/en pause)
      const todayEntry = attendance.find(
        a => a.userId === u.id && a.date === todayStr &&
        (a.status === 'En cours' || a.status === 'Présent' || a.status === 'En pause')
      );
      return !!todayEntry;
    });
  }, [users, attendance, activeStore, todayStr, currentUser?.id]);

  // All employees of the store (fallback if no one is checked in)
  const storeEmployees = useMemo(() => {
    return users.filter(u => u.id !== currentUser?.id && u.stores.includes(activeStore) && u.role === 'Employé');
  }, [users, activeStore, currentUser?.id]);

  // Employees to show in dropdown: present ones first, fallback to all store employees
  const sellCandidates = presentEmployees.length > 0 ? presentEmployees : storeEmployees;

  // Sell helpers
  const openSellModal = (phone: Phone) => {
    setSellConfirmed(false);
    setSellColorIndex(0);
    const firstAvailColor = phone.colors?.find(c => c.qty > 0);
    setSellPrice(String(firstAvailColor?.price ?? phone.price ?? ''));
    // Pre-select first available employee
    const candidates = presentEmployees.length > 0 ? presentEmployees : storeEmployees;
    setSellEmployeeId(candidates.length > 0 ? candidates[0].id : '');
    setSellingPhone(phone);
  };

  const closeSellModal = () => {
    setSellingPhone(null);
    setSellConfirmed(false);
    setSellEmployeeId('');
  };

  const confirmSell = () => {
    if (!sellingPhone || !currentUser) return;
    const finalPrice = Number(sellPrice) || 0;
    let updatedColors = sellingPhone.colors ? [...sellingPhone.colors] : [];
    let colorName = '';
    let colorRef: string | undefined;
    if (updatedColors.length > 0) {
      const col = updatedColors[sellColorIndex];
      colorName = col?.color || '';
      colorRef = col?.reference;
      updatedColors = updatedColors.map((c, i) =>
        i === sellColorIndex ? { ...c, qty: Math.max(0, c.qty - 1) } : c
      );
    }
    // When colors are used, derive total quantity from the sum of remaining color quantities
    // to keep phone.quantity in sync — avoids showing "Épuisé" when other colors still have stock.
    const newQty = updatedColors.length > 0
      ? updatedColors.reduce((sum, c) => sum + c.qty, 0)
      : Math.max(0, sellingPhone.quantity - 1);
    updatePhone(sellingPhone.id, { quantity: newQty, colors: updatedColors });

    // Determine seller: selected employee or fallback to current user
    const seller = sellCandidates.find(u => u.id === sellEmployeeId);
    const soldById = seller ? seller.id : currentUser.id;
    const soldByName = seller ? seller.fullName : currentUser.fullName;

    addSale({
      phoneBrand: sellingPhone.brand,
      phoneModel: sellingPhone.model,
      phoneRam: sellingPhone.ram,
      phoneStorage: sellingPhone.storage,
      phoneCondition: sellingPhone.condition,
      color: colorName,
      reference: colorRef,
      price: finalPrice,
      store: sellingPhone.store,
      soldBy: soldById,
      soldByName: soldByName,
      soldAt: new Date().toISOString(),
    });
    setSellConfirmed(true);
  };

  const sourcePhones = inventory.filter(phone => phone.store === sourceStore);

  const filteredPhones = sourcePhones.filter(phone => {
    if (conditionFilter !== 'All' && phone.condition !== conditionFilter) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      phone.brand.toLowerCase().includes(term) ||
      phone.model.toLowerCase().includes(term) ||
      phone.storage.toLowerCase().includes(term) ||
      phone.ram.toLowerCase().includes(term) ||
      (phone.colors?.some(c => c.reference?.toLowerCase().includes(term)) ?? false)
    );
  });

  const sortedPhones = [...filteredPhones].sort((a, b) => {
    const aQty = getAvailableQty(a);
    const bQty = getAvailableQty(b);
    if (aQty > 0 && bQty === 0) return -1;
    if (aQty === 0 && bQty > 0) return 1;
    return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
  });

  const openRequestModal = (phone: Phone) => {
    if (phoneLocks[phone.id]) return;
    setSent(false);
    setRequestingPhone(phone);
    const colors = (phone.colors || [])
      .filter(c => c.qty > 0)
      .map(c => ({ ...c, selectedQty: 0 }));
    setRequestColors(colors);
  };

  const closeRequestModal = () => {
    setRequestingPhone(null);
    setRequestColors([]);
    setSending(false);
    setSent(false);
  };

  const totalSelectedQty = requestColors.reduce((sum, c) => sum + c.selectedQty, 0);

  const updateSelectedQty = (index: number, delta: number) => {
    setRequestColors(prev => prev.map((c, i) => {
      if (i !== index) return c;
      const next = Math.max(0, Math.min(c.qty, c.selectedQty + delta));
      return { ...c, selectedQty: next };
    }));
  };

  const handleSendRequest = async () => {
    if (!requestingPhone || !selectedReceiverId || totalSelectedQty <= 0 || !currentUser || sending) return;
    setSending(true);

    const selectedColors = requestColors.filter(c => c.selectedQty > 0);
    const msg = buildPhoneTransferRequestContent({
      type: 'phone_transfer_request',
      requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      phoneId: requestingPhone.id,
      phoneLabel: `${requestingPhone.brand} ${requestingPhone.model}`,
      storage: requestingPhone.storage,
      ram: requestingPhone.ram,
      condition: requestingPhone.condition,
      basePrice: requestingPhone.price,
      colorDetails: selectedColors.map(c => ({
        color: c.color,
        qty: c.selectedQty,
        reference: c.reference,
        price: c.price,
        batteryHealth: c.batteryHealth,
        screenCondition: c.screenCondition,
        frameCondition: c.frameCondition,
      })),
      fromStore: requestingPhone.store,
      toStore: activeStore,
      requesterId: currentUser.id,
      requesterName: currentUser.fullName,
      receiverId: selectedReceiverId,
      qty: totalSelectedQty,
      createdAt: new Date().toISOString(),
    });

    const saved = await sendMessageToDB(currentUser.id, selectedReceiverId, msg);
    if (saved) {
      const ch = supabase.channel('phonetastic-messages');
      await ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.send({ type: 'broadcast', event: 'new-message', payload: saved });
          supabase.removeChannel(ch);
        }
      });
      await refreshLocks();
      setSent(true);
    }

    setSending(false);
  };

  const inStockCount = sortedPhones.filter(p => getAvailableQty(p) > 0).length;

  return (
    <TabletLayout title={`Stock · ${activeStore}`}>
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 text-white p-5 md:p-6 shadow-2xl">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-200 font-bold">
                {isOwnStore ? 'Mode Vente' : 'Mode Réservation'}
              </p>
              <h1 className="mt-1 text-2xl md:text-3xl font-black">
                {isOwnStore ? `Stock · ${activeStore}` : `Demander depuis ${sourceStore || '...'}`}
              </h1>
              <p className="mt-1 text-sm text-slate-300">
                {isOwnStore
                  ? 'Vente directe depuis votre magasin'
                  : <>Destination: <span className="font-bold text-white">{activeStore}</span></>
                }
              </p>
            </div>
            <button
              onClick={() => navigate(`/tablet/hub/${encodeURIComponent(activeStore)}`)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-sm font-bold"
            >
              <ChevronLeft size={16} /> Retour options
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher modèle, IMEI, RAM..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
            <select
              value={sourceStore}
              onChange={(e) => setSourceStore(e.target.value)}
              className="px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-700 bg-white"
            >
              {allStoreNames.map(name => (
                <option key={name} value={name}>
                  {name === activeStore ? `Mon magasin: ${name}` : `Autre magasin: ${name}`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['All', 'Neuf', 'Occasion'] as const).map(c => (
              <button
                key={c}
                onClick={() => setConditionFilter(c)}
                className={cn(
                  'px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors',
                  conditionFilter === c
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                )}
              >
                {c === 'All' ? 'Tous' : c}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-500">
              <span className="font-bold text-slate-900">{inStockCount}</span> disponibles / <span className="font-bold text-slate-900">{sortedPhones.length}</span> modèles
            </span>
          </div>
        </div>

        {sortedPhones.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {sortedPhones.map(phone => {
              const qty = getAvailableQty(phone);
              const locked = phoneLocks[phone.id];
              return (
                <div
                  key={phone.id}
                  className={cn(
                    'rounded-2xl border bg-white p-5 shadow-sm transition-all',
                    qty > 0 ? 'border-slate-200 hover:shadow-lg hover:border-slate-300' : 'border-slate-200 opacity-60'
                  )}
                >
                  {/* Header: brand + model + condition badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-slate-900 leading-tight">{phone.brand}</p>
                      <p className="text-lg font-bold text-slate-700 leading-tight mt-0.5">{phone.model}</p>
                    </div>
                    <span className={cn(
                      'text-xs font-bold px-3 py-1.5 rounded-xl shrink-0',
                      phone.condition === 'Neuf' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      {phone.condition}
                    </span>
                  </div>

                  {/* Specs row */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg">{phone.ram} RAM</span>
                    <span className="text-sm font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg">{phone.storage}</span>
                  </div>

                  {/* Price */}
                  <p className="mt-3 text-3xl font-black text-slate-900">{getPriceDisplay(phone)}</p>

                  {/* Per-unit color dots with condition indicators */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {(phone.colors || []).slice(0, 8).map((c, idx) => (
                      <span key={idx} className="relative" title={`${c.condition || phone.condition} · ${c.ram || phone.ram} · ${c.storage || phone.storage}${c.price ? ` · ${c.price}€` : ''}${c.reference ? ` · ${c.reference}` : ''}`}>
                        <span className="w-8 h-8 rounded-lg border-2 border-slate-200 flex items-center justify-center" style={{ backgroundColor: c.color }}>
                          {c.qty === 0 && <X size={12} className="text-red-600 stroke-[3]" />}
                        </span>
                        {(c.condition || phone.condition) === 'Occasion' && c.qty > 0 && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white" />
                        )}
                      </span>
                    ))}
                  </div>

                  {/* Bottom row: qty badge + eye button + store */}
                  <div className="mt-4 flex items-center justify-between">
                    <span className={cn(
                      'text-sm font-bold px-3 py-1.5 rounded-xl',
                      qty > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    )}>
                      {qty > 0 ? `${qty} dispo` : 'Épuisé'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDetailPhone(phone); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-600 transition-colors text-xs font-bold"
                        title="Voir les unités"
                      >
                        <Eye size={15} /> Détails
                      </button>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Store size={12} /> {phone.store}
                      </span>
                    </div>
                  </div>

                  {isOwnStore ? (
                    <button
                      disabled={qty === 0}
                      onClick={() => openSellModal(phone)}
                      className={cn(
                        'mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-base font-bold transition-all',
                        qty > 0
                          ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-700 hover:to-emerald-800 shadow-lg shadow-emerald-600/25'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      )}
                    >
                      <ShoppingCart size={18} />
                      Vendre
                    </button>
                  ) : (
                    <>
                      <button
                        disabled={qty === 0 || Boolean(locked)}
                        onClick={() => openRequestModal(phone)}
                        className={cn(
                          'mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-base font-bold transition-all',
                          qty > 0 && !locked
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-600/25'
                            : locked
                              ? 'bg-amber-100 text-amber-800 cursor-not-allowed'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        )}
                      >
                        <Package size={18} />
                        {locked ? 'Déjà réservé' : 'Demander transfert'}
                      </button>
                      {locked && (
                        <p className="mt-2 text-xs font-semibold text-amber-700">En attente: {locked.requesterName}</p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">
            <Package size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-slate-500">Aucun téléphone trouvé</p>
          </div>
        )}

        {/* ── Sell modal ─────────────────────────────────────── */}
        {sellingPhone && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center" onClick={closeSellModal}>
            <div className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {sellConfirmed ? (
                <div className="p-10 text-center space-y-4">
                  <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={44} className="text-emerald-600" />
                  </div>
                  <p className="text-2xl font-black text-slate-900">Vente enregistrée !</p>
                  <p className="text-base text-slate-500">{sellingPhone.brand} {sellingPhone.model} vendu à <span className="font-bold text-emerald-600">{Number(sellPrice) || 0}€</span></p>
                  <button onClick={closeSellModal} className="mt-2 px-8 py-3 rounded-xl bg-emerald-600 text-white font-bold text-base">Fermer</button>
                </div>
              ) : (
                <>
                  <div className="px-6 py-5 border-b border-slate-200">
                    <p className="text-xl font-black text-slate-900">Enregistrer une vente</p>
                    <p className="text-base text-slate-500 mt-1">{sellingPhone.brand} {sellingPhone.model} · {sellingPhone.storage} · {sellingPhone.ram}</p>
                  </div>
                  <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
                    {/* Employee selector */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-slate-700">Vendu par</label>
                        {presentEmployees.length > 0 ? (
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                            ✅ {presentEmployees.length} présent(s) aujourd'hui
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                            ⚠️ Aucun pointage
                          </span>
                        )}
                      </div>
                      {sellCandidates.length > 0 ? (
                        <select
                          value={sellEmployeeId}
                          onChange={e => setSellEmployeeId(e.target.value)}
                          className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl text-base font-semibold text-slate-800 bg-white focus:outline-none focus:border-indigo-400 transition-colors"
                        >
                          {sellCandidates.map(u => (
                            <option key={u.id} value={u.id}>{u.fullName}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm text-rose-600 font-semibold">
                          Aucun employé trouvé — vente attribuée à votre compte.
                        </p>
                      )}
                    </div>
                    {/* Employee selector */}
                    <div>
                      <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                        Vendu par
                        {presentEmployees.length > 0 && (
                          <span className="ml-2 text-[11px] font-semibold text-emerald-600 normal-case">
                            ✅ {presentEmployees.length} employé(s) présent(s) aujourd'hui
                          </span>
                        )}
                        {presentEmployees.length === 0 && storeEmployees.length > 0 && (
                          <span className="ml-2 text-[11px] font-semibold text-amber-600 normal-case">
                            ⚠️ Aucun pointage aujourd'hui — tous les employés du magasin affichés
                          </span>
                        )}
                      </label>
                      {sellCandidates.length > 0 ? (
                        <select
                          value={sellEmployeeId}
                          onChange={e => setSellEmployeeId(e.target.value)}
                          className="mt-2 w-full px-4 py-3.5 border-2 border-slate-200 rounded-2xl text-base font-semibold text-slate-800 bg-white focus:outline-none focus:border-indigo-400"
                        >
                          {sellCandidates.map(u => (
                            <option key={u.id} value={u.id}>{u.fullName}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="mt-2 text-sm text-rose-600 font-semibold">
                          Aucun employé trouvé pour ce magasin. La vente sera attribuée à votre compte.
                        </p>
                      )}
                    </div>
                    {sellingPhone.colors && sellingPhone.colors.filter(c => c.qty > 0).length > 0 && (
                      <div>
                        <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Sélectionner l'unité à vendre</label>
                        <div className="mt-3 space-y-3">
                          {sellingPhone.colors.map((c, i) => {
                            if (c.qty === 0) return null;
                            const realIdx = i;
                            return (
                              <button
                                key={i}
                                onClick={() => {
                                  setSellColorIndex(realIdx);
                                  setSellPrice(String(c.price ?? sellingPhone.price));
                                }}
                                className={cn(
                                  'w-full flex items-start gap-4 px-5 py-4 rounded-2xl border-2 text-left transition-all',
                                  sellColorIndex === realIdx ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
                                )}
                              >
                                <span className="w-12 h-12 rounded-xl border-2 border-slate-200 shrink-0" style={{ backgroundColor: c.color }} />
                                <div className="flex-1 min-w-0 space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-base font-bold text-slate-900">Unité {i + 1}</span>
                                    <span className={cn(
                                      'text-xs font-bold px-2.5 py-1 rounded-full',
                                      (c.condition || sellingPhone.condition) === 'Neuf' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                    )}>
                                      {c.condition || sellingPhone.condition}
                                    </span>
                                    <span className="ml-auto text-xl font-black text-emerald-600">{c.price ?? sellingPhone.price}€</span>
                                  </div>
                                  <div className="flex gap-2 flex-wrap">
                                    <span className="text-sm px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-semibold">{c.ram || sellingPhone.ram} RAM</span>
                                    <span className="text-sm px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-semibold">{c.storage || sellingPhone.storage}</span>
                                  </div>
                                  {c.reference && (
                                    <p className="text-sm font-mono text-slate-500">IMEI: {c.reference}</p>
                                  )}
                                  {(c.batteryHealth || c.screenCondition || c.frameCondition) && (
                                    <div className="flex gap-2 flex-wrap">
                                      {c.batteryHealth && <span className="text-sm px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium">🔋 {c.batteryHealth}</span>}
                                      {c.screenCondition && <span className="text-sm px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg font-medium">📱 {c.screenCondition}</span>}
                                      {c.frameCondition && <span className="text-sm px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg font-medium">🛡️ {c.frameCondition}</span>}
                                    </div>
                                  )}
                                  {c.notes && (
                                    <p className="text-sm text-slate-600 bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2 italic">📝 {c.notes}</p>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Prix de vente (€)</label>
                      <input
                        type="number"
                        value={sellPrice}
                        onChange={e => setSellPrice(e.target.value)}
                        className="mt-2 w-full px-5 py-4 border-2 border-slate-200 rounded-2xl text-2xl font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="px-6 py-5 border-t border-slate-200 bg-slate-50 flex gap-3">
                    <button onClick={closeSellModal} className="flex-1 py-4 rounded-2xl border-2 border-slate-300 text-slate-700 text-base font-bold hover:bg-white transition-colors">Annuler</button>
                    <button
                      onClick={confirmSell}
                      className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white text-base font-bold inline-flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/25"
                    >
                      <ShoppingCart size={20} /> Confirmer vente
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {requestingPhone && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center" onClick={closeRequestModal}>
            <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {sent ? (
                <div className="p-8 text-center space-y-3">
                  <p className="text-xl font-black text-slate-900">Demande envoyée</p>
                  <p className="text-sm text-slate-500">Le téléphone est maintenant réservé jusqu'à approbation/refus.</p>
                  <button onClick={closeRequestModal} className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold">Fermer</button>
                </div>
              ) : (
                <>
                  <div className="px-5 py-4 border-b border-slate-200">
                    <p className="text-lg font-black text-slate-900">Demande de transfert</p>
                    <p className="text-sm text-slate-500 mt-1">{requestingPhone.brand} {requestingPhone.model} · {requestingPhone.storage} · {requestingPhone.ram}</p>
                    <p className="text-xs text-slate-400 mt-1">{requestingPhone.store} → {activeStore}</p>
                  </div>

                  <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Destinataire ({sourceStore})</label>
                      <select
                        value={selectedReceiverId}
                        onChange={(e) => setSelectedReceiverId(e.target.value)}
                        className="mt-1 w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm"
                      >
                        {receiverCandidates.map(u => (
                          <option key={u.id} value={u.id}>{u.fullName}</option>
                        ))}
                      </select>
                      {receiverCandidates.length === 0 && (
                        <p className="text-xs text-rose-600 mt-1">Aucun utilisateur trouvé dans ce magasin.</p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unités à demander</label>
                      {requestColors.length > 0 ? requestColors.map((c, i) => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center gap-3">
                          <span className="w-8 h-8 rounded-md border border-slate-300" style={{ backgroundColor: c.color }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{c.color}</p>
                            <p className="text-xs text-slate-500 truncate">
                              {c.reference ? `IMEI: ${c.reference}` : 'Sans IMEI'} · {c.price ?? requestingPhone.price}€ · Dispo: {c.qty}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => updateSelectedQty(i, -1)} className="w-7 h-7 rounded-lg border border-slate-300 bg-white font-bold">-</button>
                            <span className="w-8 text-center text-sm font-black text-slate-900">{c.selectedQty}</span>
                            <button onClick={() => updateSelectedQty(i, 1)} className="w-7 h-7 rounded-lg border border-slate-300 bg-white font-bold">+</button>
                          </div>
                        </div>
                      )) : (
                        <p className="text-sm text-slate-500">Aucune unité disponible.</p>
                      )}
                    </div>
                  </div>

                  <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-600">Quantité demandée: <span className="font-black text-slate-900">{totalSelectedQty}</span></span>
                    <div className="flex items-center gap-2">
                      <button onClick={closeRequestModal} className="px-4 py-2 rounded-xl border-2 border-slate-300 text-slate-700 text-sm font-bold">Annuler</button>
                      <button
                        onClick={handleSendRequest}
                        disabled={!selectedReceiverId || totalSelectedQty <= 0 || receiverCandidates.length === 0 || sending}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        <Send size={14} /> Envoyer
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {/* ── Unit Detail Modal ──────────────────────────────── */}
        {detailPhone && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center" onClick={() => setDetailPhone(null)}>
            <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between">
                <div>
                  <p className="text-lg font-black text-slate-900">{detailPhone.brand} {detailPhone.model}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{detailPhone.storage} · {detailPhone.ram} RAM · {detailPhone.store}</p>
                </div>
                <button onClick={() => setDetailPhone(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
                {detailPhone.colors && detailPhone.colors.length > 0 ? detailPhone.colors.map((c, i) => (
                  <div key={i} className={cn(
                    'p-3 rounded-xl border space-y-2',
                    c.qty === 0 ? 'border-red-200 bg-red-50/40 opacity-70' : 'border-slate-100 bg-slate-50'
                  )}>
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-lg border-2 border-slate-200 shrink-0" style={{ backgroundColor: c.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-1.5">
                          <span className="text-sm font-bold text-slate-900">Unité {i + 1}</span>
                          <span className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full',
                            (c.condition || detailPhone.condition) === 'Neuf' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          )}>
                            {c.condition || detailPhone.condition}
                          </span>
                          {c.qty === 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">VENDU</span>
                          )}
                          <span className="ml-auto text-sm font-black text-indigo-600">
                            {c.price ? `${c.price}€` : detailPhone.price > 0 ? `${detailPhone.price}€` : ''}
                          </span>
                        </div>
                        {c.reference && <p className="text-[11px] font-mono text-slate-500">{c.reference}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[11px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-semibold">{c.ram || detailPhone.ram} RAM</span>
                      <span className="text-[11px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-semibold">{c.storage || detailPhone.storage}</span>
                    </div>
                    {c.reference && (
                      <div className="flex justify-center bg-white rounded-lg p-2 border border-slate-100">
                        <ReactBarcode value={c.reference} format="CODE128" width={1.5} height={35} fontSize={10} margin={2} />
                      </div>
                    )}
                    {(c.batteryHealth || c.screenCondition || c.frameCondition) && (
                      <div className="flex flex-wrap gap-1.5">
                        {c.batteryHealth && <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">🔋 {c.batteryHealth}</span>}
                        {c.screenCondition && <span className="text-[11px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full font-medium">📱 {c.screenCondition}</span>}
                        {c.frameCondition && <span className="text-[11px] px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full font-medium">🛡️ {c.frameCondition}</span>}
                      </div>
                    )}
                    {c.notes && (
                      <p className="text-[11px] text-slate-600 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1.5 italic">📝 {c.notes}</p>
                    )}
                  </div>
                )) : (
                  <p className="text-sm text-slate-500 text-center py-6">Aucun détail disponible.</p>
                )}
              </div>
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-500">{detailPhone.quantity} unité(s) au total</span>
                <button onClick={() => setDetailPhone(null)} className="px-4 py-2 text-sm font-bold text-slate-700 bg-white border-2 border-slate-300 rounded-xl hover:bg-slate-50">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Unit Detail Modal ──────────────────────────────── */}
        {detailPhone && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center" onClick={() => setDetailPhone(null)}>
            <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between">
                <div>
                  <p className="text-lg font-black text-slate-900">{detailPhone.brand} {detailPhone.model}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{detailPhone.storage} · {detailPhone.ram} RAM · {detailPhone.store}</p>
                </div>
                <button onClick={() => setDetailPhone(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
                {detailPhone.colors && detailPhone.colors.length > 0 ? detailPhone.colors.map((c, i) => (
                  <div key={i} className={cn(
                    'p-3 rounded-xl border space-y-2',
                    c.qty === 0 ? 'border-red-200 bg-red-50/40 opacity-70' : 'border-slate-100 bg-slate-50'
                  )}>
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-lg border-2 border-slate-200 shrink-0" style={{ backgroundColor: c.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-1.5">
                          <span className="text-sm font-bold text-slate-900">Unité {i + 1}</span>
                          <span className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full',
                            (c.condition || detailPhone.condition) === 'Neuf' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          )}>
                            {c.condition || detailPhone.condition}
                          </span>
                          {c.qty === 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">VENDU</span>
                          )}
                          <span className="ml-auto text-sm font-black text-indigo-600">
                            {c.price ? `${c.price}€` : detailPhone.price > 0 ? `${detailPhone.price}€` : ''}
                          </span>
                        </div>
                        {c.reference && <p className="text-[11px] font-mono text-slate-500">{c.reference}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[11px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-semibold">{c.ram || detailPhone.ram} RAM</span>
                      <span className="text-[11px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-semibold">{c.storage || detailPhone.storage}</span>
                    </div>
                    {c.reference && (
                      <div className="flex justify-center bg-white rounded-lg p-2 border border-slate-100">
                        <ReactBarcode value={c.reference} format="CODE128" width={1.5} height={35} fontSize={10} margin={2} />
                      </div>
                    )}
                    {(c.batteryHealth || c.screenCondition || c.frameCondition) && (
                      <div className="flex flex-wrap gap-1.5">
                        {c.batteryHealth && <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">🔋 {c.batteryHealth}</span>}
                        {c.screenCondition && <span className="text-[11px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full font-medium">📱 {c.screenCondition}</span>}
                        {c.frameCondition && <span className="text-[11px] px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full font-medium">🛡️ {c.frameCondition}</span>}
                      </div>
                    )}
                    {c.notes && (
                      <p className="text-[11px] text-slate-600 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1.5 italic">📝 {c.notes}</p>
                    )}
                  </div>
                )) : (
                  <p className="text-sm text-slate-500 text-center py-6">Aucun détail disponible.</p>
                )}
              </div>
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-500">{detailPhone.quantity} unité(s) au total</span>
                <button onClick={() => setDetailPhone(null)} className="px-4 py-2 text-sm font-bold text-slate-700 bg-white border-2 border-slate-300 rounded-xl hover:bg-slate-50">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </TabletLayout>
  );
};
