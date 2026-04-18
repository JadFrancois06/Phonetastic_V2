import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../components/Layouts';
import { Badge } from '../components/UI';
import { Search, ChevronRight, Clock, Calendar, Users, UtensilsCrossed, Euro, CalendarDays, Store as StoreIcon } from 'lucide-react';
import { useStore } from '../store';
import { cn, formatHours, getEffectiveHours, hasMeal } from '../lib/utils';

export const EmployeeRecordsListPage = () => {
  const { users, attendance } = useStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const todayStr = new Date().toISOString().split('T')[0];

  const activeEmployees = users.filter(u => u.role === 'Employé' && u.status === 'Actif');
  const filteredEmployees = activeEmployees.filter(u =>
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const monthAttendance = attendance.filter(a => a.date.startsWith(month));
  const totalMonthHours = monthAttendance.reduce((s, a) => s + getEffectiveHours(a), 0);
  const monthLabel = new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <AdminLayout title="Registres des employés">
      <div className="space-y-6">

        {/* ═══ Stats Row ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white shadow-lg shadow-blue-600/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit"><Users size={16} /></div>
              <p className="text-3xl font-black mt-3 tabular-nums">{activeEmployees.length}</p>
              <p className="text-blue-100 text-xs font-medium mt-1">Employés actifs</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/10" />
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg shadow-emerald-500/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit"><Clock size={16} /></div>
              <p className="text-3xl font-black mt-3 tabular-nums">{formatHours(totalMonthHours)}</p>
              <p className="text-emerald-100 text-xs font-medium mt-1">Heures totales</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/10" />
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 p-5 text-white shadow-lg shadow-amber-400/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit"><CalendarDays size={16} /></div>
              <p className="text-2xl font-black mt-3 capitalize">{monthLabel}</p>
              <p className="text-amber-100 text-xs font-medium mt-1">Période sélectionnée</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/10" />
          </div>
        </div>

        {/* ═══ Toolbar ═══ */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              className="w-full rounded-xl border border-slate-200/80 bg-white pl-11 pr-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              placeholder="Rechercher un employé..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative w-full sm:w-auto">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="month"
              className="rounded-xl border border-slate-200/80 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
        </div>

        {/* ═══ Subtitle ═══ */}
        <p className="text-xs text-slate-400 font-medium">Sélectionnez un employé pour consulter son registre — ajouter des jours manquants, heures supplémentaires ou jours fériés</p>

        {/* ═══ Employees Grid ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => {
            const empAttendance = attendance.filter(a => a.userId === emp.id && a.date.startsWith(month));
            const empHours = empAttendance.reduce((sum, a) => sum + getEffectiveHours(a), 0);
            const empDays = empAttendance.length;
            const empMeals = empAttendance.filter(a => hasMeal(a)).length;
            const empAmount = empHours * (emp.hourlyRate || 0) + empMeals * (emp.mealRate ?? 0);
            const isPresent = attendance.some(a => a.userId === emp.id && a.date === todayStr && (a.status === 'En cours' || a.status === 'Sorti'));

            return (
              <div
                key={emp.id}
                onClick={() => navigate(`/admin/employee/${emp.id}`)}
                className="group rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all duration-200 cursor-pointer overflow-hidden"
              >
                {/* Top accent bar */}
                <div className="h-1 bg-gradient-to-r from-indigo-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="p-5">
                  {/* Employee header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-sm">
                        {emp.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{emp.fullName}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {emp.stores.map(store => (
                            <span key={store} className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 bg-indigo-50 ring-1 ring-indigo-200/80 px-1.5 py-0.5 rounded-full">
                              <StoreIcon size={8} />
                              {store.replace('Phonetastic ', 'P')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPresent ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200/80 px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          En poste
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 bg-slate-50 ring-1 ring-slate-200/80 px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                          Absent
                        </span>
                      )}
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-100">
                    <div className="text-center p-2 rounded-xl bg-slate-50/80">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jours</p>
                      <p className="text-lg font-black text-slate-800 tabular-nums mt-0.5">{empDays}</p>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-blue-50/80">
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Heures</p>
                      <p className="text-lg font-black text-blue-700 tabular-nums mt-0.5">{formatHours(empHours)}</p>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-amber-50/80">
                      <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Repas</p>
                      <p className="text-lg font-black text-amber-600 tabular-nums mt-0.5">{empMeals}</p>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-emerald-50/80">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Total</p>
                      <p className="text-lg font-black text-emerald-700 tabular-nums mt-0.5">{empAmount.toFixed(0)}€</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredEmployees.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <div className="p-4 rounded-2xl bg-slate-100"><Users size={28} className="text-slate-400" /></div>
            <p className="text-lg font-black text-slate-800">Aucun employé trouvé</p>
            <p className="text-sm text-slate-400">Essayez une autre recherche ou vérifiez les employés actifs.</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
