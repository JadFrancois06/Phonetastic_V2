import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatHours(decimalHours: number): string {
  if (!decimalHours || isNaN(decimalHours)) return '0h 00m';
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

/** Calculates total pause duration in minutes from a pauses array (completed + ongoing). */
export function getTotalPauseMinutes(pauses?: { start: string; end: string | null }[]): number {
  if (!pauses || pauses.length === 0) return 0;
  const now = new Date();
  return pauses.reduce((total, p) => {
    const parts = p.start.split(':').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return total;
    const [sH, sM] = parts;
    let endH: number, endM: number;
    if (p.end) {
      const eParts = p.end.split(':').map(Number);
      [endH, endM] = eParts;
    } else {
      endH = now.getHours();
      endM = now.getMinutes();
    }
    const diff = (endH * 60 + endM) - (sH * 60 + sM);
    return total + Math.max(0, diff);
  }, 0);
}

/** Total gross minutes from checkIn to checkOut (no pause deduction). */
export function getGrossMinutes(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);
  return Math.max(0, (outH * 60 + outM) - (inH * 60 + inM));
}

/** Returns true if the entry qualifies for a meal. If explicitly set, uses that value; otherwise auto-detects >=8h. */
export function hasMeal(entry: { meal?: boolean; checkIn: string | null; checkOut: string | null; workedHours: number; status: string; pauses?: { start: string; end: string | null }[] }): boolean {
  if (entry.meal !== undefined) return entry.meal;
  return getEffectiveHours(entry) >= 8;
}

/**
 * Returns the net worked hours for an entry (pauses excluded).
 * For active entries (En cours / En pause), calculates elapsed time from checkIn to now minus all pauses.
 * For completed entries, returns stored workedHours.
 */
export function getEffectiveHours(entry: { checkIn: string | null; checkOut: string | null; workedHours: number; status: string; pauses?: { start: string; end: string | null }[] }): number {
  if ((entry.status === 'En cours' || entry.status === 'En pause') && entry.checkIn && !entry.checkOut) {
    const [inH, inM] = entry.checkIn.split(':').map(Number);
    if (isNaN(inH) || isNaN(inM)) return entry.workedHours || 0;
    const now = new Date();
    const totalMin = (now.getHours() * 60 + now.getMinutes()) - (inH * 60 + inM);
    const pauseMin = getTotalPauseMinutes(entry.pauses);
    return totalMin > 0 ? parseFloat(((totalMin - pauseMin) / 60).toFixed(2)) : 0;
  }
  return entry.workedHours || 0;
}
