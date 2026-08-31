import React, { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AdminLayout, TabletLayout } from '../components/Layouts';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { Search, Download, Calendar, MapPin, User, Smartphone, Undo2, Loader2, FileText } from 'lucide-react';
import { Sale } from '../types';

const formatDateFR = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const formatWarrantyDateFR = (date: Date) => date.toLocaleDateString('fr-FR');

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const getColorDisplayName = (color?: string) => {
  if (!color) return '-';
  const normalized = color.trim().toUpperCase();
  const colorNames: Record<string, string> = {
    '#000000': 'Noir',
    '#FFFFFF': 'Blanc',
    '#C0C0C0': 'Argent',
    '#FFD700': 'Or',
    '#1E90FF': 'Bleu',
    '#DC143C': 'Rouge',
    '#2E8B57': 'Vert',
    '#9370DB': 'Violet',
    '#FF69B4': 'Rose',
    '#FF8C00': 'Orange',
  };
  return colorNames[normalized] || color;
};

const getWarrantyLogoByStore = (store: string) => {
  const normalized = store.toLowerCase();
  if (/\b1\b/.test(normalized)) return '/assets/logo2.png';
  return '/assets/logo.png';
};

const openWarrantyVoucher = (sale: Sale) => {
  const soldAt = new Date(sale.soldAt);
  const durationMonths = sale.phoneCondition === 'Neuf' ? 12 : 6;
  const warrantyEnd = addMonths(soldAt, durationMonths);
  const conditionLabel = sale.phoneCondition === 'Neuf' ? 'Appareil neuf' : 'Appareil d\'occasion';
  const warningText = 'Attention : en cas de perte de ce bon, la garantie ne pourra pas etre appliquee.';
  const logoUrl = new URL(getWarrantyLogoByStore(sale.store), window.location.origin).toString();

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bon de garantie</title>
  <style>
    @page { size: A4; margin: 10mm; }
    html, body { width: 100%; height: 100%; }
    body {
      font-family: Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .card {
      width: 100%;
      min-height: calc(297mm - 20mm);
      box-sizing: border-box;
      border: 2px solid #0f172a;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .top-block { display: flex; flex-direction: column; gap: 14px; }
    .bottom-block { display: flex; flex-direction: column; gap: 14px; }
    .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .logo-wrap { display: flex; align-items: center; gap: 12px; }
    .logo { width: 68px; height: 68px; object-fit: contain; }
    .title { font-size: 26px; font-weight: 800; letter-spacing: 0.4px; }
    .subtitle { color: #334155; font-size: 13px; margin-top: 4px; }
    .section-title { margin: 18px 0 8px; font-size: 13px; color: #334155; text-transform: uppercase; letter-spacing: 0.7px; font-weight: 700; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; }
    .line { border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
    .label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.4px; }
    .value { font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 2px; }
    .paid { margin-top: 18px; padding: 14px; border-radius: 10px; background: #ecfdf5; border: 1px solid #10b981; }
    .paid .amount { font-size: 28px; font-weight: 900; color: #047857; }
    .warn { margin-top: 20px; border: 1px solid #ef4444; background: #fef2f2; color: #991b1b; padding: 12px; border-radius: 10px; font-size: 13px; font-weight: 700; }
    .foot { margin-top: 16px; font-size: 12px; color: #334155; }
  </style>
</head>
<body>
  <div class="card">
    <div class="top-block">
      <div class="top">
        <div class="logo-wrap">
          <img class="logo" src="${escapeHtml(logoUrl)}" alt="Logo" />
          <div>
            <div class="title">BON DE GARANTIE</div>
            <div class="subtitle">Document client - a presenter pour toute reclamation</div>
          </div>
        </div>
        <div style="text-align:right">
          <div class="label">Date d'achat</div>
          <div class="value">${escapeHtml(formatWarrantyDateFR(soldAt))}</div>
        </div>
      </div>

      <div class="section-title">Details appareil</div>
      <div class="grid">
        <div class="line"><div class="label">Client</div><div class="value">${escapeHtml(sale.customerName || '-')}</div></div>
        <div class="line"><div class="label">Marque / Modele</div><div class="value">${escapeHtml(`${sale.phoneBrand} ${sale.phoneModel}`)}</div></div>
        <div class="line"><div class="label">Etat</div><div class="value">${escapeHtml(conditionLabel)}</div></div>
        <div class="line"><div class="label">RAM / Stockage</div><div class="value">${escapeHtml(`${sale.phoneRam} / ${sale.phoneStorage}`)}</div></div>
        <div class="line"><div class="label">Couleur</div><div class="value">${escapeHtml(getColorDisplayName(sale.color))}</div></div>
        <div class="line"><div class="label">IMEI / Reference</div><div class="value">${escapeHtml(sale.reference || '-')}</div></div>
        <div class="line"><div class="label">Magasin</div><div class="value">${escapeHtml(sale.store)}</div></div>
        <div class="line"><div class="label">Duree de garantie</div><div class="value">${durationMonths} mois</div></div>
        <div class="line"><div class="label">Fin de garantie</div><div class="value">${escapeHtml(formatWarrantyDateFR(warrantyEnd))}</div></div>
      </div>
    </div>

    <div class="bottom-block">
      <div class="paid">
        <div class="label">Montant total paye</div>
        <div class="amount">${Number(sale.price).toFixed(2)} EUR</div>
      </div>

      <div class="warn">${warningText}</div>

      <div class="foot">
        Garantie commerciale: ${durationMonths} mois a compter de la date d'achat (${escapeHtml(formatWarrantyDateFR(soldAt))}).
      </div>
    </div>
  </div>

  <script>
    (() => {
      let printed = false;
      const triggerPrint = () => {
        if (printed) return;
        printed = true;
        setTimeout(() => window.print(), 120);
      };

      const img = document.querySelector('.logo');
      if (!img) {
        triggerPrint();
        return;
      }

      if (img.complete) {
        triggerPrint();
        return;
      }

      img.addEventListener('load', triggerPrint, { once: true });
      img.addEventListener('error', triggerPrint, { once: true });
      setTimeout(triggerPrint, 1500);
    })();
  </script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Impossible d\'ouvrir le bon de garantie. Autorisez les popups puis reessayez.');
    return;
  }
  win.document.write(html);
  win.document.close();
};

export const SalesArchivePage = () => {
  const { currentUser, sales, restoreFromArchive } = useStore();
  const { storeName } = useParams();
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('All');
  const [restoringId, setRestoringId] = useState<string | null>(null);

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
        (sale.customerName?.toLowerCase().includes(term) ?? false) ||
        (sale.reference?.toLowerCase().includes(term) ?? false)
      );
    });
  }, [sales, search, storeFilter, activeStore, isTablet, isEmployee, isAdmin, currentUser.stores]);

  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.price, 0);

  const downloadCSV = () => {
    const headers = ['Date', 'Marque', 'Modèle', 'État', 'RAM', 'Stockage', 'Couleur', 'IMEI', 'Prix', 'Magasin', 'Vendu par', 'Client'];
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
      s.customerName || '-',
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `archive-ventes-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const handleRestore = (saleId: string) => {
    setRestoringId(saleId);
    restoreFromArchive(saleId);
    setTimeout(() => setRestoringId(null), 1000);
  };

  const handleGenerateWarranty = (sale: Sale) => {
    openWarrantyVoucher(sale);
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
                placeholder="Rechercher par modèle, IMEI, client..."
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
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Client</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Actions</th>
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
                      <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                        {sale.customerName || '-'}
                      </td>
                      <td className="px-5 py-4 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleGenerateWarranty(sale)}
                            className={cn(
                              'flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors',
                              isTablet
                                ? 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                                : isEmployee
                                ? 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                            )}
                          >
                            <FileText size={14} />
                            Bon garantie
                          </button>

                          <button
                            onClick={() => handleRestore(sale.id)}
                            disabled={restoringId === sale.id}
                            className={cn(
                              'flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors',
                              restoringId === sale.id
                                ? 'bg-slate-200 text-slate-600 cursor-wait'
                                : isTablet
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : isEmployee
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                            )}
                          >
                            {restoringId === sale.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Undo2 size={14} />
                            )}
                            {restoringId === sale.id ? 'Restauration...' : 'Restaurer'}
                          </button>
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
