import React, { useState, useMemo } from 'react';
import { AdminLayout } from '../components/Layouts';
import { Button } from '../components/UI';
import { Download, Calendar, FileText, TrendingUp, Wallet, Users, Store as StoreIcon } from 'lucide-react';
import { useStore } from '../store';
import { formatHours } from '../lib/utils';

function downloadCSV(reports: any[], month: string) {
  const header = 'Employé;Magasin(s);Heures totales;Taux horaire (€/h);Montant à payer (€)';
  const rows = reports.map(r =>
    `${r.fullName};${r.stores.join(' / ')};${r.totalHours.toFixed(2)};${r.hourlyRate};${r.totalAmount.toFixed(2)}`
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapport_${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadEmployeePDF(report: any, attendance: any[], month: string) {
  const entries = attendance.filter(a => a.userId === report.userId && a.date.startsWith(month));
  const lines = entries.map(e =>
    `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9">${e.date}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${e.checkIn || '--:--'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${e.checkOut || '--:--'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${e.workedHours.toFixed(2)}h</td>
      <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${e.store || '-'}</td>
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Rapport - ${report.fullName}</title>
  <style>body{font-family:Arial,sans-serif;padding:40px;color:#1e293b}h1{font-size:22px;margin-bottom:4px}p{margin:2px 0;color:#64748b;font-size:14px}table{width:100%;border-collapse:collapse;margin-top:24px}th{background:#f8fafc;padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#94a3b8;border-bottom:2px solid #e2e8f0}.total{margin-top:24px;text-align:right;font-size:15px}.total b{color:#1e293b}</style>
  </head><body>
  <h1>Rapport mensuel — ${report.fullName}</h1>
  <p>Période : ${month} &nbsp;|&nbsp; Magasin(s) : ${report.stores.join(', ')} &nbsp;|&nbsp; Taux horaire : ${report.hourlyRate}€/h</p>
  <table><thead><tr>
    <th>Date</th><th style="text-align:center">Entrée</th><th style="text-align:center">Sortie</th><th style="text-align:center">Heures</th><th style="text-align:center">Magasin</th>
  </tr></thead><tbody>${lines}</tbody></table>
  <div class="total"><p>Total heures : <b>${report.totalHours.toFixed(2)}h</b></p><p>Montant à payer : <b>${report.totalAmount.toFixed(2)}€</b></p></div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); win.print(); }
}

export const ReportsPage = () => {
  const { users, attendance } = useStore();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const reports = useMemo(() => {
    return users.filter(u => u.role === 'Employé').map(user => {
      const userAttendance = attendance.filter(a => 
        a.userId === user.id && a.date.startsWith(month)
      );
      const totalHours = userAttendance.reduce((acc, curr) => acc + curr.workedHours, 0);
      const totalAmount = totalHours * user.hourlyRate;
      
      return {
        userId: user.id,
        fullName: user.fullName,
        stores: user.stores,
        totalHours,
        hourlyRate: user.hourlyRate,
        totalAmount
      };
    }).filter(r => r.totalHours > 0);
  }, [users, attendance, month]);

  const totalHours = reports.reduce((acc, curr) => acc + curr.totalHours, 0);
  const totalAmount = reports.reduce((acc, curr) => acc + curr.totalAmount, 0);

  return (
    <AdminLayout title="Rapports mensuels">
      <div className="space-y-6">

        {/* ═══ Stats Row ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white shadow-lg shadow-blue-600/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit"><TrendingUp size={16} /></div>
              <p className="text-3xl font-black mt-3 tabular-nums">{formatHours(totalHours)}</p>
              <p className="text-blue-100 text-xs font-medium mt-1">Total des heures</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/10" />
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg shadow-emerald-500/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit"><Wallet size={16} /></div>
              <p className="text-3xl font-black mt-3 tabular-nums">{totalAmount.toLocaleString()}€</p>
              <p className="text-emerald-100 text-xs font-medium mt-1">Montant total à payer</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/10" />
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 p-5 text-white shadow-lg shadow-slate-700/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/15 backdrop-blur-sm w-fit"><Users size={16} /></div>
              <p className="text-3xl font-black mt-3 tabular-nums">{reports.length}</p>
              <p className="text-slate-300 text-xs font-medium mt-1">Employés actifs ce mois</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/5" />
          </div>
        </div>

        {/* ═══ Toolbar ═══ */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-auto">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input 
              type="month" 
              className="rounded-xl border border-slate-200/80 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <button
            onClick={() => downloadCSV(reports, month)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all"
          >
            <Download size={16} />
            Exporter (CSV)
          </button>
        </div>

        {/* ═══ Reports Table ═══ */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-5 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employé</th>
                  <th className="px-4 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Magasin</th>
                  <th className="px-4 py-3.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Heures</th>
                  <th className="px-4 py-3.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Taux</th>
                  <th className="px-4 py-3.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Montant</th>
                  <th className="px-4 py-3.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rapport</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reports.map((report) => (
                  <tr key={report.userId} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                          {report.fullName.charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-slate-800">{report.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {report.stores.map((store: string) => (
                          <span key={store} className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 ring-1 ring-indigo-200/80 px-2 py-0.5 rounded-full">
                            <StoreIcon size={10} />
                            {store.replace('Phonetastic ', 'P')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="text-sm font-black text-slate-800 tabular-nums">{formatHours(report.totalHours)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="text-sm font-semibold text-slate-600 tabular-nums">{report.hourlyRate}€</span>
                      <span className="text-[11px] text-slate-400"> /h</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-black text-emerald-700 tabular-nums bg-emerald-50 px-2.5 py-1 rounded-lg">{report.totalAmount.toLocaleString()}€</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => downloadEmployeePDF(report, attendance, month)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 bg-slate-50 ring-1 ring-slate-200/80 hover:bg-slate-100 hover:text-slate-800 transition-all"
                      >
                        <Download size={12} />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-3 rounded-2xl bg-slate-100"><FileText size={24} className="text-slate-400" /></div>
                        <p className="text-sm text-slate-400 font-medium">Aucune donnée pour ce mois.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Footer */}
          {reports.length > 0 && (
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <p className="text-xs text-slate-400 font-medium">{reports.length} employé{reports.length > 1 ? 's' : ''}</p>
              <div className="flex items-center gap-6">
                <p className="text-xs font-bold text-slate-600 tabular-nums">{formatHours(totalHours)} heures</p>
                <p className="text-xs font-black text-emerald-700 tabular-nums">{totalAmount.toLocaleString()}€</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};
