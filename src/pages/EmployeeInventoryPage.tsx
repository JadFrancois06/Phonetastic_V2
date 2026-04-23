import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { EmployeeLayout } from '../components/Layouts';
import { useStore } from '../store';
import { Search, Package, ShoppingCart, Send, CheckCircle2, Settings2, Eye, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { PhoneCondition, Phone, PhoneColor, Store } from '../types';
import { sendMessageToDB, fetchOnlineUsersFromDB } from '../lib/authService';
import { supabase } from '../lib/supabase';
import ReactBarcode from 'react-barcode';

export const EmployeeInventoryPage = () => {
  const { inventory, currentUser, sellPhone, addSale, brands, users } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [conditionFilter, setConditionFilter] = useState<PhoneCondition | 'All'>('All');
  const [storeFilter, setStoreFilter] = useState<Store | 'All'>('All');
  const [activeBrandTab, setActiveBrandTab] = useState<string>('All');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;
  const [sellingPhone, setSellingPhone] = useState<Phone | null>(null);
  const [sellPrice, setSellPrice] = useState('');

  // Request modal state
  const [requestingPhone, setRequestingPhone] = useState<Phone | null>(null);
  const [requestColors, setRequestColors] = useState<PhoneColor[]>([]);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [freshOnlineIds, setFreshOnlineIds] = useState<Set<string>>(new Set());

  // Detail modal state
  const [detailPhone, setDetailPhone] = useState<Phone | null>(null);

  const availableStores = [...new Set(inventory.map(phone => phone.store))].sort();

  const filteredInventory = inventory.filter(phone => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = phone.brand.toLowerCase().includes(term) || 
                          phone.model.toLowerCase().includes(term) ||
                          String(phone.price).includes(searchTerm) ||
                          (phone.colors?.some(c => c.reference?.toLowerCase().includes(term)) ?? false);
    const matchesCondition = conditionFilter === 'All' || phone.condition === conditionFilter;
    const matchesStore = storeFilter === 'All' || phone.store === storeFilter;
    const matchesBrandTab = activeBrandTab === 'All' || phone.brand === activeBrandTab;
    const matchesPriceMin = priceMin === '' || phone.price >= Number(priceMin);
    const matchesPriceMax = priceMax === '' || phone.price <= Number(priceMax);
    return matchesSearch && matchesCondition && matchesStore && matchesBrandTab && matchesPriceMin && matchesPriceMax;
  });

  const totalPages = Math.max(1, Math.ceil(filteredInventory.length / ITEMS_PER_PAGE));
  const paginatedInventory = filteredInventory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleFilterChange = (setter: (v: any) => void) => (v: any) => {
    setter(v);
    setCurrentPage(1);
  };

  const handleSellClick = (phone: Phone) => {
    setSellingPhone(phone);
    // Pre-fill with first color price or global price
    const firstColor = phone.colors?.[0];
    setSellPrice(String(firstColor?.price ?? phone.price ?? ''));
  };

  const confirmSell = () => {
    if (!sellingPhone) return;
    const finalPrice = Number(sellPrice) || 0;
    const firstColor = sellingPhone.colors?.[0];
    addSale({
      phoneBrand: sellingPhone.brand,
      phoneModel: sellingPhone.model,
      phoneRam: sellingPhone.ram,
      phoneStorage: sellingPhone.storage,
      phoneCondition: sellingPhone.condition,
      color: firstColor?.color || '',
      reference: firstColor?.reference,
      price: finalPrice,
      store: sellingPhone.store,
      soldBy: currentUser?.id || '',
      soldByName: currentUser?.fullName || '',
      soldAt: new Date().toISOString(),
    });
    sellPhone(sellingPhone.id);
    setSellingPhone(null);
    setSellPrice('');
  };

  // Open request modal — prefill with phone data
  const openRequestModal = async (phone: Phone) => {
    setRequestingPhone(phone);
    setRequestColors([]);
    setSelectedReceiverId('');
    setSent(false);
    // Fetch fresh online statuses directly from Supabase
    const statuses = await fetchOnlineUsersFromDB();
    setFreshOnlineIds(new Set(statuses.filter(u => u.online).map(u => u.id)));
  };

  const closeRequestModal = () => {
    setRequestingPhone(null);
    setSent(false);
  };

  // Employees from the phone's store who are online (fresh from DB)
  const onlineEmployeesInStore = requestingPhone
    ? users.filter(u =>
        u.id !== currentUser?.id &&
        u.stores.includes(requestingPhone.store) &&
        freshOnlineIds.has(u.id)
      )
    : [];

  const handleSendRequest = async () => {
    if (!requestingPhone || !selectedReceiverId || !currentUser) return;
    const totalReqQty = requestColors.length || 1;
    setSending(true);

    const colorLines = requestColors.filter(c => c.qty > 0).length > 0
      ? requestColors.filter(c => c.qty > 0).map(c => {
          // Find the matching color entry from the phone to get full details
          const match = requestingPhone.colors?.find(pc => pc.color === c.color && pc.reference === c.reference);
          let line = `  🎨 ${c.color} × ${c.qty}`;
          if (match?.price) line += ` · ${match.price}€`;
          if (match?.reference) line += `\n     🔖 Réf: ${match.reference}`;
          if (match?.batteryHealth) line += ` · 🔋 ${match.batteryHealth}`;
          if (match?.screenCondition) line += ` · 📱 ${match.screenCondition}`;
          if (match?.frameCondition) line += ` · 🛡️ ${match.frameCondition}`;
          return line;
        }).join('\n') + '\n'
      : '';

    const msg =
      `📦 Demande de transfert\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📱 ${requestingPhone.brand} ${requestingPhone.model}\n` +
      `💾 Stockage : ${requestingPhone.storage}\n` +
      `🧠 RAM : ${requestingPhone.ram}\n` +
      `🏷️ État : ${requestingPhone.condition}\n` +
      `💰 Prix : ${requestingPhone.price}€\n` +
      `📊 Quantité totale : ${totalReqQty}\n` +
      colorLines +
      `🏪 Depuis : ${requestingPhone.store}\n` +
      `➡️ Pour : ${currentUser.currentStore || currentUser.stores[0]}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `Envoyé par ${currentUser.fullName}`;

    const saved = await sendMessageToDB(currentUser.id, selectedReceiverId, msg);
    if (saved) {
      // Broadcast so the receiver sees it instantly without refresh
      const ch = supabase.channel('phonetastic-messages');
      await ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.send({ type: 'broadcast', event: 'new-message', payload: saved });
          supabase.removeChannel(ch);
        }
      });
    }
    setSending(false);
    setSent(true);
  };

  return (
    <EmployeeLayout title="Stock Magasin">
      <div className="space-y-6">
        {/* Admin Management Button */}
        {currentUser?.permissions?.canAccessInventory && (
          <div className="flex justify-end">
            <Link
              to="/admin/inventory"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-600/25 transition-all"
            >
              <Settings2 size={16} />
              Gestion du Stock
            </Link>
          </div>
        )}

        {/* Brand Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-thin" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
          <button
            onClick={() => { setActiveBrandTab('All'); setCurrentPage(1); }}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-all cursor-pointer',
              activeBrandTab === 'All' ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            )}
          >
            Toutes les marques
          </button>
          {brands.map(brand => (
            <button
              key={brand.id}
              onClick={() => { setActiveBrandTab(brand.name); setCurrentPage(1); }}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-all cursor-pointer',
                activeBrandTab === brand.name ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              )}
            >
              {brand.name}
            </button>
          ))}
        </div>

        {/* Actions & Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Rechercher un téléphone..."
              className="w-full pl-10 pr-4 py-2 bg-white border-2 border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors"
              value={searchTerm}
              onChange={(e) => handleFilterChange(setSearchTerm)(e.target.value)}
            />
          </div>
          <select
            className="w-full sm:w-auto bg-white border-2 border-slate-300 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
            value={conditionFilter}
            onChange={(e) => handleFilterChange(setConditionFilter)(e.target.value as PhoneCondition | 'All')}
          >
            <option value="All">Tous les états</option>
            <option value="Neuf">Neuf</option>
            <option value="Occasion">Occasion</option>
          </select>
          <select
            className="w-full sm:w-auto bg-white border-2 border-slate-300 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
            value={storeFilter}
            onChange={(e) => handleFilterChange(setStoreFilter)(e.target.value as Store | 'All')}
          >
            <option value="All">Tous les magasins</option>
            {availableStores.map(store => (
              <option key={store} value={store}>{store}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Prix min"
              min={0}
              className="w-24 px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              value={priceMin}
              onChange={(e) => handleFilterChange(setPriceMin)(e.target.value)}
            />
            <span className="text-slate-400 text-sm">—</span>
            <input
              type="number"
              placeholder="Prix max"
              min={0}
              className="w-24 px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              value={priceMax}
              onChange={(e) => handleFilterChange(setPriceMax)(e.target.value)}
            />
            <span className="text-slate-400 text-sm">€</span>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Modèle</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Couleur</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">État</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Caractéristiques</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Prix</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Quantité</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Magasin</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedInventory.map((phone) => (
                  <tr key={phone.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-slate-600 border border-slate-200/60">
                          <Package size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{phone.brand}</p>
                          <p className="text-sm text-slate-500">{phone.model}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {phone.colors && phone.colors.length > 0 ? (
                        <div className="flex items-center gap-1">
                          {phone.colors.map((c, i) => (
                            <span
                              key={i}
                              className="inline-block w-7 h-7 rounded-lg border-2 border-slate-200 cursor-pointer hover:scale-110 hover:ring-2 hover:ring-indigo-300 transition-all"
                              style={{ backgroundColor: c.color }}
                              title={`${c.qty} unité(s)${c.price ? ' · ' + c.price + '€' : ''}${c.reference ? ' · ' + c.reference : ''}`}
                              onClick={() => setDetailPhone(phone)}
                            />
                          ))}
                          <button
                            type="button"
                            onClick={() => setDetailPhone(phone)}
                            className="ml-1 p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Voir détails"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        phone.condition === 'Neuf' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {phone.condition}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      {phone.storage} • {phone.ram} RAM
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900 text-center whitespace-nowrap">
                      {phone.condition === 'Occasion' && phone.colors && phone.colors.some(c => c.price) ? (
                        (() => {
                          const prices = phone.colors!.filter(c => c.price).map(c => c.price!);
                          const min = Math.min(...prices);
                          const max = Math.max(...prices);
                          return min === max ? `${min}€` : `${min}–${max}€`;
                        })()
                      ) : (
                        `${phone.price}€`
                      )}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center justify-center min-w-8 h-8 px-2 rounded-lg text-sm font-bold ${
                        phone.quantity > 5 ? 'bg-slate-100 text-slate-700' : 
                        phone.quantity > 0 ? 'bg-amber-100 text-amber-700' : 
                        'bg-red-100 text-red-700'
                      }`}>
                        {phone.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      {phone.store}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {phone.store === currentUser?.currentStore ? (
                        <button
                          onClick={() => handleSellClick(phone)}
                          disabled={phone.quantity === 0}
                          className={cn(
                            'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer',
                            phone.quantity > 0 
                              ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white hover:from-slate-900 hover:to-slate-950 shadow-lg shadow-slate-900/25' 
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          )}
                        >
                          <ShoppingCart size={16} />
                          Vendre 1
                        </button>
                      ) : (
                        <button
                          onClick={() => openRequestModal(phone)}
                          disabled={phone.quantity === 0}
                          className={cn(
                            'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer',
                            phone.quantity > 0 
                              ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-600/25' 
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          )}
                        >
                          <Package size={16} />
                          Demander
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredInventory.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      Aucun téléphone trouvé dans votre magasin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2">
            <p className="text-sm text-slate-500">
              {filteredInventory.length} résultat{filteredInventory.length !== 1 ? 's' : ''} — Page {currentPage} / {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1.5 text-sm rounded-xl border-2 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                «
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm rounded-xl border-2 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ‹ Préc.
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-sm text-slate-400">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p as number)}
                      className={cn(
                        'px-3 py-1.5 text-sm rounded-xl border-2 transition-all',
                        currentPage === p
                          ? 'border-indigo-600 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/25'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {p}
                    </button>
                  )
                )
              }
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm rounded-xl border-2 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Suiv. ›
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1.5 text-sm rounded-xl border-2 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                »
              </button>
            </div>
          </div>
        )}

        {/* Sell Confirmation Modal */}
        {sellingPhone && (() => {
          const colors = sellingPhone.colors || [];
          const prices = colors.map(c => c.price).filter((p): p is number => p !== undefined && p > 0);
          const hasRange = prices.length > 1 && Math.min(...prices) !== Math.max(...prices);
          const priceHint = hasRange ? `${Math.min(...prices)}–${Math.max(...prices)}€` : prices.length > 0 ? `${prices[0]}€` : sellingPhone.price > 0 ? `${sellingPhone.price}€` : null;
          return (
          <div className="fixed  inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={() => { setSellingPhone(null); setSellPrice(''); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-xl font-bold text-slate-900">Confirmer la vente</h3>
              </div>
              <div className="p-6 space-y-8">
                {/* Phone info */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="h-18  w-18 rounded-xl bg-slate-300 flex items-center justify-center text-4xl font-bold text-slate-600">
                    {sellingPhone.brand.charAt(0)}
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">{sellingPhone.brand} {sellingPhone.model}</p>
                    <p className="text-lg text-slate-700">{sellingPhone.storage} · {sellingPhone.ram} · {sellingPhone.store}</p>
                  </div>
                </div>

                {/* Price hint */}
                {priceHint && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-700">Prix catalogue :</span>
                    <span className="font-semibold text-slate-700">{priceHint}</span>
                  </div>
                )}

                {/* Price input */}
                <div>
                  <label className="block text-lg font-semibold text-slate-700 mb-2">Prix de vente final (€)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={sellPrice}
                      onChange={e => setSellPrice(e.target.value)}
                      placeholder="Entrez le prix de vente…"
                      className="w-full bg-gray-200 px-4 py-3 pr-10 border-2 border-slate-200 rounded-xl text-lg font-bold text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-300 placeholder:font-normal placeholder:text-base"
                      autoFocus
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-800 font-medium">€</span>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setSellingPhone(null); setSellPrice(''); }}
                    className="flex-1 px-4 py-2.5 bg-white border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={confirmSell}
                    disabled={!sellPrice || Number(sellPrice) <= 0}
                    className="flex-1 px-4 py-2.5 text-white rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-600/25 transition-all font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Confirmer · {sellPrice ? `${Number(sellPrice).toFixed(2)}€` : '—'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          );
        })()}

        {/* Request Modal */}
        {requestingPhone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
            <div className="bg-gray-200 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
              {sent ? (
                /* ── Success state ── */
                <div className="p-8 flex flex-col items-center text-center space-y-4">
                  <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 size={36} className="text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900">Demande envoyée !</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Le message a été envoyé à {users.find(u => u.id === selectedReceiverId)?.fullName}.
                    </p>
                  </div>
                  <button
                    onClick={closeRequestModal}
                    className="mt-2 px-6 py-2.5 text-white rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-600/25 transition-all font-medium cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="p-5 border-b border-slate-200">
                    <h3 className="text-base text-xl font-bold text-slate-900">Demander un transfert</h3>
                    <p className="text-lg text-slate-500 mt-0.5">Depuis {requestingPhone.store}</p>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Phone summary */}
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="h-10 w-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                        <Package size={30} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl font-semibold text-slate-900 truncate">{requestingPhone.brand} {requestingPhone.model}</p>
                        <p className="text-lg text-slate-500">{requestingPhone.storage} · {requestingPhone.ram} RAM · {requestingPhone.condition}{requestingPhone.condition !== 'Occasion' ? ` · ${requestingPhone.price}€` : ''}</p>
                      </div>
                    </div>

                    {/* Color & Quantity selector */}
                    {requestingPhone.colors && requestingPhone.colors.length > 0 ? (
                      <div>
                        <label className="block text-xl font-semibold text-slate-600 uppercase tracking-wide mb-2">
                          Sélectionner les unités
                        </label>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {requestingPhone.colors.filter(c => c.qty > 0).map((c, i) => {
                            const isSelected = requestColors.some(rc => rc.color === c.color && rc.reference === c.reference);
                            return (
                              <div
                                key={i}
                                onClick={() => {
                                  if (isSelected) {
                                    setRequestColors(requestColors.filter(rc => !(rc.color === c.color && rc.reference === c.reference)));
                                  } else {
                                    setRequestColors([...requestColors, { color: c.color, qty: 1, reference: c.reference }]);
                                  }
                                }}
                                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200'
                                    : 'border-slate-100 bg-slate-50 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className="w-8 h-8 rounded-lg border-2 shrink-0"
                                    style={{ backgroundColor: c.color, borderColor: isSelected ? '#6366f1' : '#e2e8f0' }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-slate-700">Unité {i + 1}</span>
                                      {c.price ? (
                                        <span className="text-xs font-bold text-indigo-600">{c.price}€</span>
                                      ) : requestingPhone.price > 0 ? (
                                        <span className="text-xs font-bold text-slate-500">{requestingPhone.price}€</span>
                                      ) : null}
                                    </div>
                                    {c.reference && (
                                      <p className="text-[18px] font-mono text-slate-400">{c.reference}</p>
                                    )}
                                  </div>
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                    isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                                  }`}>
                                    {isSelected && <span className="text-white text-lg">✓</span>}
                                  </div>
                                </div>
                                {c.reference && (
                                  <div className="mt-2 flex justify-center">
                                    <ReactBarcode value={c.reference} format="CODE128" width={1.2} height={20} fontSize={14} margin={1} />
                                  </div>
                                )}
                                {(c.batteryHealth || c.screenCondition || c.frameCondition) && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {c.batteryHealth && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full">🔋 {c.batteryHealth}</span>}
                                    {c.screenCondition && <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-full">📱 {c.screenCondition}</span>}
                                    {c.frameCondition && <span className="text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded-full">🛡️ {c.frameCondition}</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {requestColors.length > 0 && (
                          <p className="text-lg text-indigo-600 font-medium mt-2">
                            {requestColors.length} unité(s) sélectionnée(s)
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                          Quantité demandée <span className="text-slate-400 normal-case font-normal">(disponible : {requestingPhone.quantity})</span>
                        </label>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setRequestColors(rc => {
                              const cur = rc[0]?.qty || 1;
                              return [{ color: '', qty: Math.max(1, cur - 1) }];
                            })}
                            className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-colors text-lg"
                          >−</button>
                          <span className="w-10 text-center text-base font-bold text-slate-900">{requestColors[0]?.qty || 1}</span>
                          <button
                            onClick={() => setRequestColors(rc => {
                              const cur = rc[0]?.qty || 1;
                              return [{ color: '', qty: Math.min(requestingPhone.quantity, cur + 1) }];
                            })}
                            className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-colors text-lg"
                          >+</button>
                        </div>
                      </div>
                    )}

                    {/* Employee selector */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                        Envoyer à (employés en ligne dans {requestingPhone.store})
                      </label>
                      {onlineEmployeesInStore.length === 0 ? (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-700">
                          <span>⚠️</span>
                          <span>Aucun employé en ligne dans {requestingPhone.store} pour le moment.</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {onlineEmployeesInStore.map(emp => (
                            <button
                              key={emp.id}
                              onClick={() => setSelectedReceiverId(emp.id)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                                selectedReceiverId === emp.id
                                  ? 'border-indigo-500 bg-indigo-50'
                                  : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <div className="relative shrink-0">
                                <div className="h-9 w-9 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">
                                  {emp.fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                                </div>
                                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xl font-semibold text-slate-900 truncate">{emp.fullName}</p>
                                <p className="text-sm text-emerald-600 font-medium">En ligne</p>
                              </div>
                              {selectedReceiverId === emp.id && (
                                <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="px-5 py-4 border-t border-slate-200 flex gap-3">
                    <button
                      onClick={closeRequestModal}
                      className="flex-1 px-4 py-2.5 bg-white border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium text-sm cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSendRequest}
                      disabled={!selectedReceiverId || sending}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer',
                        selectedReceiverId && !sending
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-600/25'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      )}
                    >
                      <Send size={15} />
                      {sending ? 'Envoi…' : 'Envoyer la demande'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Phone Detail Modal */}
        {detailPhone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={() => setDetailPhone(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{detailPhone.brand} {detailPhone.model}</h3>
                  <p className="text-xs text-slate-500">{detailPhone.storage} · {detailPhone.ram} RAM · {detailPhone.condition} · {detailPhone.store}</p>
                </div>
                <button onClick={() => setDetailPhone(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Unit list */}
              <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                {detailPhone.colors && detailPhone.colors.length > 0 ? (
                  detailPhone.colors.map((c, i) => (
                    <div key={i} className="p-3 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-10 h-10 rounded-lg border-2 border-slate-200 shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">Unité {i + 1}</span>
                            <span className="text-xs text-slate-500">× {c.qty}</span>
                            {c.price ? (
                              <span className="text-sm font-bold text-indigo-600">{c.price}€</span>
                            ) : detailPhone.price > 0 ? (
                              <span className="text-sm font-bold text-slate-600">{detailPhone.price}€</span>
                            ) : null}
                          </div>
                          {c.reference && (
                            <p className="text-[11px] font-mono text-slate-500">{c.reference}</p>
                          )}
                        </div>
                      </div>
                      {c.reference && (
                        <div className="flex justify-center bg-white rounded-lg p-2 border border-slate-100">
                          <ReactBarcode value={c.reference} format="CODE128" width={1.5} height={35} fontSize={10} margin={2} />
                        </div>
                      )}
                      {(c.batteryHealth || c.screenCondition || c.frameCondition) && (
                        <div className="flex flex-wrap gap-1.5">
                          {c.batteryHealth && (
                            <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">🔋 {c.batteryHealth}</span>
                          )}
                          {c.screenCondition && (
                            <span className="text-[11px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full font-medium">📱 {c.screenCondition}</span>
                          )}
                          {c.frameCondition && (
                            <span className="text-[11px] px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full font-medium">🛡️ {c.frameCondition}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">Aucun détail disponible.</p>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-500">{detailPhone.quantity} unité(s) au total</span>
                <button
                  onClick={() => setDetailPhone(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border-2 border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
};
