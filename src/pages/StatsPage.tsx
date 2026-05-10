import React, { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AdminLayout, TabletLayout } from '../components/Layouts';
import { useStore } from '../store';
import { BarChart3, Package, Smartphone, Store, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { Phone } from '../types';

type BrandStat = {
  brand: string;
  total: number;
  neuf: number;
  occasion: number;
  stores: Record<string, { total: number; neuf: number; occasion: number }>;
};

const getUnits = (phone: Phone) => Math.max(0, phone.quantity || 0);

export const StatsPage = () => {
  const { storeName } = useParams();
  const { inventory, stores, currentUser } = useStore();
  const [selectedBrand, setSelectedBrand] = useState<string>('All');

  if (!currentUser) return <Navigate to="/login" replace />;

  const isAdmin = currentUser.role === 'Administrateur';
  const isEmployee = currentUser.role === 'Employé';
  const isStock = currentUser.role === 'Stock';

  if (isEmployee && !currentUser.permissions?.canAccessInventory) {
    return <Navigate to="/employee/dashboard" replace />;
  }

  const visibleStores = useMemo(() => {
    if (isStock && storeName) {
      const activeStore = decodeURIComponent(storeName);
      return stores.filter(s => s.name === activeStore);
    }

    if (isAdmin) return stores;

    return stores.filter(s => currentUser.stores.includes(s.name));
  }, [currentUser.stores, isAdmin, isStock, storeName, stores]);

  const visibleStoreNames = useMemo(() => visibleStores.map(s => s.name), [visibleStores]);

  const scopedInventory = useMemo(() => {
    return inventory.filter(phone => visibleStoreNames.includes(phone.store));
  }, [inventory, visibleStoreNames]);

  const brandStats = useMemo<BrandStat[]>(() => {
    const grouped = new Map<string, BrandStat>();

    scopedInventory.forEach(phone => {
      const existing = grouped.get(phone.brand) ?? {
        brand: phone.brand,
        total: 0,
        neuf: 0,
        occasion: 0,
        stores: {},
      };

      const units = getUnits(phone);
      existing.total += units;
      if (phone.condition === 'Neuf') existing.neuf += units;
      if (phone.condition === 'Occasion') existing.occasion += units;

      const storeEntry = existing.stores[phone.store] ?? { total: 0, neuf: 0, occasion: 0 };
      storeEntry.total += units;
      if (phone.condition === 'Neuf') storeEntry.neuf += units;
      if (phone.condition === 'Occasion') storeEntry.occasion += units;
      existing.stores[phone.store] = storeEntry;

      grouped.set(phone.brand, existing);
    });

    return Array.from(grouped.values()).sort((a, b) => a.brand.localeCompare(b.brand));
  }, [scopedInventory]);

  const selectedStat = selectedBrand === 'All'
    ? null
    : brandStats.find(b => b.brand === selectedBrand) ?? null;

  const totalStock = useMemo(() => scopedInventory.reduce((sum, phone) => sum + getUnits(phone), 0), [scopedInventory]);
  const totalNeuf = useMemo(() => scopedInventory.filter(p => p.condition === 'Neuf').reduce((sum, phone) => sum + getUnits(phone), 0), [scopedInventory]);
  const totalOccasion = useMemo(() => scopedInventory.filter(p => p.condition === 'Occasion').reduce((sum, phone) => sum + getUnits(phone), 0), [scopedInventory]);

  const percentage = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
  const layoutTitle = isStock && storeName ? `Statistiques · ${decodeURIComponent(storeName)}` : 'Statistiques du Stock';
  const Layout = isStock ? TabletLayout : AdminLayout;

  return (
    <Layout title={layoutTitle}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 to-blue-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Total unités</p>
                <p className="text-3xl font-black text-blue-600 mt-2 tabular-nums">{totalStock}</p>
              </div>
              <Package size={32} className="text-blue-300" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Neuf</p>
                <p className="text-3xl font-black text-emerald-600 mt-2 tabular-nums">{totalNeuf}</p>
                <p className="text-xs text-emerald-600 mt-1 font-semibold">{percentage(totalNeuf, totalStock)}% du total</p>
              </div>
              <Smartphone size={32} className="text-emerald-300" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-50 to-amber-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Occasion</p>
                <p className="text-3xl font-black text-amber-600 mt-2 tabular-nums">{totalOccasion}</p>
                <p className="text-xs text-amber-600 mt-1 font-semibold">{percentage(totalOccasion, totalStock)}% du total</p>
              </div>
              <TrendingUp size={32} className="text-amber-300" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Marques</p>
                <p className="text-3xl font-black text-slate-600 mt-2 tabular-nums">{brandStats.length}</p>
                <p className="text-xs text-slate-600 mt-1 font-semibold">{visibleStores.length} magasin(s)</p>
              </div>
              <BarChart3 size={32} className="text-slate-300" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Statistiques par marque</h2>
              <p className="text-xs text-slate-500 mt-1">Choisissez une marque pour voir le neuf et l’occasion sans les modèles</p>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedBrand('All')}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all',
                  selectedBrand === 'All'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                )}
              >
                Tout
              </button>
              {brandStats.map(stat => (
                <button
                  key={stat.brand}
                  onClick={() => setSelectedBrand(stat.brand)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all flex items-center gap-2',
                    selectedBrand === stat.brand
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                  )}
                >
                  {stat.brand}
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[11px] font-black',
                    selectedBrand === stat.brand ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  )}>
                    {stat.total}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selectedBrand === 'All' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {brandStats.map(stat => (
                <button
                  key={stat.brand}
                  onClick={() => setSelectedBrand(stat.brand)}
                  className="text-left rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 hover:shadow-md hover:border-indigo-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-slate-900">{stat.brand}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Cliquez pour voir les détails</p>
                    </div>
                    <Store size={18} className="text-slate-400" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2">
                      <p className="text-[11px] text-emerald-700 font-semibold">Neuf</p>
                      <p className="text-lg font-black text-emerald-600 tabular-nums">{stat.neuf}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 border border-amber-100 p-2">
                      <p className="text-[11px] text-amber-700 font-semibold">Occasion</p>
                      <p className="text-lg font-black text-amber-600 tabular-nums">{stat.occasion}</p>
                    </div>
                    <div className="rounded-lg bg-slate-100 border border-slate-200 p-2">
                      <p className="text-[11px] text-slate-600 font-semibold">Total</p>
                      <p className="text-lg font-black text-slate-900 tabular-nums">{stat.total}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : selectedStat ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400 font-bold">{selectedStat.brand}</p>
                    <h3 className="text-2xl font-black text-slate-900 mt-1">{selectedStat.brand}</h3>
                    <p className="text-sm text-slate-500 mt-1">Quantité totale dans les magasins visibles uniquement</p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black text-indigo-600 tabular-nums">{selectedStat.total}</p>
                    <p className="text-xs text-slate-500">unités</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4">
                    <p className="text-xs font-semibold text-emerald-700">Neuf</p>
                    <p className="text-3xl font-black text-emerald-600 tabular-nums mt-1">{selectedStat.neuf}</p>
                    <p className="text-xs text-emerald-600 mt-1">{percentage(selectedStat.neuf, selectedStat.total)}% de cette marque</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-4">
                    <p className="text-xs font-semibold text-amber-700">Occasion</p>
                    <p className="text-3xl font-black text-amber-600 tabular-nums mt-1">{selectedStat.occasion}</p>
                    <p className="text-xs text-amber-600 mt-1">{percentage(selectedStat.occasion, selectedStat.total)}% de cette marque</p>
                  </div>
                  <div className="rounded-lg bg-slate-100 border border-slate-200 p-4">
                    <p className="text-xs font-semibold text-slate-600">Total</p>
                    <p className="text-3xl font-black text-slate-900 tabular-nums mt-1">{selectedStat.total}</p>
                    <p className="text-xs text-slate-500 mt-1">Sans les modèles</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Répartition par magasin</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {Object.entries(selectedStat.stores).map(([storeName, values]) => (
                    <div key={storeName} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-bold text-slate-900">{storeName}</p>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-md bg-white border border-slate-200 p-2">
                          <p className="text-[10px] text-slate-500 font-semibold">Total</p>
                          <p className="text-base font-black text-slate-900">{values.total}</p>
                        </div>
                        <div className="rounded-md bg-white border border-emerald-200 p-2">
                          <p className="text-[10px] text-emerald-700 font-semibold">Neuf</p>
                          <p className="text-base font-black text-emerald-600">{values.neuf}</p>
                        </div>
                        <div className="rounded-md bg-white border border-amber-200 p-2">
                          <p className="text-[10px] text-amber-700 font-semibold">Occ.</p>
                          <p className="text-base font-black text-amber-600">{values.occasion}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Layout>
  );
};
