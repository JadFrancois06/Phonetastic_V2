import React, { useState, useEffect } from 'react';
import { EmployeeLayout } from '../components/Layouts';
import { Timer, MapPin, CheckCircle2, AlertCircle, Coffee, Play, Clock, LogIn, LogOut } from 'lucide-react';
import { useStore } from '../store';
import { AttendanceStatus } from '../types';
import { cn, formatHours, getEffectiveHours, getTotalPauseMinutes, getGrossMinutes } from '../lib/utils';

export const PointagePage = () => {
  const { currentUser, attendance, addAttendance, updateAttendance, setUserOnline } = useStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const todayStr = new Date().toISOString().split('T')[0];
  const todayEntries = currentUser ? attendance.filter(a => a.userId === currentUser.id && a.date === todayStr) : [];
  const activeEntry = todayEntries.find(a => a.status === 'En cours' || a.status === 'En pause') || null;
  const todayEntry = activeEntry ?? (todayEntries.length > 0 ? todayEntries[todayEntries.length - 1] : null);
  const isPaused = activeEntry?.status === 'En pause';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCheckIn = () => {
    if (!currentUser) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    addAttendance({
      userId: currentUser.id,
      date: todayStr,
      checkIn: timeStr,
      checkOut: null,
      workedHours: 0,
      status: 'En cours',
      store: currentUser.currentStore
    });
    setUserOnline(currentUser.id, true);
  };

  const handleCheckOut = () => {
    if (!activeEntry) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let finalPauses = activeEntry.pauses ? [...activeEntry.pauses] : [];
    if (finalPauses.length > 0 && finalPauses[finalPauses.length - 1].end === null) {
      finalPauses[finalPauses.length - 1] = { ...finalPauses[finalPauses.length - 1], end: timeStr };
    }

    const pauseMin = getTotalPauseMinutes(finalPauses);
    const grossMin = getGrossMinutes(activeEntry.checkIn, timeStr);
    const netMin = Math.max(0, grossMin - pauseMin);
    const hours = parseFloat((netMin / 60).toFixed(2));

    updateAttendance(activeEntry.id, {
      checkOut: timeStr,
      workedHours: hours,
      status: 'Sorti',
      pauses: finalPauses,
      pauseMinutes: pauseMin,
    });
    setUserOnline(currentUser!.id, false);
  };

  const handlePause = () => {
    if (!activeEntry || activeEntry.status !== 'En cours') return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const newPauses = [...(activeEntry.pauses || []), { start: timeStr, end: null }];
    updateAttendance(activeEntry.id, { status: 'En pause', pauses: newPauses });
  };

  const handleResume = () => {
    if (!activeEntry || activeEntry.status !== 'En pause') return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const pauses = [...(activeEntry.pauses || [])];
    if (pauses.length > 0 && pauses[pauses.length - 1].end === null) {
      pauses[pauses.length - 1] = { ...pauses[pauses.length - 1], end: timeStr };
    }
    updateAttendance(activeEntry.id, { status: 'En cours', pauses });
  };

  const formatTimeStr = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const currentStatus = activeEntry ? activeEntry.status : (todayEntry?.status || 'Absent');
  const pauseMinutesLive = getTotalPauseMinutes(todayEntry?.pauses);
  const grossMinutesLive = (todayEntry?.checkIn && !todayEntry?.checkOut)
    ? getGrossMinutes(todayEntry.checkIn, currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    : getGrossMinutes(todayEntry?.checkIn ?? null, todayEntry?.checkOut ?? null);
  const netHoursLive = getEffectiveHours(todayEntry ? { ...todayEntry } : { checkIn: null, checkOut: null, workedHours: 0, status: 'Absent' });

  if (!currentUser) {
    return <EmployeeLayout title="Pointage"><div /></EmployeeLayout>;
  }

  const statusConfig = {
    'En cours': { label: 'En cours', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    'En pause': { label: 'En pause', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    'Sorti': { label: 'Journée terminée', color: 'bg-slate-100 text-slate-600 border-slate-200' },
    'Absent': { label: 'Non commencé', color: 'bg-red-50 text-red-600 border-red-200' },
  };
  const statusInfo = statusConfig[currentStatus as keyof typeof statusConfig] || statusConfig['Absent'];

  return (
    <EmployeeLayout title="Pointage">
      <div className="max-w-6xl h-full mx-auto mt-18 space-y-10 pt-10">

        {/* ─── Clock + Date ─── */}
        <div className="text-center space-y-5 bg-white rounded-2xl border border-slate-200 shadow-sm py-8">
          <h1 className="text-7xl font-bold text-slate-900 tracking-tight font-mono">{formatTimeStr(currentTime)}</h1>
          <p className="text-2xl text-slate-600 font-bold capitalize">{formatDate(currentTime)}</p>
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 pt-1">
            <MapPin size={28} color='red'/>
            <span className='text-xl text-indigo-500 font-bold'>{currentUser?.currentStore}</span>
          </div>
        </div>

        {/* ─── Main Card ─── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Status bar */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-10 w-10 rounded-xl flex items-center justify-center',
                isPaused ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white' : 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white'
              )}>
                {isPaused ? <Coffee size={18} /> : <Timer size={18} />}
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {isPaused ? 'Pause en cours' : currentStatus === 'En cours' ? 'Journée en cours' : currentStatus === 'Sorti' ? 'Journée terminée' : 'Pointage du jour'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isPaused && activeEntry?.pauses?.at(-1)?.start
                    ? `Depuis ${activeEntry.pauses.at(-1)?.start} — ${formatHours(pauseMinutesLive / 60)}`
                    : `Vous êtes à ${currentUser?.currentStore}`
                  }
                </p>
              </div>
            </div>
            <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border', statusInfo.color)}>
              {statusInfo.label}
            </span>
          </div>

          {/* Action buttons */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button 
                disabled={currentStatus === 'En cours' || currentStatus === 'En pause'}
                onClick={handleCheckIn}
                className={cn(
                  'flex items-center justify-center gap-2.5 h-14 rounded-xl font-bold text-sm transition-all',
                  currentStatus === 'En cours' || currentStatus === 'En pause'
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40'
                )}
              >
                <LogIn size={18} />
                Pointer l'entrée
              </button>
              <button 
                disabled={currentStatus !== 'En cours' && currentStatus !== 'En pause'}
                onClick={handleCheckOut}
                className={cn(
                  'flex items-center justify-center gap-2.5 h-14 rounded-xl font-bold text-sm transition-all border-2',
                  currentStatus === 'En cours' || currentStatus === 'En pause'
                    ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
                    : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                <LogOut size={18} />
                Pointer la sortie
              </button>
            </div>

            {/* Pause / Resume */}
            {(currentStatus === 'En cours' || currentStatus === 'En pause') && (
              <div className="text-center">
                {isPaused ? (
                  <button
                    onClick={handleResume}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-bold shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-all"
                  >
                    <Play size={16} />
                    Reprendre le travail
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-white text-sm font-bold shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all"
                  >
                    <Coffee size={16} />
                    Prendre une pause
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Time stats */}
          <div className="px-6 py-4 border-t border-slate-100 grid grid-cols-3 gap-4">
            <div className="text-center space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Entrée</p>
              <p className="text-lg font-bold text-slate-900">{todayEntry?.checkIn || '--:--'}</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sortie</p>
              <p className="text-lg font-bold text-slate-900">{todayEntry?.checkOut || '--:--'}</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Net</p>
              <p className="text-lg font-bold text-indigo-700">{formatHours(netHoursLive)}</p>
            </div>
          </div>

          {/* Pause details */}
          {(pauseMinutesLive > 0 || (todayEntry?.pauses && todayEntry.pauses.length > 0)) && (
            <div className="px-6 py-4 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Brut (sans pause)</p>
                  <p className="text-base font-bold text-slate-600">{formatHours(grossMinutesLive / 60)}</p>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Total pause</p>
                  <p className="text-base font-bold text-amber-600">{formatHours(pauseMinutesLive / 60)}</p>
                </div>
              </div>
              {todayEntry?.pauses && todayEntry.pauses.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Détail des pauses</p>
                  <div className="flex flex-wrap gap-2">
                    {todayEntry.pauses.map((p, i) => (
                      <span key={i} className="text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-lg">
                        {p.start} → {p.end || '…'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Success notification */}
        {todayEntry?.checkIn && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-800">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 size={16} className="text-emerald-600" />
            </div>
            <p className="text-sm font-semibold">Pointage enregistré avec succès à {todayEntry.checkIn}</p>
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
};
