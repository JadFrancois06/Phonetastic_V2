import { supabase } from './supabase';
import { User, Role, Status } from '../types';

// Login: RPC call — queries users table server-side (no Supabase Auth needed)
export async function loginWithCredentials(username: string, password: string): Promise<User | null> {
  const { data, error } = await supabase.rpc('login_user', {
    p_username: username,
    p_password: password,
  });

  if (error || !data || data.length === 0) return null;

  const row = data[0];
  const stores: string[] = row.stores ?? [];

  return {
    id: row.user_id,
    fullName: row.full_name,
    username: row.username,
    role: row.role as Role,
    hourlyRate: Number(row.hourly_rate),
    mealRate: Number(row.meal_rate ?? 0),
    status: row.status as Status,
    avatar: row.avatar ?? undefined,
    stores,
    currentStore: stores[0],
    permissions: row.permissions ?? { canAccessInventory: false, canAccessSpareParts: false },
  };
}

// Fetch all users for admin (no password column returned)
export async function fetchUsersFromDB(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, username, role, hourly_rate, meal_rate, status, avatar, online, permissions, user_stores(stores(name))')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((u: any) => ({
    id: u.id,
    fullName: u.full_name,
    username: u.username,
    role: u.role as Role,
    hourlyRate: Number(u.hourly_rate),
    mealRate: Number(u.meal_rate ?? 0),
    status: u.status as Status,
    avatar: u.avatar ?? undefined,
    online: u.online ?? false,
    stores: u.user_stores?.map((us: any) => us.stores?.name).filter(Boolean) ?? [],
    permissions: u.permissions ?? { canAccessInventory: false, canAccessSpareParts: false },
  }));
}

// Insert new user + link to stores — returns the real UUID from Supabase
export async function insertUserToDB(user: Omit<User, 'id'> & { password?: string }): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .insert({
      full_name: user.fullName,
      username: user.username,
      password: user.password ?? '',
      role: user.role,
      hourly_rate: user.hourlyRate,
      meal_rate: user.mealRate ?? 0,
      status: user.status,
      avatar: user.avatar,
      permissions: user.permissions ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[insertUserToDB] insert error:', error?.message, error?.details, error?.hint);
    return null;
  }

  if (user.stores.length > 0) {
    const { data: storeRows } = await supabase
      .from('stores')
      .select('id, name')
      .in('name', user.stores);

    if (storeRows && storeRows.length > 0) {
      await supabase.from('user_stores').insert(
        storeRows.map((s: any) => ({ user_id: data.id, store_id: s.id }))
      );
    }
  }

  return data.id;
}

// Update user fields + optionally replace their stores
export async function updateUserInDB(id: string, updates: Partial<User> & { password?: string }): Promise<void> {
  const dbUpdates: Record<string, any> = {};
  if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
  if (updates.username !== undefined) dbUpdates.username = updates.username;
  if (updates.password !== undefined && updates.password !== '') dbUpdates.password = updates.password;
  if (updates.role !== undefined) dbUpdates.role = updates.role;
  if (updates.hourlyRate !== undefined) dbUpdates.hourly_rate = updates.hourlyRate;
  if (updates.mealRate !== undefined) dbUpdates.meal_rate = updates.mealRate;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
  if (updates.permissions !== undefined) dbUpdates.permissions = updates.permissions;

  if (Object.keys(dbUpdates).length > 0) {
    console.log('[updateUserInDB] sending:', JSON.stringify(dbUpdates));
    const { error } = await supabase.from('users').update(dbUpdates).eq('id', id);
    if (error) console.error('[updateUserInDB] update error:', error.message, error.details, error.hint);
    else console.log('[updateUserInDB] success for id:', id);
  }

  if (updates.stores !== undefined) {
    await supabase.from('user_stores').delete().eq('user_id', id);
    if (updates.stores.length > 0) {
      const { data: storeRows } = await supabase
        .from('stores')
        .select('id, name')
        .in('name', updates.stores);
      if (storeRows && storeRows.length > 0) {
        await supabase.from('user_stores').insert(
          storeRows.map((s: any) => ({ user_id: id, store_id: s.id }))
        );
      }
    }
  }
}

// Delete user from DB (including their attendance, messages, and store links)
export async function deleteUserFromDB(id: string): Promise<void> {
  const r1 = await supabase.from('attendance').delete().eq('user_id', id);
  if (r1.error) console.error('[deleteUser] attendance:', r1.error.message);

  const r2 = await supabase.from('messages').delete().or(`sender_id.eq.${id},receiver_id.eq.${id}`);
  if (r2.error) console.error('[deleteUser] messages:', r2.error.message);

  const r3 = await supabase.from('user_stores').delete().eq('user_id', id);
  if (r3.error) console.error('[deleteUser] user_stores:', r3.error.message);

  const r4 = await supabase.from('users').delete().eq('id', id);
  if (r4.error) console.error('[deleteUser] users:', r4.error.message);
}

// Fetch attendance for a specific user (or all users for admin)
export async function fetchAttendanceFromDB(userId?: string) {
  let query = supabase
    .from('attendance')
    .select('id, user_id, date, check_in, check_out, worked_hours, status, store, meal, pauses, pause_minutes')
    .order('date', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((a: any) => ({
    id: a.id,
    userId: a.user_id,
    date: a.date,
    checkIn: a.check_in,
    checkOut: a.check_out,
    workedHours: Number(a.worked_hours),
    status: a.status,
    store: a.store,
    meal: a.meal ?? undefined,
    pauses: a.pauses ?? undefined,
    pauseMinutes: a.pause_minutes ?? undefined,
  }));
}

// Insert attendance entry
export async function insertAttendanceToDB(entry: Omit<import('../types').AttendanceEntry, 'id'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('attendance')
    .insert({
      user_id: entry.userId,
      date: entry.date,
      check_in: entry.checkIn,
      check_out: entry.checkOut,
      worked_hours: entry.workedHours,
      status: entry.status,
      store: entry.store,
      meal: entry.meal ?? null,
      pauses: entry.pauses ?? null,
      pause_minutes: entry.pauseMinutes ?? null,
    })
    .select('id')
    .single();
  if (error) { console.error('[insertAttendanceToDB]', error.message); return null; }
  return data?.id ?? null;
}

// Update attendance entry
export async function updateAttendanceInDB(id: string, updates: Partial<import('../types').AttendanceEntry>): Promise<void> {
  const dbUpdates: Record<string, any> = {};
  if (updates.checkIn !== undefined) dbUpdates.check_in = updates.checkIn;
  if (updates.checkOut !== undefined) dbUpdates.check_out = updates.checkOut;
  if (updates.workedHours !== undefined) dbUpdates.worked_hours = updates.workedHours;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.store !== undefined) dbUpdates.store = updates.store;
  if (updates.meal !== undefined) dbUpdates.meal = updates.meal;
  if (updates.pauses !== undefined) dbUpdates.pauses = updates.pauses;
  if (updates.pauseMinutes !== undefined) dbUpdates.pause_minutes = updates.pauseMinutes;
  if (Object.keys(dbUpdates).length > 0) {
    const { error } = await supabase.from('attendance').update(dbUpdates).eq('id', id);
    if (error) console.error('[updateAttendanceInDB]', error.message);
  }
}

export async function deleteAttendanceFromDB(id: string): Promise<void> {
  const { error } = await supabase.from('attendance').delete().eq('id', id);
  if (error) console.error('[deleteAttendanceFromDB]', error.message);
}

// Generate a unique reference for a phone unit
function generatePhoneRef(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ref = 'PH-';
  for (let i = 0; i < 8; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

// Fetch all phones (inventory) — ensures every color entry has a reference
export async function fetchInventoryFromDB(): Promise<import('../types').Phone[]> {
  const { data, error } = await supabase
    .from('phones')
    .select('id, brand, model, ram, storage, price, quantity, condition, store, colors')
    .order('created_at', { ascending: false });
  if (error || !data) return [];

  // Patch: generate missing references and persist them
  const toUpdate: { id: string; colors: any[] }[] = [];

  const phones = data.map((p: any) => {
    let colors = p.colors || undefined;
    if (Array.isArray(colors)) {
      let patched = false;
      colors = colors.map((c: any) => {
        if (!c.reference) {
          patched = true;
          return { ...c, reference: generatePhoneRef() };
        }
        return c;
      });
      if (patched) toUpdate.push({ id: p.id, colors });
    }
    return {
      id: p.id,
      brand: p.brand,
      model: p.model,
      ram: p.ram,
      storage: p.storage,
      price: Number(p.price),
      quantity: Number(p.quantity),
      condition: p.condition,
      store: p.store,
      colors,
    };
  });

  // Persist generated references to DB (fire-and-forget)
  if (toUpdate.length > 0) {
    Promise.all(
      toUpdate.map(({ id, colors }) =>
        supabase.from('phones').update({ colors }).eq('id', id)
      )
    ).catch(err => console.error('[fetchInventoryFromDB] ref patch error:', err));
  }

  return phones;
}

// Insert phone
export async function insertPhoneToDB(phone: Omit<import('../types').Phone, 'id'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('phones')
    .insert({
      brand: phone.brand,
      model: phone.model,
      ram: phone.ram,
      storage: phone.storage,
      price: phone.price,
      quantity: phone.quantity,
      condition: phone.condition,
      store: phone.store,
      colors: phone.colors || null,
    })
    .select('id')
    .single();
  if (error) { console.error('[insertPhoneToDB]', error.message); return null; }
  return data?.id ?? null;
}

// Update phone
export async function updatePhoneInDB(id: string, updates: Partial<import('../types').Phone>): Promise<void> {
  const dbUpdates: Record<string, any> = {};
  if (updates.brand !== undefined) dbUpdates.brand = updates.brand;
  if (updates.model !== undefined) dbUpdates.model = updates.model;
  if (updates.ram !== undefined) dbUpdates.ram = updates.ram;
  if (updates.storage !== undefined) dbUpdates.storage = updates.storage;
  if (updates.price !== undefined) dbUpdates.price = updates.price;
  if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
  if (updates.condition !== undefined) dbUpdates.condition = updates.condition;
  if (updates.store !== undefined) dbUpdates.store = updates.store;
  if (updates.colors !== undefined) dbUpdates.colors = updates.colors;
  if (Object.keys(dbUpdates).length > 0) {
    const { error } = await supabase.from('phones').update(dbUpdates).eq('id', id);
    if (error) console.error('[updatePhoneInDB]', error.message);
  }
}

// Delete phone
export async function deletePhoneFromDB(id: string): Promise<void> {
  const { error } = await supabase.from('phones').delete().eq('id', id);
  if (error) console.error('[deletePhoneFromDB]', error.message);
}

// ── BRANDS ──────────────────────────────────────────────
export async function fetchBrandsFromDB(): Promise<import('../types').Brand[]> {
  const { data, error } = await supabase.from('brands').select('id, name').order('name');
  if (error || !data) return [];
  return data.map((b: any) => ({ id: b.id, name: b.name }));
}

export async function insertBrandToDB(name: string): Promise<string | null> {
  const { data, error } = await supabase.from('brands').insert({ name }).select('id').single();
  if (error) { console.error('[insertBrandToDB]', error.message); return null; }
  return data?.id ?? null;
}

export async function deleteBrandFromDB(id: string): Promise<void> {
  await supabase.from('brands').delete().eq('id', id);
}

// ── BRAND SERIES ────────────────────────────────────────
export async function fetchBrandSeriesFromDB(): Promise<import('../types').BrandSeries[]> {
  const { data, error } = await supabase
    .from('brand_series')
    .select('id, brand_name, series_name')
    .order('brand_name')
    .order('series_name');
  if (error || !data) return [];
  return data.map((bs: any) => ({ id: bs.id, brandName: bs.brand_name, seriesName: bs.series_name }));
}

export async function insertBrandSeriesToDB(brandName: string, seriesName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('brand_series')
    .insert({ brand_name: brandName, series_name: seriesName })
    .select('id')
    .single();
  if (error) { console.error('[insertBrandSeriesToDB]', error.message); return null; }
  return data?.id ?? null;
}

export async function updateBrandSeriesInDB(id: string, seriesName: string): Promise<void> {
  const { error } = await supabase.from('brand_series').update({ series_name: seriesName }).eq('id', id);
  if (error) console.error('[updateBrandSeriesInDB]', error.message);
}

export async function deleteBrandSeriesFromDB(id: string): Promise<void> {
  const { error } = await supabase.from('brand_series').delete().eq('id', id);
  if (error) console.error('[deleteBrandSeriesFromDB]', error.message);
}

// ── SPARE PARTS ─────────────────────────────────────────
export async function fetchSparePartsFromDB(): Promise<import('../types').SparePart[]> {
  const { data, error } = await supabase
    .from('spare_parts')
    .select('id, name, category, qualities, compatible_brand, device_type, series, compatible_model, price, quantity, condition, store')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((p: any) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    compatibleBrand: p.compatible_brand,
    deviceType: p.device_type || '',
    series: p.series || '',
    compatibleModel: p.compatible_model,
    price: Number(p.price),
    quantity: Number(p.quantity),
    condition: p.condition,
    store: p.store,
    qualities: p.qualities || undefined,
  }));
}

export async function insertSparePartToDB(part: Omit<import('../types').SparePart, 'id'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('spare_parts')
    .insert({
      name: part.name,
      category: part.category,
      qualities: part.qualities || null,
      compatible_brand: part.compatibleBrand,
      device_type: part.deviceType || null,
      series: part.series || null,
      compatible_model: part.compatibleModel,
      price: part.price,
      quantity: part.quantity,
      condition: part.condition,
      store: part.store,
    })
    .select('id')
    .single();
  if (error) { console.error('[insertSparePartToDB]', error.message); return null; }
  return data?.id ?? null;
}

export async function updateSparePartInDB(id: string, updates: Partial<import('../types').SparePart>): Promise<boolean> {
  const dbUpdates: Record<string, any> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.qualities !== undefined) dbUpdates.qualities = updates.qualities;
  if (updates.compatibleBrand !== undefined) dbUpdates.compatible_brand = updates.compatibleBrand;
  if (updates.deviceType !== undefined) dbUpdates.device_type = updates.deviceType;
  if (updates.series !== undefined) dbUpdates.series = updates.series;
  if (updates.compatibleModel !== undefined) dbUpdates.compatible_model = updates.compatibleModel;
  if (updates.price !== undefined) dbUpdates.price = updates.price;
  if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
  if (updates.condition !== undefined) dbUpdates.condition = updates.condition;
  if (updates.store !== undefined) dbUpdates.store = updates.store;
  if (Object.keys(dbUpdates).length > 0) {
    const { error } = await supabase.from('spare_parts').update(dbUpdates).eq('id', id);
    if (error) { console.error('[updateSparePartInDB]', error.message); return false; }
  }
  return true;
}

export async function deleteSparePartFromDB(id: string): Promise<void> {
  const { error } = await supabase.from('spare_parts').delete().eq('id', id);
  if (error) console.error('[deleteSparePartFromDB]', error.message);
}

// ── STORES ──────────────────────────────────────────────
export async function fetchStoresFromDB(): Promise<import('../types').StoreLocation[]> {
  const { data, error } = await supabase.from('stores').select('id, name, location').order('name');
  if (error || !data) return [];
  return data.map((s: any) => ({ id: s.id, name: s.name, location: s.location ?? '' }));
}

export async function insertStoreToDB(store: { name: string; location: string }): Promise<string | null> {
  const { data, error } = await supabase.from('stores').insert(store).select('id').single();
  if (error) { console.error('[insertStoreToDB]', error.message); return null; }
  return data?.id ?? null;
}

export async function updateStoreInDB(id: string, updates: { name?: string; location?: string }): Promise<void> {
  await supabase.from('stores').update(updates).eq('id', id);
}

export async function deleteStoreFromDB(id: string): Promise<void> {
  await supabase.from('stores').delete().eq('id', id);
}

// ── ONLINE STATUS ───────────────────────────────────────
export async function setUserOnlineStatus(userId: string, online: boolean): Promise<void> {
  const { error } = await supabase.from('users').update({ online }).eq('id', userId);
  if (error) console.error('[setUserOnlineStatus]', error.message);
}

export async function fetchOnlineUsersFromDB(): Promise<{ id: string; online: boolean }[]> {
  // Primary: check attendance table for today — status 'En cours' = online
  const today = new Date().toISOString().split('T')[0];
  const { data: attData } = await supabase
    .from('attendance')
    .select('user_id')
    .eq('date', today)
    .eq('status', 'En cours');

  const onlineFromAttendance = new Set((attData ?? []).map((a: any) => a.user_id));

  // Fallback: also check online column if it exists
  const { data: userData } = await supabase.from('users').select('id, online');
  const result: { id: string; online: boolean }[] = (userData ?? []).map((u: any) => ({
    id: u.id,
    online: onlineFromAttendance.has(u.id) || u.online === true,
  }));

  // Add any IDs found in attendance but not in users result
  onlineFromAttendance.forEach((uid: string) => {
    if (!result.find(r => r.id === uid)) {
      result.push({ id: uid, online: true });
    }
  });

  return result;
} 
export async function fetchMessagesBetween(userId1: string, userId2: string): Promise<import('../types').Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((m: any) => ({
    id: m.id,
    senderId: m.sender_id,
    receiverId: m.receiver_id,
    content: m.content,
    read: m.read,
    createdAt: m.created_at,
  }));
}

export async function sendMessageToDB(senderId: string, receiverId: string, content: string): Promise<import('../types').Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, content })
    .select('*')
    .single();
  if (error || !data) { console.error('[sendMessageToDB]', error?.message); return null; }
  return {
    id: data.id,
    senderId: data.sender_id,
    receiverId: data.receiver_id,
    content: data.content,
    read: data.read,
    createdAt: data.created_at,
  };
}

export async function fetchUnreadCountFromDB(receiverId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('messages')
    .select('sender_id')
    .eq('receiver_id', receiverId)
    .eq('read', false);
  if (error || !data) return {};
  const counts: Record<string, number> = {};
  data.forEach((m: any) => { counts[m.sender_id] = (counts[m.sender_id] || 0) + 1; });
  return counts;
}

export async function markMessagesAsReadInDB(senderId: string, receiverId: string): Promise<void> {
  await supabase.from('messages').update({ read: true }).eq('sender_id', senderId).eq('receiver_id', receiverId).eq('read', false);
}

// ─── Sales ────────────────────────────────────────────────────
export async function fetchSalesFromDB(): Promise<import('../types').Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('id, phone_brand, phone_model, phone_ram, phone_storage, phone_condition, color, reference, price, store, sold_by, sold_by_name, sold_at')
    .order('sold_at', { ascending: false });
  if (error || !data) return [];
  return data.map((s: any) => ({
    id: s.id,
    phoneBrand: s.phone_brand,
    phoneModel: s.phone_model,
    phoneRam: s.phone_ram,
    phoneStorage: s.phone_storage,
    phoneCondition: s.phone_condition,
    color: s.color,
    reference: s.reference,
    price: Number(s.price),
    store: s.store,
    soldBy: s.sold_by,
    soldByName: s.sold_by_name,
    soldAt: s.sold_at,
  }));
}

export async function insertSaleToDB(sale: Omit<import('../types').Sale, 'id'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('sales')
    .insert({
      phone_brand: sale.phoneBrand,
      phone_model: sale.phoneModel,
      phone_ram: sale.phoneRam,
      phone_storage: sale.phoneStorage,
      phone_condition: sale.phoneCondition,
      color: sale.color,
      reference: sale.reference,
      price: sale.price,
      store: sale.store,
      sold_by: sale.soldBy,
      sold_by_name: sale.soldByName,
      sold_at: sale.soldAt,
    })
    .select('id')
    .single();
  if (error || !data) { console.error('[insertSaleToDB]', error?.message); return null; }
  return data.id;
}

export async function clearAllSalesFromDB(): Promise<boolean> {
  const { error } = await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) { console.error('[clearAllSalesFromDB]', error.message); return false; }
  return true;
}
