import React, { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { AdminLayout } from '../components/Layouts';
import { useStore } from '../store';
import { Plus, Search, Edit2, Trash2, Wrench, X, Copy, ChevronRight, ChevronDown, RotateCcw, Barcode, Layers, DollarSign, Hash, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { SparePart, SparePartQuality, PhoneCondition, Store, SPARE_PART_CATEGORIES, SPARE_PART_QUALITIES } from '../types';
import ReactBarcode from 'react-barcode';

export const AdminSparePartsPage = () => {
  const { spareParts, stores, brands, brandSeries, addSparePart, updateSparePart, deleteSparePart, addBrand, addBrandSeries, deleteBrandSeriesItem, currentUser } = useStore();

  // Strict permission check: employees must have canAccessSpareParts permission
  if (currentUser && currentUser.role !== 'Administrateur' && !currentUser.permissions?.canAccessSpareParts) {
    return <Navigate to="/employee/dashboard" replace />;
  }

  const isEmployee = currentUser?.role !== 'Administrateur';
  const allowedStores = isEmployee
    ? stores.filter(s => currentUser?.stores.includes(s.name))
    : stores;

  const [searchTerm, setSearchTerm] = useState('');
  const [conditionFilter, setConditionFilter] = useState<PhoneCondition | 'All'>('All');
  const [storeFilter, setStoreFilter] = useState<Store | 'All'>('All');

  const [filterBrand, setFilterBrand] = useState('');
  const [filterSeries, setFilterSeries] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<Record<string, string>>({});
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const [formQualities, setFormQualities] = useState<SparePartQuality[]>([]);
  const [customQuality, setCustomQuality] = useState('');

  const [useCustomBrand, setUseCustomBrand] = useState(false);
  const [customBrandName, setCustomBrandName] = useState('');

  const [useCustomSeries, setUseCustomSeries] = useState(false);

  const [dupPart, setDupPart] = useState<SparePart | null>(null);
  const [dupQty, setDupQty] = useState(1);
  const [dupStore, setDupStore] = useState('');
  const [dupPrice, setDupPrice] = useState(0);
  const [dupQualities, setDupQualities] = useState<SparePartQuality[]>([]);
  const [dupCustomQuality, setDupCustomQuality] = useState('');

  const [formData, setFormData] = useState<Partial<SparePart>>({
    name: '',
    category: SPARE_PART_CATEGORIES[0],
    compatibleBrand: brands[0]?.name || '',
    series: '',
    compatibleModel: '',
    deviceType: '',
    price: 0,
    quantity: 0,
    condition: 'Neuf',
    store: allowedStores[0]?.name || '',
  });

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

  const formSeriesOptions = useMemo(() => {
    const brand = useCustomBrand ? customBrandName.toUpperCase() : (formData.compatibleBrand || '');
    if (!brand) return [];
    return brandSeries.filter(bs => bs.brandName === brand).map(bs => bs.seriesName).sort();
  }, [brandSeries, formData.compatibleBrand, useCustomBrand, customBrandName]);

  const filteredParts = spareParts.filter(part => {
    // Employees can only see parts in their assigned stores
    if (isEmployee && !currentUser?.stores.includes(part.store)) return false;
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

  const qualityTotal = formQualities.reduce((s, q) => s + q.qty, 0);

  // Auto-sync quantity to match quality total
  React.useEffect(() => {
    if (formQualities.length > 0 && qualityTotal !== formData.quantity) {
      setFormData(prev => ({ ...prev, quantity: qualityTotal }));
    }
  }, [qualityTotal, formQualities.length]);

  const addQualityFn = (name: string) => {
    if (formQualities.some(q => q.quality === name)) return;
    setFormQualities([...formQualities, { quality: name, qty: 1 }]);
  };

  const removeQuality = (name: string) => {
    setFormQualities(formQualities.filter(q => q.quality !== name));
  };

  const updateQualityQty = (name: string, qty: number) => {
    const clamped = Math.max(1, qty);
    setFormQualities(formQualities.map(q => q.quality === name ? { ...q, qty: clamped } : q));
  };

  const updateQualityPrice = (name: string, price: number) => {
    setFormQualities(formQualities.map(q => q.quality === name ? { ...q, price: Math.max(0, price) } : q));
  };

  const updateQualityRef = (name: string, reference: string) => {
    setFormQualities(formQualities.map(q => q.quality === name ? { ...q, reference: reference || undefined } : q));
  };

  const handleOpenModal = (part?: SparePart) => {
    if (part) {
      setEditingPart(part);
      setFormData(part);
      setFormQualities(part.qualities || []);
      const brandExists = brands.some(b => b.name === part.compatibleBrand);
      if (!brandExists && part.compatibleBrand) {
        setUseCustomBrand(true);
        setCustomBrandName(part.compatibleBrand);
      } else {
        setUseCustomBrand(false);
        setCustomBrandName('');
      }
      // Check if series is in DB list
      const brand = part.compatibleBrand || '';
      const dbSeriesNames = brandSeries.filter(bs => bs.brandName === brand).map(bs => bs.seriesName);
      setUseCustomSeries(part.series ? !dbSeriesNames.includes(part.series) : false);
    } else {
      setEditingPart(null);
      setFormData({
        name: '',
        category: SPARE_PART_CATEGORIES[0],
        compatibleBrand: brands[0]?.name || '',
        series: '',
        compatibleModel: '',
        deviceType: '',
        price: 0,
        quantity: 0,
        condition: 'Neuf',
        store: stores[0]?.name || '',
      });
      setFormQualities([]);
      setUseCustomBrand(false);
      setCustomBrandName('');
      setUseCustomSeries(false);
    }
    setCustomQuality('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formQualities.length > 0 && qualityTotal !== (formData.quantity || 0)) return;
    const finalBrand = useCustomBrand ? customBrandName.trim().toUpperCase() : (formData.compatibleBrand || '');
    const finalSeries = formData.series || '';

    if (useCustomBrand && customBrandName.trim()) {
      const exists = brands.some(b => b.name.toUpperCase() === customBrandName.trim().toUpperCase());
      if (!exists) {
        addBrand(customBrandName.trim().toUpperCase());
      }
    }

    // Save custom series to DB if not already there
    if (useCustomSeries && finalSeries.trim()) {
      const seriesExists = brandSeries.some(bs => bs.brandName === finalBrand && bs.seriesName === finalSeries.trim());
      if (!seriesExists) {
        addBrandSeries(finalBrand, finalSeries.trim());
      }
    }

    const payload = {
      ...formData,
      compatibleBrand: finalBrand,
      series: finalSeries,
      qualities: formQualities.length > 0 ? formQualities : undefined,
    };

    if (editingPart) {
      updateSparePart(editingPart.id, payload);
    } else {
      addSparePart(payload as Omit<SparePart, 'id'>);
    }
    setIsModalOpen(false);
    setEditingPart(null);
  };

  const handleDelete = (id: string) => {
    deleteSparePart(id);
    setShowDeleteConfirm(null);
  };

  const dupQualityTotal = dupQualities.reduce((s, q) => s + q.qty, 0);

  // Auto-sync dup quantity to match dup quality total
  React.useEffect(() => {
    if (dupQualities.length > 0 && dupQualityTotal !== dupQty) {
      setDupQty(dupQualityTotal);
    }
  }, [dupQualityTotal, dupQualities.length]);

  const openDupModal = (part: SparePart) => {
    setDupPart(part);
    const copiedQualities = part.qualities ? part.qualities.map(q => ({ ...q })) : [];
    const totalQty = copiedQualities.reduce((s, q) => s + q.qty, 0);
    setDupQty(totalQty > 0 ? totalQty : part.quantity);
    setDupPrice(part.price);
    setDupQualities(copiedQualities);
    setDupCustomQuality('');
    const otherStore = stores.find(s => s.name !== part.store);
    setDupStore(otherStore?.name || stores[0]?.name || '');
  };

  const handleDupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dupPart) return;
    if (dupQualities.length > 0 && dupQualityTotal !== dupQty) return;
    addSparePart({
      name: dupPart.name,
      category: dupPart.category,
      compatibleBrand: dupPart.compatibleBrand,
      deviceType: dupPart.deviceType || '',
      series: dupPart.series || '',
      compatibleModel: dupPart.compatibleModel,
      price: dupPrice,
      quantity: dupQty,
      condition: dupPart.condition,
      store: dupStore,
      qualities: dupQualities.length > 0 ? dupQualities : undefined,
    });
    setDupPart(null);
  };

  const totalParts = spareParts.reduce((sum, p) => sum + p.quantity, 0);
  const totalValue = spareParts.reduce((sum, p) => {
    if (p.qualities && p.qualities.length > 0) {
      return sum + p.qualities.reduce((qs, q) => qs + (q.price ?? p.price) * q.qty, 0);
    }
    return sum + p.price * p.quantity;
  }, 0);
  const categoryCounts: Record<string, number> = {};
  spareParts.forEach(p => {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + p.quantity;
  });

  const resetFilters = () => {
    setFilterBrand('');
    setFilterSeries('');
    setFilterCategory('');
  };

  return (
    <AdminLayout title="Pièces Détachées">
      <div className="space-y-6">

        {/* ═══ Stats Row ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 p-5 text-white shadow-lg shadow-amber-400/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit"><Wrench size={16} /></div>
              <p className="text-3xl font-black mt-3 tabular-nums">{totalParts}</p>
              <p className="text-amber-100 text-xs font-medium mt-1">Total pièces</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white shadow-lg shadow-blue-600/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit"><Hash size={16} /></div>
              <p className="text-3xl font-black mt-3 tabular-nums">{spareParts.length}</p>
              <p className="text-blue-100 text-xs font-medium mt-1">Références</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg shadow-emerald-500/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit"><DollarSign size={16} /></div>
              <p className="text-3xl font-black mt-3 tabular-nums">{totalValue.toFixed(2)}€</p>
              <p className="text-emerald-100 text-xs font-medium mt-1">Valeur totale</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 p-5 text-white shadow-lg shadow-violet-500/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit"><Layers size={16} /></div>
              <p className="text-3xl font-black mt-3 tabular-nums">{Object.keys(categoryCounts).length}</p>
              <p className="text-violet-100 text-xs font-medium mt-1">Catégories</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
          </div>
        </div>

        {/* ═══ Hierarchical Navigation ═══ */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Navigation hiérarchique</p>
            {(filterBrand || filterSeries || filterCategory) && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-500 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <RotateCcw size={12} /> Réinitialiser
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={cn(
                'px-3 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 transition-all',
                filterBrand ? 'bg-blue-50 border-blue-300 text-blue-800 focus:ring-blue-200' : 'bg-white border-slate-200/80 text-slate-700 focus:ring-indigo-100 focus:border-indigo-400'
              )}
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
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
                <select
                  className={cn(
                    'px-3 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 transition-all',
                    filterSeries ? 'bg-indigo-50 border-indigo-300 text-indigo-800 focus:ring-indigo-200' : 'bg-white border-slate-200/80 text-slate-700 focus:ring-indigo-100 focus:border-indigo-400'
                  )}
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
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
                <select
                  className={cn(
                    'px-3 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 transition-all',
                    filterCategory ? 'bg-violet-50 border-violet-300 text-violet-800 focus:ring-violet-200' : 'bg-white border-slate-200/80 text-slate-700 focus:ring-indigo-100 focus:border-indigo-400'
                  )}
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
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 ring-1 ring-blue-200/80 rounded-full font-semibold">{filterBrand}</span>
              )}
              {filterSeries && (
                <>
                  <ChevronRight size={12} className="text-slate-300" />
                  <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/80 rounded-full font-semibold">{filterSeries}</span>
                </>
              )}
              {filterCategory && (
                <>
                  <ChevronRight size={12} className="text-slate-300" />
                  <span className="px-2.5 py-0.5 bg-violet-50 text-violet-700 ring-1 ring-violet-200/80 rounded-full font-semibold">{filterCategory}</span>
                </>
              )}
              <span className="text-slate-400 ml-1">({filteredParts.length} résultat{filteredParts.length !== 1 ? 's' : ''})</span>
            </div>
          )}
        </div>

        {/* ═══ Search & Filters + Add Button ═══ */}
        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Rechercher par nom, marque, série..."
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value as PhoneCondition | 'All')}
            >
              <option value="All">Tous états</option>
              <option value="Neuf">Neuf</option>
              <option value="Occasion">Occasion</option>
            </select>
            <select
              className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value as Store | 'All')}
            >
              <option value="All">Tous magasins</option>
              {allowedStores.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all whitespace-nowrap"
          >
            <Plus size={16} /> Ajouter une pièce
          </button>
        </div>

        {/* ═══ Parts List ═══ */}
        <div className="space-y-3">
          {filteredParts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-16 text-center">
              <Wrench className="mx-auto mb-3 h-10 w-10 text-slate-200" />
              <p className="font-medium text-slate-400 text-sm">Aucune pièce trouvée</p>
            </div>
          ) : filteredParts.map(part => (
            <div key={part.id} className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                  <Wrench size={18} />
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  {/* Row 1: Name + Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{part.name}</h3>
                      {part.compatibleModel && (
                        <p className="text-xs text-slate-400 mt-0.5">{part.compatibleModel}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-200/80 rounded-full">{part.compatibleBrand}</span>
                        {part.series && (
                          <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/80 rounded-full">{part.series}</span>
                        )}
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-50 text-slate-600 ring-1 ring-slate-200/80 rounded-full">{part.category}</span>
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full ring-1',
                          part.condition === 'Neuf' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/80' : 'bg-amber-50 text-amber-700 ring-amber-200/80'
                        )}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', part.condition === 'Neuf' ? 'bg-emerald-500' : 'bg-amber-500')} />
                          {part.condition}
                        </span>
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/80 rounded-full">{part.store}</span>
                      </div>
                    </div>

                    {/* Right side: Stock + Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-center">
                        <span className={cn(
                          'inline-flex items-center justify-center h-9 min-w-9 px-2.5 rounded-xl text-sm font-bold tabular-nums',
                          part.quantity === 0 ? 'bg-red-50 text-red-600 ring-1 ring-red-200/80' : 'bg-slate-100 text-slate-800'
                        )}>
                          {part.quantity}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">stock</p>
                      </div>
                      <div className="flex items-center gap-0.5 border-l border-slate-100 pl-3">
                        <button onClick={() => openDupModal(part)} className="p-2 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Dupliquer">
                          <Copy size={15} />
                        </button>
                        <button onClick={() => handleOpenModal(part)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Modifier">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => setShowDeleteConfirm(part.id)} className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Collapsible Qualities */}
                  {part.qualities && part.qualities.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => setExpandedCards(prev => {
                          const next = new Set(prev);
                          next.has(part.id) ? next.delete(part.id) : next.add(part.id);
                          return next;
                        })}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
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
                            <div key={q.quality} className="bg-slate-50/80 border border-slate-100 rounded-xl p-3">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-800">{q.quality}</span>
                                <span className="text-xs text-slate-400 font-medium">×{q.qty}</span>
                                {q.price !== undefined && (
                                  <span className="text-xs font-bold text-emerald-600 tabular-nums">{q.price.toFixed(2)}€</span>
                                )}
                              </div>
                              {q.reference && (
                                <div className={cn(
                                  'mt-2 flex items-center gap-3 border rounded-xl px-3 py-2',
                                  searchTerm && q.reference.toLowerCase().includes(searchTerm.toLowerCase()) ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200' : 'bg-white border-slate-100'
                                )}>
                                  <Barcode size={14} className="text-slate-400 shrink-0" />
                                  <code className={cn(
                                    'text-xs font-mono font-semibold',
                                    searchTerm && q.reference.toLowerCase().includes(searchTerm.toLowerCase()) ? 'text-amber-700' : 'text-slate-600'
                                  )}>{q.reference}</code>
                                  <ReactBarcode value={q.reference} format="CODE128" width={1.2} height={30} fontSize={0} margin={0} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Fallback: no qualities, just price */}
                  {(!part.qualities || part.qualities.length === 0) && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <span className="text-sm font-black text-slate-900 tabular-nums">{part.price.toFixed(2)}€</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
                  <Trash2 size={24} className="text-red-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Confirmer la suppression</h3>
                  <p className="text-sm text-slate-400 mt-2">Êtes-vous sûr de vouloir supprimer cette pièce ?</p>
                </div>
              </div>
              <div className="px-6 pb-6 flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2.5 bg-white border border-slate-200/80 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-semibold text-sm">Annuler</button>
                <button onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all">Supprimer</button>
              </div>
            </div>
          </div>
        )}

        {/* Add / Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  {editingPart ? 'Modifier la pièce' : 'Ajouter une pièce'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {/* ─── SECTION 1: Hiérarchie ─── */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">1</span>
                    Marque
                  </label>
                  {useCustomBrand ? (
                    <div className="flex gap-2">
                      <input
                        required
                        type="text"
                        className="flex-1 px-3 py-2.5 bg-white border border-blue-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 uppercase transition-all"
                        value={customBrandName}
                        onChange={(e) => setCustomBrandName(e.target.value)}
                        placeholder="Nom de la nouvelle marque..."
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setUseCustomBrand(false);
                          setCustomBrandName('');
                          setFormData({ ...formData, compatibleBrand: brands[0]?.name || '' });
                        }}
                        className="px-3 py-2.5 text-sm text-slate-600 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <select
                      className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                      value={formData.compatibleBrand || ''}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setUseCustomBrand(true);
                          setCustomBrandName('');
                          setUseCustomSeries(false);
                        } else {
                          setFormData({ ...formData, compatibleBrand: e.target.value, series: '' });
                          setUseCustomSeries(false);
                        }
                      }}
                    >
                      <option value="">-- Sélectionner une marque --</option>
                      {brands.map(b => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))}
                      <option value="__custom__">✏️ Créer une marque...</option>
                    </select>
                  )}
                </div>

                {/* 2. Serie */}
                <div className="space-y-1.5 pl-4 border-l-2 border-indigo-200">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">2</span>
                    Série
                  </label>
                  {useCustomSeries ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2.5 bg-white border border-indigo-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                        value={formData.series || ''}
                        onChange={(e) => setFormData({ ...formData, series: e.target.value })}
                        placeholder="Nom de la série personnalisée..."
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setUseCustomSeries(false);
                          setFormData({ ...formData, series: '' });
                        }}
                        className="px-3 py-2.5 text-sm text-slate-600 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <select
                      className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                      value={formData.series || ''}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setUseCustomSeries(true);
                          setFormData({ ...formData, series: '' });
                        } else {
                          setFormData({ ...formData, series: e.target.value });
                        }
                      }}
                    >
                      <option value="">-- Sélectionner une série --</option>
                      {formSeriesOptions.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="__custom__">✏️ Série personnalisée...</option>
                    </select>
                  )}
                </div>

                {/* 3. Categorie */}
                <div className="space-y-1.5 pl-8 border-l-2 border-violet-200">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold">3</span>
                    Catégorie
                  </label>
                  <select
                    className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                    value={formData.category || SPARE_PART_CATEGORIES[0]}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {SPARE_PART_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <hr className="border-slate-100" />

                {/* ─── SECTION 2: Détails de la pièce ─── */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nom de la pièce</label>
                  <input
                    required
                    type="text"
                    className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Écran LCD iPhone 13"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modèle exact <span className="text-slate-300 font-normal">(optionnel)</span></label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                    value={formData.compatibleModel || ''}
                    onChange={(e) => setFormData({ ...formData, compatibleModel: e.target.value })}
                    placeholder="Ex: SM-G991B"
                  />
                </div>

                <hr className="border-slate-100" />

                {/* ─── SECTION 3: Stock & Logistique ─── */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">État</label>
                    <select
                      className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                      value={formData.condition || 'Neuf'}
                      onChange={(e) => setFormData({ ...formData, condition: e.target.value as PhoneCondition })}
                    >
                      <option value="Neuf">Neuf</option>
                      <option value="Occasion">Occasion</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Magasin</label>
                    <select
                      className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                      value={formData.store || ''}
                      onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                    >
                      {allowedStores.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantité {formQualities.length > 0 && <span className="text-[10px] text-blue-500 font-normal normal-case">(auto)</span>}</label>
                    <input
                      required
                      type="number"
                      min="0"
                      className={cn('w-full px-3 py-2.5 border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all', formQualities.length > 0 ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white')}
                      value={formData.quantity || 0}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      readOnly={formQualities.length > 0}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prix (€)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                      value={formData.price || 0}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* ─── SECTION 4: Qualités ─── */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Qualités ({qualityTotal})</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SPARE_PART_QUALITIES.filter(q => !formQualities.some(fq => fq.quality === q)).map(q => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => addQualityFn(q)}
                        className="px-2.5 py-1 text-xs font-semibold bg-slate-50 text-slate-600 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        + {q}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                      value={customQuality}
                      onChange={(e) => setCustomQuality(e.target.value)}
                      placeholder="Qualité personnalisée..."
                    />
                    <button
                      type="button"
                      onClick={() => { if (customQuality.trim()) { addQualityFn(customQuality.trim()); setCustomQuality(''); } }}
                      className="px-4 py-2 text-sm bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold shadow-sm hover:shadow-indigo-600/25 transition-all"
                    >
                      Ajouter
                    </button>
                  </div>
                  {formQualities.length > 0 && (
                    <div className="space-y-1.5 mt-1">
                      {formQualities.map(q => (
                        <div key={q.quality} className="bg-blue-50/60 rounded-xl px-3 py-2.5 space-y-2 border border-blue-100/80">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-blue-700 w-24 shrink-0">{q.quality}</span>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => updateQualityQty(q.quality, q.qty - 1)} className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 text-sm font-bold">−</button>
                              <span className="w-6 text-center text-sm font-bold text-blue-800">{q.qty}</span>
                              <button type="button" onClick={() => updateQualityQty(q.quality, q.qty + 1)} className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 text-sm font-bold">+</button>
                            </div>
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Prix €"
                                className="w-full px-2 py-1 text-xs bg-white border border-blue-200/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300 text-slate-900"
                                value={q.price ?? ''}
                                onChange={(e) => updateQualityPrice(q.quality, Number(e.target.value))}
                              />
                              <span className="text-xs text-blue-600 shrink-0">€</span>
                            </div>
                            <button type="button" onClick={() => removeQuality(q.quality)} className="text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Barcode size={14} className="text-blue-400 shrink-0" />
                            <input
                              type="text"
                              placeholder="Réf. fournisseur..."
                              className="flex-1 px-2 py-1 text-xs font-mono bg-white border border-blue-200/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300 text-slate-900"
                              value={q.reference || ''}
                              onChange={(e) => updateQualityRef(q.quality, e.target.value)}
                            />
                            {q.reference && (
                              <div className="shrink-0">
                                <ReactBarcode value={q.reference} format="CODE128" width={1} height={24} fontSize={0} margin={0} />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200/80 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-semibold text-sm"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all"
                  >
                    {editingPart ? 'Enregistrer' : 'Ajouter'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Duplicate / Quick-Add Modal */}
        {dupPart && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Ajouter au stock</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Même pièce, nouveau magasin</p>
                </div>
                <button onClick={() => setDupPart(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={18} /></button>
              </div>

              <div className="px-5 pt-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white shrink-0">
                    <Wrench size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{dupPart.name}</p>
                    <p className="text-xs text-slate-400">{dupPart.category} · {dupPart.compatibleBrand}{dupPart.series ? ` · ${dupPart.series}` : ''} · {dupPart.price}€</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleDupSubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantité {dupQualities.length > 0 && <span className="text-[10px] text-blue-500 font-normal normal-case">(auto)</span>}</label>
                    <input
                      required
                      type="number"
                      min="1"
                      className={cn('w-full px-3 py-2.5 border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all', dupQualities.length > 0 ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white')}
                      value={dupQty}
                      onChange={(e) => setDupQty(Math.max(1, Number(e.target.value)))}
                      readOnly={dupQualities.length > 0}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Magasin</label>
                    <select
                      className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                      value={dupStore}
                      onChange={(e) => setDupStore(e.target.value)}
                    >
                      {allowedStores.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Qualités ({dupQualityTotal})</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SPARE_PART_QUALITIES.filter(q => !dupQualities.some(dq => dq.quality === q)).map(q => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          if (dupQualityTotal < dupQty) setDupQualities([...dupQualities, { quality: q, qty: 1 }]);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-slate-50 text-slate-600 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        + {q}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                      value={dupCustomQuality}
                      onChange={(e) => setDupCustomQuality(e.target.value)}
                      placeholder="Qualité personnalisée..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const name = dupCustomQuality.trim();
                        if (name && !dupQualities.some(dq => dq.quality === name) && dupQualityTotal < dupQty) {
                          setDupQualities([...dupQualities, { quality: name, qty: 1 }]);
                          setDupCustomQuality('');
                        }
                      }}
                      className="px-4 py-2 text-sm bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold shadow-sm hover:shadow-indigo-600/25 transition-all"
                    >
                      Ajouter
                    </button>
                  </div>
                  {dupQualities.length > 0 && (
                    <div className="space-y-1.5">
                      {dupQualities.map(q => (
                        <div key={q.quality} className="bg-blue-50/60 rounded-xl px-3 py-2.5 space-y-2 border border-blue-100/80">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-blue-700 w-24 shrink-0">{q.quality}</span>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => setDupQualities(dupQualities.map(dq => dq.quality === q.quality ? { ...dq, qty: Math.max(0, dq.qty - 1) } : dq))} className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 text-sm font-bold">−</button>
                              <span className="w-6 text-center text-sm font-bold text-blue-800">{q.qty}</span>
                              <button type="button" onClick={() => { const othersTotal = dupQualities.reduce((s, dq) => s + (dq.quality === q.quality ? 0 : dq.qty), 0); if (q.qty < dupQty - othersTotal) setDupQualities(dupQualities.map(dq => dq.quality === q.quality ? { ...dq, qty: dq.qty + 1 } : dq)); }} className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 text-sm font-bold">+</button>
                            </div>
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Prix €"
                                className="w-full px-2 py-1 text-xs bg-white border border-blue-200/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300 text-slate-900"
                                value={q.price ?? ''}
                                onChange={(e) => setDupQualities(dupQualities.map(dq => dq.quality === q.quality ? { ...dq, price: Math.max(0, Number(e.target.value)) } : dq))}
                              />
                              <span className="text-xs text-blue-600 shrink-0">€</span>
                            </div>
                            <button type="button" onClick={() => setDupQualities(dupQualities.filter(dq => dq.quality !== q.quality))} className="text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Barcode size={14} className="text-blue-400 shrink-0" />
                            <input
                              type="text"
                              placeholder="Réf. fournisseur..."
                              className="flex-1 px-2 py-1 text-xs font-mono bg-white border border-blue-200/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300 text-slate-900"
                              value={q.reference || ''}
                              onChange={(e) => setDupQualities(dupQualities.map(dq => dq.quality === q.quality ? { ...dq, reference: e.target.value || undefined } : dq))}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setDupPart(null)}
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200/80 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-semibold text-sm"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all"
                  >
                    Ajouter au stock
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
