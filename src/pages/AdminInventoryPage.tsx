import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AdminLayout } from '../components/Layouts';
import { useStore } from '../store';
import { Plus, Search, Edit2, Trash2, Package, Settings2, X, Copy, Eye, Smartphone, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { Phone, PhoneCondition, PhoneColor, Store, PHONE_COLORS } from '../types';
import ReactBarcode from 'react-barcode';

export const AdminInventoryPage = () => {
  const { inventory, stores, brands, addPhone, updatePhone, deletePhone, addBrand, deleteBrand, currentUser } = useStore();

  // Strict permission check: employees must have canAccessInventory permission
  if (currentUser && currentUser.role !== 'Administrateur' && !currentUser.permissions?.canAccessInventory) {
    return <Navigate to="/employee/dashboard" replace />;
  }

  const isEmployee = currentUser?.role !== 'Administrateur';
  const allowedStores = isEmployee
    ? stores.filter(s => currentUser?.stores.includes(s.name))
    : stores;

  const getDefaultStore = () => {
    if (isEmployee) {
      const preferred = currentUser?.currentStore;
      if (preferred && allowedStores.some(s => s.name === preferred)) return preferred;
      return allowedStores[0]?.name || '';
    }
    return stores[0]?.name || '';
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [conditionFilter, setConditionFilter] = useState<PhoneCondition | 'All'>('All');
  const [storeFilter, setStoreFilter] = useState<Store | 'All'>('All');
  const [activeBrandTab, setActiveBrandTab] = useState<string>('All');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  
  const [editingPhone, setEditingPhone] = useState<Phone | null>(null);
  const [formColors, setFormColors] = useState<PhoneColor[]>([]);
  const [customColor, setCustomColor] = useState('#000000');

  // Quick-add (duplicate) modal
  const [dupPhone, setDupPhone] = useState<Phone | null>(null);
  const [dupColors, setDupColors] = useState<PhoneColor[]>([]);
  const [dupQty, setDupQty] = useState(1);
  const [dupStore, setDupStore] = useState('');
  const [dupCustomColor, setDupCustomColor] = useState('#000000');

  // Custom confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const [formData, setFormData] = useState<Partial<Phone>>({
    brand: brands[0]?.name || '',
    model: '',
    ram: '',
    storage: '',
    price: 0,
    quantity: 0,
    condition: 'Neuf',
    store: getDefaultStore()
  });

  // Detail modal state
  const [detailPhone, setDetailPhone] = useState<Phone | null>(null);

  const filteredInventory = inventory.filter(phone => {
    // Employees can only see phones in their assigned stores
    if (isEmployee && !currentUser?.stores.includes(phone.store)) return false;
    const term = searchTerm.toLowerCase();
    const matchesSearch = phone.brand.toLowerCase().includes(term) || 
                          phone.model.toLowerCase().includes(term) ||
                          (phone.colors?.some(c => c.reference?.toLowerCase().includes(term)) ?? false);
    const matchesCondition = conditionFilter === 'All' || phone.condition === conditionFilter;
    const matchesStore = storeFilter === 'All' || phone.store === storeFilter;
    const matchesBrandTab = activeBrandTab === 'All' || phone.brand === activeBrandTab;
    return matchesSearch && matchesCondition && matchesStore && matchesBrandTab;
  });

  const handleOpenModal = (phone?: Phone) => {
    if (phone) {
      setEditingPhone(phone);
      setFormData(phone);
      setFormColors(phone.colors || []);
    } else {
      setEditingPhone(null);
      setFormData({
        brand: brands[0]?.name || '',
        model: '',
        ram: '',
        storage: '',
        price: 0,
        quantity: 0,
        condition: 'Neuf',
        store: getDefaultStore()
      });
      setFormColors([]);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const phoneData = { ...formData, colors: formColors.length > 0 ? formColors : undefined };

    // Enforce store constraints for employees at submit time.
    if (isEmployee) {
      const selectedStore = phoneData.store as Store | undefined;
      const isAllowed = !!selectedStore && currentUser?.stores.includes(selectedStore);
      phoneData.store = (isAllowed ? selectedStore : getDefaultStore()) as Store;
    }

    // For Occasion, set global price from first color's price or 0
    if (phoneData.condition === 'Occasion' && formColors.length > 0) {
      const colorPrices = formColors.filter(c => c.price).map(c => c.price!);
      phoneData.price = colorPrices.length > 0 ? Math.min(...colorPrices) : 0;
    }
    if (editingPhone) {
      updatePhone(editingPhone.id, phoneData);
    } else {
      addPhone(phoneData as Omit<Phone, 'id'>);
    }
    setIsModalOpen(false);
  };

  const colorTotal = formColors.reduce((s, c) => s + c.qty, 0);
  const maxQty = formData.quantity || 0;

  const addColorToForm = (color: string) => {
    if (colorTotal >= maxQty) return;
    // For Neuf, one entry per color; for Occasion, allow duplicates (each unit = separate entry)
    if (formData.condition !== 'Occasion' && formColors.some(c => c.color === color)) return;
    setFormColors([...formColors, { color, qty: 1, reference: '' }]);
  };

  const removeColorFromForm = (index: number) => {
    setFormColors(formColors.filter((_, i) => i !== index));
  };

  const updateColorQty = (index: number, qty: number) => {
    const others = formColors.filter((_, i) => i !== index).reduce((s, c) => s + c.qty, 0);
    const clamped = Math.max(0, Math.min(qty, maxQty - others));
    setFormColors(formColors.map((c, i) => i === index ? { ...c, qty: clamped } : c));
  };

  const updateColorCondition = (index: number, field: string, value: string | number) => {
    setFormColors(formColors.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  // Duplicate modal helpers
  const openDupModal = (phone: Phone) => {
    setDupPhone(phone);
    setDupColors([]);
    setDupQty(1);
    setDupStore(isEmployee ? getDefaultStore() : (stores.find(s => s.name !== phone.store)?.name || stores[0]?.name || ''));
  };

  const dupColorTotal = dupColors.reduce((s, c) => s + c.qty, 0);

  const addDupColor = (color: string) => {
    if (dupColors.some(c => c.color === color)) return;
    if (dupColorTotal >= dupQty) return;
    setDupColors([...dupColors, { color, qty: 1 }]);
  };

  const removeDupColor = (color: string) => {
    setDupColors(dupColors.filter(c => c.color !== color));
  };

  const updateDupColorQty = (color: string, qty: number) => {
    const others = dupColors.filter(c => c.color !== color).reduce((s, c) => s + c.qty, 0);
    const clamped = Math.max(0, Math.min(qty, dupQty - others));
    setDupColors(dupColors.map(c => c.color === color ? { ...c, qty: clamped } : c));
  };

  const handleDupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dupPhone) return;
    addPhone({
      brand: dupPhone.brand,
      model: dupPhone.model,
      ram: dupPhone.ram,
      storage: dupPhone.storage,
      price: dupPhone.price,
      condition: dupPhone.condition,
      quantity: dupQty,
      store: dupStore as Store,
      colors: dupColors.length > 0 ? dupColors : undefined,
    });
    setDupPhone(null);
  };

  const handleAddBrand = () => {
    if (newBrandName.trim()) {
      addBrand(newBrandName.trim());
      setNewBrandName('');
    }
  };

  const totalStock = filteredInventory.reduce((s, p) => s + p.quantity, 0);
  const neufCount = filteredInventory.filter(p => p.condition === 'Neuf').reduce((s, p) => s + p.quantity, 0);
  const occasionCount = filteredInventory.filter(p => p.condition === 'Occasion').reduce((s, p) => s + p.quantity, 0);
  const lowStockCount = filteredInventory.filter(p => p.quantity > 0 && p.quantity <= 2).length;

  return (
    <AdminLayout title="Gestion du Stock">
      <div className="space-y-6">

        {/* ═══ Stats Row ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white shadow-lg shadow-blue-600/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit"><Package size={16} /></div>
              <p className="text-3xl font-black mt-3 tabular-nums">{totalStock}</p>
              <p className="text-blue-100 text-xs font-medium mt-1">Total unités</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg shadow-emerald-500/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit"><Smartphone size={16} /></div>
              <p className="text-3xl font-black mt-3 tabular-nums">{neufCount}</p>
              <p className="text-emerald-100 text-xs font-medium mt-1">Neufs</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 p-5 text-white shadow-lg shadow-amber-400/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit"><Smartphone size={16} /></div>
              <p className="text-3xl font-black mt-3 tabular-nums">{occasionCount}</p>
              <p className="text-amber-100 text-xs font-medium mt-1">Occasion</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 p-5 text-white shadow-lg shadow-rose-500/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit"><AlertTriangle size={16} /></div>
              <p className="text-3xl font-black mt-3 tabular-nums">{lowStockCount}</p>
              <p className="text-rose-100 text-xs font-medium mt-1">Stock faible</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
          </div>
        </div>

        {/* ═══ Brand Tabs ═══ */}
        <div className="flex items-center gap-1.5 overflow-x-scroll pb-2 scrollbar-thin" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f1f5f9' }}>
          <button
            onClick={() => setActiveBrandTab('All')}
            className={cn(
              'px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all',
              activeBrandTab === 'All' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' : 'bg-white text-slate-500 border border-slate-200/80 hover:text-slate-700 hover:border-slate-300'
            )}
          >
            Toutes
          </button>
          {brands.map(brand => (
            <button
              key={brand.id}
              onClick={() => setActiveBrandTab(brand.name)}
              className={cn(
                'px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all',
                activeBrandTab === brand.name ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' : 'bg-white text-slate-500 border border-slate-200/80 hover:text-slate-700 hover:border-slate-300'
              )}
            >
              {brand.name}
            </button>
          ))}
        </div>

        {/* ═══ Filters & Actions ═══ */}
        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Rechercher un téléphone..."
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
              <option value="All">Tous les états</option>
              <option value="Neuf">Neuf</option>
              <option value="Occasion">Occasion</option>
            </select>
            <select
              className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value as Store | 'All')}
            >
              <option value="All">Tous les magasins</option>
              {allowedStores.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setIsBrandModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200/80 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all whitespace-nowrap"
            >
              <Settings2 size={16} />
              Marques
            </button>
            <button
              onClick={() => handleOpenModal()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all whitespace-nowrap"
            >
              <Plus size={16} />
              Ajouter
            </button>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Modèle</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Couleur</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">État</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Specs</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center whitespace-nowrap">Prix</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center whitespace-nowrap">Qté</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Magasin</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredInventory.map((phone) => (
                  <tr key={phone.id} className="group hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                          <Package size={16} />
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-slate-900">{phone.brand}</p>
                          <p className="text-xs text-slate-400">{phone.model}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {phone.colors && phone.colors.length > 0 ? (
                        <div className="flex items-center gap-1">
                          {phone.colors.map((c, i) => (
                            <span
                              key={i}
                              className="inline-block w-8 h-8 rounded-lg border border-slate-300 shadow-sm cursor-pointer hover:scale-125 hover:ring-2 hover:ring-indigo-300 transition-all"
                              style={{ backgroundColor: c.color }}
                              title={`${c.qty} unité(s)${c.reference ? ' · ' + c.reference : ''}`}
                              onClick={() => setDetailPhone(phone)}
                            />
                          ))}
                          <button
                            type="button"
                            onClick={() => setDetailPhone(phone)}
                            className="ml-0.5 p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Voir détails"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1',
                        phone.condition === 'Neuf'
                          ? 'text-emerald-700 bg-emerald-50 ring-emerald-200/80'
                          : 'text-amber-700 bg-amber-50 ring-amber-200/80'
                      )}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', phone.condition === 'Neuf' ? 'bg-emerald-500' : 'bg-amber-500')} />
                        {phone.condition}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap font-medium">
                      {phone.storage} · {phone.ram} RAM
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <span className="text-[13px] font-black text-slate-900 tabular-nums">
                      {phone.condition === 'Occasion' && phone.colors && phone.colors.some(c => c.price) ? (
                        (() => {
                          const prices = phone.colors.filter(c => c.price).map(c => c.price!);
                          const min = Math.min(...prices);
                          const max = Math.max(...prices);
                          return min === max ? `${min}€` : `${min}–${max}€`;
                        })()
                      ) : (
                        `${phone.price}€`
                      )}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <span className={cn(
                        'inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-lg text-xs font-bold tabular-nums',
                        phone.quantity > 5 ? 'bg-slate-100 text-slate-600' : 
                        phone.quantity > 0 ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/80' : 
                        'bg-red-50 text-red-600 ring-1 ring-red-200/80'
                      )}>
                        {phone.quantity}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 ring-1 ring-indigo-200/80 px-2 py-0.5 rounded-full">
                        {phone.store}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openDupModal(phone)}
                          className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Ajouter au stock (autre magasin)"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          onClick={() => handleOpenModal(phone)}
                          className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              message: `Êtes-vous sûr de vouloir supprimer ${phone.brand} ${phone.model} ?`,
                              onConfirm: () => { deletePhone(phone.id); setConfirmDialog(null); }
                            });
                          }}
                          className="p-1.5 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredInventory.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <Package size={32} className="mx-auto text-slate-200 mb-3" />
                      <p className="text-sm text-slate-400 font-medium">Aucun téléphone trouvé.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal for Add/Edit */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  {editingPhone ? 'Modifier le téléphone' : 'Ajouter au stock'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={18} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Marque</label>
                    <select
                      required
                      className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    >
                      <option value="" disabled>Sélectionner une marque</option>
                      {brands.map(b => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modèle</label>
                    <input
                      required
                      type="text"
                      className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mémoire RAM</label>
                    <input
                      required
                      type="text"
                      placeholder="ex: 8 Go"
                      className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                      value={formData.ram}
                      onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stockage</label>
                    <input
                      required
                      type="text"
                      placeholder="ex: 128 Go"
                      className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                      value={formData.storage}
                      onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {formData.condition !== 'Occasion' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prix (€)</label>
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      />
                    </div>
                  )}
                  {formData.condition === 'Occasion' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">💰 Prix par unité</label>
                      <p className="text-xs text-slate-400">Défini par couleur ci-dessous</p>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantité totale</label>
                    <input
                      required
                      type="number"
                      min="0"
                      className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Couleurs & Répartition ({colorTotal}/{maxQty})</label>
                  <div className="flex flex-wrap gap-2">
                    {PHONE_COLORS.map(c => {
                      const selected = formColors.some(fc => fc.color === c);
                      const disabled = !selected && colorTotal >= maxQty;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => !disabled && addColorToForm(c)}
                          disabled={disabled}
                          className={`w-7 h-7 rounded-lg border-2 transition-all ${
                            selected ? 'border-indigo-500 scale-110 ring-2 ring-indigo-500/20' 
                            : disabled ? 'border-slate-100 opacity-40 cursor-not-allowed'
                            : 'border-slate-200 hover:border-slate-400'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      );
                    })}
                    <div className="flex items-center gap-1">
                      <input
                        type="color"
                        value={customColor}
                        onChange={e => setCustomColor(e.target.value)}
                        className="w-7 h-7 rounded-lg border-2 border-slate-200 cursor-pointer p-0"
                        title="Couleur personnalisée"
                      />
                      <button
                        type="button"
                        onClick={() => addColorToForm(customColor)}
                        disabled={colorTotal >= maxQty}
                        className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {formColors.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {formColors.map((fc, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded border-2 border-slate-200" style={{ backgroundColor: fc.color }} />
                            {formData.condition === 'Occasion' ? (
                              <span className="text-xs text-slate-500 font-medium w-20">1 unité</span>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                max={maxQty - (colorTotal - fc.qty)}
                                value={fc.qty}
                                onChange={e => updateColorQty(idx, Number(e.target.value))}
                                className="w-20 px-2 py-1 text-sm bg-white border border-slate-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                              />
                            )}
                            <input
                              type="text"
                              placeholder="IMEI"
                              value={fc.reference || ''}
                              onChange={(e) => updateColorCondition(idx, 'reference', e.target.value.trim())}
                              className="w-40 px-2 py-1 text-xs font-mono bg-white border border-slate-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                            />
                            <button
                              type="button"
                              onClick={() => removeColorFromForm(idx)}
                              className="text-red-400 hover:text-red-600 transition-colors ml-auto"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          {fc.reference && (
                            <div className="ml-8 flex justify-start">
                              <ReactBarcode value={fc.reference} format="CODE128" width={1.2} height={30} fontSize={9} margin={2} />
                            </div>
                          )}
                          {formData.condition === 'Occasion' && (
                            <div className="ml-8 space-y-2 p-3 bg-amber-50/60 border border-amber-100/80 rounded-xl">
                              <div className="grid grid-cols-4 gap-2">
                                <div>
                                  <label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">💰 Prix (€)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0"
                                    className="w-full px-2 py-1.5 text-xs bg-white border border-amber-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 transition-all"
                                    value={fc.price || ''}
                                    onChange={(e) => updateColorCondition(idx, 'price', e.target.value ? Number(e.target.value) : '')}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">🔋 Batterie</label>
                                  <input
                                    type="text"
                                    placeholder="ex: 87%"
                                    className="w-full px-2 py-1.5 text-xs bg-white border border-amber-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 transition-all"
                                    value={fc.batteryHealth || ''}
                                    onChange={(e) => updateColorCondition(idx, 'batteryHealth', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">📱 Écran</label>
                                  <select
                                    className="w-full px-2 py-1.5 text-xs bg-white border border-amber-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 transition-all"
                                    value={fc.screenCondition || ''}
                                    onChange={(e) => updateColorCondition(idx, 'screenCondition', e.target.value)}
                                  >
                                    <option value="">—</option>
                                    <option value="Parfait">Parfait</option>
                                    <option value="Bon">Bon</option>
                                    <option value="Rayures légères">Rayures légères</option>
                                    <option value="Rayures visibles">Rayures visibles</option>
                                    <option value="Fissuré">Fissuré</option>
                                    <option value="Cassé">Cassé</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">🛡️ Châssis</label>
                                  <select
                                    className="w-full px-2 py-1.5 text-xs bg-white border border-amber-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 transition-all"
                                    value={fc.frameCondition || ''}
                                    onChange={(e) => updateColorCondition(idx, 'frameCondition', e.target.value)}
                                  >
                                    <option value="">—</option>
                                    <option value="Parfait">Parfait</option>
                                    <option value="Bon">Bon</option>
                                    <option value="Micro-rayures">Micro-rayures</option>
                                    <option value="Rayures visibles">Rayures visibles</option>
                                    <option value="Cabossé">Cabossé</option>
                                    <option value="Endommagé">Endommagé</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      <p className={`text-xs ${colorTotal > maxQty ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                        Réparti : {colorTotal} / {maxQty} unités
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">État</label>
                  <select
                    className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                    value={formData.condition}
                    onChange={(e) => {
                      const cond = e.target.value as PhoneCondition;
                      setFormData({ ...formData, condition: cond });
                      // For Occasion, force each color entry to qty 1
                      if (cond === 'Occasion' && formColors.length > 0) {
                        setFormColors(formColors.map(c => ({ ...c, qty: 1 })));
                      }
                    }}
                  >
                    <option value="Neuf">Neuf</option>
                    <option value="Occasion">Occasion</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Magasin</label>
                  <select
                    className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                    value={formData.store}
                    onChange={(e) => setFormData({ ...formData, store: e.target.value as Store })}
                  >
                    {allowedStores.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
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
                    {editingPhone ? 'Enregistrer' : 'Ajouter'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal for Brand Management */}
        {isBrandModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-900">Gérer les marques</h3>
                <button onClick={() => setIsBrandModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nouvelle marque..."
                    className="flex-1 px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddBrand()}
                  />
                  <button
                    onClick={handleAddBrand}
                    disabled={!newBrandName.trim()}
                    className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none transition-all"
                  >
                    Ajouter
                  </button>
                </div>
                <div className="rounded-xl border border-slate-200/80 overflow-hidden">
                  <ul className="divide-y divide-slate-50 max-h-60 overflow-y-auto">
                    {brands.map(b => (
                      <li key={b.id} className="px-4 py-3 flex justify-between items-center hover:bg-slate-50/60 transition-colors">
                        <span className="text-sm font-semibold text-slate-700">{b.name}</span>
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              message: `Êtes-vous sûr de vouloir supprimer la marque ${b.name} ?`,
                              onConfirm: () => { deleteBrand(b.id); setConfirmDialog(null); }
                            });
                          }}
                          className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </li>
                    ))}
                    {brands.length === 0 && (
                      <li className="p-4 text-center text-slate-400 text-sm">Aucune marque.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick-Add (Duplicate) Modal */}
        {dupPhone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Ajouter au stock</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Même modèle, nouveau magasin / nouvelles couleurs</p>
                </div>
                <button onClick={() => setDupPhone(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={18} /></button>
              </div>

              {/* Phone summary */}
              <div className="px-5 pt-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white shrink-0">
                    <Package size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{dupPhone.brand} {dupPhone.model}</p>
                    <p className="text-xs text-slate-400">{dupPhone.storage} · {dupPhone.ram} RAM · {dupPhone.condition} · {dupPhone.price}€</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleDupSubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantité</label>
                    <input
                      required
                      type="number"
                      min="1"
                      className="w-full px-3 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                      value={dupQty}
                      onChange={(e) => setDupQty(Math.max(1, Number(e.target.value)))}
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Couleurs & Répartition ({dupColorTotal}/{dupQty})</label>
                  <div className="flex flex-wrap gap-2">
                    {PHONE_COLORS.map(c => {
                      const selected = dupColors.some(fc => fc.color === c);
                      const disabled = !selected && dupColorTotal >= dupQty;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => !disabled && addDupColor(c)}
                          disabled={disabled}
                          className={`w-7 h-7 rounded-lg border-2 transition-all ${
                            selected ? 'border-indigo-500 scale-110 ring-2 ring-indigo-500/20'
                            : disabled ? 'border-slate-100 opacity-40 cursor-not-allowed'
                            : 'border-slate-200 hover:border-slate-400'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      );
                    })}
                    <div className="flex items-center gap-1">
                      <input
                        type="color"
                        value={dupCustomColor}
                        onChange={e => setDupCustomColor(e.target.value)}
                        className="w-7 h-7 rounded-lg border-2 border-slate-200 cursor-pointer p-0"
                        title="Couleur personnalisée"
                      />
                      <button
                        type="button"
                        onClick={() => addDupColor(dupCustomColor)}
                        disabled={dupColorTotal >= dupQty}
                        className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {dupColors.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {dupColors.map(fc => (
                        <div key={fc.color} className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded border-2 border-slate-200" style={{ backgroundColor: fc.color }} />
                          <input
                            type="number"
                            min="0"
                            max={dupQty - (dupColorTotal - fc.qty)}
                            value={fc.qty}
                            onChange={e => updateDupColorQty(fc.color, Number(e.target.value))}
                            className="w-20 px-2 py-1 text-sm bg-white border border-slate-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                          />
                          <button
                            type="button"
                            onClick={() => removeDupColor(fc.color)}
                            className="text-red-400 hover:text-red-600 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      <p className={`text-xs ${dupColorTotal > dupQty ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                        Réparti : {dupColorTotal} / {dupQty} unités
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setDupPhone(null)}
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

        {/* Custom Confirm Dialog */}
        {confirmDialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
                  <Trash2 size={24} className="text-red-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Confirmer la suppression</h3>
                  <p className="text-sm text-slate-400 mt-2">{confirmDialog.message}</p>
                </div>
              </div>
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200/80 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-semibold text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Phone Detail Modal */}
        {detailPhone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDetailPhone(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{detailPhone.brand} {detailPhone.model}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{detailPhone.storage} · {detailPhone.ram} RAM · {detailPhone.condition} · {detailPhone.store}</p>
                </div>
                <button onClick={() => setDetailPhone(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <X size={18} />
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
                          {c.batteryHealth && <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">🔋 {c.batteryHealth}</span>}
                          {c.screenCondition && <span className="text-[11px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full font-medium">📱 {c.screenCondition}</span>}
                          {c.frameCondition && <span className="text-[11px] px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full font-medium">🛡️ {c.frameCondition}</span>}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">Aucun détail couleur disponible.</p>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">{detailPhone.quantity} unité(s) au total</span>
                <button
                  onClick={() => setDetailPhone(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50 transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
