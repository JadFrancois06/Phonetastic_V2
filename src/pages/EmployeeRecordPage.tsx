import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AdminLayout } from '../components/Layouts';
import { Calendar, ArrowLeft, Download, Plus, Edit, Save, Clock, Wallet, BarChart3, UtensilsCrossed, Trash2, X } from 'lucide-react';
import { useStore } from '../store';
import { AttendanceEntry, AttendanceStatus } from '../types';
import { cn, formatHours, getEffectiveHours, hasMeal } from '../lib/utils';

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  'En cours': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'Sorti': { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  'Absent': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  'Présent': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
};

const inputClass = 'w-full h-10 px-3 py-2 text-sm bg-white border-2 border-slate-300 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors';
const selectClass = 'w-full h-10 px-3 py-2 text-sm bg-white border-2 border-slate-300 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors appearance-none cursor-pointer';

function downloadEmployeePDF(user: any, entries: any[], month: string) {
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
        <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${hrs.toFixed(2)}h</td>
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
    <p>Total heures : <b>${totalHours.toFixed(2)}h</b></p>
    <p>Repas : <b>${mealCount} repas × ${mealRate}€ = ${mealTotal.toFixed(2)}€</b></p>
    <p>Montant estimé : <b>${(totalAmount + mealTotal).toFixed(2)}€</b></p>
  </div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); win.print(); }
}

export const EmployeeRecordPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { users, attendance, addAttendance, updateAttendance, deleteAttendance, stores } = useStore();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  // Add modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFormData, setAddFormData] = useState({
    date: '',
    checkIn: '09:00',
    checkOut: '17:00',
    store: '',
    status: 'Sorti' as AttendanceStatus,
    type: 'regular' as 'regular' | 'missing' | 'overtime' | 'holiday'
  });

  // Edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AttendanceEntry | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editFormData, setEditFormData] = useState({
    checkIn: '',
    checkOut: '',
    workedHours: 0,
    status: 'En cours' as AttendanceStatus,
    store: ''
  });

  const employee = users.find(u => u.id === id);
  const employeeAttendance = attendance
    .filter(a => a.userId === id && a.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalHours = employeeAttendance.reduce((sum, a) => sum + getEffectiveHours(a), 0);
  const workedDays = employeeAttendance.length;
  const mealCount = employeeAttendance.filter(a => hasMeal(a)).length;
  const mealRate = employee?.mealRate ?? 0;
  const mealTotal = mealCount * mealRate;
  const estimatedAmount = totalHours * (employee?.hourlyRate || 0) + mealTotal;
  const monthLabel = new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const calcWorkedHours = (checkIn: string, checkOut: string): number => {
    if (!checkIn || !checkOut) return 0;
    const [inH, inM] = checkIn.split(':').map(Number);
    const [outH, outM] = checkOut.split(':').map(Number);
    const diff = (outH * 60 + outM) - (inH * 60 + inM);
    return diff > 0 ? parseFloat((diff / 60).toFixed(2)) : 0;
  };

  const openAddModal = () => {
    setAddFormData({
      date: new Date().toISOString().split('T')[0],
      checkIn: '09:00',
      checkOut: '17:00',
      store: employee?.stores[0] || '',
      status: 'Sorti',
      type: 'missing'
    });
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !addFormData.date) return;
    const workedHours = calcWorkedHours(addFormData.checkIn, addFormData.checkOut);
    addAttendance({
      userId: id,
      date: addFormData.date,
      checkIn: addFormData.checkIn || null,
      checkOut: addFormData.checkOut || null,
      workedHours,
      status: addFormData.status,
      store: addFormData.store || employee?.stores[0] || ''
    });
    setIsAddModalOpen(false);
  };

  const openEditModal = (entry: AttendanceEntry) => {
    setEditingEntry(entry);
    setEditFormData({
      checkIn: entry.checkIn || '',
      checkOut: entry.checkOut || '',
      workedHours: entry.workedHours || 0,
      status: entry.status,
      store: entry.store || employee?.stores[0] || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEntry) {
      updateAttendance(editingEntry.id, {
        checkIn: editFormData.checkIn || null,
        checkOut: editFormData.checkOut || null,
        workedHours: editFormData.workedHours,
        status: editFormData.status,
        store: editFormData.store
      });
      setIsEditModalOpen(false);
      setEditingEntry(null);
    }
  };

  if (!employee) {
    return (
      <AdminLayout title="Employé introuvable">
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <p className="text-slate-500">Cet employé n'existe pas ou a été supprimé.</p>
          <button
            onClick={() => navigate('/admin/employees')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-2 border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
            Retour aux employés
          </button>
        </div>
      </AdminLayout>
    );
  }

  const storeOptions = [
    ...stores.map(s => s.name),
    ...(employee.stores || []).filter(s => !stores.some(st => st.name === s))
  ];

  return (
    <AdminLayout title={`Registre de ${employee.fullName}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/records')}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white rounded-xl transition-colors cursor-pointer"
            >
              <ArrowLeft size={18} />
              Retour
            </button>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-indigo-600/25">
                {employee.fullName.charAt(0)}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{employee.fullName}</h2>
                <p className="text-sm text-slate-500">{employee.stores.join(', ')} — {employee.hourlyRate}€/h — Repas : {employee.mealRate}€</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setAddFormData({ date: new Date().toISOString().split('T')[0], checkIn: '09:00', checkOut: '17:00', store: employee?.stores[0] || '', status: 'Sorti', type: 'missing' });
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-amber-700 border-2 border-amber-200 bg-white rounded-xl hover:bg-amber-50 transition-colors cursor-pointer"
            >
              <Plus size={16} />
              Jour manquant
            </button>
            <button
              onClick={() => {
                setAddFormData({ date: new Date().toISOString().split('T')[0], checkIn: '17:00', checkOut: '20:00', store: employee?.stores[0] || '', status: 'Sorti', type: 'overtime' });
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-blue-700 border-2 border-blue-200 bg-white rounded-xl hover:bg-blue-50 transition-colors cursor-pointer"
            >
              <Plus size={16} />
              Heures suppl.
            </button>
            <button
              onClick={() => {
                setAddFormData({ date: new Date().toISOString().split('T')[0], checkIn: '09:00', checkOut: '17:00', store: employee?.stores[0] || '', status: 'Sorti', type: 'holiday' });
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-purple-700 border-2 border-purple-200 bg-white rounded-xl hover:bg-purple-50 transition-colors cursor-pointer"
            >
              <Plus size={16} />
              Jour férié
            </button>
            <button
              onClick={() => downloadEmployeePDF(employee, employeeAttendance, month)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 border-2 border-slate-200 bg-white rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Download size={16} />
              PDF
            </button>
          </div>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-3">
          <div className="relative w-48">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            <input
              type="month"
              className={cn(inputClass, 'pl-10')}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <span className="text-sm text-slate-500 capitalize">{monthLabel}</span>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-600/25">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total heures</p>
                <p className="text-2xl font-bold text-slate-900">{formatHours(totalHours)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-600/25">
                <UtensilsCrossed size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Repas</p>
                <p className="text-2xl font-bold text-slate-900">{mealCount} <span className="text-sm font-normal text-slate-500">({mealTotal}€)</span></p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-600/25">
                <Wallet size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Montant estimé</p>
                <p className="text-2xl font-bold text-slate-900">{estimatedAmount.toLocaleString()}€</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-600/25">
                <BarChart3 size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Jours travaillés</p>
                <p className="text-2xl font-bold text-slate-900">{workedDays} jours</p>
              </div>
            </div>
          </div>
        </div>

        {/* Attendance Table */}
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
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employeeAttendance.map((entry) => {
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
                      <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{entry.store || employee.stores.join(', ')}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 text-center font-mono whitespace-nowrap">{entry.checkIn || '--:--'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 text-center font-mono whitespace-nowrap">{entry.checkOut || '--:--'}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900 text-center whitespace-nowrap">{formatHours(getEffectiveHours(entry))}</td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => updateAttendance(entry.id, { meal: !hasMeal(entry) })}
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer',
                            hasMeal(entry)
                              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          )}
                          title={hasMeal(entry) ? 'Retirer le repas' : 'Ajouter le repas'}
                        >
                          <UtensilsCrossed size={13} />
                          {hasMeal(entry) ? 'Oui' : '—'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', sc.bg, sc.text)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(entry)}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Modifier"
                        >
                          <Edit size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {employeeAttendance.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      Aucun pointage enregistré pour cette période.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Attendance Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Ajouter un pointage</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-600">
                Employé : <span className="font-semibold text-slate-900">{employee.fullName}</span>
              </div>

              {/* Type Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Type d'ajout</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'missing', label: 'Jour manquant', desc: 'Employé a oublié de pointer', color: 'border-amber-400 bg-amber-50 text-amber-800' },
                    { value: 'overtime', label: 'Heures suppl.', desc: 'Travail en dehors des horaires', color: 'border-blue-400 bg-blue-50 text-blue-800' },
                    { value: 'holiday', label: 'Jour férié travaillé', desc: 'Travail un jour de repos', color: 'border-purple-400 bg-purple-50 text-purple-800' },
                    { value: 'regular', label: 'Pointage normal', desc: 'Ajout standard', color: 'border-slate-300 bg-slate-50 text-slate-700' },
                  ].map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setAddFormData({ ...addFormData, type: t.value as any })}
                      className={cn(
                        'p-3 rounded-xl border-2 text-left transition-all cursor-pointer',
                        addFormData.type === t.value ? t.color + ' ring-2 ring-offset-1 ring-slate-400' : 'border-slate-200 bg-white hover:bg-slate-50'
                      )}
                    >
                      <p className="text-sm font-semibold">{t.label}</p>
                      <p className="text-xs opacity-70 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</label>
                  <input
                    type="date"
                    required
                    className={inputClass}
                    value={addFormData.date}
                    onChange={e => setAddFormData({ ...addFormData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Magasin</label>
                  <select
                    className={selectClass}
                    value={addFormData.store}
                    onChange={e => setAddFormData({ ...addFormData, store: e.target.value })}
                  >
                    {storeOptions.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Heure d'entrée</label>
                  <input
                    type="time"
                    className={inputClass}
                    value={addFormData.checkIn}
                    onChange={e => setAddFormData({ ...addFormData, checkIn: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Heure de sortie</label>
                  <input
                    type="time"
                    className={inputClass}
                    value={addFormData.checkOut}
                    onChange={e => setAddFormData({ ...addFormData, checkOut: e.target.value })}
                  />
                </div>
              </div>

              {addFormData.checkIn && addFormData.checkOut && (
                <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-600">
                  Heures calculées : <span className="font-semibold text-slate-900">{formatHours(calcWorkedHours(addFormData.checkIn, addFormData.checkOut))}</span>
                  {addFormData.type === 'overtime' && (
                    <span className="ml-2 text-blue-600 font-medium">(Heures supplémentaires)</span>
                  )}
                  {addFormData.type === 'holiday' && (
                    <span className="ml-2 text-purple-600 font-medium">(Jour férié)</span>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Statut</label>
                <select
                  className={selectClass}
                  value={addFormData.status}
                  onChange={e => setAddFormData({ ...addFormData, status: e.target.value as AttendanceStatus })}
                >
                  <option value="Sorti">Sorti (Terminé)</option>
                  <option value="Présent">Présent</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-medium border-2 border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                  Annuler
                </button>
                <button type="submit" className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer">
                  <Save size={18} />
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Attendance Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Modifier le pointage</h3>
              <button onClick={() => { setIsEditModalOpen(false); setEditingEntry(null); }} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Heure d'entrée</label>
                  <input
                    type="time"
                    className={inputClass}
                    value={editFormData.checkIn}
                    onChange={e => setEditFormData({ ...editFormData, checkIn: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Heure de sortie</label>
                  <input
                    type="time"
                    className={inputClass}
                    value={editFormData.checkOut}
                    onChange={e => setEditFormData({ ...editFormData, checkOut: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Heures travaillées</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputClass}
                  value={editFormData.workedHours}
                  onChange={e => setEditFormData({ ...editFormData, workedHours: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Statut</label>
                <select
                  className={selectClass}
                  value={editFormData.status}
                  onChange={e => setEditFormData({ ...editFormData, status: e.target.value as AttendanceStatus })}
                >
                  <option value="En cours">En cours</option>
                  <option value="Sorti">Sorti</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Magasin</label>
                <select
                  className={selectClass}
                  value={editFormData.store}
                  onChange={e => setEditFormData({ ...editFormData, store: e.target.value })}
                >
                  {storeOptions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 border-2 border-red-200 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <Trash2 size={16} />
                  Supprimer
                </button>
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setIsEditModalOpen(false); setEditingEntry(null); }} className="px-4 py-2 text-sm font-medium border-2 border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                    Annuler
                  </button>
                  <button type="submit" className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer">
                    <Save size={18} />
                    Enregistrer
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Supprimer ce pointage ?</h3>
              <p className="text-sm text-slate-500 mb-6">Cette action est irréversible.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm font-medium border-2 border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                  Annuler
                </button>
                <button
                  className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 rounded-xl hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-600/25 transition-all cursor-pointer"
                  onClick={() => {
                    if (editingEntry) {
                      deleteAttendance(editingEntry.id);
                      setShowDeleteConfirm(false);
                      setIsEditModalOpen(false);
                      setEditingEntry(null);
                    }
                  }}
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
