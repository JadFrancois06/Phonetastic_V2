import { useState, useEffect } from 'react';
import { User, AttendanceEntry, MonthlyReport, StoreLocation, Store, Phone, Brand, BrandSeries, SparePart, Sale } from './types';
import { MOCK_ATTENDANCE, MOCK_REPORTS } from './data/mockData';
import {
  fetchUsersFromDB,
  insertUserToDB,
  updateUserInDB,
  deleteUserFromDB,
  fetchAttendanceFromDB,
  insertAttendanceToDB,
  updateAttendanceInDB,
  deleteAttendanceFromDB,
  fetchInventoryFromDB,
  insertPhoneToDB,
  updatePhoneInDB,
  deletePhoneFromDB,
  fetchBrandsFromDB,
  insertBrandToDB,
  deleteBrandFromDB,
  fetchBrandSeriesFromDB,
  insertBrandSeriesToDB,
  updateBrandSeriesInDB,
  deleteBrandSeriesFromDB,
  fetchStoresFromDB,
  insertStoreToDB,
  updateStoreInDB,
  deleteStoreFromDB,
  setUserOnlineStatus,
  fetchSparePartsFromDB,
  insertSparePartToDB,
  updateSparePartInDB,
  deleteSparePartFromDB,
  fetchSalesFromDB,
  insertSaleToDB,
  clearAllSalesFromDB,
} from './lib/authService';

// Simple global state simulation using a custom hook pattern
let globalUsers: User[] = [];
let globalUsersLoaded = false;
let globalAttendance: AttendanceEntry[] = [];
let globalAttendanceLoaded = false;
let globalReports = [...MOCK_REPORTS];
let globalStores: StoreLocation[] = [];
let globalStoresLoaded = false;
let globalBrands: Brand[] = [];
let globalBrandsLoaded = false;
let globalBrandSeries: BrandSeries[] = [];
let globalBrandSeriesLoaded = false;
let globalInventory: Phone[] = [];
let globalInventoryLoaded = false;
let globalSpareParts: SparePart[] = [];
let globalSparePartsLoaded = false;
let globalSales: Sale[] = [];
let globalSalesLoaded = false;
let globalCurrentUser: User | null = null;

// Restore session on page reload
try {
  const saved = localStorage.getItem('phonetastic_user');
  if (saved) globalCurrentUser = JSON.parse(saved);
} catch {}

const listeners: (() => void)[] = [];

const notify = () => listeners.forEach(l => l());

export const useStore = () => {
  const [users, setUsers] = useState<User[]>(globalUsers);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>(globalAttendance);
  const [reports, setReports] = useState<MonthlyReport[]>(globalReports);
  const [stores, setStores] = useState<StoreLocation[]>(globalStores);
  const [brands, setBrands] = useState<Brand[]>(globalBrands);
  const [brandSeries, setBrandSeries] = useState<BrandSeries[]>(globalBrandSeries);
  const [inventory, setInventory] = useState<Phone[]>(globalInventory);
  const [spareParts, setSpareParts] = useState<SparePart[]>(globalSpareParts);
  const [sales, setSales] = useState<Sale[]>(globalSales);
  const [currentUser, setCurrentUser] = useState<User | null>(globalCurrentUser);

  useEffect(() => {
    // Load users from Supabase on first mount
    if (!globalUsersLoaded) {
      globalUsersLoaded = true;
      fetchUsersFromDB().then(users => {
        if (users.length > 0) {
          globalUsers = users;
          // If current user was deleted, force logout
          if (globalCurrentUser && !users.find(u => u.id === globalCurrentUser!.id)) {
            globalCurrentUser = null;
            try { localStorage.removeItem('phonetastic_user'); } catch {}
          }
          // Sync current user's data (permissions, stores, etc.) from fresh DB
          if (globalCurrentUser) {
            const fresh = users.find(u => u.id === globalCurrentUser!.id);
            if (fresh) {
              globalCurrentUser = { ...globalCurrentUser, ...fresh };
              try { localStorage.setItem('phonetastic_user', JSON.stringify(globalCurrentUser)); } catch {}
            }
          }
          notify();
        }
      });
    }
    // Load attendance from Supabase on first mount
    if (!globalAttendanceLoaded) {
      globalAttendanceLoaded = true;
      fetchAttendanceFromDB().then(entries => {
        globalAttendance = entries;
        notify();
      });
    }

    // Load inventory from Supabase on first mount
    if (!globalInventoryLoaded) {
      globalInventoryLoaded = true;
      fetchInventoryFromDB().then(phones => {
        globalInventory = phones;
        notify();
      });
    }
    // Load spare parts from Supabase on first mount
    if (!globalSparePartsLoaded) {
      globalSparePartsLoaded = true;
      fetchSparePartsFromDB().then(parts => {
        globalSpareParts = parts;
        notify();
      });
    }
    // Load brands from Supabase on first mount
    if (!globalBrandsLoaded) {
      globalBrandsLoaded = true;
      fetchBrandsFromDB().then(brands => {
        if (brands.length > 0) { globalBrands = brands; notify(); }
      });
    }
    // Load brand series from Supabase on first mount
    if (!globalBrandSeriesLoaded) {
      globalBrandSeriesLoaded = true;
      fetchBrandSeriesFromDB().then(series => {
        globalBrandSeries = series;
        notify();
      });
    }
    // Load stores from Supabase on first mount
    if (!globalStoresLoaded) {
      globalStoresLoaded = true;
      fetchStoresFromDB().then(stores => {
        if (stores.length > 0) { globalStores = stores; notify(); }
      });
    }
    // Load sales from Supabase on first mount
    if (!globalSalesLoaded) {
      globalSalesLoaded = true;
      fetchSalesFromDB().then(s => {
        globalSales = s;
        notify();
      });
    }

    const listener = () => {
      setUsers([...globalUsers]);
      setAttendance([...globalAttendance]);
      setReports([...globalReports]);
      setStores([...globalStores]);
      setBrands([...globalBrands]);
      setBrandSeries([...globalBrandSeries]);
      setInventory([...globalInventory]);
      setSpareParts([...globalSpareParts]);
      setSales([...globalSales]);
      setCurrentUser(globalCurrentUser);
    };
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  const setCurrentUserDirectly = (user: User | null) => {
    globalCurrentUser = user;
    try {
      if (user) localStorage.setItem('phonetastic_user', JSON.stringify(user));
      else localStorage.removeItem('phonetastic_user');
    } catch {}
    notify();
  };

  const logout = () => {
    if (globalCurrentUser) {
      setUserOnlineStatus(globalCurrentUser.id, false);
    }
    globalCurrentUser = null;
    try { localStorage.removeItem('phonetastic_user'); } catch {}
    notify();
  };

  const addUser = (user: Omit<User, 'id'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    const newUser = { ...user, id: tempId };
    globalUsers = [newUser, ...globalUsers];
    notify();
    insertUserToDB(user).then(realId => {
      if (realId) {
        globalUsers = globalUsers.map(u => u.id === tempId ? { ...u, id: realId } : u);
      } else {
        // Insert failed — remove temp user and reload from DB
        globalUsers = globalUsers.filter(u => u.id !== tempId);
        fetchUsersFromDB().then(users => {
          if (users.length > 0) globalUsers = users;
          notify();
        });
      }
      notify();
    });
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    globalUsers = globalUsers.map(u => u.id === id ? { ...u, ...updates } : u);
    if (globalCurrentUser?.id === id) {
      globalCurrentUser = { ...globalCurrentUser, ...updates };
    }
    notify();
    // Sync to Supabase in background
    updateUserInDB(id, updates);
  };

  const deleteUser = (id: string) => {
    globalUsers = globalUsers.filter(u => u.id !== id);
    globalAttendance = globalAttendance.filter(a => a.userId !== id);
    // Force logout if the deleted user is currently logged in
    if (globalCurrentUser?.id === id) {
      globalCurrentUser = null;
      try { localStorage.removeItem('phonetastic_user'); } catch {}
    }
    notify();
    // Delete from Supabase then reload to confirm
    deleteUserFromDB(id).then(() => {
      fetchUsersFromDB().then(users => {
        globalUsers = users;
        notify();
      });
    });
  };

  const addAttendance = (entry: Omit<AttendanceEntry, 'id'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    const newEntry = { ...entry, id: tempId };
    globalAttendance = [newEntry, ...globalAttendance];
    notify();
    insertAttendanceToDB(entry).then(realId => {
      if (realId) {
        globalAttendance = globalAttendance.map(a => a.id === tempId ? { ...a, id: realId } : a);
        notify();
      }
    });
  };

  const updateAttendance = (id: string, updates: Partial<AttendanceEntry>) => {
    globalAttendance = globalAttendance.map(a => a.id === id ? { ...a, ...updates } : a);
    notify();
    updateAttendanceInDB(id, updates);
  };

  const deleteAttendance = (id: string) => {
    globalAttendance = globalAttendance.filter(a => a.id !== id);
    notify();
    deleteAttendanceFromDB(id);
  };

  const setCurrentStore = (store: Store) => {
    if (globalCurrentUser) {
      globalCurrentUser = { ...globalCurrentUser, currentStore: store };
      notify();
    }
  };

  const addStore = (store: Omit<StoreLocation, 'id'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    globalStores = [...globalStores, { ...store, id: tempId }];
    notify();
    insertStoreToDB(store).then(realId => {
      if (realId) {
        globalStores = globalStores.map(s => s.id === tempId ? { ...s, id: realId } : s);
        notify();
      }
    });
  };

  const updateStore = (id: string, updates: Partial<StoreLocation>) => {
    globalStores = globalStores.map(s => s.id === id ? { ...s, ...updates } : s);
    notify();
    updateStoreInDB(id, updates);
  };

  const deleteStore = (id: string) => {
    globalStores = globalStores.filter(s => s.id !== id);
    notify();
    deleteStoreFromDB(id);
  };

  const addBrand = (name: string) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    globalBrands = [...globalBrands, { id: tempId, name }];
    notify();
    insertBrandToDB(name).then(realId => {
      if (realId) {
        globalBrands = globalBrands.map(b => b.id === tempId ? { ...b, id: realId } : b);
        notify();
      }
    });
  };

  const deleteBrand = (id: string) => {
    globalBrands = globalBrands.filter(b => b.id !== id);
    notify();
    deleteBrandFromDB(id);
  };

  const addBrandSeries = (brandName: string, seriesName: string) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    globalBrandSeries = [...globalBrandSeries, { id: tempId, brandName, seriesName }];
    notify();
    insertBrandSeriesToDB(brandName, seriesName).then(realId => {
      if (realId) {
        globalBrandSeries = globalBrandSeries.map(bs => bs.id === tempId ? { ...bs, id: realId } : bs);
        notify();
      }
    });
  };

  const updateBrandSeries = (id: string, seriesName: string) => {
    globalBrandSeries = globalBrandSeries.map(bs => bs.id === id ? { ...bs, seriesName } : bs);
    notify();
    updateBrandSeriesInDB(id, seriesName);
  };

  const deleteBrandSeriesItem = (id: string) => {
    globalBrandSeries = globalBrandSeries.filter(bs => bs.id !== id);
    notify();
    deleteBrandSeriesFromDB(id);
  };

  const addPhone = (phone: Omit<Phone, 'id'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    globalInventory = [{ ...phone, id: tempId }, ...globalInventory];
    notify();
    insertPhoneToDB(phone).then(realId => {
      if (realId) {
        globalInventory = globalInventory.map(p => p.id === tempId ? { ...p, id: realId } : p);
        notify();
      } else {
        globalInventory = globalInventory.filter(p => p.id !== tempId);
        fetchInventoryFromDB().then(phones => { globalInventory = phones; notify(); });
      }
    });
  };

  const updatePhone = (id: string, updates: Partial<Phone>) => {
    globalInventory = globalInventory.map(p => p.id === id ? { ...p, ...updates } : p);
    notify();
    updatePhoneInDB(id, updates);
  };

  const deletePhone = (id: string) => {
    globalInventory = globalInventory.filter(p => p.id !== id);
    notify();
    deletePhoneFromDB(id);
  };

  const sellPhone = (id: string) => {
    const phone = globalInventory.find(p => p.id === id);
    if (!phone || phone.quantity <= 0) return;
    const newQty = phone.quantity - 1;

    let updatedColors = phone.colors ? [...phone.colors] : undefined;
    if (updatedColors && updatedColors.length > 0) {
      const firstAvailableIdx = updatedColors.findIndex(c => c.qty > 0);
      if (firstAvailableIdx >= 0) {
        updatedColors = updatedColors.map((c, i) =>
          i === firstAvailableIdx ? { ...c, qty: Math.max(0, c.qty - 1) } : c
        );
      }
    }

    globalInventory = globalInventory.map(p => p.id === id ? { ...p, quantity: newQty, colors: updatedColors } : p);
    notify();
    updatePhoneInDB(id, { quantity: newQty, colors: updatedColors });
  };

  const addSparePart = (part: Omit<SparePart, 'id'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    globalSpareParts = [{ ...part, id: tempId }, ...globalSpareParts];
    notify();
    insertSparePartToDB(part).then(realId => {
      if (realId) {
        globalSpareParts = globalSpareParts.map(p => p.id === tempId ? { ...p, id: realId } : p);
        notify();
      } else {
        globalSpareParts = globalSpareParts.filter(p => p.id !== tempId);
        fetchSparePartsFromDB().then(parts => { globalSpareParts = parts; notify(); });
      }
    });
  };

  const updateSparePart = (id: string, updates: Partial<SparePart>) => {
    globalSpareParts = globalSpareParts.map(p => p.id === id ? { ...p, ...updates } : p);
    notify();
    updateSparePartInDB(id, updates).then(success => {
      if (!success) {
        // DB write failed — rollback by re-fetching from DB
        fetchSparePartsFromDB().then(parts => { globalSpareParts = parts; notify(); });
      }
    });
  };

  const deleteSparePart = (id: string) => {
    globalSpareParts = globalSpareParts.filter(p => p.id !== id);
    notify();
    deleteSparePartFromDB(id);
  };

  const addSale = (sale: Omit<Sale, 'id'>) => {
    const tempId = Math.random().toString(36).substr(2, 9);
    const newSale = { ...sale, id: tempId };
    globalSales = [newSale, ...globalSales];
    notify();
    insertSaleToDB(sale).then(realId => {
      if (realId) {
        globalSales = globalSales.map(s => s.id === tempId ? { ...s, id: realId } : s);
        notify();
      }
    });
  };

  const clearSales = async () => {
    const ok = await clearAllSalesFromDB();
    if (ok) {
      globalSales = [];
      globalSalesLoaded = true;
      notify();
    }
    return ok;
  };

  const setUserOnline = (userId: string, online: boolean) => {
    globalUsers = globalUsers.map(u => u.id === userId ? { ...u, online } : u);
    notify();
    setUserOnlineStatus(userId, online);
  };

  return {
    users,
    attendance,
    reports,
    stores,
    brands,
    brandSeries,
    inventory,
    spareParts,
    sales,
    currentUser,
    setCurrentUserDirectly,
    logout,
    addUser,
    updateUser,
    deleteUser,
    addAttendance,
    updateAttendance,
    deleteAttendance,
    setCurrentStore,
    addStore,
    updateStore,
    deleteStore,
    addBrand,
    deleteBrand,
    addBrandSeries,
    updateBrandSeries,
    deleteBrandSeriesItem,
    addPhone,
    updatePhone,
    deletePhone,
    sellPhone,
    addSparePart,
    updateSparePart,
    deleteSparePart,
    addSale,
    clearSales,
    setUserOnline
  };
};
