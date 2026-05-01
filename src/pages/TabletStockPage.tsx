import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { TabletLayout } from '../components/Layouts';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { Phone, PhoneColor } from '../types';
import { Package, Search, Send, X, ChevronLeft, Store, ShoppingCart, CheckCircle2 } from 'lucide-react';
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
  const { currentUser, setCurrentStore, inventory, users, stores, updatePhone, addSale } = useStore();

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

  // Sell helpers
  const openSellModal = (phone: Phone) => {
    setSellConfirmed(false);
    setSellColorIndex(0);
    const firstAvailColor = phone.colors?.find(c => c.qty > 0);
    setSellPrice(String(firstAvailColor?.price ?? phone.price ?? ''));
    setSellingPhone(phone);
  };

  const closeSellModal = () => {
    setSellingPhone(null);
    setSellConfirmed(false);
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
    const newQty = Math.max(0, sellingPhone.quantity - 1);
    updatePhone(sellingPhone.id, { quantity: newQty, colors: updatedColors });
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
      soldBy: currentUser.id,
      soldByName: currentUser.fullName,
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedPhones.map(phone => {
              const qty = getAvailableQty(phone);
              const locked = phoneLocks[phone.id];
              return (
                <div
                  key={phone.id}
                  className={cn(
                    'rounded-2xl border bg-white p-4 shadow-sm transition-all',
                    qty > 0 ? 'border-slate-200 hover:shadow-md' : 'border-slate-200 opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-slate-900">{phone.brand}</p>
                      <p className="text-sm text-slate-500 font-medium">{phone.model}</p>
                    </div>
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-1 rounded-lg',
                      phone.condition === 'Neuf' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      {phone.condition}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-600">{phone.storage} · {phone.ram} RAM</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{getPriceDisplay(phone)}</p>

                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {(phone.colors || []).slice(0, 6).map((c, idx) => (
                      <span key={idx} className="relative w-6 h-6 rounded-md border border-slate-300" style={{ backgroundColor: c.color }} title={`${c.qty} unité(s)`}>
                        {c.qty === 0 && <span className="absolute inset-0 flex items-center justify-center"><X size={10} className="text-red-600 stroke-[3]" /></span>}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className={cn(
                      'text-xs font-bold px-2 py-1 rounded-lg',
                      qty > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    )}>
                      {qty > 0 ? `${qty} dispo` : 'Épuisé'}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Store size={12} /> {phone.store}
                    </span>
                  </div>

                  {isOwnStore ? (
                    <button
                      disabled={qty === 0}
                      onClick={() => openSellModal(phone)}
                      className={cn(
                        'mt-4 w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all',
                        qty > 0
                          ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-700 hover:to-emerald-800 shadow-lg shadow-emerald-600/25'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      )}
                    >
                      <ShoppingCart size={15} />
                      Vendre
                    </button>
                  ) : (
                    <>
                      <button
                        disabled={qty === 0 || Boolean(locked)}
                        onClick={() => openRequestModal(phone)}
                        className={cn(
                          'mt-4 w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all',
                          qty > 0 && !locked
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-600/25'
                            : locked
                              ? 'bg-amber-100 text-amber-800 cursor-not-allowed'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        )}
                      >
                        <Package size={15} />
                        {locked ? 'Déjà réservé' : 'Demander transfert'}
                      </button>
                      {locked && (
                        <p className="mt-2 text-[11px] text-amber-700">En attente: {locked.requesterName}</p>
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
            <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {sellConfirmed ? (
                <div className="p-8 text-center space-y-3">
                  <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} className="text-emerald-600" />
                  </div>
                  <p className="text-xl font-black text-slate-900">Vente enregistrée</p>
                  <p className="text-sm text-slate-500">{sellingPhone.brand} {sellingPhone.model} vendu à {Number(sellPrice) || 0}€</p>
                  <button onClick={closeSellModal} className="mt-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold">Fermer</button>
                </div>
              ) : (
                <>
                  <div className="px-5 py-4 border-b border-slate-200">
                    <p className="text-lg font-black text-slate-900">Enregistrer une vente</p>
                    <p className="text-sm text-slate-500 mt-1">{sellingPhone.brand} {sellingPhone.model} · {sellingPhone.storage} · {sellingPhone.ram}</p>
                  </div>
                  <div className="p-5 space-y-4">
                    {sellingPhone.colors && sellingPhone.colors.filter(c => c.qty > 0).length > 0 && (
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Couleur / IMEI</label>
                        <div className="mt-2 space-y-2">
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
                                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all',
                                  sellColorIndex === realIdx ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'
                                )}
                              >
                                <span className="w-8 h-8 rounded-md border border-slate-300 shrink-0" style={{ backgroundColor: c.color }} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-900">{c.color}</p>
                                  {c.reference && <p className="text-xs text-slate-500">IMEI: {c.reference}</p>}
                                </div>
                                <span className="text-sm font-bold text-slate-700">{c.price ?? sellingPhone.price}€</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prix de vente (€)</label>
                      <input
                        type="number"
                        value={sellPrice}
                        onChange={e => setSellPrice(e.target.value)}
                        className="mt-1 w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-base font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex gap-3">
                    <button onClick={closeSellModal} className="flex-1 py-3 rounded-xl border-2 border-slate-300 text-slate-700 text-sm font-bold">Annuler</button>
                    <button
                      onClick={confirmSell}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold inline-flex items-center justify-center gap-2"
                    >
                      <ShoppingCart size={16} /> Confirmer vente
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
      </div>
    </TabletLayout>
  );
};
