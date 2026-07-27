import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../components/Layouts';
import { Badge } from '../components/UI';
import { Users, Clock, Timer, ArrowUpRight, ArrowDownRight, Activity, FileText, ChevronRight, Smartphone, X, Store as StoreIcon, TrendingUp, Calendar, Banknote, Zap, UserCheck, UserX, BarChart3 } from 'lucide-react';
import { useStore } from '../store';
import { cn, formatHours, getEffectiveHours } from '../lib/utils';
import { Sale } from '../types';

export const AdminDashboard = () => {
  const { users, attendance, sales, stores } = useStore();
  const navigate = useNavigate();
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [salesFilter, setSalesFilter] = useState<string>('all');
  const todayStr = new Date().toISOString().split('T')[0];
  
  const activeEmployees = users.filter(u => u.status === 'Actif').length;
  const presentToday = attendance.filter(a => a.date === todayStr && (a.status === 'En cours' || a.status === 'Sorti')).length;
  const totalHoursToday = attendance.filter(a => a.date === todayStr).reduce((acc, curr) => acc + getEffectiveHours(curr), 0);
  
  const currentMonth = new Date().toISOString().slice(0, 7);
  const totalHoursMonth = attendance
    .filter(a => a.date.startsWith(currentMonth))
    .reduce((acc, curr) => acc + getEffectiveHours(curr), 0);

  const recentSales = sales.slice(0, 50);
  const todaySales = sales.filter(s => s.soldAt?.startsWith(todayStr));
  const todaySalesTotal = todaySales.reduce((sum, s) => sum + s.price, 0);
  const storeNames = [...new Set(sales.map(s => s.store))];
  const filteredSales = salesFilter === 'all' ? recentSales : recentSales.filter(s => s.store === salesFilter);

  const formatSaleDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  const monthName = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <AdminLayout title="Tableau de bord">
      <div className="space-y-6">

        {/* ═══ Hero Stats Row ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Present */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white shadow-lg shadow-blue-600/20">
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                  <UserCheck size={18} />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold bg-white/20 backdrop-blur-sm px-2 py-1 rounded-lg">
                  <ArrowUpRight size={11} /> +2
                </div>
              </div>
              <p className="text-3xl font-black mt-4 tabular-nums">{presentToday}</p>
              <p className="text-blue-100 text-xs font-medium mt-1">Présents aujourd'hui</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/10" />
            <div className="absolute -right-2 -top-6 h-16 w-16 rounded-full bg-white/5" />
          </div>

          {/* Absent */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 p-5 text-white shadow-lg shadow-rose-500/20">
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                  <UserX size={18} />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold bg-white/20 backdrop-blur-sm px-2 py-1 rounded-lg">
                  <ArrowDownRight size={11} /> -1
                </div>
              </div>
              <p className="text-3xl font-black mt-4 tabular-nums">{activeEmployees - presentToday}</p>
              <p className="text-rose-100 text-xs font-medium mt-1">Absents aujourd'hui</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/10" />
          </div>

          {/* Hours */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg shadow-emerald-500/20">
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                  <Timer size={18} />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold bg-white/20 backdrop-blur-sm px-2 py-1 rounded-lg">
                  <ArrowUpRight size={11} /> +3h
                </div>
              </div>
              <p className="text-3xl font-black mt-4 tabular-nums">{formatHours(totalHoursToday)}</p>
              <p className="text-emerald-100 text-xs font-medium mt-1">Heures aujourd'hui</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/10" />
          </div>

          {/* Active Employees */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 p-5 text-white shadow-lg shadow-slate-700/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/15 backdrop-blur-sm w-fit">
                <Activity size={18} />
              </div>
              <p className="text-3xl font-black mt-4 tabular-nums">{activeEmployees}</p>
              <p className="text-slate-300 text-xs font-medium mt-1">Employés actifs</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/5" />
          </div>
        </div>

        {/* ═══ Monthly Overview + Sales Summary ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Monthly Hours Card */}
          <div className="lg:col-span-3 rounded-2xl border border-slate-200/80 bg-white shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-md shadow-indigo-500/25">
                <BarChart3 size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Aperçu mensuel</h3>
                <p className="text-[11px] text-slate-400 capitalize">{monthName}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-indigo-50/80 rounded-xl p-4 border border-indigo-100/80">
                <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Total heures</p>
                <p className="text-2xl font-black text-indigo-700 mt-1 tabular-nums">{formatHours(totalHoursMonth)}</p>
              </div>
              <div className="bg-emerald-50/80 rounded-xl p-4 border border-emerald-100/80">
                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Ventes</p>
                <p className="text-2xl font-black text-emerald-700 mt-1 tabular-nums">{todaySales.length}</p>
                <p className="text-[10px] text-emerald-400 mt-0.5">aujourd'hui</p>
              </div>
              <div className="bg-amber-50/80 rounded-xl p-4 border border-amber-100/80">
                <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Présence</p>
                <p className="text-2xl font-black text-amber-700 mt-1 tabular-nums">{presentToday}/{activeEmployees}</p>
                <p className="text-[10px] text-amber-400 mt-0.5">en poste</p>
              </div>
            </div>
          </div>

          {/* Sales Today Card */}
          <div
            className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm p-6 cursor-pointer group hover:shadow-md hover:border-indigo-200 transition-all duration-300"
            onClick={() => setShowSalesModal(true)}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-500/25">
                  <Banknote size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Ventes du jour</h3>
                  <p className="text-[11px] text-slate-400">Cliquez pour détails</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl p-4 border border-indigo-100/50">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Chiffre d'affaires</p>
                  <p className="text-3xl font-black text-indigo-600 mt-1 tabular-nums">{todaySalesTotal.toFixed(0)}€</p>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                    <Smartphone size={13} />
                    {todaySales.length} vente{todaySales.length > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Main Content: Table + Actions ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Attendance Table */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Derniers pointages</h3>
                  <p className="text-[11px] text-slate-400">Activité en temps réel</p>
                </div>
              </div>
              <button 
                onClick={() => navigate('/admin/attendance')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-all"
              >
                Voir tout <ChevronRight size={14} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employé</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Magasin</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Heure</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {attendance.slice(0, 6).map((entry) => {
                    const user = users.find(u => u.id === entry.userId);
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-[11px] font-bold text-white shadow-sm">
                              {user?.fullName.charAt(0)}
                            </div>
                            <span className="text-sm font-semibold text-slate-700">{user?.fullName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-500">{entry.store || user?.stores.join(', ')}</td>
                        <td className="px-4 py-3.5 text-sm font-semibold text-slate-600 tabular-nums">{entry.checkIn || '--:--'}</td>
                        <td className="px-4 py-3.5">
                          <Badge variant={entry.status === 'En cours' ? 'success' : entry.status === 'Absent' ? 'danger' : 'default'}>
                            {entry.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {attendance.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-sm text-slate-400">Aucun pointage aujourd'hui</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Quick Actions + Recent Sales */}
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Zap size={16} />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Actions rapides</h3>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Ajouter un employé', icon: Users, href: '/admin/employees', color: 'from-blue-500 to-blue-600' },
                  { label: 'Corriger un pointage', icon: Clock, href: '/admin/attendance', color: 'from-emerald-500 to-emerald-600' },
                  { label: 'Générer rapport', icon: FileText, href: '/admin/reports', color: 'from-violet-500 to-violet-600' },
                ].map((action) => (
                  <button 
                    key={action.href}
                    onClick={() => navigate(action.href)}
                    className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all duration-200 group"
                  >
                    <div className={cn("p-2 rounded-lg bg-gradient-to-br shadow-sm text-white", action.color)}>
                      <action.icon size={14} />
                    </div>
                    <span className="flex-1 text-left">{action.label}</span>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>

            {/* Mini Sales List */}
            {recentSales.length > 0 && (
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                      <Smartphone size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">Dernières ventes</h3>
                  </div>
                  <button 
                    onClick={() => setShowSalesModal(true)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    Tout
                  </button>
                </div>
                <div className="space-y-2">
                  {recentSales.slice(0, 3).map(sale => (
                    <div key={sale.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100/80 hover:border-slate-200 transition-colors">
                      <div className="h-9 w-9 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 shadow-sm" style={{ backgroundColor: sale.color || '#6366f1', color: sale.color === '#FFFFFF' || sale.color === '#FFD700' ? '#333' : '#fff' }}>
                        {sale.phoneBrand.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{sale.phoneBrand} {sale.phoneModel}</p>
                        <p className="text-[10px] text-slate-400 truncate">{sale.store} · {sale.soldByName}</p>
                      </div>
                      <p className="text-sm font-black text-indigo-600 shrink-0">{sale.price}€</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Employee Records ═══ */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                <Users size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Registres des employés</h3>
                <p className="text-[11px] text-slate-400">Sélectionnez pour consulter le registre</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/admin/records')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-all"
            >
              Voir tout <ChevronRight size={14} />
            </button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {users.filter(u => u.role === 'Employé' && u.status === 'Actif').map((emp) => {
                const empAttendance = attendance.filter(a => a.userId === emp.id && a.date.startsWith(currentMonth));
                const empHours = empAttendance.reduce((sum, a) => sum + getEffectiveHours(a), 0);
                const empDays = empAttendance.length;
                const isPresent = attendance.some(a => a.userId === emp.id && a.date === todayStr && (a.status === 'En cours' || a.status === 'Sorti'));
                return (
                  <div 
                    key={emp.id} 
                    className="group p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-indigo-200 hover:shadow-md cursor-pointer transition-all duration-300"
                    onClick={() => navigate(`/admin/employee/${emp.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-sm">
                          {emp.fullName.charAt(0)}
                        </div>
                        <div className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm",
                          isPresent ? "bg-emerald-400" : "bg-slate-300"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">{emp.fullName}</p>
                        <p className="text-[11px] text-slate-400 truncate">{emp.stores.join(', ')}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={11} className="text-slate-400" />
                        <span className="text-[11px] text-slate-500 font-medium">{empDays} jours</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-slate-700 tabular-nums">{formatHours(empHours)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {users.filter(u => u.role === 'Employé' && u.status === 'Actif').length === 0 && (
              <p className="text-center text-slate-400 py-10 text-sm">Aucun employé actif.</p>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Sales Detail Modal ═══ */}
      {showSalesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowSalesModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/25">
                  <Smartphone size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Dernières ventes</h2>
                  <p className="text-xs text-slate-400">{sales.length} vente{sales.length > 1 ? 's' : ''} au total</p>
                </div>
              </div>
              <button onClick={() => setShowSalesModal(false)} className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            {/* Store Filter */}
            <div className="px-6 pt-4 pb-2 flex items-center gap-2 flex-shrink-0 flex-wrap">
              <button onClick={() => setSalesFilter('all')} className={cn("px-3.5 py-2 rounded-xl text-xs font-bold transition-all", salesFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>Tous</button>
              {storeNames.map(store => (
                <button key={store} onClick={() => setSalesFilter(store)} className={cn("px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5", salesFilter === store ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                  <StoreIcon size={12} />
                  {store}
                </button>
              ))}
            </div>

            {/* Sales List */}
            <div className="flex-1 overflow-y-auto p-6 pt-3 space-y-2.5">
              {filteredSales.length > 0 ? filteredSales.map(sale => (
                <div key={sale.id} className="p-4 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-slate-200 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 shadow-sm" style={{ backgroundColor: sale.color || '#6366f1', borderColor: sale.color === '#FFFFFF' ? '#e2e8f0' : 'transparent', color: sale.color === '#FFFFFF' || sale.color === '#FFD700' ? '#333' : '#fff' }}>
                        {sale.phoneBrand.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{sale.phoneBrand} {sale.phoneModel}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {sale.phoneRam && <span className="text-[11px] text-slate-400">{sale.phoneRam}</span>}
                          {sale.phoneStorage && <span className="text-[11px] text-slate-400">· {sale.phoneStorage}</span>}
                          <Badge variant={sale.phoneCondition === 'Neuf' ? 'success' : 'default'}>
                            {sale.phoneCondition}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-black text-indigo-600">{sale.price}€</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatSaleDate(sale.soldAt)}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <StoreIcon size={11} />
                      <span>{sale.store}</span>
                    </div>
                    <span>Vendu par <span className="font-semibold text-slate-600">{sale.soldByName}</span></span>
                    {sale.reference && <span className="font-mono bg-slate-200/60 px-2 py-0.5 rounded-md text-[10px] text-slate-500">{sale.reference}</span>}
                  </div>
                </div>
              )) : (
                <p className="text-center text-slate-400 py-10 text-sm">Aucune vente trouvée.</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex items-center justify-between flex-shrink-0">
              <span className="text-sm text-slate-500 font-medium">{filteredSales.length} vente{filteredSales.length > 1 ? 's' : ''}</span>
              <span className="text-base font-black text-indigo-600">Total: {filteredSales.reduce((s, v) => s + v.price, 0).toFixed(2)}€</span>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
