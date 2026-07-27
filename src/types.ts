export type Role = 'Administrateur' | 'Employé' | 'Stock';
export type Status = 'Actif' | 'Inactif';
export type AttendanceStatus = 'Présent' | 'Absent' | 'En cours' | 'Sorti' | 'En pause';

export interface PauseInterval {
  start: string; // "HH:MM"
  end: string | null; // null = pause en cours
}
export type Store = string;

export interface StoreLocation {
  id: string;
  name: string;
  location: string;
}

export interface UserPermissions {
  canAccessInventory: boolean;
  canAccessSpareParts: boolean;
}

export interface User {
  id: string;
  fullName: string;
  username: string;
  password?: string;
  role: Role;
  stores: Store[];
  currentStore?: Store;
  hourlyRate: number;
  mealRate: number;
  status: Status;
  avatar?: string;
  online?: boolean;
  permissions?: UserPermissions;
}

export interface AttendanceEntry {
  id: string;
  userId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workedHours: number;
  status: AttendanceStatus;
  store?: Store;
  meal?: boolean;
  pauses?: PauseInterval[];
  pauseMinutes?: number;
}

export interface MonthlyReport {
  userId: string;
  fullName: string;
  stores: Store[];
  totalHours: number;
  hourlyRate: number;
  totalAmount: number;
}

export type PhoneCondition = 'Neuf' | 'Occasion';

export interface Brand {
  id: string;
  name: string;
}

export const PHONE_COLORS = [
  '#000000', // Noir
  '#FFFFFF', // Blanc
  '#C0C0C0', // Argent
  '#FFD700', // Or
  '#1E90FF', // Bleu
  '#DC143C', // Rouge
  '#2E8B57', // Vert
  '#9370DB', // Violet
  '#FF69B4', // Rose
  '#FF8C00', // Orange
] as const;

export interface PhoneColor {
  color: string;
  qty: number;
  // Per-unit details
  reference?: string;
  ram?: string;
  storage?: string;
  condition?: PhoneCondition;
  price?: number;
  batteryHealth?: string;
  screenCondition?: string;
  frameCondition?: string;
  notes?: string;
}

export interface Phone {
  id: string;
  brand: string;
  model: string;
  ram: string;
  storage: string;
  price: number;
  quantity: number;
  condition: PhoneCondition;
  store: Store;
  colors?: PhoneColor[];
}

export interface SparePartQuality {
  quality: string;
  qty: number;
  price?: number;
  reference?: string;
}

export interface SparePart {
  id: string;
  name: string;
  category: string;
  compatibleBrand: string;
  deviceType: string;
  series: string;
  compatibleModel: string;
  price: number;
  quantity: number;
  condition: PhoneCondition;
  store: Store;
  qualities?: SparePartQuality[];
}

export const DEVICE_TYPES = [
  'Téléphone',
  'Tablette',
  'Laptop',
  'Montre connectée',
  'Accessoire',
] as const;

export interface BrandSeries {
  id: string;
  brandName: string;
  seriesName: string;
}

export const SPARE_PART_QUALITIES = [
  'Original',
  'Compatible',
  'OEM',
  'Aftermarket',
  'Reconditionné',
] as const;

export const SPARE_PART_CATEGORIES = [
  'Écran',
  'Batterie',
  'Connecteur de charge',
  'Caméra arrière',
  'Caméra avant',
  'Haut-parleur',
  'Écouteur',
  'Nappe bouton',
  'Vitre arrière',
  'Châssis',
  'Carte mère',
  'Autre',
] as const;

export interface Sale {
  id: string;
  phoneBrand: string;
  phoneModel: string;
  phoneRam: string;
  phoneStorage: string;
  phoneCondition: PhoneCondition;
  color: string;
  reference?: string;
  price: number;
  store: Store;
  soldBy: string;
  soldByName: string;
  soldAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  createdAt: string;
}
