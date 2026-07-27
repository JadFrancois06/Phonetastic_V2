import React, { useState } from 'react';
import { AdminLayout } from '../components/Layouts';
import { Badge, Button, Input, Modal, Select } from '../components/UI';
import { Calendar, Edit, Save, Plus, Clock, UserCheck, UserX, Timer, Coffee, LogOut, Store as StoreIcon } from 'lucide-react';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { AttendanceEntry, Status, AttendanceStatus } from '../types';
import { formatHours, getEffectiveHours, getTotalPauseMinutes, getGrossMinutes } from '../lib/utils';

export const AttendancePage = () => {
  const { users, attendance, updateAttendance, addAttendance, stores } = useStore();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AttendanceEntry | null>(null);
  const [editFormData, setEditFormData] = useState({
    checkIn: '',
    checkOut: '',
    workedHours: 0,
    status: 'En cours' as AttendanceStatus
  });
  const [addFormData, setAddFormData] = useState({
    userId: '',
    date: '',
    checkIn: '',
    checkOut: '',
    store: '',
    status: 'Sorti' as AttendanceStatus
  });

  const dailyAttendance = attendance.filter(a => a.date === date);
  const enCoursCount = dailyAttendance.filter(a => a.status === 'En cours').length;
  const enPauseCount = dailyAttendance.filter(a => a.status === 'En pause').length;
  const sortiCount = dailyAttendance.filter(a => a.status === 'Sorti').length;
  const absentCount = dailyAttendance.filter(a => a.status === 'Absent').length;
  const totalHours = dailyAttendance.reduce((acc, curr) => acc + getEffectiveHours(curr), 0);

  const calcWorkedHours = (checkIn: string, checkOut: string): number => {
    if (!checkIn || !checkOut) return 0;
    const [inH, inM] = checkIn.split(':').map(Number);
    const [outH, outM] = checkOut.split(':').map(Number);
    const diff = (outH * 60 + outM) - (inH * 60 + inM);
    return diff > 0 ? parseFloat((diff / 60).toFixed(2)) : 0;
  };

  const openAddModal = () => {
    setAddFormData({
      userId: users.filter(u => u.role === 'Employé' && u.status === 'Actif')[0]?.id || '',
      date: date,
      checkIn: '09:00',
      checkOut: '17:00',
      store: '',
      status: 'Sorti'
    });
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFormData.userId || !addFormData.date) return;
    const workedHours = calcWorkedHours(addFormData.checkIn, addFormData.checkOut);
    const selectedUser = users.find(u => u.id === addFormData.userId);
    addAttendance({
      userId: addFormData.userId,
      date: addFormData.date,
      checkIn: addFormData.checkIn || null,
      checkOut: addFormData.checkOut || null,
      workedHours,
      status: addFormData.status,
      store: addFormData.store || selectedUser?.stores[0] || ''
    });
    setIsAddModalOpen(false);
  };

  const openEditModal = (entry: AttendanceEntry) => {
    setEditingEntry(entry);
    setEditFormData({
      checkIn: entry.checkIn || '',
      checkOut: entry.checkOut || '',
      workedHours: entry.workedHours || 0,
      status: entry.status
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
        status: editFormData.status
      });
      setIsEditModalOpen(false);
      setEditingEntry(null);
    }
  };

  const statusConfig: Record<string, { dot: string; bg: string; text: string }> = {
    'En cours': { dot: 'bg-emerald-400', bg: 'bg-emerald-50 ring-1 ring-emerald-200/80', text: 'text-emerald-700' },
    'En pause': { dot: 'bg-amber-400', bg: 'bg-amber-50 ring-1 ring-amber-200/80', text: 'text-amber-700' },
    'Sorti': { dot: 'bg-slate-400', bg: 'bg-slate-50 ring-1 ring-slate-200/80', text: 'text-slate-600' },
    'Absent': { dot: 'bg-rose-400', bg: 'bg-rose-50 ring-1 ring-rose-200/80', text: 'text-rose-700' },
  };

  return (
    <AdminLayout title="Présence du jour">
      <div className="space-y-6">

        {/* ═══ Stats Row ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg shadow-emerald-500/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit"><UserCheck size={16} /></div>
              <p className="text-3xl font-black mt-3 tabular-nums">{enCoursCount}</p>
              <p className="text-emerald-100 text-xs font-medium mt-1">En poste</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 p-5 text-white shadow-lg shadow-amber-400/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit"><Coffee size={16} /></div>
              <p className="text-3xl font-black mt-3 tabular-nums">{enPauseCount}</p>
              <p className="text-amber-100 text-xs font-medium mt-1">En pause</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 p-5 text-white shadow-lg shadow-rose-500/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit"><UserX size={16} /></div>
              <p className="text-3xl font-black mt-3 tabular-nums">{absentCount}</p>
              <p className="text-rose-100 text-xs font-medium mt-1">Absents</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white shadow-lg shadow-blue-600/20">
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit"><Timer size={16} /></div>
              <p className="text-3xl font-black mt-3 tabular-nums">{formatHours(totalHours)}</p>
              <p className="text-blue-100 text-xs font-medium mt-1">Heures totales</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
          </div>
        </div>

        {/* ═══ Toolbar ═══ */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input 
                type="date" 
                className="rounded-xl border border-slate-200/80 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all"
            >
              <Plus size={16} />
              Ajouter un pointage
            </button>
          </div>
          <div className="flex items-center gap-4">
            {[
              { label: 'En cours', count: enCoursCount, color: 'bg-emerald-400' },
              { label: 'En pause', count: enPauseCount, color: 'bg-amber-400' },
              { label: 'Terminés', count: sortiCount, color: 'bg-slate-400' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <div className={cn("h-2 w-2 rounded-full", s.color)} />
                <span className="tabular-nums">{s.count}</span> {s.label}
              </div>
            ))}
          </div>
        </div>

        {/* ═══ Attendance Table ═══ */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-5 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employé</th>
                  <th className="px-4 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Magasin</th>
                  <th className="px-4 py-3.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Entrée</th>
                  <th className="px-4 py-3.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sortie</th>
                  <th className="px-4 py-3.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Brut</th>
                  <th className="px-4 py-3.5 text-center text-[10px] font-bold text-amber-400 uppercase tracking-wider">Pause</th>
                  <th className="px-4 py-3.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net</th>
                  <th className="px-4 py-3.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dailyAttendance.map((entry) => {
                  const user = users.find(u => u.id === entry.userId);
                  const sc = statusConfig[entry.status] || statusConfig['Sorti'];
                  return (
                    <tr key={entry.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                            {user?.fullName.charAt(0)}
                          </div>
                          <span className="text-sm font-bold text-slate-800">{user?.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 ring-1 ring-indigo-200/80 px-2 py-0.5 rounded-full">
                          <StoreIcon size={10} />
                          {(entry.store || user?.stores.join(', ') || '').replace('Phonetastic ', 'P')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-sm font-mono font-semibold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg">{entry.checkIn || '--:--'}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-sm font-mono font-semibold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg">{entry.checkOut || '--:--'}</span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-500 text-center tabular-nums">
                        {formatHours(getGrossMinutes(entry.checkIn, entry.checkOut || (entry.status !== 'Absent' ? new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null)) / 60)}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-center">
                        {(entry.pauses && entry.pauses.length > 0) ? (
                          <span className="text-amber-600 font-bold tabular-nums bg-amber-50 px-2 py-0.5 rounded-lg">{formatHours(getTotalPauseMinutes(entry.pauses) / 60)}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-sm font-black text-slate-800 tabular-nums">{formatHours(getEffectiveHours(entry))}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full", sc.bg, sc.text)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button 
                          onClick={() => openEditModal(entry)} 
                          title="Modifier"
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                        >
                          <Edit size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {dailyAttendance.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-3 rounded-2xl bg-slate-100"><Clock size={24} className="text-slate-400" /></div>
                        <p className="text-sm text-slate-400 font-medium">Aucun pointage enregistré pour cette date.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Footer */}
          <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium">{dailyAttendance.length} pointage{dailyAttendance.length > 1 ? 's' : ''} enregistré{dailyAttendance.length > 1 ? 's' : ''}</p>
            <p className="text-xs font-bold text-slate-600 tabular-nums">{formatHours(totalHours)} heures nettes</p>
          </div>
        </div>
      </div>

      {/* ═══ Edit Modal ═══ */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditingEntry(null); }}
        title="Modifier le pointage"
      >
        <form onSubmit={handleEditSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Heure d'entrée</label>
              <Input type="time" value={editFormData.checkIn} onChange={e => setEditFormData({...editFormData, checkIn: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Heure de sortie</label>
              <Input type="time" value={editFormData.checkOut} onChange={e => setEditFormData({...editFormData, checkOut: e.target.value})} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Heures travaillées</label>
            <Input type="number" step="0.01" value={editFormData.workedHours} onChange={e => setEditFormData({...editFormData, workedHours: Number(e.target.value)})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</label>
            <Select 
              options={[{ value: 'En cours', label: 'En cours' }, { value: 'Sorti', label: 'Sorti' }, { value: 'Absent', label: 'Absent' }]}
              value={editFormData.status}
              onChange={e => setEditFormData({...editFormData, status: e.target.value as AttendanceStatus})}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => { setIsEditModalOpen(false); setEditingEntry(null); }}>Annuler</Button>
            <Button type="submit" className="gap-2"><Save size={16} /> Enregistrer</Button>
          </div>
        </form>
      </Modal>

      {/* ═══ Add Modal ═══ */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Ajouter un pointage">
        <form onSubmit={handleAddSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employé</label>
            <Select
              options={users.filter(u => u.role === 'Employé' && u.status === 'Actif').map(u => ({ value: u.id, label: u.fullName }))}
              value={addFormData.userId}
              onChange={e => {
                const selectedUser = users.find(u => u.id === e.target.value);
                setAddFormData({ ...addFormData, userId: e.target.value, store: selectedUser?.stores[0] || '' });
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
              <Input type="date" value={addFormData.date} onChange={e => setAddFormData({ ...addFormData, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Magasin</label>
              <Select
                options={[
                  ...stores.map(s => ({ value: s.name, label: s.name })),
                  ...(users.find(u => u.id === addFormData.userId)?.stores || [])
                    .filter(s => !stores.some(st => st.name === s))
                    .map(s => ({ value: s, label: s }))
                ]}
                value={addFormData.store}
                onChange={e => setAddFormData({ ...addFormData, store: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Heure d'entrée</label>
              <Input type="time" value={addFormData.checkIn} onChange={e => setAddFormData({ ...addFormData, checkIn: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Heure de sortie</label>
              <Input type="time" value={addFormData.checkOut} onChange={e => setAddFormData({ ...addFormData, checkOut: e.target.value })} />
            </div>
          </div>
          {addFormData.checkIn && addFormData.checkOut && (
            <div className="p-3.5 bg-indigo-50/80 rounded-xl border border-indigo-100 text-sm text-indigo-700 flex items-center gap-2">
              <Timer size={14} />
              Heures calculées : <span className="font-black tabular-nums">{formatHours(calcWorkedHours(addFormData.checkIn, addFormData.checkOut))}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</label>
            <Select
              options={[{ value: 'Sorti', label: 'Sorti (Terminé)' }, { value: 'Présent', label: 'Présent' }, { value: 'Absent', label: 'Absent' }]}
              value={addFormData.status}
              onChange={e => setAddFormData({ ...addFormData, status: e.target.value as AttendanceStatus })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Annuler</Button>
            <Button type="submit" className="gap-2"><Save size={16} /> Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
};
