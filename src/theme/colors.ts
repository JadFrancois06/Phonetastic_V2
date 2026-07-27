/**
 * Phonetastic Design System — Unified Color Tokens
 * =================================================
 * Single source of truth for every color used in the app.
 * Import `theme` (or individual groups) in any page / component
 * and use with the `cn()` helper for Tailwind class merging.
 *
 * Usage:
 *   import { theme } from '@/src/theme/colors';
 *   <div className={cn(theme.card.base, 'p-6')}>…</div>
 */

// ─── Raw palette (Tailwind class fragments) ─────────────────────────
// Change a value here → it changes everywhere.

const palette = {
  // Brand
  primary:    'indigo',
  // Neutrals
  neutral:    'slate',
  // Semantic
  success:    'emerald',
  warning:    'amber',
  danger:     'rose',
  info:       'blue',
} as const;

// ─── Backgrounds ────────────────────────────────────────────────────

export const backgrounds = {
  /** Full-page / layout wrapper */
  page:       'bg-slate-100',
  /** Sidebar background */
  sidebar:    'bg-slate-900',
  /** Top header bar */
  header:     'bg-white/80 backdrop-blur-sm',
  /** Modal overlay */
  overlay:    'bg-slate-900/50',
} as const;

// ─── Cards ──────────────────────────────────────────────────────────

export const card = {
  /** Default card container */
  base:       'bg-white border border-slate-200/80 rounded-2xl shadow-sm',
  /** Subtle hover lift */
  hover:      'hover:shadow-md hover:border-slate-300 transition-all duration-200',
  /** Card used inside a card (nested) */
  nested:     'bg-slate-50/60 border border-slate-200/60 rounded-xl',
  /** Accent left-border card variants */
  accentPrimary:  'border-l-4 border-l-indigo-500',
  accentSuccess:  'border-l-4 border-l-emerald-500',
  accentWarning:  'border-l-4 border-l-amber-500',
  accentDanger:   'border-l-4 border-l-rose-500',
  accentInfo:     'border-l-4 border-l-blue-500',
} as const;

// ─── Stat / Metric Cards ────────────────────────────────────────────

export const statCard = {
  primary: {
    bg:     'bg-indigo-50/70 border border-indigo-100',
    icon:   'bg-indigo-100 text-indigo-600',
    value:  'text-indigo-700',
    label:  'text-indigo-600/80',
  },
  success: {
    bg:     'bg-emerald-50/70 border border-emerald-100',
    icon:   'bg-emerald-100 text-emerald-600',
    value:  'text-emerald-700',
    label:  'text-emerald-600/80',
  },
  warning: {
    bg:     'bg-amber-50/70 border border-amber-100',
    icon:   'bg-amber-100 text-amber-600',
    value:  'text-amber-700',
    label:  'text-amber-600/80',
  },
  danger: {
    bg:     'bg-rose-50/70 border border-rose-100',
    icon:   'bg-rose-100 text-rose-600',
    value:  'text-rose-700',
    label:  'text-rose-600/80',
  },
  info: {
    bg:     'bg-blue-50/70 border border-blue-100',
    icon:   'bg-blue-100 text-blue-600',
    value:  'text-blue-700',
    label:  'text-blue-600/80',
  },
  neutral: {
    bg:     'bg-slate-50/70 border border-slate-200',
    icon:   'bg-slate-100 text-slate-600',
    value:  'text-slate-800',
    label:  'text-slate-500',
  },
} as const;

// ─── Typography ─────────────────────────────────────────────────────

export const text = {
  /** Page main title */
  pageTitle:    'text-2xl font-bold text-slate-900 tracking-tight',
  /** Page subtitle / description */
  pageSubtitle: 'text-sm text-slate-500',
  /** Section heading inside a page */
  sectionTitle: 'text-lg font-bold text-slate-800',
  /** Card title */
  cardTitle:    'text-base font-bold text-slate-800',
  /** Card small title */
  cardSubtitle: 'text-sm font-semibold text-slate-700',
  /** Normal body */
  body:         'text-sm text-slate-600',
  /** Muted / secondary */
  muted:        'text-xs text-slate-400',
  /** Labels for form elements / stat cards */
  label:        'text-xs font-medium text-slate-500 uppercase tracking-wide',
  /** Large metric / KPI number */
  metric:       'text-3xl font-extrabold text-slate-900 tabular-nums',
  /** Small metric (secondary numbers) */
  metricSm:     'text-xl font-bold text-slate-800 tabular-nums',
} as const;

// ─── Buttons ────────────────────────────────────────────────────────

const btnBase = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed';

export const button = {
  /** Primary filled button */
  primary:   `${btnBase} bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm`,
  /** Secondary outline button */
  secondary: `${btnBase} bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100`,
  /** Ghost / text button */
  ghost:     `${btnBase} text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200`,
  /** Danger / destructive */
  danger:    `${btnBase} bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm`,
  /** Success */
  success:   `${btnBase} bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm`,
  /** Dark / sidebar-style */
  dark:      `${btnBase} bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-700 shadow-sm`,

  /** Size variants (combine with above) */
  sm:  'px-3 py-1.5 text-xs',
  md:  'px-4 py-2 text-sm',
  lg:  'px-6 py-2.5 text-sm',
  xl:  'px-8 py-3 text-base',

  /** Icon-only button */
  icon: `${btnBase} p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg`,
} as const;

// ─── Badges / Status chips ──────────────────────────────────────────

export const badge = {
  base:     'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
  primary:  'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  success:  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  warning:  'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  danger:   'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  info:     'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  neutral:  'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
} as const;

// ─── Tables ─────────────────────────────────────────────────────────

export const table = {
  wrapper:    'overflow-x-auto rounded-xl border border-slate-200/80',
  table:      'w-full text-sm',
  head:       'bg-slate-50/80',
  headCell:   'px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider',
  body:       'divide-y divide-slate-100 bg-white',
  row:        'hover:bg-slate-50/60 transition-colors',
  cell:       'px-4 py-3 text-slate-700',
  cellMuted:  'px-4 py-3 text-slate-400',
} as const;

// ─── Form Inputs ────────────────────────────────────────────────────

export const input = {
  base:       'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all duration-200',
  label:      'block text-sm font-medium text-slate-700 mb-1.5',
  helper:     'text-xs text-slate-400 mt-1',
  error:      'text-xs text-rose-500 mt-1',
  select:     'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all duration-200 appearance-none',
  checkbox:   'h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500',
  textarea:   'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all duration-200 resize-none',
} as const;

// ─── Sidebar / Navigation ───────────────────────────────────────────

export const nav = {
  sidebar:        'bg-slate-900 text-slate-300',
  sidebarItem:    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200',
  sidebarActive:  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 text-white shadow-sm',
  sidebarLabel:   'text-[10px] uppercase tracking-widest text-slate-500 font-semibold px-3 mb-1 mt-4',
  headerLink:     'text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors',
  headerActive:   'text-sm font-medium text-indigo-600',
} as const;

// ─── Modals / Dialogs ───────────────────────────────────────────────

export const modal = {
  overlay:    'fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm',
  container:  'bg-white rounded-2xl shadow-2xl border border-slate-200/60',
  header:     'px-6 py-4 border-b border-slate-100',
  body:       'px-6 py-5',
  footer:     'px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl',
  title:      'text-lg font-bold text-slate-900',
} as const;

// ─── Dividers ───────────────────────────────────────────────────────

export const divider = {
  light:    'border-t border-slate-100',
  default:  'border-t border-slate-200',
  strong:   'border-t border-slate-300',
} as const;

// ─── Avatar ─────────────────────────────────────────────────────────

export const avatar = {
  base:     'inline-flex items-center justify-center rounded-full font-semibold',
  sm:       'h-8 w-8 text-xs',
  md:       'h-10 w-10 text-sm',
  lg:       'h-12 w-12 text-base',
  xl:       'h-16 w-16 text-lg',
  colors:   'bg-indigo-100 text-indigo-700',
} as const;

// ─── Shadows ────────────────────────────────────────────────────────

export const shadow = {
  sm:   'shadow-sm',
  md:   'shadow-md',
  lg:   'shadow-lg',
  xl:   'shadow-xl',
} as const;

// ─── Full theme export ──────────────────────────────────────────────

export const theme = {
  backgrounds,
  card,
  statCard,
  text,
  button,
  badge,
  table,
  input,
  nav,
  modal,
  divider,
  avatar,
  shadow,
} as const;

export default theme;
