// @ts-nocheck
import { supabase, getSessionKey } from './supabase';

// In-memory caches for sync access (populated async on startup, write-through to Supabase)
let _membersCache = [];
let _ordersCache = [];
let _productsCache = [];
let _looksCache = [];
let _reelsCache = [];
let _salesTargetsCache = { daily: 500, monthly: 5000, monthlyUnits: 40 };
let _storeConfigCache = { whatsappNumber: '' };
let _reelSocialCache = { likedReels: {}, savedReels: {}, followedHandles: {}, likedComments: {}, commentsByReel: {}, customReels: [] };
let _reelCommentsCache = {};
let _initialized = false;
let _initPromise = null;

const LOCK_TTL_MS = 24 * 60 * 60 * 1000;

const parseTimeMs = iso => {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? t : Date.now();
};

const normalizePhone = raw => {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('60') && digits.length >= 10) return '0' + digits.slice(2);
  return digits;
};

// Convert DB order_items rows to the app's item format
const dbItemToAppItem = row => ({
  id: String(row.item_id || ''),
  variantId: Number(row.variant_id || 0),
  name: String(row.name || 'Item'),
  size: String(row.size || '-'),
  qty: Math.max(1, parseInt(row.qty, 10) || 1),
  unitPrice: Math.max(0, Number(row.unit_price) || 0),
  image: String(row.image || ''),
  status: row.status === 'paid' ? 'paid' : (row.status === 'unlocked' ? 'unlocked' : 'locked'),
  stockDeducted: Boolean(row.stock_deducted),
  lockedAt: row.locked_at ? new Date(row.locked_at).toISOString() : null,
  paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
  unlockedAt: row.unlocked_at ? new Date(row.unlocked_at).toISOString() : null,
  unlockReason: row.unlock_reason ? String(row.unlock_reason) : null
});

// Convert DB orders + items to the app's order format
const buildOrdersFromDb = (orders, items) => {
  const itemsByOrder = {};
  for (const it of items) {
    if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
    itemsByOrder[it.order_id].push(it);
  }
  return orders.map(ord => ({
    id: String(ord.id),
    ref: String(ord.ref),
    customerName: String(ord.customer_name || 'Pelanggan Sahira'),
    customerPhone: String(ord.customer_phone || ''),
    createdAt: new Date(ord.created_at).toISOString(),
    items: (itemsByOrder[ord.id] || []).map(dbItemToAppItem)
  })).filter(o => o.items.length > 0);
};

// Convert DB product row to app format
const dbProductToApp = row => ({
  id: String(row.id),
  name: String(row.name || 'Item'),
  type: String(row.type || 'Sahira Premium Outlet'),
  category: String(row.category || 'apparel'),
  isNew: Boolean(row.is_new),
  price: Number(row.price) || 0,
  discount: Number(row.discount) || 0,
  offerEnabled: Boolean(row.offer_enabled),
  offerType: String(row.offer_type || 'flash_sale'),
  offerLabel: String(row.offer_label || ''),
  offerDiscount: Number(row.offer_discount) || 0,
  offerEndsAt: row.offer_ends_at ? new Date(row.offer_ends_at).toISOString() : null,
  stock: Number(row.stock) || 0,
  sizes: Array.isArray(row.sizes) ? row.sizes : [],
  image: String(row.image || ''),
  url: String(row.url || '')
});

// Convert DB look row to app format
const dbLookToApp = row => ({
  name: String(row.name || 'Outfit'),
  desc: String(row.description || ''),
  src: String(row.src || ''),
  srcset: String(row.srcset || ''),
  products: Array.isArray(row.products) ? row.products : [],
  pins: Array.isArray(row.pins) ? row.pins : []
});

// Convert DB reel row to app format
const dbReelToApp = row => ({
  id: String(row.id),
  lookIndex: Number(row.look_index) || 0,
  videoUrl: String(row.video_url || ''),
  handle: String(row.handle || '@sahirapremiumoutlet'),
  verified: row.verified !== false,
  following: row.following !== false,
  category: String(row.category || 'apparel'),
  caption: String(row.caption || ''),
  audio: String(row.audio || ''),
  baseLikes: Number(row.base_likes) || 0,
  baseSaves: Number(row.base_saves) || 0,
  baseShares: Number(row.base_shares) || 0,
  bgTone: Array.isArray(row.bg_tone) ? row.bg_tone : ['#151515', '#282625'],
  comments: Array.isArray(row.comments) ? row.comments : []
});

// ============ INITIALIZATION ============
export async function initDatabase() {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    try {
      // Load all data in parallel
      const [membersRes, ordersRes, orderItemsRes, productsRes, looksRes, reelsRes, targetsRes, configRes, socialRes, commentsRes] = await Promise.all([
        supabase.from('members').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('order_items').select('*'),
        supabase.from('products').select('*').order('sort_order', { ascending: true }),
        supabase.from('looks').select('*').order('sort_order', { ascending: true }),
        supabase.from('reels').select('*').order('sort_order', { ascending: true }),
        supabase.from('sales_targets').select('*').eq('id', 1).maybeSingle(),
        supabase.from('store_config').select('*').eq('id', 1).maybeSingle(),
        supabase.from('reel_social').select('*').eq('session_key', getSessionKey()),
        supabase.from('reel_comments').select('*'),
      ]);

      _membersCache = membersRes.data || [];
      _ordersCache = buildOrdersFromDb(ordersRes.data || [], orderItemsRes.data || []);
      _productsCache = (productsRes.data || []).map(dbProductToApp);
      _looksCache = (looksRes.data || []).map(dbLookToApp);
      _reelsCache = (reelsRes.data || []).map(dbReelToApp);

      if (targetsRes.data) {
        _salesTargetsCache = {
          daily: Number(targetsRes.data.daily) || 500,
          monthly: Number(targetsRes.data.monthly) || 5000,
          monthlyUnits: parseInt(targetsRes.data.monthly_units, 10) || 40
        };
      }
      if (configRes.data) {
        _storeConfigCache = { whatsappNumber: String(configRes.data.whatsapp_number || '') };
      }

      // Build reel social cache
      const social = {};
      const likedReels = {}, savedReels = {}, followedHandles = {};
      for (const row of (socialRes.data || [])) {
        if (row.is_liked) likedReels[row.reel_id] = true;
        if (row.is_saved) savedReels[row.reel_id] = true;
        if (row.is_following) followedHandles[row.reel_id] = true;
      }
      // Build comments cache from reel_comments table
      const commentsByReel = {};
      for (const c of (commentsRes.data || [])) {
        if (!commentsByReel[c.reel_id]) commentsByReel[c.reel_id] = [];
        const commentObj = {
          id: String(c.id),
          author: String(c.author || ''),
          text: String(c.text || ''),
          time: 'baru',
          likes: Number(c.likes) || 0,
          replies: []
        };
        if (c.parent_id) {
          const parent = commentsByReel[c.reel_id]?.find(p => p.id === String(c.parent_id));
          if (parent) parent.replies.push(commentObj);
          else commentsByReel[c.reel_id].push(commentObj);
        } else {
          commentsByReel[c.reel_id].push(commentObj);
        }
      }
      _reelSocialCache = { likedReels, savedReels, followedHandles, likedComments: {}, commentsByReel, customReels: [] };
      _reelCommentsCache = commentsByReel;

      _initialized = true;
    } catch (err) {
      console.warn('Supabase init failed, using defaults:', err);
      _initialized = true;
    }
  })();
  return _initPromise;
}

// ============ MEMBERS ============
export function getMembersCache() { return _membersCache; }

export async function upsertMember(member) {
  const phoneNorm = normalizePhone(member.phone);
  const existing = _membersCache.find(m => m.phone_norm === phoneNorm);
  if (existing) {
    existing.name = member.name || existing.name;
    existing.phone = member.phone || existing.phone;
    existing.last_login_at = new Date().toISOString();
    try {
      await supabase.from('members').update({
        name: existing.name,
        phone: existing.phone,
        last_login_at: existing.last_login_at
      }).eq('phone_norm', phoneNorm);
    } catch (_) {}
    return existing;
  }
  const newMember = {
    name: member.name,
    phone: member.phone,
    phone_norm: phoneNorm,
    created_at: new Date().toISOString(),
    last_login_at: new Date().toISOString()
  };
  try {
    const { data } = await supabase.from('members').insert({
      name: newMember.name,
      phone: newMember.phone,
      phone_norm: newMember.phone_norm,
      created_at: newMember.created_at,
      last_login_at: newMember.last_login_at
    }).select().single();
    if (data) {
      _membersCache.unshift(data);
      return data;
    }
  } catch (_) {}
  _membersCache.unshift(newMember);
  return newMember;
}

export async function deleteMember(phoneNorm) {
  _membersCache = _membersCache.filter(m => m.phone_norm !== phoneNorm);
  try { await supabase.from('members').delete().eq('phone_norm', phoneNorm); } catch (_) {}
}

// ============ ORDERS ============
export function getOrdersCache() { return _ordersCache; }

const sweepExpiredLocks = list => {
  const now = Date.now();
  list.forEach(ord => {
    ord.items.forEach(it => {
      if (it.status === 'locked') {
        const lockedMs = parseTimeMs(it.lockedAt || ord.createdAt);
        if (now - lockedMs >= LOCK_TTL_MS) {
          it.status = 'unlocked';
          it.unlockedAt = new Date(lockedMs + LOCK_TTL_MS).toISOString();
          it.unlockReason = 'auto-24h';
        }
      }
    });
  });
};

export async function addOrderToDb({ customerName, customerPhone, items }) {
  const now = new Date().toISOString();
  const orderId = 'ord-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const ref = 'SHR-' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

  const orderItems = (items || []).map(it => ({
    order_id: orderId,
    item_id: String(it.id || ''),
    variant_id: Number(it.variantId || 0),
    name: String(it.name || 'Item'),
    size: String(it.size || '-'),
    qty: Math.max(1, parseInt(it.qty, 10) || 1),
    unit_price: Math.max(0, Number(it.unitPrice) || 0),
    image: String(it.image || ''),
    status: 'locked',
    stock_deducted: false,
    locked_at: now
  }));

  try {
    await supabase.from('orders').insert({
      id: orderId,
      ref,
      customer_name: customerName || 'Pelanggan Sahira',
      customer_phone: customerPhone || '',
      created_at: now
    });
    if (orderItems.length) {
      await supabase.from('order_items').insert(orderItems);
    }
  } catch (err) {
    console.warn('Supabase order insert failed:', err);
  }

  const appOrder = {
    id: orderId,
    ref,
    customerName: customerName || 'Pelanggan Sahira',
    customerPhone: customerPhone || '',
    createdAt: now,
    items: orderItems.map(oi => ({
      id: oi.item_id,
      variantId: oi.variant_id,
      name: oi.name,
      size: oi.size,
      qty: oi.qty,
      unitPrice: Number(oi.unit_price),
      image: oi.image,
      status: 'locked',
      stockDeducted: false,
      lockedAt: now,
      paidAt: null,
      unlockedAt: null,
      unlockReason: null
    }))
  };
  _ordersCache.unshift(appOrder);
  return appOrder;
}

export async function toggleOrderItemInDb(orderId, itemIdx, targetStatus) {
  const ord = _ordersCache.find(o => o.id === orderId);
  if (!ord || !ord.items[itemIdx]) return null;
  const item = ord.items[itemIdx];
  const now = new Date().toISOString();
  let nextStatus = targetStatus;
  if (nextStatus !== 'paid' && nextStatus !== 'locked' && nextStatus !== 'unlocked') {
    nextStatus = item.status === 'paid' ? 'locked' : 'paid';
  }
  item.status = nextStatus;
  const updates = { status: nextStatus };
  if (nextStatus === 'paid') {
    item.paidAt = now; item.unlockedAt = null; item.unlockReason = null;
    updates.paid_at = now; updates.unlocked_at = null; updates.unlock_reason = null;
  } else if (nextStatus === 'locked') {
    item.lockedAt = now; item.paidAt = null; item.unlockedAt = null; item.unlockReason = null;
    updates.locked_at = now; updates.paid_at = null; updates.unlocked_at = null; updates.unlock_reason = null;
  } else {
    item.paidAt = null; item.unlockedAt = now; item.unlockReason = 'manual';
    updates.paid_at = null; updates.unlocked_at = now; updates.unlock_reason = 'manual';
  }
  // Find the DB row by order_id + item position
  try {
    const { data: dbItems } = await supabase.from('order_items').select('id').eq('order_id', orderId);
    if (dbItems && dbItems[itemIdx]) {
      await supabase.from('order_items').update(updates).eq('id', dbItems[itemIdx].id);
    }
  } catch (_) {}
  return item;
}

export async function markOrderPaidInDb(orderId) {
  const ord = _ordersCache.find(o => o.id === orderId);
  if (!ord) return false;
  const now = new Date().toISOString();
  ord.items.forEach(it => {
    if (it.status !== 'paid') {
      it.status = 'paid';
      it.paidAt = now;
      it.unlockedAt = null;
      it.unlockReason = null;
    }
  });
  try {
    await supabase.from('order_items').update({ status: 'paid', paid_at: now, unlocked_at: null, unlock_reason: null }).eq('order_id', orderId).neq('status', 'paid');
  } catch (_) {}
  return true;
}

export async function markItemStockDeductedInDb(orderId, itemIdx) {
  const ord = _ordersCache.find(o => o.id === orderId);
  if (!ord || !ord.items[itemIdx]) return false;
  ord.items[itemIdx].stockDeducted = true;
  try {
    const { data: dbItems } = await supabase.from('order_items').select('id').eq('order_id', orderId);
    if (dbItems && dbItems[itemIdx]) {
      await supabase.from('order_items').update({ stock_deducted: true }).eq('id', dbItems[itemIdx].id);
    }
  } catch (_) {}
  return true;
}

export async function deleteOrderFromDb(orderId) {
  _ordersCache = _ordersCache.filter(o => o.id !== orderId);
  try { await supabase.from('orders').delete().eq('id', orderId); } catch (_) {}
}

export function getSummaryStatsFromCache() {
  sweepExpiredLocks(_ordersCache);
  let lockedUnits = 0, lockedValue = 0, paidUnits = 0, paidValue = 0, unlockedUnits = 0, unlockedValue = 0;
  const byItem = {};
  _ordersCache.forEach(ord => {
    ord.items.forEach(it => {
      if (!byItem[it.id]) byItem[it.id] = { id: it.id, name: it.name, image: it.image, lockedQty: 0, paidQty: 0, unlockedQty: 0, orderRefs: new Set() };
      byItem[it.id].orderRefs.add(ord.ref);
      if (it.status === 'paid') { paidUnits += it.qty; paidValue += it.unitPrice * it.qty; byItem[it.id].paidQty += it.qty; }
      else if (it.status === 'unlocked') { unlockedUnits += it.qty; unlockedValue += it.unitPrice * it.qty; byItem[it.id].unlockedQty += it.qty; }
      else { lockedUnits += it.qty; lockedValue += it.unitPrice * it.qty; byItem[it.id].lockedQty += it.qty; }
    });
  });
  return { orderCount: _ordersCache.length, lockedUnits, lockedValue, paidUnits, paidValue, unlockedUnits, unlockedValue, byItem };
}

// ============ PRODUCTS ============
export function getProductsCache() { return _productsCache; }

export async function saveProductsToDb(items) {
  // Upsert all products
  const rows = items.map((it, idx) => ({
    id: String(it.id),
    name: String(it.name || 'Item'),
    type: String(it.type || 'Sahira Premium Outlet'),
    category: String(it.category || 'apparel'),
    is_new: Boolean(it.isNew),
    price: Number(it.price) || 0,
    discount: Number(it.discount) || 0,
    offer_enabled: Boolean(it.offerEnabled),
    offer_type: String(it.offerType || 'flash_sale'),
    offer_label: String(it.offerLabel || ''),
    offer_discount: Math.min(95, Math.max(0, Number(it.offerDiscount) || 0)),
    offer_ends_at: it.offerEndsAt || null,
    stock: Number(it.stock) || 0,
    sizes: Array.isArray(it.sizes) ? it.sizes : [],
    image: String(it.image || ''),
    url: String(it.url || ''),
    sort_order: idx
  }));
  const previousIds = _productsCache.map(p => p.id);
  _productsCache = items;
  try {
    // Delete products not in the new list
    const newIds = rows.map(r => r.id);
    const toDelete = previousIds.filter(id => !newIds.includes(id));
    if (toDelete.length) await supabase.from('products').delete().in('id', toDelete);
    // Upsert
    for (const row of rows) {
      await supabase.from('products').upsert(row, { onConflict: 'id' });
    }
  } catch (err) {
    console.warn('Supabase products save failed:', err);
  }
}

// ============ LOOKS ============
export function getLooksCache() { return _looksCache; }

export async function saveLooksToDb(looks) {
  const rows = looks.map((lk, idx) => ({
    name: String(lk.name || 'Outfit'),
    description: String(lk.desc || ''),
    src: String(lk.src || ''),
    srcset: String(lk.srcset || ''),
    products: Array.isArray(lk.products) ? lk.products : [],
    pins: Array.isArray(lk.pins) ? lk.pins : [],
    sort_order: idx
  }));
  _looksCache = looks;
  try {
    // Clear and re-insert (looks don't have stable IDs in the app)
    await supabase.from('looks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (rows.length) await supabase.from('looks').insert(rows);
  } catch (err) {
    console.warn('Supabase looks save failed:', err);
  }
}

// ============ REELS ============
export function getReelsCache() { return _reelsCache; }

export async function saveReelsToDb(reels) {
  const rows = reels.map((r, idx) => ({
    id: String(r.id),
    look_index: Number(r.lookIndex) || 0,
    video_url: String(r.videoUrl || ''),
    handle: String(r.handle || '@sahirapremiumoutlet'),
    verified: r.verified !== false,
    following: r.following !== false,
    category: String(r.category || 'apparel'),
    caption: String(r.caption || ''),
    audio: String(r.audio || ''),
    base_likes: Number(r.baseLikes) || 0,
    base_saves: Number(r.baseSaves) || 0,
    base_shares: Number(r.baseShares) || 0,
    bg_tone: Array.isArray(r.bgTone) ? r.bgTone : ['#151515', '#282625'],
    comments: Array.isArray(r.comments) ? r.comments : [],
    sort_order: idx
  }));
  const previousReelIds = _reelsCache.map(r => r.id);
  _reelsCache = reels;
  try {
    const newIds = rows.map(r => r.id);
    const toDelete = previousReelIds.filter(id => !newIds.includes(id));
    if (toDelete.length) await supabase.from('reels').delete().in('id', toDelete);
    for (const row of rows) {
      await supabase.from('reels').upsert(row, { onConflict: 'id' });
    }
  } catch (err) {
    console.warn('Supabase reels save failed:', err);
  }
}

// ============ STORE CONFIG ============
export function getStoreConfigCache() { return _storeConfigCache; }

export async function saveStoreConfigToDb(whatsappNumber) {
  _storeConfigCache.whatsappNumber = String(whatsappNumber || '').replace(/[^\d]/g, '');
  try {
    await supabase.from('store_config').upsert({
      id: 1,
      whatsapp_number: _storeConfigCache.whatsappNumber,
      updated_at: new Date().toISOString()
    });
  } catch (_) {}
}

// ============ SALES TARGETS ============
export function getSalesTargetsCache() { return _salesTargetsCache; }

export async function saveSalesTargetsToDb(t) {
  _salesTargetsCache = { daily: t.daily, monthly: t.monthly, monthlyUnits: t.monthlyUnits };
  try {
    await supabase.from('sales_targets').upsert({
      id: 1,
      daily: t.daily,
      monthly: t.monthly,
      monthly_units: t.monthlyUnits,
      updated_at: new Date().toISOString()
    });
  } catch (_) {}
}

// ============ REEL SOCIAL ============
export function getReelSocialCache() { return _reelSocialCache; }

export async function toggleReelLike(reelId, liked) {
  _reelSocialCache.likedReels[reelId] = liked ? true : undefined;
  try {
    if (liked) {
      await supabase.from('reel_social').upsert({ reel_id: reelId, session_key: getSessionKey(), is_liked: true });
    } else {
      const { data: existing } = await supabase.from('reel_social').select('*').eq('reel_id', reelId).eq('session_key', getSessionKey()).maybeSingle();
      if (existing) await supabase.from('reel_social').update({ is_liked: false }).eq('id', existing.id);
    }
  } catch (_) {}
}

export async function toggleReelSave(reelId, saved) {
  _reelSocialCache.savedReels[reelId] = saved ? true : undefined;
  try {
    if (saved) {
      await supabase.from('reel_social').upsert({ reel_id: reelId, session_key: getSessionKey(), is_saved: true });
    } else {
      const { data: existing } = await supabase.from('reel_social').select('*').eq('reel_id', reelId).eq('session_key', getSessionKey()).maybeSingle();
      if (existing) await supabase.from('reel_social').update({ is_saved: false }).eq('id', existing.id);
    }
  } catch (_) {}
}

export async function toggleReelFollow(reelId, following) {
  _reelSocialCache.followedHandles[reelId] = following ? true : undefined;
  try {
    if (following) {
      await supabase.from('reel_social').upsert({ reel_id: reelId, session_key: getSessionKey(), is_following: true });
    } else {
      const { data: existing } = await supabase.from('reel_social').select('*').eq('reel_id', reelId).eq('session_key', getSessionKey()).maybeSingle();
      if (existing) await supabase.from('reel_social').update({ is_following: false }).eq('id', existing.id);
    }
  } catch (_) {}
}

export async function addReelComment(reelId, author, text, parentId) {
  try {
    const { data } = await supabase.from('reel_comments').insert({
      reel_id: reelId,
      author: String(author || ''),
      text: String(text || ''),
      parent_id: parentId || null
    }).select().single();
    if (data) {
      if (!_reelSocialCache.commentsByReel[reelId]) _reelSocialCache.commentsByReel[reelId] = [];
      const commentObj = { id: String(data.id), author: data.author, text: data.text, time: 'baru', likes: 0, replies: [] };
      if (parentId) {
        const parent = _reelSocialCache.commentsByReel[reelId].find(p => p.id === parentId);
        if (parent) parent.replies.push(commentObj);
        else _reelSocialCache.commentsByReel[reelId].push(commentObj);
      } else {
        _reelSocialCache.commentsByReel[reelId].push(commentObj);
      }
      return commentObj;
    }
  } catch (_) {}
  return null;
}

// ============ FULL ADMIN CONFIG SAVE ============
export async function saveAdminConfigToDb(cfg) {
  await Promise.all([
    saveProductsToDb(cfg.items || []),
    saveLooksToDb(cfg.looks || []),
    saveReelsToDb(cfg.reels || []),
    saveStoreConfigToDb(cfg.whatsappNumber || '')
  ]);
}

// ============ RESET TO DEFAULTS ============
export async function resetAdminConfigInDb() {
  // The app will re-seed from DEFAULT_ITEMS/LOOKS/REELS constants
  // We just clear the DB so the defaults are used
  try {
    await Promise.all([
      supabase.from('products').delete().neq('id', ''),
      supabase.from('looks').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('reels').delete().neq('id', ''),
      supabase.from('store_config').update({ whatsapp_number: '' }).eq('id', 1)
    ]);
  } catch (_) {}
  _productsCache = [];
  _looksCache = [];
  _reelsCache = [];
  _storeConfigCache.whatsappNumber = '';
}

export { normalizePhone, LOCK_TTL_MS };
