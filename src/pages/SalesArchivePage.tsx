import React, { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AdminLayout, TabletLayout } from '../components/Layouts';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { Search, Download, Calendar, MapPin, User, Smartphone } from 'lucide-react';
import { Sale } from '../types';

const formatDateFR = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const SalesArchivePage = () => {
  const { currentUser, sales } = useStore();
  const { storeName } = useParams();
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('All');

  if (!currentUser) return <Navigate to="/login" replace />;
  
  // Redirect based on role
  const isTablet = currentUser.role === 'Stock';
  const isEmployee = currentUser.role === 'Employé';
  const isAdmin = currentUser.role === 'Administrateur';
  
  if (!isTablet && !isEmployee && !isAdmin) return <Navigate to="/login" replace />;
  
  // For tablet, validate store param
  if (isTablet) {
    const activeStore = decodeURIComponent(storeName || '');
    if (!activeStore) return <Navigate to="/tablet/stores" replace />;
    
    const validStores = currentUser.stores.length > 0 ? currentUser.stores : [];
    const isAllowedStore = validStores.includes(activeStore) || currentUser.stores.length === 0;
    if (!isAllowedStore) return <Navigate to="/tablet/stores" replace />;
  }

  // Get unique stores from sales
  const uniqueStores = useMemo(() => {
    const stores = new Set(sales.map(s => s.store));
    return Array.from(stores).sort();
  }, [sales]);

  // For tablet, auto-filter by store
  const activeStore = isTablet ? decodeURIComponent(storeName || '') : null;
  
  // Filter sales
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      // For tablet: only show sales from the current store
      if (isTablet && activeStore && sale.store !== activeStore) return false;
      // For employee: show all sales (no store filter, can see all stores they work with)
      if (isEmployee) {
        // Employee sees sales from their assigned stores
        if (currentUser.stores.length > 0 && !currentUser.stores.includes(sale.store)) return false;
      }
      // For admin: respect store filter
      if (isAdmin && storeFilter !== 'All' && sale.store !== storeFilter) return false;
      
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return (
        sale.phoneModel.toLowerCase().includes(term) ||
        sale.phoneBrand.toLowerCase().includes(term) ||
        (sale.reference?.toLowerCase().includes(term) ?? false)
      );
    });
  }, [sales, search, storeFilter, activeStore, isTablet, isEmployee, isAdmin, currentUser.stores]);

  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.price, 0);

  const downloadCSV = () => {
    const headers = ['Date', 'Marque', 'Modèle', 'État', 'RAM', 'Stockage', 'Couleur', 'IMEI', 'Prix', 'Magasin', 'Vendu par'];
    const rows = filteredSales.map(s => [
      new Date(s.soldAt).toLocaleDateString('fr-FR'),
      s.phoneBrand,
      s.phoneModel,
      s.phoneCondition,
      s.phoneRam,
      s.phoneStorage,
      s.color,
      s.reference || '-',
      s.price.toFixed(2),
      s.store,
      s.soldByName,
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `archive-ventes-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const Layout = isTablet ? TabletLayout : AdminLayout;
  const pageTitle = isTablet ? `Archive vente · ${activeStore}` : (isEmployee ? 'Archive des ventes' : 'Archive des ventes');

  return (
    <Layout title={pageTitle}>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className={cn(
          'rounded-3xl border border-slate-200 text-white p-6 shadow-2xl',
          isTablet 
            ? 'bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900'
            : isEmployee
            ? 'bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900'
            : 'bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900'
        )}>
          <h1 className="text-3xl font-black mb-2">
            {isTablet ? `Archive vente · ${activeStore}` : 'Archive des ventes'}
          </h1>
          <p className="text-slate-300">
            {isTablet 
              ? `Historique complet des téléphones vendus à ${activeStore}`
              : isEmployee
              ? `Historique des téléphones vendus`
              : 'Historique complet de tous les téléphones vendus'}
          </p>
        </div>

        {/* Stats Cards - only for admin */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total ventes</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{filteredSales.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Revenu total</p>
              <p className="mt-2 text-3xl font-black text-emerald-600">{totalRevenue.toFixed(2)}€</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Prix moyen</p>
              <p className="mt-2 text-3xl font-black text-indigo-600">
                {filteredSales.length > 0 ? (totalRevenue / filteredSales.length).toFixed(2) : '0'}€
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className={cn(
            'grid gap-3',
            isAdmin ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
          )}>
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par modèle, IMEI..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={cn(
                  'w-full pl-9 pr-3 py-2.5 border-2 rounded-xl text-sm focus:outline-none',
                  isTablet ? 'border-slate-200 focus:border-emerald-400' :
                  isEmployee ? 'border-slate-200 focus:border-blue-400' :
                  'border-slate-200 focus:border-indigo-400'
                )}
              />
            </div>

            {/* Store Filter - only for admin */}
            {isAdmin && (
              <select
                value={storeFilter}
                onChange={e => setStoreFilter(e.target.value)}
                className="px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-700 bg-white"
              >
                <option value="All">Tous les magasins</option>
                {uniqueStores.map(store => (
                  <option key={store} value={store}>
                    {store}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Export Button - only for admin */}
          {isAdmin && (
            <button
              onClick={downloadCSV}
              disabled={filteredSales.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Download size={16} />
              Exporter CSV
            </button>
          )}
        </div>

        {/* Sales Table */}
        {filteredSales.length > 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Téléphone</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">État</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Spécifications</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">IMEI</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Prix</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Magasin</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Vendu par</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredSales.map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-slate-400" />
                          {formatDateFR(sale.soldAt)}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Smartphone size={14} className="text-indigo-600" />
                          {sale.phoneBrand} {sale.phoneModel}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn(
                          'text-xs font-bold px-2.5 py-1 rounded-full',
                          sale.phoneCondition === 'Neuf' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        )}>
                          {sale.phoneCondition}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        <div className="space-y-1">
                          <div><span className="font-semibold">{sale.phoneRam}</span> RAM</div>
                          <div><span className="font-semibold">{sale.phoneStorage}</span></div>
                          <div className="text-xs text-slate-400">{sale.color}</div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-mono text-slate-700">
                        {sale.reference ? (
                          <code className="text-xs bg-slate-100 px-2 py-1 rounded">{sale.reference}</code>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-emerald-600">
                        {sale.price.toFixed(2)}€
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-slate-400" />
                          {sale.store}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-slate-400" />
                          {sale.soldByName}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <Smartphone size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-semibold">Aucune vente trouvée</p>
          </div>
        )}
      </div>
    </Layout>
  );
};
