import React, { useState, useMemo } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { EmployeeLayout } from '../components/Layouts';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { Search, Wrench, Send, CheckCircle2, ChevronRight, ChevronDown, RotateCcw, Minus, ExternalLink, X, Barcode, ClipboardCheck, Settings2 } from 'lucide-react';
import { PhoneCondition, Store, SPARE_PART_CATEGORIES, SparePart, SparePartQuality } from '../types';
import ReactBarcode from 'react-barcode';
import { sendMessageToDB, fetchOnlineUsersFromDB } from '../lib/authService';
import { supabase } from '../lib/supabase';

export const EmployeeSparePartsPage = () => {
  const { spareParts, stores, currentUser, users, brandSeries, updateSparePart } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [conditionFilter, setConditionFilter] = useState<PhoneCondition | 'All'>('All');
  const [storeFilter, setStoreFilter] = useState<Store | 'All'>('All');

  const [filterBrand, setFilterBrand] = useState('');
  const [filterSeries, setFilterSeries] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Transfer request state
  const [requestingPart, setRequestingPart] = useState<SparePart | null>(null);
  const [requestQualities, setRequestQualities] = useState<{ quality: string; qty: number; maxQty: number; reference?: string; price?: number }[]>([]);
  const [selectedReceiverId, setSelectedReceiverId] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [freshOnlineIds, setFreshOnlineIds] = useState<Set<string>>(new Set());

  // Consume part state
  const [consumeSelectPart, setConsumeSelectPart] = useState<SparePart | null>(null);
  const [consumedPart, setConsumedPart] = useState<SparePart | null>(null);
  const [consumedQuality, setConsumedQuality] = useState<SparePartQuality | null>(null);
  const [refCopied, setRefCopied] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Derived data
  const uniqueBrands = useMemo(() => {
    const set = new Set(spareParts.map(p => p.compatibleBrand).filter(Boolean));
    return [...set].sort();
  }, [spareParts]);

  const uniqueSeries = useMemo(() => {
    if (!filterBrand) return [];
    const fromDB = brandSeries.filter(bs => bs.brandName === filterBrand).map(bs => bs.seriesName);
    const fromParts = spareParts
      .filter(p => p.compatibleBrand === filterBrand)
      .map(p => p.series)
      .filter(Boolean);
    const set = new Set([...fromDB, ...fromParts]);
    return [...set].sort();
  }, [spareParts, brandSeries, filterBrand]);

  const uniqueCategories = useMemo(() => {
    let filtered = spareParts;
    if (filterBrand) filtered = filtered.filter(p => p.compatibleBrand === filterBrand);
    if (filterSeries) filtered = filtered.filter(p => p.series === filterSeries);
    const set = new Set(filtered.map(p => p.category).filter(Boolean));
    return [...set].sort();
  }, [spareParts, filterBrand, filterSeries]);

  const filteredParts = spareParts.filter(part => {
    const term = searchTerm.toLowerCase();
    const matchesRef = part.qualities?.some(q => q.reference?.toLowerCase().includes(term)) ?? false;
    const matchesSearch = !term ||
      part.name.toLowerCase().includes(term) ||
      part.compatibleBrand.toLowerCase().includes(term) ||
      (part.series || '').toLowerCase().includes(term) ||
      part.compatibleModel.toLowerCase().includes(term) ||
      matchesRef;
    const matchesBrand = !filterBrand || part.compatibleBrand === filterBrand;
    const matchesSeries = !filterSeries || part.series === filterSeries;
    const matchesCategory = !filterCategory || part.category === filterCategory;
    const matchesCondition = conditionFilter === 'All' || part.condition === conditionFilter;
    const matchesStore = storeFilter === 'All' || part.store === storeFilter;
    return matchesSearch && matchesBrand && matchesSeries && matchesCategory && matchesCondition && matchesStore;
  });

  // Auto-expand cards whose reference matches the search
  React.useEffect(() => {
    if (!searchTerm) return;
    const term = searchTerm.toLowerCase();
    const matchIds = filteredParts
      .filter(p => p.qualities?.some(q => q.reference?.toLowerCase().includes(term)))
      .map(p => p.id);
    if (matchIds.length > 0) {
      setExpandedCards(prev => {
        const next = new Set(prev);
        matchIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [searchTerm, filteredParts]);

  const openRequestModal = async (part: SparePart) => {
    setRequestingPart(part);
    setRequestQualities(
      (part.qualities || []).filter(q => q.qty > 0).map(q => ({
        quality: q.quality,
        qty: 0,
        maxQty: q.qty,
        reference: q.reference,
        price: q.price,
      }))
    );
    setSelectedReceiverId('');
    setSent(false);
    const statuses = await fetchOnlineUsersFromDB();
    setFreshOnlineIds(new Set(statuses.filter(u => u.online).map(u => u.id)));
  };

  const closeRequestModal = () => {
    setRequestingPart(null);
    setSent(false);
  };

  const onlineEmployeesInStore = requestingPart
    ? users.filter(u =>
        u.id !== currentUser?.id &&
        u.stores.includes(requestingPart.store) &&
        freshOnlineIds.has(u.id)
      )
    : [];

  const handleSendRequest = async () => {
    if (!requestingPart || !selectedReceiverId || !currentUser) return;
    const selectedQuals = requestQualities.filter(q => q.qty > 0);
    const totalQty = selectedQuals.reduce((s, q) => s + q.qty, 0);
    if (totalQty === 0) return;
    setSending(true);

    const qualityLines = selectedQuals.map(q =>
      `  ⭐ ${q.quality} × ${q.qty}${q.reference ? ` (Réf: ${q.reference})` : ''}${q.price ? ` · ${q.price}€` : ''}`
    ).join('\n');

    const msg =
      `🔧 Demande de pièce détachée\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🛠️ ${requestingPart.name}\n` +
      `📂 Catégorie : ${requestingPart.category}\n` +
      `📱 Compatible : ${requestingPart.compatibleBrand}${requestingPart.series ? ` · ${requestingPart.series}` : ''} ${requestingPart.compatibleModel}\n` +
      `🏷️ État : ${requestingPart.condition}\n` +
      `📊 Quantité totale : ${totalQty}\n` +
      `⭐ Qualités demandées :\n${qualityLines}\n` +
      `🏪 Depuis : ${requestingPart.store}\n` +
      `➡️ Pour : ${currentUser.currentStore || currentUser.stores[0]}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `Envoyé par ${currentUser.fullName}`;

    const saved = await sendMessageToDB(currentUser.id, selectedReceiverId, msg);
    if (saved) {
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

  const myStore = currentUser?.currentStore || currentUser?.stores[0];

  const handleConsume = (part: SparePart) => {
    if (part.quantity <= 0) return;
    if (part.qualities && part.qualities.filter(q => q.qty > 0).length > 0) {
      setConsumeSelectPart(part);
    } else {
      updateSparePart(part.id, { quantity: part.quantity - 1 });
      setConsumedPart(part);
      setConsumedQuality(null);
    }
  };

  const handleConsumeQuality = (quality: SparePartQuality) => {
    if (!consumeSelectPart) return;
    const part = consumeSelectPart;
    const updatedQualities = part.qualities!.map(q =>
      q.quality === quality.quality ? { ...q, qty: q.qty - 1 } : q
    );
    updateSparePart(part.id, {
      quantity: part.quantity - 1,
      qualities: updatedQualities,
    });
    setConsumedQuality(quality);
    setConsumedPart(part);
    setConsumeSelectPart(null);
    if (quality.reference) {
      navigator.clipboard.writeText(quality.reference).then(() => { setRefCopied(true); setTimeout(() => setRefCopied(false), 3000); });
    }
  };

  const resetFilters = () => {
    setFilterBrand('');
    setFilterSeries('');
    setFilterCategory('');
  };

  return (
    <EmployeeLayout title="Pièces Détachées">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pièces Détachées</h1>
            <p className="text-slate-500 mt-1">Stock des pièces de rechange disponibles</p>
          </div>
          {currentUser?.permissions?.canAccessSpareParts && (
            <Link
              to="/admin/spare-parts"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-indigo-600/25 transition-all shadow-md shadow-indigo-600/20"
            >
              <Settings2 size={16} />
              Gestion des Pièces
            </Link>
          )}
        </div>

        {/* Hierarchical Navigation: Brand > Series > Category */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Navigation hiérarchique</p>
            {(filterBrand || filterSeries || filterCategory) && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
              >
                <RotateCcw size={12} /> Réinitialiser
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={`px-3 py-2 rounded-xl border-2 text-sm font-medium focus:outline-none focus:border-blue-500 transition-colors cursor-pointer ${
                filterBrand ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white border-slate-300 text-slate-700'
              }`}
              value={filterBrand}
              onChange={(e) => {
                setFilterBrand(e.target.value);
                setFilterSeries('');
                setFilterCategory('');
              }}
            >
              <option value="">Toutes les marques</option>
              {uniqueBrands.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {filterBrand && uniqueSeries.length > 0 && (
              <>
                <ChevronRight size={16} className="text-slate-400 shrink-0" />
                <select
                  className={`px-3 py-2 rounded-xl border-2 text-sm font-medium focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer ${
                    filterSeries ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'bg-white border-slate-300 text-slate-700'
                  }`}
                  value={filterSeries}
                  onChange={(e) => {
                    setFilterSeries(e.target.value);
                    setFilterCategory('');
                  }}
                >
                  <option value="">Toutes les séries</option>
                  {uniqueSeries.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </>
            )}

            {(filterBrand || filterSeries) && uniqueCategories.length > 0 && (
              <>
                <ChevronRight size={16} className="text-slate-400 shrink-0" />
                <select
                  className={`px-3 py-2 rounded-xl border-2 text-sm font-medium focus:outline-none focus:border-violet-500 transition-colors cursor-pointer ${
                    filterCategory ? 'bg-violet-50 border-violet-300 text-violet-800' : 'bg-white border-slate-300 text-slate-700'
                  }`}
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="">Toutes catégories</option>
                  {uniqueCategories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </>
            )}
          </div>

          {(filterBrand || filterSeries || filterCategory) && (
            <div className="flex items-center gap-1.5 mt-3 text-xs">
              {filterBrand && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">{filterBrand}</span>
              )}
              {filterSeries && (
                <>
                  <ChevronRight size={12} className="text-slate-400" />
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">{filterSeries}</span>
                </>
              )}
              {filterCategory && (
                <>
                  <ChevronRight size={12} className="text-slate-400" />
                  <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-medium">{filterCategory}</span>
                </>
              )}
              <span className="text-slate-500 ml-1">({filteredParts.length} résultat{filteredParts.length !== 1 ? 's' : ''})</span>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Rechercher par nom, marque, série ou modèle..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-300 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2.5 bg-white border-2 border-slate-300 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors cursor-pointer"
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value as PhoneCondition | 'All')}
            >
              <option value="All">Tous états</option>
              <option value="Neuf">Neuf</option>
              <option value="Occasion">Occasion</option>
            </select>
            <select
              className="px-3 py-2.5 bg-white border-2 border-slate-300 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors cursor-pointer"
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value as Store | 'All')}
            >
              <option value="All">Tous magasins</option>
              {stores.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Parts List */}
        <div className="space-y-3">
          {filteredParts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-12 text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                <Wrench className="h-6 w-6 text-slate-400" />
              </div>
              <p className="font-medium text-slate-400">Aucune pièce trouvée</p>
            </div>
          ) : filteredParts.map(part => (
            <div key={part.id} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-600/25 shrink-0 mt-0.5">
                  <Wrench size={18} />
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  {/* Row 1: Name + Badges + Stock + Action */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{part.name}</h3>
                      {part.compatibleModel && (
                        <p className="text-xs text-slate-400 mt-0.5">{part.compatibleModel}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-md">{part.compatibleBrand}</span>
                        {part.series && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-md">{part.series}</span>
                        )}
                        <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-md">{part.category}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${
                          part.condition === 'Neuf' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>{part.condition}</span>
                        <span className="px-2 py-0.5 text-xs font-medium bg-violet-50 text-violet-600 rounded-md">{part.store}</span>
                      </div>
                    </div>

                    {/* Right side: Stock + Action */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-center">
                        <span className={`inline-flex items-center justify-center h-9 min-w-9 px-2.5 rounded-xl text-sm font-bold ${
                          part.quantity === 0 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {part.quantity}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">stock</p>
                      </div>
                      <div className="border-l border-slate-100 pl-3">
                        {part.store === myStore && part.quantity > 0 ? (
                          <button
                            onClick={() => handleConsume(part)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl shadow-lg shadow-amber-600/25 hover:shadow-xl transition-all"
                          >
                            <Minus size={14} /> Utiliser
                          </button>
                        ) : part.store !== myStore && part.quantity > 0 ? (
                          <button
                            onClick={() => openRequestModal(part)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl shadow-lg shadow-indigo-600/25 hover:shadow-xl transition-all"
                          >
                            <Send size={14} /> Demander
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-500 bg-red-50 border-2 border-red-200 rounded-xl">Indisponible</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Collapsible Qualities */}
                  {part.qualities && part.qualities.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <button
                        onClick={() => setExpandedCards(prev => {
                          const next = new Set(prev);
                          next.has(part.id) ? next.delete(part.id) : next.add(part.id);
                          return next;
                        })}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        {expandedCards.has(part.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {part.qualities.length} qualité{part.qualities.length > 1 ? 's' : ''}
                        {(() => {
                          const prices = part.qualities.map(q => q.price ?? part.price);
                          const min = Math.min(...prices); const max = Math.max(...prices);
                          return min === max ? ` · ${min.toFixed(2)}€` : ` · ${min.toFixed(2)}€–${max.toFixed(2)}€`;
                        })()}
                      </button>
                      {expandedCards.has(part.id) && (
                        <div className="mt-3 space-y-3">
                          {part.qualities.map(q => (
                            <div key={q.quality} className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                              <div className="flex items-center gap-3">
                                <span className={`text-sm font-semibold ${q.qty === 0 ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{q.quality}</span>
                                <span className={`text-xs ${q.qty === 0 ? 'text-red-400' : 'text-slate-400'}`}>×{q.qty}</span>
                                {q.price !== undefined && (
                                  <span className="text-xs font-medium text-emerald-600">{q.price.toFixed(2)}€</span>
                                )}
                              </div>
                              {q.reference && (
                                <div className={`mt-2 flex items-center gap-3 border rounded-md px-3 py-2 ${searchTerm && q.reference.toLowerCase().includes(searchTerm.toLowerCase()) ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200' : 'bg-white border-slate-100'}`}>
                                  <Barcode size={14} className="text-slate-400 shrink-0" />
                                  <code className={`text-xs font-mono font-semibold ${searchTerm && q.reference.toLowerCase().includes(searchTerm.toLowerCase()) ? 'text-amber-700' : 'text-slate-600'}`}>{q.reference}</code>
                                  <ReactBarcode value={q.reference} format="CODE128" width={1.2} height={30} fontSize={0} margin={0} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {(!part.qualities || part.qualities.length === 0) && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <span className="text-sm font-bold text-slate-700">{part.price.toFixed(2)}€</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Transfer Request Modal */}
        {requestingPart && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Demander un transfert</h3>
                  <p className="text-sm text-slate-500 mt-1">Envoyer une demande à un employé du magasin</p>
                </div>
                <button onClick={closeRequestModal} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="px-6 pt-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-600/25 shrink-0">
                      <Wrench size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{requestingPart.name}</p>
                      <p className="text-xs text-slate-500">{requestingPart.category} · {requestingPart.compatibleBrand}{requestingPart.series ? ` · ${requestingPart.series}` : ''} · {requestingPart.compatibleModel}</p>
                      <p className="text-xs text-slate-400">{requestingPart.store} · {requestingPart.condition} · Stock: {requestingPart.quantity}</p>
                    </div>
                  </div>
                </div>

                {sent ? (
                  <div className="p-6 text-center space-y-3">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                    <p className="text-sm font-semibold text-slate-700">Demande envoyée avec succès !</p>
                    <button
                      onClick={closeRequestModal}
                      className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-600/25 transition-all font-bold"
                    >
                      Fermer
                    </button>
                  </div>
                ) : (
                  <div className="p-6 space-y-4">
                    {/* Quality selection with references & barcodes */}
                    {requestQualities.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Qualités & Quantités
                          <span className="text-xs text-slate-400 ml-2">
                            (Total: {requestQualities.reduce((s, q) => s + q.qty, 0)})
                          </span>
                        </label>
                        <div className="space-y-2">
                          {requestQualities.map((rq, idx) => (
                            <div key={rq.quality} className="p-3 border-2 border-slate-200 rounded-xl space-y-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-sm font-medium text-slate-800">{rq.quality}</span>
                                  {rq.price != null && rq.price > 0 && (
                                    <span className="text-xs text-slate-500 ml-2">{rq.price}€</span>
                                  )}
                                  <span className="text-xs text-slate-400 ml-2">Dispo: {rq.maxQty}</span>
                                </div>
                                <input
                                  type="number"
                                  min={0}
                                  max={rq.maxQty}
                                  className="w-20 px-2 py-1 text-sm bg-white border-2 border-slate-300 rounded-xl text-center focus:outline-none focus:border-indigo-500 transition-colors"
                                  value={rq.qty}
                                  onChange={(e) => {
                                    const val = Math.max(0, Math.min(rq.maxQty, Number(e.target.value)));
                                    setRequestQualities(prev => prev.map((q, i) => i === idx ? { ...q, qty: val } : q));
                                  }}
                                />
                              </div>
                              {rq.reference && (
                                <div className="flex items-center gap-2">
                                  <Barcode size={14} className="text-slate-400 shrink-0" />
                                  <span className="text-xs font-mono text-slate-600">{rq.reference}</span>
                                </div>
                              )}
                              {rq.reference && (
                                <div className="flex justify-center bg-white rounded p-1">
                                  <ReactBarcode
                                    value={rq.reference}
                                    format="CODE128"
                                    width={1.2}
                                    height={35}
                                    fontSize={10}
                                    margin={2}
                                    displayValue={false}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fallback simple qty if no qualities */}
                    {requestQualities.length === 0 && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quantité</label>
                        <input
                          type="number"
                          min="1"
                          max={requestingPart.quantity}
                          className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors"
                          value={requestQualities.length === 0 ? 1 : 0}
                          readOnly
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Envoyer à</label>
                      {onlineEmployeesInStore.length === 0 ? (
                        <p className="text-sm text-red-500">Aucun employé en ligne dans ce magasin.</p>
                      ) : (
                        <div className="space-y-2">
                          {onlineEmployeesInStore.map(emp => (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => setSelectedReceiverId(emp.id)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                                selectedReceiverId === emp.id
                                  ? 'border-indigo-500 bg-indigo-50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                                {emp.fullName.charAt(0)}
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-medium text-slate-900">{emp.fullName}</p>
                                <p className="text-xs text-emerald-600">● En ligne</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={closeRequestModal}
                        className="flex-1 px-4 py-2.5 bg-white border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-bold"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleSendRequest}
                        disabled={!selectedReceiverId || sending || requestQualities.reduce((s, q) => s + q.qty, 0) === 0}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/25 hover:shadow-xl transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                      >
                        <Send size={16} /> {sending ? 'Envoi...' : 'Envoyer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quality Selection Modal */}
        {consumeSelectPart && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
              <div className="p-6 border-b border-slate-100 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Choisir la qualité</h3>
                  <p className="text-sm text-slate-500">
                    {consumeSelectPart.name} · {consumeSelectPart.compatibleBrand}
                    {consumeSelectPart.compatibleModel ? ` · ${consumeSelectPart.compatibleModel}` : ''}
                  </p>
                </div>
                <button onClick={() => setConsumeSelectPart(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-2">
                {consumeSelectPart.qualities!.filter(q => q.qty > 0).map(q => (
                  <button
                    key={q.quality}
                    onClick={() => handleConsumeQuality(q)}
                    className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl hover:bg-amber-50 hover:border-amber-300 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900 group-hover:text-amber-900">{q.quality}</span>
                        {q.price !== undefined && (
                          <span className="text-sm text-slate-500 group-hover:text-amber-600">{q.price.toFixed(2)}€</span>
                        )}
                      </div>
                      {q.reference && (
                        <code className="text-[10px] font-mono text-slate-400 group-hover:text-amber-500">Réf: {q.reference}</code>
                      )}
                    </div>
                    <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full group-hover:bg-amber-200 group-hover:text-amber-800 font-medium shrink-0">
                      ×{q.qty}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Consume Reminder Modal */}
        {consumedPart && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
              <div className="p-6 border-b border-slate-100 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-600/25 shrink-0">
                    <Wrench size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Pièce utilisée</h3>
                    <p className="text-sm text-slate-500">
                      {consumedPart.name} — {consumedPart.compatibleBrand}
                      {consumedPart.compatibleModel ? ` · ${consumedPart.compatibleModel}` : ''}
                      {consumedPart.series ? ` · ${consumedPart.series}` : ''}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setConsumedPart(null); setConsumedQuality(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {consumedQuality?.reference && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck size={16} className="text-emerald-600" />
                        <p className="text-sm font-semibold text-emerald-800">Référence copiée dans le presse-papier</p>
                      </div>
                    </div>
                    <code className="block mt-2 text-sm font-mono bg-white px-3 py-1.5 rounded border border-emerald-200 text-emerald-900">{consumedQuality.reference}</code>
                  </div>
                )}

                {consumedQuality && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-sm font-semibold text-slate-800">Qualité consommée :</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm text-slate-700">{consumedQuality.quality}</span>
                      <div className="flex items-center gap-3">
                        {consumedQuality.price !== undefined && (
                          <span className="text-sm font-medium text-slate-600">{consumedQuality.price.toFixed(2)}€</span>
                        )}
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                          Reste : {consumedQuality.qty - 1}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                    ⚠️ N'oubliez pas de recommander {consumedQuality ? `la qualité « ${consumedQuality.quality} »` : 'cette pièce'} pour éviter la rupture de stock !
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Stock total restant : <span className="font-bold">{consumedPart.quantity - 1}</span> unité{consumedPart.quantity - 1 !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700">Fournisseurs grossistes :</p>
                  <div className="space-y-2">
                    <a
                      href="https://www.utopya.fr/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between w-full px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 transition-colors group"
                    >
                      <span className="text-sm font-medium text-blue-800">Utopya</span>
                      <ExternalLink size={16} className="text-blue-500 group-hover:text-blue-700" />
                    </a>
                    <a
                      href="https://www.mobilax.fr/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between w-full px-4 py-3 bg-emerald-50 border-2 border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors group"
                    >
                      <span className="text-sm font-medium text-emerald-800">Mobilax</span>
                      <ExternalLink size={16} className="text-emerald-500 group-hover:text-emerald-700" />
                    </a>
                    <a
                      href="https://www.jensmobiles.fr/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between w-full px-4 py-3 bg-violet-50 border-2 border-violet-200 rounded-xl hover:bg-violet-100 transition-colors group"
                    >
                      <span className="text-sm font-medium text-violet-800">Jens Mobiles</span>
                      <ExternalLink size={16} className="text-violet-500 group-hover:text-violet-700" />
                    </a>
                  </div>
                </div>

                <button
                  onClick={() => { setConsumedPart(null); setConsumedQuality(null); }}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/25 hover:shadow-xl transition-all font-bold"
                >
                  Compris
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
};
