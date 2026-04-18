import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EmployeeLayout } from '../components/Layouts';
import { Timer, BarChart3, Clock, Wallet, Store, ChevronRight, ArrowRight } from 'lucide-react';
import { useStore } from '../store';
import { cn, formatHours } from '../lib/utils';

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  'En cours': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'Sorti': { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  'Absent': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  'Non commencé': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
};

export const EmployeeDashboard = () => {
  const { currentUser, attendance } = useStore();
  const navigate = useNavigate();
  
  const todayStr = new Date().toISOString().split('T')[0];
  const todayEntry = currentUser ? attendance.find(a => a.userId === currentUser.id && a.date === todayStr) : null;
  
  const userAttendance = currentUser ? attendance.filter(a => a.userId === currentUser.id) : [];
  const monthHours = userAttendance.reduce((acc, curr) => acc + curr.workedHours, 0);

  if (!currentUser) {
    return <EmployeeLayout title="Tableau de bord"><div /></EmployeeLayout>;
  }

  const todayStatus = todayEntry?.status || 'Non commencé';
  const sc = statusConfig[todayStatus] || statusConfig['Non commencé'];

  return (
    <EmployeeLayout title="Tableau de bord">
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Bonjour, {currentUser?.fullName} 👋</h1>
            <p className="text-slate-500 mt-1">Prêt pour une nouvelle journée chez Phonetastic ?</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
              <Store size={13} />
              {currentUser?.currentStore}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
              <Wallet size={13} />
              {currentUser?.hourlyRate}€ / h
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-600/25">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Statut du jour</p>
              <div className="flex items-center gap-2 mt-1">
                <h3 className="text-xl font-bold text-slate-900">{todayStatus}</h3>
                <span className={cn('h-2 w-2 rounded-full', sc.dot)} />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-600/25">
              <BarChart3 size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Heures du mois</p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">{formatHours(monthHours)}</h3>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-600/25">
              <Timer size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dernier pointage</p>
              <h3 className="text-xl font-bold text-slate-900 font-mono mt-1">{todayEntry?.checkIn || '--:--'}</h3>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pointage Quick Access */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8 flex flex-col items-center justify-center text-center space-y-6">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30">
              <Timer size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">Enregistrer votre présence</h3>
              <p className="text-slate-500 text-sm max-w-xs mx-auto">N'oubliez pas de pointer votre entrée dès votre arrivée au magasin.</p>
            </div>
            <button
              onClick={() => navigate('/employee/pointage')}
              className="w-full h-12 text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-600/25 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              Aller au Pointage
              <ArrowRight size={18} />
            </button>
          </div>

          {/* Recent History */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Derniers jours</h3>
              <button
                onClick={() => navigate('/employee/history')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
              >
                Voir tout
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {userAttendance.slice(0, 4).map((entry) => {
                const entrySc = statusConfig[entry.status] || statusConfig['Sorti'];
                return (
                  <div key={entry.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex flex-col items-center justify-center text-slate-600 border border-slate-200/60">
                        <span className="text-[9px] font-bold uppercase leading-none text-slate-400">
                          {new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)}
                        </span>
                        <span className="text-sm font-bold leading-none">{entry.date.split('-')[2]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{entry.date}</p>
                        <p className="text-xs text-slate-500 font-mono">{entry.checkIn} - {entry.checkOut || '--:--'}</p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <p className="text-sm font-bold text-slate-900">{formatHours(entry.workedHours)}</p>
                      <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold', entrySc.bg, entrySc.text)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', entrySc.dot)} />
                        {entry.status}
                      </span>
                    </div>
                  </div>
                );
              })}
              {userAttendance.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  Aucun historique récent.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </EmployeeLayout>
  );
};
