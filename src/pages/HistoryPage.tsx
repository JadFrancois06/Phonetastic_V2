import React, { useState } from 'react';
import { EmployeeLayout } from '../components/Layouts';
import { Filter, Calendar, FileText, Download, Clock, Wallet, UtensilsCrossed, BarChart3 } from 'lucide-react';
import { useStore } from '../store';
import { cn, formatHours, getEffectiveHours, hasMeal } from '../lib/utils';

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  'En cours': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'Sorti': { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  'Absent': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  'Présent': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
};

function downloadHistoryPDF(user: any, entries: any[], month: string) {
  const monthLabel = new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const totalHours = entries.reduce((s: number, e: any) => s + getEffectiveHours(e), 0);
  const totalAmount = totalHours * (user.hourlyRate || 0);
  const mealCount = entries.filter((e: any) => hasMeal(e)).length;
  const mealRate = user.mealRate ?? 0;
  const mealTotal = mealCount * mealRate;

  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => {
      const hrs = getEffectiveHours(e);
      const mealIcon = hasMeal(e) ? '✓' : '—';
      return `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9">${e.date}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${e.store || '-'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-family:monospace">${e.checkIn || '--:--'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-family:monospace">${e.checkOut || '--:--'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${formatHours(hrs)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${mealIcon}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${e.status || '-'}${e.status === 'En cours' ? ' (en temps réel)' : ''}</td>
      </tr>`;
    }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Historique - ${user.fullName}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:40px;color:#1e293b}
    h1{font-size:22px;margin-bottom:4px}
    p{margin:2px 0;color:#64748b;font-size:14px}
    table{width:100%;border-collapse:collapse;margin-top:24px}
    th{background:#f8fafc;padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#94a3b8;border-bottom:2px solid #e2e8f0}
    .total{margin-top:24px;text-align:right;font-size:15px}
    .total b{color:#1e293b}
  </style>
  </head><body>
  <h1>Historique de pointage — ${user.fullName}</h1>
  <p>Période : <b style="color:#1e293b;text-transform:capitalize">${monthLabel}</b> &nbsp;|&nbsp; Taux horaire : ${user.hourlyRate || 0}€/h</p>
  <table><thead><tr>
    <th>Date</th><th>Magasin</th>
    <th style="text-align:center">Entrée</th>
    <th style="text-align:center">Sortie</th>
    <th style="text-align:center">Heures</th>
    <th style="text-align:center">Repas</th>
    <th style="text-align:center">Statut</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <div class="total">
    <p>Total heures : <b>${formatHours(totalHours)}</b></p>
    <p>Repas : <b>${mealCount} repas × ${mealRate}€ = ${mealTotal.toFixed(2)}€</b></p>
    <p>Montant estimé : <b>${(totalAmount + mealTotal).toFixed(2)}€</b></p>
  </div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); win.print(); }
}

export const HistoryPage = () => {
  const { currentUser, attendance } = useStore();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const userAttendance = currentUser ? attendance.filter(a => a.userId === currentUser.id && a.date.startsWith(month)) : [];

  if (!currentUser) {
    return <EmployeeLayout title="Historique"><div /></EmployeeLayout>;
  }

  const totalHrs = userAttendance.reduce((s, e) => s + getEffectiveHours(e), 0);
  const mealCount = userAttendance.filter(e => hasMeal(e)).length;
  const mealRate = currentUser?.mealRate ?? 0;
  const estimatedAmount = totalHrs * (currentUser?.hourlyRate || 0) + mealCount * mealRate;
  const monthLabel = new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <EmployeeLayout title="Historique">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-48">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
              <input
                type="month"
                className="w-full h-10 pl-10 pr-3 py-2 text-sm bg-white border-2 border-slate-300 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <span className="text-sm text-slate-500 capitalize hidden sm:inline">{monthLabel}</span>
          </div>
          <button
            onClick={() => downloadHistoryPDF(currentUser, userAttendance, month)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border-2 border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer w-full sm:w-auto justify-center"
          >
            <Download size={16} />
            Exporter (PDF)
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-600/25">
                <Clock size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Heures</p>
                <p className="text-lg font-bold text-slate-900">{formatHours(totalHrs)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-600/25">
                <Wallet size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Montant</p>
                <p className="text-lg font-bold text-slate-900">{estimatedAmount.toLocaleString()}€</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-600/25">
                <UtensilsCrossed size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Repas</p>
                <p className="text-lg font-bold text-slate-900">{mealCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-600/25">
                <BarChart3 size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Jours</p>
                <p className="text-lg font-bold text-slate-900">{userAttendance.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* History Table */}
        {userAttendance.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Magasin</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Entrée</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Sortie</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Heures</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Repas</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userAttendance.map((entry) => {
                    const sc = statusConfig[entry.status] || statusConfig['Sorti'];
                    return (
                      <tr key={entry.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex flex-col items-center justify-center text-slate-600 border border-slate-200/60">
                              <span className="text-[9px] font-bold uppercase leading-none text-slate-400">
                                {new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)}
                              </span>
                              <span className="text-sm font-bold leading-none">{entry.date.split('-')[2]}</span>
                            </div>
                            <span className="text-sm font-semibold text-slate-900">{entry.date}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{entry.store || currentUser?.stores.join(', ')}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 text-center font-mono whitespace-nowrap">{entry.checkIn || '--:--'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 text-center font-mono whitespace-nowrap">{entry.checkOut || '--:--'}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900 text-center whitespace-nowrap">{formatHours(getEffectiveHours(entry))}</td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          {hasMeal(entry) ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
                              <UtensilsCrossed size={12} />
                              Oui
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', sc.bg, sc.text)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-slate-300 border border-slate-200/60">
              <FileText size={40} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Aucun historique</h3>
              <p className="text-sm text-slate-500">Vous n'avez pas encore de pointage pour cette période.</p>
            </div>
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
};
