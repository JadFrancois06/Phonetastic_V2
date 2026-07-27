import React from 'react';
import { EmployeeLayout } from '../components/Layouts';
import { Clock, TrendingUp, Calendar, ChevronRight, Wallet, Download, UtensilsCrossed } from 'lucide-react';
import { useStore } from '../store';
import { cn, formatHours, getEffectiveHours, hasMeal } from '../lib/utils';

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  'En cours': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'Sorti': { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  'Absent': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

function downloadMyReport(user: any, entries: any[], month: string) {
  const monthEntries = entries.filter(e => e.date.startsWith(month));
  const lines = monthEntries
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => {
      const hrs = getEffectiveHours(e);
      const mealIcon = hasMeal(e) ? '✓' : '—';
      return `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9">${e.date}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${e.checkIn || '--:--'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${e.checkOut || '--:--'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${hrs.toFixed(2)}h</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${mealIcon}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${e.store || '-'}</td>
      </tr>`;
    }).join('');

  const totalHours = monthEntries.reduce((s: number, e: any) => s + getEffectiveHours(e), 0);
  const totalAmount = totalHours * (user.hourlyRate || 0);
  const mealCount = monthEntries.filter((e: any) => hasMeal(e)).length;
  const mealRate = user.mealRate ?? 0;
  const mealTotal = mealCount * mealRate;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Rapport - ${user.fullName}</title>
  <style>body{font-family:Arial,sans-serif;padding:40px;color:#1e293b}h1{font-size:22px;margin-bottom:4px}p{margin:2px 0;color:#64748b;font-size:14px}table{width:100%;border-collapse:collapse;margin-top:24px}th{background:#f8fafc;padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#94a3b8;border-bottom:2px solid #e2e8f0}.total{margin-top:24px;text-align:right;font-size:15px}.total b{color:#1e293b}</style>
  </head><body>
  <h1>Rapport mensuel — ${user.fullName}</h1>
  <p>Période : ${month} &nbsp;|&nbsp; Taux horaire : ${user.hourlyRate || 0}€/h</p>
  <table><thead><tr>
    <th>Date</th><th style="text-align:center">Entrée</th><th style="text-align:center">Sortie</th><th style="text-align:center">Heures</th><th style="text-align:center">Repas</th><th style="text-align:center">Magasin</th>
  </tr></thead><tbody>${lines}</tbody></table>
  <div class="total">
    <p>Total heures : <b>${totalHours.toFixed(2)}h</b></p>
    <p>Repas : <b>${mealCount} repas × ${mealRate}€ = ${mealTotal.toFixed(2)}€</b></p>
    <p>Montant estimé : <b>${(totalAmount + mealTotal).toFixed(2)}€</b></p>
  </div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); win.print(); }
}

export const HoursPage = () => {
  const { currentUser, attendance } = useStore();
  
  const currentMonth = new Date().toISOString().slice(0, 7);
  const userAttendance = currentUser ? attendance.filter(a => a.userId === currentUser.id) : [];
  
  const currentMonthHours = userAttendance
    .filter(a => a.date.startsWith(currentMonth))
    .reduce((sum, a) => sum + getEffectiveHours(a), 0);

  const currentMonthEntries = userAttendance.filter(a => a.date.startsWith(currentMonth));
  const mealCount = currentMonthEntries.filter(a => hasMeal(a)).length;
  const mealRate = currentUser?.mealRate ?? 0;
  const mealTotal = mealCount * mealRate;
  const estimatedAmount = currentMonthHours * (currentUser?.hourlyRate || 0) + mealTotal;
  const workedDays = currentMonthEntries.length;

  const monthLabel = new Date(currentMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  if (!currentUser) {
    return <EmployeeLayout title="Mes heures"><div /></EmployeeLayout>;
  }

  return (
    <EmployeeLayout title="Mes heures">
      <div className="space-y-6">
        {/* Header with download button */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500 capitalize">{monthLabel}</p>
          <button
            onClick={() => downloadMyReport(currentUser, userAttendance, currentMonth)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border-2 border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download size={16} />
            Télécharger mon rapport
          </button>
        </div>

        {/* Monthly Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Primary Card - Total Hours */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-xl shadow-indigo-600/20">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-white/20">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Total des heures</p>
                <h3 className="text-3xl font-bold">{formatHours(currentMonthHours)}</h3>
              </div>
            </div>
            <div className="flex items-center gap-2 text-emerald-300 text-sm font-medium">
              <TrendingUp size={16} />
              <span className="capitalize">{monthLabel}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-600/25">
                <UtensilsCrossed size={24} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Repas</p>
                <h3 className="text-3xl font-bold text-slate-900">{mealCount}</h3>
              </div>
            </div>
            <p className="text-xs text-slate-400">{mealCount} repas × {mealRate}€ = {mealTotal}€</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-600/25">
                <Wallet size={24} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Montant estimé</p>
                <h3 className="text-3xl font-bold text-slate-900">{estimatedAmount.toLocaleString()}€</h3>
              </div>
            </div>
            <p className="text-xs text-slate-400">Heures + repas inclus</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-600/25">
                <Calendar size={24} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Jours travaillés</p>
                <h3 className="text-3xl font-bold text-slate-900">{workedDays} jours</h3>
              </div>
            </div>
            <p className="text-xs text-slate-400 capitalize">{monthLabel}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visual Summary - Weekly Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Répartition hebdomadaire</h3>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                Semaine en cours
              </span>
            </div>
            
            {/* Bar Chart */}
            <div className="flex items-end justify-between h-48 gap-4 px-4">
              {[8, 9, 7, 8, 9, 0, 0].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{h > 0 ? `${h}h` : ''}</span>
                  <div 
                    className={cn(
                      "w-full rounded-xl transition-all duration-500",
                      h > 0 ? "bg-gradient-to-t from-indigo-600 to-indigo-400 shadow-sm" : "bg-slate-100"
                    )} 
                    style={{ height: `${(h / 10) * 100}%`, minHeight: h === 0 ? '8px' : undefined }}
                  />
                  <span className="text-xs font-medium text-slate-400">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Days List */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Détails récents</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {userAttendance.slice(0, 5).map((entry) => {
                const sc = statusConfig[entry.status] || statusConfig['Sorti'];
                return (
                  <div key={entry.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex flex-col items-center justify-center border border-slate-200/60">
                        <span className="text-[8px] font-bold uppercase leading-none text-slate-400">
                          {new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)}
                        </span>
                        <span className="text-xs font-bold leading-none text-slate-700">{entry.date.split('-')[2]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{formatHours(getEffectiveHours(entry))}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{entry.checkIn || '--:--'} — {entry.checkOut || '--:--'}</p>
                      </div>
                    </div>
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold', sc.bg, sc.text)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                      {entry.status}
                    </span>
                  </div>
                );
              })}
              {userAttendance.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm">
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
