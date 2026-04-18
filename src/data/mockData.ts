import { User, AttendanceEntry, MonthlyReport } from '../types';

export const MOCK_USERS: User[] = [
  {
    id: '1',
    fullName: 'Jean Dupont',
    username: 'admin',
    password: 'admin',
    role: 'Administrateur',
    stores: ['Phonetastic 1', 'Phonetastic 2'],
    hourlyRate: 25,
    mealRate: 5,
    status: 'Actif',
    avatar: 'https://i.pravatar.cc/150?u=1'
  },
  {
    id: '2',
    fullName: 'Marie Curie',
    username: 'employe',
    password: 'employe',
    role: 'Employé',
    stores: ['Phonetastic 1', 'Phonetastic 2'],
    hourlyRate: 18,
    mealRate: 5,
    status: 'Actif',
    avatar: 'https://i.pravatar.cc/150?u=2'
  },
  {
    id: '3',
    fullName: 'Pierre Gasly',
    username: 'pgasly',
    password: 'password123',
    role: 'Employé',
    stores: ['Phonetastic 2'],
    hourlyRate: 17,
    mealRate: 5,
    status: 'Actif',
    avatar: 'https://i.pravatar.cc/150?u=3'
  },
  {
    id: '4',
    fullName: 'Esteban Ocon',
    username: 'eocon',
    password: 'password123',
    role: 'Employé',
    stores: ['Phonetastic 1'],
    hourlyRate: 17.5,
    mealRate: 5,
    status: 'Actif',
    avatar: 'https://i.pravatar.cc/150?u=4'
  },
  {
    id: '5',
    fullName: 'Charles Leclerc',
    username: 'cleclerc',
    password: 'password123',
    role: 'Employé',
    stores: ['Phonetastic 2'],
    hourlyRate: 19,
    mealRate: 5,
    status: 'Inactif',
    avatar: 'https://i.pravatar.cc/150?u=5'
  }
];

export const MOCK_ATTENDANCE: AttendanceEntry[] = [
  {
    id: '101',
    userId: '2',
    date: '2026-03-24',
    checkIn: '09:00',
    checkOut: null,
    workedHours: 0,
    status: 'En cours',
    store: 'Phonetastic 1'
  },
  {
    id: '102',
    userId: '3',
    date: '2026-03-24',
    checkIn: '08:30',
    checkOut: '17:30',
    workedHours: 9,
    status: 'Sorti',
    store: 'Phonetastic 2'
  },
  {
    id: '103',
    userId: '4',
    date: '2026-03-24',
    checkIn: null,
    checkOut: null,
    workedHours: 0,
    status: 'Absent'
  },
  {
    id: '104',
    userId: '2',
    date: '2026-03-23',
    checkIn: '09:00',
    checkOut: '18:00',
    workedHours: 9,
    status: 'Sorti',
    store: 'Phonetastic 1'
  },
  {
    id: '105',
    userId: '3',
    date: '2026-03-23',
    checkIn: '08:45',
    checkOut: '17:45',
    workedHours: 9,
    status: 'Sorti',
    store: 'Phonetastic 2'
  }
];

export const MOCK_REPORTS: MonthlyReport[] = [
  {
    userId: '2',
    fullName: 'Marie Curie',
    stores: ['Phonetastic 1', 'Phonetastic 2'],
    totalHours: 160,
    hourlyRate: 18,
    totalAmount: 2880
  },
  {
    userId: '3',
    fullName: 'Pierre Gasly',
    stores: ['Phonetastic 2'],
    totalHours: 152,
    hourlyRate: 17,
    totalAmount: 2584
  },
  {
    userId: '4',
    fullName: 'Esteban Ocon',
    stores: ['Phonetastic 1'],
    totalHours: 140,
    hourlyRate: 17.5,
    totalAmount: 2450
  }
];

