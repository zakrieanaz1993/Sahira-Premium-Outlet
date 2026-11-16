// @ts-nocheck
'use strict';
import {
  initDatabase, getMembersCache, upsertMember, deleteMember,
  getOrdersCache, addOrderToDb, toggleOrderItemInDb, markOrderPaidInDb,
  markItemStockDeductedInDb, deleteOrderFromDb, getSummaryStatsFromCache,
  getProductsCache, saveProductsToDb, getLooksCache, saveLooksToDb,
  getReelsCache, saveReelsToDb, getStoreConfigCache, saveStoreConfigToDb,
  getSalesTargetsCache, saveSalesTargetsToDb,
  getReelSocialCache, toggleReelLike, toggleReelSave, toggleReelFollow, addReelComment,
  saveAdminConfigToDb, resetAdminConfigInDb, normalizePhone as dbNormalizePhone,
  LOCK_TTL_MS as DB_LOCK_TTL
} from './lib/sahira-db';
import poplinShirtImg from './assets/images/poplin_button_shirt_1794675024731.jpg';
import pinstripeDenimImg from './assets/images/pinstripe_wide_denim_1794675024193.jpg';
import oliveRibbedKnitImg from './assets/images/olive_ribbed_knit_1794675025096.jpg';
import creamCableKnitImg from './assets/images/cream_cable_knit_1794675026191.jpg';
import charcoalKnitPoloImg from './assets/images/charcoal_knit_polo_1794675025897.jpg';
import burgundyEyeletBlouseImg from './assets/images/burgundy_eyelet_blouse_1794675026093.jpg';
import ivoryTieredSkirtImg from './assets/images/ivory_tiered_skirt_1794675026825.jpg';
import tweedHerringboneBlazerImg from './assets/images/tweed_herringbone_blazer_1794675026295.jpg';
import espressoSuedeJacketImg from './assets/images/espresso_suede_jacket_1794675028453.jpg';
import camelPleatedTrousersImg from './assets/images/camel_pleated_trousers_1794675027231.jpg';
import wovenCognacToteImg from './assets/images/woven_cognac_tote_1794675028062.jpg';
import whiteMinimalSneakersImg from './assets/images/white_minimal_sneakers_1794675028691.jpg';
import brownTasselLoafersImg from './assets/images/brown_tassel_loafers_1794675028671.jpg';

window.decodeRunwayImage = image => {
  const reveal = () => image.decode().then(() => image.classList.add('is-decoded')).catch(() => { if (image.naturalWidth) image.classList.add('is-decoded'); });
  if (image.complete && image.naturalWidth) reveal();
  else image.addEventListener('load', reveal, { once: true });
};
window.SahiraCutoutFeet = (() => {
  const cache = new Map();
  const pending = new Map();
  const clampVal = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fallback = { ar: '0.5625', footY: '0.0000', footX: '45.0%', footW: '56.0%', rwFootW: '66.0%' };

  const probe = url => {
    if (!url) return Promise.resolve(fallback);
    if (cache.has(url)) return Promise.resolve(cache.get(url));
    if (pending.has(url)) return pending.get(url);
    const p = new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const nw = img.naturalWidth || 9;
          const nh = img.naturalHeight || 16;
          const ar = (nw / nh).toFixed(4);
          const w = 64;
          const h = Math.max(1, Math.round((w * nh) / nw));
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, w, h);
          const d = ctx.getImageData(0, 0, w, h).data;
          let last = -1;
          for (let y = h - 1; y >= 0 && last < 0; y--) {
            for (let x = 0; x < w; x++) {
              if (d[(y * w + x) * 4 + 3] > 40) { last = y; break; }
            }
          }
          if (last < 0) {
            const res = { ...fallback, ar };
            cache.set(url, res);
            resolve(res);
            return;
          }
          const bandTop = Math.max(0, last - Math.round(h * 0.035));
          let minX = w;
          let maxX = -1;
          for (let y = bandTop; y <= last; y++) {
            for (let x = 0; x < w; x++) {
              if (d[(y * w + x) * 4 + 3] > 40) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
              }
            }
          }
          const footY = clampVal((h - 1 - last) / h, 0, 0.4).toFixed(4);
          const cxPct = maxX >= minX ? ((minX + maxX) / 2 / w) * 100 : 45;
          const spanPct = maxX >= minX ? ((maxX - minX + 1) / w) * 100 : 36;
          const footX = `${clampVal(cxPct, 22, 78).toFixed(1)}%`;
          const footW = `${clampVal(spanPct * 1.48, 38, 82).toFixed(1)}%`;
          const rwFootW = `${clampVal(spanPct * 1.68, 46, 94).toFixed(1)}%`;
          const res = { ar, footY, footX, footW, rwFootW };
          cache.set(url, res);
          resolve(res);
        } catch (_) {
          cache.set(url, fallback);
          resolve(fallback);
        }
      };
      img.onerror = () => resolve(fallback);
      img.src = url;
    }).finally(() => pending.delete(url));
    pending.set(url, p);
    return p;
  };

  const applyToFigure = (el, url) => {
    if (!el || !url) return;
    const apply = m => {
      if (!el.isConnected) return;
      el.style.setProperty('--figure-ar', m.ar);
      el.style.setProperty('--foot-y', m.footY);
      el.style.setProperty('--foot-x', m.footX);
      el.style.setProperty('--foot-w', m.footW);
    };
    if (cache.has(url)) apply(cache.get(url));
    else probe(url).then(apply);
  };

  return { probe, applyToFigure };
})();
window.SahiraLockOrders = (() => {
  const LOCK_TTL_MS = DB_LOCK_TTL;

  const parseTimeMs = iso => {
    const t = Date.parse(iso || '');
    return Number.isFinite(t) ? t : Date.now();
  };

  const formatRemainingLock = lockedAt => {
    const startMs = typeof lockedAt === 'number' ? lockedAt : parseTimeMs(lockedAt);
    const msLeft = LOCK_TTL_MS - (Date.now() - startMs);
    if (msLeft <= 0) return 'Tamat tempoh (auto-unlock)';
    const days = Math.floor(msLeft / 86400000);
    const hours = Math.floor((msLeft % 86400000) / 3600000);
    const mins = Math.floor((msLeft % 3600000) / 60000);
    if (days > 0) return `Baki ${days}h ${hours}j`;
    if (hours > 0) return `Baki ${hours}j ${mins}m`;
    return `Baki ${Math.max(1, mins)}m`;
  };

  const getOrders = () => getOrdersCache();

  const addOrder = ({ customerName, customerPhone, items }) => {
    let result = null;
    addOrderToDb({ customerName, customerPhone, items }).then(ord => { result = ord; });
    // Return a synchronous placeholder that will be replaced by the async result
    // The async write-through populates the cache immediately
    const now = new Date().toISOString();
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const ref = 'SHR-' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const orderId = 'ord-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const order = {
      id: orderId,
      ref,
      customerName: customerName || 'Pelanggan Sahira',
      customerPhone: customerPhone || '',
      createdAt: now,
      items: (items || []).map(it => ({
        id: String(it.id || ''),
        variantId: Number(it.variantId || 0),
        name: String(it.name || 'Item'),
        size: String(it.size || '-'),
        qty: Math.max(1, parseInt(it.qty, 10) || 1),
        unitPrice: Math.max(0, Number(it.unitPrice) || 0),
        image: String(it.image || ''),
        status: 'locked',
        stockDeducted: false,
        lockedAt: now,
        paidAt: null,
        unlockedAt: null,
        unlockReason: null
      }))
    };
    // The async addOrderToDb already unshifted to cache, but we return our sync version
    return result || order;
  };

  const toggleItemStatus = (orderId, itemIdx, targetStatus) => {
    toggleOrderItemInDb(orderId, itemIdx, targetStatus);
    const ord = getOrdersCache().find(o => o.id === orderId);
    if (!ord || !ord.items[itemIdx]) return null;
    return ord.items[itemIdx];
  };

  const markOrderPaid = orderId => {
    markOrderPaidInDb(orderId);
    return true;
  };

  const markItemStockDeducted = (orderId, itemIdx) => {
    markItemStockDeductedInDb(orderId, itemIdx);
    return true;
  };

  const deleteOrder = orderId => {
    deleteOrderFromDb(orderId);
  };

  const getSummaryStats = () => getSummaryStatsFromCache();

  return {
    LOCK_TTL_MS,
    formatRemainingLock,
    getOrders,
    addOrder,
    toggleItemStatus,
    markOrderPaid,
    markItemStockDeducted,
    deleteOrder,
    getSummaryStats
  };
})();

window.SahiraAuth = (() => {
  const MEMBERS_KEY = 'sahira_members_v1';
  const SESSION_KEY = 'sahira_current_user_v1';

  const normalizePhone = raw => {
    const digits = String(raw || '').replace(/[^\d]/g, '');
    if (!digits) return '';
    if (digits.startsWith('60') && digits.length >= 10) return '0' + digits.slice(2);
    return digits;
  };

  const toWaDigits = raw => {
    const norm = normalizePhone(raw);
    if (!norm) return '';
    if (norm.startsWith('0')) return '6' + norm;
    return norm;
  };

  const escHtml = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const getMembers = () => {
    return getMembersCache().map(m => ({
      name: m.name,
      phone: m.phone,
      phoneNorm: m.phone_norm,
      createdAt: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
      lastLoginAt: m.last_login_at ? new Date(m.last_login_at).toISOString() : new Date().toISOString()
    }));
  };

  const saveMembers = list => {
    // No-op: members are now persisted via upsertMember/deleteMember to Supabase
  };

  const getUser = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return raw && raw.phoneNorm ? raw : null;
    } catch (_) {
      return null;
    }
  };

  const saveSession = user => {
    try {
      if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      else localStorage.removeItem(SESSION_KEY);
    } catch (_) {}
  };

  const notifyBagToast = msg => {
    const status = document.getElementById('bag-status');
    if (!status) return;
    status.textContent = msg;
    status.classList.add('is-on');
    clearTimeout(status.hideTimer);
    status.hideTimer = setTimeout(() => status.classList.remove('is-on'), 2800);
  };

  let authMode = 'login';
  const dialog = document.getElementById('auth-dialog');
  const closeBtn = document.getElementById('close-auth');
  const headerBtn = document.getElementById('open-auth-btn');
  const headerLabel = document.getElementById('auth-header-label');
  const titleEl = document.getElementById('auth-dialog-title');
  const subtitleEl = document.getElementById('auth-subtitle');
  const guestView = document.getElementById('auth-guest-view');
  const memberView = document.getElementById('auth-member-view');
  const nameField = document.getElementById('auth-name-field');
  const nameInput = document.getElementById('auth-name-input');
  const phoneInput = document.getElementById('auth-phone-input');
  const formEl = document.getElementById('auth-form');
  const msgEl = document.getElementById('auth-form-msg');
  const submitBtn = document.getElementById('auth-submit-btn');
  const memberAvatar = document.getElementById('auth-member-avatar');
  const memberNameEl = document.getElementById('auth-member-name');
  const memberPhoneEl = document.getElementById('auth-member-phone');
  const memberSinceEl = document.getElementById('auth-member-since');
  const memberOrdersEl = document.getElementById('auth-member-orders');
  const logoutBtn = document.getElementById('auth-logout-btn');
  const openBagFromAuthBtn = document.getElementById('auth-open-bag-btn');

  const setMsg = (text, isOk = false) => {
    if (!msgEl) return;
    if (!text) {
      msgEl.hidden = true;
      msgEl.textContent = '';
      msgEl.classList.remove('is-ok');
      return;
    }
    msgEl.textContent = text;
    msgEl.classList.toggle('is-ok', Boolean(isOk));
    msgEl.hidden = false;
  };

  const syncBagInputsFromUser = user => {
    const bagName = document.getElementById('bag-customer-name');
    const bagPhone = document.getElementById('bag-customer-phone');
    const bagAuthBar = document.getElementById('bag-auth-bar');
    const bagAuthCopy = document.getElementById('bag-auth-copy');
    const bagAuthBtn = document.getElementById('bag-open-auth-btn');
    if (user) {
      if (bagName) {
        bagName.value = user.name;
        try { localStorage.setItem('sahira_bag_customer_v1', user.name); } catch (_) {}
      }
      if (bagPhone) {
        bagPhone.value = user.phone;
        try { localStorage.setItem('sahira_bag_phone_v1', user.phone); } catch (_) {}
      }
      if (bagAuthBar) bagAuthBar.classList.add('is-logged-in');
      if (bagAuthCopy) bagAuthCopy.innerHTML = `Log masuk sebagai <strong>${escHtml(user.name)}</strong> · ${escHtml(user.phone)}`;
      if (bagAuthBtn) bagAuthBtn.textContent = 'Akaun Saya';
    } else {
      if (bagAuthBar) bagAuthBar.classList.remove('is-logged-in');
      if (bagAuthCopy) bagAuthCopy.textContent = 'Log masuk pantas (Nama & No. Tel) untuk auto-isi & semak status Lock anda.';
      if (bagAuthBtn) bagAuthBtn.textContent = 'Masuk / Daftar';
    }
  };

  const renderMemberOrders = user => {
    if (!memberOrdersEl || !user) return;
    const orders = window.SahiraLockOrders?.getOrders?.() || [];
    const userOrders = orders.filter(ord => {
      const ordPhone = normalizePhone(ord.customerPhone);
      if (ordPhone && ordPhone === user.phoneNorm) return true;
      if (!ordPhone && ord.customerName.trim().toLowerCase() === user.name.trim().toLowerCase()) return true;
      return false;
    });
    if (!userOrders.length) {
      memberOrdersEl.innerHTML = '<div class="auth-order-empty">Belum ada rekod Lock Item atas nombor anda. Pilih item ke dalam Styling Bag, tick <strong>Lock Item</strong> &amp; hantar ke WhatsApp.</div>';
      return;
    }
    memberOrdersEl.innerHTML = userOrders.map(ord => {
      let dt = '';
      try { dt = new Date(ord.createdAt).toLocaleString('ms-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) {}
      const rowsHtml = ord.items.map(it => {
        let badge = '';
        if (it.status === 'paid') {
          badge = '<span class="admin-pay-badge is-paid">Complete Payment ✓</span>';
        } else if (it.status === 'unlocked') {
          badge = '<span class="admin-pay-badge is-unlocked">Auto-Unlock (&gt;24 Jam)</span>';
        } else {
          const ttl = window.SahiraLockOrders?.formatRemainingLock?.(it.lockedAt || ord.createdAt) || 'Baki 24j';
          badge = `<span class="admin-pay-badge is-locked">Di-Lock · ${escHtml(ttl)}</span>`;
        }
        return `<div class="auth-order-row"><span class="auth-order-item-name">${escHtml(it.name)} (${escHtml(it.size)} ×${it.qty})</span>${badge}</div>`;
      }).join('');
      return `
        <div class="auth-order-card">
          <div class="auth-order-top">
            <strong>#${escHtml(ord.ref)}</strong>
            <span>${escHtml(dt)}</span>
          </div>
          ${rowsHtml}
        </div>
      `;
    }).join('');
  };

  const applyModeUI = () => {
    dialog?.querySelectorAll('[data-auth-mode]').forEach(btn => {
      const active = btn.dataset.authMode === authMode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (nameField) nameField.hidden = authMode !== 'signup';
    if (subtitleEl) {
      subtitleEl.innerHTML = authMode === 'signup'
        ? 'Pelanggan baharu? Masukkan <strong>Nama</strong> &amp; <strong>No. Telefon</strong> anda untuk daftar pantas.'
        : 'Masukkan <strong>No. Telefon</strong> sahaja untuk log masuk pantas.';
    }
    if (submitBtn) submitBtn.textContent = authMode === 'signup' ? 'Daftar & Terus Masuk' : 'Terus Masuk';
  };

  const syncUI = () => {
    const user = getUser();
    if (headerBtn) headerBtn.classList.toggle('is-logged-in', Boolean(user));
    if (headerLabel) {
      headerLabel.textContent = user ? user.name.split(/\s+/)[0] : 'Masuk';
    }
    if (headerBtn) {
      headerBtn.title = user ? `Akaun: ${user.name} (${user.phone})` : 'Log Masuk / Daftar (Nama & No. Tel)';
    }
    syncBagInputsFromUser(user);

    if (user) {
      if (guestView) guestView.hidden = true;
      if (memberView) memberView.hidden = false;
      if (titleEl) titleEl.textContent = 'Akaun Pelanggan';
      if (memberAvatar) memberAvatar.textContent = (user.name || 'S').charAt(0).toUpperCase();
      if (memberNameEl) memberNameEl.textContent = user.name;
      if (memberPhoneEl) memberPhoneEl.textContent = user.phone;
      if (memberSinceEl) {
        let joined = '';
        try { joined = new Date(user.createdAt).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (_) {}
        memberSinceEl.textContent = joined ? `Ahli sejak ${joined}` : 'Ahli Sahira Premium Outlet';
      }
      renderMemberOrders(user);
    } else {
      if (guestView) guestView.hidden = false;
      if (memberView) memberView.hidden = true;
      if (titleEl) titleEl.textContent = 'Masuk / Daftar Pantas';
      applyModeUI();
    }
  };

  const signInOrRegister = ({ name, phone, mode = 'login', silent = false }) => {
    const cleanPhone = String(phone || '').trim();
    const phoneNorm = normalizePhone(cleanPhone);
    const cleanName = String(name || '').trim();
    if (phoneNorm.length < 8) {
      if (!silent) setMsg('Sila masukkan nombor telefon yang sah (minimum 8 digit).');
      return { ok: false, error: 'invalid_phone' };
    }

    const members = getMembers();
    const idx = members.findIndex(m => m.phoneNorm === phoneNorm);
    const now = new Date().toISOString();

    if (idx >= 0) {
      const existing = members[idx];
      if (cleanName.length >= 2) existing.name = cleanName;
      existing.phone = cleanPhone || existing.phone;
      existing.lastLoginAt = now;
      upsertMember(existing);
      saveSession(existing);
      syncUI();
      if (!silent) notifyBagToast(`Selamat kembali, ${existing.name}!`);
      return { ok: true, user: existing, isNew: false };
    }

    let resolvedName = cleanName;
    if (mode === 'login' && resolvedName.length < 2) {
      const pastOrder = (window.SahiraLockOrders?.getOrders?.() || []).find(
        ord => normalizePhone(ord.customerPhone) === phoneNorm && ord.customerName && ord.customerName !== 'Pelanggan Sahira'
      );
      if (pastOrder) resolvedName = pastOrder.customerName.trim();
    }

    if (resolvedName.length < 2) {
      if (mode === 'login' && !silent) {
        authMode = 'signup';
        applyModeUI();
        setMsg('Nombor belum berdaftar — sila masukkan Nama anda untuk terus daftar & masuk.');
        nameInput?.focus();
      } else if (!silent) {
        setMsg('Sila masukkan Nama anda (minimum 2 aksara).');
        nameInput?.focus();
      }
      return { ok: false, error: 'missing_name' };
    }

    const member = {
      name: resolvedName,
      phone: cleanPhone || phoneNorm,
      phoneNorm,
      createdAt: now,
      lastLoginAt: now
    };
    upsertMember(member);
    saveSession(member);
    syncUI();
    window.SahiraAdminRefreshOrders?.();
    if (!silent) notifyBagToast(`Akaun ${member.name} berjaya didaftarkan & log masuk!`);
    return { ok: true, user: member, isNew: true };
  };

  const logout = () => {
    saveSession(null);
    setMsg('');
    syncUI();
    notifyBagToast('Anda telah log keluar.');
  };

  const open = (mode = 'login') => {
    authMode = mode === 'signup' ? 'signup' : 'login';
    setMsg('');
    syncUI();
    if (dialog && !dialog.open) dialog.showModal();
    if (!getUser()) {
      setTimeout(() => (authMode === 'signup' ? nameInput : phoneInput)?.focus(), 40);
    }
  };

  headerBtn?.addEventListener('click', () => open('login'));
  closeBtn?.addEventListener('click', () => dialog?.close());
  dialog?.addEventListener('click', ev => {
    if (ev.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) dialog.close();
    }
    const tab = ev.target.closest('[data-auth-mode]');
    if (tab) {
      authMode = tab.dataset.authMode === 'signup' ? 'signup' : 'login';
      setMsg('');
      applyModeUI();
    }
  });

  formEl?.addEventListener('submit', ev => {
    ev.preventDefault();
    setMsg('');
    const res = signInOrRegister({
      name: nameInput?.value || '',
      phone: phoneInput?.value || '',
      mode: authMode
    });
    if (res.ok && nameInput && phoneInput) {
      nameInput.value = '';
      phoneInput.value = '';
    }
  });

  logoutBtn?.addEventListener('click', logout);
  openBagFromAuthBtn?.addEventListener('click', () => {
    dialog?.close();
    document.getElementById('open-bag')?.click();
  });

  syncUI();

  return {
    open,
    logout,
    getUser,
    getMembers,
    normalizePhone,
    toWaDigits,
    signInOrRegister,
    refresh: syncUI
  };
})();

window.RunwayBag = (() => {
  const storageKey = 'runway-styling-bag-v3';
  const customerKey = 'sahira_bag_customer_v1';
  const phoneKey = 'sahira_bag_phone_v1';
  const LOCK_TTL_MS = window.SahiraLockOrders?.LOCK_TTL_MS || (24 * 60 * 60 * 1000);
  const baseVariants = {};
  const hashVarId = str => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 1000000000 + (Math.abs(h) % 7999999999);
  };
  const toCatalogItem = it => {
    const rawSizes = Array.isArray(it.sizes) ? it.sizes : String(it.sizes || '').split(',');
    const dedupSizes = [...new Set(rawSizes.map(s => String(s).trim()).filter(Boolean))];
    const sizes = dedupSizes.length ? dedupSizes : (it.category === 'footwear' ? ['40', '41', '42', '43', '44', '45', '46'] : ['S', 'M', 'L', 'XL']);
    const avail = (it.stock === undefined ? 15 : Number(it.stock)) > 0;
    const known = baseVariants[it.id] || {};
    const variants = sizes.map(sz => ({ id: known[sz] || hashVarId(String(it.id) + '::' + sz), a: avail, o: [String(sz)] }));
    const basePrice = Math.max(0, Number(it.price) || 0);
    const clamp = d => Math.min(95, Math.max(0, Math.round(Number(d) || 0)));
    const offerEnabled = Boolean(it.offerEnabled);
    const offerEndsAt = it.offerEndsAt || null;
    const offerLive = () => offerEnabled && Boolean(offerEndsAt) && Date.parse(offerEndsAt) > Date.now();
    const discountNow = () => offerEnabled ? (offerLive() ? clamp(it.offerDiscount) : 0) : clamp(it.discount);
    const item = { id: String(it.id), name: String(it.name || 'Item'), type: String(it.type === 'Sahira Studio' ? 'Sahira Premium Outlet' : (it.type || 'Sahira Premium Outlet')), originalPrice: basePrice, image: String(it.image || ''), sizes, variants, url: String(it.url || ''), offerEndsAt, offerLabel: String(it.offerLabel || (it.offerType === 'clearance' ? 'Clearance' : 'Special Offer')) };
    Object.defineProperties(item, {
      discount: { enumerable: true, get: discountNow },
      price: { enumerable: true, get: () => { const d = discountNow(); return d > 0 ? Number((basePrice * (1 - d / 100)).toFixed(2)) : basePrice; } },
      offerActive: { enumerable: true, get: offerLive }
    });
    return item;
  };
  const catalogData = {"source": "sahira-studio", "looks": [], "items": []};
  try {
    if (typeof activeConfig === 'object' && activeConfig && Array.isArray(activeConfig.items) && activeConfig.items.length) {
      catalogData.items = activeConfig.items.map(toCatalogItem);
      if (Array.isArray(activeConfig.looks)) catalogData.looks = activeConfig.looks.map(lk => ({ name: lk.name, description: lk.desc || lk.name, image: lk.src, products: lk.products || [] }));
    }
  } catch (_) {}

  const catalogPromise = Promise.resolve(catalogData).then(data => {
    if (!data || !Array.isArray(data.items) || !data.items.every(p => typeof p.id === 'string' && typeof p.name === 'string' && Number.isFinite(p.price) && p.price >= 0 && Array.isArray(p.variants) && p.variants.every(v => Number.isSafeInteger(v.id) && typeof v.a === 'boolean' && Array.isArray(v.o) && v.o.every(o => typeof o === 'string')))) throw new Error('The product list is unavailable.');
    return data;
  });
  let entries = [];
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) {
      entries = saved
        .filter(e => e && Number.isSafeInteger(e.id) && Number.isSafeInteger(e.quantity) && e.quantity > 0 && e.quantity <= 20)
        .map(e => ({
          id: e.id,
          quantity: e.quantity,
          locked: Boolean(e.locked),
          lockedAt: e.locked ? (Number(e.lockedAt) || Date.now()) : null
        }))
        .slice(0, 50);
    }
  } catch (_) {}
  const money = value => { const n = Number(value) || 0; const abs = Math.abs(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return n < 0 ? `-RM ${abs}` : `RM ${abs}`; };
  const find = (catalog,id) => {
    for (const product of catalog.items) {
      const variant = product.variants.find(v => v.id === id && v.a === true);
      if (variant) return { product, variant };
    }
    return null;
  };
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify(entries)); } catch (_) {} };
  const notify = message => {
    const status = document.getElementById('bag-status');
    status.textContent = message; status.classList.add('is-on');
    clearTimeout(status.hideTimer); status.hideTimer = setTimeout(() => status.classList.remove('is-on'),2800);
  };
  const sweepLocks = (silent = false) => {
    const now = Date.now();
    let unlockedCount = 0;
    entries.forEach(e => {
      if (e.locked) {
        if (!e.lockedAt) e.lockedAt = now;
        else if (now - e.lockedAt >= LOCK_TTL_MS) {
          e.locked = false;
          e.lockedAt = null;
          unlockedCount += 1;
        }
      }
    });
    if (unlockedCount > 0) {
      save();
      if (!silent) notify(`${unlockedCount} item di-lock melebihi 24 jam telah auto-unlock.`);
    }
    return unlockedCount;
  };
  const getBoutiqueWhatsapp = () => {
    try {
      if (typeof activeConfig === 'object' && activeConfig?.whatsappNumber) {
        return String(activeConfig.whatsappNumber).replace(/[^\d]/g, '');
      }
    } catch (_) {}
    return '';
  };
  const custInput = document.getElementById('bag-customer-name');
  const phoneInput = document.getElementById('bag-customer-phone');
  const currentMember = window.SahiraAuth?.getUser?.();
  if (custInput) {
    try { custInput.value = currentMember?.name || localStorage.getItem(customerKey) || ''; } catch (_) {}
    custInput.addEventListener('input', () => {
      try { localStorage.setItem(customerKey, custInput.value); } catch (_) {}
    });
  }
  if (phoneInput) {
    try { phoneInput.value = currentMember?.phone || localStorage.getItem(phoneKey) || ''; } catch (_) {}
    phoneInput.addEventListener('input', () => {
      try { localStorage.setItem(phoneKey, phoneInput.value); } catch (_) {}
    });
  }
  document.getElementById('bag-open-auth-btn')?.addEventListener('click', () => {
    document.getElementById('bag-dialog')?.close();
    window.SahiraAuth?.open?.('login');
  });

  let bagOfferTimer = null;
  const formatBagCountdown = iso => {
    const total = Math.max(0, Math.floor((Date.parse(iso || '') - Date.now()) / 1000));
    const d = Math.floor(total / 86400);
    const hms = [Math.floor(total / 3600) % 24, Math.floor(total / 60) % 60, total % 60].map(n => String(n).padStart(2, '0')).join(':');
    return d > 0 ? `${d}h ${hms}` : hms;
  };
  async function render() {
    sweepLocks(true);
    const catalog = await catalogPromise;
    entries = entries.filter(e => find(catalog,e.id));
    document.querySelectorAll('[data-cart-count]').forEach(el => el.textContent = entries.reduce((sum,e) => sum+e.quantity,0));
    const list = document.getElementById('bag-items');
    const toolbar = document.getElementById('bag-lock-toolbar');
    const counterEl = document.getElementById('bag-lock-counter');
    const lockAllBtn = document.getElementById('bag-lock-all');
    const receiptEl = document.getElementById('bag-lock-receipt');
    const exportBtn = document.getElementById('export-bag');
    const exportLabel = document.getElementById('export-bag-label');
    list.replaceChildren();
    let total = 0;
    let lockedTotal = 0;
    let lockedUnits = 0;
    let lockedCount = 0;
    let hasLiveOffer = false;
    if (toolbar) toolbar.hidden = !entries.length;
    if (!entries.length) {
      if (receiptEl) receiptEl.hidden = true;
      const empty = document.createElement('p');
      empty.textContent = 'Beg pilihan anda masih kosong. Pilih saiz pada item pilihan untuk simpan ke dalam beg.';
      empty.className = 'bag-note';
      list.append(empty);
    }
    for (const entry of entries) {
      const { product, variant } = find(catalog,entry.id);
      const lineTotal = product.price * entry.quantity;
      total += lineTotal;
      if (entry.locked) {
        lockedCount += 1;
        lockedUnits += entry.quantity;
        lockedTotal += lineTotal;
      }
      const row = document.createElement('div');
      row.className = 'bag-row' + (entry.locked ? ' is-locked' : '');
      const img = document.createElement('img'); img.src = product.image; img.alt = product.name;
      const details = document.createElement('div');
      const title = document.createElement('h3'); title.textContent = product.name;
      const options = document.createElement('p'); options.textContent = `Size ${variant.o.join(' / ')} · Quantity ${entry.quantity} · ${money(lineTotal)}${product.discount > 0 ? ` (-${product.discount}%)` : ''}`;
      details.append(title, options);
      if (product.url && /^https?:\/\//i.test(product.url)) {
        try {
          const url = new URL(product.url);
          const link = document.createElement('a');
          link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'View item ↗';
          details.append(link);
        } catch (_) {}
      }
      const lockWrap = document.createElement('div');
      const lockLabel = document.createElement('label');
      lockLabel.className = 'bag-lock-check';
      const lockCheck = document.createElement('input');
      lockCheck.type = 'checkbox';
      lockCheck.checked = Boolean(entry.locked);
      lockCheck.setAttribute('aria-label', 'Lock Item ' + product.name);
      lockCheck.onchange = () => {
        entry.locked = lockCheck.checked;
        entry.lockedAt = entry.locked ? Date.now() : null;
        save();
        render();
      };
      const lockText = document.createElement('span');
      lockText.textContent = entry.locked ? 'Lock Item ✓' : 'Lock Item';
      lockLabel.append(lockCheck, lockText);
      lockWrap.append(lockLabel);
      if (entry.locked && entry.lockedAt) {
        const ttl = document.createElement('span');
        ttl.className = 'bag-lock-ttl';
        ttl.textContent = window.SahiraLockOrders?.formatRemainingLock?.(entry.lockedAt) || 'Baki 24j';
        lockWrap.append(ttl);
      }
      if (product.offerActive) {
        const offerTag = document.createElement('div');
        offerTag.className = 'bag-offer-tag';
        const offerName = document.createElement('strong');
        offerName.textContent = `${product.offerLabel} -${product.discount}%`;
        const offerTime = document.createElement('span');
        offerTime.setAttribute('data-bag-offer-countdown', product.offerEndsAt);
        offerTime.textContent = `Tamat dalam ${formatBagCountdown(product.offerEndsAt)}`;
        offerTag.append(offerName, offerTime);
        details.append(offerTag);
        hasLiveOffer = true;
      }
      details.append(lockWrap);
      const remove = document.createElement('button');
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Remove ' + product.name);
      remove.onclick = () => { entries = entries.filter(e => e.id !== entry.id); save(); render(); };
      row.append(img, details, remove);
      list.append(row);
    }
    if (counterEl) {
      counterEl.textContent = `${lockedCount} / ${entries.length} item di-lock`;
    }
    if (lockAllBtn) {
      const allLocked = entries.length > 0 && lockedCount === entries.length;
      lockAllBtn.textContent = allLocked ? 'Nyah-tick Semua' : 'Tick Lock Semua';
      lockAllBtn.classList.toggle('is-all', allLocked);
    }
    const totalEl = document.getElementById('bag-total');
    if (totalEl) {
      if (!entries.length) totalEl.textContent = '';
      else if (lockedCount > 0) totalEl.textContent = `Jumlah Di-Lock (${lockedUnits} unit): ${money(lockedTotal)} · Anggaran keseluruhan ${money(total)}`;
      else totalEl.textContent = `Anggaran keseluruhan ${money(total)} · Sila tick Lock Item`;
    }
    clearInterval(bagOfferTimer);
    if (hasLiveOffer) {
      bagOfferTimer = setInterval(() => {
        let ended = false;
        list.querySelectorAll('[data-bag-offer-countdown]').forEach(el => {
          const iso = el.getAttribute('data-bag-offer-countdown') || '';
          if (Date.parse(iso) > Date.now()) el.textContent = `Tamat dalam ${formatBagCountdown(iso)}`;
          else ended = true;
        });
        if (ended) render();
      }, 1000);
    }
    if (exportBtn) exportBtn.disabled = !entries.length;
    if (exportLabel) {
      exportLabel.textContent = lockedCount > 0 ? `Hantar ke WhatsApp (${lockedCount} Lock Item)` : 'Hantar ke WhatsApp';
    }
  }
  async function add(items) {
    const catalog = await catalogPromise;
    for (const item of items) {
      if (!Number.isSafeInteger(item.id) || item.quantity !== 1 || !find(catalog, item.id)) throw new Error('Item out of stock or unavailable size.');
      const existing = entries.find(e => e.id === item.id);
      if (existing) existing.quantity = Math.min(20, existing.quantity + 1);
      else entries.push({ id: item.id, quantity: 1, locked: false, lockedAt: null });
    }
    save(); await render(); notify(items.length === 1 ? 'Piece saved to your styling bag' : 'Look saved to your styling bag');
  }
  document.getElementById('bag-lock-all')?.addEventListener('click', () => {
    if (!entries.length) return;
    const allLocked = entries.every(e => e.locked);
    const now = Date.now();
    entries.forEach(e => {
      e.locked = !allLocked;
      e.lockedAt = e.locked ? (e.lockedAt || now) : null;
    });
    save();
    render();
  });
  document.getElementById('open-bag').addEventListener('click',()=>{
    window.SahiraAuth?.refresh?.();
    render().then(()=>document.getElementById('bag-dialog').showModal()).catch(e=>notify(e.message));
  });
  document.getElementById('close-bag').addEventListener('click',()=>document.getElementById('bag-dialog').close());
  document.getElementById('bag-dialog').addEventListener('click',event=>{if(event.target===event.currentTarget){const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.currentTarget.close();}});
  document.getElementById('export-bag').addEventListener('click',async()=>{
    const catalog = await catalogPromise;
    sweepLocks(false);
    const lockedEntries = entries.filter(e => e.locked && find(catalog, e.id));
    if (!lockedEntries.length) {
      notify('Sila tick Lock Item pada sekurang-kurangnya 1 item sebelum hantar ke WhatsApp.');
      const firstCheck = document.querySelector('#bag-items .bag-lock-check input');
      if (firstCheck) firstCheck.focus();
      return;
    }
    const loggedUser = window.SahiraAuth?.getUser?.();
    const rawName = (document.getElementById('bag-customer-name')?.value || '').trim();
    const rawPhone = (document.getElementById('bag-customer-phone')?.value || '').trim();
    const customerName = rawName || loggedUser?.name || 'Pelanggan Sahira';
    const customerPhone = rawPhone || loggedUser?.phone || '';

    if (!loggedUser && rawName.length >= 2 && (window.SahiraAuth?.normalizePhone?.(rawPhone).length || 0) >= 8) {
      window.SahiraAuth?.signInOrRegister?.({ name: rawName, phone: rawPhone, mode: 'signup', silent: true });
    }

    const lockedItems = lockedEntries.map(e => {
      const { product, variant } = find(catalog, e.id);
      return {
        id: product.id,
        variantId: variant.id,
        name: product.name,
        size: variant.o.join(' / '),
        qty: e.quantity,
        unitPrice: product.price,
        image: product.image
      };
    });
    const order = window.SahiraLockOrders.addOrder({ customerName, customerPhone, items: lockedItems });
    window.SahiraAdminRefreshOrders?.();
    window.SahiraAuth?.refresh?.();
    const receiptEl = document.getElementById('bag-lock-receipt');
    if (receiptEl) {
      receiptEl.hidden = false;
      receiptEl.innerHTML = `<strong>✓ Lock Item #${order.ref} direkodkan (Tempoh Lock: 24 Jam)</strong><span>Sila lampirkan <b>screenshot</b> senarai ini di WhatsApp. Item akan <b>auto-unlock selepas 24 jam</b> jika pembayaran tidak disahkan.</span>`;
    }
    const lockedSubtotal = lockedItems.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
    const lines = [
      '*SAHIRA PREMIUM OUTLET — LOCK ITEM & TEMPAHAN*',
      `No. Rujukan: #${order.ref}`,
      `Nama: ${customerName}`,
      ...(customerPhone ? [`No. Telefon: ${customerPhone}`] : []),
      '',
      '*Senarai Item Di-Lock:*',
      ...lockedItems.map((it, idx) => `${idx + 1}. [LOCK ✓] ${it.name} · Saiz ${it.size} · Kuantiti ${it.qty} · ${money(it.unitPrice * it.qty)}`),
      '',
      `*Jumlah Lock Item:* ${money(lockedSubtotal)}`,
      '*Tempoh Lock:* 24 jam (auto-unlock jika tiada bayaran lengkap)',
      '',
      '_Nota: Saya telah screenshot senarai pilihan ini dan tick Lock Item untuk pengesahan & pembayaran._'
    ];
    const waText = encodeURIComponent(lines.join('\n'));
    const waDigits = getBoutiqueWhatsapp();
    const waUrl = waDigits ? `https://wa.me/${waDigits}?text=${waText}` : `https://wa.me/?text=${waText}`;
    const link = document.createElement('a');
    link.href = waUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
    notify(`Tempahan #${order.ref} direkodkan! Membuka WhatsApp...`);
  });
  setInterval(() => {
    window.SahiraLockOrders?.getOrders?.();
    const expiredBag = sweepLocks(true);
    if (expiredBag > 0 && document.getElementById('bag-dialog')?.open) render();
    window.SahiraAuth?.refresh?.();
    window.SahiraAdminRefreshOrders?.();
  }, 60000);
  async function lockNow(variantId) {
    const catalog = await catalogPromise;
    if (!Number.isSafeInteger(variantId) || !find(catalog, variantId)) {
      throw new Error('Item habis stok atau saiz tidak tersedia.');
    }
    const now = Date.now();
    const existing = entries.find(e => e.id === variantId);
    if (existing) {
      existing.locked = true;
      existing.lockedAt = existing.lockedAt || now;
    } else {
      entries.push({ id: variantId, quantity: 1, locked: true, lockedAt: now });
    }
    save();
    window.SahiraAuth?.refresh?.();
    await render();
    const lb = document.getElementById('orbit-lightbox');
    if (lb?.open) lb.close();
    const dlg = document.getElementById('bag-dialog');
    if (dlg && !dlg.open) dlg.showModal();
    notify('Item berjaya di-lock! Lengkapkan maklumat & hantar ke WhatsApp.');
  }
  render().catch(e=>notify(e.message));
  return {
    add,
    lockNow,
    render,
    sweepLocks,
    openBag() {
      window.SahiraAuth?.refresh?.();
      render().then(() => document.getElementById('bag-dialog')?.showModal()).catch(e => notify(e.message));
    },
    updateCatalog(newItems, newLooks) {
      if (Array.isArray(newItems)) {
        catalogData.items = newItems.map(toCatalogItem);
      }
      if (Array.isArray(newLooks)) {
        catalogData.looks = newLooks.map(lk => ({
          name: lk.name,
          description: lk.desc || lk.name,
          image: lk.src,
          products: lk.products || []
        }));
      }
      render();
    },
    get entries(){return entries.map(e=>({...e}));}
  };
})();


  (() => {
    if (customElements.get('runway-section')) return;

    // walk physics: [spring stiffness, follow delay per place in line (s)] — critically damped, never overshoots
    const FEEL = { soft: [60, 0.05], balanced: [95, 0.04], snappy: [160, 0.03] };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const TAU = Math.PI * 2;

    /*  Three ways to present the looks
        ring    (desktop) — the queue stands on a slowly turning 3D ring, always facing camera;
                            sides softly blurred, the back more. The active look morphs in place.
        cinema  (desktop) — an edge-to-edge line, smallest left → tallest right. The line steps
                            right, the departing body ghosts back to the far end, the active
                            look morphs in place.
        scroll  (mobile)  — the section pins while the page scrolls; scrolling walks the line
                            one look per stop and scrubs the morph of the active look.          */

    class RunwaySection extends HTMLElement {
      connectedCallback() {
        if (this._ready) return;
        this._ready = true;
        this.querySelectorAll('[data-rw-clone]').forEach((x) => x.remove());   // re-attached in the editor
        this.stage = this.querySelector('[data-rw-stage]');
        this.actorLayer = this.querySelector('[data-rw-actors]');
        this.heroes = Array.from(this.querySelectorAll('[data-rw-hero]'));
        this.base = Array.from(this.querySelectorAll('[data-rw-model]'));
        this.n = this.heroes.length;
        if (!this.n || !this.stage) return;

        this.panels = Array.from(this.querySelectorAll('[data-rw-panel]'));
        this.ticks = Array.from(this.querySelectorAll('[data-rw-tick]'));
        this.piecesEl = this.querySelector('[data-rw-pieces]');
        this.liveEl = this.querySelector('[data-rw-live]');
        this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.design = !!(window.Shopify && Shopify.designMode);
        if (this.design) this.classList.add('rw--design');   // theme editor: piece dots stay visible for positioning

        // luxury layer: staged intro (skipped in the editor and for reduced motion)
        this.classList.add('rw--js');
        if (this.reduce || this.design) this.classList.add('is-revealed');
        this.lb = this.querySelector('[data-rw-lb]');
        this.lbStage = this.querySelector('[data-rw-lb-stage]');

        const f = FEEL[this.dataset.feel] || FEEL.balanced;
        this.K = f[0];
        this.C = 2 * Math.sqrt(f[0]);   // critical damping: arrives smoothly, no bounce
        this.lag = f[1];
        this.blurOn = this.dataset.blur === 'true';
        this.motionBlur = this.dataset.mblur === 'true';
        this.speed = parseInt(this.dataset.speed || '5000', 10);

        // bodies for the queue: originals + clones so the ring / line never runs out
        this.N = this.n * Math.ceil(8 / this.n);
        const els = [];
        for (let a = 0; a < this.N; a++) {
          let el = this.base[a % this.n];
          if (a >= this.n) {
            el = el.cloneNode(true);
            el.setAttribute('data-rw-clone', '');
            el.querySelectorAll('img').forEach((x) => x.setAttribute('loading', 'lazy'));
            this.actorLayer.appendChild(el);
          }
          els.push(el);
        }
        this.index = 0;
        this.target = 0;      // where the line is heading (continuous for drag / scroll)
        this.cur = 0;         // where the ring / scroll line is now
        this.vel = 0;
        const start = this.reduce || this.design ? 0 : 1.15;   // first view: the line walks in
        this.sim = els.map((el, a) => ({
          el, a, look: a % this.n, hit: el.querySelector('[data-rw-go]'),
          x: a + start, v: 0, g: a + start, prev: a, trip: false, from: 0, blur: -1, w: 0
        }));
        this.cur = -start;

        this.step = this.step.bind(this);
        this.onScroll = this.onScroll.bind(this);
        this.querySelectorAll('img[data-model-image]').forEach(window.decodeRunwayImage);
        this.measure();
        this.bind();
        this.setIndex(0, { silent: true });
        this.initPickers();
        this.heroes.forEach((h, i) => this.findFeet(h, i));

        this.io = new IntersectionObserver((entries) => {
          this.visible = entries[0].isIntersecting;
          if (this.visible) this.kick();
        }, { threshold: 0 });
        this.io.observe(this);

        // the intro plays once, when a good part of the section is on screen
        if (!this.classList.contains('is-revealed')) {
          this.revealIO = new IntersectionObserver((entries) => {
            if (!entries[0].isIntersecting) return;
            this.revealIO.disconnect();
            requestAnimationFrame(() => requestAnimationFrame(() => this.classList.add('is-revealed')));
          }, { threshold: 0, rootMargin: '0px 0px -22% 0px' });
          this.revealIO.observe(this);
        }

        if (this.dataset.autoplay === 'true' && !this.reduce && !this.design && this.mode !== 'scroll') this.play(true);
      }

      disconnectedCallback() {
        cancelAnimationFrame(this.raf);
        this.raf = null;
        clearTimeout(this.autoTimer);
        clearTimeout(this.snapT);
        this.ro && this.ro.disconnect();
        if (this._roRaf) { cancelAnimationFrame(this._roRaf); this._roRaf = null; }
        this.io && this.io.disconnect();
        this.revealIO && this.revealIO.disconnect();
        if (this._cursor) { cancelAnimationFrame(this._cursor.raf); this._cursor.raf = null; }
        clearTimeout(this._zoomT);
        if (this._host) { this._host.querySelectorAll('[data-rw-picker]').forEach((pk) => { pk.hidden = true; this.dock(pk); }); this._host.remove(); this._host = null; }
        window.removeEventListener('scroll', this.onScroll);
        window.removeEventListener('resize', this._onResize);
        document.removeEventListener('shopify:block:select', this._onBlockSelect);
        document.removeEventListener('visibilitychange', this._onVis);
        this._ready = false;
      }

      rebuild() {
        const wasVisible = !this.hidden;
        const prevIndex = this.index || 0;
        if (this.zoomed) this.zoom(false);
        this.disconnectedCallback();
        this.connectedCallback();
        if (this.n > 0) {
          const safeIdx = Math.min(prevIndex, this.n - 1);
          if (safeIdx > 0) this.setIndex(safeIdx, { silent: true });
          this.target = this.cur = safeIdx;
        }
        if (wasVisible) {
          requestAnimationFrame(() => {
            this.measure();
            this.kick();
          });
        }
      }

      /* Cut-outs often carry transparent space under the feet: measure it once so every
         model stands exactly on the floor and the contact shadow sits at the soles. */
      findFeet(hero, look) {
        const url = hero.dataset.probe;
        if (!url) return;
        const applyMetrics = m => {
          hero.style.setProperty('--rw-foot', m.footY);
          hero.style.setProperty('--rw-foot-x', m.footX);
          hero.style.setProperty('--rw-foot-w', m.rwFootW);
          this.sim.forEach((s) => {
            if (s.look === look) {
              s.el.style.setProperty('--rw-foot', m.footY);
              s.el.style.setProperty('--rw-foot-x', m.footX);
              s.el.style.setProperty('--rw-foot-w', m.rwFootW);
            }
          });
        };
        if (window.SahiraCutoutFeet) {
          window.SahiraCutoutFeet.probe(url).then(applyMetrics);
        }
      }

      /* ---------------- layout ---------------- */
      measure() {
        const mobile = window.matchMedia('(max-width: 749px)').matches;
        const wasScroll = this.mode === 'scroll';
        const style = mobile ? (this.dataset.mstyle || 'line') : this.dataset.style;
        this.mode = style === 'line' || style === 'cinema' ? 'cinema' : (style === 'classic' ? 'classic' : 'ring');
        this.mobile = mobile;
        if (!mobile && this._host) { this._host.querySelectorAll('[data-rw-picker]').forEach((pk) => this.dock(pk)); this.syncPicking(); }   // desktop shows pickers inline
        this.classList.toggle('rw--scroll', this.mode === 'scroll');
        this.classList.toggle('rw--ring', this.mode === 'ring');
        this.classList.toggle('rw--cinema', this.mode === 'cinema');
        this.classList.toggle('rw--classic', this.mode === 'classic');
        this.morph = this.mode === 'cinema' || this.mode === 'scroll';   // only the line-up morphs
        this.classList.toggle('rw--morph', this.morph);

        if (this.mode === 'scroll') {
          // the section is as tall as the walk; its inner frame pins to the viewport
          const vh = window.innerHeight;
          this.stick = this.stickyTop();
          this.stepPx = Math.max(160, (vh * parseInt(this.dataset.step || '60', 10)) / 100);
          this.style.setProperty('--rw-stick', this.stick + 'px');
          // the pinned frame is exactly one screen tall
          this.frameH = vh - this.stick;
          this.style.setProperty('--rw-frame-h', Math.round(this.frameH) + 'px');
          this.style.height = Math.round(this.frameH + (this.n - 1) * this.stepPx) + 'px';
          if (!wasScroll) { this.cur = this.progress(); this.target = this.cur; }
        } else {
          this.style.height = '';
          if (wasScroll) { this.target = this.cur = Math.round(this.cur); }
          // header + announcement bar + this section fit inside one screen together
          // phones: the URL bar resizes the viewport while scrolling — keep the frame steady
          const vw = window.innerWidth, ih = window.innerHeight;
          if (!(mobile && this._vh && vw === this._vw && Math.abs(ih - this._vh) < 160)) { this._vw = vw; this._vh = ih; }
          const heightMode = (mobile ? this.dataset.mheightMode : this.dataset.heightMode) || 'original';
          const heightValue = Number(mobile ? this.dataset.mheightVh : this.dataset.heightVh) || 100;
          if (heightMode === 'custom') {
            // Only the runway receives the additional room; product sizes are independent.
            this.frameH = this._vh * clamp(heightValue, 50, 120) / 100;
          } else if (heightMode === 'fullscreen') {
            this.frameH = this._vh;
          } else {
            // Preserve the existing layout and header-fit behavior by default.
            this.frameH = Math.max(380, this._vh - (this.dataset.fit === 'true' ? this.headerHeight() : 0));
          }
          this.style.setProperty('--rw-frame-h', Math.round(this.frameH) + 'px');
        }

        const r = this.stage.getBoundingClientRect();
        this.W = r.width;
        this.H = r.height;
        this.fs = this.mode === 'ring' ? 1.08 : 1;   // ring: the active model stands a little taller
        // The models fill the stage left by the chosen frame height and product panel.
        const room = this.mode === 'ring' ? (this.H - 34 - 18) / this.fs
          : this.mode === 'classic' ? this.H - (this.mobile ? 24 : 36) - 18
          : this.H - (this.mobile ? 20 : 30) - 18;
        this.modelH = Math.max(200, Math.round(room));
        this.stage.style.setProperty('--rw-model-h', this.modelH + 'px');

        this.style.setProperty('--rw-fs', this.fs);
        if (this.mode === 'classic') {
          this.Cl = this.mobile
            ? { ax: 0.3, ay: 22, sx: 0.32, sy: 22, sr: 0.76, ex: 0.55, d: 4 }
            : { ax: 0.4, ay: 36, sx: 0.125, sy: 58, sr: 0.76, ex: 0.38, d: 5 };
          this.unit = Math.max(90, this.W * this.Cl.sx * 1.6);
          this.hx = this.W * this.Cl.ax; this.hy = this.Cl.ay;
        } else if (this.mode === 'ring') {
          this.cx = this.W * 0.5;
          this.R = this.W * (this.mobile ? 0.72 : 0.62);
          this.P = this.W * (this.mobile ? 1.9 : 1.65);
          this.floor = this.H - 34;                 // front feet (px from top)
          this.horizon = this.H * 0.36;             // perspective origin
          this.unit = Math.max(this.mobile ? 90 : 120, this.W * 0.3);
          this.hx = this.cx; this.hy = 34;
        } else {
          this.L = this.mobile
            ? { ax: 0.74, g1: 0.36, r: 0.95, s0: 0.34, sr: 0.55, ay: 20, rise: 2 }
            : { ax: 0.75, g1: 0.2, r: 0.86, s0: 0.3, sr: 0.6, ay: 30, rise: 3 };
          this.unit = Math.max(80, this.W * this.L.g1);
          this.hx = this.W * this.L.ax; this.hy = this.L.ay;
        }
        this.stage.style.setProperty('--rw-hx', this.hx.toFixed(1) + 'px');
        this.stage.style.setProperty('--rw-hy', this.hy + 'px');
        this.style.setProperty('--rw-ax', ((this.hx / (this.W || 1)) * 100).toFixed(2) + '%');
        this.sim.forEach((s) => { s.w = s.el.offsetWidth || s.w; s.blur = -1; });
        this.heroes.forEach((h) => { if (this.mode !== 'scroll') { const m = h.firstElementChild; m.style.opacity = ''; m.style.filter = ''; m.style.transform = ''; } });
        this.renderAll();
        if (this.zoomed) this.layoutZoom();
      }

      // a shopper is working with the products: the look must not change under them
      engage() {
        this.engaged = true;
        if (this.playing) this.play(false);
      }

      /* ---------------- look popup ---------------- */
      // the front model opens on her own, larger, with the piece dots; the product panel stays as it is
      zoom(open) {
        if (!this.lb || !this.lbStage || open === !!this.zoomed) return;
        const hero = this.front || this.heroes[this.index];
        const src = hero && hero.querySelector('.rw__figure');
        if (!src) return;
        clearTimeout(this._zoomT);
        if (open) {
          this.engage();
          this.clearHot();
          const wrap = document.createElement('div');
          wrap.className = 'rw__lb-model';
          const shadow = hero.querySelector('.rw__morph > .rw__shadow');
          if (shadow) wrap.appendChild(shadow.cloneNode(true));
          const fig = src.cloneNode(true);
          fig.querySelectorAll('[data-rw-zoom]').forEach((x) => x.remove());
          fig.querySelectorAll('[data-rw-pin]').forEach((p) => { p.tabIndex = 0; p.classList.remove('is-hot'); });
          fig.querySelectorAll('img').forEach((im) => im.setAttribute('loading', 'eager'));
          fig.querySelectorAll('img[data-model-image]').forEach(window.decodeRunwayImage);
          wrap.appendChild(fig);
          wrap.style.setProperty('--rw-foot', getComputedStyle(hero).getPropertyValue('--rw-foot').trim() || '0');
          this.lbStage.replaceChildren(wrap);
          this.lbModel = wrap;
          const no = this.index + 1;
          const kicker = this.lb.querySelector('[data-rw-lb-kicker]');
          const name = this.lb.querySelector('[data-rw-lb-name]');
          if (kicker) kicker.textContent = `${this.lb.dataset.word || ''} ${no < 10 ? '0' : ''}${no}`.trim();
          if (name) name.textContent = hero.dataset.name || '';
          this.zoomed = true;
          this.layoutZoom();
          this.classList.add('rw--zoom');
          this.lb.setAttribute('aria-hidden', 'false');
          this.flip(wrap, src, true);
          const close = this.lb.querySelector('[data-rw-zoom-close]');
          close && close.focus({ preventScroll: true });
        } else {
          this.zoomed = false;
          this.clearHot();
          const hadFocus = this.lb.contains(document.activeElement);
          if (this.lbModel) this.flip(this.lbModel, src, false);
          this.classList.remove('rw--zoom');
          this.lb.setAttribute('aria-hidden', 'true');
          this._zoomT = setTimeout(() => { if (!this.zoomed) { this.lbStage.replaceChildren(); this.lbModel = null; } }, 950);
          if (hadFocus) this.stage.focus({ preventScroll: true });
        }
      }

      // the popup model is as tall as the popup allows
      layoutZoom() {
        const wrap = this.lbModel;
        if (!wrap) return;
        const fig = wrap.querySelector('.rw__figure');
        const ar = parseFloat(fig.style.getPropertyValue('--rw-ar')) || 0.353;
        const r = this.lbStage.getBoundingClientRect();
        const h = Math.max(160, Math.min(r.height, r.width / ar));
        wrap.style.setProperty('--rw-model-h', Math.round(h) + 'px');
        fig.querySelectorAll('img').forEach((im) => { im.sizes = Math.round(h * ar) + 'px'; });
      }

      // FLIP: the popup model grows out of (and shrinks back into) the model on the runway
      flip(wrap, src, opening) {
        if (this.reduce) return;
        const fig = wrap.querySelector('.rw__figure');
        const a = src.getBoundingClientRect();
        const b = fig.getBoundingClientRect();
        if (!a.height || !b.height) return;
        const at = `translate3d(${(a.left - b.left).toFixed(1)}px,${(a.bottom - b.bottom).toFixed(1)}px,0) scale(${(a.height / b.height).toFixed(4)})`;
        wrap.style.transformOrigin = '0 100%';
        if (opening) {
          wrap.style.transition = 'none';
          wrap.style.transform = at;
          void wrap.offsetWidth;
          wrap.style.transition = '';
          wrap.style.transform = '';
        } else {
          wrap.style.transform = at;
        }
      }

      /* ---------------- variant pickers: inline on desktop, a bottom sheet on phones ----------------
         On phones the open picker is moved into a host at the end of <body>: a theme wrapper with a
         transform (or iOS scrolling) would otherwise trap a fixed sheet inside the section. */
      pickerOf(card) { return card && (card._pk || card.querySelector('[data-rw-picker]')); }

      sheetHost() {
        if (this._host && this._host.isConnected) return this._host;
        const host = document.createElement('div');
        host.className = 'rw-sheet-host';
        const scrim = document.createElement('button');
        scrim.type = 'button';
        scrim.className = 'rw__pick-scrim';
        scrim.tabIndex = -1;
        scrim.setAttribute('aria-hidden', 'true');
        scrim.setAttribute('data-rw-pick-close', '');
        host.appendChild(scrim);
        host.addEventListener('click', (e) => this.onClick(e));
        host.addEventListener('change', (e) => {
          if (e.target.matches('[data-rw-option]')) { this.onOptionChange(e.target.closest('[data-rw-picker]')); this.engage(); }
        });
        host.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closePickers(); });
        document.body.appendChild(host);
        this._host = host;
        return host;
      }

      // the sheet sits outside the section, so it takes the section's colours and type with it
      themeHost(host) {
        const cs = getComputedStyle(this);
        ['--rw-panel', '--rw-text', '--rw-muted', '--rw-line', '--rw-accent', '--rw-on-accent', '--rw-btn-bg', '--rw-btn-fg', '--rw-btn-radius',
          '--rw-pill-radius', '--rw-bar-r', '--rw-thumb-radius', '--rw-pt-size', '--rw-price', '--rw-opt', '--rw-ease', '--rw-ease-sheet', '--rw-ease-spring']
          .forEach((v) => host.style.setProperty(v, cs.getPropertyValue(v)));
        host.style.fontFamily = cs.fontFamily;
        host.style.color = cs.color;
      }

      // move a picker back into its product card
      dock(pk) {
        if (pk && pk._card && pk.parentElement !== pk._card) pk._card.appendChild(pk);
      }

      openPicker(card, open) {
        const pk = this.pickerOf(card);
        if (!pk) return;
        if (open && this.mobile) {
          this.closePickers(card);   // one sheet at a time
          const host = this.sheetHost();
          this.themeHost(host);
          host.appendChild(pk);
        }
        pk.hidden = !open;
        if (!open) this.dock(pk);
        card.classList.toggle('is-picking', open);
        const btn = card.querySelector('[data-rw-add]');
        btn && btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        this.syncPicking();
      }
      closePickers(except) {
        this.querySelectorAll('[data-rw-card].is-picking').forEach((c) => { if (c !== except) this.openPicker(c, false); });
        this.syncPicking();
      }
      syncPicking() {
        const host = this._host;
        const on = !!(this.mobile && host && host.querySelector('[data-rw-picker]:not([hidden])'));
        this.classList.toggle('rw--picking', on);
        host && host.classList.toggle('is-open', on);
      }

      setStill(on) {
        if (this.still === on) return;
        this.still = on;
        this.classList.toggle('rw--still', on);
        if (!this.morph) this.renderAll();
      }

      headerHeight() {
        // the theme's header group (announcement bar + header) sits above the section on load
        let h = 0;
        document.querySelectorAll('.shopify-section-group-header-group, #shopify-section-header, #shopify-section-announcement-bar').forEach((el) => {
          if (el.contains(this)) return;
          const cs = getComputedStyle(el);
          if (cs.display !== 'none' && cs.position !== 'absolute') h += el.getBoundingClientRect().height;
        });
        return Math.round(h);
      }

      stickyTop() {
        let top = parseInt(this.dataset.offset || '0', 10);
        const hdr = document.querySelector('header-component, .header-wrapper, #header-group, .shopify-section-group-header-group');
        if (hdr) {
          const cs = getComputedStyle(hdr.closest('.shopify-section') || hdr);
          if (cs.position === 'sticky' || cs.position === 'fixed') top += Math.round(hdr.getBoundingClientRect().height);
        }
        return top;
      }

      progress() {
        const r = this.getBoundingClientRect();
        return clamp((this.stick - r.top) / this.stepPx, 0, this.n - 1);
      }

      wrapN(v) { const N = this.N; return ((v % N) + N) % N; }

      /* ---------------- placement ---------------- */
      put(s, x, bottom, sc, o, blur, z) {
        const half = (s.w || 200) * sc * 0.5;
        if (x + half < -4 || x - half > this.W + 4) o = 0;
        const st = s.el.style;
        st.transform = `translate3d(${x.toFixed(2)}px,${(-bottom).toFixed(2)}px,0) translateX(-50%) scale(${sc.toFixed(4)})`;
        st.opacity = o.toFixed(3);
        st.zIndex = String(z);
        st.visibility = o < 0.01 ? 'hidden' : 'visible';
        st.pointerEvents = o < 0.5 ? 'none' : '';
        const bb = Math.round(blur * 10) / 10;
        if (bb !== s.blur) { st.filter = bb > 0.05 ? `blur(${bb}px)` : ''; s.blur = bb; }
      }

      placeRing(s) {
        const step = TAU / this.N;
        let phi = ((s.a - this.cur) * step) % TAU;
        if (phi > Math.PI) phi -= TAU;
        if (phi < -Math.PI) phi += TAU;
        const z = this.R * (1 - Math.cos(phi));
        const sl = Math.abs(phi) / step;
        const p = (this.P / (this.P + z)) * (1 + (this.fs - 1) * clamp(1 - sl, 0, 1));
        const x = this.cx + this.R * Math.sin(phi) * (this.P / (this.P + z));
        const feet = this.horizon + (this.floor - this.horizon) * (this.P / (this.P + z));
        let blur = 0;
        if (this.blurOn) blur = sl <= 1 ? 1.8 * sl : Math.min(1.8 + (sl - 1) * 2, 6.5);   // soft beside the front, stronger behind
        // the front place belongs to the morphing hero; the back of the ring fades away
        let o = clamp((Math.cos(phi) + 0.55) / 0.3, 0, 1);
        if (this.still && sl < 0.02) o = 0;   // at rest the identical hero (with pins) takes this place
        this.put(s, x, this.H - feet, p, o, blur, Math.round(p * 1000));
      }

      placeClassic(s) {
        const C = this.Cl, N = this.N;
        let k = s.x, e = -1;
        if (s.trip) {
          // the departing model walks out past the camera and rejoins the back (or the reverse)
          const goal = s.prev, fwd = goal > s.from;
          const u = clamp(Math.abs(s.x - s.from) / (Math.abs(goal - s.from) || 1), 0, 1);
          if (fwd) { if (u < 0.5) e = u * 2 * 1.4; else k = goal + (1 - u) * 2; }
          else { if (u < 0.5) k = s.from + u * 2; else e = (1 - u) * 2 * 1.4; }
        } else if (k < 0) e = Math.min(-k, 1.4);
        let x, b, sc, o, blur = 0, z;
        if (e >= 0) {
          x = this.W * (C.ax - C.ex * e); b = C.ay - 22 * e; sc = 1 + 0.14 * e;
          o = Math.max(0, 1 - e * 1.05); if (this.blurOn) blur = 4 * Math.min(e, 1); z = 1100;
        } else {
          x = this.W * (C.ax + C.sx * k); b = C.ay + C.sy * k; sc = Math.pow(C.sr, k);
          o = k <= C.d - 1 ? 1 - 0.13 * k : Math.max(0, (1 - 0.13 * (C.d - 1)) * (C.d - k));
          if (this.blurOn) blur = Math.min(k * 0.9, 3.2);
          if (this.still && Math.abs(k) < 0.02) o = 0;   // the matching hero carries the pins at rest
          z = 1000 - Math.round(k * 10);
        }
        this.put(s, x, b, sc, o, blur, z);
      }

      posLine(k) {
        const L = this.L;
        return {
          x: this.W * (L.ax - (L.g1 * (1 - Math.pow(L.r, k))) / (1 - L.r)),
          b: L.ay + L.rise * k,
          s: L.s0 + (1 - L.s0) * Math.pow(L.sr, k)
        };
      }

      placeLine(s) {
        const k = clamp(s.x, -1.5, this.N);
        let o, blur = 0, z;
        let p;
        if (k >= 0) {
          p = this.posLine(k);
          o = clamp((k - 0.12) / 0.55, 0, 1);              // hands over to the morphing hero at the front
          if (this.blurOn) blur = Math.min(k * 0.55, 2.2);
          z = 1000 - Math.round(k * 10);
        } else {
          p = this.posLine(0);
          p.x += this.W * 0.3 * -k;
          o = 0; z = 1;
        }
        if (s.trip) {
          // returning to the far end: a ghost passing behind the others
          const dist = Math.abs(s.g - s.x), done = Math.abs(s.x - s.from);
          const ghost = clamp(Math.min(dist, done) / 0.55, 0, 1);
          o = o * (1 - 0.78 * ghost);
          blur += 3 * ghost;
          z = 5;
        }
        if (this.motionBlur && !this.mobile) blur += Math.min(Math.abs(s.v) * 0.45, 2);
        this.put(s, p.x, p.b, p.s, o, blur, z);
      }

      placeHeroes() {
        if (this.mode !== 'scroll') return;
        // scrubbed morph: each look's weight follows the scroll position
        this.heroes.forEach((h, i) => {
          const w = clamp(1 - Math.abs(this.cur - i), 0, 1);
          const m = h.firstElementChild;
          m.style.opacity = w.toFixed(3);
          m.style.filter = w > 0.995 ? 'none' : `blur(${((1 - w) * 14).toFixed(2)}px) brightness(${(1 + (1 - w) * 0.25).toFixed(3)})`;
          m.style.transform = `scale(${(0.97 + 0.03 * w).toFixed(4)})`;
          m.style.visibility = w < 0.01 ? 'hidden' : 'visible';
        });
      }

      renderAll() {
        if (this.mode === 'ring') this.sim.forEach((s) => this.placeRing(s));
        else if (this.mode === 'scroll') {
          this.sim.forEach((s) => {
            if (s.a >= this.n) { this.put(s, -9999, 0, 1, 0, 0, 0); return; }
            s.x = s.a - this.cur; s.v = this.vel; s.trip = false;
            this.placeLine(s);
          });
          this.placeHeroes();
        } else if (this.mode === 'classic') this.sim.forEach((s) => this.placeClassic(s));
        else this.sim.forEach((s) => this.placeLine(s));
      }

      kick() {
        if (this.raf || !this.visible) return;
        this.last = 0;
        this.raf = requestAnimationFrame(this.step);
      }

      step(t) {
        const dt = this.last ? Math.min(0.034, (t - this.last) / 1000) : 1 / 60;
        this.last = t;
        let busy = false;
        const K = this.K, C = this.C, sub = 3, h = dt / sub;

        if (this.mode === 'ring' || this.mode === 'scroll') {
          // one spring drives the whole ring / scroll line
          if (this.reduce) { this.cur = this.target; this.vel = 0; }
          else {
            const k2 = this.mode === 'scroll' ? K * 2.2 : K, c2 = 2 * Math.sqrt(k2);
            for (let j = 0; j < sub; j++) {
              const acc = -k2 * (this.cur - this.target) - c2 * this.vel;
              this.vel += acc * h;
              this.cur += this.vel * h;
            }
          }
          if (Math.abs(this.cur - this.target) > 0.0005 || Math.abs(this.vel) > 0.0005) busy = true;
          else { this.cur = this.target; this.vel = 0; }
          this.renderAll();
        } else {
          const N = this.N;
          for (const s of this.sim) {
            const goal = this.wrapN(s.a - this.target);
            if (Math.abs(goal - s.prev) > N / 2) { s.trip = true; s.from = s.x; }
            s.prev = goal;
            if (this.reduce) { s.x = s.g = goal; s.v = 0; s.trip = false; this.mode === 'classic' ? this.placeClassic(s) : this.placeLine(s); continue; }
            const tau = this.dragging ? 0.016 : s.trip ? 0.1 : 0.03 + this.lag * Math.min(goal, 4);
            s.g += (goal - s.g) * (1 - Math.exp(-dt / tau));
            for (let j = 0; j < sub; j++) {
              const acc = -K * (s.x - s.g) - C * s.v;
              s.v += acc * h;
              s.x += s.v * h;
            }
            if (s.trip && Math.abs(s.x - goal) < 0.02) s.trip = false;
            if (Math.abs(s.x - goal) > 0.0006 || Math.abs(s.v) > 0.0006 || Math.abs(s.g - goal) > 0.0006) busy = true;
            else { s.x = s.g = goal; s.v = 0; s.trip = false; }
            this.mode === 'classic' ? this.placeClassic(s) : this.placeLine(s);
          }
        }
        const moving = busy || this.dragging;
        if (moving) this.setStill(false);
        if (moving && this.visible && !document.hidden) this.raf = requestAnimationFrame(this.step);
        else { this.raf = null; if (!moving) this.setStill(true); }
      }

      /* ---------------- scroll mode ---------------- */
      onScroll() {
        if (this.mode !== 'scroll') return;
        const p = this.progress();
        this.target = p;
        const i = clamp(Math.round(p), 0, this.n - 1);
        if (i !== this.index) this.setIndex(i);
        this.kick();
        clearTimeout(this.snapT);
        if (this.dataset.snap === 'true') {
          this.snapT = setTimeout(() => {
            const r = this.getBoundingClientRect();
            if (r.top > this.stick + 2 || r.bottom < window.innerHeight - 2) return;  // only while pinned
            const q = this.progress();
            const d = (Math.round(q) - q) * this.stepPx;
            if (Math.abs(d) > 3) window.scrollBy({ top: d, behavior: 'smooth' });
          }, 160);
        }
      }

      scrollToLook(i) {
        const r = this.getBoundingClientRect();
        const top = window.scrollY + r.top - this.stick + clamp(i, 0, this.n - 1) * this.stepPx;
        window.scrollTo({ top: Math.round(top), behavior: this.reduce ? 'auto' : 'smooth' });
      }

      /* ---------------- state ---------------- */
      mod(i) { const n = this.n; return ((i % n) + n) % n; }
      moveTo(T) {
        if (this.mode === 'scroll') return this.scrollToLook(this.mod(Math.round(T)));
        this.target = T;
        this.setStill(false);
        this.setIndex(this.mod(Math.round(T)));
      }
      go(i) {
        if (this.mode === 'scroll') return this.scrollToLook(i);
        let d = this.mod(i - this.index);   // shortest way round the loop
        if (d > this.n / 2) d -= this.n;
        this.moveTo(Math.round(this.target) + d);
      }
      next() {
        if (this.mode === 'scroll') return this.scrollToLook(this.index + 1);
        this.moveTo(Math.round(this.target) + 1);
      }
      prev() {
        if (this.mode === 'scroll') return this.scrollToLook(this.index - 1);
        this.moveTo(Math.round(this.target) - 1);
      }

      rankOf(s) {
        if (this.mode === 'ring') {
          let k = this.wrapN(s.a - Math.round(this.target));
          if (k > this.N / 2) k -= this.N;
          return k;
        }
        return this.wrapN(s.a - Math.round(this.target));
      }

      // restart a one-shot CSS animation keyed on a class
      replay(el, cls) {
        if (!el) return;
        el.classList.remove(cls);
        void el.offsetWidth;
        el.classList.add(cls);
      }

      setIndex(i, opts = {}) {
        const changed = i !== this.index || opts.silent;
        const was = this.index;
        this.index = i;
        this.kick();
        // queue bodies near the front stay reachable from the keyboard
        this.sim.forEach((s) => {
          const k = this.rankOf(s);
          const near = k !== 0 && Math.abs(k) <= (this.mode === 'ring' ? 2 : 3) && this.mode !== 'scroll';
          if (s.hit) { s.hit.tabIndex = near ? 0 : -1; s.hit.setAttribute('aria-hidden', near ? 'false' : 'true'); }
          if (near) s.el.removeAttribute('aria-hidden'); else s.el.setAttribute('aria-hidden', 'true');
        });
        if (!changed) return;
        if (this.zoomed && !opts.silent) this.zoom(false);
        if (this.mobile && !opts.silent) this.closePickers();
        this.style.setProperty('--rw-progress', ((i + 1) / this.n).toFixed(3));

        // morph: the old look dissolves, the new one resolves in the same place
        this.heroes.forEach((h, j) => {
          h.classList.toggle('is-on', j === i);
          h.classList.toggle('was', j === was && j !== i && !opts.silent);
          h.setAttribute('aria-hidden', j === i ? 'false' : 'true');
          const z = h.querySelector('[data-rw-zoom]');
          if (z) z.tabIndex = j === i ? 0 : -1;
          if (!this.lb) h.querySelectorAll('[data-rw-pin]').forEach((p) => { p.tabIndex = j === i ? 0 : -1; });
        });
        this.front = this.heroes[i];
        if (!opts.silent && !this.reduce) this.replay(this.stage, 'is-sweep');

        if (this.liveEl && !opts.silent) this.liveEl.textContent = this.heroes[i].dataset.label || '';
        this.ticks.forEach((t, j) => {
          t.setAttribute('aria-current', j === i ? 'true' : 'false');
          t.classList.toggle('is-past', j < i);
        });
        this.panels.forEach((p, j) => {
          const on = j === i;
          p.hidden = !on;
          p.classList.remove('is-in');
          if (on && !opts.silent) { void p.offsetWidth; p.classList.add('is-in'); }
        });
        const active = this.panels[i];
        if (this.piecesEl && active) {
          const tpl = active.querySelector('[data-rw-pieces-text]');
          this.piecesEl.textContent = tpl ? tpl.textContent.trim() : '';
          if (!opts.silent) this.replay(this.piecesEl, 'is-swap');
        }
        this.clearHot();
        this.restartAutoBar();
      }

      /* ---------------- pin <-> product ---------------- */
      hot(n, scroll) {
        this.clearHot();
        const m = this.zoomed ? this.lb : this.front;
        const panel = this.panels[this.index];
        if (!panel) return;
        const pin = m && m.querySelector(`[data-rw-pin="${n}"]`);
        const card = panel.querySelector(`[data-rw-card="${n}"]`);
        pin && pin.classList.add('is-hot');
        if (card) {
          card.classList.add('is-hot');
          if (scroll) this.reveal(card);
        }
      }
      reveal(card) {
        const list = card.parentElement;
        const behavior = this.reduce ? 'auto' : 'smooth';
        if (list.scrollWidth > list.clientWidth + 2) {
          const lr = list.getBoundingClientRect(), cr = card.getBoundingClientRect();
          list.scrollTo({ left: list.scrollLeft + (cr.left - lr.left) - 20, behavior });
        } else if (list.scrollHeight > list.clientHeight + 2 && getComputedStyle(list).overflowY !== 'visible') {
          list.scrollTo({ top: card.offsetTop - list.offsetTop - 12, behavior });
        } else if (this.mode !== 'scroll') {
          const r = card.getBoundingClientRect();
          if (r.top < 0 || r.bottom > window.innerHeight - 140) window.scrollBy({ top: r.top - window.innerHeight * 0.3, behavior });
        }
      }
      clearHot() { this.querySelectorAll('.is-hot').forEach((el) => el.classList.remove('is-hot')); }

      /* ---------------- autoplay ---------------- */
      play(on) {
        if (this.mode === 'scroll') on = false;
        this.playing = on;
        this.classList.toggle('is-playing', on);
        const btn = this.querySelector('[data-rw-auto]');
        if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        this.restartAutoBar();
      }
      schedule() {
        clearTimeout(this.autoTimer);
        if (!this.playing) return;
        this.autoTimer = setTimeout(() => {
          if (this.playing && this.visible && !this.dragging && !document.hidden && !this.panelHover && !this.zoomed && !this.engaged) this.next();
          else this.restartAutoBar();
        }, this.speed);
      }
      restartAutoBar() {
        const t = this.ticks[this.index];
        this.ticks.forEach((x) => x.classList.remove('is-run'));
        if (this.playing && t) { void t.offsetWidth; t.classList.add('is-run'); }
        this.schedule();
      }

      /* ---------------- custom cursor (desktop) ---------------- */
      initCursor() {
        const c = this.querySelector('[data-rw-cursor]');
        if (!c) return;
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) { c.remove(); return; }
        this.classList.add('rw--cursor');
        const st = this._cursor = { x: 0, y: 0, tx: 0, ty: 0, raf: null };
        const loop = () => {
          const k = this.reduce ? 1 : 0.18;   // inertia: the ring trails the pointer a little
          st.x += (st.tx - st.x) * k;
          st.y += (st.ty - st.y) * k;
          c.style.transform = `translate3d(${st.x.toFixed(1)}px,${st.y.toFixed(1)}px,0)`;
          st.raf = Math.abs(st.tx - st.x) + Math.abs(st.ty - st.y) > 0.2 ? requestAnimationFrame(loop) : null;
        };
        this.stage.addEventListener('pointermove', (e) => {
          if (e.pointerType !== 'mouse') return;
          const r = this.stage.getBoundingClientRect();
          st.tx = e.clientX - r.left;
          st.ty = e.clientY - r.top;
          if (!c.classList.contains('is-on')) { st.x = st.tx; st.y = st.ty; c.classList.add('is-on'); }
          const view = !this.dragging && !!e.target.closest('.rw__zoom');
          c.classList.toggle('is-view', view);
          c.classList.toggle('is-link', !this.dragging && !view && !!e.target.closest('.rw__pin, .rw__hit'));
          if (!st.raf) st.raf = requestAnimationFrame(loop);
        });
        this.stage.addEventListener('pointerleave', () => c.classList.remove('is-on', 'is-link', 'is-view'));
      }

      /* ---------------- input ---------------- */
      bind() {
        // theme editor: selecting a look block shows that look
        this._onBlockSelect = this._onBlockSelect || ((e) => {
          const h = e.target.closest && e.target.closest('[data-rw-hero]');
          if (!h || !this.contains(h)) return;
          const i = this.heroes.indexOf(h);
          if (i < 0) return;
          this.play(false);
          this.go(i);
        });
        let rt;
        this._onResize = () => { clearTimeout(rt); rt = setTimeout(() => { this.measure(); this.onScroll(); }, 120); };
        window.addEventListener('resize', this._onResize);
        this.ro && this.ro.disconnect();
        this.ro = new ResizeObserver((entries) => {
          const entry = entries && entries[0];
          if (entry && entry.contentRect) {
            const nw = Math.round(entry.contentRect.width);
            const nh = Math.round(entry.contentRect.height);
            if (nw === 0 && nh === 0) return;
            if (this._roW === nw && this._roH === nh) return;
            this._roW = nw;
            this._roH = nh;
          }
          if (this._roRaf) return;
          this._roRaf = requestAnimationFrame(() => {
            this._roRaf = null;
            if (this.isConnected && !this.hidden) this.measure();
          });
        });
        this.ro.observe(this.stage);
        window.addEventListener('scroll', this.onScroll, { passive: true });

        this._onVis = () => { if (!document.hidden) this.kick(); };
        document.addEventListener('visibilitychange', this._onVis);
        document.addEventListener('shopify:block:select', this._onBlockSelect);
        if (this._bound) return;   // element listeners survive a detach / re-attach
        this._bound = true;

        this.addEventListener('click', (e) => this.onClick(e));
        this.addEventListener('change', (e) => {
          if (e.target.matches('[data-rw-option]')) this.onOptionChange(e.target.closest('[data-rw-picker]'));
        });
        // Esc closes the size sheet first, then the look popup
        this.addEventListener('keydown', (e) => {
          if (e.key !== 'Escape') return;
          if (this.classList.contains('rw--picking')) {
            const c = this.querySelector('[data-rw-card].is-picking');
            this.closePickers();
            const b = c && c.querySelector('[data-rw-add]');
            b && b.focus({ preventScroll: true });
          } else if (this.zoomed) this.zoom(false);
        });

        this.addEventListener('pointerover', (e) => {
          if (e.pointerType !== 'mouse') return;
          const card = e.target.closest('[data-rw-card]');
          if (card && this.contains(card)) this.hot(card.dataset.rwCard, false);
        });
        this.addEventListener('pointerout', (e) => {
          const card = e.target.closest('[data-rw-card]');
          if (card && !card.contains(e.relatedTarget)) this.clearHot();
        });

        this.stage.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); this.next(); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); this.prev(); }
        });

        // product interaction pauses autoplay (desktop hover pauses it temporarily)
        const panelBox = this.querySelector('.rw__panel');
        if (panelBox) {
          panelBox.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.panelHover = true; });
          panelBox.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { this.panelHover = false; this.restartAutoBar(); } });
          panelBox.addEventListener('click', (e) => { if (e.target.closest('button, a, input, select, label')) this.engage(); });
          panelBox.addEventListener('change', () => this.engage());
        }

        // horizontal trackpad swipe
        let acc = 0, lock = 0;
        this.stage.addEventListener('wheel', (e) => {
          if (this.mode === 'scroll' || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
          e.preventDefault();
          const now = performance.now();
          if (now < lock) return;
          acc += e.deltaX;
          if (Math.abs(acc) > 45) { ((acc < 0) === (this.mode === 'cinema')) ? this.next() : this.prev(); acc = 0; lock = now + 520; }
        }, { passive: false });

        // drag / swipe with momentum
        this.stage.addEventListener('pointerdown', (e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          this.drag = { x: e.clientX, y: e.clientY, t: this.target, id: e.pointerId, samples: [{ x: e.clientX, time: e.timeStamp }] };
        });
        this.stage.addEventListener('pointermove', (e) => {
          const d = this.drag;
          if (!d || e.pointerId !== d.id) return;
          if (e.pointerType === 'mouse' && !(e.buttons & 1)) { end(e); return; }
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (!this.dragging) {
            if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
              this.dragging = true;
              this.classList.add('is-dragging');
              try { this.stage.setPointerCapture(e.pointerId); } catch (_) {}
            } else if (Math.abs(dy) > 10) { this.drag = null; return; }
            else return;
          }
          d.samples.push({ x: e.clientX, time: e.timeStamp });
          if (d.samples.length > 6) d.samples.shift();
          d.dx = dx;
          if (this.mode === 'scroll') return;
          // ring: drag left turns the ring to the next look; cinema: drag right walks the line right
          this.target = this.mode === 'cinema' ? d.t + dx / this.unit : d.t - dx / this.unit;
          this.kick();
        });
        const end = (e) => {
          const d = this.drag;
          if (!d || (e.pointerId !== undefined && e.pointerId !== d.id)) return;
          this.drag = null;
          if (!this.dragging) return;
          this.dragging = false;
          this.classList.remove('is-dragging');
          this.suppress = true;
          setTimeout(() => { this.suppress = false; }, 60);
          const a = d.samples[0], z = d.samples[d.samples.length - 1];
          const vx = z.time > a.time ? (z.x - a.x) / (z.time - a.time) : 0;
          if (this.mode === 'scroll') {
            if (Math.abs(d.dx || 0) > 40) (d.dx < 0 ? this.next() : this.prev());
            return;
          }
          const sign = this.mode === 'cinema' ? 1 : -1;
          const from = Math.round(d.t);
          if (this.mobile) {
            // phones: one swipe = one look
            if (Math.abs(d.dx || 0) > 30 || Math.abs(vx) > 0.3) this.moveTo(from + sign * ((d.dx || vx) > 0 ? 1 : -1));
            else this.moveTo(from);
            return;
          }
          let i = Math.round(this.target + (sign * vx * 160) / this.unit);
          if (i === from && Math.abs(vx) > 0.3) i += sign * (vx > 0 ? 1 : -1);
          i = clamp(i, from - 2, from + 2);
          this.moveTo(i);
        };
        this.stage.addEventListener('pointerup', end);
        this.stage.addEventListener('pointercancel', end);
        this.stage.addEventListener('click', (e) => { if (this.suppress) { e.preventDefault(); e.stopPropagation(); } }, true);

        this.initCursor();
      }

      onClick(e) {
        const t = e.target;
        let el;
        if ((el = t.closest('[data-rw-pick-close]'))) return this.closePickers();
        if ((el = t.closest('[data-rw-zoom-close]'))) return this.zoom(false);
        if (this.lb && (t === this.lb || t === this.lbStage)) return this.zoom(false);   // tap beside the model
        if ((el = t.closest('[data-rw-zoom]'))) return this.zoom(true);
        if ((el = t.closest('[data-rw-next]'))) return this.next();
        if ((el = t.closest('[data-rw-prev]'))) return this.prev();
        if ((el = t.closest('[data-rw-tick]'))) return this.go(parseInt(el.dataset.rwTick, 10));
        if ((el = t.closest('[data-rw-auto]'))) { if (!this.playing) this.engaged = false; return this.play(!this.playing); }
        if ((el = t.closest('[data-rw-pin]'))) { this.engage(); return this.hot(el.dataset.rwPin, true); }
        if ((el = t.closest('[data-rw-go]'))) {
          // tapping a model in the queue brings her to the front
          const s = this.sim.find((x) => x.el.contains(el));
          const k = s ? this.rankOf(s) : 0;
          if (k && Math.abs(k) < this.N / 2) this.moveTo(Math.round(this.target) + k);
          else if (!k) this.zoom(true);   // the front model opens in the popup
          return;
        }
        if ((el = t.closest('[data-rw-confirm]'))) { const pk = el.closest('[data-rw-picker]'); return this.onConfirm((pk && pk._card) || el.closest('[data-rw-card]')); }
        if ((el = t.closest('[data-rw-add]'))) return this.onAdd(el.closest('[data-rw-card]'));
        if ((el = t.closest('[data-rw-all]'))) return this.addFullLook(el.closest('[data-rw-panel]'), el);
      }

      /* ---------------- variant pickers ---------------- */
      initPickers() {
        this.querySelectorAll('[data-rw-picker]').forEach((pk) => {
          try { pk._variants = JSON.parse(pk.querySelector('[data-rw-variants]').textContent); } catch (_) { pk._variants = []; }
          pk._card = pk.closest('[data-rw-card]');
          if (pk._card) pk._card._pk = pk;
          this.onOptionChange(pk, true);
        });
      }
      selected(pk) {
        const groups = {};
        pk.querySelectorAll('[data-rw-option]').forEach((inp) => {
          const g = inp.dataset.rwOption;
          if (inp.tagName === 'SELECT') groups[g] = inp.value;
          else if (inp.checked) groups[g] = inp.value;
        });
        return Object.keys(groups).sort().map((k) => groups[k]);
      }
      onOptionChange(pk, initial) {
        if (!pk) return;
        const card = pk._card || pk.closest('[data-rw-card]');
        const sel = this.selected(pk);
        const vs = pk._variants || [];
        const match = vs.find((v) => v.o.every((o, i) => o === sel[i]));
        // availability of each value given the other current selections (theme-style strike-through)
        pk.querySelectorAll('input[data-rw-option]').forEach((inp) => {
          const g = parseInt(inp.dataset.rwOption, 10);
          const ok = vs.some((v) => v.a && v.o[g] === inp.value && v.o.every((o, i) => i === g || o === sel[i]));
          inp.closest('.rw__pill').classList.toggle('is-unavailable', !ok);
        });
        pk.querySelectorAll('select[data-rw-option]').forEach((sl) => {
          const g = parseInt(sl.dataset.rwOption, 10);
          Array.from(sl.options).forEach((op) => {
            const ok = vs.some((v) => v.a && v.o[g] === op.value && v.o.every((o, i) => i === g || o === sel[i]));
            op.textContent = op.value + (ok ? '' : ' — ' + (this.dataset.msgSoldout || 'Sold out'));
          });
        });
        pk.querySelectorAll('[data-rw-swatch-name]').forEach((el) => {
          const fs = el.closest('fieldset');
          const c = fs && fs.querySelector('input:checked');
          if (c) el.textContent = c.value;
        });
        const btn = pk.querySelector('[data-rw-confirm]');
        const label = pk.querySelector('[data-rw-confirm-label]');
        const ok = !!(match && match.a);
        if (btn) btn.disabled = !ok;
        if (label) label.textContent = ok ? label.dataset.add : (this.dataset.msgSoldout || 'Sold out');
        card.dataset.selected = ok ? match.id : '';
        if (!initial) card.dataset.touched = '1';
      }

      /* ---------------- cart ---------------- */
      msg(panel, text) { const m = panel && panel.querySelector('[data-rw-msg]'); if (m) m.textContent = text || ''; }

      // a light haptic tick on phones that support it
      buzz() {
        if (!this.mobile || this.reduce || typeof navigator.vibrate !== 'function') return;
        try { navigator.vibrate(12); } catch (_) {}
      }

      async cartAdd(items) {
        await window.RunwayBag.add(items);
        return { items };
      }

      onAdd(card) {
        if (!card || card.classList.contains('is-added') || card.classList.contains('is-loading')) return;
        const id = card.dataset.variantId;
        if (id) return this.addCard(card, id);
        const pk = this.pickerOf(card);
        if (!pk) return;
        const open = pk.hidden;
        this.openPicker(card, open);
        if (open) {
          const first = pk.querySelector('input:checked, select');
          first && first.focus({ preventScroll: true });
          if (!this.mobile) this.reveal(card);
        }
      }

      onConfirm(card) {
        if (!card || !card.dataset.selected) return;
        card.dataset.touched = '1';
        this.addCard(card, card.dataset.selected);
      }

      async addCard(card, id) {
        const panel = card.closest('[data-rw-panel]');
        card.classList.add('is-loading');
        this.msg(panel, '');
        try {
          await this.cartAdd([{ id: Number(id), quantity: 1 }]);
          this.markAdded(card);
          this.buzz();
          this.checkComplete(panel);
        } catch (err) {
          card.classList.remove('is-loading');
          this.msg(panel, err.message);
        }
      }

      markAdded(card) {
        card.classList.remove('is-loading', 'is-picking');
        card.classList.add('is-added');
        const pk = this.pickerOf(card);
        if (pk) { pk.hidden = true; this.dock(pk); }
        const btn = card.querySelector('[data-rw-add]');
        if (btn) { btn.setAttribute('aria-label', btn.dataset.addedLabel || btn.getAttribute('aria-label')); btn.removeAttribute('aria-expanded'); }
        this.syncPicking();
      }

      async addFullLook(panel, btn) {
        if (!panel) return;
        const cta = btn || panel.querySelector('[data-rw-all]');
        if (panel.classList.contains('is-complete') || (cta && cta.classList.contains('is-loading'))) return;
        const cards = Array.from(panel.querySelectorAll('[data-rw-card]:not([data-placeholder])'))
          .filter((c) => !c.classList.contains('is-added') && !c.classList.contains('is-soldout'));
        const items = [], ready = [], pending = [];
        cards.forEach((c) => {
          // never guess a size: multi-option pieces need the shopper's own choice
          const id = c.dataset.variantId || (c.dataset.touched ? c.dataset.selected : '');
          if (id) { items.push({ id: Number(id), quantity: 1 }); ready.push(c); } else pending.push(c);
        });
        this.msg(panel, '');
        if (items.length) {
          cta && cta.classList.add('is-loading');
          ready.forEach((c) => c.classList.add('is-loading'));
          try { await this.cartAdd(items); ready.forEach((c) => this.markAdded(c)); this.buzz(); }
          catch (err) { ready.forEach((c) => c.classList.remove('is-loading')); this.msg(panel, err.message); }
          cta && cta.classList.remove('is-loading');
        }
        if (pending.length) {
          // phones show one size sheet at a time; the message lists every piece still to choose
          (this.mobile ? pending.slice(0, 1) : pending).forEach((c) => this.openPicker(c, true));
          this.msg(panel, (this.dataset.msgChoose || 'Choose your options for: [items]').replace('[items]', pending.map((c) => c.dataset.title).join(', ')));
          this.reveal(pending[0]);
        }
        this.checkComplete(panel);
      }

      checkComplete(panel) {
        if (!panel) return;
        const cards = Array.from(panel.querySelectorAll('[data-rw-card]:not([data-placeholder])')).filter((c) => !c.classList.contains('is-soldout'));
        if (cards.length < 2 || !cards.every((c) => c.classList.contains('is-added'))) return;
        panel.classList.add('is-complete');
        this.msg(panel, '');

      }
    }

    customElements.define('runway-section', RunwaySection);
    window.RunwayNative = document.querySelector('runway-section');
  })();




// ==========================================================================
// RUNWAY ADMIN PORTAL & STUDIO CONTROLLER
// ==========================================================================
const ADMIN_STORAGE_KEY = 'runway_admin_config_v9';

const CATEGORY_DEFS = [
  { key: 'apparel', label: 'Apparel', defaultSizes: ['S', 'M', 'L', 'XL'], presets: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], brandPresets: ['Sahira Premium Outlet', 'Zara', 'Uniqlo', 'Ralph Lauren', 'COS', 'Massimo Dutti', 'Nike', 'Adidas', 'Vintage', 'Unbrand'] },
  { key: 'footwear', label: 'Footwear', defaultSizes: ['40', '41', '42', '43', '44', '45', '46'], presets: ['38', '39', '40', '41', '42', '43', '44', '45', '46'], brandPresets: ['Nike', 'Adidas', 'New Balance', 'Timberland', 'Clarks', 'Dr. Martens', 'Gucci', 'Converse', 'Sahira Premium Outlet', 'Unbrand'] },
  { key: 'tudung', label: 'Tudung', defaultSizes: ['Bidang 45', 'Bidang 48'], presets: ['Free Size', 'Bidang 45', 'Bidang 48', 'Bidang 50', 'Shawl 1.8m'], brandPresets: ['Sahira Hijab', 'dUCk', 'Naelofar', 'Ariani', 'Bawal Exclusive', 'Alhumaira', 'Unbrand'] },
  { key: 'handbag', label: 'Handbag', defaultSizes: ['One Size'], presets: ['Mini', 'Medium', 'Weekender', 'Large', 'One Size'], brandPresets: ['Birkin', 'Coach', 'LV', 'CK', 'Hermès', 'Gucci', 'Prada', 'Longchamp', 'Michael Kors', 'Sahira Leather', 'Unbrand'] },
  { key: 'belt', label: 'Belt', defaultSizes: ['S/M', 'L/XL'], presets: ['Free Size', 'S/M', 'M/L', 'L/XL', '100cm', '110cm', '120cm'], brandPresets: ['Hermès', 'Coach', 'LV', 'CK', 'Gucci', 'Salvatore Ferragamo', 'Sahira Leather', 'Unbrand'] },
  { key: 'topi', label: 'Topi', defaultSizes: ['Free Size'], presets: ['Free Size', 'S/M', 'L/XL', 'Adjustable'], brandPresets: ['New Era', 'Nike', 'Adidas', 'Polo Ralph Lauren', 'Carhartt', 'CK', 'Sahira Premium Outlet', 'Unbrand'] },
  { key: 'accessories', label: 'Accessories', defaultSizes: ['Free Size'], presets: ['Free Size', 'S/M', 'M/L', 'Adjustable'], brandPresets: ['Pandora', 'Swarovski', 'Cartier', 'Coach', 'CK', 'LV', 'Tissot', 'Sahira Atelier', 'Unbrand'] }
];

const CATEGORY_MAP = Object.fromEntries(CATEGORY_DEFS.map(c => [c.key, c]));

function normalizeCategory(cat) {
  const k = String(cat || '').trim().toLowerCase();
  return CATEGORY_MAP[k] ? k : 'apparel';
}

function getCategoryDef(cat) {
  return CATEGORY_MAP[normalizeCategory(cat)];
}

const MAX_LOOK_PINS = 6;
const DEFAULT_PIN_SET = [
  { x: 48, y: 29 },
  { x: 48, y: 58 },
  { x: 46, y: 88 },
  { x: 34, y: 42 },
  { x: 64, y: 46 },
  { x: 52, y: 15 }
];

const BASE_VARIANT_MAP = {};

function hashVariantId(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 1000000000 + (Math.abs(h) % 7999999999);
}

function parseSizeList(sizesInput) {
  const raw = Array.isArray(sizesInput) ? sizesInput : String(sizesInput || '').split(',');
  return [...new Set(raw.map(s => String(s).trim()).filter(Boolean))];
}

function normalizeSizes(sizesInput, category) {
  const arr = parseSizeList(sizesInput);
  if (arr.length) return arr;
  return [...getCategoryDef(category).defaultSizes];
}

function buildVariantsForItem(item) {
  const sizes = normalizeSizes(item?.sizes, item?.category);
  const avail = (item?.stock === undefined ? 15 : Number(item.stock)) > 0;
  const known = BASE_VARIANT_MAP[item?.id] || {};
  return sizes.map(sz => ({
    id: known[sz] || hashVariantId(String(item?.id || 'item') + '::' + sz),
    a: avail,
    o: sz
  }));
}

function optimizeUploadedImage(file, preserveAlpha = false) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca fail gambar'));
    reader.onload = ev => {
      const dataUrl = String(ev.target?.result || '');
      if (preserveAlpha && (file.type === 'image/png' || file.type === 'image/webp')) {
        const img = new Image();
        img.onload = () => {
          try {
            const maxH = 1280;
            const scale = img.naturalHeight > maxH ? maxH / img.naturalHeight : 1;
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(img.naturalWidth * scale));
            c.height = Math.max(1, Math.round(img.naturalHeight * scale));
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL('image/webp', 0.88));
          } catch (_) { resolve(dataUrl); }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const maxD = 1000;
          const scale = Math.max(img.naturalWidth, img.naturalHeight) > maxD ? maxD / Math.max(img.naturalWidth, img.naturalHeight) : 1;
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.naturalWidth * scale));
          c.height = Math.max(1, Math.round(img.naturalHeight * scale));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/webp', 0.86));
        } catch (_) { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

const DEFAULT_LOOKS = [
  {
    name: 'White Poplin & Pinstripe Denim',
    desc: 'Crisp white button-down shirt, wide-leg pinstripe denim, mocha chiffon shawl & clean leather sneakers.',
    src: '/assets/aistudio/Hijabi_Woman_in_Casual_Denim_Style_ec4eaf01.png',
    srcset: '/assets/aistudio/Hijabi_Woman_in_Casual_Denim_Style_ec4eaf01.png 640w, /assets/aistudio/Hijabi_Woman_in_Casual_Denim_Style_ec4eaf01.png 1080w',
    products: ['chiffon-shawl-mocha', 'poplin-button-shirt', 'pinstripe-wide-trousers', 'white-minimal-sneakers'],
    pins: [{ x: 50, y: 12 }, { x: 51, y: 34 }, { x: 49, y: 66 }, { x: 48, y: 95 }]
  },
  {
    name: 'Ivory Shirt & Navy Mini Tote',
    desc: 'Relaxed ivory collared shirt, navy pinstripe trousers, mocha chiffon shawl & white minimal sneakers.',
    src: '/assets/aistudio/Hijabi_Fashion_Look_with_Navy_Handbag_5adce09a.png',
    srcset: '/assets/aistudio/Hijabi_Fashion_Look_with_Navy_Handbag_5adce09a.png 640w, /assets/aistudio/Hijabi_Fashion_Look_with_Navy_Handbag_5adce09a.png 1080w',
    products: ['chiffon-shawl-mocha', 'poplin-button-shirt', 'pinstripe-wide-trousers', 'white-minimal-sneakers'],
    pins: [{ x: 50, y: 12 }, { x: 51, y: 33 }, { x: 51, y: 68 }, { x: 48, y: 95 }]
  },
  {
    name: 'Taupe Knit & Shearling Tote',
    desc: 'Soft heritage knit pullover, pinstripe wide-leg trousers, mocha chiffon shawl & cream leather sneakers.',
    src: '/assets/aistudio/Hijabi_Woman_with_Knit_Tote_Outfit_aeb92822.png',
    srcset: '/assets/aistudio/Hijabi_Woman_with_Knit_Tote_Outfit_aeb92822.png 640w, /assets/aistudio/Hijabi_Woman_with_Knit_Tote_Outfit_aeb92822.png 1080w',
    products: ['chiffon-shawl-mocha', 'cream-cable-knit', 'pinstripe-wide-trousers', 'white-minimal-sneakers'],
    pins: [{ x: 50, y: 12 }, { x: 49, y: 32 }, { x: 52, y: 64 }, { x: 48, y: 95 }]
  },
  {
    name: 'Modest Vest & Hobo Bag',
    desc: 'Cream satin button blouse, heritage woven handbag & minimalist watch cuff styling.',
    src: '/assets/aistudio/Elegant_Hijab_Look_with_Monogram_Bag_7447f0d6.png',
    srcset: '/assets/aistudio/Elegant_Hijab_Look_with_Monogram_Bag_7447f0d6.png 640w, /assets/aistudio/Elegant_Hijab_Look_with_Monogram_Bag_7447f0d6.png 1080w',
    products: ['poplin-button-shirt', 'woven-cognac-tote', 'studio-timepiece-cuff-set'],
    pins: [{ x: 38, y: 32 }, { x: 34, y: 42 }, { x: 74, y: 40 }]
  },
  {
    name: 'Olive Knit & Signature Tote',
    desc: 'Ribbed olive crewneck knit, tailored earth-toned wide trousers & structured dark leather tote.',
    src: '/assets/aistudio/Casual_Look_with_Coach_Tote_ee2fc167.png',
    srcset: '/assets/aistudio/Casual_Look_with_Coach_Tote_ee2fc167.png 640w, /assets/aistudio/Casual_Look_with_Coach_Tote_ee2fc167.png 1080w',
    products: ['olive-ribbed-knit', 'camel-pleated-trousers', 'pebble-signature-handbag'],
    pins: [{ x: 51, y: 30 }, { x: 51, y: 66 }, { x: 31, y: 43 }]
  },
  {
    name: 'Cream Knit & Chain Tote',
    desc: 'Warm cream heritage pullover, tailored pleated trousers, woven cognac tote & clean leather sneakers.',
    src: '/assets/aistudio/Casual_Smart_Style_with_Coach_Tote_000c19cf.png',
    srcset: '/assets/aistudio/Casual_Smart_Style_with_Coach_Tote_000c19cf.png 640w, /assets/aistudio/Casual_Smart_Style_with_Coach_Tote_000c19cf.png 1080w',
    products: ['cream-cable-knit', 'camel-pleated-trousers', 'woven-cognac-tote', 'white-minimal-sneakers'],
    pins: [{ x: 50, y: 30 }, { x: 52, y: 60 }, { x: 32, y: 71 }, { x: 48, y: 95 }]
  },
  {
    name: 'Floral Shirt & Dotted Tulle Skirt',
    desc: 'Mocha chiffon shawl, ivory pleated maxi skirt, woven leather tote & studio low-top sneakers.',
    src: '/assets/aistudio/Elegant_Modest_Fashion_Portrait_06e2bc09.png',
    srcset: '/assets/aistudio/Elegant_Modest_Fashion_Portrait_06e2bc09.png 640w, /assets/aistudio/Elegant_Modest_Fashion_Portrait_06e2bc09.png 1080w',
    products: ['chiffon-shawl-mocha', 'ivory-tiered-skirt', 'woven-cognac-tote', 'white-minimal-sneakers'],
    pins: [{ x: 50, y: 12 }, { x: 52, y: 68 }, { x: 37, y: 65 }, { x: 48, y: 95 }]
  },
  {
    name: 'Black Eyelet & Champagne Pleats',
    desc: 'Champagne pleated lace-trim maxi skirt & woven cognac leather handbag.',
    src: '/assets/aistudio/Elegant_Woven_Handbag_Outfit_Portrait_067b0c3e.png',
    srcset: '/assets/aistudio/Elegant_Woven_Handbag_Outfit_Portrait_067b0c3e.png 640w, /assets/aistudio/Elegant_Woven_Handbag_Outfit_Portrait_067b0c3e.png 1080w',
    products: ['ivory-tiered-skirt', 'woven-cognac-tote'],
    pins: [{ x: 52, y: 64 }, { x: 29, y: 47 }]
  },
  {
    name: 'Burgundy Tassel & Ivory Tiered Skirt',
    desc: 'Burgundy daisy-embroidered tassel blouse, ivory tiered lace maxi skirt & gold atelier accessories.',
    src: '/assets/aistudio/Burgundy_Blouse_and_Ivory_Tiered_Skirt_66854bbb.png',
    srcset: '/assets/aistudio/Burgundy_Blouse_and_Ivory_Tiered_Skirt_66854bbb.png 640w, /assets/aistudio/Burgundy_Blouse_and_Ivory_Tiered_Skirt_66854bbb.png 1080w',
    products: ['burgundy-eyelet-blouse', 'ivory-tiered-skirt', 'studio-timepiece-cuff-set'],
    pins: [{ x: 49, y: 30 }, { x: 52, y: 66 }, { x: 67, y: 22 }]
  },
  {
    name: 'Cream Linen & Dusty Blue Floral Skirt',
    desc: 'Natural cream linen button blouse paired with minimalist watch & studio gold cuff accessories.',
    src: '/assets/aistudio/Elegant_Blouse_and_Floral_Tiered_Skirt_4157807e.png',
    srcset: '/assets/aistudio/Elegant_Blouse_and_Floral_Tiered_Skirt_4157807e.png 640w, /assets/aistudio/Elegant_Blouse_and_Floral_Tiered_Skirt_4157807e.png 1080w',
    products: ['poplin-button-shirt', 'studio-timepiece-cuff-set'],
    pins: [{ x: 50, y: 30 }, { x: 70, y: 47 }]
  },
  {
    name: 'Charcoal Polo & Signature Handbag',
    desc: 'Charcoal knit collared polo, pleated sand trousers, heritage leather tote & clean minimal sneakers.',
    src: '/assets/aistudio/Casual_Style_with_Signature_Handbag_cdc81361.png',
    srcset: '/assets/aistudio/Casual_Style_with_Signature_Handbag_cdc81361.png 640w, /assets/aistudio/Casual_Style_with_Signature_Handbag_cdc81361.png 1080w',
    products: ['charcoal-knit-polo', 'camel-pleated-trousers', 'woven-cognac-tote', 'white-minimal-sneakers'],
    pins: [{ x: 51, y: 30 }, { x: 52, y: 62 }, { x: 29, y: 71 }, { x: 48, y: 95 }]
  },
  {
    name: 'Tweed Blazer & Pebble Leather Bag',
    desc: 'Brown herringbone tweed 3-piece blazer, camel wool trousers, pebble leather bag & tassel loafers.',
    src: '/assets/aistudio/Smartly_Dressed_Man_with_Leather_Bag_26b060d1.png',
    srcset: '/assets/aistudio/Smartly_Dressed_Man_with_Leather_Bag_26b060d1.png 640w, /assets/aistudio/Smartly_Dressed_Man_with_Leather_Bag_26b060d1.png 1080w',
    products: ['tweed-herringbone-blazer', 'camel-pleated-trousers', 'pebble-signature-handbag', 'brown-tassel-loafers'],
    pins: [{ x: 51, y: 32 }, { x: 53, y: 62 }, { x: 29, y: 72 }, { x: 69, y: 92 }]
  },
  {
    name: 'Espresso Suede & Cream Knit',
    desc: 'Espresso suede zip jacket, cream heritage knit pullover, tailored chinos, pebble leather bag & minimal sneakers.',
    src: '/assets/aistudio/Stylish_Traveller_with_Leather_Bag_62143d8f.png',
    srcset: '/assets/aistudio/Stylish_Traveller_with_Leather_Bag_62143d8f.png 640w, /assets/aistudio/Stylish_Traveller_with_Leather_Bag_62143d8f.png 1080w',
    products: ['espresso-suede-jacket', 'cream-cable-knit', 'camel-pleated-trousers', 'pebble-signature-handbag', 'white-minimal-sneakers'],
    pins: [{ x: 51, y: 29 }, { x: 51, y: 38 }, { x: 51, y: 64 }, { x: 24, y: 42 }, { x: 49, y: 95 }]
  }
];

const DEFAULT_ITEMS = [
  { id: 'poplin-button-shirt', name: 'Crisp Ivory Poplin Shirt', type: 'Sahira Modest', category: 'apparel', isNew: false, price: 119.0, stock: 24, sizes: ['S', 'M', 'L', 'XL'], image: poplinShirtImg, url: '' },
  { id: 'pinstripe-wide-trousers', name: 'Pinstripe Wide-Leg Denim', type: 'Sahira Denim', category: 'apparel', isNew: false, price: 139.0, stock: 18, sizes: ['S', 'M', 'L', 'XL'], image: pinstripeDenimImg, url: '' },
  { id: 'olive-ribbed-knit', name: 'Olive Ribbed Crewneck Knit', type: 'Sahira Premium Outlet', category: 'apparel', isNew: false, price: 145.0, stock: 16, sizes: ['S', 'M', 'L', 'XL'], image: oliveRibbedKnitImg, url: '' },
  { id: 'cream-cable-knit', name: 'Cream Heritage Knit Pullover', type: 'Sahira Premium Outlet', category: 'apparel', isNew: false, price: 149.0, stock: 21, sizes: ['S', 'M', 'L', 'XL'], image: creamCableKnitImg, url: '' },
  { id: 'charcoal-knit-polo', name: 'Charcoal Knit Collared Polo', type: 'Sahira Premium Outlet', category: 'apparel', isNew: false, price: 135.0, stock: 15, sizes: ['S', 'M', 'L', 'XL'], image: charcoalKnitPoloImg, url: '' },
  { id: 'burgundy-eyelet-blouse', name: 'Burgundy Eyelet Tassel Blouse', type: 'Sahira Modest', category: 'apparel', isNew: true, price: 135.0, stock: 14, sizes: ['S', 'M', 'L', 'XL'], image: burgundyEyeletBlouseImg, url: '' },
  { id: 'ivory-tiered-skirt', name: 'Ivory Pleated Tiered Skirt', type: 'Sahira Modest', category: 'apparel', isNew: false, price: 155.0, stock: 19, sizes: ['S', 'M', 'L', 'XL'], image: ivoryTieredSkirtImg, url: '' },
  { id: 'tweed-herringbone-blazer', name: 'Herringbone Tweed 3-Piece Blazer', type: 'Sahira Tailored', category: 'apparel', isNew: true, price: 289.0, stock: 12, sizes: ['S', 'M', 'L', 'XL'], image: tweedHerringboneBlazerImg, url: '' },
  { id: 'espresso-suede-jacket', name: 'Espresso Suede Zip Jacket', type: 'Sahira Tailored', category: 'apparel', isNew: true, price: 269.0, stock: 10, sizes: ['S', 'M', 'L', 'XL'], image: espressoSuedeJacketImg, url: '' },
  { id: 'camel-pleated-trousers', name: 'Tailored Camel Pleated Trousers', type: 'Sahira Tailored', category: 'apparel', isNew: false, price: 159.0, stock: 17, sizes: ['S', 'M', 'L', 'XL'], image: camelPleatedTrousersImg, url: '' },
  { id: 'white-minimal-sneakers', name: 'Studio Minimal Leather Sneakers', type: 'Sahira Footwear', category: 'footwear', isNew: false, price: 149.0, stock: 22, sizes: ['38', '39', '40', '41', '42', '43', '44', '45'], image: whiteMinimalSneakersImg, url: '' },
  { id: 'brown-tassel-loafers', name: 'Heritage Leather Tassel Loafers', type: 'Sahira Footwear', category: 'footwear', isNew: true, price: 179.0, stock: 14, sizes: ['40', '41', '42', '43', '44', '45', '46'], image: brownTasselLoafersImg, url: '' },
  { id: 'chiffon-shawl-mocha', name: 'Mocha Matte Chiffon Shawl', type: 'Sahira Modest', category: 'tudung', isNew: true, price: 49.0, stock: 24, sizes: ['Bidang 45', 'Bidang 48', 'Shawl 1.8m'], image: '/assets/products/tudung-chiffon-shawl.jpg', url: '' },
  { id: 'pebble-signature-handbag', name: 'Espresso Pebble Leather Bag', type: 'Sahira Leather', category: 'handbag', isNew: true, price: 249.0, stock: 9, sizes: ['Medium', 'Weekender', 'One Size'], image: '/assets/products/signature-leather-handbag.jpg', url: '' },
  { id: 'woven-cognac-tote', name: 'Cognac Woven Leather Tote', type: 'Sahira Leather', category: 'handbag', isNew: true, price: 219.0, stock: 13, sizes: ['Mini', 'Medium', 'One Size'], image: wovenCognacToteImg, url: '' },
  { id: 'heritage-leather-belt', name: 'Heritage Brass Leather Belt', type: 'Sahira Premium Outlet', category: 'belt', isNew: false, price: 79.0, stock: 16, sizes: ['S/M', 'M/L', 'L/XL'], image: '/assets/products/classic-leather-belt.jpg', url: '' },
  { id: 'charcoal-twill-topi', name: 'Washed Charcoal Twill Cap', type: 'Sahira Street', category: 'topi', isNew: true, price: 55.0, stock: 20, sizes: ['Free Size', 'Adjustable'], image: '/assets/products/editorial-twill-topi.jpg', url: '' },
  { id: 'studio-timepiece-cuff-set', name: 'Minimalist Watch & Cuff Set', type: 'Sahira Atelier', category: 'accessories', isNew: false, price: 169.0, stock: 11, sizes: ['Free Size', 'S/M'], image: '/assets/products/minimalist-accessories-set.jpg', url: '' }
];

const DEFAULT_REELS = [
  { id: 'reel-look-4', lookIndex: 4, videoUrl: '/assets/aistudio/rotate_360_3350c316_ae31630a.mp4', handle: '@sahirapremiumoutlet', verified: true, following: true, category: 'apparel', caption: '360° Studio Spin — Olive Knit & Signature Tote. Tengok drape & padanan beg dari setiap sudut! #SahiraPremiumOutlet #360Lookbook #HandRailPro', audio: '360° Studio Spin — Sahira Track 05', baseLikes: 18110, baseSaves: 3610, baseShares: 940, bgTone: ['#141416', '#242329'], comments: [{ id: 'c10', author: '@iqbal.studio', time: '19m', ts: Date.now() - 1140000, likes: 147, text: '360° spin ni memang nampak jelas drape sweater olive dengan tote tu!', replies: [] }, { id: 'c11', author: '@mira_luxe', time: '5h', ts: Date.now() - 18000000, likes: 38, text: 'Cutting seluar lebar dia kemas dari depan sampai belakang.', replies: [] }] },
  { id: 'reel-look-0', lookIndex: 0, videoUrl: '', handle: '@sahirapremiumoutlet', verified: true, following: true, category: 'apparel', caption: 'White Poplin & Pinstripe Denim — crisp daily rotation dari Sahira Premium Outlet. #SahiraPremiumOutlet #HandRailPro #ModestStyle', audio: 'Original Audio — Sahira Premium Outlet 01', baseLikes: 14820, baseSaves: 2140, baseShares: 685, bgTone: ['#191817', '#2b2927'], comments: [{ id: 'c1', author: '@farid_kicks', time: '14m', ts: Date.now() - 840000, likes: 128, text: 'Cutting kemeja putih & denim pinstripe tu nampak kemas gila!', replies: [{ id: 'r1', author: '@sahirapremiumoutlet', isCreator: true, time: '9m', text: '@farid_kicks Betul! Kain selesa dan drape dia memang jatuh cantik.' }] }, { id: 'c2', author: '@aisyahlook', time: '1h', ts: Date.now() - 3600000, likes: 64, text: 'Kalau tinggi 168cm ambil size M ke S?', replies: [] }, { id: 'c3', author: '@danial.fits', time: '3h', ts: Date.now() - 10800000, likes: 41, text: 'Terus tambah full look masuk styling bag, jimat 10% 🔥', replies: [] }] },
  { id: 'reel-look-10', lookIndex: 10, videoUrl: '', handle: '@sahirapremiumoutlet', verified: true, following: true, category: 'handbag', caption: 'Charcoal Knit Polo & Signature Handbag — smart casual minimal dengan seluar lipat krim. #SahiraOutlet #VintageStyle #HandRailPro', audio: 'Studio Cadence — Sahira Mix 11', baseLikes: 11420, baseSaves: 1960, baseShares: 520, bgTone: ['#161615', '#292826'], comments: [{ id: 'c18', author: '@zarif_fits', time: '12m', ts: Date.now() - 720000, likes: 84, text: 'Polo knit kelabu gelap + beg kulit ni nampak classy habis!', replies: [] }] },
  { id: 'reel-look-1', lookIndex: 1, videoUrl: '', handle: '@orbitstudio', verified: true, following: false, category: 'tudung', caption: 'Ivory Shirt, Mocha Chiffon Tudung & Pinstripe Wide Denim rotation. Gaya minimalis harian yang kemas. #SahiraRunway #GalleryEdit', audio: 'Gallery Night Loop — Hand Rail Mix', baseLikes: 9430, baseSaves: 1520, baseShares: 412, bgTone: ['#16181a', '#282c30'], comments: [{ id: 'c4', author: '@haziq_archv', time: '25m', ts: Date.now() - 1500000, likes: 92, text: 'Minimalist tapi ada aura mewah. Suka padanan tudung & kemeja tu!', replies: [] }, { id: 'c5', author: '@hana_wears', time: '2h', ts: Date.now() - 7200000, likes: 33, text: 'Bidang 48 ada stok lagi ke?', replies: [] }] },
  { id: 'reel-look-2', lookIndex: 2, videoUrl: '', handle: '@kicks_my', verified: true, following: true, category: 'footwear', caption: 'Taupe Knit, Mocha Chiffon & Minimal Leather Sneakers — selesa dan hangat untuk keluar santai hujung minggu. #SahiraStyle #SneakerReel', audio: 'Concrete Pulse — 118 BPM Studio Cut', baseLikes: 21340, baseSaves: 4380, baseShares: 1120, bgTone: ['#1a1716', '#2f2826'], comments: [{ id: 'c6', author: '@izham_sole', time: '6m', ts: Date.now() - 360000, likes: 215, text: 'Tone warna taupe ni memang lembut bila kena cahaya studio!', replies: [{ id: 'r2', author: '@kicks_my', isCreator: true, time: '3m', text: '@izham_sole Setuju, mudah sangat nak suai padan.' }] }, { id: 'c7', author: '@syafiqah.s', time: '48m', ts: Date.now() - 2880000, likes: 51, text: 'Tap Shop Look kat bawah tu terus boleh pilih saiz senang.', replies: [] }] },
  { id: 'reel-look-3', lookIndex: 3, videoUrl: '', handle: '@amir_fitcheck', verified: false, following: false, category: 'accessories', caption: 'Modest Vest, Minimalist Watch & Woven Tote lookbook breakdown. Simple formula tapi setiap detail tajam! #SahiraDay #OOTD', audio: 'Lo-Fi Runway Cadence — Original', baseLikes: 7890, baseSaves: 980, baseShares: 290, bgTone: ['#171817', '#262825'], comments: [{ id: 'c8', author: '@nadia_styled', time: '32m', ts: Date.now() - 1920000, likes: 74, text: '9.5/10! Jam kulit coklat & cuff gold tu melengkapkan look ni.', replies: [] }, { id: 'c9', author: '@azim.co', time: '4h', ts: Date.now() - 14400000, likes: 29, text: 'Kemas teruk look ni 👌', replies: [] }] },
  { id: 'reel-look-5', lookIndex: 5, videoUrl: '', handle: '@court_handrail', verified: true, following: false, category: 'footwear', caption: 'Cream Knit, Tailored Trousers & Woven Tote bundle. Tengok detail jahitan dan pergerakan silhouette! #SahiraPremiumOutlet #HandRailPro', audio: 'Tunnel Walk — Hand Rail Sub Bass', baseLikes: 12650, baseSaves: 1890, baseShares: 530, bgTone: ['#181715', '#2d2a24'], comments: [{ id: 'c12', author: '@hakim_hoops', time: '11m', ts: Date.now() - 660000, likes: 109, text: 'Padanan warna krim dengan seluar lebar memang nampak clean habis!', replies: [] }, { id: 'c13', author: '@zati_n', time: '2h', ts: Date.now() - 7200000, likes: 22, text: 'Baru tahu boleh terus bundle semua item kat tab Shop Look sebelah kanan.', replies: [] }] },
  { id: 'reel-look-6', lookIndex: 6, videoUrl: '', handle: '@sahirapremiumoutlet', verified: true, following: true, category: 'tudung', caption: 'Floral shirt + ivory dotted tulle maxi skirt, woven tote & mocha chiffon shawl. Lembut bergerak untuk OOTD harian. #SahiraVintage', audio: 'Soft Linen Waltz — Sahira Edit 07', baseLikes: 16480, baseSaves: 2940, baseShares: 710, bgTone: ['#1c1816', '#332b26'], comments: [{ id: 'c14', author: '@nadira.co', time: '8m', ts: Date.now() - 480000, likes: 88, text: 'Skirt labuh putih dengan shawl mocha ni nampak klasik sangat!', replies: [] }] },
  { id: 'reel-look-7', lookIndex: 7, videoUrl: '', handle: '@sahirapremiumoutlet', verified: true, following: true, category: 'handbag', caption: 'Black daisy eyelet blouse dipadankan dengan champagne pleated skirt & woven cognac tote. #VintageCollection #SahiraOutlet', audio: 'Champagne Drape — Studio Cut 08', baseLikes: 13920, baseSaves: 2310, baseShares: 605, bgTone: ['#171615', '#2b2824'], comments: [{ id: 'c15', author: '@aina_styled', time: '22m', ts: Date.now() - 1320000, likes: 67, text: 'Skirt pleated dia jatuh kemas gila dengan beg anyaman tu.', replies: [] }] },
  { id: 'reel-look-8', lookIndex: 8, videoUrl: '', handle: '@sahirapremiumoutlet', verified: true, following: false, category: 'apparel', caption: 'Burgundy tassel eyelet blouse + ivory tiered maxi skirt. Ton hangat yang menaikkan seri vintage. #BurgundyEdit #Sahira', audio: 'Velvet Evening — Sahira Tape 09', baseLikes: 19240, baseSaves: 3780, baseShares: 890, bgTone: ['#1d1416', '#352226'], comments: [{ id: 'c16', author: '@laila.wardrobe', time: '16m', ts: Date.now() - 960000, likes: 112, text: 'Warna burgundy ni memang nampak eksklusif dan manis!', replies: [] }] },
  { id: 'reel-look-9', lookIndex: 9, videoUrl: '', handle: '@sahirapremiumoutlet', verified: true, following: true, category: 'accessories', caption: 'Cream linen blouse & minimalist atelier accessories — effortless weekend silhouette. #SahiraPremiumOutlet', audio: 'Morning Meadow — Studio Reel 10', baseLikes: 15390, baseSaves: 2680, baseShares: 640, bgTone: ['#15181c', '#252c36'], comments: [{ id: 'c17', author: '@farah_m', time: '29m', ts: Date.now() - 1740000, likes: 73, text: 'Kemeja linen krim ni cantik sangat untuk pakai pergi event santai.', replies: [] }] },
  { id: 'reel-look-11', lookIndex: 11, videoUrl: '', handle: '@sahirapremiumoutlet', verified: true, following: true, category: 'footwear', caption: 'Tweed Blazer, Camel Trousers, Loafers & Pebble Leather Bag — tailored herringbone 3-piece klasik. #ClassicMenswear #SahiraOutlet', audio: 'Savile Heritage — Sahira Track 12', baseLikes: 14680, baseSaves: 2890, baseShares: 675, bgTone: ['#191512', '#2f2722'], comments: [{ id: 'c19', author: '@razak_tailor', time: '11m', ts: Date.now() - 660000, likes: 96, text: 'Padanan blazer tweed, loafer & beg kulit coklat tu kemas gila!', replies: [] }] },
  { id: 'reel-look-12', lookIndex: 12, videoUrl: '', handle: '@sahirapremiumoutlet', verified: true, following: true, category: 'apparel', caption: 'Espresso Suede Jacket, Cream Knit & Pebble Leather Bag — gaya kembara santai hujung minggu. #SahiraTraveller #VintageCollection', audio: 'Weekend Departure — Studio Reel 13', baseLikes: 17320, baseSaves: 3150, baseShares: 790, bgTone: ['#181513', '#2d2621'], comments: [{ id: 'c20', author: '@amirul_vibe', time: '18m', ts: Date.now() - 1080000, likes: 118, text: 'Kombinasi suede espresso + knit krim + beg kulit ni memang clean untuk travel.', replies: [] }] }
];

const escText = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clampDiscount = d => Math.min(95, Math.max(0, Math.round(Number(d) || 0)));
const isOfferActive = it => Boolean(it?.offerEnabled && it?.offerEndsAt && Date.parse(it.offerEndsAt) > Date.now());
const getEffectiveDiscount = it => it?.offerEnabled ? (isOfferActive(it) ? clampDiscount(it.offerDiscount) : 0) : clampDiscount(it?.discount);
const getSalePrice = it => {
  const base = Math.max(0, Number(it?.price) || 0);
  const disc = getEffectiveDiscount(it);
  return disc > 0 ? Number((base * (1 - disc / 100)).toFixed(2)) : base;
};
const fmtMoneyRm = v => { const n = Number(v) || 0; const abs = Math.abs(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return n < 0 ? `-RM ${abs}` : `RM ${abs}`; };
const formatOfferEndForInput = iso => {
  const d = iso ? new Date(iso) : null;
  if (!d || !Number.isFinite(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const formatCountdown = iso => {
  const left = Math.max(0, Date.parse(iso || '') - Date.now());
  const total = Math.floor(left / 1000);
  return `${Math.floor(total / 86400)}h ${String(Math.floor(total / 3600) % 24).padStart(2, '0')}j ${String(Math.floor(total / 60) % 60).padStart(2, '0')}m ${String(total % 60).padStart(2, '0')}s`;
};
const formatItemPriceHtml = it => {
  const base = Math.max(0, Number(it?.price) || 0);
  const disc = getEffectiveDiscount(it);
  const sale = getSalePrice(it);
  const offer = isOfferActive(it);
  const offerLabel = offer ? (it.offerLabel || (it.offerType === 'clearance' ? 'CLEARANCE' : 'SPECIAL OFFER')) : '';
  return disc > 0
    ? `<span class="sahira-price-sale${offer ? ' is-special-offer' : ''}"><s>${fmtMoneyRm(base)}</s> <strong>${fmtMoneyRm(sale)}</strong> <span class="sahira-disc-pill">-${disc}%</span>${offerLabel ? ` <span class="sahira-offer-pill">${escText(offerLabel)}</span><span class="sahira-offer-countdown" data-offer-countdown="${escText(it.offerEndsAt)}">TAMAT DALAM ${formatCountdown(it.offerEndsAt)}</span>` : ''}</span>`
    : `<span>${fmtMoneyRm(base)}</span>`;
};

const getItemShareUrl = prodId => {
  try {
    const u = new URL(window.location.href);
    u.hash = '';
    u.searchParams.delete('admin');
    u.searchParams.set('item', String(prodId || ''));
    return u.toString();
  } catch (_) {
    return `${window.location.origin}${window.location.pathname}?item=${encodeURIComponent(String(prodId || ''))}`;
  }
};

const copyTextReliable = async text => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return Boolean(ok);
  } catch (_) {
    return false;
  }
};

const showShareToast = msg => {
  const status = document.getElementById('bag-status');
  if (!status) return;
  status.textContent = msg;
  status.classList.add('is-on');
  clearTimeout(status.hideTimer);
  status.hideTimer = setTimeout(() => status.classList.remove('is-on'), 2800);
};

const findShareItemById = prodId => {
  const list = (typeof activeConfig === 'object' && Array.isArray(activeConfig?.items)) ? activeConfig.items : DEFAULT_ITEMS;
  return list.find(it => it.id === prodId) || list.find(it => String(it.id).toLowerCase() === String(prodId || '').toLowerCase()) || null;
};

document.addEventListener('click', async e => {
  const copyBtn = e.target.closest('[data-share-item]');
  if (copyBtn) {
    e.preventDefault();
    e.stopPropagation();
    const pid = copyBtn.getAttribute('data-share-item');
    if (!pid) return;
    const url = getItemShareUrl(pid);
    const ok = await copyTextReliable(url);
    const prod = findShareItemById(pid);
    if (ok) {
      copyBtn.classList.add('is-copied');
      const prevHtml = copyBtn.dataset.origHtml || copyBtn.innerHTML;
      copyBtn.dataset.origHtml = prevHtml;
      if (copyBtn.classList.contains('orbit-lb-share-copy') || copyBtn.classList.contains('admin-prod-share-btn') || copyBtn.classList.contains('rw__share-inline')) {
        copyBtn.textContent = '✓ Disalin!';
      } else {
        copyBtn.setAttribute('data-copied', 'true');
      }
      clearTimeout(copyBtn._copyTimer);
      copyBtn._copyTimer = setTimeout(() => {
        copyBtn.classList.remove('is-copied');
        copyBtn.removeAttribute('data-copied');
        if (copyBtn.dataset.origHtml) copyBtn.innerHTML = copyBtn.dataset.origHtml;
      }, 1800);
      showShareToast(`✓ Link ${prod ? prod.name : 'item'} disalin! Kongsi supaya mudah di-lock.`);
    } else {
      showShareToast('Salin link secara manual pada ruangan pautan item.');
    }
    return;
  }

  const waBtn = e.target.closest('[data-share-item-wa]');
  if (waBtn) {
    e.preventDefault();
    e.stopPropagation();
    const pid = waBtn.getAttribute('data-share-item-wa');
    if (!pid) return;
    const prod = findShareItemById(pid);
    const url = getItemShareUrl(pid);
    const priceTxt = prod ? fmtMoneyRm(getSalePrice(prod)) : '';
    const msg = [
      `*${prod ? prod.name : 'Item Sahira Premium Outlet'}*${priceTxt ? ` (${priceTxt})` : ''}`,
      'Klik link di bawah untuk pilih saiz & terus *Lock Item* di Sahira Premium Outlet:',
      url
    ].join('\n');
    const a = document.createElement('a');
    a.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  const nativeBtn = e.target.closest('[data-share-item-native]');
  if (nativeBtn) {
    e.preventDefault();
    e.stopPropagation();
    const pid = nativeBtn.getAttribute('data-share-item-native');
    if (!pid) return;
    const prod = findShareItemById(pid);
    const url = getItemShareUrl(pid);
    const title = prod ? `${prod.name} — Sahira Premium Outlet` : 'Sahira Premium Outlet';
    const text = prod ? `${prod.name} (${fmtMoneyRm(getSalePrice(prod))}) — Klik untuk pilih saiz & Lock Item:` : 'Klik untuk Lock Item:';
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    const ok = await copyTextReliable(url);
    showShareToast(ok ? '✓ Link item disalin untuk dikongsi!' : 'Gagal salin automatik.');
  }
});

function normalizeAdminConfig(raw) {
  const defItemsMap = Object.fromEntries(DEFAULT_ITEMS.map(x => [x.id, x]));
  const rawItems = Array.isArray(raw?.items) && raw.items.length ? raw.items : DEFAULT_ITEMS;
  const items = rawItems.map((it, idx) => {
    const fallback = defItemsMap[it.id] || DEFAULT_ITEMS[idx] || {};
    const category = normalizeCategory(it.category || fallback.category || 'apparel');
    const sizes = normalizeSizes(it.sizes || fallback.sizes, category);
    const stock = it.stock !== undefined ? Math.max(0, parseInt(it.stock, 10) || 0) : (fallback.stock ?? 18);
    const discount = clampDiscount(it.discount ?? fallback.discount ?? 0);
    const offerEndsAt = it.offerEndsAt || fallback.offerEndsAt || null;
    return {
      id: String(it.id || 'item-' + Date.now() + '-' + idx),
      name: String(it.name || fallback.name || 'Item'),
      type: String((it.type === 'Sahira Studio' ? 'Sahira Premium Outlet' : it.type) || (fallback.type === 'Sahira Studio' ? 'Sahira Premium Outlet' : fallback.type) || 'Sahira Premium Outlet'),
      category,
      isNew: it.isNew !== undefined ? Boolean(it.isNew) : Boolean(fallback.isNew),
      price: Number(it.price ?? fallback.price ?? 0),
      discount,
      offerEnabled: it.offerEnabled !== undefined ? Boolean(it.offerEnabled) : Boolean(fallback.offerEnabled),
      offerType: String(it.offerType || fallback.offerType || 'flash_sale'),
      offerLabel: String(it.offerLabel || fallback.offerLabel || ''),
      offerDiscount: clampDiscount(it.offerDiscount ?? fallback.offerDiscount ?? 0),
      offerEndsAt: offerEndsAt && Date.parse(offerEndsAt) ? new Date(offerEndsAt).toISOString() : null,
      stock,
      sizes,
      image: String(it.image || fallback.image || ''),
      url: String(it.url ?? fallback.url ?? '')
    };
  });

  const validIds = new Set(items.map(i => i.id));
  const rawLooks = Array.isArray(raw?.looks) && raw.looks.length ? raw.looks : DEFAULT_LOOKS;
  const looks = rawLooks.map((lk, idx) => {
    const fallback = DEFAULT_LOOKS[idx] || {};
    const products = (Array.isArray(lk.products) ? lk.products : fallback.products || [])
      .filter(pid => validIds.has(pid));
    if (!products.length && items.length) products.push(items[0].id);
    const limitedProducts = products.slice(0, MAX_LOOK_PINS);
    const rawPins = Array.isArray(lk.pins) && lk.pins.length ? lk.pins : fallback.pins || DEFAULT_PIN_SET;
    const pinTargetLen = Math.max(limitedProducts.length, Math.min(MAX_LOOK_PINS, rawPins.length));
    const pins = Array.from({ length: pinTargetLen }, (_, pi) => {
      const p = rawPins[pi];
      const defPt = DEFAULT_PIN_SET[pi % MAX_LOOK_PINS];
      return {
        x: Math.min(96, Math.max(4, Number(p?.x ?? defPt.x))),
        y: Math.min(97, Math.max(4, Number(p?.y ?? defPt.y)))
      };
    });
    const src = String(lk.src || fallback.src || '');
    return {
      name: String(lk.name || fallback.name || 'Look ' + (idx + 1)),
      desc: String(lk.desc ?? fallback.desc ?? ''),
      src,
      srcset: String(lk.srcset || (src ? `${src} 640w, ${src} 1080w` : '')),
      products: limitedProducts,
      pins
    };
  });

  const rawReels = Array.isArray(raw?.reels) && raw.reels.length ? raw.reels : DEFAULT_REELS;
  const reels = rawReels.map((r, idx) => ({
    id: String(r.id || 'reel-admin-' + Date.now() + '-' + idx),
    lookIndex: Math.min(Math.max(0, looks.length - 1), Math.max(0, parseInt(r.lookIndex ?? 0, 10) || 0)),
    videoUrl: String(r.videoUrl || ''),
    handle: String(r.handle === '@sahirastudio' ? '@sahirapremiumoutlet' : (r.handle || '@sahirapremiumoutlet')),
    verified: r.verified !== false,
    following: r.following !== false,
    category: normalizeCategory(r.category || 'apparel'),
    caption: String(r.caption || '').replace(/#SahiraStudio/g, '#SahiraPremiumOutlet'),
    audio: String((r.audio === 'Original Audio — Sahira Studio' ? 'Original Audio — Sahira Premium Outlet' : r.audio) || 'Original Audio — Sahira Premium Outlet'),
    baseLikes: Number(r.baseLikes ?? 100),
    baseSaves: Number(r.baseSaves ?? 12),
    baseShares: Number(r.baseShares ?? 5),
    bgTone: Array.isArray(r.bgTone) ? r.bgTone : ['#151515', '#282625'],
    comments: Array.isArray(r.comments) ? r.comments : []
  }));

  const whatsappNumber = String(raw?.whatsappNumber || '').replace(/[^\d]/g, '');

  return { looks, items, reels, whatsappNumber };
}

const LEGACY_DEMO_IDS = new Set([
  'tatum-5-orbit-copy', 'tshirt', 'sweatshirt', 'tatum-5-orbit',
  'hoodie-black', 'sweatshirt-plus', 'hoodie', 'air-jordan-12-retro-copy'
]);

function pruneUnrelatedPinsOnce(parsed) {
  return parsed;
}

function getStoredAdminConfig() {
  // Use Supabase cache; fall back to defaults if empty
  const dbProducts = getProductsCache();
  const dbLooks = getLooksCache();
  const dbReels = getReelsCache();
  const storeConfig = getStoreConfigCache();

  if (dbProducts.length || dbLooks.length || dbReels.length) {
    return normalizeAdminConfig({
      looks: dbLooks.length ? dbLooks : DEFAULT_LOOKS,
      items: dbProducts.length ? dbProducts : DEFAULT_ITEMS,
      reels: dbReels.length ? dbReels : DEFAULT_REELS,
      whatsappNumber: storeConfig.whatsappNumber || ''
    });
  }
  return normalizeAdminConfig({ looks: DEFAULT_LOOKS, items: DEFAULT_ITEMS, reels: DEFAULT_REELS });
}

function serializeConfigForStorage(cfg) {
  const safe = JSON.parse(JSON.stringify(cfg));
  if (Array.isArray(safe.looks)) {
    safe.looks = safe.looks.map(lk => (String(lk.src || '').startsWith('data:') ? { ...lk, srcset: '' } : lk));
  }
  if (Array.isArray(safe.reels)) {
    safe.reels = safe.reels.map(r => (String(r.videoUrl || '').startsWith('blob:') ? { ...r, videoUrl: '' } : r));
  }
  return safe;
}

let activeConfig = getStoredAdminConfig();

setInterval(() => {
  let expired = false;
  document.querySelectorAll('[data-offer-countdown]').forEach(el => {
    const endsAt = el.getAttribute('data-offer-countdown') || '';
    const left = Date.parse(endsAt) - Date.now();
    if (left > 0) el.textContent = `TAMAT DALAM ${formatCountdown(endsAt)}`;
    else expired = true;
  });
  if (expired) applyConfigToDOM(activeConfig);
}, 1000);

function renderLookThumbPickerTrigger(look, idx) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = String(idx + 1).padStart(2, '0');
  const pinCount = Array.isArray(look?.products) ? look.products.length : 1;
  return `
    <span class="admin-picker-thumb is-look"><img src="${esc(look?.src || '')}" alt="${esc(look?.name || '')}" loading="lazy"></span>
    <span class="admin-picker-meta">
      <span class="admin-picker-name">Look ${num} — ${esc(look?.name || 'Outfit')}</span>
      <span class="admin-picker-sub">${pinCount} item pin</span>
    </span>
    <svg class="admin-picker-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
  `;
}

function renderLookThumbPickerMarkup({ looks, selIndex = 0, hiddenId = '', videoIdx = undefined }) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const list = Array.isArray(looks) ? looks : [];
  const safeIdx = Math.min(Math.max(0, list.length - 1), Math.max(0, Number(selIndex) || 0));
  const activeLook = list[safeIdx] || list[0] || { name: 'Outfit', src: '', products: [] };
  const hiddenAttr = hiddenId
    ? `id="${esc(hiddenId)}"`
    : `data-vid-field="lookIndex" data-idx="${videoIdx}"`;
  const pickerCtx = videoIdx !== undefined
    ? `data-picker-kind="look" data-video-idx="${videoIdx}"`
    : `data-picker-kind="look"`;

  const rows = list.map((lk, li) => {
    const isSel = li === safeIdx;
    const num = String(li + 1).padStart(2, '0');
    const pinCount = Array.isArray(lk.products) ? lk.products.length : 1;
    return `
      <button type="button" class="admin-picker-opt${isSel ? ' is-selected' : ''}" data-picker-choose="${li}" data-search-text="${esc(`look ${num} ${lk.name || ''} ${lk.desc || ''}`.toLowerCase())}">
        <span class="admin-picker-opt-img is-look"><img src="${esc(lk.src || '')}" alt="" loading="lazy"></span>
        <span class="admin-picker-opt-info">
          <span class="admin-picker-opt-name">Look ${num} — ${esc(lk.name || '')}</span>
          <span class="admin-picker-opt-sub">${pinCount} item pin${lk.desc ? ` · ${esc(lk.desc)}` : ''}</span>
        </span>
        ${isSel ? '<span class="admin-picker-opt-check" aria-hidden="true">✓</span>' : ''}
      </button>
    `;
  }).join('');

  return `
    <div class="admin-thumb-picker" data-prod-picker ${pickerCtx}>
      <input type="hidden" ${hiddenAttr} value="${safeIdx}">
      <button type="button" class="admin-picker-trigger" data-picker-toggle aria-expanded="false">
        ${renderLookThumbPickerTrigger(activeLook, safeIdx)}
      </button>
      <div class="admin-picker-menu" hidden>
        <div class="admin-picker-search-wrap">
          <input type="search" class="admin-picker-search" data-picker-search placeholder="Cari Look atau nama outfit...">
        </div>
        <div class="admin-picker-list" role="listbox">
          ${rows}
        </div>
      </div>
    </div>
  `;
}

function applyConfigToDOM(rawCfg) {
  const cfg = normalizeAdminConfig(rawCfg);
  activeConfig = cfg;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = value => { const n = Number(value) || 0; const abs = Math.abs(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return n < 0 ? `-RM ${abs}` : `RM ${abs}`; };
  const looks = cfg.looks || [];
  const items = cfg.items || [];
  const reels = cfg.reels || [];

  const runwayEl = document.querySelector('runway-section');
  if (runwayEl) {
    const secId = 'template--28035983671601__the_runway_wdM8BG';
    const subEl = runwayEl.querySelector('.rw__sub');
    if (subEl) subEl.textContent = `${looks.length} looks, styled head to toe. Tap a pin to see the piece.`;

    const actorsEl = runwayEl.querySelector('[data-rw-actors]');
    if (actorsEl) {
      actorsEl.innerHTML = looks.map((look, i) => `
        <div class="rw__model" data-rw-model data-index="${i}" aria-hidden="true">
          <span class="rw__shadow" aria-hidden="true"></span>
          <div class="rw__figure" style="--rw-ar: 0.5625;"><div class="rw__art">
            <img src="${esc(look.src)}" srcset="${esc(look.srcset || look.src)}" sizes="(min-width: 1800px) 540px, (min-width: 750px) 420px, 320px" loading="${i < 6 ? 'eager' : 'lazy'}" decoding="async" data-model-image alt="${esc(look.name)}" width="1100" height="1956" draggable="false">
            <button type="button" class="rw__hit" data-rw-go="${i}" aria-label="Look ${i + 1}: ${esc(look.name)}" tabindex="-1"></button>
          </div></div>
        </div>
      `).join('');
    }

    const heroesEl = runwayEl.querySelector('[data-rw-heroes]');
    if (heroesEl) {
      heroesEl.innerHTML = looks.map((look, i) => {
        const paired = (look.products || []).map(pid => items.find(p => p.id === pid)).filter(Boolean);
        const pins = look.pins || DEFAULT_PIN_SET;
        const pinsHtml = paired.map((prod, pIdx) => {
          const pt = pins[pIdx] || DEFAULT_PIN_SET[pIdx % MAX_LOOK_PINS];
          return `<button type="button" class="rw__pin${pt.x > 65 ? ' rw__pin--l' : ''}" data-rw-pin="${pIdx + 1}" data-tip="${esc(prod.name)}" style="left: ${pt.x}%; top: ${pt.y}%; --pi: ${pIdx + 1};" aria-label="${pIdx + 1}: ${esc(prod.name)}" tabindex="-1"><span class="rw__pin-dot" aria-hidden="true">${pIdx + 1}</span></button>`;
        }).join('');
        return `
          <div class="rw__hero${i === 0 ? ' is-on' : ''}" data-rw-hero data-index="${i}" data-name="${esc(look.name)}" data-label="Look ${i + 1}: ${esc(look.name)}" data-probe="${esc(look.src)}">
            <div class="rw__morph">
              <span class="rw__shadow" aria-hidden="true"></span>
              <div class="rw__figure" style="--rw-ar: 0.5625;"><div class="rw__art">
                <img src="${esc(look.src)}" srcset="${esc(look.srcset || look.src)}" sizes="(min-width: 1800px) 540px, (min-width: 750px) 420px, 320px" loading="${i < 6 ? 'eager' : 'lazy'}" decoding="async" data-model-image alt="${esc(look.name)}" width="1100" height="1956" draggable="false">
                <button type="button" class="rw__zoom" data-rw-zoom aria-label="View look: ${esc(look.name)}" tabindex="-1"></button>
                <div class="rw__pins">${pinsHtml}</div>
              </div></div>
            </div>
          </div>
        `;
      }).join('');
    }

    const ticksEl = runwayEl.querySelector('.rw__ticks');
    if (ticksEl) {
      ticksEl.innerHTML = looks.map((look, i) => `
        <button type="button" class="rw__tick" data-rw-tick="${i}" aria-current="${i === 0 ? 'true' : 'false'}" aria-label="Look ${i + 1}: ${esc(look.name)}">
          <span class="rw__tick-bar" aria-hidden="true"></span>
          <span class="rw__tick-label" aria-hidden="true">${String(i + 1).padStart(2, '0')}<span class="rw__tick-name">&nbsp;&nbsp;${esc(look.name)}</span></span>
        </button>
      `).join('');
    }

    const panelInner = runwayEl.querySelector('.rw__panel-inner');
    if (panelInner) {
      const panelsHtml = looks.map((look, i) => {
        const paired = (look.products || []).map(pid => items.find(p => p.id === pid)).filter(Boolean);
        let originalSum = 0;
        const itemsHtml = paired.map((prod, itemIdx) => {
          originalSum += getSalePrice(prod);
          const variants = buildVariantsForItem(prod);
          const stock = Number(prod.stock ?? 0);
          const soldOut = stock <= 0;
          const lowStock = stock > 0 && stock <= 5;
          const cardNo = itemIdx + 1;
          const pickerId = `Picker-${secId}-look_${i}-${cardNo}`;
          const optName = `Opt-${secId}-look_${i}-${cardNo}`;
          const urlValid = prod.url && /^https?:\/\//i.test(prod.url);
          const jsonVariants = JSON.stringify(variants.map(v => ({ id: v.id, a: v.a, o: [v.o] })));
          const sizeLegend = prod.category === 'footwear' ? 'Shoe size' : 'Size';
          const singleVarAttr = variants.length === 1 && !soldOut ? `data-variant-id="${variants[0].id}"` : '';
          const sizeNote = variants.length === 1 ? ` <span class="rw__size-note">Saiz: ${esc(variants[0].o)}</span>` : '';
          return `
            <li class="rw__item${soldOut ? ' is-soldout' : ''}" data-rw-card="${cardNo}" ${singleVarAttr} style="--i: ${cardNo};" data-title="${esc(prod.name)}">
              <a class="rw__media" href="${urlValid ? esc(prod.url) : '#runway'}" ${urlValid ? 'target="_blank" rel="noopener noreferrer"' : ''} tabindex="-1" aria-hidden="true">
                <img src="${esc(prod.image)}" loading="lazy" decoding="async" alt="" width="400" height="400">
                <span class="rw__num">${cardNo}</span>
              </a>
              <div class="rw__info">
                <span class="rw__type">${esc(prod.type)}</span>
                <a class="rw__name" href="${urlValid ? esc(prod.url) : '#runway'}" ${urlValid ? 'target="_blank" rel="noopener noreferrer"' : ''}>${esc(prod.name)}</a>
                <span class="rw__price">${formatItemPriceHtml(prod)}${sizeNote}${soldOut ? ' <span class="rw__stock-tag is-out">Habis stok</span>' : (lowStock ? ` <span class="rw__stock-tag is-low">Baki ${stock}</span>` : '')}</span>
                <button type="button" class="rw__share-inline" data-share-item="${esc(prod.id)}" aria-label="Salin link ${esc(prod.name)}">🔗 Salin link item</button>
              </div>
              <button type="button" class="rw__add" data-rw-add ${soldOut ? 'disabled' : ''} aria-expanded="false" aria-controls="${pickerId}" aria-label="${soldOut ? 'Sold out: ' : 'Add to bag: '}${esc(prod.name)}" data-added-label="Added to bag: ${esc(prod.name)}">
                <svg class="rw__i-plus" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 4v16M4 12h16"/></svg>
                <svg class="rw__i-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4.5 12.5l5 5L19.5 7"/></svg>
                <svg class="rw__i-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 3a9 9 0 1 1-9 9"/></svg>
              </button>
              <div class="rw__picker" id="${pickerId}" data-rw-picker hidden>
                <div class="rw__picker-head">
                  <span class="rw__picker-thumb" aria-hidden="true"><img src="${esc(prod.image)}" loading="lazy" decoding="async" alt="" width="160" height="160"></span>
                  <span class="rw__picker-meta"><span class="rw__picker-title">${esc(prod.name)}</span><span class="rw__picker-price">${formatItemPriceHtml(prod)}</span></span>
                  <button type="button" class="rw__picker-close" data-rw-pick-close aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M5 5l14 14M19 5L5 19"/></svg></button>
                </div>
                <fieldset class="rw__opt">
                  <legend class="rw__opt-name">${sizeLegend}</legend>
                  <div class="rw__opt-values">
                    ${variants.map((v, vi) => `<label class="rw__pill"><input type="radio" name="${optName}" value="${esc(v.o)}" data-rw-option="0" ${vi === 0 ? 'checked' : ''}><span class="rw__pill-label">${esc(v.o)}</span></label>`).join('')}
                  </div>
                </fieldset>
                <button type="button" class="rw__confirm" data-rw-confirm ${soldOut ? 'disabled' : ''}>
                  <span data-rw-confirm-label data-add="Add to bag">${soldOut ? 'Sold out' : 'Add to bag'}</span>
                  <span class="rw__sr"> — ${esc(prod.name)}</span>
                </button>
                <script type="application/json" data-rw-variants>${jsonVariants}</script>
              </div>
            </li>
          `;
        }).join('');
        const discounted = originalSum * 0.9;
        return `
          <div class="rw__look-panel${i === 0 ? ' is-in' : ''}" data-rw-panel="${i}" ${i === 0 ? '' : 'hidden'}>
            <div class="rw__mhead">
              <span class="rw__mhead-title">${esc(look.name)}</span>
              <span class="rw__label">${paired.length} pieces</span>
            </div>
            <ul class="rw__items" role="list">${itemsHtml}</ul>
            <div class="rw__bundle has-rule">
              <p class="rw__msg" data-rw-msg role="status" aria-live="polite"></p>
              <div class="rw__bundle-row">
                <div class="rw__bundle-copy">
                  <span class="rw__bundle-title">Complete the look</span>
                  <span class="rw__bundle-note">Bundle all ${paired.length} and save 10%</span>
                </div>
                <div class="rw__bundle-price"><s>${money(originalSum)}</s><strong>${money(discounted)}</strong></div>
              </div>
              <button type="button" class="rw__cta" data-rw-all>
                <span class="rw__cta-add">Add full look to bag</span>
                <span class="rw__cta-m">Add full look — ${money(discounted)}</span>
                <span class="rw__cta-done">Full look in your bag</span>
                <svg class="rw__i-arrow" width="22" height="12" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M1 7h24M19 1l6 6-6 6"/></svg>
                <svg class="rw__i-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 3a9 9 0 1 1-9 9"/></svg>
              </button>
            </div>
            <template data-rw-pieces-text>${paired.length} pieces</template>
          </div>
        `;
      }).join('');
      panelInner.innerHTML = `<div class="rw__panel-head"><h3 class="rw__panel-title">In this look</h3><span class="rw__label" data-rw-pieces></span></div>${panelsHtml}`;
    }

    if (typeof runwayEl.rebuild === 'function') runwayEl.rebuild();
  }

  // Sync Home Hero Metrics & Copy
  const looksCountEl = document.querySelector('[data-home-looks-count]');
  const piecesCountEl = document.querySelector('[data-home-pieces-count]');
  const reelsCountEl = document.querySelector('[data-home-reels-count]');
  const homeAllTab = document.querySelector('[data-home-filter="all"]');
  const looksSummaryEl = document.querySelector('[data-home-looks-summary]');
  const footerSummaryEl = document.querySelector('.home-footer-brand p');
  if (looksCountEl) looksCountEl.textContent = String(looks.length).padStart(2, '0');
  if (piecesCountEl) piecesCountEl.textContent = String(items.length).padStart(2, '0');
  if (reelsCountEl) reelsCountEl.textContent = String(reels.length).padStart(2, '0');
  if (homeAllTab) homeAllTab.textContent = `All (${String(items.length).padStart(2, '0')})`;
  if (looksSummaryEl) looksSummaryEl.textContent = `${looks.length} curated vintage & modest looks styled head to toe. Mix timeless outerwear, flowy shawls, classic leather bags, and everyday outlet staples.`;
  if (footerSummaryEl) footerSummaryEl.textContent = `${looks.length} curated vintage & modest looks styled head to toe. Timeless outerwear, scarves, leather bags, and footwear.`;

  // Sync #rail-up-look picker with thumbnails in public Hand Rail upload modal
  const railLookWrap = document.getElementById('rail-up-look-wrap');
  if (railLookWrap) {
    const curVal = parseInt(document.getElementById('rail-up-look')?.value || '0', 10) || 0;
    railLookWrap.innerHTML = renderLookThumbPickerMarkup({
      looks,
      selIndex: curVal,
      hiddenId: 'rail-up-look'
    });
  }

  if (window.RunwayBag && typeof window.RunwayBag.updateCatalog === 'function') {
    window.RunwayBag.updateCatalog(items, looks);
  }
  if (window.OrbitGallery && typeof window.OrbitGallery.render === 'function') {
    window.OrbitGallery.render(cfg);
  }
  if (window.HomeView && typeof window.HomeView.render === 'function') {
    window.HomeView.render(cfg);
  }
  if (window.HandRailPro && typeof window.HandRailPro.refresh === 'function') {
    window.HandRailPro.refresh(cfg);
  }
}

// Admin UI Controller
function setupAdminPortal() {
  const dialog = document.getElementById('admin-dialog');
  if (!dialog) return;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => { const n = Number(v) || 0; const abs = Math.abs(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return n < 0 ? `-RM ${abs}` : `RM ${abs}`; };
  const floatingBtn = document.getElementById('floating-admin-btn');
  const headerAdminBtn = document.getElementById('open-admin-header-btn');
  const closeBtn = document.getElementById('close-admin');
  const cancelBtn = document.getElementById('admin-cancel-btn');
  const lockBtn = document.getElementById('admin-lock-btn');
  const saveBtn = document.getElementById('admin-save-btn');
  const saveTopBtn = document.getElementById('admin-save-top-btn');
  const resetBtn = document.getElementById('admin-reset-default');
  const exportBtn = document.getElementById('admin-export-json');
  const importInput = document.getElementById('admin-import-file');
  const specialUrlInput = document.getElementById('admin-special-url');
  const copyLinkBtn = document.getElementById('admin-copy-link');
  const topTitleEl = document.getElementById('admin-topbar-section');
  const topDescEl = document.getElementById('admin-topbar-desc');
  const dirtyDotEl = document.querySelector('[data-admin-dirty-dot]');
  const dirtyTextEl = document.querySelector('[data-admin-dirty-text]');

  const TAB_META = {
    overview: { title: 'Ringkasan Dashboard', desc: 'Pantau stok inventori, urus outfit full-body 3D Runway, dan muat naik video Hand Rail Pro.' },
    looks: { title: 'Outfits & 3D Runway', desc: 'Tambah atau kemaskini gambar full-body, item padanan & koordinat pin 3D Runway.' },
    products: { title: 'Stok & Item Inventori', desc: 'Kemaskini kuantiti stok, harga, saiz, kategori & tambah item baharu.' },
    videos: { title: 'Hand Rail Pro Video', desc: 'Muat naik klip 9:16 MP4/WebM dan pautkan ke mana-mana Outfit untuk butang Shop Look.' },
    orders: { title: 'Lock Item & Bayaran', desc: 'Pantau item yang telah di-lock pelanggan melalui WhatsApp & kemaskini status Complete Payment.' },
    customers: { title: 'Pelanggan & Analisis', desc: 'Pantau detail pelanggan, kadar bayaran, item kegemaran & buat follow-up WhatsApp.' },
    offers: { title: 'Offer & Promo Countdown', desc: 'Pilih item, tetapkan jenis promo, diskaun & masa tamat. Harga kembali asal secara automatik bila countdown habis.' },
    sales: { title: 'Sales & Target Monitor', desc: 'Pantau jualan disahkan, pipeline lock, pecahan kategori & pencapaian target harian/bulanan.' },
    settings: { title: 'Sandaran & Akses', desc: 'Salin pautan akses admin, eksport/import JSON atau pulihkan data asal.' }
  };

  const SALES_TARGET_KEY = 'sahira_sales_targets_v1';
  const getSalesTargets = () => {
    const cached = getSalesTargetsCache();
    return {
      daily: Math.max(0, Number(cached.daily ?? 500) || 500),
      monthly: Math.max(0, Number(cached.monthly ?? 5000) || 5000),
      monthlyUnits: Math.max(0, parseInt(cached.monthlyUnits ?? 40, 10) || 40)
    };
  };
  const saveSalesTargets = t => {
    saveSalesTargetsToDb(t);
  };

  let adminSessionUnlocked = false;
  let activeAdminTab = 'overview';
  let prodFilter = 'all';
  let orderFilter = 'all';
  let orderViewMode = 'orders';
  let custFilter = 'all';
  let custSort = 'recent';
  let salesPeriod = 'month';
  let lookSearch = '';
  let prodSearch = '';
  let videoSearch = '';
  let orderSearch = '';
  let custSearch = '';
  const expandedProdIds = new Set();
  const selectedProductIds = new Set();
  const expandedLookIndices = new Set();
  const expandedCustKeys = new Set();
  let isDirty = false;
  let pendingNewVideoBlob = '';
  let newLookDraftProds = [];
  let workingConfig = normalizeAdminConfig(JSON.parse(JSON.stringify(activeConfig)));

  const adminToastEl = document.getElementById('admin-toast');

  const setDirty = (dirty) => {
    isDirty = Boolean(dirty);
    if (dirtyDotEl) dirtyDotEl.classList.toggle('is-dirty', isDirty);
    if (dirtyTextEl) dirtyTextEl.textContent = isDirty ? 'Perubahan belum disimpan' : 'Semua perubahan disegerak';
    dialog.querySelectorAll('[data-look-dirty]').forEach(el => {
      el.hidden = !isDirty;
    });
  };

  const updateSidebarCounts = () => {
    const cLooks = document.querySelector('[data-admin-count="looks"]');
    const cProds = document.querySelector('[data-admin-count="products"]');
    const cVideos = document.querySelector('[data-admin-count="videos"]');
    const cOrders = document.querySelector('[data-admin-count="orders"]');
    const cCusts = document.querySelector('[data-admin-count="customers"]');
    const cSales = document.querySelector('[data-admin-count="sales"]');
    const cOffers = document.querySelector('[data-admin-count="offers"]');
    if (cOffers) cOffers.textContent = String(workingConfig.items.filter(isOfferActive).length).padStart(2, '0');
    if (cLooks) cLooks.textContent = String(workingConfig.looks.length).padStart(2, '0');
    if (cProds) cProds.textContent = String(workingConfig.items.length).padStart(2, '0');
    if (cVideos) cVideos.textContent = String(workingConfig.reels.length).padStart(2, '0');
    if (cOrders) {
      const lockStats = window.SahiraLockOrders?.getSummaryStats?.();
      cOrders.textContent = String(lockStats?.lockedUnits || 0).padStart(2, '0');
    }
    if (cCusts) {
      const custData = buildCustomerAnalytics();
      cCusts.textContent = String(custData.customers.length).padStart(2, '0');
    }
    if (cSales) {
      const salesSummary = buildSalesMetrics('month');
      cSales.textContent = `${salesSummary.monthPct}%`;
    }
  };

  const getSpecialAdminUrl = () => {
    const basePath = window.location.pathname.replace(/\/admin\/?$/i, '/') || '/';
    return window.location.origin + basePath + '#admin';
  };

  const isSpecialAdminUrl = () => {
    const hash = (window.location.hash || '').toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const path = (window.location.pathname || '').toLowerCase();
    return hash === '#admin' || hash === '#studio-admin' || params.get('admin') === '1' || params.get('admin') === 'true' || params.get('studio') === 'admin' || path.endsWith('/admin') || path.endsWith('/admin/');
  };

  const confirmModal = document.getElementById('admin-confirm-modal');
  const confirmMessage = document.getElementById('admin-confirm-message');
  const confirmList = document.getElementById('admin-confirm-list');
  const closeBulkConfirm = () => { if (confirmModal) confirmModal.hidden = true; };

  const notify = (msg, isError = false) => {
    if (dialog.open && adminToastEl) {
      adminToastEl.textContent = msg;
      adminToastEl.classList.toggle('is-error', Boolean(isError));
      adminToastEl.hidden = false;
      clearTimeout(adminToastEl.hideTimer);
      adminToastEl.hideTimer = setTimeout(() => { adminToastEl.hidden = true; }, isError ? 4200 : 2800);
      return;
    }
    const status = document.getElementById('bag-status');
    if (status) {
      status.textContent = msg;
      status.classList.add('is-on');
      clearTimeout(status.hideTimer);
      status.hideTimer = setTimeout(() => status.classList.remove('is-on'), isError ? 4200 : 2500);
    }
  };

  const stockBadgeHtml = (stock) => {
    const n = Number(stock ?? 0);
    if (n <= 0) return '<span class="admin-stock-status is-out"><span class="admin-status-indicator"></span>Habis Stok (0)</span>';
    if (n <= 5) return `<span class="admin-stock-status is-low"><span class="admin-status-indicator"></span>Stok Rendah (${n})</span>`;
    return `<span class="admin-stock-status is-ok"><span class="admin-status-indicator"></span>Tersedia (${n})</span>`;
  };

  const renderCategoryOptions = (selected) => {
    const sel = normalizeCategory(selected);
    return CATEGORY_DEFS.map(c => `<option value="${c.key}" ${c.key === sel ? 'selected' : ''}>${esc(c.label)}</option>`).join('');
  };

  const buildSizeChipsHtml = (activeSizes, category, attrName, idxAttr) => {
    const active = parseSizeList(activeSizes);
    const allChoices = [...new Set([...getCategoryDef(category).presets, ...active])];
    return allChoices.map(sz => {
      const on = active.includes(sz);
      return `<button type="button" class="admin-size-chip${on ? ' is-on' : ''}" ${attrName}="${esc(sz)}" ${idxAttr !== undefined && idxAttr !== null ? `data-idx="${idxAttr}"` : ''} aria-pressed="${on ? 'true' : 'false'}">${esc(sz)}</button>`;
    }).join('');
  };

  const renderNewProdSizeChips = () => {
    const wrap = document.getElementById('new-prod-size-presets');
    const catEl = document.getElementById('new-prod-cat');
    const sizesEl = document.getElementById('new-prod-sizes');
    if (!wrap || !sizesEl) return;
    wrap.innerHTML = buildSizeChipsHtml(parseSizeList(sizesEl.value), catEl?.value || 'apparel', 'data-new-size-toggle', null);
  };

  const buildBrandChipsHtml = (currentBrand, category, attrName, idxAttr) => {
    const curLower = String(currentBrand || '').trim().toLowerCase();
    const brands = getCategoryDef(category).brandPresets || ['Sahira Premium Outlet', 'Unbrand'];
    return brands.map(b => {
      const on = curLower === b.toLowerCase();
      return `<button type="button" class="admin-size-chip${on ? ' is-on' : ''}" ${attrName}="${esc(b)}" ${idxAttr !== undefined && idxAttr !== null ? `data-idx="${idxAttr}"` : ''} aria-pressed="${on ? 'true' : 'false'}">${esc(b)}</button>`;
    }).join('');
  };

  const renderNewProdBrandChips = () => {
    const wrap = document.getElementById('new-prod-brand-presets');
    const catEl = document.getElementById('new-prod-cat');
    const typeEl = document.getElementById('new-prod-type');
    if (!wrap || !typeEl) return;
    wrap.innerHTML = buildBrandChipsHtml(typeEl.value, catEl?.value || 'apparel', 'data-new-brand-pick', null);
  };

  function switchAdminTab(tabName) {
    closeAllProductPickers();
    activeAdminTab = TAB_META[tabName] ? tabName : 'overview';
    dialog.querySelectorAll('[data-admin-tab]').forEach(b => {
      const on = b.dataset.adminTab === activeAdminTab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    dialog.querySelectorAll('.admin-tab-content').forEach(sec => {
      sec.hidden = sec.id !== 'admin-tab-' + activeAdminTab;
    });
    if (topTitleEl) topTitleEl.textContent = TAB_META[activeAdminTab].title;
    if (topDescEl) topDescEl.textContent = TAB_META[activeAdminTab].desc;
    if (activeAdminTab === 'overview') renderAdminOverview();
    if (activeAdminTab === 'looks') renderAdminLooks();
    if (activeAdminTab === 'products') renderAdminProducts();
    if (activeAdminTab === 'videos') renderAdminVideos();
    if (activeAdminTab === 'orders') renderAdminOrders();
    if (activeAdminTab === 'customers') renderAdminCustomers();
    if (activeAdminTab === 'sales') renderAdminSales();
    if (activeAdminTab === 'offers') renderAdminOffers();
  }

  function renderAdminOverview() {
    updateSidebarCounts();
    const kpiGrid = document.getElementById('admin-kpi-grid');
    const lowList = document.getElementById('admin-lowstock-list');
    const items = workingConfig.items || [];
    const looks = workingConfig.looks || [];
    const reels = workingConfig.reels || [];
    const totalUnits = items.reduce((s, it) => s + Math.max(0, Number(it.stock ?? 0)), 0);
    const lowItems = items.filter(it => Number(it.stock ?? 0) <= 5);
    const realVideos = reels.filter(r => Boolean(r.videoUrl)).length;
    const lockStats = window.SahiraLockOrders?.getSummaryStats?.() || { lockedUnits: 0, paidUnits: 0 };
    const salesSnap = buildSalesMetrics('month');

    if (kpiGrid) {
      kpiGrid.innerHTML = `
        <div class="admin-kpi-card"><span class="admin-kpi-label">Outfits &amp; Runway</span><strong class="admin-kpi-value">${looks.length}</strong><span class="admin-kpi-meta">Model full-body aktif</span></div>
        <div class="admin-kpi-card"><span class="admin-kpi-label">Jumlah Item</span><strong class="admin-kpi-value">${items.length}</strong><span class="admin-kpi-meta">${CATEGORY_DEFS.length} kategori aktif</span></div>
        <div class="admin-kpi-card"><span class="admin-kpi-label">Jumlah Unit Stok</span><strong class="admin-kpi-value">${totalUnits}</strong><span class="admin-kpi-meta">Unit inventori tersedia</span></div>
        <div class="admin-kpi-card"><span class="admin-kpi-label">Stok Rendah / Habis</span><strong class="admin-kpi-value">${lowItems.length}</strong><span class="admin-kpi-meta">${lowItems.length ? 'Perlu tambah kuantiti' : 'Semua paras selamat'}</span></div>
        <div class="admin-kpi-card"><span class="admin-kpi-label">Sales Bulan Ini</span><strong class="admin-kpi-value">${money(salesSnap.monthPaidValue)}</strong><span class="admin-kpi-meta">Target ${salesSnap.monthPct}% drpd ${money(salesSnap.targets.monthly)}</span></div>
        <div class="admin-kpi-card"><span class="admin-kpi-label">Lock &amp; Bayaran</span><strong class="admin-kpi-value">${lockStats.lockedUnits}</strong><span class="admin-kpi-meta">${lockStats.paidUnits} unit Complete Payment</span></div>
      `;
    }

    const offersList = document.getElementById('admin-offers-list');
    if (offersList) {
      const offerItems = items.filter(it => it.offerEnabled && it.offerEndsAt);
      offersList.innerHTML = offerItems.length ? offerItems.map(it => {
        const active = isOfferActive(it);
        const ends = it.offerEndsAt ? formatOrderDate(it.offerEndsAt) : '-';
        return `<div class="admin-offer-row ${active ? 'is-active' : 'is-expired'}"><img src="${esc(it.image)}" alt="${esc(it.name)}"><div><strong>${esc(it.name)}</strong><span>${active ? `${esc(it.offerLabel || 'Special Offer')} · -${clampDiscount(it.offerDiscount)}% · Tamat ${esc(ends)}` : 'Offer tamat · harga asal digunakan'}</span></div><button type="button" class="admin-btn secondary admin-btn-xs" data-admin-jump="offers">Edit</button></div>`;
      }).join('') : '<div class="admin-empty-box">Belum ada special offer aktif. Buka Urus Offer Item untuk pilih item dan tetapkan countdown.</div>';
    }

    if (lowList) {
      if (!lowItems.length) {
        lowList.innerHTML = '<div class="admin-empty-box">Semua item mempunyai kuantiti stok melebihi 5 unit.</div>';
      } else {
        lowList.innerHTML = lowItems.map(it => {
          const idx = items.findIndex(x => x.id === it.id);
          return `
            <div class="admin-lowstock-row">
              <img src="${esc(it.image)}" alt="${esc(it.name)}">
              <div class="admin-lowstock-info">
                <strong>${esc(it.name)}</strong>
                <div>${stockBadgeHtml(it.stock)}</div>
              </div>
              <div class="admin-lowstock-btns">
                <button type="button" class="admin-btn secondary admin-btn-xs" data-admin-restock="${idx}" data-add="5">+5</button>
                <button type="button" class="admin-btn primary admin-btn-xs" data-admin-restock="${idx}" data-add="10">+10</button>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  function closeAllProductPickers() {
    dialog.querySelectorAll('[data-prod-picker].is-open').forEach(p => {
      p.classList.remove('is-open');
      const trig = p.querySelector('[data-picker-toggle]');
      const menu = p.querySelector('.admin-picker-menu');
      if (trig) trig.setAttribute('aria-expanded', 'false');
      if (menu) menu.hidden = true;
    });
    dialog.querySelectorAll('.is-picker-open').forEach(el => el.classList.remove('is-picker-open'));
  }

  function setActivePinSlot(card, slot) {
    if (!card) return;
    const totalPins = card.querySelectorAll('[data-pin-slot-card]').length || MAX_LOOK_PINS;
    const s = Math.min(Math.max(0, totalPins - 1), Math.max(0, Number(slot) || 0));
    card.dataset.activePin = String(s);
    card.querySelectorAll('[data-pin-slot-card]').forEach(el => {
      el.classList.toggle('is-pin-active', Number(el.dataset.pinSlotCard) === s);
    });
    card.querySelectorAll('[data-preview-pin-pick]').forEach(dot => {
      dot.classList.toggle('is-active', Number(dot.dataset.previewPinPick) === s);
    });
    const hint = card.querySelector('[data-pin-hint]');
    if (hint) hint.innerHTML = `Seret atau klik gambar untuk <strong>Pin ${s + 1}</strong>`;
  }

  const pinStudioEl = document.getElementById('admin-pin-studio');
  let pinStudioLookIdx = -1;
  let pinStudioActiveSlot = 0;

  function applyPinCoord(lookIdx, slot, nx, ny) {
    const lk = workingConfig.looks[lookIdx];
    if (!lk) return;
    const cx = Math.min(96, Math.max(4, Math.round(Number(nx) || 50)));
    const cy = Math.min(97, Math.max(4, Math.round(Number(ny) || 50)));
    lk.pins = Array.isArray(lk.pins) ? lk.pins : [];
    while (lk.pins.length <= slot) {
      lk.pins.push({ ...DEFAULT_PIN_SET[lk.pins.length % MAX_LOOK_PINS] });
    }
    lk.pins[slot] = { x: cx, y: cy };

    const card = dialog.querySelector(`.admin-look-card[data-look-idx="${lookIdx}"]`);
    if (card) {
      const xInp = card.querySelector(`[data-look-pin-axis="x"][data-slot="${slot}"]`);
      const yInp = card.querySelector(`[data-look-pin-axis="y"][data-slot="${slot}"]`);
      const dot = card.querySelector(`[data-preview-pin-pick="${slot}"]`);
      if (xInp) xInp.value = String(cx);
      if (yInp) yInp.value = String(cy);
      if (dot) {
        dot.style.left = `${cx}%`;
        dot.style.top = `${cy}%`;
      }
    }

    if (pinStudioEl && !pinStudioEl.hidden && pinStudioLookIdx === lookIdx) {
      const stPin = pinStudioEl.querySelector(`[data-studio-pin="${slot}"]`);
      const stX = pinStudioEl.querySelector(`[data-studio-axis="x"][data-slot="${slot}"]`);
      const stY = pinStudioEl.querySelector(`[data-studio-axis="y"][data-slot="${slot}"]`);
      const gX = pinStudioEl.querySelector('.admin-studio-guide-x');
      const gY = pinStudioEl.querySelector('.admin-studio-guide-y');
      if (stPin) {
        stPin.style.left = `${cx}%`;
        stPin.style.top = `${cy}%`;
        stPin.classList.toggle('is-right-edge', cx > 65);
      }
      if (stX && document.activeElement !== stX) stX.value = String(cx);
      if (stY && document.activeElement !== stY) stY.value = String(cy);
      if (gX) gX.style.top = `${cy}%`;
      if (gY) gY.style.left = `${cx}%`;
    }

    setDirty(true);
  }

  function setPinStudioActiveSlot(slot) {
    if (!pinStudioEl || pinStudioEl.hidden) return;
    const lk = workingConfig.looks[pinStudioLookIdx];
    const total = Math.max(1, (lk?.products || []).length);
    pinStudioActiveSlot = Math.min(total - 1, Math.max(0, Number(slot) || 0));
    pinStudioEl.querySelectorAll('[data-studio-pin]').forEach(p => {
      p.classList.toggle('is-active', Number(p.dataset.studioPin) === pinStudioActiveSlot);
    });
    pinStudioEl.querySelectorAll('[data-studio-item]').forEach(row => {
      row.classList.toggle('is-active', Number(row.dataset.studioItem) === pinStudioActiveSlot);
    });
    const pt = lk?.pins?.[pinStudioActiveSlot] || DEFAULT_PIN_SET[pinStudioActiveSlot % MAX_LOOK_PINS];
    const gX = pinStudioEl.querySelector('.admin-studio-guide-x');
    const gY = pinStudioEl.querySelector('.admin-studio-guide-y');
    if (gX) gX.style.top = `${pt.y}%`;
    if (gY) gY.style.left = `${pt.x}%`;
    const card = dialog.querySelector(`.admin-look-card[data-look-idx="${pinStudioLookIdx}"]`);
    if (card) setActivePinSlot(card, pinStudioActiveSlot);
  }

  function pickNextPinCoord(existingPins) {
    const used = Array.isArray(existingPins) ? existingPins : [];
    if (!used.length) return { ...DEFAULT_PIN_SET[0] };
    let best = DEFAULT_PIN_SET[used.length % MAX_LOOK_PINS];
    let bestDist = -1;
    for (const candidate of DEFAULT_PIN_SET) {
      const minD = Math.min(...used.map(p => Math.hypot((p?.x ?? 50) - candidate.x, (p?.y ?? 50) - candidate.y)));
      if (minD > bestDist) {
        bestDist = minD;
        best = candidate;
      }
    }
    return { ...best };
  }

  function openLookSlotPicker(card, slot) {
    if (!card) return;
    const picker = card.querySelector(`[data-prod-picker][data-slot="${slot}"]`);
    const toggle = picker?.querySelector('[data-picker-toggle]');
    if (!picker || !toggle) return;
    closeAllProductPickers();
    picker.classList.add('is-open');
    picker.closest('.admin-look-card, .admin-video-card, .admin-creator-drawer')?.classList.add('is-picker-open');
    picker.closest('.admin-pin-slot, .admin-form-group')?.classList.add('is-picker-open');
    toggle.setAttribute('aria-expanded', 'true');
    const menu = picker.querySelector('.admin-picker-menu');
    if (menu) {
      menu.hidden = false;
      menu.classList.remove('open-up', 'align-right');
      const scrollWrap = dialog.querySelector('.admin-main-scroll');
      const wrapRect = (scrollWrap || dialog).getBoundingClientRect();
      const trigRect = toggle.getBoundingClientRect();
      if (trigRect.bottom + 275 > wrapRect.bottom && trigRect.top - 275 > wrapRect.top) {
        menu.classList.add('open-up');
      }
      if (trigRect.left + 275 > wrapRect.right) {
        menu.classList.add('align-right');
      }
      const searchInp = menu.querySelector('[data-picker-search]');
      if (searchInp) {
        searchInp.value = '';
        menu.querySelectorAll('[data-picker-choose]').forEach(opt => { opt.hidden = false; });
        requestAnimationFrame(() => searchInp.focus({ preventScroll: true }));
      }
    }
  }

  function addPinToLook(idx, { openPicker = false } = {}) {
    const lk = workingConfig.looks[idx];
    if (!lk) return -1;
    lk.products = Array.isArray(lk.products) ? lk.products : [];
    if (lk.products.length >= MAX_LOOK_PINS) {
      notify(`Maksimum ${MAX_LOOK_PINS} Item Pin bagi setiap Outfit.`);
      return -1;
    }
    const unused = workingConfig.items.find(it => !lk.products.includes(it.id)) || workingConfig.items[0];
    if (!unused) {
      notify('Tiada item dalam katalog untuk dipin.', true);
      return -1;
    }
    const newSlot = lk.products.length;
    lk.products.push(unused.id);
    const curPins = Array.isArray(lk.pins) ? lk.pins.slice(0, newSlot) : [];
    while (curPins.length < newSlot) {
      curPins.push(pickNextPinCoord(curPins));
    }
    curPins.push(pickNextPinCoord(curPins));
    lk.pins = curPins;
    expandedLookIndices.add(idx);
    setDirty(true);
    refreshSingleLookCard(idx, { activeSlot: newSlot, openPickerSlot: openPicker ? newSlot : -1 });
    if (pinStudioEl && !pinStudioEl.hidden && pinStudioLookIdx === idx) {
      openPinStudio(idx, newSlot);
    }
    notify(`Item Pin ${newSlot + 1} (${unused.name}) ditambah — pilih item & tekan Simpan Update.`);
    return newSlot;
  }

  function removePinFromLook(idx, slot) {
    const lk = workingConfig.looks[idx];
    if (!lk || !Array.isArray(lk.products) || lk.products.length <= 1) {
      notify('Minimum 1 Item Pin mesti kekal pada setiap Outfit.');
      return -1;
    }
    const oldCard = dialog.querySelector(`.admin-look-card[data-look-idx="${idx}"]`);
    const prevActive = parseInt(oldCard?.dataset.activePin || String(pinStudioActiveSlot) || '0', 10);
    lk.products.splice(slot, 1);
    if (Array.isArray(lk.pins) && lk.pins.length > slot) {
      lk.pins.splice(slot, 1);
    }
    const nextActive = prevActive > slot ? prevActive - 1 : Math.min(prevActive, lk.products.length - 1);
    expandedLookIndices.add(idx);
    setDirty(true);
    refreshSingleLookCard(idx, { activeSlot: nextActive });
    if (pinStudioEl && !pinStudioEl.hidden && pinStudioLookIdx === idx) {
      openPinStudio(idx, nextActive);
    }
    return nextActive;
  }

  function openPinStudio(lookIdx, initialSlot = 0) {
    if (!pinStudioEl) return;
    const lk = workingConfig.looks[lookIdx];
    if (!lk) return;
    pinStudioLookIdx = lookIdx;
    const prods = lk.products || [];
    const pins = lk.pins || DEFAULT_PIN_SET;
    const total = Math.max(1, prods.length);
    pinStudioActiveSlot = Math.min(total - 1, Math.max(0, Number(initialSlot) || 0));

    const pinsHtml = prods.map((pid, slot) => {
      const prod = workingConfig.items.find(it => it.id === pid);
      const pt = pins[slot] || DEFAULT_PIN_SET[slot % MAX_LOOK_PINS];
      return `
        <button type="button" class="admin-studio-pin${slot === pinStudioActiveSlot ? ' is-active' : ''}${pt.x > 65 ? ' is-right-edge' : ''}" data-studio-pin="${slot}" style="left:${pt.x}%;top:${pt.y}%;" aria-label="Pin ${slot + 1}: ${esc(prod?.name || 'Item')}">
          <span>${slot + 1}</span>
          <span class="admin-studio-pin-tag">${esc(prod?.name || 'Item ' + (slot + 1))}</span>
        </button>
      `;
    }).join('');

    const itemsListHtml = prods.map((pid, slot) => {
      const prod = workingConfig.items.find(it => it.id === pid);
      const pt = pins[slot] || DEFAULT_PIN_SET[slot % MAX_LOOK_PINS];
      const itemOpts = workingConfig.items.map(it => {
        const d = clampDiscount(it.discount);
        return `<option value="${esc(it.id)}" ${it.id === pid ? 'selected' : ''}>${esc(it.name)} (${esc(getCategoryDef(it.category).label)} · ${money(getSalePrice(it))}${d > 0 ? ` -${d}%` : ''})</option>`;
      }).join('');
      return `
        <div class="admin-pin-studio-item${slot === pinStudioActiveSlot ? ' is-active' : ''}" data-studio-item="${slot}">
          <div class="admin-pin-studio-item-top">
            <span class="admin-pin-studio-num">${slot + 1}</span>
            ${prod?.image ? `<img class="admin-pin-studio-thumb" src="${esc(prod.image)}" alt="">` : ''}
            <div class="admin-pin-studio-meta">
              <strong>${esc(prod?.name || 'Item ' + (slot + 1))}</strong>
              <span>${prod ? `${esc(getCategoryDef(prod.category).label)} · ${money(getSalePrice(prod))}${clampDiscount(prod.discount) > 0 ? ` (-${clampDiscount(prod.discount)}%)` : ''}` : ''}</span>
            </div>
            ${prods.length > 1 ? `<button type="button" class="admin-pin-remove-btn" data-studio-remove="${slot}" title="Buang Item Pin ${slot + 1}" aria-label="Buang Item Pin ${slot + 1}">×</button>` : ''}
          </div>
          <select class="admin-studio-prod-select" data-studio-prod="${slot}" aria-label="Pilih item untuk Pin ${slot + 1}">
            ${itemOpts}
          </select>
          <div class="admin-pin-coords">
            <label><span>X%</span><input type="number" min="4" max="96" class="admin-input-text" data-studio-axis="x" data-slot="${slot}" value="${pt.x}"></label>
            <label><span>Y%</span><input type="number" min="4" max="97" class="admin-input-text" data-studio-axis="y" data-slot="${slot}" value="${pt.y}"></label>
          </div>
        </div>
      `;
    }).join('');

    const initPt = pins[pinStudioActiveSlot] || DEFAULT_PIN_SET[pinStudioActiveSlot % MAX_LOOK_PINS];
    pinStudioEl.innerHTML = `
      <div class="admin-pin-studio-card">
        <div class="admin-pin-studio-head">
          <div>
            <h3>Laraskan Kedudukan Pin · Look ${String(lookIdx + 1).padStart(2, '0')} (${esc(lk.name)})</h3>
            <p>Klik atau seret pin bernombor terus di atas gambar model. Gunakan kekunci anak panah untuk pelarasan halus.</p>
          </div>
          <button type="button" class="admin-close-btn" data-close-pin-studio aria-label="Tutup Pelaras Pin">×</button>
        </div>
        <div class="admin-pin-studio-body">
          <div class="admin-pin-studio-stage" data-studio-canvas>
            <img src="${esc(lk.src)}" alt="${esc(lk.name)}">
            <div class="admin-studio-guide-x" style="top:${initPt.y}%;"></div>
            <div class="admin-studio-guide-y" style="left:${initPt.x}%;"></div>
            ${pinsHtml}
          </div>
          <div class="admin-pin-studio-side">
            <div class="admin-pin-studio-side-head">
              <span class="admin-pins-count-note">${prods.length} / ${MAX_LOOK_PINS} Item Pin aktif</span>
              <button type="button" class="admin-btn secondary admin-btn-xs" data-studio-pin-add ${prods.length >= MAX_LOOK_PINS ? 'disabled' : ''}>+ Tambah Item Pin (${prods.length}/${MAX_LOOK_PINS})</button>
            </div>
            ${itemsListHtml}
          </div>
        </div>
        <div class="admin-pin-studio-foot">
          <span class="admin-pins-count-note">Tips: Tambah pin, pilih produk, seret ke lokasi tepat, dan tekan Simpan Update.</span>
          <div class="admin-pin-studio-foot-actions">
            <button type="button" class="admin-btn secondary admin-btn-sm" data-close-pin-studio>Tutup</button>
            <button type="button" class="admin-btn primary admin-btn-sm" data-studio-save>Simpan Update</button>
          </div>
        </div>
      </div>
    `;
    pinStudioEl.hidden = false;
  }

  function closePinStudio() {
    if (!pinStudioEl) return;
    pinStudioEl.hidden = true;
    pinStudioEl.innerHTML = '';
    pinStudioLookIdx = -1;
  }

  function renderProductPickerTriggerContent(prod) {
    if (!prod) {
      return `
        <span class="admin-picker-thumb" aria-hidden="true">—</span>
        <span class="admin-picker-meta">
          <span class="admin-picker-name">— Tiada —</span>
          <span class="admin-picker-sub">Tiada item dipilih</span>
        </span>
        <svg class="admin-picker-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
      `;
    }
    const catLabel = getCategoryDef(prod.category).label;
    const d = clampDiscount(prod.discount);
    return `
      <span class="admin-picker-thumb"><img src="${esc(prod.image)}" alt="${esc(prod.name)}" loading="lazy"></span>
      <span class="admin-picker-meta">
        <span class="admin-picker-name">${esc(prod.name)}</span>
        <span class="admin-picker-sub">${esc(catLabel)} · ${money(getSalePrice(prod))}${d > 0 ? ` (-${d}%)` : ''}</span>
      </span>
      <svg class="admin-picker-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
    `;
  }

  function renderProductThumbPicker({ selId, allowEmpty, hiddenId, lookIdx, slot }) {
    const selProd = selId
      ? workingConfig.items.find(it => it.id === selId) || (!allowEmpty ? workingConfig.items[0] : null)
      : (!allowEmpty ? workingConfig.items[0] : null);
    const activeVal = selProd ? selProd.id : '';
    const hiddenAttr = hiddenId
      ? `id="${esc(hiddenId)}"`
      : `data-look-prod="${slot}" data-idx="${lookIdx}"`;
    const pickerCtx = hiddenId ? `data-new-slot="${slot}"` : `data-look-idx="${lookIdx}" data-slot="${slot}"`;

    const emptyRow = allowEmpty ? `
      <button type="button" class="admin-picker-opt${!activeVal ? ' is-selected' : ''}" data-picker-choose="" data-search-text="tiada kosong">
        <span class="admin-picker-opt-img">—</span>
        <span class="admin-picker-opt-info">
          <span class="admin-picker-opt-name">— Tiada —</span>
          <span class="admin-picker-opt-sub">Kosongkan pin ini</span>
        </span>
        ${!activeVal ? '<span class="admin-picker-opt-check" aria-hidden="true">✓</span>' : ''}
      </button>
    ` : '';

    const itemRows = workingConfig.items.map(it => {
      const catLabel = getCategoryDef(it.category).label;
      const isSel = it.id === activeVal;
      const st = Math.max(0, Number(it.stock ?? 0));
      const disc = clampDiscount(it.discount);
      return `
        <button type="button" class="admin-picker-opt${isSel ? ' is-selected' : ''}" data-picker-choose="${esc(it.id)}" data-search-text="${esc(`${it.name} ${catLabel} ${it.type}`.toLowerCase())}">
          <span class="admin-picker-opt-img"><img src="${esc(it.image)}" alt="" loading="lazy"></span>
          <span class="admin-picker-opt-info">
            <span class="admin-picker-opt-name">${esc(it.name)}</span>
            <span class="admin-picker-opt-sub">${esc(catLabel)} · ${money(getSalePrice(it))}${disc > 0 ? ` (-${disc}%)` : ''} · Stok ${st}</span>
          </span>
          ${isSel ? '<span class="admin-picker-opt-check" aria-hidden="true">✓</span>' : ''}
        </button>
      `;
    }).join('');

    return `
      <div class="admin-thumb-picker" data-prod-picker ${pickerCtx}>
        <input type="hidden" ${hiddenAttr} value="${esc(activeVal)}">
        <button type="button" class="admin-picker-trigger" data-picker-toggle aria-expanded="false">
          ${renderProductPickerTriggerContent(selProd)}
        </button>
        <div class="admin-picker-menu" hidden>
          <div class="admin-picker-search-wrap">
            <input type="search" class="admin-picker-search" data-picker-search placeholder="Cari nama atau kategori...">
          </div>
          <div class="admin-picker-list" role="listbox">
            ${emptyRow}
            ${itemRows}
          </div>
        </div>
      </div>
    `;
  }

  function populateNewLookProductSelects() {
    const wrap = document.getElementById('new-look-product-selects');
    if (!wrap) return;
    const items = workingConfig.items || [];
    const validIds = new Set(items.map(it => it.id));
    newLookDraftProds = newLookDraftProds.filter(id => validIds.has(id)).slice(0, MAX_LOOK_PINS);
    if (!newLookDraftProds.length && items.length) {
      newLookDraftProds = [items[0], items[1], items[2]].filter(Boolean).map(it => it.id);
      if (!newLookDraftProds.length) newLookDraftProds = [items[0].id];
    }
    const count = newLookDraftProds.length;
    wrap.innerHTML = newLookDraftProds.map((prodId, idx) => {
      const slot = idx + 1;
      return `
        <div class="admin-form-group">
          <div class="admin-new-pin-head">
            <label for="new-look-prod-${slot}">Item Pin ${slot}${slot === 1 ? ' *' : ''}</label>
            ${count > 1 ? `<button type="button" class="admin-pin-remove-btn" data-new-pin-remove="${idx}" title="Buang Item Pin ${slot}" aria-label="Buang Item Pin ${slot}">×</button>` : ''}
          </div>
          ${renderProductThumbPicker({
            selId: prodId,
            allowEmpty: false,
            hiddenId: `new-look-prod-${slot}`,
            slot
          })}
        </div>
      `;
    }).join('') + `
      <div class="admin-new-pins-foot">
        <span class="admin-pins-count-note">${count} / ${MAX_LOOK_PINS} Item Pin aktif</span>
        <button type="button" class="admin-btn secondary admin-btn-xs" data-new-pin-add ${count >= MAX_LOOK_PINS ? 'disabled' : ''}>+ Tambah Item Pin (${count}/${MAX_LOOK_PINS})</button>
      </div>
    `;
  }

  function getLookSummaryStats(look) {
    const slotCount = Math.max(1, Math.min(MAX_LOOK_PINS, (look.products || []).length || 1));
    const paired = (look.products || [])
      .map(pid => workingConfig.items.find(it => it.id === pid))
      .filter(Boolean);
    const origSum = paired.reduce((acc, it) => acc + getSalePrice(it), 0);
    const bundleTotal = origSum * 0.9;
    const itemNames = paired.map(it => it.name).filter(Boolean);
    return {
      slotCount,
      bundleTotal,
      itemSummary: itemNames.length ? itemNames.join(' · ') : (look.desc || 'Tiada item dipin lagi')
    };
  }

  function syncLookCardSummary(idx) {
    const look = workingConfig.looks[idx];
    if (!look) return;
    const stats = getLookSummaryStats(look);
    const nameEl = dialog.querySelector(`[data-look-summary-name="${idx}"]`);
    const pinsEl = dialog.querySelector(`[data-look-summary-pins="${idx}"]`);
    const priceEl = dialog.querySelector(`[data-look-summary-price="${idx}"]`);
    const itemsEl = dialog.querySelector(`[data-look-summary-items="${idx}"]`);
    const imgEl = document.getElementById('look-summary-img-' + idx);
    if (nameEl) nameEl.textContent = look.name || `Look ${String(idx + 1).padStart(2, '0')}`;
    if (pinsEl) pinsEl.textContent = `${stats.slotCount}/${MAX_LOOK_PINS} Pin`;
    if (priceEl) priceEl.textContent = `Bundle ${money(stats.bundleTotal)}`;
    if (itemsEl) itemsEl.textContent = stats.itemSummary;
    if (imgEl && look.src) imgEl.src = look.src;
  }

  function updateLookExpandAllBtn() {
    const btn = document.getElementById('admin-look-expand-all');
    const container = document.getElementById('admin-looks-container');
    if (!btn || !container) return;
    const cards = Array.from(container.querySelectorAll('.admin-look-card'));
    if (!cards.length) {
      btn.hidden = true;
      return;
    }
    btn.hidden = false;
    const allExpanded = cards.every(c => c.classList.contains('is-expanded'));
    btn.textContent = allExpanded ? 'Minimize Semua' : 'Kembang Semua';
    btn.dataset.state = allExpanded ? 'expanded' : 'collapsed';
  }

  function renderSingleLookCardHtml(look, i) {
    const pins = look.pins || DEFAULT_PIN_SET;
    const stats = getLookSummaryStats(look);
    const slotCount = stats.slotCount;
    const slots = Array.from({ length: slotCount }, (_, slot) => slot);
    const isExpanded = expandedLookIndices.has(i);
    return `
      <div class="admin-look-card${isExpanded ? ' is-expanded' : ''}" data-look-idx="${i}" data-active-pin="0">
        <div class="admin-look-summary-bar">
          <button type="button" class="admin-look-summary-trigger" data-look-toggle="${i}" aria-expanded="${isExpanded}">
            <div class="admin-look-summary-thumb">
              <img src="${esc(look.src)}" alt="${esc(look.name)}" id="look-summary-img-${i}">
            </div>
            <div class="admin-look-summary-info">
              <div class="admin-look-summary-top">
                <span class="admin-look-num-pill">LOOK ${String(i + 1).padStart(2, '0')}</span>
                <strong data-look-summary-name="${i}">${esc(look.name)}</strong>
                <span class="admin-look-pin-pill" data-look-summary-pins="${i}">${slotCount}/${MAX_LOOK_PINS} Pin</span>
                <span class="admin-prod-price-pill" data-look-summary-price="${i}">Bundle ${money(stats.bundleTotal)}</span>
              </div>
              <div class="admin-look-summary-meta">
                <span class="admin-look-summary-items" data-look-summary-items="${i}">${esc(stats.itemSummary)}</span>
              </div>
            </div>
          </button>
          <div class="admin-look-summary-controls">
            <button type="button" class="admin-btn secondary admin-btn-xs" data-open-pin-studio="${i}" title="Laraskan kedudukan pin secara penuh">Laraskan Pin</button>
            <div class="admin-look-quick-order">
              <button type="button" class="admin-btn secondary admin-btn-xs" data-look-move="-1" data-idx="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Naikkan susunan Look ${i + 1}" title="Naikkan">↑</button>
              <button type="button" class="admin-btn secondary admin-btn-xs" data-look-move="1" data-idx="${i}" ${i === workingConfig.looks.length - 1 ? 'disabled' : ''} aria-label="Turunkan susunan Look ${i + 1}" title="Turunkan">↓</button>
            </div>
            <button type="button" class="admin-look-toggle-btn" data-look-toggle="${i}" aria-expanded="${isExpanded}" title="${isExpanded ? 'Minimize outfit' : 'Edit perincian outfit'}">
              <span data-look-toggle-label>${isExpanded ? 'Tutup' : 'Edit'}</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </div>
        <div class="admin-look-collapse-body"${isExpanded ? '' : ' hidden'}>
          <div class="admin-preview-col">
            <div class="admin-look-preview-box" data-look-pin-canvas="${i}">
              <span class="admin-preview-badge">LOOK ${String(i + 1).padStart(2, '0')}</span>
              <img src="${esc(look.src)}" alt="${esc(look.name)}" id="look-preview-img-${i}">
              <div class="admin-preview-pins-layer">
                ${slots.map(slot => {
                  const pt = pins[slot] || DEFAULT_PIN_SET[slot % MAX_LOOK_PINS];
                  const hasItem = Boolean(look.products[slot]);
                  return `<button type="button" class="admin-preview-pin-dot${slot === 0 ? ' is-active' : ''}" data-preview-pin-pick="${slot}" data-idx="${i}" style="left:${pt.x}%;top:${pt.y}%;" ${hasItem ? '' : 'hidden'} aria-label="Pilih Pin ${slot + 1}">${slot + 1}</button>`;
                }).join('')}
              </div>
            </div>
            <span class="admin-pin-preview-hint" data-pin-hint="${i}">Seret atau klik gambar untuk <strong>Pin 1</strong></span>
            <button type="button" class="admin-btn secondary admin-btn-xs admin-pin-expand-btn" data-open-pin-studio="${i}">Laraskan Pin</button>
            <label class="admin-file-btn" style="justify-content:center;">
              <span>Upload Gambar Full</span>
              <input type="file" accept="image/*" class="admin-look-file-input" data-look-file="${i}" style="display:none;">
            </label>
            <div class="admin-card-order-btns">
              <button type="button" class="admin-btn secondary admin-btn-xs" data-look-move="-1" data-idx="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
              <button type="button" class="admin-btn secondary admin-btn-xs" data-look-move="1" data-idx="${i}" ${i === workingConfig.looks.length - 1 ? 'disabled' : ''}>↓</button>
              <button type="button" class="admin-btn danger admin-btn-xs" data-look-del="${i}" ${workingConfig.looks.length <= 1 ? 'disabled' : ''}>Padam</button>
            </div>
          </div>
          <div class="admin-details-col">
            <div class="admin-form-row-2">
              <div class="admin-form-group">
                <label>Nama Outfit / Look</label>
                <input type="text" class="admin-input-text" data-look-field="name" data-idx="${i}" value="${esc(look.name)}">
              </div>
              <div class="admin-form-group">
                <label>URL Gambar Full-Body (PNG / WebP)</label>
                <input type="text" class="admin-input-text" data-look-field="src" data-idx="${i}" value="${esc(look.src)}">
              </div>
            </div>
            <div class="admin-form-group">
              <label>Penerangan / Subtitle</label>
              <input type="text" class="admin-input-text" data-look-field="desc" data-idx="${i}" value="${esc(look.desc || '')}">
            </div>
            <div class="admin-pins-grid">
              ${slots.map(slot => {
                const pt = pins[slot] || DEFAULT_PIN_SET[slot % MAX_LOOK_PINS];
                return `
                  <div class="admin-pin-slot${slot === 0 ? ' is-pin-active' : ''}" data-pin-slot-card="${slot}" data-idx="${i}">
                    <div class="admin-form-group">
                      <div class="admin-pin-slot-head">
                        <label>Item Pin ${slot + 1}</label>
                        <div class="admin-pin-head-actions">
                          <button type="button" class="admin-pin-target-btn" data-pin-focus="${slot}" data-idx="${i}" title="Aktifkan Pin ${slot + 1} untuk klik pada gambar">Pin ${slot + 1}</button>
                          ${slotCount > 1 ? `<button type="button" class="admin-pin-remove-btn" data-pin-remove="${slot}" data-idx="${i}" title="Buang Item Pin ${slot + 1}" aria-label="Buang Item Pin ${slot + 1}">×</button>` : ''}
                        </div>
                      </div>
                      ${renderProductThumbPicker({
                        selId: look.products[slot] || '',
                        allowEmpty: false,
                        lookIdx: i,
                        slot
                      })}
                    </div>
                    <div class="admin-pin-coords">
                      <label><span>X%</span><input type="number" min="4" max="96" class="admin-input-text" data-look-pin-axis="x" data-slot="${slot}" data-idx="${i}" value="${pt.x}"></label>
                      <label><span>Y%</span><input type="number" min="4" max="97" class="admin-input-text" data-look-pin-axis="y" data-slot="${slot}" data-idx="${i}" value="${pt.y}"></label>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            <div class="admin-pins-footer">
              <div class="admin-pins-footer-left">
                <span class="admin-pins-count-note">${slotCount} / ${MAX_LOOK_PINS} Item Pin aktif</span>
                <span class="admin-pins-dirty-pill" data-look-dirty ${isDirty ? '' : 'hidden'}>Belum disimpan</span>
              </div>
              <div class="admin-pins-footer-actions">
                <button type="button" class="admin-btn secondary admin-btn-xs" data-pin-add="${i}" ${slotCount >= MAX_LOOK_PINS ? 'disabled' : ''}>+ Tambah Item Pin (${slotCount}/${MAX_LOOK_PINS})</button>
                <button type="button" class="admin-btn primary admin-btn-xs admin-look-save-btn" data-look-save="${i}">Simpan Update</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function syncSingleLookCardFromDOM(card, idx) {
    const lk = workingConfig.looks[idx];
    if (!card || !lk) return;
    const nameEl = card.querySelector('[data-look-field="name"]');
    const descEl = card.querySelector('[data-look-field="desc"]');
    const srcEl = card.querySelector('[data-look-field="src"]');
    if (nameEl) lk.name = nameEl.value;
    if (descEl) lk.desc = descEl.value;
    if (srcEl) {
      lk.src = srcEl.value;
      lk.srcset = srcEl.value ? `${srcEl.value} 640w, ${srcEl.value} 1080w` : '';
    }
    const picks = Array.from(card.querySelectorAll('[data-look-prod]')).map(inp => inp.value || '').filter(Boolean);
    if (picks.length) lk.products = picks.slice(0, MAX_LOOK_PINS);
    lk.pins = Array.isArray(lk.pins) ? lk.pins : [];
    const slotTotal = Math.max(1, (lk.products || []).length);
    for (let s = 0; s < slotTotal; s++) {
      const xInp = card.querySelector(`[data-look-pin-axis="x"][data-slot="${s}"]`);
      const yInp = card.querySelector(`[data-look-pin-axis="y"][data-slot="${s}"]`);
      const cur = lk.pins[s] || { ...DEFAULT_PIN_SET[s % MAX_LOOK_PINS] };
      const nx = xInp && Number.isFinite(Number(xInp.value)) ? Number(xInp.value) : cur.x;
      const ny = yInp && Number.isFinite(Number(yInp.value)) ? Number(yInp.value) : cur.y;
      lk.pins[s] = {
        x: Math.min(96, Math.max(4, Math.round(nx))),
        y: Math.min(97, Math.max(4, Math.round(ny)))
      };
    }
  }

  function syncLookCardsFromDOM() {
    dialog.querySelectorAll('.admin-look-card[data-look-idx]').forEach(card => {
      const idx = parseInt(card.dataset.lookIdx || '-1', 10);
      if (idx >= 0) syncSingleLookCardFromDOM(card, idx);
    });
  }

  function refreshSingleLookCard(idx, { activeSlot = 0, openPickerSlot = -1 } = {}) {
    const scrollWrap = dialog.querySelector('.admin-main-scroll');
    const prevScroll = scrollWrap ? scrollWrap.scrollTop : 0;
    const lk = workingConfig.looks[idx];
    const card = dialog.querySelector(`.admin-look-card[data-look-idx="${idx}"]`);
    if (!lk || !card) {
      renderAdminLooks();
      return;
    }
    card.outerHTML = renderSingleLookCardHtml(lk, idx);
    updateLookExpandAllBtn();
    const updatedCard = dialog.querySelector(`.admin-look-card[data-look-idx="${idx}"]`);
    if (updatedCard) {
      setActivePinSlot(updatedCard, activeSlot);
      if (openPickerSlot >= 0) {
        const slotEl = updatedCard.querySelector(`[data-pin-slot-card="${openPickerSlot}"]`);
        slotEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        openLookSlotPicker(updatedCard, openPickerSlot);
      }
    }
    if (scrollWrap && openPickerSlot < 0) {
      scrollWrap.scrollTop = prevScroll;
    }
  }

  function renderAdminLooks() {
    updateSidebarCounts();
    populateNewLookProductSelects();
    const container = document.getElementById('admin-looks-container');
    if (!container) return;
    const scrollWrap = dialog.querySelector('.admin-main-scroll');
    const prevScroll = scrollWrap ? scrollWrap.scrollTop : 0;
    const q = lookSearch.trim().toLowerCase();
    const filtered = workingConfig.looks
      .map((look, i) => ({ look, i }))
      .filter(({ look }) => !q || look.name.toLowerCase().includes(q) || (look.desc || '').toLowerCase().includes(q));

    if (!filtered.length) {
      container.innerHTML = '<div class="admin-empty-box">Tiada outfit sepadan dengan carian anda.</div>';
      updateLookExpandAllBtn();
      return;
    }

    container.innerHTML = filtered.map(({ look, i }) => renderSingleLookCardHtml(look, i)).join('');
    updateLookExpandAllBtn();
    if (scrollWrap) scrollWrap.scrollTop = prevScroll;
  }

  function updateProdExpandAllBtn() {
    const btn = document.getElementById('admin-prod-expand-all');
    const container = document.getElementById('admin-products-container');
    if (!btn || !container) return;
    const cards = Array.from(container.querySelectorAll('.admin-product-card'));
    if (!cards.length) {
      btn.hidden = true;
      return;
    }
    btn.hidden = false;
    const allExpanded = cards.every(c => c.classList.contains('is-expanded'));
    btn.textContent = allExpanded ? 'Minimize Semua' : 'Kembang Semua';
    btn.dataset.state = allExpanded ? 'expanded' : 'collapsed';
  }

  function formatSalePreviewText(item) {
    if (isOfferActive(item)) return `Offer aktif: ${money(getSalePrice(item))} (-${clampDiscount(item.offerDiscount)}%)`;
    const disc = clampDiscount(item?.discount);
    if (disc <= 0) return 'Tiada diskaun';
    return `Harga jualan: ${money(Number(((Number(item.price) || 0) * (1 - disc / 100)).toFixed(2)))} (-${disc}%)`;
  }

  function syncProdCardSummary(idx) {
    const item = workingConfig.items[idx];
    if (!item) return;
    const cat = normalizeCategory(item.category);
    const activeSizes = normalizeSizes(item.sizes, cat);
    const nameEl = dialog.querySelector(`[data-prod-summary-name="${idx}"]`);
    const typeEl = dialog.querySelector(`[data-prod-summary-type="${idx}"]`);
    const catEl = dialog.querySelector(`[data-prod-summary-cat="${idx}"]`);
    const priceEl = dialog.querySelector(`[data-prod-summary-price="${idx}"]`);
    const sizesEl = dialog.querySelector(`[data-prod-summary-sizes="${idx}"]`);
    const previewEl = dialog.querySelector(`[data-prod-sale-preview="${idx}"]`);
    const imgEl = document.getElementById('prod-summary-img-' + idx);
    if (nameEl) nameEl.textContent = item.name || 'Item Tanpa Nama';
    if (typeEl) typeEl.textContent = item.type || 'Sahira Premium Outlet';
    if (catEl) catEl.textContent = getCategoryDef(cat).label;
    if (priceEl) priceEl.innerHTML = formatItemPriceHtml(item);
    if (sizesEl) sizesEl.textContent = activeSizes.join(', ');
    if (previewEl) {
      const disc = clampDiscount(item.discount);
      previewEl.textContent = formatSalePreviewText(item);
      previewEl.classList.toggle('is-muted', disc <= 0);
    }
    if (imgEl && item.image) imgEl.src = item.image;
  }

  function updateProductSelectionControls() {
    const selectAll = document.getElementById('admin-prod-select-all');
    const bulkDelete = document.getElementById('admin-prod-bulk-delete');
    const visibleIds = Array.from(dialog.querySelectorAll('.admin-prod-select')).map(input => input.dataset.prodSelect).filter(Boolean);
    const selectedVisible = visibleIds.filter(id => selectedProductIds.has(id));
    if (selectAll) {
      selectAll.checked = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
      selectAll.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visibleIds.length;
      selectAll.disabled = visibleIds.length === 0;
    }
    if (bulkDelete) {
      bulkDelete.disabled = selectedProductIds.size === 0;
      bulkDelete.textContent = selectedProductIds.size ? `Padam dipilih (${selectedProductIds.size})` : 'Padam dipilih';
    }
  }

  function renderAdminProducts() {
    updateSidebarCounts();
    const container = document.getElementById('admin-products-container');
    if (!container) return;
    const scrollWrap = dialog.querySelector('.admin-main-scroll');
    const prevScroll = scrollWrap ? scrollWrap.scrollTop : 0;
    const q = prodSearch.trim().toLowerCase();
    const filtered = workingConfig.items
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => {
        if (q && !item.name.toLowerCase().includes(q) && !(item.type || '').toLowerCase().includes(q)) return false;
        const st = Number(item.stock ?? 0);
        if (CATEGORY_MAP[prodFilter]) return normalizeCategory(item.category) === prodFilter;
        if (prodFilter === 'low') return st > 0 && st <= 5;
        if (prodFilter === 'out') return st <= 0;
        return true;
      });

    if (!filtered.length) {
      container.innerHTML = '<div class="admin-empty-box">Tiada item sepadan dengan penapis atau carian anda.</div>';
      updateProdExpandAllBtn();
      updateProductSelectionControls();
      return;
    }

    const lockStats = window.SahiraLockOrders?.getSummaryStats?.() || { lockedByItemId: {} };

    container.innerHTML = filtered.map(({ item, i }) => {
      const cat = normalizeCategory(item.category);
      const activeSizes = normalizeSizes(item.sizes, cat);
      const prodKey = String(item.id || i);
      const isExpanded = expandedProdIds.has(prodKey);
      const disc = clampDiscount(item.discount);
      const lockedQty = lockStats.lockedByItemId?.[item.id] || 0;
      return `
      <div class="admin-product-card${isExpanded ? ' is-expanded' : ''}" data-prod-idx="${i}" data-prod-key="${esc(prodKey)}">
        <div class="admin-prod-summary-bar">
          <label class="admin-prod-select-wrap" title="Pilih ${esc(item.name)}">
            <input type="checkbox" class="admin-prod-select" data-prod-select="${esc(item.id)}" ${selectedProductIds.has(item.id) ? 'checked' : ''} aria-label="Pilih ${esc(item.name)}">
          </label>
          <button type="button" class="admin-prod-summary-trigger" data-prod-toggle="${esc(prodKey)}" aria-expanded="${isExpanded}">
            <div class="admin-prod-summary-thumb">
              <img src="${esc(item.image)}" alt="${esc(item.name)}" id="prod-summary-img-${i}">
            </div>
            <div class="admin-prod-summary-info">
              <div class="admin-prod-summary-top">
                <strong data-prod-summary-name="${i}">${esc(item.name)}</strong>
                <span class="admin-prod-cat-pill" data-prod-summary-cat="${i}">${esc(getCategoryDef(cat).label)}</span>
                <span class="admin-prod-price-pill" data-prod-summary-price="${i}">${formatItemPriceHtml(item)}</span>
                ${lockedQty > 0 ? `<span class="admin-prod-lock-pill">${lockedQty} Di-Lock</span>` : ''}
              </div>
              <div class="admin-prod-summary-meta">
                <span data-prod-summary-type="${i}">${esc(item.type || 'Sahira Premium Outlet')}</span>
                <span aria-hidden="true">·</span>
                <span data-prod-summary-sizes="${i}">${esc(activeSizes.join(', '))}</span>
                <span class="admin-stock-badge-wrap" data-stock-badge="${i}">${stockBadgeHtml(item.stock)}</span>
              </div>
            </div>
          </button>
          <div class="admin-prod-summary-controls">
            <div class="admin-qty-stepper admin-qty-stepper-compact">
              <button type="button" class="admin-qty-btn" data-qty-delta="-1" data-idx="${i}" aria-label="Kurangkan stok">−</button>
              <input type="number" min="0" step="1" class="admin-qty-input" data-prod-field="stock" data-idx="${i}" value="${Number(item.stock ?? 0)}" aria-label="Kuantiti stok ${esc(item.name)}">
              <button type="button" class="admin-qty-btn" data-qty-delta="1" data-idx="${i}" aria-label="Tambahkan stok">+</button>
            </div>
            <button type="button" class="admin-btn-xs admin-prod-share-btn" data-share-item="${esc(item.id)}" title="Salin link terus ke item untuk mudah di-lock">🔗 Link</button>
            <button type="button" class="admin-prod-toggle-btn" data-prod-toggle="${esc(prodKey)}" aria-expanded="${isExpanded}" title="${isExpanded ? 'Minimize item' : 'Edit perincian item'}">
              <span data-prod-toggle-label>${isExpanded ? 'Tutup' : 'Edit'}</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </div>
        <div class="admin-prod-collapse-body" data-prod-body="${esc(prodKey)}" ${isExpanded ? '' : 'hidden'}>
          <div class="admin-prod-preview-col">
            <div class="admin-prod-preview-box">
              <img src="${esc(item.image)}" alt="${esc(item.name)}" id="prod-preview-img-${i}">
            </div>
            <label class="admin-file-btn" style="justify-content:center;">
              <span>Upload Fail</span>
              <input type="file" accept="image/*" class="admin-prod-file-input" data-prod-file="${i}" style="display:none;">
            </label>
            <button type="button" class="admin-btn danger admin-btn-xs" data-prod-del="${i}" ${workingConfig.items.length <= 1 ? 'disabled' : ''}>Padam Item</button>
          </div>
          <div class="admin-details-col">
            <div class="admin-prod-top-row">
              <div class="admin-form-group" style="flex:1.6 1 200px;">
                <label>Nama Item</label>
                <input type="text" class="admin-input-text" data-prod-field="name" data-idx="${i}" value="${esc(item.name)}">
              </div>
              <div class="admin-form-group" style="flex:0.85 1 150px; min-width:130px;">
                <label>Kategori</label>
                <select class="admin-input-text" data-prod-field="category" data-idx="${i}">
                  ${renderCategoryOptions(cat)}
                </select>
              </div>
            </div>
            <div class="admin-form-group">
              <label>Jenama / Tagline</label>
              <div class="admin-size-chips" data-prod-brand-chips="${i}">
                ${buildBrandChipsHtml(item.type, cat, 'data-brand-pick', i)}
              </div>
              <input type="text" class="admin-input-text" data-prod-field="type" data-idx="${i}" value="${esc(item.type)}" placeholder="Pilih jenama di atas atau taip sendiri...">
            </div>
            <div class="admin-prod-top-row">
              <div class="admin-form-group" style="flex:0 1 118px; min-width:100px;">
                <label>Harga (RM)</label>
                <input type="number" step="0.01" min="0" class="admin-input-text" data-prod-field="price" data-idx="${i}" value="${item.price}">
              </div>
              <div class="admin-form-group" style="flex:0 1 108px; min-width:92px;">
                <label>Diskaun (%)</label>
                <input type="number" step="1" min="0" max="95" class="admin-input-text" data-prod-field="discount" data-idx="${i}" value="${disc}" placeholder="0">
                <div class="admin-sale-preview${disc <= 0 ? ' is-muted' : ''}" data-prod-sale-preview="${i}">${esc(formatSalePreviewText(item))}</div>
              </div>
              <div class="admin-form-group" style="flex:1.5 1 220px;">
                <label>Saiz Dibenarkan <span data-prod-size-count="${i}" style="color:#66625c;font-weight:400;">(${activeSizes.length} dipilih)</span></label>
                <div class="admin-size-chips" data-prod-size-chips="${i}">
                  ${buildSizeChipsHtml(activeSizes, cat, 'data-size-toggle', i)}
                </div>
                <input type="text" class="admin-input-text" data-prod-field="sizes" data-idx="${i}" value="${esc(activeSizes.join(', '))}" placeholder="Contoh: S, M, L atau Free Size">
              </div>
            </div>
            <div class="admin-form-row-2">
              <div class="admin-form-group">
                <label>URL Gambar Produk</label>
                <input type="text" class="admin-input-text" data-prod-field="image" data-idx="${i}" value="${esc(item.image)}">
              </div>
              <div class="admin-form-group">
                <label>Pautan Kedai (Pilihan)</label>
                <input type="text" class="admin-input-text" data-prod-field="url" data-idx="${i}" value="${esc(item.url || '')}">
              </div>
            </div>
            <div class="admin-form-group">
              <label>Link Share Item (Pelanggan Buka Terus &amp; Lock)</label>
              <div class="admin-link-row">
                <input type="text" class="admin-input-text" readonly value="${esc(getItemShareUrl(item.id))}" onclick="this.select()">
                <button type="button" class="admin-btn admin-btn-sm admin-prod-share-btn" data-share-item="${esc(item.id)}">Salin Link</button>
                <button type="button" class="admin-btn admin-btn-sm" data-share-item-wa="${esc(item.id)}">WhatsApp</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    }).join('');
    updateProdExpandAllBtn();
    updateProductSelectionControls();
    if (scrollWrap) scrollWrap.scrollTop = prevScroll;
  }

  function populateNewVideoLookSelect() {
    const wrap = document.getElementById('new-video-look-wrap');
    if (!wrap) return;
    const curVal = parseInt(document.getElementById('new-video-look')?.value || '0', 10) || 0;
    wrap.innerHTML = renderLookThumbPickerMarkup({
      looks: workingConfig.looks,
      selIndex: curVal,
      hiddenId: 'new-video-look'
    });
  }

  function renderAdminVideos() {
    updateSidebarCounts();
    populateNewVideoLookSelect();
    const container = document.getElementById('admin-videos-container');
    if (!container) return;
    const q = videoSearch.trim().toLowerCase();
    const filtered = workingConfig.reels
      .map((reel, i) => ({ reel, i }))
      .filter(({ reel }) => {
        const lkName = workingConfig.looks[reel.lookIndex]?.name || '';
        return !q || reel.handle.toLowerCase().includes(q) || reel.caption.toLowerCase().includes(q) || lkName.toLowerCase().includes(q);
      });

    if (!filtered.length) {
      container.innerHTML = '<div class="admin-empty-box">Tiada video Hand Rail Pro sepadan.</div>';
      return;
    }

    container.innerHTML = filtered.map(({ reel, i }) => {
      const look = workingConfig.looks[reel.lookIndex] || workingConfig.looks[0];
      return `
        <div class="admin-video-card" data-video-idx="${i}">
          <div class="admin-video-preview-col">
            <div class="admin-video-preview-box" id="admin-vid-box-${i}">
              ${reel.videoUrl
                ? `<video src="${esc(reel.videoUrl)}" muted loop playsinline autoplay></video><span class="admin-preview-badge">VIDEO</span>`
                : `<img src="${esc(look?.src || '')}" alt="${esc(look?.name || '')}"><span class="admin-preview-badge">MOTION</span>`}
            </div>
            <label class="admin-file-btn" style="justify-content:center;">
              <span>Upload MP4 / WebM</span>
              <input type="file" accept="video/mp4,video/webm,video/quicktime,video/*" data-vid-file="${i}" style="display:none;">
            </label>
            <button type="button" class="admin-btn danger admin-btn-xs" data-vid-del="${i}" ${workingConfig.reels.length <= 1 ? 'disabled' : ''}>Padam Video</button>
          </div>
          <div class="admin-details-col">
            <div class="admin-form-row-3">
              <div class="admin-form-group">
                <label>Outfit / Shop Look</label>
                ${renderLookThumbPickerMarkup({
                  looks: workingConfig.looks,
                  selIndex: reel.lookIndex,
                  videoIdx: i
                })}
              </div>
              <div class="admin-form-group">
                <label>Handle Kreator</label>
                <input type="text" class="admin-input-text" data-vid-field="handle" data-idx="${i}" value="${esc(reel.handle)}">
              </div>
              <div class="admin-form-group">
                <label>Kategori</label>
                <select class="admin-input-text" data-vid-field="category" data-idx="${i}">
                  ${renderCategoryOptions(reel.category)}
                </select>
              </div>
            </div>
            <div class="admin-form-row-2">
              <div class="admin-form-group">
                <label>URL Video (.mp4 / .webm)</label>
                <input type="text" class="admin-input-text" data-vid-field="videoUrl" data-idx="${i}" value="${esc(reel.videoUrl || '')}" placeholder="Kosong = Motion Look automatik">
              </div>
              <div class="admin-form-group">
                <label>Label Audio / Muzik</label>
                <input type="text" class="admin-input-text" data-vid-field="audio" data-idx="${i}" value="${esc(reel.audio || '')}">
              </div>
            </div>
            <div class="admin-form-group">
              <label>Kapsyen &amp; Hashtag</label>
              <input type="text" class="admin-input-text" data-vid-field="caption" data-idx="${i}" value="${esc(reel.caption || '')}">
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function formatOrderDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString('ms-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  function renderAdminOrders() {
    updateSidebarCounts();
    const waInput = document.getElementById('admin-wa-number');
    if (waInput && document.activeElement !== waInput) {
      waInput.value = workingConfig.whatsappNumber || activeConfig.whatsappNumber || '';
    }
    const kpiEl = document.getElementById('admin-orders-kpi');
    const container = document.getElementById('admin-orders-container');
    const viewBtn = document.getElementById('admin-order-view-mode');
    if (!container) return;

    const store = window.SahiraLockOrders;
    const stats = store ? store.getSummaryStats() : { orderCount: 0, lockedUnits: 0, lockedValue: 0, paidUnits: 0, paidValue: 0, unlockedUnits: 0, unlockedValue: 0, lockedByItemId: {}, paidByItemId: {}, unlockedByItemId: {}, byItem: {} };
    const orders = store ? store.getOrders() : [];
    const catalogMap = Object.fromEntries((workingConfig.items || []).map(it => [it.id, it]));

    if (kpiEl) {
      kpiEl.innerHTML = `
        <div class="admin-kpi-card"><span class="admin-kpi-label">Item Sedang Di-Lock</span><strong class="admin-kpi-value">${stats.lockedUnits}</strong><span class="admin-kpi-meta">Belum bayar · Anggaran ${money(stats.lockedValue)}</span></div>
        <div class="admin-kpi-card"><span class="admin-kpi-label">Complete Payment</span><strong class="admin-kpi-value">${stats.paidUnits}</strong><span class="admin-kpi-meta">Disahkan · Jumlah ${money(stats.paidValue)}</span></div>
        <div class="admin-kpi-card"><span class="admin-kpi-label">Auto-Unlock (&gt;24 Jam)</span><strong class="admin-kpi-value">${stats.unlockedUnits}</strong><span class="admin-kpi-meta">Tamat tempoh · ${money(stats.unlockedValue)}</span></div>
        <div class="admin-kpi-card"><span class="admin-kpi-label">Jumlah Rekod WhatsApp</span><strong class="admin-kpi-value">${stats.orderCount}</strong><span class="admin-kpi-meta">Senarai tempahan pelanggan</span></div>
      `;
    }

    if (viewBtn) {
      viewBtn.dataset.mode = orderViewMode;
      viewBtn.textContent = orderViewMode === 'items' ? 'Paparan: Ringkasan Per Item' : 'Paparan: Ikut Tempahan';
    }

    const q = orderSearch.trim().toLowerCase();

    if (orderViewMode === 'items') {
      const rowsMap = {};
      (workingConfig.items || []).forEach(it => {
        const rec = stats.byItem[it.id];
        rowsMap[it.id] = {
          id: it.id,
          name: it.name,
          image: it.image,
          stock: Number(it.stock ?? 0),
          lockedQty: rec ? rec.lockedQty : 0,
          paidQty: rec ? rec.paidQty : 0,
          unlockedQty: rec ? rec.unlockedQty : 0,
          orderRefs: rec ? Array.from(rec.orderRefs) : []
        };
      });
      Object.values(stats.byItem).forEach(rec => {
        if (!rowsMap[rec.id]) {
          rowsMap[rec.id] = {
            id: rec.id,
            name: rec.name,
            image: rec.image,
            stock: 0,
            lockedQty: rec.lockedQty,
            paidQty: rec.paidQty,
            unlockedQty: rec.unlockedQty || 0,
            orderRefs: Array.from(rec.orderRefs)
          };
        }
      });

      const list = Object.values(rowsMap)
        .filter(r => {
          if (q && !r.name.toLowerCase().includes(q)) return false;
          if (orderFilter === 'locked') return r.lockedQty > 0;
          if (orderFilter === 'paid') return r.paidQty > 0;
          if (orderFilter === 'unlocked') return r.unlockedQty > 0;
          return r.lockedQty > 0 || r.paidQty > 0 || r.unlockedQty > 0;
        })
        .sort((a, b) => (b.lockedQty - a.lockedQty) || (b.paidQty - a.paidQty) || (b.unlockedQty - a.unlockedQty));

      if (!list.length) {
        container.innerHTML = '<div class="admin-empty-box">Tiada item sepadan untuk dipantau buat masa ini.</div>';
        return;
      }

      container.innerHTML = list.map(r => `
        <div class="admin-item-monitor-card">
          <div class="admin-order-item-main">
            <div class="admin-order-item-thumb"><img src="${esc(r.image)}" alt="${esc(r.name)}"></div>
            <div class="admin-order-item-info">
              <strong>${esc(r.name)}</strong>
              <span class="admin-order-item-meta">Baki Stok: ${r.stock} unit${r.orderRefs.length ? ` · Kod: ${r.orderRefs.map(x => '#' + esc(x)).join(', ')}` : ''}</span>
            </div>
          </div>
          <div class="admin-item-monitor-stats">
            <span class="admin-pay-badge is-locked">Di-Lock: ${r.lockedQty} unit</span>
            <span class="admin-pay-badge is-paid">Complete Payment: ${r.paidQty} unit</span>
            ${r.unlockedQty > 0 ? `<span class="admin-pay-badge is-unlocked">Auto-Unlock: ${r.unlockedQty} unit</span>` : ''}
            <button type="button" class="admin-btn secondary admin-btn-xs" data-order-jump-search="${esc(r.name)}">Lihat Tempahan</button>
          </div>
        </div>
      `).join('');
      return;
    }

    const filteredOrders = orders.filter(ord => {
      if (q) {
        const hay = `${ord.ref} ${ord.customerName} ${ord.customerPhone || ''} ${ord.items.map(i => i.name).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (orderFilter === 'locked') return ord.items.some(it => it.status === 'locked');
      if (orderFilter === 'paid') return ord.items.some(it => it.status === 'paid');
      if (orderFilter === 'unlocked') return ord.items.some(it => it.status === 'unlocked');
      return true;
    });

    if (!filteredOrders.length) {
      container.innerHTML = '<div class="admin-empty-box">Belum ada item yang di-lock oleh pelanggan. Apabila pelanggan tick <strong>Lock Item</strong> dan tekan <strong>Hantar ke WhatsApp</strong> dalam beg pilihan, rekod akan muncul di sini.</div>';
      return;
    }

    container.innerHTML = filteredOrders.map(ord => {
      const visibleItems = ord.items
        .map((it, idx) => ({ it, idx }))
        .filter(({ it }) => {
          if (orderFilter === 'locked') return it.status === 'locked';
          if (orderFilter === 'paid') return it.status === 'paid';
          if (orderFilter === 'unlocked') return it.status === 'unlocked';
          return true;
        });
      const lockedLeft = ord.items.filter(it => it.status === 'locked').length;
      const unlockedCount = ord.items.filter(it => it.status === 'unlocked').length;
      const paidDone = ord.items.filter(it => it.status === 'paid').length;
      const orderTotal = ord.items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
      const waCustDigits = window.SahiraAuth?.toWaDigits?.(ord.customerPhone) || '';
      const headStatusClass = paidDone === ord.items.length ? 'is-paid' : (lockedLeft > 0 ? 'is-locked' : 'is-unlocked');
      const headStatusText = paidDone === ord.items.length
        ? 'Semua Complete Payment ✓'
        : `${lockedLeft} Di-Lock · ${paidDone} Complete${unlockedCount > 0 ? ` · ${unlockedCount} Auto-Unlock` : ''}`;

      return `
        <div class="admin-order-card" data-order-id="${esc(ord.id)}">
          <div class="admin-order-head">
            <div class="admin-order-head-left">
              <span class="admin-order-ref">#${esc(ord.ref)}</span>
              <span class="admin-order-customer">${esc(ord.customerName)}</span>
              ${ord.customerPhone ? `<a href="https://wa.me/${esc(waCustDigits)}" target="_blank" rel="noopener noreferrer" class="admin-order-phone-link" title="Hubungi pelanggan di WhatsApp">${esc(ord.customerPhone)} ↗</a>` : ''}
              <span class="admin-order-time">${esc(formatOrderDate(ord.createdAt))} · Jumlah ${money(orderTotal)}</span>
            </div>
            <div class="admin-order-head-actions">
              <span class="admin-pay-badge ${headStatusClass}">${headStatusText}</span>
              ${lockedLeft > 0 ? `<button type="button" class="admin-btn paid-btn admin-btn-xs" data-order-mark-all-paid="${esc(ord.id)}">Semua Complete Payment</button>` : ''}
              <button type="button" class="admin-btn danger admin-btn-xs" data-order-del="${esc(ord.id)}">Padam</button>
            </div>
          </div>
          <div class="admin-order-items">
            ${visibleItems.map(({ it, idx }) => {
              const isPaid = it.status === 'paid';
              const isUnlocked = it.status === 'unlocked';
              const catItem = catalogMap[it.id];
              const curStock = catItem ? Number(catItem.stock ?? 0) : null;
              const ttlLabel = !isPaid && !isUnlocked ? (store?.formatRemainingLock?.(it.lockedAt || ord.createdAt) || 'Baki 24j') : '';
              const badgeClass = isPaid ? 'is-paid' : (isUnlocked ? 'is-unlocked' : 'is-locked');
              const badgeText = isPaid
                ? '✓ Complete Payment'
                : (isUnlocked
                    ? (it.unlockReason === 'manual' ? '🔓 Nyah-Lock Manual' : '🔓 Auto-Unlock (>24 Jam)')
                    : `🔒 Di-Lock · ${esc(ttlLabel)}`);
              const buttonsHtml = isPaid
                ? `<button type="button" class="admin-btn secondary admin-btn-xs" data-order-item-toggle="${esc(ord.id)}" data-item-idx="${idx}" data-target-status="locked">Kembalikan ke Lock</button>`
                : (isUnlocked
                    ? `<button type="button" class="admin-btn secondary admin-btn-xs" data-order-item-toggle="${esc(ord.id)}" data-item-idx="${idx}" data-target-status="locked">Lock Semula (24 Jam)</button>
                       <button type="button" class="admin-btn paid-btn admin-btn-xs" data-order-item-toggle="${esc(ord.id)}" data-item-idx="${idx}" data-target-status="paid">Complete Payment</button>`
                    : `<button type="button" class="admin-btn paid-btn admin-btn-xs" data-order-item-toggle="${esc(ord.id)}" data-item-idx="${idx}" data-target-status="paid">Tandakan Complete Payment</button>
                       <button type="button" class="admin-btn secondary admin-btn-xs" data-order-item-toggle="${esc(ord.id)}" data-item-idx="${idx}" data-target-status="unlocked">Nyah-Lock</button>`);
              return `
                <div class="admin-order-item-row${isPaid ? ' is-paid' : (isUnlocked ? ' is-unlocked' : '')}">
                  <div class="admin-order-item-main">
                    <div class="admin-order-item-thumb"><img src="${esc(it.image || catItem?.image || '')}" alt="${esc(it.name)}"></div>
                    <div class="admin-order-item-info">
                      <strong>${esc(it.name)}</strong>
                      <span class="admin-order-item-meta">Saiz: ${esc(it.size)} · Kuantiti: ${it.qty} · ${money(it.unitPrice * it.qty)}${curStock !== null ? ` · Baki Stok: ${curStock}` : ''}</span>
                    </div>
                  </div>
                  <div class="admin-order-item-controls">
                    <span class="admin-pay-badge ${badgeClass}">${badgeText}</span>
                    ${buttonsHtml}
                    ${isPaid && catItem && !it.stockDeducted ? `<button type="button" class="admin-btn secondary admin-btn-xs" data-order-item-deduct="${esc(ord.id)}" data-item-idx="${idx}">Tolak Stok (-${it.qty})</button>` : ''}
                    ${it.stockDeducted ? '<span class="admin-order-time">Stok ditolak ✓</span>' : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  function buildCustomerAnalytics() {
    const members = window.SahiraAuth?.getMembers?.() || [];
    const orders = window.SahiraLockOrders?.getOrders?.() || [];
    const normPhone = raw => window.SahiraAuth?.normalizePhone?.(raw) || String(raw || '').replace(/[^\d]/g, '');
    const catalogMap = Object.fromEntries((workingConfig.items || []).map(it => [it.id, it]));
    const byKey = new Map();

    const makeRecord = ({ key, name, phone, phoneNorm, isRegistered, joinedAt, lastActivityAt }) => ({
      key,
      name: name || 'Pelanggan Sahira',
      phone: phone || '',
      phoneNorm: phoneNorm || '',
      isRegistered: Boolean(isRegistered),
      joinedAt: joinedAt || null,
      lastActivityAt: lastActivityAt || joinedAt || new Date().toISOString(),
      orderCount: 0,
      lockedUnits: 0,
      lockedValue: 0,
      paidUnits: 0,
      paidValue: 0,
      unlockedUnits: 0,
      unlockedValue: 0,
      totalUnits: 0,
      orders: [],
      itemCounts: {},
      categoryCounts: {}
    });

    members.forEach(m => {
      const pNorm = normPhone(m.phoneNorm || m.phone);
      const key = pNorm ? `tel:${pNorm}` : `name:${String(m.name || '').trim().toLowerCase()}`;
      if (!byKey.has(key)) {
        byKey.set(key, makeRecord({
          key,
          name: m.name,
          phone: m.phone || pNorm,
          phoneNorm: pNorm,
          isRegistered: true,
          joinedAt: m.createdAt,
          lastActivityAt: m.lastLoginAt || m.createdAt
        }));
      }
    });

    orders.forEach(ord => {
      const pNorm = normPhone(ord.customerPhone);
      const cleanName = String(ord.customerName || 'Pelanggan Sahira').trim() || 'Pelanggan Sahira';
      const key = pNorm ? `tel:${pNorm}` : `name:${cleanName.toLowerCase()}`;
      let rec = byKey.get(key);
      if (!rec) {
        rec = makeRecord({
          key,
          name: cleanName,
          phone: ord.customerPhone || pNorm,
          phoneNorm: pNorm,
          isRegistered: false,
          joinedAt: ord.createdAt,
          lastActivityAt: ord.createdAt
        });
        byKey.set(key, rec);
      } else {
        if (cleanName !== 'Pelanggan Sahira' && (rec.name === 'Pelanggan Sahira' || !rec.name)) rec.name = cleanName;
        if (!rec.phone && ord.customerPhone) rec.phone = ord.customerPhone;
        if (Date.parse(ord.createdAt || '') > Date.parse(rec.lastActivityAt || '')) {
          rec.lastActivityAt = ord.createdAt;
        }
      }
      rec.orderCount += 1;
      rec.orders.push(ord);
      (ord.items || []).forEach(it => {
        const qty = Math.max(1, Number(it.qty) || 1);
        const val = (Number(it.unitPrice) || 0) * qty;
        rec.totalUnits += qty;
        const itemLabel = `${it.name}${it.size && it.size !== '-' ? ` (${it.size})` : ''}`;
        rec.itemCounts[itemLabel] = (rec.itemCounts[itemLabel] || 0) + qty;
        const catKey = catalogMap[it.id]?.category || 'apparel';
        const catLabel = getCategoryDef(catKey).label;
        rec.categoryCounts[catLabel] = (rec.categoryCounts[catLabel] || 0) + qty;
        if (it.status === 'paid') {
          rec.paidUnits += qty;
          rec.paidValue += val;
        } else if (it.status === 'unlocked') {
          rec.unlockedUnits += qty;
          rec.unlockedValue += val;
        } else {
          rec.lockedUnits += qty;
          rec.lockedValue += val;
        }
      });
    });

    const customers = Array.from(byKey.values()).map(rec => {
      const convRate = rec.totalUnits > 0 ? Math.round((rec.paidUnits / rec.totalUnits) * 100) : 0;
      const topItemEntry = Object.entries(rec.itemCounts).sort((a, b) => b[1] - a[1])[0];
      const topCatEntry = Object.entries(rec.categoryCounts).sort((a, b) => b[1] - a[1])[0];
      let segment = { key: 'member', label: 'Ahli Berdaftar', cls: 'is-member' };
      if (rec.paidUnits >= 2 || rec.paidValue >= 200) {
        segment = { key: 'vip', label: 'Pembeli Aktif / VIP', cls: 'is-vip' };
      } else if (rec.paidUnits > 0 && rec.lockedUnits === 0) {
        segment = { key: 'paid', label: 'Complete Payment ✓', cls: 'is-vip' };
      } else if (rec.lockedUnits > 0) {
        segment = { key: 'followup', label: 'Perlu Follow-Up Lock', cls: 'is-followup' };
      } else if (rec.unlockedUnits > 0) {
        segment = { key: 'expired', label: 'Auto-Unlock (>24 Jam)', cls: 'is-expired' };
      }
      return {
        ...rec,
        conversionRate: convRate,
        avgOrderValue: rec.orderCount > 0 ? rec.paidValue / rec.orderCount : 0,
        topItem: topItemEntry ? `${topItemEntry[0]} (${topItemEntry[1]}u)` : '-',
        favoriteCategory: topCatEntry ? `${topCatEntry[0]} (${topCatEntry[1]}u)` : '-',
        segment
      };
    });

    const totalCustomers = customers.length;
    const registeredCount = customers.filter(c => c.isRegistered).length;
    const payingCustomers = customers.filter(c => c.paidUnits > 0).length;
    const activeLockCustomers = customers.filter(c => c.lockedUnits > 0).length;
    const expiredOnlyCustomers = customers.filter(c => c.unlockedUnits > 0).length;
    const totalPaidRevenue = customers.reduce((s, c) => s + c.paidValue, 0);
    const totalLockedRevenue = customers.reduce((s, c) => s + c.lockedValue, 0);
    const totalUnitsAll = customers.reduce((s, c) => s + c.totalUnits, 0);
    const totalPaidUnits = customers.reduce((s, c) => s + c.paidUnits, 0);
    const totalLockedUnits = customers.reduce((s, c) => s + c.lockedUnits, 0);
    const totalUnlockedUnits = customers.reduce((s, c) => s + c.unlockedUnits, 0);

    return {
      customers,
      summary: {
        totalCustomers,
        registeredCount,
        payingCustomers,
        activeLockCustomers,
        expiredOnlyCustomers,
        totalPaidRevenue,
        totalLockedRevenue,
        totalUnitsAll,
        totalPaidUnits,
        totalLockedUnits,
        totalUnlockedUnits
      }
    };
  }

  function renderAdminCustomers() {
    const kpiEl = document.getElementById('admin-customers-kpi');
    const analyticsEl = document.getElementById('admin-customers-analytics');
    const container = document.getElementById('admin-customers-container');
    const sortEl = document.getElementById('admin-cust-sort');
    if (!container) return;

    const { customers, summary } = buildCustomerAnalytics();

    if (kpiEl) {
      const custConv = summary.totalCustomers > 0 ? Math.round((summary.payingCustomers / summary.totalCustomers) * 100) : 0;
      const avgSpend = summary.payingCustomers > 0 ? summary.totalPaidRevenue / summary.payingCustomers : 0;
      kpiEl.innerHTML = `
        <div class="admin-kpi-card"><span class="admin-kpi-label">Jumlah Pelanggan</span><strong class="admin-kpi-value">${summary.totalCustomers}</strong><span class="admin-kpi-meta">${summary.registeredCount} ahli berdaftar</span></div>
        <div class="admin-kpi-card"><span class="admin-kpi-label">Pelanggan Complete Pay</span><strong class="admin-kpi-value">${summary.payingCustomers}</strong><span class="admin-kpi-meta">Kadar penukaran ${custConv}% pelanggan</span></div>
        <div class="admin-kpi-card"><span class="admin-kpi-label">Jumlah Jualan Selesai</span><strong class="admin-kpi-value">${money(summary.totalPaidRevenue)}</strong><span class="admin-kpi-meta">Purata ${money(avgSpend)} / pembeli</span></div>
        <div class="admin-kpi-card"><span class="admin-kpi-label">Pelanggan Sedang Lock</span><strong class="admin-kpi-value">${summary.activeLockCustomers}</strong><span class="admin-kpi-meta">Potensi ${money(summary.totalLockedRevenue)} · ${summary.expiredOnlyCustomers} tamat 24 jam</span></div>
      `;
    }

    if (analyticsEl) {
      const totalU = Math.max(1, summary.totalUnitsAll);
      const pctPaid = Math.round((summary.totalPaidUnits / totalU) * 100);
      const pctLocked = Math.round((summary.totalLockedUnits / totalU) * 100);
      const pctUnlocked = Math.round((summary.totalUnlockedUnits / totalU) * 100);
      const topCustomers = [...customers]
        .filter(c => c.totalUnits > 0)
        .sort((a, b) => (b.paidValue - a.paidValue) || (b.lockedValue - a.lockedValue) || (b.totalUnits - a.totalUnits))
        .slice(0, 4);

      analyticsEl.innerHTML = `
        <div class="admin-analytics-card">
          <div class="admin-analytics-head">
            <h3>Analisis Penukaran Lock → Bayar</h3>
            <span>${summary.totalUnitsAll} unit direkodkan</span>
          </div>
          <div class="admin-bar-list">
            <div class="admin-bar-row">
              <div class="admin-bar-meta"><span>Complete Payment</span><strong>${summary.totalPaidUnits} unit (${pctPaid}%)</strong></div>
              <div class="admin-bar-track"><div class="admin-bar-fill is-paid" style="width:${pctPaid}%"></div></div>
            </div>
            <div class="admin-bar-row">
              <div class="admin-bar-meta"><span>Sedang Di-Lock (Menunggu Bayaran)</span><strong>${summary.totalLockedUnits} unit (${pctLocked}%)</strong></div>
              <div class="admin-bar-track"><div class="admin-bar-fill is-locked" style="width:${pctLocked}%"></div></div>
            </div>
            <div class="admin-bar-row">
              <div class="admin-bar-meta"><span>Auto-Unlock (&gt;24 Jam Tidak Bayar)</span><strong>${summary.totalUnlockedUnits} unit (${pctUnlocked}%)</strong></div>
              <div class="admin-bar-track"><div class="admin-bar-fill is-unlocked" style="width:${pctUnlocked}%"></div></div>
            </div>
          </div>
        </div>
        <div class="admin-analytics-card">
          <div class="admin-analytics-head">
            <h3>Pelanggan Paling Aktif</h3>
            <span>Ikut jumlah bayaran &amp; lock</span>
          </div>
          ${topCustomers.length ? `
            <div class="admin-top-list">
              ${topCustomers.map((c, idx) => `
                <div class="admin-top-row">
                  <span class="admin-top-rank">${idx + 1}</span>
                  <div class="admin-top-main">
                    <strong>${esc(c.name)}${c.phone ? ` · ${esc(c.phone)}` : ''}</strong>
                    <span>${c.orderCount} tempahan · ${c.paidUnits} bayar · ${c.lockedUnits} lock · ${esc(c.favoriteCategory)}</span>
                  </div>
                  <span class="admin-top-val">${c.paidValue > 0 ? money(c.paidValue) : `${money(c.lockedValue)} (Lock)`}</span>
                </div>
              `).join('')}
            </div>
          ` : '<div class="admin-empty-box">Belum ada transaksi lock atau bayaran pelanggan untuk dianalisis.</div>'}
        </div>
      `;
    }

    if (sortEl) sortEl.value = custSort;

    const q = custSearch.trim().toLowerCase();
    const filtered = customers
      .filter(c => {
        if (q) {
          const itemNames = Object.keys(c.itemCounts).join(' ');
          const hay = `${c.name} ${c.phone} ${c.phoneNorm} ${itemNames}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (custFilter === 'paid') return c.paidUnits > 0;
        if (custFilter === 'locked') return c.lockedUnits > 0;
        if (custFilter === 'unlocked') return c.unlockedUnits > 0;
        if (custFilter === 'registered') return c.isRegistered;
        return true;
      })
      .sort((a, b) => {
        if (custSort === 'spend') return (b.paidValue - a.paidValue) || (b.lockedValue - a.lockedValue);
        if (custSort === 'locked') return (b.lockedUnits - a.lockedUnits) || (b.totalUnits - a.totalUnits);
        if (custSort === 'orders') return (b.orderCount - a.orderCount) || (b.totalUnits - a.totalUnits);
        return (Date.parse(b.lastActivityAt || '') || 0) - (Date.parse(a.lastActivityAt || '') || 0);
      });

    if (!filtered.length) {
      container.innerHTML = '<div class="admin-empty-box">Tiada profil pelanggan sepadan buat masa ini. Pelanggan yang log masuk atau menghantar Lock Item akan dipantau automatik di sini.</div>';
      return;
    }

    container.innerHTML = filtered.map(c => {
      const isExpanded = expandedCustKeys.has(c.key);
      const waDigits = window.SahiraAuth?.toWaDigits?.(c.phone || c.phoneNorm) || '';
      const followUpMsg = c.lockedUnits > 0
        ? `Hai ${c.name}, peringatan mesra dari Sahira Premium Outlet mengenai ${c.lockedUnits} item yang sedang di-lock (${money(c.lockedValue)}). Sila maklumkan jika ingin teruskan pembayaran sebelum auto-unlock 24 jam.`
        : `Hai ${c.name}, terima kasih kerana membeli-belah bersama Sahira Premium Outlet!`;
      const waHref = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(followUpMsg)}` : '';
      const lastDt = c.lastActivityAt ? formatOrderDate(c.lastActivityAt) : '-';
      const joinedDt = c.joinedAt ? formatOrderDate(c.joinedAt) : '-';

      return `
        <div class="admin-cust-card${isExpanded ? ' is-expanded' : ''}" data-cust-key="${esc(c.key)}">
          <div class="admin-cust-summary">
            <div class="admin-cust-identity">
              <div class="admin-cust-avatar">${esc((c.name || 'S').charAt(0).toUpperCase())}</div>
              <div class="admin-cust-title-wrap">
                <div class="admin-cust-name-row">
                  <strong>${esc(c.name)}</strong>
                  <span class="admin-seg-badge ${c.segment.cls}">${esc(c.segment.label)}</span>
                  ${c.isRegistered ? '<span class="admin-pay-badge is-paid">Ahli Berdaftar</span>' : '<span class="admin-pay-badge">Tempahan WA</span>'}
                </div>
                <div class="admin-cust-sub">
                  <span>No. Tel: <strong>${esc(c.phone || 'Tiada no.')}</strong></span>
                  <span>· Aktiviti: ${esc(lastDt)}</span>
                  <span>· Minat: ${esc(c.favoriteCategory)}</span>
                </div>
              </div>
            </div>
            <div class="admin-cust-metrics">
              <div class="admin-cust-metric-pill"><span>Complete Pay</span><strong>${money(c.paidValue)} (${c.paidUnits}u)</strong></div>
              <div class="admin-cust-metric-pill"><span>Sedang Lock</span><strong>${c.lockedUnits}u · ${money(c.lockedValue)}</strong></div>
              <div class="admin-cust-metric-pill"><span>Auto-Unlock</span><strong>${c.unlockedUnits}u</strong></div>
              <div class="admin-cust-metric-pill"><span>Penukaran</span><strong>${c.conversionRate}%</strong></div>
              ${waHref ? `<a href="${esc(waHref)}" target="_blank" rel="noopener noreferrer" class="admin-order-phone-link" title="Hantar WhatsApp Follow-Up">WhatsApp ↗</a>` : ''}
              <button type="button" class="admin-btn secondary admin-btn-xs" data-cust-toggle="${esc(c.key)}" aria-expanded="${isExpanded}">${isExpanded ? 'Tutup' : 'Detail'}</button>
            </div>
          </div>

          <div class="admin-cust-detail" ${isExpanded ? '' : 'hidden'}>
            <div class="admin-cust-detail-grid">
              <div class="admin-cust-info-box">
                <span>Tarikh Mula / Daftar</span>
                <strong>${esc(joinedDt)}</strong>
              </div>
              <div class="admin-cust-info-box">
                <span>Jumlah Rekod Tempahan</span>
                <strong>${c.orderCount} tempahan (${c.totalUnits} unit)</strong>
              </div>
              <div class="admin-cust-info-box">
                <span>Item Paling Diminati</span>
                <strong>${esc(c.topItem)}</strong>
              </div>
            </div>

            <div class="admin-cust-orders-mini">
              ${c.orders.length ? c.orders.map(ord => {
                const ordLocked = ord.items.filter(i => i.status === 'locked').length;
                const ordPaid = ord.items.filter(i => i.status === 'paid').length;
                const ordUnlocked = ord.items.filter(i => i.status === 'unlocked').length;
                const ordTotal = ord.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
                return `
                  <div class="admin-cust-order-mini-row">
                    <div>
                      <strong>#${esc(ord.ref)}</strong>
                      <span class="admin-order-time"> · ${esc(formatOrderDate(ord.createdAt))} · ${ord.items.map(i => `${esc(i.name)} (${esc(i.size)} ×${i.qty})`).join(', ')}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                      <strong>${money(ordTotal)}</strong>
                      ${ordPaid ? `<span class="admin-pay-badge is-paid">${ordPaid} Complete</span>` : ''}
                      ${ordLocked ? `<span class="admin-pay-badge is-locked">${ordLocked} Lock</span>` : ''}
                      ${ordUnlocked ? `<span class="admin-pay-badge is-unlocked">${ordUnlocked} Auto-Unlock</span>` : ''}
                    </div>
                  </div>
                `;
              }).join('') : '<div class="admin-empty-box">Pelanggan ini berdaftar tetapi belum membuat sebarang Lock Item lagi.</div>'}
            </div>

            <div class="admin-cust-detail-foot">
              <button type="button" class="admin-btn secondary admin-btn-xs" data-cust-jump-orders="${esc(c.phone || c.name)}">Pantau di Lock &amp; Bayaran →</button>
              ${c.isRegistered && c.phoneNorm ? `<button type="button" class="admin-btn danger admin-btn-xs" data-cust-del-member="${esc(c.phoneNorm)}">Padam Profil Ahli</button>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function buildSalesMetrics(period = 'month') {
    const orders = window.SahiraLockOrders?.getOrders?.() || [];
    const targets = getSalesTargets();
    const catalogMap = Object.fromEntries((workingConfig.items || []).map(it => [it.id, it]));
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOf7d = startOfToday - (6 * 86400000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const inWindow = (iso, p) => {
      if (p === 'all') return true;
      const ms = Date.parse(iso || '');
      if (!Number.isFinite(ms)) return false;
      if (p === 'today') return ms >= startOfToday;
      if (p === '7d') return ms >= startOf7d;
      if (p === 'month') return ms >= startOfMonth;
      return true;
    };

    let todayPaidValue = 0;
    let todayPaidUnits = 0;
    let todayOrders = 0;
    let monthPaidValue = 0;
    let monthPaidUnits = 0;
    let monthLockedValue = 0;
    let allPaidValue = 0;
    let allPaidUnits = 0;
    let allLockedValue = 0;
    let allLockedUnits = 0;

    let periodPaidValue = 0;
    let periodPaidUnits = 0;
    let periodLockedValue = 0;
    let periodLockedUnits = 0;
    let periodUnlockedValue = 0;
    const periodPaidOrders = [];
    const byCategory = {};
    const byProduct = {};

    orders.forEach(ord => {
      let ordHasTodayPaid = false;
      let ordPeriodPaidAmt = 0;
      let ordPeriodPaidUnits = 0;
      const ordPeriodItems = [];
      let latestPaidAt = '';

      (ord.items || []).forEach(it => {
        const qty = Math.max(1, Number(it.qty) || 1);
        const val = (Number(it.unitPrice) || 0) * qty;
        const evDate = it.paidAt || ord.createdAt;
        const catKey = catalogMap[it.id]?.category || 'apparel';
        const catLabel = getCategoryDef(catKey).label;

        if (it.status === 'paid') {
          allPaidValue += val;
          allPaidUnits += qty;
          if (inWindow(evDate, 'today')) {
            todayPaidValue += val;
            todayPaidUnits += qty;
            ordHasTodayPaid = true;
          }
          if (inWindow(evDate, 'month')) {
            monthPaidValue += val;
            monthPaidUnits += qty;
          }
          if (inWindow(evDate, period)) {
            periodPaidValue += val;
            periodPaidUnits += qty;
            ordPeriodPaidAmt += val;
            ordPeriodPaidUnits += qty;
            ordPeriodItems.push(it);
            if (!latestPaidAt || Date.parse(evDate) > Date.parse(latestPaidAt)) latestPaidAt = evDate;

            if (!byCategory[catLabel]) byCategory[catLabel] = { label: catLabel, paidValue: 0, paidUnits: 0, lockedValue: 0 };
            byCategory[catLabel].paidValue += val;
            byCategory[catLabel].paidUnits += qty;

            if (!byProduct[it.id]) byProduct[it.id] = { id: it.id, name: it.name, image: it.image || catalogMap[it.id]?.image || '', paidValue: 0, paidUnits: 0, lockedUnits: 0 };
            byProduct[it.id].paidValue += val;
            byProduct[it.id].paidUnits += qty;
          }
        } else if (it.status === 'locked') {
          allLockedValue += val;
          allLockedUnits += qty;
          if (inWindow(it.lockedAt || ord.createdAt, 'month')) monthLockedValue += val;
          if (inWindow(it.lockedAt || ord.createdAt, period)) {
            periodLockedValue += val;
            periodLockedUnits += qty;
            if (!byCategory[catLabel]) byCategory[catLabel] = { label: catLabel, paidValue: 0, paidUnits: 0, lockedValue: 0 };
            byCategory[catLabel].lockedValue += val;
            if (!byProduct[it.id]) byProduct[it.id] = { id: it.id, name: it.name, image: it.image || catalogMap[it.id]?.image || '', paidValue: 0, paidUnits: 0, lockedUnits: 0 };
            byProduct[it.id].lockedUnits += qty;
          }
        } else if (it.status === 'unlocked' && inWindow(it.unlockedAt || ord.createdAt, period)) {
          periodUnlockedValue += val;
        }
      });

      if (ordHasTodayPaid) todayOrders += 1;
      if (ordPeriodPaidUnits > 0) {
        periodPaidOrders.push({
          ...ord,
          paidAt: latestPaidAt || ord.createdAt,
          periodAmount: ordPeriodPaidAmt,
          periodUnits: ordPeriodPaidUnits,
          periodItems: ordPeriodItems
        });
      }
    });

    const dailyPct = targets.daily > 0 ? Math.min(999, Math.round((todayPaidValue / targets.daily) * 100)) : 0;
    const monthPct = targets.monthly > 0 ? Math.min(999, Math.round((monthPaidValue / targets.monthly) * 100)) : 0;
    const unitPct = targets.monthlyUnits > 0 ? Math.min(999, Math.round((monthPaidUnits / targets.monthlyUnits) * 100)) : 0;

    return {
      targets,
      todayPaidValue,
      todayPaidUnits,
      todayOrders,
      monthPaidValue,
      monthPaidUnits,
      monthLockedValue,
      allPaidValue,
      allPaidUnits,
      allLockedValue,
      allLockedUnits,
      periodPaidValue,
      periodPaidUnits,
      periodLockedValue,
      periodLockedUnits,
      periodUnlockedValue,
      periodPaidOrders,
      byCategory: Object.values(byCategory).sort((a, b) => (b.paidValue - a.paidValue) || (b.lockedValue - a.lockedValue)),
      byProduct: Object.values(byProduct).sort((a, b) => (b.paidValue - a.paidValue) || (b.lockedUnits - a.lockedUnits)),
      dailyPct,
      monthPct,
      unitPct
    };
  }

  let offerFilter = 'all';
  let offerSearch = '';
  const OFFER_TYPE_LABELS = { flash_sale: 'Flash Sale', clearance: 'Clearance', member: 'Member Offer' };
  const OFFER_QUICK = [['1j', 3600e3, '+1 Jam'], ['6j', 6 * 3600e3, '+6 Jam'], ['24j', 24 * 3600e3, '+24 Jam'], ['3h', 3 * 86400e3, '+3 Hari'], ['7h', 7 * 86400e3, '+7 Hari']];
  const offerStatus = it => isOfferActive(it) ? 'active' : (it.offerEnabled && it.offerEndsAt ? 'expired' : 'none');

  function offerStatusHtml(it) {
    const st = offerStatus(it);
    if (st === 'active') return `<span class="admin-offer-status is-active"><i></i><span data-admin-offer-countdown="${esc(it.offerEndsAt)}">${formatCountdown(it.offerEndsAt)}</span></span>`;
    if (st === 'expired') return '<span class="admin-offer-status is-expired">Tamat · harga asal</span>';
    if (it.offerEnabled) return '<span class="admin-offer-status is-pending">Tetapkan masa tamat</span>';
    return '<span class="admin-offer-status">Tiada offer</span>';
  }

  function offerPreviewHtml(it) {
    const base = Math.max(0, Number(it.price) || 0);
    const disc = clampDiscount(it.offerDiscount);
    const sale = Number((base * (1 - disc / 100)).toFixed(2));
    if (!disc) return `<span class="admin-offer-preview is-muted">${money(base)} · masukkan % promo</span>`;
    return `<span class="admin-offer-preview"><s>${money(base)}</s><strong>${money(sale)}</strong><em>-${disc}%</em></span>`;
  }

  function renderAdminOfferStats() {
    const el = document.getElementById('admin-offer-stats');
    el?.classList.add('admin-kpi-grid');
    if (!el) return;
    const items = workingConfig.items;
    const active = items.filter(isOfferActive);
    const soon = active.filter(it => Date.parse(it.offerEndsAt) - Date.now() < 86400e3);
    const expired = items.filter(it => offerStatus(it) === 'expired');
    const avg = active.length ? Math.round(active.reduce((a, it) => a + clampDiscount(it.offerDiscount), 0) / active.length) : 0;
    el.innerHTML = [
      ['Offer Aktif', active.length, 'Sedang dipaparkan dengan countdown'],
      ['Tamat < 24 Jam', soon.length, 'Paling tinggi urgency'],
      ['Purata Diskaun', `${avg}%`, 'Untuk offer aktif'],
      ['Sudah Tamat', expired.length, 'Harga kembali asal']
    ].map(([k, v, d]) => `<div class="admin-kpi-card"><span class="admin-kpi-label">${k}</span><strong class="admin-kpi-value">${v}</strong><span class="admin-kpi-meta">${d}</span></div>`).join('');
  }

  function renderAdminOffers() {
    renderAdminOfferStats();
    const wrap = document.getElementById('admin-offer-manager');
    if (!wrap) return;
    dialog.querySelectorAll('[data-offer-filter]').forEach(b => b.classList.toggle('active', b.dataset.offerFilter === offerFilter));
    const q = offerSearch.trim().toLowerCase();
    const rows = workingConfig.items.map((it, i) => ({ it, i })).filter(({ it }) => {
      if (offerFilter !== 'all' && offerStatus(it) !== offerFilter) return false;
      return !q || `${it.name} ${it.type || ''}`.toLowerCase().includes(q);
    });
    if (!rows.length) {
      wrap.innerHTML = '<div class="admin-empty-box">Tiada item sepadan dengan carian atau tapisan ini.</div>';
      return;
    }
    wrap.innerHTML = rows.map(({ it, i }) => {
      const st = offerStatus(it);
      return `<article class="admin-offer-card is-${st}${it.offerEnabled ? ' is-on' : ''}" data-offer-card="${i}">
        <img src="${esc(it.image)}" alt="${esc(it.name)}" loading="lazy">
        <div class="admin-offer-card-body">
          <div class="admin-offer-card-head">
            <div>
              <strong>${esc(it.name)}</strong>
              <span data-offer-preview="${i}">${offerPreviewHtml(it)}</span>
            </div>
            <div class="admin-offer-card-side">
              <span data-offer-status="${i}">${offerStatusHtml(it)}</span>
              <label class="admin-offer-switch" title="Aktifkan offer">
                <input type="checkbox" data-offer-field="offerEnabled" data-idx="${i}" ${it.offerEnabled ? 'checked' : ''}>
                <span aria-hidden="true"></span><em>${it.offerEnabled ? 'Aktif' : 'Off'}</em>
              </label>
            </div>
          </div>
          <div class="admin-offer-fields">
            <label class="admin-form-group"><span>Jenis Offer</span>
              <select class="admin-input-text" data-offer-field="offerType" data-idx="${i}">
                ${Object.entries(OFFER_TYPE_LABELS).map(([v, l]) => `<option value="${v}" ${it.offerType === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </label>
            <label class="admin-form-group"><span>Label Tag</span><input type="text" maxlength="24" class="admin-input-text" data-offer-field="offerLabel" data-idx="${i}" value="${esc(it.offerLabel || '')}" placeholder="Cth: BAKI 2 UNIT"></label>
            <label class="admin-form-group"><span>Diskaun Promo (%)</span><input type="number" min="0" max="95" step="1" class="admin-input-text" data-offer-field="offerDiscount" data-idx="${i}" value="${clampDiscount(it.offerDiscount)}"></label>
            <label class="admin-form-group"><span>Tamat Pada</span><input type="datetime-local" class="admin-input-text" data-offer-field="offerEndsAt" data-idx="${i}" value="${formatOfferEndForInput(it.offerEndsAt)}"></label>
          </div>
          <div class="admin-offer-quick">
            <span>Countdown pantas:</span>
            ${OFFER_QUICK.map(([k, , l]) => `<button type="button" class="admin-offer-chip" data-offer-quick="${k}" data-idx="${i}">${l}</button>`).join('')}
            ${st === 'active' ? `<button type="button" class="admin-offer-chip is-danger" data-offer-stop="${i}">Tamatkan Sekarang</button>` : ''}
          </div>
        </div>
      </article>`;
    }).join('');
  }

  function refreshOfferCard(idx) {
    const it = workingConfig.items[idx];
    const card = dialog.querySelector(`[data-offer-card="${idx}"]`);
    if (!it || !card) return;
    const st = offerStatus(it);
    card.className = `admin-offer-card is-${st}${it.offerEnabled ? ' is-on' : ''}`;
    const statusEl = card.querySelector(`[data-offer-status="${idx}"]`);
    const previewEl = card.querySelector(`[data-offer-preview="${idx}"]`);
    if (statusEl) statusEl.innerHTML = offerStatusHtml(it);
    if (previewEl) previewEl.innerHTML = offerPreviewHtml(it);
    renderAdminOfferStats();
    updateSidebarCounts();
  }

  function commitOfferChange(idx, rerender) {
    setDirty(true);
    if (rerender) { renderAdminOffers(); updateSidebarCounts(); }
    else refreshOfferCard(idx);
  }

  setInterval(() => {
    if (activeAdminTab !== 'offers' || !dialog.open) return;
    let ended = false;
    dialog.querySelectorAll('[data-admin-offer-countdown]').forEach(el => {
      const iso = el.getAttribute('data-admin-offer-countdown') || '';
      if (Date.parse(iso) > Date.now()) el.textContent = formatCountdown(iso);
      else ended = true;
    });
    if (ended) { renderAdminOffers(); updateSidebarCounts(); }
  }, 1000);

  function renderAdminSales() {
    updateSidebarCounts();
    const targets = getSalesTargets();
    const dInput = document.getElementById('admin-target-daily');
    const mInput = document.getElementById('admin-target-monthly');
    const uInput = document.getElementById('admin-target-units');
    if (dInput && document.activeElement !== dInput) dInput.value = String(targets.daily);
    if (mInput && document.activeElement !== mInput) mInput.value = String(targets.monthly);
    if (uInput && document.activeElement !== uInput) uInput.value = String(targets.monthlyUnits);

    const kpiEl = document.getElementById('admin-sales-kpi');
    const progEl = document.getElementById('admin-sales-progress');
    const breakEl = document.getElementById('admin-sales-breakdown');
    const txEl = document.getElementById('admin-sales-transactions');
    const txCountEl = document.getElementById('admin-sales-tx-count');

    dialog.querySelectorAll('[data-admin-sales-period]').forEach(c => {
      c.classList.toggle('is-active', c.dataset.adminSalesPeriod === salesPeriod);
    });

    const m = buildSalesMetrics(salesPeriod);
    const periodLabel = salesPeriod === 'today' ? 'Hari Ini' : (salesPeriod === '7d' ? '7 Hari Terakhir' : (salesPeriod === 'month' ? 'Bulan Ini' : 'Semua Masa'));

    if (kpiEl) {
      const aov = m.periodPaidOrders.length > 0 ? m.periodPaidValue / m.periodPaidOrders.length : 0;
      kpiEl.innerHTML = `
        <div class="admin-kpi-card"><span class="admin-kpi-label">Jualan Disahkan (${periodLabel})</span><strong class="admin-kpi-value">${money(m.periodPaidValue)}</strong><span class="admin-kpi-meta">${m.periodPaidUnits} unit · ${m.periodPaidOrders.length} tempahan selesai</span></div>
        <div class="admin-kpi-card"><span class="admin-kpi-label">Jualan Hari Ini</span><strong class="admin-kpi-value">${money(m.todayPaidValue)}</strong><span class="admin-kpi-meta">${m.dailyPct}% drpd target ${money(m.targets.daily)}</span></div>
        <div class="admin-kpi-card"><span class="admin-kpi-label">Pipeline Lock (Potensi)</span><strong class="admin-kpi-value">${money(m.periodLockedValue)}</strong><span class="admin-kpi-meta">${m.periodLockedUnits} unit menunggu bayaran</span></div>
        <div class="admin-kpi-card"><span class="admin-kpi-label">Purata Tempahan (AOV)</span><strong class="admin-kpi-value">${money(aov)}</strong><span class="admin-kpi-meta">Keseluruhan masa: ${money(m.allPaidValue)}</span></div>
      `;
    }

    if (progEl) {
      const mPaidPct = m.targets.monthly > 0 ? Math.min(100, (m.monthPaidValue / m.targets.monthly) * 100) : 0;
      const mPipePct = m.targets.monthly > 0 ? Math.min(100 - mPaidPct, (m.monthLockedValue / m.targets.monthly) * 100) : 0;
      const mRemain = Math.max(0, m.targets.monthly - m.monthPaidValue);
      const dPaidPct = m.targets.daily > 0 ? Math.min(100, (m.todayPaidValue / m.targets.daily) * 100) : 0;
      const uPaidPct = m.targets.monthlyUnits > 0 ? Math.min(100, (m.monthPaidUnits / m.targets.monthlyUnits) * 100) : 0;

      progEl.innerHTML = `
        <div class="admin-target-card">
          <div class="admin-target-head">
            <h3>Kemajuan Target Bulanan</h3>
            <span class="admin-pay-badge ${m.monthPct >= 100 ? 'is-paid' : 'is-locked'}">${m.monthPct >= 100 ? 'Target Tercapai ✓' : `${m.monthPct}% Tercapai`}</span>
          </div>
          <div class="admin-target-nums">
            <strong>${money(m.monthPaidValue)}</strong>
            <span>Sasaran ${money(m.targets.monthly)}</span>
          </div>
          <div class="admin-target-track" aria-label="Kemajuan Target Bulanan">
            <div class="admin-target-fill-paid" style="width:${mPaidPct.toFixed(1)}%"></div>
            <div class="admin-target-fill-pipe" style="width:${mPipePct.toFixed(1)}%"></div>
          </div>
          <div class="admin-target-legend">
            <div class="admin-target-dots">
              <span class="admin-dot-swatch is-paid">Disahkan: ${money(m.monthPaidValue)}</span>
              <span class="admin-dot-swatch is-pipe">Potensi Lock: ${money(m.monthLockedValue)}</span>
            </div>
            <strong>${mRemain > 0 ? `Baki ${money(mRemain)}` : 'Melepasi sasaran!'}</strong>
          </div>
        </div>

        <div class="admin-target-card">
          <div class="admin-target-head">
            <h3>Target Harian &amp; Unit Bulanan</h3>
            <span class="admin-pay-badge ${m.dailyPct >= 100 ? 'is-paid' : 'is-locked'}">Harian ${m.dailyPct}% · Unit ${m.unitPct}%</span>
          </div>
          <div class="admin-bar-list">
            <div class="admin-bar-row">
              <div class="admin-bar-meta"><span>Jualan Hari Ini (${m.todayOrders} tempahan)</span><strong>${money(m.todayPaidValue)} / ${money(m.targets.daily)}</strong></div>
              <div class="admin-bar-track"><div class="admin-bar-fill is-paid" style="width:${dPaidPct.toFixed(1)}%"></div></div>
            </div>
            <div class="admin-bar-row">
              <div class="admin-bar-meta"><span>Unit Terjual Bulan Ini</span><strong>${m.monthPaidUnits} / ${m.targets.monthlyUnits} unit</strong></div>
              <div class="admin-bar-track"><div class="admin-bar-fill is-paid" style="width:${uPaidPct.toFixed(1)}%"></div></div>
            </div>
          </div>
        </div>
      `;
    }

    if (breakEl) {
      const maxCat = Math.max(1, ...m.byCategory.map(c => c.paidValue));
      const topProds = m.byProduct.slice(0, 5);
      breakEl.innerHTML = `
        <div class="admin-analytics-card">
          <div class="admin-analytics-head">
            <h3>Jualan Mengikut Kategori (${periodLabel})</h3>
            <span>${m.byCategory.length} kategori aktif</span>
          </div>
          ${m.byCategory.length ? `
            <div class="admin-bar-list">
              ${m.byCategory.map(c => {
                const w = Math.round((c.paidValue / maxCat) * 100);
                return `
                  <div class="admin-bar-row">
                    <div class="admin-bar-meta"><span>${esc(c.label)} (${c.paidUnits} unit)</span><strong>${money(c.paidValue)}${c.lockedValue > 0 ? ` · +${money(c.lockedValue)} Lock` : ''}</strong></div>
                    <div class="admin-bar-track"><div class="admin-bar-fill is-paid" style="width:${w}%"></div></div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : '<div class="admin-empty-box">Belum ada jualan mengikut kategori bagi tempoh ini.</div>'}
        </div>

        <div class="admin-analytics-card">
          <div class="admin-analytics-head">
            <h3>Produk Terlaris (${periodLabel})</h3>
            <span>Disusun ikut hasil jualan</span>
          </div>
          ${topProds.length ? `
            <div class="admin-top-list">
              ${topProds.map((p, idx) => `
                <div class="admin-top-row">
                  <span class="admin-top-rank">${idx + 1}</span>
                  <div class="admin-top-main">
                    <strong>${esc(p.name)}</strong>
                    <span>${p.paidUnits} unit terjual${p.lockedUnits > 0 ? ` · ${p.lockedUnits} unit sedang lock` : ''}</span>
                  </div>
                  <span class="admin-top-val">${money(p.paidValue)}</span>
                </div>
              `).join('')}
            </div>
          ` : '<div class="admin-empty-box">Belum ada produk terjual bagi tempoh ini. Tandakan Complete Payment di tab Lock &amp; Bayaran.</div>'}
        </div>
      `;
    }

    if (txCountEl) txCountEl.textContent = `${m.periodPaidOrders.length} tempahan selesai (${money(m.periodPaidValue)})`;
    if (txEl) {
      if (!m.periodPaidOrders.length) {
        txEl.innerHTML = '<div class="admin-empty-box">Tiada transaksi <strong>Complete Payment</strong> dalam tempoh dipilih. Apabila item ditandakan Complete Payment, jualan akan direkodkan di sini &amp; mengira kemajuan target secara automatik.</div>';
      } else {
        txEl.innerHTML = m.periodPaidOrders.map(ord => `
          <div class="admin-sales-tx-row">
            <div class="admin-sales-tx-left">
              <div class="admin-sales-tx-top">
                <span class="admin-order-ref">#${esc(ord.ref)}</span>
                <strong>${esc(ord.customerName)}</strong>
                ${ord.customerPhone ? `<span class="admin-order-time">${esc(ord.customerPhone)}</span>` : ''}
                <span class="admin-order-time">· ${esc(formatOrderDate(ord.paidAt))}</span>
              </div>
              <div class="admin-sales-tx-items">${ord.periodItems.map(i => `${esc(i.name)} (${esc(i.size)} ×${i.qty})`).join(' · ')}</div>
            </div>
            <div class="admin-sales-tx-right">
              <span class="admin-pay-badge is-paid">${ord.periodUnits} unit ✓</span>
              <span class="admin-sales-tx-amount">+${money(ord.periodAmount)}</span>
            </div>
          </div>
        `).join('');
      }
    }
  }

  function commitAndPublish({ keepOpen = false, sourceLookIdx = -1 } = {}) {
    syncLookCardsFromDOM();
    workingConfig = normalizeAdminConfig(workingConfig);
    activeConfig = JSON.parse(JSON.stringify(workingConfig));
    activeConfig.reels = workingConfig.reels.map(r => ({ ...r }));
    let storageSaved = true;
    try {
      saveAdminConfigToDb(activeConfig);
    } catch (err) {
      storageSaved = false;
      console.warn('Supabase save warning:', err);
    }
    applyConfigToDOM(activeConfig);
    setDirty(false);
    renderAdminOverview();

    if (!storageSaved) {
      notify('Ralat menyimpan ke pangkalan data — perubahan aktif untuk sesi ini. Sila cuba lagi.', true);
      return;
    }

    if (keepOpen) {
      if (sourceLookIdx >= 0) {
        const cardBtn = dialog.querySelector(`[data-look-save="${sourceLookIdx}"]`);
        if (cardBtn) {
          cardBtn.classList.add('is-saved');
          cardBtn.textContent = 'Disimpan ✓';
          clearTimeout(cardBtn._savedTimer);
          cardBtn._savedTimer = setTimeout(() => {
            cardBtn.classList.remove('is-saved');
            cardBtn.textContent = 'Simpan Update';
          }, 2200);
        }
        const studioBtn = pinStudioEl?.querySelector('[data-studio-save]');
        if (studioBtn) {
          studioBtn.classList.add('is-saved');
          studioBtn.textContent = 'Disimpan ✓';
          clearTimeout(studioBtn._savedTimer);
          studioBtn._savedTimer = setTimeout(() => {
            studioBtn.classList.remove('is-saved');
            studioBtn.textContent = 'Simpan Update';
          }, 2200);
        }
        const lkName = activeConfig.looks[sourceLookIdx]?.name || `Look ${sourceLookIdx + 1}`;
        notify(`Update "${lkName}" berjaya disimpan & disegerak ke semua bahagian!`);
      } else {
        notify('Semua perubahan berjaya disimpan & dikemaskini!');
      }
      return;
    }

    closeAdmin();
    notify('Semua perubahan Outfit, Stok & Hand Rail Video berjaya disimpan & dikemaskini!');
  }

  const ADMIN_PASS = 'SPO2026';
  const adminLoginDialog = document.getElementById('admin-login-dialog');
  const adminLoginForm = document.getElementById('admin-login-form');
  const adminPassInput = document.getElementById('admin-password-input');
  const adminPassToggle = document.getElementById('admin-pass-toggle');
  const adminLoginMsg = document.getElementById('admin-login-msg');
  const closeAdminLoginBtn = document.getElementById('close-admin-login');
  let pendingAdminTab = 'overview';

  function openAdminLoginPrompt(defaultTab = 'overview') {
    pendingAdminTab = defaultTab || 'overview';
    if (adminLoginMsg) {
      adminLoginMsg.hidden = true;
      adminLoginMsg.textContent = '';
    }
    if (adminPassInput) {
      adminPassInput.value = '';
      adminPassInput.type = 'password';
    }
    if (adminPassToggle) adminPassToggle.textContent = 'Lihat';
    if (adminLoginDialog && !adminLoginDialog.open) {
      adminLoginDialog.showModal();
      setTimeout(() => adminPassInput?.focus(), 40);
    }
  }

  adminPassToggle?.addEventListener('click', () => {
    if (!adminPassInput) return;
    const isHidden = adminPassInput.type === 'password';
    adminPassInput.type = isHidden ? 'text' : 'password';
    if (adminPassToggle) adminPassToggle.textContent = isHidden ? 'Tutup' : 'Lihat';
  });

  closeAdminLoginBtn?.addEventListener('click', () => adminLoginDialog?.close());
  adminLoginDialog?.addEventListener('click', ev => {
    if (ev.target === adminLoginDialog) {
      const r = adminLoginDialog.getBoundingClientRect();
      if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) adminLoginDialog.close();
    }
  });

  adminLoginForm?.addEventListener('submit', ev => {
    ev.preventDefault();
    const entered = (adminPassInput?.value || '').trim();
    if (entered !== ADMIN_PASS) {
      if (adminLoginMsg) {
        adminLoginMsg.textContent = 'Kata laluan Admin tidak tepat. Sila cuba lagi.';
        adminLoginMsg.hidden = false;
      }
      adminPassInput?.focus();
      adminPassInput?.select();
      return;
    }
    adminSessionUnlocked = true;
    adminLoginDialog?.close();
    openAdmin(pendingAdminTab || 'overview');
    notify('Log masuk Admin berjaya.');
  });

  function openAdmin(defaultTab = 'overview') {
    if (!adminSessionUnlocked) {
      openAdminLoginPrompt(defaultTab);
      return;
    }
    if (floatingBtn) floatingBtn.hidden = false;
    if (specialUrlInput) specialUrlInput.value = getSpecialAdminUrl();
    workingConfig = normalizeAdminConfig(JSON.parse(JSON.stringify(activeConfig)));
    workingConfig.reels = activeConfig.reels.map(r => ({ ...r }));
    setDirty(false);
    switchAdminTab(defaultTab);
    if (!dialog.open) dialog.showModal();
  }

  function closeAdmin() {
    closePinStudio();
    if (dialog.open) dialog.close();
  }

  function lockAdminMode() {
    adminSessionUnlocked = false;
    if (floatingBtn) floatingBtn.hidden = true;
    closeAdmin();
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('admin');
      url.searchParams.delete('studio');
      if (url.hash.toLowerCase() === '#admin' || url.hash.toLowerCase() === '#studio-admin') url.hash = '';
      if (url.pathname.toLowerCase().endsWith('/admin') || url.pathname.toLowerCase().endsWith('/admin/')) url.pathname = url.pathname.replace(/\/admin\/?$/i, '/') || '/';
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (_) {}
    notify('Sesi Admin dikunci.');
  }

  if (floatingBtn) floatingBtn.addEventListener('click', () => openAdmin('overview'));
  if (headerAdminBtn) headerAdminBtn.addEventListener('click', () => openAdmin('overview'));
  if (closeBtn) closeBtn.addEventListener('click', closeAdmin);
  if (cancelBtn) cancelBtn.addEventListener('click', closeAdmin);
  if (lockBtn) lockBtn.addEventListener('click', lockAdminMode);
  if (saveBtn) saveBtn.addEventListener('click', () => commitAndPublish());
  if (saveTopBtn) saveTopBtn.addEventListener('click', () => commitAndPublish());

  // Delegated click & input inside Admin Dialog
  dialog.addEventListener('click', e => {
    const navBtn = e.target.closest('[data-admin-tab]');
    if (navBtn) { switchAdminTab(navBtn.dataset.adminTab); return; }

    const jumpBtn = e.target.closest('[data-admin-jump]');
    if (jumpBtn) { switchAdminTab(jumpBtn.dataset.adminJump); return; }

    const actBtn = e.target.closest('[data-admin-action]');
    if (actBtn) {
      const act = actBtn.dataset.adminAction;
      if (act === 'new-look') { switchAdminTab('looks'); document.getElementById('admin-new-look-form').hidden = false; }
      if (act === 'new-product') { switchAdminTab('products'); document.getElementById('admin-new-prod-form').hidden = false; renderNewProdSizeChips(); }
      if (act === 'new-video') { switchAdminTab('videos'); document.getElementById('admin-new-video-form').hidden = false; }
      return;
    }

    const offerFilterBtn = e.target.closest('[data-offer-filter]');
    if (offerFilterBtn) { offerFilter = offerFilterBtn.dataset.offerFilter; renderAdminOffers(); return; }

    const offerQuickBtn = e.target.closest('[data-offer-quick]');
    if (offerQuickBtn) {
      const idx = parseInt(offerQuickBtn.dataset.idx, 10);
      const it = workingConfig.items[idx];
      const preset = OFFER_QUICK.find(([k]) => k === offerQuickBtn.dataset.offerQuick);
      if (it && preset) {
        it.offerEnabled = true;
        it.offerEndsAt = new Date(Date.now() + preset[1]).toISOString();
        if (!clampDiscount(it.offerDiscount)) it.offerDiscount = 20;
        commitOfferChange(idx, true);
        notify(`${it.name}: countdown ${preset[2].replace('+', '')} bermula. Tekan Simpan & Terbit untuk paparkan.`);
      }
      return;
    }

    const offerStopBtn = e.target.closest('[data-offer-stop]');
    if (offerStopBtn) {
      const idx = parseInt(offerStopBtn.dataset.offerStop, 10);
      const it = workingConfig.items[idx];
      if (it) {
        it.offerEnabled = false;
        commitOfferChange(idx, true);
        notify(`${it.name}: offer ditamatkan, harga kembali asal.`);
      }
      return;
    }

    const restockBtn = e.target.closest('[data-admin-restock]');
    if (restockBtn) {
      const idx = parseInt(restockBtn.dataset.adminRestock, 10);
      const addQty = parseInt(restockBtn.dataset.add || '5', 10);
      if (workingConfig.items[idx]) {
        workingConfig.items[idx].stock = Math.max(0, Number(workingConfig.items[idx].stock || 0) + addQty);
        setDirty(true);
        renderAdminOverview();
        notify(`${workingConfig.items[idx].name}: +${addQty} unit ditambah.`);
      }
      return;
    }

    const lookExpandAllBtn = e.target.closest('#admin-look-expand-all');
    if (lookExpandAllBtn) {
      const container = document.getElementById('admin-looks-container');
      const cards = Array.from(container?.querySelectorAll('.admin-look-card') || []);
      const shouldExpand = cards.some(c => !c.classList.contains('is-expanded'));
      cards.forEach(card => {
        const idx = parseInt(card.dataset.lookIdx || '-1', 10);
        if (idx < 0) return;
        if (shouldExpand) expandedLookIndices.add(idx);
        else expandedLookIndices.delete(idx);
        card.classList.toggle('is-expanded', shouldExpand);
        const body = card.querySelector('.admin-look-collapse-body');
        if (body) body.hidden = !shouldExpand;
        card.querySelectorAll('[data-look-toggle]').forEach(tog => {
          tog.setAttribute('aria-expanded', String(shouldExpand));
        });
        const lbl = card.querySelector('[data-look-toggle-label]');
        if (lbl) lbl.textContent = shouldExpand ? 'Tutup' : 'Edit';
      });
      updateLookExpandAllBtn();
      return;
    }

    const lookToggleBtn = e.target.closest('[data-look-toggle]');
    if (lookToggleBtn) {
      const idx = parseInt(lookToggleBtn.dataset.lookToggle || '-1', 10);
      const card = lookToggleBtn.closest('.admin-look-card');
      if (card && idx >= 0) {
        const nextOpen = !card.classList.contains('is-expanded');
        if (nextOpen) expandedLookIndices.add(idx);
        else expandedLookIndices.delete(idx);
        card.classList.toggle('is-expanded', nextOpen);
        const body = card.querySelector('.admin-look-collapse-body');
        if (body) body.hidden = !nextOpen;
        card.querySelectorAll('[data-look-toggle]').forEach(tog => {
          tog.setAttribute('aria-expanded', String(nextOpen));
        });
        const lbl = card.querySelector('[data-look-toggle-label]');
        if (lbl) lbl.textContent = nextOpen ? 'Tutup' : 'Edit';
        updateLookExpandAllBtn();
      }
      return;
    }

    const productSelect = e.target.closest('[data-prod-select]');
    if (productSelect) {
      const productId = productSelect.dataset.prodSelect;
      if (productId) {
        if (productSelect.checked) selectedProductIds.add(productId);
        else selectedProductIds.delete(productId);
        updateProductSelectionControls();
      }
      return;
    }

    const selectAllProducts = e.target.closest('#admin-prod-select-all');
    if (selectAllProducts) {
      const visibleIds = Array.from(dialog.querySelectorAll('.admin-prod-select')).map(input => input.dataset.prodSelect).filter(Boolean);
      visibleIds.forEach(id => {
        if (selectAllProducts.checked) selectedProductIds.add(id);
        else selectedProductIds.delete(id);
      });
      dialog.querySelectorAll('.admin-prod-select').forEach(input => { input.checked = selectAllProducts.checked; });
      updateProductSelectionControls();
      return;
    }

    const bulkDeleteProducts = e.target.closest('#admin-prod-bulk-delete');
    if (bulkDeleteProducts) {
      const selectedIds = Array.from(selectedProductIds).filter(id => workingConfig.items.some(item => item.id === id));
      if (!selectedIds.length) return;
      if (selectedIds.length >= workingConfig.items.length) {
        notify('Simpan sekurang-kurangnya satu item dalam inventori.', true);
        return;
      }
      const selectedNames = selectedIds.map(id => workingConfig.items.find(item => item.id === id)?.name).filter(Boolean);
      if (confirmMessage) confirmMessage.textContent = `${selectedIds.length} item akan dipadam daripada koleksi anda.`;
      if (confirmList) confirmList.innerHTML = selectedNames.map(name => `<div>${esc(name)}</div>`).join('');
      if (confirmModal) {
        confirmModal.dataset.selectedIds = JSON.stringify(selectedIds);
        confirmModal.hidden = false;
      }
      return;
    }

    const cancelBulkConfirm = e.target.closest('[data-bulk-cancel]');
    if (cancelBulkConfirm) { closeBulkConfirm(); return; }

    const confirmBulkDelete = e.target.closest('[data-bulk-confirm]');
    if (confirmBulkDelete) {
      const selectedIds = JSON.parse(confirmModal?.dataset.selectedIds || '[]');
      if (!selectedIds.length) { closeBulkConfirm(); return; }
      closeBulkConfirm();
      const removed = new Set(selectedIds);
      workingConfig.items = workingConfig.items.filter(item => !removed.has(item.id));
      const fallbackId = workingConfig.items[0]?.id;
      workingConfig.looks.forEach(look => {
        const oldProducts = Array.isArray(look.products) ? look.products : [];
        const oldPins = Array.isArray(look.pins) ? look.pins : [];
        const kept = oldProducts.map((id, pinIndex) => ({ id, pin: oldPins[pinIndex] })).filter(entry => !removed.has(entry.id));
        look.products = kept.length ? kept.map(entry => entry.id) : [fallbackId].filter(Boolean);
        look.pins = kept.length ? kept.map(entry => entry.pin || { ...DEFAULT_PIN_SET[0] }) : [{ ...DEFAULT_PIN_SET[0] }];
      });
      selectedProductIds.clear();
      expandedProdIds.clear();
      activeConfig = JSON.parse(JSON.stringify(workingConfig));
      applyConfigToDOM(activeConfig);
      saveAdminConfigToDb(activeConfig).then(() => notify(`${selectedIds.length} item berjaya dipadam dan dikemas kini dalam pangkalan data.`));
      setDirty(false);
      renderAdminProducts();
      return;
    }

    const prodExpandAllBtn = e.target.closest('#admin-prod-expand-all');
    if (prodExpandAllBtn) {
      const container = document.getElementById('admin-products-container');
      const cards = Array.from(container?.querySelectorAll('.admin-product-card') || []);
      const shouldExpand = cards.some(c => !c.classList.contains('is-expanded'));
      cards.forEach(card => {
        const key = card.dataset.prodKey;
        if (!key) return;
        if (shouldExpand) expandedProdIds.add(key);
        else expandedProdIds.delete(key);
        card.classList.toggle('is-expanded', shouldExpand);
        const body = card.querySelector('.admin-prod-collapse-body');
        if (body) body.hidden = !shouldExpand;
        card.querySelectorAll('[data-prod-toggle]').forEach(tog => {
          tog.setAttribute('aria-expanded', String(shouldExpand));
        });
        const lbl = card.querySelector('[data-prod-toggle-label]');
        if (lbl) lbl.textContent = shouldExpand ? 'Tutup' : 'Edit';
      });
      updateProdExpandAllBtn();
      return;
    }

    const prodToggleBtn = e.target.closest('[data-prod-toggle]');
    if (prodToggleBtn) {
      const key = prodToggleBtn.dataset.prodToggle;
      const card = prodToggleBtn.closest('.admin-product-card');
      if (card && key) {
        const nextOpen = !card.classList.contains('is-expanded');
        if (nextOpen) expandedProdIds.add(key);
        else expandedProdIds.delete(key);
        card.classList.toggle('is-expanded', nextOpen);
        const body = card.querySelector('.admin-prod-collapse-body');
        if (body) body.hidden = !nextOpen;
        card.querySelectorAll('[data-prod-toggle]').forEach(tog => {
          tog.setAttribute('aria-expanded', String(nextOpen));
        });
        const lbl = card.querySelector('[data-prod-toggle-label]');
        if (lbl) lbl.textContent = nextOpen ? 'Tutup' : 'Edit';
        updateProdExpandAllBtn();
      }
      return;
    }

    const filterChip = e.target.closest('[data-admin-prod-filter]');
    if (filterChip) {
      prodFilter = filterChip.dataset.adminProdFilter || 'all';
      dialog.querySelectorAll('[data-admin-prod-filter]').forEach(c => c.classList.toggle('is-active', c === filterChip));
      renderAdminProducts();
      return;
    }

    const orderFilterChip = e.target.closest('[data-admin-order-filter]');
    if (orderFilterChip) {
      orderFilter = orderFilterChip.dataset.adminOrderFilter || 'all';
      dialog.querySelectorAll('[data-admin-order-filter]').forEach(c => c.classList.toggle('is-active', c === orderFilterChip));
      renderAdminOrders();
      return;
    }

    const custFilterChip = e.target.closest('[data-admin-cust-filter]');
    if (custFilterChip) {
      custFilter = custFilterChip.dataset.adminCustFilter || 'all';
      dialog.querySelectorAll('[data-admin-cust-filter]').forEach(c => c.classList.toggle('is-active', c === custFilterChip));
      renderAdminCustomers();
      return;
    }

    const custToggleBtn = e.target.closest('[data-cust-toggle]');
    if (custToggleBtn) {
      const key = custToggleBtn.dataset.custToggle;
      if (key) {
        if (expandedCustKeys.has(key)) expandedCustKeys.delete(key);
        else expandedCustKeys.add(key);
        renderAdminCustomers();
      }
      return;
    }

    const custJumpBtn = e.target.closest('[data-cust-jump-orders]');
    if (custJumpBtn) {
      orderViewMode = 'orders';
      orderSearch = custJumpBtn.dataset.custJumpOrders || '';
      const searchInp = document.getElementById('admin-order-search');
      if (searchInp) searchInp.value = orderSearch;
      switchAdminTab('orders');
      return;
    }

    const custDelMemberBtn = e.target.closest('[data-cust-del-member]');
    if (custDelMemberBtn) {
      const targetNorm = custDelMemberBtn.dataset.custDelMember;
      if (targetNorm) {
        try {
          deleteMember(targetNorm);
          const curUser = window.SahiraAuth?.getUser?.();
          if (curUser && curUser.phoneNorm === targetNorm) window.SahiraAuth?.logout?.();
        } catch (_) {}
        renderAdminCustomers();
        updateSidebarCounts();
        notify('Profil ahli berdaftar dipadam.');
      }
      return;
    }

    const salesPeriodChip = e.target.closest('[data-admin-sales-period]');
    if (salesPeriodChip) {
      salesPeriod = salesPeriodChip.dataset.adminSalesPeriod || 'month';
      renderAdminSales();
      return;
    }

    const saveSalesTargetBtn = e.target.closest('#admin-sales-target-save');
    if (saveSalesTargetBtn) {
      const d = Math.max(0, parseFloat(document.getElementById('admin-target-daily')?.value || '0') || 0);
      const m = Math.max(0, parseFloat(document.getElementById('admin-target-monthly')?.value || '0') || 0);
      const u = Math.max(0, parseInt(document.getElementById('admin-target-units')?.value || '0', 10) || 0);
      saveSalesTargets({ daily: d, monthly: m, monthlyUnits: u });
      renderAdminSales();
      if (activeAdminTab === 'overview') renderAdminOverview();
      notify(`Target jualan disimpan (Harian: ${money(d)}, Bulanan: ${money(m)}, Unit: ${u}).`);
      return;
    }

    const orderViewBtn = e.target.closest('#admin-order-view-mode');
    if (orderViewBtn) {
      orderViewMode = orderViewMode === 'orders' ? 'items' : 'orders';
      renderAdminOrders();
      return;
    }

    const jumpOrderSearchBtn = e.target.closest('[data-order-jump-search]');
    if (jumpOrderSearchBtn) {
      orderViewMode = 'orders';
      orderSearch = jumpOrderSearchBtn.dataset.orderJumpSearch || '';
      const searchInp = document.getElementById('admin-order-search');
      if (searchInp) searchInp.value = orderSearch;
      renderAdminOrders();
      return;
    }

    const waSaveBtn = e.target.closest('#admin-wa-save-btn');
    if (waSaveBtn) {
      const waInp = document.getElementById('admin-wa-number');
      const digits = String(waInp?.value || '').replace(/[^\d]/g, '');
      workingConfig.whatsappNumber = digits;
      activeConfig.whatsappNumber = digits;
      saveStoreConfigToDb(digits);
      if (waInp) waInp.value = digits;
      notify(digits ? `No. WhatsApp Butik (${digits}) disimpan!` : 'No. WhatsApp Butik dikosongkan.');
      return;
    }

    const toggleOrderItemBtn = e.target.closest('[data-order-item-toggle]');
    if (toggleOrderItemBtn) {
      const orderId = toggleOrderItemBtn.dataset.orderItemToggle;
      const itemIdx = parseInt(toggleOrderItemBtn.dataset.itemIdx || '-1', 10);
      const targetStatus = toggleOrderItemBtn.dataset.targetStatus || undefined;
      const updated = window.SahiraLockOrders?.toggleItemStatus(orderId, itemIdx, targetStatus);
      if (updated) {
        renderAdminOrders();
        updateSidebarCounts();
        window.SahiraAuth?.refresh?.();
        const msg = updated.status === 'paid'
          ? `"${updated.name}" ditandakan Complete Payment!`
          : (updated.status === 'unlocked'
              ? `"${updated.name}" di-unlock.`
              : `"${updated.name}" di-lock (tempoh 24 jam ditetapkan).`);
        notify(msg);
      }
      return;
    }

    const markAllPaidBtn = e.target.closest('[data-order-mark-all-paid]');
    if (markAllPaidBtn) {
      const orderId = markAllPaidBtn.dataset.orderMarkAllPaid;
      if (window.SahiraLockOrders?.markOrderPaid(orderId)) {
        renderAdminOrders();
        updateSidebarCounts();
        window.SahiraAuth?.refresh?.();
        notify('Semua item dalam tempahan ditandakan Complete Payment!');
      }
      return;
    }

    const deductStockBtn = e.target.closest('[data-order-item-deduct]');
    if (deductStockBtn) {
      const orderId = deductStockBtn.dataset.orderItemDeduct;
      const itemIdx = parseInt(deductStockBtn.dataset.itemIdx || '-1', 10);
      const ord = window.SahiraLockOrders?.getOrders().find(o => o.id === orderId);
      const ordItem = ord?.items?.[itemIdx];
      const catItem = ordItem ? workingConfig.items.find(x => x.id === ordItem.id) : null;
      if (ordItem && catItem) {
        catItem.stock = Math.max(0, Number(catItem.stock ?? 0) - ordItem.qty);
        const activeCatItem = activeConfig.items.find(x => x.id === ordItem.id);
        if (activeCatItem) activeCatItem.stock = catItem.stock;
        window.SahiraLockOrders.markItemStockDeducted(orderId, itemIdx);
        saveAdminConfigToDb(activeConfig);
        applyConfigToDOM(activeConfig);
        renderAdminOrders();
        updateSidebarCounts();
        notify(`Stok "${catItem.name}" ditolak ${ordItem.qty} unit (Baki: ${catItem.stock}).`);
      }
      return;
    }

    const delOrderBtn = e.target.closest('[data-order-del]');
    if (delOrderBtn) {
      const orderId = delOrderBtn.dataset.orderDel;
      window.SahiraLockOrders?.deleteOrder(orderId);
      renderAdminOrders();
      updateSidebarCounts();
      window.SahiraAuth?.refresh?.();
      notify('Rekod tempahan dipadam.');
      return;
    }

    const sizeToggleChip = e.target.closest('[data-size-toggle]');
    if (sizeToggleChip) {
      const idx = parseInt(sizeToggleChip.dataset.idx, 10);
      const sz = sizeToggleChip.dataset.sizeToggle;
      const item = workingConfig.items[idx];
      if (!item || !sz) return;
      const cur = normalizeSizes(item.sizes, item.category);
      if (cur.includes(sz)) {
        if (cur.length <= 1) {
          notify('Minimum 1 saiz mesti aktif untuk item ini.');
          return;
        }
        item.sizes = cur.filter(s => s !== sz);
      } else {
        item.sizes = [...cur, sz];
      }
      const sizeInput = dialog.querySelector(`[data-prod-field="sizes"][data-idx="${idx}"]`);
      const chipWrap = dialog.querySelector(`[data-prod-size-chips="${idx}"]`);
      const sizeLbl = dialog.querySelector(`[data-prod-size-count="${idx}"]`);
      if (sizeInput) sizeInput.value = item.sizes.join(', ');
      if (chipWrap) chipWrap.innerHTML = buildSizeChipsHtml(item.sizes, item.category, 'data-size-toggle', idx);
      if (sizeLbl) sizeLbl.textContent = `(${item.sizes.length} dipilih)`;
      syncProdCardSummary(idx);
      setDirty(true);
      return;
    }

    const newSizeChip = e.target.closest('[data-new-size-toggle]');
    if (newSizeChip) {
      const sz = newSizeChip.dataset.newSizeToggle;
      const sizesEl = document.getElementById('new-prod-sizes');
      if (!sizesEl || !sz) return;
      const cur = parseSizeList(sizesEl.value);
      let next;
      if (cur.includes(sz)) {
        if (cur.length <= 1) {
          notify('Minimum 1 saiz mesti aktif.');
          return;
        }
        next = cur.filter(s => s !== sz);
      } else {
        next = [...cur, sz];
      }
      sizesEl.value = next.join(', ');
      renderNewProdSizeChips();
      return;
    }

    const brandChip = e.target.closest('[data-brand-pick]');
    if (brandChip) {
      const idx = parseInt(brandChip.dataset.idx, 10);
      const brand = brandChip.dataset.brandPick;
      const item = workingConfig.items[idx];
      if (!item || !brand) return;
      item.type = brand;
      const typeInput = dialog.querySelector(`[data-prod-field="type"][data-idx="${idx}"]`);
      const chipWrap = dialog.querySelector(`[data-prod-brand-chips="${idx}"]`);
      if (typeInput) typeInput.value = brand;
      if (chipWrap) chipWrap.innerHTML = buildBrandChipsHtml(brand, item.category, 'data-brand-pick', idx);
      syncProdCardSummary(idx);
      setDirty(true);
      return;
    }

    const newBrandChip = e.target.closest('[data-new-brand-pick]');
    if (newBrandChip) {
      const brand = newBrandChip.dataset.newBrandPick;
      const typeEl = document.getElementById('new-prod-type');
      if (!typeEl || !brand) return;
      typeEl.value = brand;
      renderNewProdBrandChips();
      return;
    }

    const qtyBtn = e.target.closest('[data-qty-delta]');
    if (qtyBtn) {
      const idx = parseInt(qtyBtn.dataset.idx, 10);
      const delta = parseInt(qtyBtn.dataset.qtyDelta, 10);
      const item = workingConfig.items[idx];
      if (!item) return;
      item.stock = Math.max(0, Number(item.stock ?? 0) + delta);
      dialog.querySelectorAll(`.admin-qty-input[data-idx="${idx}"]`).forEach(inp => {
        inp.value = String(item.stock);
      });
      dialog.querySelectorAll(`[data-stock-badge="${idx}"]`).forEach(badge => {
        badge.innerHTML = stockBadgeHtml(item.stock);
      });
      setDirty(true);
      return;
    }

    const moveBtn = e.target.closest('[data-look-move]');
    if (moveBtn) {
      const idx = parseInt(moveBtn.dataset.idx, 10);
      const dir = parseInt(moveBtn.dataset.lookMove, 10);
      const next = idx + dir;
      if (next >= 0 && next < workingConfig.looks.length) {
        const tmp = workingConfig.looks[idx];
        workingConfig.looks[idx] = workingConfig.looks[next];
        workingConfig.looks[next] = tmp;
        const wasIdxExpanded = expandedLookIndices.has(idx);
        const wasNextExpanded = expandedLookIndices.has(next);
        if (wasNextExpanded) expandedLookIndices.add(idx); else expandedLookIndices.delete(idx);
        if (wasIdxExpanded) expandedLookIndices.add(next); else expandedLookIndices.delete(next);
        workingConfig.reels.forEach(r => {
          if (r.lookIndex === idx) r.lookIndex = next;
          else if (r.lookIndex === next) r.lookIndex = idx;
        });
        setDirty(true);
        renderAdminLooks();
      }
      return;
    }

    const delLookBtn = e.target.closest('[data-look-del]');
    if (delLookBtn && workingConfig.looks.length > 1) {
      const idx = parseInt(delLookBtn.dataset.lookDel, 10);
      workingConfig.looks.splice(idx, 1);
      const shiftedExpanded = Array.from(expandedLookIndices)
        .filter(n => n !== idx)
        .map(n => (n > idx ? n - 1 : n));
      expandedLookIndices.clear();
      shiftedExpanded.forEach(n => expandedLookIndices.add(n));
      workingConfig.reels.forEach(r => {
        if (r.lookIndex === idx) r.lookIndex = 0;
        else if (r.lookIndex > idx) r.lookIndex -= 1;
      });
      setDirty(true);
      renderAdminLooks();
      return;
    }

    const delProdBtn = e.target.closest('[data-prod-del]');
    if (delProdBtn && workingConfig.items.length > 1) {
      const idx = parseInt(delProdBtn.dataset.prodDel, 10);
      const removedId = workingConfig.items[idx].id;
      workingConfig.items.splice(idx, 1);
      const fallbackId = workingConfig.items[0].id;
      workingConfig.looks.forEach(lk => {
        const oldProds = Array.isArray(lk.products) ? lk.products : [];
        const oldPins = Array.isArray(lk.pins) ? lk.pins : [];
        const keptProds = [];
        const keptPins = [];
        oldProds.forEach((pid, pIdx) => {
          if (pid !== removedId) {
            keptProds.push(pid);
            keptPins.push(oldPins[pIdx] || { ...DEFAULT_PIN_SET[pIdx % MAX_LOOK_PINS] });
          }
        });
        lk.products = keptProds.length ? keptProds : [fallbackId];
        lk.pins = keptPins.length ? keptPins : [{ ...DEFAULT_PIN_SET[0] }];
      });
      setDirty(true);
      renderAdminProducts();
      return;
    }

    const delVidBtn = e.target.closest('[data-vid-del]');
    if (delVidBtn && workingConfig.reels.length > 1) {
      const idx = parseInt(delVidBtn.dataset.vidDel, 10);
      workingConfig.reels.splice(idx, 1);
      setDirty(true);
      renderAdminVideos();
      return;
    }

    if (e.target === dialog) {
      closeAllProductPickers();
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeAdmin();
      return;
    }

    const pickerToggle = e.target.closest('[data-picker-toggle]');
    if (pickerToggle) {
      const picker = pickerToggle.closest('[data-prod-picker]');
      const wasOpen = picker.classList.contains('is-open');
      closeAllProductPickers();
      if (!wasOpen) {
        picker.classList.add('is-open');
        picker.closest('.admin-look-card, .admin-video-card, .admin-creator-drawer')?.classList.add('is-picker-open');
        picker.closest('.admin-pin-slot, .admin-form-group')?.classList.add('is-picker-open');
        pickerToggle.setAttribute('aria-expanded', 'true');
        const menu = picker.querySelector('.admin-picker-menu');
        if (menu) {
          menu.hidden = false;
          menu.classList.remove('open-up', 'align-right');
          const scrollWrap = dialog.querySelector('.admin-main-scroll');
          const wrapRect = (scrollWrap || dialog).getBoundingClientRect();
          const trigRect = pickerToggle.getBoundingClientRect();
          if (trigRect.bottom + 275 > wrapRect.bottom && trigRect.top - 275 > wrapRect.top) {
            menu.classList.add('open-up');
          }
          if (trigRect.left + 275 > wrapRect.right) {
            menu.classList.add('align-right');
          }
          const searchInp = menu.querySelector('[data-picker-search]');
          if (searchInp) {
            searchInp.value = '';
            menu.querySelectorAll('[data-picker-choose]').forEach(opt => { opt.hidden = false; });
            requestAnimationFrame(() => searchInp.focus());
          }
        }
      }
      return;
    }

    const pickerChoice = e.target.closest('[data-picker-choose]');
    if (pickerChoice) {
      const picker = pickerChoice.closest('[data-prod-picker]');
      const chosenId = pickerChoice.dataset.pickerChoose || '';
      const hiddenInp = picker.querySelector('input[type="hidden"]');
      if (hiddenInp) hiddenInp.value = chosenId;

      const trig = picker.querySelector('[data-picker-toggle]');
      if (picker.dataset.pickerKind === 'look') {
        const chosenIdx = Math.min(Math.max(0, workingConfig.looks.length - 1), Math.max(0, parseInt(chosenId, 10) || 0));
        const chosenLook = workingConfig.looks[chosenIdx];
        if (trig && chosenLook) trig.innerHTML = renderLookThumbPickerTrigger(chosenLook, chosenIdx);
      } else {
        const chosenProd = chosenId ? workingConfig.items.find(it => it.id === chosenId) || null : null;
        if (trig) trig.innerHTML = renderProductPickerTriggerContent(chosenProd);
      }

      picker.querySelectorAll('[data-picker-choose]').forEach(opt => {
        const isSel = opt === pickerChoice;
        opt.classList.toggle('is-selected', isSel);
        const existingCheck = opt.querySelector('.admin-picker-opt-check');
        if (isSel && !existingCheck) {
          opt.insertAdjacentHTML('beforeend', '<span class="admin-picker-opt-check" aria-hidden="true">✓</span>');
        } else if (!isSel && existingCheck) {
          existingCheck.remove();
        }
      });

      if (picker.dataset.pickerKind === 'look') {
        if (picker.dataset.videoIdx !== undefined) {
          const vIdx = parseInt(picker.dataset.videoIdx, 10);
          const chosenIdx = Math.min(Math.max(0, workingConfig.looks.length - 1), Math.max(0, parseInt(chosenId, 10) || 0));
          const reel = workingConfig.reels[vIdx];
          if (reel) {
            reel.lookIndex = chosenIdx;
            const box = document.getElementById('admin-vid-box-' + vIdx);
            const lk = workingConfig.looks[chosenIdx] || workingConfig.looks[0];
            if (box && !reel.videoUrl) {
              box.innerHTML = `<img src="${esc(lk?.src || '')}" alt="${esc(lk?.name || '')}"><span class="admin-preview-badge">MOTION</span>`;
            }
            setDirty(true);
          }
        }
        closeAllProductPickers();
        return;
      }

      if (picker.dataset.lookIdx !== undefined) {
        const idx = parseInt(picker.dataset.lookIdx, 10);
        const slotIdx = parseInt(picker.dataset.slot || '0', 10);
        const lk = workingConfig.looks[idx];
        const card = picker.closest('[data-look-idx]');
        if (lk && card) {
          const prodInputs = Array.from(card.querySelectorAll('[data-look-prod]'));
          const picks = prodInputs.map(inp => inp.value || '').filter(Boolean);
          lk.products = picks.length ? picks.slice(0, MAX_LOOK_PINS) : [workingConfig.items[0]?.id].filter(Boolean);
          prodInputs.forEach((inp, s) => {
            const dot = card.querySelector(`[data-preview-pin-pick="${s}"]`);
            if (dot) dot.hidden = !(inp.value || '');
          });
          setActivePinSlot(card, slotIdx);
          syncLookCardSummary(idx);
          setDirty(true);
        }
      } else if (picker.dataset.newSlot !== undefined) {
        const newIdx = Math.max(0, parseInt(picker.dataset.newSlot, 10) - 1);
        if (chosenId) newLookDraftProds[newIdx] = chosenId;
      }

      closeAllProductPickers();
      return;
    }

    const addPinBtn = e.target.closest('[data-pin-add]');
    if (addPinBtn) {
      const idx = parseInt(addPinBtn.dataset.pinAdd, 10);
      const card = addPinBtn.closest('[data-look-idx]');
      if (card) syncSingleLookCardFromDOM(card, idx);
      addPinToLook(idx, { openPicker: true });
      return;
    }

    const saveLookBtn = e.target.closest('[data-look-save]');
    if (saveLookBtn) {
      const idx = parseInt(saveLookBtn.dataset.lookSave, 10);
      commitAndPublish({ keepOpen: true, sourceLookIdx: idx });
      return;
    }

    const removePinBtn = e.target.closest('[data-pin-remove]');
    if (removePinBtn) {
      const idx = parseInt(removePinBtn.dataset.idx, 10);
      const slot = parseInt(removePinBtn.dataset.pinRemove, 10);
      const card = removePinBtn.closest('[data-look-idx]');
      if (card) syncSingleLookCardFromDOM(card, idx);
      removePinFromLook(idx, slot);
      return;
    }

    const addNewPinBtn = e.target.closest('[data-new-pin-add]');
    if (addNewPinBtn) {
      if (newLookDraftProds.length < MAX_LOOK_PINS && workingConfig.items.length) {
        const unused = workingConfig.items.find(it => !newLookDraftProds.includes(it.id)) || workingConfig.items[0];
        if (unused) newLookDraftProds.push(unused.id);
        populateNewLookProductSelects();
      }
      return;
    }

    const removeNewPinBtn = e.target.closest('[data-new-pin-remove]');
    if (removeNewPinBtn) {
      const slotIdx = parseInt(removeNewPinBtn.dataset.newPinRemove, 10);
      if (newLookDraftProds.length > 1) {
        newLookDraftProds.splice(slotIdx, 1);
        populateNewLookProductSelects();
      }
      return;
    }

    const openStudioBtn = e.target.closest('[data-open-pin-studio]');
    if (openStudioBtn) {
      const idx = parseInt(openStudioBtn.dataset.openPinStudio, 10);
      const card = openStudioBtn.closest('[data-look-idx]');
      if (card) syncSingleLookCardFromDOM(card, idx);
      const activeSlot = parseInt(card?.dataset.activePin || '0', 10);
      openPinStudio(idx, activeSlot);
      return;
    }

    const studioAddPinBtn = e.target.closest('[data-studio-pin-add]');
    if (studioAddPinBtn && pinStudioLookIdx >= 0) {
      addPinToLook(pinStudioLookIdx, { openPicker: false });
      return;
    }

    const studioRemoveBtn = e.target.closest('[data-studio-remove]');
    if (studioRemoveBtn && pinStudioLookIdx >= 0) {
      const slot = parseInt(studioRemoveBtn.dataset.studioRemove, 10);
      removePinFromLook(pinStudioLookIdx, slot);
      return;
    }

    const studioSaveBtn = e.target.closest('[data-studio-save]');
    if (studioSaveBtn && pinStudioLookIdx >= 0) {
      commitAndPublish({ keepOpen: true, sourceLookIdx: pinStudioLookIdx });
      return;
    }

    if (e.target.closest('[data-close-pin-studio]') || e.target === pinStudioEl) {
      closePinStudio();
      return;
    }

    const studioItemRow = e.target.closest('[data-studio-item]');
    if (studioItemRow) {
      setPinStudioActiveSlot(parseInt(studioItemRow.dataset.studioItem || '0', 10));
      return;
    }

    const pinFocusBtn = e.target.closest('[data-pin-focus]');
    if (pinFocusBtn) {
      const card = pinFocusBtn.closest('[data-look-idx]');
      const slot = parseInt(pinFocusBtn.dataset.pinFocus ?? '0', 10);
      if (card) setActivePinSlot(card, slot);
      return;
    }

    if (!e.target.closest('[data-prod-picker]')) {
      closeAllProductPickers();
    }
  });

  // Smooth pointer drag & click-to-place for pins (both card preview & large Pin Studio)
  let dragPinState = null;

  dialog.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const studioPin = e.target.closest('[data-studio-pin]');
    const studioCanvas = e.target.closest('[data-studio-canvas]');
    if (studioCanvas && pinStudioLookIdx >= 0) {
      e.preventDefault();
      const slot = studioPin
        ? parseInt(studioPin.dataset.studioPin || '0', 10)
        : pinStudioActiveSlot;
      setPinStudioActiveSlot(slot);
      dragPinState = { mode: 'studio', canvas: studioCanvas, lookIdx: pinStudioLookIdx, slot, dot: studioCanvas.querySelector(`[data-studio-pin="${slot}"]`) };
      studioCanvas.classList.add('is-dragging');
      if (dragPinState.dot) dragPinState.dot.classList.add('is-dragging');
      try { studioCanvas.setPointerCapture(e.pointerId); } catch (_) {}
      const rect = studioCanvas.getBoundingClientRect();
      if (!studioPin && rect.width && rect.height) {
        applyPinCoord(pinStudioLookIdx, slot, ((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100);
      }
      return;
    }

    const cardDot = e.target.closest('[data-preview-pin-pick]');
    const cardCanvas = e.target.closest('[data-look-pin-canvas]');
    if (cardCanvas) {
      e.preventDefault();
      const idx = parseInt(cardCanvas.dataset.lookPinCanvas || '0', 10);
      const card = cardCanvas.closest('[data-look-idx]');
      const lk = workingConfig.looks[idx];
      if (!card || !lk) return;
      const slotCount = Math.max(1, Math.min(MAX_LOOK_PINS, (lk.products || []).length || 1));
      const slot = cardDot
        ? parseInt(cardDot.dataset.previewPinPick || '0', 10)
        : Math.min(slotCount - 1, Math.max(0, parseInt(card.dataset.activePin || '0', 10)));
      setActivePinSlot(card, slot);
      dragPinState = { mode: 'card', canvas: cardCanvas, lookIdx: idx, slot, dot: cardCanvas.querySelector(`[data-preview-pin-pick="${slot}"]`) };
      if (dragPinState.dot) dragPinState.dot.classList.add('is-dragging');
      try { cardCanvas.setPointerCapture(e.pointerId); } catch (_) {}
      const rect = cardCanvas.getBoundingClientRect();
      if (!cardDot && rect.width && rect.height) {
        applyPinCoord(idx, slot, ((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100);
      }
    }
  });

  dialog.addEventListener('pointermove', e => {
    if (!dragPinState) return;
    const rect = dragPinState.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 100;
    const ny = ((e.clientY - rect.top) / rect.height) * 100;
    applyPinCoord(dragPinState.lookIdx, dragPinState.slot, nx, ny);
  });

  const endPinDrag = () => {
    if (!dragPinState) return;
    dragPinState.canvas?.classList.remove('is-dragging');
    dragPinState.dot?.classList.remove('is-dragging');
    dragPinState = null;
  };
  dialog.addEventListener('pointerup', endPinDrag);
  dialog.addEventListener('pointercancel', endPinDrag);

  dialog.addEventListener('keydown', e => {
    if (!pinStudioEl || pinStudioEl.hidden || pinStudioLookIdx < 0) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const step = e.shiftKey ? 5 : 1;
    const lk = workingConfig.looks[pinStudioLookIdx];
    const pt = lk?.pins?.[pinStudioActiveSlot] || DEFAULT_PIN_SET[pinStudioActiveSlot % MAX_LOOK_PINS];
    if (e.key === 'ArrowLeft') { e.preventDefault(); applyPinCoord(pinStudioLookIdx, pinStudioActiveSlot, pt.x - step, pt.y); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); applyPinCoord(pinStudioLookIdx, pinStudioActiveSlot, pt.x + step, pt.y); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); applyPinCoord(pinStudioLookIdx, pinStudioActiveSlot, pt.x, pt.y - step); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); applyPinCoord(pinStudioLookIdx, pinStudioActiveSlot, pt.x, pt.y + step); }
  });

  dialog.addEventListener('cancel', e => {
    if (pinStudioEl && !pinStudioEl.hidden) {
      e.preventDefault();
      closePinStudio();
      return;
    }
    if (dialog.querySelector('[data-prod-picker].is-open')) {
      e.preventDefault();
      closeAllProductPickers();
    }
  });

  dialog.addEventListener('input', e => {
    const t = e.target;
    if (t.matches('[data-picker-search]')) {
      const q = t.value.trim().toLowerCase();
      const list = t.closest('.admin-picker-menu')?.querySelector('.admin-picker-list');
      if (list) {
        let visibleCount = 0;
        list.querySelectorAll('[data-picker-choose]').forEach(opt => {
          const hay = opt.dataset.searchText || '';
          const match = !q || hay.includes(q);
          opt.hidden = !match;
          if (match) visibleCount++;
        });
        let emptyNote = list.querySelector('.admin-picker-empty');
        if (visibleCount === 0) {
          if (!emptyNote) {
            list.insertAdjacentHTML('beforeend', '<div class="admin-picker-empty">Tiada item sepadan.</div>');
          }
        } else if (emptyNote) {
          emptyNote.remove();
        }
      }
      return;
    }
    if (t.id === 'admin-look-search') { lookSearch = t.value; renderAdminLooks(); return; }
    if (t.id === 'admin-prod-search') { prodSearch = t.value; renderAdminProducts(); return; }
    if (t.id === 'admin-video-search') { videoSearch = t.value; renderAdminVideos(); return; }
    if (t.id === 'admin-order-search') { orderSearch = t.value; renderAdminOrders(); return; }
    if (t.id === 'admin-customer-search') { custSearch = t.value; renderAdminCustomers(); return; }
    if (t.id === 'admin-cust-sort') { custSort = t.value || 'recent'; renderAdminCustomers(); return; }
    if (t.id === 'admin-wa-number') { workingConfig.whatsappNumber = String(t.value || '').replace(/[^\d]/g, ''); setDirty(true); return; }

    if (t.dataset.lookField) {
      const idx = parseInt(t.dataset.idx, 10);
      const field = t.dataset.lookField;
      const lk = workingConfig.looks[idx];
      if (!lk) return;
      lk[field] = t.value;
      if (field === 'src') {
        lk.srcset = t.value ? `${t.value} 640w, ${t.value} 1080w` : '';
        const img = document.getElementById('look-preview-img-' + idx);
        if (img && t.value.trim()) img.src = t.value.trim();
      }
      syncLookCardSummary(idx);
      setDirty(true);
      return;
    }

    if (t.dataset.lookPinAxis) {
      const idx = parseInt(t.dataset.idx, 10);
      const slot = Math.min(MAX_LOOK_PINS - 1, Math.max(0, parseInt(t.dataset.slot, 10) || 0));
      const axis = t.dataset.lookPinAxis;
      const lk = workingConfig.looks[idx];
      if (!lk) return;
      const pt = lk.pins?.[slot] || DEFAULT_PIN_SET[slot % MAX_LOOK_PINS];
      const nx = axis === 'x' ? Number(t.value) : pt.x;
      const ny = axis === 'y' ? Number(t.value) : pt.y;
      const card = t.closest('[data-look-idx]');
      if (card) setActivePinSlot(card, slot);
      applyPinCoord(idx, slot, Number.isFinite(nx) ? nx : pt.x, Number.isFinite(ny) ? ny : pt.y);
      return;
    }

    if (t.dataset.studioAxis && pinStudioLookIdx >= 0) {
      const slot = Math.min(MAX_LOOK_PINS - 1, Math.max(0, parseInt(t.dataset.slot, 10) || 0));
      const axis = t.dataset.studioAxis;
      const lk = workingConfig.looks[pinStudioLookIdx];
      if (!lk) return;
      const pt = lk.pins?.[slot] || DEFAULT_PIN_SET[slot % MAX_LOOK_PINS];
      const nx = axis === 'x' ? Number(t.value) : pt.x;
      const ny = axis === 'y' ? Number(t.value) : pt.y;
      setPinStudioActiveSlot(slot);
      applyPinCoord(pinStudioLookIdx, slot, Number.isFinite(nx) ? nx : pt.x, Number.isFinite(ny) ? ny : pt.y);
      return;
    }

    if (t.id === 'admin-offer-search') { offerSearch = t.value; renderAdminOffers(); return; }

    if (t.dataset.offerField && t.dataset.offerField !== 'offerType') {
      const idx = parseInt(t.dataset.idx, 10);
      const it = workingConfig.items[idx];
      if (!it) return;
      const field = t.dataset.offerField;
      if (field === 'offerEnabled') {
        it.offerEnabled = Boolean(t.checked);
        if (it.offerEnabled && !clampDiscount(it.offerDiscount)) it.offerDiscount = 20;
        if (it.offerEnabled && !isOfferActive(it)) it.offerEndsAt = new Date(Date.now() + 86400e3).toISOString();
        commitOfferChange(idx, true);
        return;
      }
      if (field === 'offerDiscount') it.offerDiscount = clampDiscount(t.value);
      else if (field === 'offerEndsAt') {
        const d = t.value ? new Date(t.value) : null;
        it.offerEndsAt = d && Number.isFinite(d.getTime()) ? d.toISOString() : null;
      } else if (field === 'offerLabel') it.offerLabel = t.value.slice(0, 24);
      commitOfferChange(idx, false);
      return;
    }

    if (t.dataset.prodField) {
      const idx = parseInt(t.dataset.idx, 10);
      const field = t.dataset.prodField;
      const item = workingConfig.items[idx];
      if (!item) return;
      if (field === 'price') item.price = Math.max(0, parseFloat(t.value) || 0);
      else if (field === 'discount') {
        item.discount = clampDiscount(t.value);
      } else if (field === 'stock') {
        item.stock = Math.max(0, parseInt(t.value, 10) || 0);
        dialog.querySelectorAll(`[data-stock-badge="${idx}"]`).forEach(badge => {
          badge.innerHTML = stockBadgeHtml(item.stock);
        });
      } else if (field === 'sizes') {
        const parsed = parseSizeList(t.value);
        if (parsed.length) {
          item.sizes = parsed;
          const chipWrap = dialog.querySelector(`[data-prod-size-chips="${idx}"]`);
          const sizeLbl = dialog.querySelector(`[data-prod-size-count="${idx}"]`);
          if (chipWrap) chipWrap.innerHTML = buildSizeChipsHtml(item.sizes, item.category, 'data-size-toggle', idx);
          if (sizeLbl) sizeLbl.textContent = `(${item.sizes.length} dipilih)`;
        }
      } else {
        item[field] = t.value;
        if (field === 'type') {
          const brandWrap = dialog.querySelector(`[data-prod-brand-chips="${idx}"]`);
          if (brandWrap) brandWrap.innerHTML = buildBrandChipsHtml(t.value, item.category, 'data-brand-pick', idx);
        } else if (field === 'image') {
          const img = document.getElementById('prod-preview-img-' + idx);
          if (img && t.value.trim()) img.src = t.value.trim();
        }
      }
      syncProdCardSummary(idx);
      setDirty(true);
      return;
    }

    if (t.dataset.vidField) {
      const idx = parseInt(t.dataset.idx, 10);
      const field = t.dataset.vidField;
      const reel = workingConfig.reels[idx];
      if (!reel) return;
      reel[field] = field === 'lookIndex' ? (parseInt(t.value, 10) || 0) : t.value;
      if (field === 'videoUrl') {
        const box = document.getElementById('admin-vid-box-' + idx);
        const lk = workingConfig.looks[reel.lookIndex] || workingConfig.looks[0];
        if (box) {
          box.innerHTML = t.value.trim()
            ? `<video src="${esc(t.value.trim())}" muted loop playsinline autoplay></video><span class="admin-preview-badge">VIDEO</span>`
            : `<img src="${esc(lk?.src || '')}" alt=""><span class="admin-preview-badge">MOTION</span>`;
        }
      }
      setDirty(true);
    }
  });

  dialog.addEventListener('change', async e => {
    const t = e.target;
    if (t.id === 'admin-cust-sort') { custSort = t.value || 'recent'; renderAdminCustomers(); return; }
    if (t.dataset.studioProd !== undefined && pinStudioLookIdx >= 0) {
      const slot = parseInt(t.dataset.studioProd, 10);
      const lk = workingConfig.looks[pinStudioLookIdx];
      const chosenId = t.value;
      if (lk && chosenId) {
        lk.products = Array.isArray(lk.products) ? lk.products : [];
        lk.products[slot] = chosenId;
        setDirty(true);
        refreshSingleLookCard(pinStudioLookIdx, { activeSlot: slot });
        openPinStudio(pinStudioLookIdx, slot);
      }
      return;
    }

    if (t.dataset.lookProd !== undefined) {
      const idx = parseInt(t.dataset.idx, 10);
      const lk = workingConfig.looks[idx];
      if (!lk) return;
      const card = t.closest('[data-look-idx]');
      const picks = Array.from(card.querySelectorAll('[data-look-prod]')).map(inp => inp.value || '').filter(Boolean);
      lk.products = picks.length ? picks.slice(0, MAX_LOOK_PINS) : [workingConfig.items[0]?.id].filter(Boolean);
      syncLookCardSummary(idx);
      setDirty(true);
      return;
    }

    if (t.dataset.prodField === 'sizes') {
      const idx = parseInt(t.dataset.idx, 10);
      const item = workingConfig.items[idx];
      if (!item) return;
      item.sizes = normalizeSizes(t.value, item.category);
      t.value = item.sizes.join(', ');
      const chipWrap = dialog.querySelector(`[data-prod-size-chips="${idx}"]`);
      const sizeLbl = dialog.querySelector(`[data-prod-size-count="${idx}"]`);
      if (chipWrap) chipWrap.innerHTML = buildSizeChipsHtml(item.sizes, item.category, 'data-size-toggle', idx);
      if (sizeLbl) sizeLbl.textContent = `(${item.sizes.length} dipilih)`;
      syncProdCardSummary(idx);
      setDirty(true);
      return;
    }

    if (t.dataset.offerField === 'offerType') {
      const idx = parseInt(t.dataset.idx, 10);
      if (workingConfig.items[idx]) {
        workingConfig.items[idx].offerType = t.value;
        commitOfferChange(idx, false);
      }
      return;
    }

    if (t.dataset.prodField === 'category' || t.dataset.vidField === 'lookIndex' || t.dataset.vidField === 'category') {
      const idx = parseInt(t.dataset.idx, 10);
      if (t.dataset.vidField === 'lookIndex') {
        workingConfig.reels[idx].lookIndex = parseInt(t.value, 10) || 0;
        const box = document.getElementById('admin-vid-box-' + idx);
        const reel = workingConfig.reels[idx];
        const lk = workingConfig.looks[reel.lookIndex] || workingConfig.looks[0];
        if (box && !reel.videoUrl) box.innerHTML = `<img src="${esc(lk?.src || '')}" alt=""><span class="admin-preview-badge">MOTION</span>`;
      } else if (t.dataset.vidField === 'category') {
        workingConfig.reels[idx].category = normalizeCategory(t.value);
      } else if (t.dataset.prodField === 'category') {
        const nextCat = normalizeCategory(t.value);
        workingConfig.items[idx].category = nextCat;
        const chipWrap = dialog.querySelector(`[data-prod-size-chips="${idx}"]`);
        if (chipWrap) chipWrap.innerHTML = buildSizeChipsHtml(workingConfig.items[idx].sizes || [], nextCat, 'data-size-toggle', idx);
        const brandWrap = dialog.querySelector(`[data-prod-brand-chips="${idx}"]`);
        if (brandWrap) brandWrap.innerHTML = buildBrandChipsHtml(workingConfig.items[idx].type || '', nextCat, 'data-brand-pick', idx);
        syncProdCardSummary(idx);
      }
      setDirty(true);
      return;
    }

    if (t.dataset.lookFile !== undefined && t.files?.[0]) {
      const idx = parseInt(t.dataset.lookFile, 10);
      const url = await optimizeUploadedImage(t.files[0], true);
      workingConfig.looks[idx].src = url;
      workingConfig.looks[idx].srcset = `${url} 640w, ${url} 1080w`;
      const img = document.getElementById('look-preview-img-' + idx);
      const urlInput = dialog.querySelector(`[data-look-field="src"][data-idx="${idx}"]`);
      if (img) img.src = url;
      if (urlInput) urlInput.value = url;
      syncLookCardSummary(idx);
      setDirty(true);
      return;
    }

    if (t.dataset.prodFile !== undefined && t.files?.[0]) {
      const idx = parseInt(t.dataset.prodFile, 10);
      const url = await optimizeUploadedImage(t.files[0], false);
      workingConfig.items[idx].image = url;
      const img = document.getElementById('prod-preview-img-' + idx);
      const urlInput = dialog.querySelector(`[data-prod-field="image"][data-idx="${idx}"]`);
      if (img) img.src = url;
      if (urlInput) urlInput.value = url;
      syncProdCardSummary(idx);
      setDirty(true);
      return;
    }

    if (t.dataset.vidFile !== undefined && t.files?.[0]) {
      const idx = parseInt(t.dataset.vidFile, 10);
      const blobUrl = URL.createObjectURL(t.files[0]);
      workingConfig.reels[idx].videoUrl = blobUrl;
      const box = document.getElementById('admin-vid-box-' + idx);
      const urlInput = dialog.querySelector(`[data-vid-field="videoUrl"][data-idx="${idx}"]`);
      if (box) box.innerHTML = `<video src="${esc(blobUrl)}" muted loop playsinline autoplay></video><span class="admin-preview-badge">VIDEO</span>`;
      if (urlInput) urlInput.value = blobUrl;
      setDirty(true);
    }
  });

  const productCsvFields = ['id', 'name', 'type', 'category', 'price', 'discount', 'stock', 'sizes', 'image', 'url', 'isNew', 'offerEnabled', 'offerType', 'offerLabel', 'offerDiscount', 'offerEndsAt'];
  const csvCell = value => {
    const text = String(value ?? '');
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const parseCsv = text => {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
      else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') i += 1;
        row.push(cell); cell = '';
        if (row.some(value => value.trim())) rows.push(row);
        row = [];
      } else cell += char;
    }
    if (cell || row.length) { row.push(cell); if (row.some(value => value.trim())) rows.push(row); }
    if (rows.length < 2) return [];
    const headers = rows.shift().map(header => header.trim().replace(/^\uFEFF/, ''));
    return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  };
  const csvNumber = (value, fallback = 0) => {
    const number = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(number) ? number : fallback;
  };
  const exportProductsCsv = () => {
    const lines = [productCsvFields.join(',')];
    workingConfig.items.forEach(item => {
      lines.push(productCsvFields.map(field => csvCell(item[field] ?? '')).join(','));
    });
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sahira-stok-item-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify(`${workingConfig.items.length} item berjaya dimuat turun sebagai CSV.`);
  };
  const importProductsCsv = file => {
    const reader = new FileReader();
    reader.onload = event => {
      const rows = parseCsv(String(event.target?.result || ''));
      if (!rows.length || !rows.some(row => row.name?.trim())) {
        notify('CSV tidak sah. Pastikan fail mempunyai lajur name dan sekurang-kurangnya satu item.', true);
        return;
      }
      const existingById = new Map(workingConfig.items.map(item => [String(item.id), item]));
      let updated = 0;
      let added = 0;
      rows.forEach(row => {
        const name = String(row.name || '').trim();
        if (!name) return;
        const category = normalizeCategory(row.category || 'apparel');
        const id = String(row.id || '').trim() || `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'}-${Date.now().toString(36)}-${added}`;
        const current = existingById.get(id);
        const item = current || { id, name, type: 'Sahira Premium Outlet', category, price: 0, discount: 0, stock: 0, sizes: getCategoryDef(category).defaultSizes, image: '', url: '' };
        item.name = name;
        item.type = String(row.type || item.type || 'Sahira Premium Outlet').trim();
        item.category = category;
        item.price = Math.max(0, csvNumber(row.price, item.price));
        item.discount = clampDiscount(csvNumber(row.discount, item.discount));
        item.stock = Math.max(0, Math.round(csvNumber(row.stock, item.stock)));
        item.sizes = normalizeSizes(row.sizes || item.sizes, category);
        item.image = String(row.image ?? item.image ?? '').trim();
        item.url = String(row.url ?? item.url ?? '').trim();
        item.isNew = String(row.isNew ?? item.isNew ?? '').toLowerCase() === 'true';
        item.offerEnabled = ['true', '1', 'yes'].includes(String(row.offerEnabled ?? item.offerEnabled ?? '').toLowerCase());
        item.offerType = ['flash_sale', 'clearance', 'member'].includes(row.offerType) ? row.offerType : (item.offerType || 'flash_sale');
        item.offerLabel = String(row.offerLabel ?? item.offerLabel ?? '').trim().slice(0, 24);
        item.offerDiscount = clampDiscount(csvNumber(row.offerDiscount, item.offerDiscount));
        const offerDate = String(row.offerEndsAt ?? item.offerEndsAt ?? '').trim();
        item.offerEndsAt = offerDate && Number.isFinite(Date.parse(offerDate)) ? new Date(offerDate).toISOString() : null;
        if (current) updated += 1;
        else { workingConfig.items.push(item); existingById.set(id, item); added += 1; }
      });
      setDirty(true);
      renderAdminProducts();
      notify(`CSV berjaya diimport: ${updated} item dikemas kini, ${added} item baharu. Tekan Simpan & Terbit.`);
    };
    reader.onerror = () => notify('CSV tidak dapat dibaca.', true);
    reader.readAsText(file);
  };

  // Creator Drawers: Add New Outfit, New Product, New Video
  const newLookForm = document.getElementById('admin-new-look-form');
  const newProdForm = document.getElementById('admin-new-prod-form');
  const newVideoForm = document.getElementById('admin-new-video-form');

  document.getElementById('admin-add-look-toggle')?.addEventListener('click', () => { newLookForm.hidden = !newLookForm.hidden; if (!newLookForm.hidden) populateNewLookProductSelects(); });
  document.getElementById('admin-new-look-cancel')?.addEventListener('click', () => { newLookForm.hidden = true; });
  document.getElementById('admin-add-prod-toggle')?.addEventListener('click', () => { newProdForm.hidden = !newProdForm.hidden; if (!newProdForm.hidden) { renderNewProdSizeChips(); renderNewProdBrandChips(); } });
  document.getElementById('admin-new-prod-cancel')?.addEventListener('click', () => { newProdForm.hidden = true; });
  document.getElementById('admin-prod-export-csv')?.addEventListener('click', exportProductsCsv);
  document.getElementById('admin-prod-import-csv')?.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (file) importProductsCsv(file);
    event.target.value = '';
  });
  document.getElementById('admin-add-video-toggle')?.addEventListener('click', () => { newVideoForm.hidden = !newVideoForm.hidden; populateNewVideoLookSelect(); });
  document.getElementById('admin-new-video-cancel')?.addEventListener('click', () => { newVideoForm.hidden = true; });

  document.getElementById('new-look-file')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await optimizeUploadedImage(file, true);
    document.getElementById('new-look-preview-img').src = url;
    document.getElementById('new-look-src').value = url;
  });
  document.getElementById('new-look-src')?.addEventListener('input', e => {
    const val = e.target.value.trim();
    if (val) document.getElementById('new-look-preview-img').src = val;
  });
  newLookForm?.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('new-look-name').value.trim();
    const src = document.getElementById('new-look-src').value.trim() || document.getElementById('new-look-preview-img').src;
    const desc = document.getElementById('new-look-desc').value.trim();
    const prods = Array.from(newLookForm.querySelectorAll('input[id^="new-look-prod-"]'))
      .map(inp => inp.value || '')
      .filter(Boolean)
      .slice(0, MAX_LOOK_PINS);
    if (!name || !src) return;
    const finalProds = prods.length ? prods : [workingConfig.items[0].id];
    workingConfig.looks.push({
      name,
      desc: desc || name,
      src,
      srcset: `${src} 640w, ${src} 1080w`,
      products: finalProds,
      pins: finalProds.map((_, pIdx) => ({ ...DEFAULT_PIN_SET[pIdx % MAX_LOOK_PINS] }))
    });
    expandedLookIndices.add(workingConfig.looks.length - 1);
    newLookForm.reset();
    newLookDraftProds = [];
    newLookForm.hidden = true;
    setDirty(true);
    renderAdminLooks();
    notify(`Outfit "${name}" (${finalProds.length} pin) ditambah! Tekan "Simpan & Terbit" untuk auto-sync ke semua bahagian.`);
  });

  document.getElementById('new-prod-file')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await optimizeUploadedImage(file, false);
    document.getElementById('new-prod-preview-img').src = url;
    document.getElementById('new-prod-img').value = url;
  });
  document.getElementById('new-prod-img')?.addEventListener('input', e => {
    const val = e.target.value.trim();
    if (val) document.getElementById('new-prod-preview-img').src = val;
  });
  document.getElementById('new-prod-cat')?.addEventListener('change', e => {
    const cat = normalizeCategory(e.target.value);
    const sizesEl = document.getElementById('new-prod-sizes');
    if (sizesEl) sizesEl.value = getCategoryDef(cat).defaultSizes.join(', ');
    renderNewProdSizeChips();
    renderNewProdBrandChips();
  });
  document.getElementById('new-prod-type')?.addEventListener('input', renderNewProdBrandChips);
  renderNewProdBrandChips();
  document.getElementById('new-prod-sizes')?.addEventListener('input', renderNewProdSizeChips);
  document.getElementById('new-prod-sizes')?.addEventListener('change', e => {
    const cat = document.getElementById('new-prod-cat')?.value || 'apparel';
    e.target.value = normalizeSizes(e.target.value, cat).join(', ');
    renderNewProdSizeChips();
  });
  const updateNewProdSalePreview = () => {
    const pEl = document.getElementById('new-prod-price');
    const dEl = document.getElementById('new-prod-discount');
    const outEl = document.getElementById('new-prod-sale-preview');
    if (!outEl) return;
    const p = Math.max(0, parseFloat(pEl?.value) || 0);
    const d = clampDiscount(dEl?.value || 0);
    outEl.textContent = d > 0 ? `Harga jualan: ${money(getSalePrice({ price: p, discount: d }))} (-${d}%)` : 'Tiada diskaun';
    outEl.classList.toggle('is-muted', d <= 0);
  };
  document.getElementById('new-prod-price')?.addEventListener('input', updateNewProdSalePreview);
  document.getElementById('new-prod-discount')?.addEventListener('input', updateNewProdSalePreview);
  updateNewProdSalePreview();

  newProdForm?.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('new-prod-name').value.trim();
    if (!name) return;
    const category = normalizeCategory(document.getElementById('new-prod-cat').value || 'apparel');
    const type = document.getElementById('new-prod-type').value.trim() || 'Sahira Premium Outlet';
    const price = Math.max(0, parseFloat(document.getElementById('new-prod-price').value) || 0);
    const discount = clampDiscount(document.getElementById('new-prod-discount')?.value || 0);
    const stock = Math.max(0, parseInt(document.getElementById('new-prod-stock').value, 10) || 0);
    const sizes = normalizeSizes(document.getElementById('new-prod-sizes').value, category);
    const image = document.getElementById('new-prod-img').value.trim() || document.getElementById('new-prod-preview-img').src;
    const url = document.getElementById('new-prod-url').value.trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
    const newId = `${slug}-${Date.now().toString(36)}`;
    workingConfig.items.push({ id: newId, name, type, category, isNew: true, price, discount, stock, sizes, image, url });
    expandedProdIds.add(newId);
    newProdForm.reset();
    document.getElementById('new-prod-sizes').value = getCategoryDef('apparel').defaultSizes.join(', ');
    renderNewProdSizeChips();
    renderNewProdBrandChips();
    updateNewProdSalePreview();
    newProdForm.hidden = true;
    setDirty(true);
    renderAdminProducts();
    notify(`Item "${name}" ditambah! Tekan "Simpan & Terbit" untuk terbit.`);
  });

  document.getElementById('new-video-file')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingNewVideoBlob = URL.createObjectURL(file);
    document.getElementById('new-video-url').value = pendingNewVideoBlob;
    document.getElementById('new-video-preview-wrap').innerHTML = `<video src="${esc(pendingNewVideoBlob)}" muted loop playsinline autoplay></video><span class="admin-preview-badge">VIDEO</span>`;
  });
  newVideoForm?.addEventListener('submit', e => {
    e.preventDefault();
    const lookIndex = parseInt(document.getElementById('new-video-look').value || '0', 10) || 0;
    let handle = document.getElementById('new-video-handle').value.trim() || '@sahirapremiumoutlet';
    if (!handle.startsWith('@')) handle = '@' + handle;
    const category = document.getElementById('new-video-cat').value || 'apparel';
    const videoUrl = pendingNewVideoBlob || document.getElementById('new-video-url').value.trim();
    const audio = document.getElementById('new-video-audio').value.trim() || 'Original Audio — Sahira Premium Outlet';
    const caption = document.getElementById('new-video-caption').value.trim();
    workingConfig.reels.unshift({
      id: 'reel-admin-' + Date.now(),
      lookIndex,
      videoUrl,
      handle,
      verified: true,
      following: true,
      category,
      caption,
      audio,
      baseLikes: 120,
      baseSaves: 14,
      baseShares: 6,
      bgTone: ['#151514', '#2b2826'],
      comments: []
    });
    pendingNewVideoBlob = '';
    newVideoForm.reset();
    const nvl = document.getElementById('new-video-look');
    if (nvl) nvl.value = '0';
    populateNewVideoLookSelect();
    newVideoForm.hidden = true;
    document.getElementById('new-video-preview-wrap').innerHTML = '<span class="admin-video-empty-label">Motion Cut Outfit</span>';
    setDirty(true);
    renderAdminVideos();
    notify('Video Hand Rail Pro ditambah! Tekan "Simpan & Terbit" untuk siar.');
  });

  // Settings Actions
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', async () => {
      const specialUrl = getSpecialAdminUrl();
      if (specialUrlInput) specialUrlInput.value = specialUrl;
      try { await navigator.clipboard.writeText(specialUrl); notify('Pautan khas Admin disalin!'); }
      catch (_) { specialUrlInput?.select(); document.execCommand('copy'); notify('Pautan khas Admin disalin!'); }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Kembalikan semua outfit, stok item & video kepada tetapan asal Sahira Premium Outlet?')) {
        resetAdminConfigInDb();
        activeConfig = normalizeAdminConfig({ looks: DEFAULT_LOOKS, items: DEFAULT_ITEMS, reels: DEFAULT_REELS });
        workingConfig = normalizeAdminConfig(JSON.parse(JSON.stringify(activeConfig)));
        applyConfigToDOM(activeConfig);
        setDirty(false);
        switchAdminTab(activeAdminTab);
        notify('Semua data telah dikembalikan ke tetapan asal.');
      }
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(serializeConfigForStorage(workingConfig), null, 2));
      const a = document.createElement('a');
      a.setAttribute('href', dataStr);
      a.setAttribute('download', 'sahira-runway-config.json');
      document.body.appendChild(a);
      a.click();
      a.remove();
      notify('Fail konfigurasi JSON dimuat turun.');
    });
  }

  if (importInput) {
    importInput.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const imported = JSON.parse(String(ev.target?.result || ''));
          if (imported && Array.isArray(imported.looks) && Array.isArray(imported.items)) {
            workingConfig = normalizeAdminConfig(imported);
            setDirty(true);
            switchAdminTab(activeAdminTab);
            notify('Konfigurasi JSON diimport! Tekan "Simpan & Terbit".');
          } else notify('Fail JSON tidak sah.');
        } catch (_) { notify('Ralat membaca fail JSON.'); }
      };
      reader.readAsText(file);
    });
  }

  window.addEventListener('keydown', e => {
    if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') || (e.altKey && e.key.toLowerCase() === 'a')) {
      e.preventDefault();
      if (dialog.open) closeAdmin();
      else openAdmin('overview');
    }
  });

  window.SahiraAdmin = { open: openAdmin, close: closeAdmin };
  window.SahiraAdminRefreshOrders = () => {
    updateSidebarCounts();
    if (activeAdminTab === 'orders') renderAdminOrders();
    if (activeAdminTab === 'customers') renderAdminCustomers();
    if (activeAdminTab === 'sales') renderAdminSales();
    if (activeAdminTab === 'overview') renderAdminOverview();
    if (activeAdminTab === 'products') renderAdminProducts();
  };
  updateSidebarCounts();

  const checkSpecialAccess = () => {
    if (isSpecialAdminUrl()) openAdmin('overview');
    else if (!adminSessionUnlocked && floatingBtn) floatingBtn.hidden = true;
  };
  window.addEventListener('hashchange', checkSpecialAccess);
  window.addEventListener('popstate', checkSpecialAccess);
  checkSpecialAccess();
}

// ==========================================================================
// NIKE ORBIT GALLERY CONTROLLER & NAVIGATION ROUTER
// ==========================================================================
(() => {
  const LOOK_PINS = DEFAULT_LOOKS.map(l => l.pins);

  const getProdMeta = prod => {
    const stock = prod?.stock !== undefined ? Math.max(0, Number(prod.stock) || 0) : 15;
    return {
      category: prod?.category || 'apparel',
      isNew: Boolean(prod?.isNew),
      sizes: prod?.sizes || [],
      variants: buildVariantsForItem(prod),
      stock
    };
  };

  const stockNoteHtml = stock => {
    if (stock <= 0) return '<p class="orbit-stock-note is-out">Habis stok</p>';
    if (stock <= 5) return `<p class="orbit-stock-note is-low">Stok rendah: ${stock} unit</p>`;
    return `<p class="orbit-stock-note">Stok: ${stock} unit</p>`;
  };

  const getLookPins = (look, idx) => (Array.isArray(look?.pins) && look.pins.length ? look.pins : (LOOK_PINS[idx] || DEFAULT_PIN_SET));

  const money = v => { const n = Number(v) || 0; const abs = Math.abs(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return n < 0 ? `-RM ${abs}` : `RM ${abs}`; };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let currentFilter = 'all';
  let homeFilter = 'all';
  let heroLookIdx = 0;
  let currentView = 'home';
  let currentCfg = activeConfig;
  let lbState = null;

  function renderHome(cfg) {
    currentCfg = cfg || activeConfig;
    const heroStage = document.getElementById('home-hero-stage');
    const looksGrid = document.getElementById('home-looks-grid');
    const piecesGrid = document.getElementById('home-pieces-grid');
    const railPreviews = document.getElementById('home-rail-previews');
    if (!heroStage || !looksGrid || !piecesGrid) return;

    const looks = currentCfg.looks || [];
    const items = currentCfg.items || [];

    if (looks.length) {
      heroLookIdx = ((heroLookIdx % looks.length) + looks.length) % looks.length;
      const activeLook = looks[heroLookIdx];
      const pins = getLookPins(activeLook, heroLookIdx);
      const paired = (activeLook.products || []).map(pid => items.find(p => p.id === pid)).filter(Boolean);
      const origSum = paired.reduce((acc, p) => acc + getSalePrice(p), 0);
      const bundleSum = origSum * 0.9;

      heroStage.innerHTML = `
        <div class="home-stage-frame">
          <div class="home-stage-top">
            <span class="home-stage-kicker">LOOK ${String(heroLookIdx + 1).padStart(2, '0')} / ${String(looks.length).padStart(2, '0')} · ${esc(activeLook.name)}</span>
            <span class="home-stage-bundle">Bundle ${money(bundleSum)}</span>
          </div>
          <div class="home-stage-visual" data-orbit-inspect-look="${heroLookIdx}" role="button" tabindex="0" aria-label="Inspect Look ${heroLookIdx + 1}: ${esc(activeLook.name)}">
            <div class="home-stage-figure${heroLookIdx === 2 ? ' is-look-03' : ''}">
              <span class="home-stage-shadow" aria-hidden="true"></span>
              <img src="${esc(activeLook.src)}" srcset="${esc(activeLook.srcset || activeLook.src)}" sizes="(min-width: 1000px) 460px, 320px" alt="${esc(activeLook.name)}">
              <div class="rw__pins" style="display:block!important;">
                ${paired.map((prod, pIdx) => {
                  const pt = pins[pIdx] || { x: 50, y: 50 };
                  return `<button type="button" class="rw__pin${pt.x > 65 ? ' rw__pin--l' : ''}" data-orbit-inspect-look="${heroLookIdx}" data-tip="${esc(prod.name)}" style="left:${pt.x}%;top:${pt.y}%;" aria-label="${pIdx + 1}: ${esc(prod.name)}"><span class="rw__pin-dot">${pIdx + 1}</span></button>`;
                }).join('')}
              </div>
            </div>
          </div>
          <div class="home-stage-foot">
            <div class="home-stage-dots" role="tablist" aria-label="Featured looks">
              ${looks.slice(0, 4).map((l, i) => `
                <button type="button" class="home-stage-dot${i === heroLookIdx ? ' is-active' : ''}" data-home-hero-pick="${i}" role="tab" aria-selected="${i === heroLookIdx ? 'true' : 'false'}" aria-label="Preview Look ${i + 1}: ${esc(l.name)}">0${i + 1}</button>
              `).join('')}
            </div>
            <div class="home-stage-ctas">
              <button type="button" class="home-stage-inspect" data-orbit-inspect-look="${heroLookIdx}">Tap Pins &amp; Shop</button>
              <button type="button" class="home-stage-3d" data-orbit-jump-look="${heroLookIdx}">3D ↗</button>
            </div>
          </div>
        </div>
      `;
      window.SahiraCutoutFeet?.applyToFigure(heroStage.querySelector('.home-stage-figure'), activeLook.src);
    }

    looksGrid.replaceChildren();
    looks.forEach((look, idx) => {
      const paired = (look.products || []).map(pid => items.find(p => p.id === pid)).filter(Boolean);
      const origSum = paired.reduce((acc, p) => acc + getSalePrice(p), 0);
      const bundleSum = origSum * 0.9;
      const card = document.createElement('article');
      card.className = 'home-look-card';
      card.innerHTML = `
        <div class="home-look-media${idx === 2 ? ' is-look-03' : ''}" data-orbit-inspect-look="${idx}" role="button" tabindex="0" aria-label="Inspect Look ${idx + 1}: ${esc(look.name)}">
          <span class="home-look-badge">LOOK ${String(idx + 1).padStart(2, '0')}</span>
          <span class="home-look-count">${paired.length} PIECES</span>
          <img src="${esc(look.src)}" srcset="${esc(look.srcset || look.src)}" sizes="(min-width: 1100px) 360px, 280px" alt="${esc(look.name)}" loading="lazy" decoding="async">
        </div>
        <div class="home-look-info">
          <div class="home-look-row">
            <h3>${esc(look.name)}</h3>
            <span class="home-look-price"><s>${money(origSum)}</s> <strong>${money(bundleSum)}</strong></span>
          </div>
          <p class="home-look-desc">${esc(look.desc || '')}</p>
          <div class="home-look-thumbs" data-count="${paired.length}">
            ${paired.map((prod, pIdx) => `
              <button type="button" class="home-mini-piece" data-orbit-open-piece="${esc(prod.id)}" title="${esc(prod.name)}" aria-label="${pIdx + 1}: ${esc(prod.name)}">
                <span>${pIdx + 1}</span>
                <img src="${esc(prod.image)}" alt="${esc(prod.name)}" loading="lazy" decoding="async">
              </button>
            `).join('')}
          </div>
          <div class="home-look-btns">
            <button type="button" class="home-card-btn-primary" data-orbit-inspect-look="${idx}">Inspect Look</button>
            <button type="button" class="home-card-btn-secondary" data-orbit-jump-look="${idx}">3D Runway ↗</button>
          </div>
        </div>
      `;
      looksGrid.appendChild(card);
    });

    const filteredItems = items.filter(it => {
      if (homeFilter === 'all') return true;
      return getProdMeta(it).category === normalizeCategory(homeFilter);
    });

    piecesGrid.replaceChildren();
    filteredItems.forEach((prod) => {
      const globalIdx = items.findIndex(x => x.id === prod.id);
      const meta = getProdMeta(prod);
      const soldOut = meta.stock <= 0;
      const firstVariant = meta.variants[0];
      const card = document.createElement('article');
      card.className = 'orbit-piece-card home-piece-card';
      card.innerHTML = `
        <div class="orbit-piece-media" data-orbit-open-piece="${esc(prod.id)}" role="button" tabindex="0" aria-label="Zoom ${esc(prod.name)}">
          ${meta.isNew ? '<span class="orbit-piece-tag">New</span>' : ''}
          <span class="orbit-piece-idx">${String(globalIdx + 1).padStart(2, '0')}</span>
          <img src="${esc(prod.image)}" alt="${esc(prod.name)}" loading="lazy" decoding="async">
        </div>
        <div class="orbit-piece-vendor">${esc(prod.type)}</div>
        <div class="orbit-piece-title-row">
          <h3 class="orbit-piece-name" data-orbit-open-piece="${esc(prod.id)}">${esc(prod.name)}</h3>
          <span class="orbit-piece-price">${formatItemPriceHtml(prod)}</span>
        </div>
        ${stockNoteHtml(meta.stock)}
        <div class="orbit-piece-sizes" role="radiogroup" aria-label="Size for ${esc(prod.name)}">
          ${meta.variants.map((v, vIdx) => `
            <button type="button" class="orbit-size-pill${vIdx === 0 ? ' is-selected' : ''}" data-orbit-size-pill data-variant-id="${v.id}" aria-pressed="${vIdx === 0 ? 'true' : 'false'}">${esc(v.o)}</button>
          `).join('')}
        </div>
        <div class="orbit-piece-actions">
          <button type="button" class="orbit-add-btn" data-orbit-add-piece data-variant-id="${firstVariant ? firstVariant.id : ''}" ${soldOut ? 'disabled' : ''}>
            ${soldOut ? 'Sold out' : 'Add to bag'}
          </button>
          <button type="button" class="orbit-share-btn" data-share-item="${esc(prod.id)}" title="Kongsi / Salin link item untuk mudah di-lock" aria-label="Salin link ${esc(prod.name)}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
        </div>
        <button type="button" class="orbit-lock-btn" data-orbit-lock-piece data-variant-id="${firstVariant ? firstVariant.id : ''}" ${soldOut ? 'disabled' : ''}>
          ${soldOut ? 'Habis stok' : '🔒 Lock Item Terus'}
        </button>
      `;
      piecesGrid.appendChild(card);
    });

    if (railPreviews) {
      const reelsSource = Array.isArray(currentCfg.reels) && currentCfg.reels.length ? currentCfg.reels : DEFAULT_REELS;
      const sortedReels = [...reelsSource].sort((a, b) => (b.videoUrl ? 1 : 0) - (a.videoUrl ? 1 : 0)).slice(0, 3);
      const compactNum = n => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(n || 0));
      railPreviews.innerHTML = sortedReels.map(item => {
        const lk = looks[item.lookIndex] || looks[0];
        if (!lk) return '';
        const label = item.caption || lk.name;
        return `
          <button type="button" class="home-reel-thumb" data-home-nav="rail" aria-label="Watch ${esc(label)}">
            ${item.videoUrl
              ? `<video src="${esc(item.videoUrl)}" autoplay muted loop playsinline preload="metadata"></video><span class="home-reel-badge">VIDEO</span>`
              : `<img src="${esc(lk.src)}" alt="${esc(lk.name)}" loading="lazy" decoding="async">`
            }
            <span class="home-reel-scrim" aria-hidden="true"></span>
            <span class="home-reel-play" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </span>
            <span class="home-reel-meta">
              <strong>${esc(item.handle)} · ${compactNum(item.baseLikes)}</strong>
              <span>${esc(label)}</span>
            </span>
          </button>
        `;
      }).join('');
    }
  }

  function showPageMobileChrome(autoHideDelay = 4000) {
    if (!document.body.classList.contains('is-page-view')) return;
    document.body.classList.remove('is-page-chrome-hidden');
    clearTimeout(window._pageChromeTimer);
    if (!window.matchMedia('(max-width: 749px)').matches) return;
    window._pageChromeTimer = setTimeout(() => {
      if (!document.body.classList.contains('is-page-view')) return;
      if (document.querySelector('.site-header [aria-expanded="true"]')) {
        showPageMobileChrome(3000);
        return;
      }
      document.body.classList.add('is-page-chrome-hidden');
    }, autoHideDelay);
  }

  function setView(view, options = {}) {
    const homeEl = document.getElementById('sahira-home');
    const runwayEl = document.querySelector('runway-section');
    const galleryEl = document.getElementById('nike-orbit-gallery');
    const railEl = document.getElementById('hand-rail-pro');
    if (!runwayEl || !galleryEl) return;

    currentView = (view === 'orbit' || view === 'rail' || view === 'runway') ? view : 'home';
    const isHome = currentView === 'home';
    const isOrbit = currentView === 'orbit';
    const isRail = currentView === 'rail';
    const isRunway = currentView === 'runway';

    if (homeEl) homeEl.hidden = !isHome;
    runwayEl.hidden = !isRunway;
    galleryEl.hidden = !isOrbit;
    if (railEl) railEl.hidden = !isRail;

    document.body.classList.toggle('is-runway-view', isRunway);
    document.body.classList.toggle('is-rail-view', isRail);
    document.body.classList.toggle('is-page-view', isHome || isOrbit);
    if (isHome || isOrbit) {
      requestAnimationFrame(() => showPageMobileChrome(900));
    } else {
      document.body.classList.remove('is-page-chrome-hidden');
      clearTimeout(window._pageChromeTimer);
    }
    if (!isRunway) {
      document.body.classList.remove('is-runway-chrome-hidden');
      clearTimeout(window._runwayChromeTimer);
    }
    if (!isRail) {
      document.body.classList.remove('is-rail-chrome-hidden');
      clearTimeout(window._railChromeTimer);
    }

    document.querySelectorAll('.site-header nav a[data-nav-view]').forEach(link => {
      const target = link.getAttribute('data-nav-view');
      let isActiveLink = false;
      if (isHome) isActiveLink = target === 'home';
      else if (isOrbit) isActiveLink = target === 'orbit';
      else if (isRail) isActiveLink = target === 'rail';
      else isActiveLink = target === 'runway';
      if (isActiveLink) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    if (!isRunway && runwayEl.playing && typeof runwayEl.play === 'function') {
      runwayEl.play(false);
    }
    if (!isRail && window.HandRailPro && typeof window.HandRailPro.pauseAll === 'function') {
      window.HandRailPro.pauseAll();
    }

    if (isHome) {
      renderHome(currentCfg);
      if (!options.skipHash && (window.location.hash === '#our-gallery' || window.location.hash === '#nike-orbit' || window.location.hash === '#hand-rail-pro' || window.location.hash === '#runway')) {
        try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (_) { window.location.hash = ''; }
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else if (isOrbit) {
      renderGallery(currentCfg);
      if (!options.skipHash && window.location.hash !== '#our-gallery') {
        try { history.replaceState(null, '', '#our-gallery'); } catch (_) { window.location.hash = 'our-gallery'; }
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else if (isRail) {
      if (!options.skipHash && window.location.hash !== '#hand-rail-pro') {
        try { history.replaceState(null, '', '#hand-rail-pro'); } catch (_) { window.location.hash = 'hand-rail-pro'; }
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
      if (window.HandRailPro && typeof window.HandRailPro.activate === 'function') {
        window.HandRailPro.activate();
      }
      const scheduleRailHide = (delayMs = 1100) => {
        clearTimeout(window._railChromeTimer);
        if (!window.matchMedia('(max-width: 749px)').matches) return;
        window._railChromeTimer = setTimeout(() => {
          if (!document.body.classList.contains('is-rail-view')) return;
          if (document.querySelector('.site-header [aria-expanded="true"]')) {
            scheduleRailHide(2500);
            return;
          }
          document.body.classList.add('is-rail-chrome-hidden');
        }, delayMs);
      };
      document.body.classList.remove('is-rail-chrome-hidden');
      requestAnimationFrame(() => scheduleRailHide(900));
    } else {
      if (!options.skipHash && window.location.hash !== '#runway') {
        try { history.replaceState(null, '', '#runway'); } catch (_) { window.location.hash = 'runway'; }
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
      const scheduleRunwayHide = (delayMs = 1100) => {
        clearTimeout(window._runwayChromeTimer);
        if (!window.matchMedia('(max-width: 749px)').matches) return;
        window._runwayChromeTimer = setTimeout(() => {
          if (!document.body.classList.contains('is-runway-view')) return;
          if (document.querySelector('.site-header [aria-expanded="true"]')) {
            scheduleRunwayHide(2500);
            return;
          }
          document.body.classList.add('is-runway-chrome-hidden');
          setTimeout(() => { if (typeof runwayEl.measure === 'function') runwayEl.measure(); }, 320);
        }, delayMs);
      };
      document.body.classList.remove('is-runway-chrome-hidden');
      requestAnimationFrame(() => {
        if (typeof runwayEl.measure === 'function') runwayEl.measure();
        if (typeof options.lookIndex === 'number' && typeof runwayEl.go === 'function') {
          runwayEl.go(options.lookIndex);
        }
        if (typeof runwayEl.kick === 'function') runwayEl.kick();
        if (runwayEl.dataset.autoplay === 'true' && !runwayEl.reduce && !runwayEl.engaged && typeof runwayEl.play === 'function') {
          runwayEl.play(true);
        }
        scheduleRunwayHide(900);
      });
    }
  }

  function renderGallery(cfg) {
    currentCfg = cfg || activeConfig;
    const looksGrid = document.getElementById('orbit-looks-grid');
    const piecesGrid = document.getElementById('orbit-pieces-grid');
    const looksSection = document.getElementById('orbit-looks-section');
    const piecesSection = document.getElementById('orbit-pieces-section');
    if (!looksGrid || !piecesGrid || !looksSection || !piecesSection) return;

    const looks = currentCfg.looks || [];
    const items = currentCfg.items || [];

    const setTxt = (sel, val) => { const el = document.querySelector(sel); if (el) el.textContent = val; };
    setTxt('[data-count-all]', String(looks.length + items.length).padStart(2, '0'));
    setTxt('[data-count-looks]', String(looks.length).padStart(2, '0'));
    CATEGORY_DEFS.forEach(c => {
      const cnt = items.filter(it => getProdMeta(it).category === c.key).length;
      setTxt(`[data-count-${c.key}]`, String(cnt).padStart(2, '0'));
    });

    const showLooks = currentFilter === 'all' || currentFilter === 'looks';
    const showPieces = currentFilter !== 'looks';

    looksSection.hidden = !showLooks;
    piecesSection.hidden = !showPieces;

    const filteredItems = items.filter(it => {
      if (currentFilter === 'all' || currentFilter === 'looks') return true;
      return getProdMeta(it).category === normalizeCategory(currentFilter);
    });

    const totalVisible = (showLooks ? looks.length : 0) + (showPieces ? filteredItems.length : 0);
    setTxt('[data-orbit-count]', `${String(totalVisible).padStart(2, '0')} ITEMS · 01—${String(looks.length).padStart(2, '0')}`);
    setTxt('[data-orbit-looks-meta]', `${String(looks.length).padStart(2, '0')} LOOKS · TAP TO INSPECT PINS`);
    setTxt('[data-orbit-pieces-meta]', `${String(filteredItems.length).padStart(2, '0')} PIECES · SELECT SIZE TO ADD`);

    looksGrid.replaceChildren();
    if (showLooks) {
      looks.forEach((look, idx) => {
        const pairedProducts = (look.products || []).map(pid => items.find(p => p.id === pid)).filter(Boolean);
        const origSum = pairedProducts.reduce((acc, p) => acc + getSalePrice(p), 0);
        const bundleSum = origSum * 0.9;

        const card = document.createElement('article');
        card.className = 'orbit-look-card';
        card.innerHTML = `
          <div class="orbit-look-top">
            <span>LOOK ${String(idx + 1).padStart(2, '0')}</span>
            <span>${pairedProducts.length} PIECES</span>
          </div>
          <div class="orbit-look-stage" data-orbit-inspect-look="${idx}" role="button" tabindex="0" aria-label="Inspect Look ${idx + 1}: ${esc(look.name)}">
            <div class="orbit-look-figure${idx === 2 ? ' is-look-03' : ''}">
              <span class="orbit-look-shadow" aria-hidden="true"></span>
              <img src="${esc(look.src)}" srcset="${esc(look.srcset || look.src)}" sizes="(min-width: 1100px) 360px, 280px" alt="${esc(look.name)}" loading="lazy" decoding="async">
            </div>
            <span class="orbit-stage-pill">Inspect Look + Pins</span>
          </div>
          <div class="orbit-look-body">
            <div class="orbit-look-heading">
              <div>
                <h3 class="orbit-look-name">${esc(look.name)}</h3>
                <p class="orbit-look-desc">${esc(look.desc || '')}</p>
              </div>
              <div class="orbit-look-bundle">
                <s>${money(origSum)}</s>
                <strong>${money(bundleSum)}</strong>
              </div>
            </div>
            <div class="orbit-look-thumbs">
              ${pairedProducts.map((prod, pIdx) => `
                <button type="button" class="orbit-mini-thumb" data-orbit-open-piece="${esc(prod.id)}" aria-label="View ${esc(prod.name)}" title="${esc(prod.name)}">
                  <span class="orbit-mini-num">${pIdx + 1}</span>
                  <img src="${esc(prod.image)}" alt="${esc(prod.name)}" loading="lazy" decoding="async">
                </button>
              `).join('')}
            </div>
            <div class="orbit-look-actions">
              <button type="button" class="orbit-btn-primary" data-orbit-inspect-look="${idx}">
                <span>Inspect Look</span>
              </button>
              <button type="button" class="orbit-btn-secondary" data-orbit-jump-look="${idx}" title="Buka dalam 3D Runway">
                <span>3D Runway ↗</span>
              </button>
            </div>
          </div>
        `;
        window.SahiraCutoutFeet?.applyToFigure(card.querySelector('.orbit-look-figure'), look.src);
        looksGrid.appendChild(card);
      });
    }

    piecesGrid.replaceChildren();
    if (showPieces) {
      filteredItems.forEach((prod) => {
        const globalIdx = items.findIndex(x => x.id === prod.id);
        const meta = getProdMeta(prod);
        const soldOut = meta.stock <= 0;
        const usedInCount = looks.filter(l => (l.products || []).includes(prod.id)).length;
        const firstVariant = meta.variants[0];

        const card = document.createElement('article');
        card.className = 'orbit-piece-card';
        card.dataset.pieceId = prod.id;
        card.innerHTML = `
          <div class="orbit-piece-media" data-orbit-open-piece="${esc(prod.id)}" role="button" tabindex="0" aria-label="Zoom ${esc(prod.name)}">
            ${meta.isNew ? '<span class="orbit-piece-tag">New</span>' : ''}
            <span class="orbit-piece-idx">${String(globalIdx + 1).padStart(2, '0')}</span>
            <img src="${esc(prod.image)}" alt="${esc(prod.name)}" loading="lazy" decoding="async">
          </div>
          <div class="orbit-piece-vendor">${esc(prod.type)}</div>
          <div class="orbit-piece-title-row">
            <h3 class="orbit-piece-name" data-orbit-open-piece="${esc(prod.id)}">${esc(prod.name)}</h3>
            <span class="orbit-piece-price">${formatItemPriceHtml(prod)}</span>
          </div>
          <p class="orbit-piece-looks-note">Styled in ${usedInCount} ${usedInCount === 1 ? 'look' : 'looks'}</p>
          ${stockNoteHtml(meta.stock)}
          <div class="orbit-piece-sizes" role="radiogroup" aria-label="Size for ${esc(prod.name)}">
            ${meta.variants.map((v, vIdx) => `
              <button type="button" class="orbit-size-pill${vIdx === 0 ? ' is-selected' : ''}" data-orbit-size-pill data-variant-id="${v.id}" aria-pressed="${vIdx === 0 ? 'true' : 'false'}">${esc(v.o)}</button>
            `).join('')}
          </div>
          <div class="orbit-piece-actions">
            <button type="button" class="orbit-add-btn" data-orbit-add-piece data-variant-id="${firstVariant ? firstVariant.id : ''}" ${soldOut ? 'disabled' : ''}>
              ${soldOut ? 'Sold out' : 'Add to bag'}
            </button>
            <button type="button" class="orbit-share-btn" data-share-item="${esc(prod.id)}" title="Kongsi / Salin link item untuk mudah di-lock" aria-label="Salin link ${esc(prod.name)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
          </div>
          <button type="button" class="orbit-lock-btn" data-orbit-lock-piece data-variant-id="${firstVariant ? firstVariant.id : ''}" ${soldOut ? 'disabled' : ''}>
            ${soldOut ? 'Habis stok' : '🔒 Lock Item Terus'}
          </button>
        `;
        piecesGrid.appendChild(card);
      });
    }

    const openLbDlg = document.getElementById('orbit-lightbox');
    if (openLbDlg && openLbDlg.open && lbState) {
      openLightbox(lbState.type, lbState.index);
    }
  }

  const syncItemQueryInUrl = prodId => {
    if (document.getElementById('admin-dialog')?.open) return;
    try {
      const u = new URL(window.location.href);
      if (u.hash && u.hash.startsWith('#item=')) u.hash = '';
      if (prodId) u.searchParams.set('item', String(prodId));
      else u.searchParams.delete('item');
      const next = u.pathname + u.search + u.hash;
      if (next !== window.location.pathname + window.location.search + window.location.hash) {
        history.replaceState(null, '', next);
      }
    } catch (_) {}
  };

  function openLightbox(type, indexOrId, options = {}) {
    const dlg = document.getElementById('orbit-lightbox');
    const shell = document.getElementById('orbit-lb-shell');
    if (!dlg || !shell) return;

    const looks = currentCfg.looks || [];
    const items = currentCfg.items || [];

    if (type === 'look') {
      if (!looks.length) return;
      if (!options.skipUrlSync) syncItemQueryInUrl('');
      const idx = ((Number(indexOrId) % looks.length) + looks.length) % looks.length;
      lbState = { type: 'look', index: idx };
      const look = looks[idx];
      const pins = getLookPins(look, idx);
      const pairedProducts = (look.products || []).map(pid => items.find(p => p.id === pid)).filter(Boolean);
      const origSum = pairedProducts.reduce((acc, p) => acc + getSalePrice(p), 0);
      const bundleSum = origSum * 0.9;

      shell.innerHTML = `
        <div class="orbit-lb-stage">
          <span class="orbit-lb-kicker">OUR GALLERY · LOOK ${String(idx + 1).padStart(2, '0')} / ${String(looks.length).padStart(2, '0')}</span>
          <button type="button" class="orbit-lb-nav orbit-lb-prev" data-lb-nav="-1" aria-label="Previous look">‹</button>
          <div class="orbit-lb-figure">
            <img src="${esc(look.src)}" srcset="${esc(look.srcset || look.src)}" alt="${esc(look.name)}">
            <div class="rw__pins" style="display:block!important;">
              ${pairedProducts.map((prod, pIdx) => {
                const pt = pins[pIdx] || { x: 50, y: 50 };
                return `<button type="button" class="rw__pin${pt.x > 65 ? ' rw__pin--l' : ''}" data-lb-pin="${pIdx + 1}" data-tip="${esc(prod.name)}" style="left:${pt.x}%;top:${pt.y}%" aria-label="${pIdx + 1}: ${esc(prod.name)}"><span class="rw__pin-dot">${pIdx + 1}</span></button>`;
              }).join('')}
            </div>
          </div>
          <button type="button" class="orbit-lb-nav orbit-lb-next" data-lb-nav="1" aria-label="Next look">›</button>
        </div>
        <div class="orbit-lb-panel">
          <div class="orbit-lb-panel-head">
            <div style="min-width:0;flex:1 1 auto;">
              <div class="orbit-eyebrow" style="margin-bottom:6px;">LOOK ${String(idx + 1).padStart(2, '0')}</div>
              <h2 style="margin:0 0 4px;font-size:20px;font-weight:400;">${esc(look.name)}</h2>
              <p style="margin:0;font-size:12px;color:#66625c;">${esc(look.desc || '')}</p>
            </div>
            <button type="button" class="orbit-lb-close" data-lb-close aria-label="Close">×</button>
          </div>
          <div class="orbit-lb-panel-body">
            ${pairedProducts.map((prod, pIdx) => {
              const meta = getProdMeta(prod);
              const soldOut = meta.stock <= 0;
              const firstVar = meta.variants[0];
              return `
                <div class="orbit-lb-item-row" data-lb-row="${pIdx + 1}">
                  <div class="orbit-lb-item-thumb">
                    <span class="orbit-mini-num">${pIdx + 1}</span>
                    <img src="${esc(prod.image)}" alt="${esc(prod.name)}">
                  </div>
                  <div style="min-width:0;max-width:100%;">
                    <div class="orbit-piece-vendor">${esc(prod.type)}</div>
                    <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:4px 8px;margin-bottom:4px;">
                      <strong style="font-size:13px;font-weight:500;cursor:pointer;min-width:0;" data-orbit-open-piece="${esc(prod.id)}">${esc(prod.name)}</strong>
                      <span style="font-size:12px;white-space:nowrap;">${formatItemPriceHtml(prod)}</span>
                    </div>
                    ${stockNoteHtml(meta.stock)}
                    <div class="orbit-piece-sizes" style="margin-bottom:8px;">
                      ${meta.variants.map((v, vIdx) => `
                        <button type="button" class="orbit-size-pill${vIdx === 0 ? ' is-selected' : ''}" data-lb-size-pill data-variant-id="${v.id}">${esc(v.o)}</button>
                      `).join('')}
                    </div>
                    <div class="orbit-lb-row-btns">
                      <button type="button" class="orbit-btn-secondary" style="min-height:34px;flex:1 1 auto;font-size:11px;padding:0 10px;" data-lb-add-one data-variant-id="${firstVar ? firstVar.id : ''}" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Sold out' : '+ Add piece'}</button>
                      <button type="button" class="orbit-btn-primary" style="min-height:34px;flex:0 0 auto;font-size:11px;padding:0 12px;" data-lb-lock-one data-variant-id="${firstVar ? firstVar.id : ''}" ${soldOut ? 'disabled' : ''}>🔒 Lock</button>
                      <button type="button" class="orbit-share-btn orbit-share-btn-sm" data-share-item="${esc(prod.id)}" title="Salin link item" aria-label="Salin link ${esc(prod.name)}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          <div class="orbit-lb-panel-foot">
            <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:4px 10px;">
              <span style="font-size:12px;color:#66625c;">Complete look bundle (Save 10%)</span>
              <span style="font-variant-numeric:tabular-nums;white-space:nowrap;"><s style="font-size:11px;color:#66625c;margin-right:6px;">${money(origSum)}</s><strong style="font-size:16px;font-weight:500;">${money(bundleSum)}</strong></span>
            </div>
            <button type="button" class="orbit-btn-primary" data-lb-add-bundle>Add full look to bag</button>
            <button type="button" class="orbit-btn-secondary" data-orbit-jump-look="${idx}">Open Look ${String(idx + 1).padStart(2, '0')} in 3D Runway ↗</button>
          </div>
        </div>
      `;
    } else {
      if (!items.length) return;
      const idx = typeof indexOrId === 'string'
        ? Math.max(0, items.findIndex(p => p.id === indexOrId || String(p.id).toLowerCase() === String(indexOrId).toLowerCase()))
        : ((Number(indexOrId) % items.length) + items.length) % items.length;
      lbState = { type: 'piece', index: idx };
      const prod = items[idx];
      const meta = getProdMeta(prod);
      const soldOut = meta.stock <= 0;
      const firstVar = meta.variants[0];
      const urlValid = prod.url && /^https?:\/\//i.test(prod.url);
      const shareUrl = getItemShareUrl(prod.id);
      const canNativeShare = typeof navigator.share === 'function';
      const wornIn = looks.map((l, lIdx) => ({ l, lIdx })).filter(x => (x.l.products || []).includes(prod.id));
      if (!options.skipUrlSync) syncItemQueryInUrl(prod.id);

      shell.innerHTML = `
        <div class="orbit-lb-stage is-piece">
          <span class="orbit-lb-kicker">SAHIRA PIECE · ${String(idx + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}</span>
          <button type="button" class="orbit-lb-nav orbit-lb-prev" data-lb-nav="-1" aria-label="Previous piece">‹</button>
          <img class="orbit-lb-piece-img" src="${esc(prod.image)}" alt="${esc(prod.name)}">
          <button type="button" class="orbit-lb-nav orbit-lb-next" data-lb-nav="1" aria-label="Next piece">›</button>
        </div>
        <div class="orbit-lb-panel">
          <div class="orbit-lb-panel-head">
            <div style="min-width:0;flex:1 1 auto;">
              <div class="orbit-eyebrow" style="margin-bottom:6px;">${esc(meta.category.toUpperCase())} · ${esc(prod.type)}</div>
              <h2 style="margin:0 0 4px;font-size:22px;font-weight:400;">${esc(prod.name)}</h2>
              <p style="margin:0 0 4px;font-size:15px;font-weight:500;">${formatItemPriceHtml(prod)}</p>
              ${stockNoteHtml(meta.stock)}
            </div>
            <button type="button" class="orbit-lb-close" data-lb-close aria-label="Close">×</button>
          </div>
          <div class="orbit-lb-panel-body">
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Pilih Saiz</div>
            <div class="orbit-piece-sizes" style="margin-bottom:18px;">
              ${meta.variants.map((v, vIdx) => `
                <button type="button" class="orbit-size-pill${vIdx === 0 ? ' is-selected' : ''}" data-lb-size-pill data-variant-id="${v.id}">${esc(v.o)}</button>
              `).join('')}
            </div>
            <button type="button" class="orbit-btn-primary" style="width:100%;margin-bottom:8px;" data-lb-lock-one data-variant-id="${firstVar ? firstVar.id : ''}" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Habis Stok' : '🔒 Lock Item Sekarang (24 Jam)'}</button>
            <button type="button" class="orbit-btn-secondary" style="width:100%;margin-bottom:12px;" data-lb-add-one data-variant-id="${firstVar ? firstVar.id : ''}" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Sold out' : '+ Add to bag'}</button>
            ${urlValid ? `<a href="${esc(prod.url)}" target="_blank" rel="noopener noreferrer" class="orbit-btn-secondary" style="width:100%;margin-bottom:12px;">View original piece ↗</a>` : ''}

            <div class="orbit-lb-share-box">
              <div class="orbit-lb-share-head">
                <span class="orbit-eyebrow" style="margin:0;">Kongsi Link Item Ini</span>
                <span class="orbit-lb-share-hint">Buka terus item &amp; Lock</span>
              </div>
              <div class="orbit-lb-share-url-row">
                <input type="text" class="orbit-lb-share-input" readonly value="${esc(shareUrl)}" aria-label="Pautan kongsi ${esc(prod.name)}" onclick="this.select()">
                <button type="button" class="orbit-lb-share-copy" data-share-item="${esc(prod.id)}">Salin Link</button>
              </div>
              <div class="orbit-lb-share-actions">
                <button type="button" class="orbit-lb-share-wa" data-share-item-wa="${esc(prod.id)}">Kongsi ke WhatsApp</button>
                ${canNativeShare ? `<button type="button" class="orbit-lb-share-native" data-share-item-native="${esc(prod.id)}">Kongsi Lain...</button>` : ''}
              </div>
            </div>

            ${wornIn.length ? `
              <div class="orbit-lb-worn-in">
                <span class="orbit-eyebrow">Styled In Runway Looks</span>
                ${wornIn.map(({ l, lIdx }) => `
                  <button type="button" class="orbit-lb-worn-chip" data-orbit-inspect-look="${lIdx}">
                    <span><strong>LOOK ${String(lIdx + 1).padStart(2, '0')}</strong> · ${esc(l.name)}</span>
                    <span>Inspect →</span>
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    if (!dlg.open) dlg.showModal();
  }

  function bindOrbitEvents() {
    document.querySelectorAll('.site-header nav a[data-nav-view], .site-header a.brand').forEach(link => {
      link.addEventListener('click', e => {
        const target = link.getAttribute('data-nav-view') || 'home';
        e.preventDefault();
        setView(target);
      });
    });

    const homeEl = document.getElementById('sahira-home');
    if (homeEl) {
      homeEl.addEventListener('click', async e => {
        const navBtn = e.target.closest('[data-home-nav]');
        if (navBtn) {
          e.preventDefault();
          setView(navBtn.getAttribute('data-home-nav') || 'home');
          return;
        }
        if (e.target.closest('[data-home-open-bag]')) {
          document.getElementById('open-bag')?.click();
          return;
        }
        if (e.target.closest('[data-home-open-admin]')) {
          window.SahiraAdmin?.open('overview');
          return;
        }
        const pickBtn = e.target.closest('[data-home-hero-pick]');
        if (pickBtn) {
          heroLookIdx = parseInt(pickBtn.getAttribute('data-home-hero-pick') || '0', 10);
          renderHome(currentCfg);
          return;
        }
        const filterBtn = e.target.closest('[data-home-filter]');
        if (filterBtn) {
          homeFilter = filterBtn.getAttribute('data-home-filter') || 'all';
          homeEl.querySelectorAll('[data-home-filter]').forEach(b => {
            const on = b === filterBtn;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
          });
          renderHome(currentCfg);
          return;
        }
        const jumpLook = e.target.closest('[data-orbit-jump-look]');
        if (jumpLook) {
          const idx = parseInt(jumpLook.getAttribute('data-orbit-jump-look') || '0', 10);
          setView('runway', { lookIndex: idx });
          return;
        }
        const openPiece = e.target.closest('[data-orbit-open-piece]');
        if (openPiece) {
          openLightbox('piece', openPiece.getAttribute('data-orbit-open-piece'));
          return;
        }
        const inspectLook = e.target.closest('[data-orbit-inspect-look]');
        if (inspectLook) {
          openLightbox('look', parseInt(inspectLook.getAttribute('data-orbit-inspect-look') || '0', 10));
          return;
        }
        const sizePill = e.target.closest('[data-orbit-size-pill]');
        if (sizePill) {
          const card = sizePill.closest('.orbit-piece-card');
          if (card) {
            card.querySelectorAll('[data-orbit-size-pill]').forEach(p => {
              const on = p === sizePill;
              p.classList.toggle('is-selected', on);
              p.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            const vid = sizePill.getAttribute('data-variant-id') || '';
            const addBtn = card.querySelector('[data-orbit-add-piece]');
            if (addBtn) {
              addBtn.setAttribute('data-variant-id', vid);
              addBtn.classList.remove('is-added');
              addBtn.textContent = 'Add to bag';
            }
            const lockBtn = card.querySelector('[data-orbit-lock-piece]');
            if (lockBtn) {
              lockBtn.setAttribute('data-variant-id', vid);
            }
          }
          return;
        }
        const lockPieceBtn = e.target.closest('[data-orbit-lock-piece]');
        if (lockPieceBtn) {
          const vid = Number(lockPieceBtn.getAttribute('data-variant-id'));
          if (!vid || !window.RunwayBag?.lockNow) return;
          lockPieceBtn.disabled = true;
          try {
            await window.RunwayBag.lockNow(vid);
          } catch (_) {
            showShareToast('Gagal lock item. Sila cuba semula.');
          } finally {
            lockPieceBtn.disabled = false;
          }
          return;
        }
        const addPieceBtn = e.target.closest('[data-orbit-add-piece]');
        if (addPieceBtn) {
          const vid = Number(addPieceBtn.getAttribute('data-variant-id'));
          if (!vid || !window.RunwayBag) return;
          addPieceBtn.disabled = true;
          addPieceBtn.textContent = 'Adding...';
          try {
            await window.RunwayBag.add([{ id: vid, quantity: 1 }]);
            addPieceBtn.classList.add('is-added');
            addPieceBtn.textContent = 'Added to bag ✓';
          } catch (_) {
            addPieceBtn.textContent = 'Try again';
          } finally {
            addPieceBtn.disabled = false;
          }
        }
      });

      homeEl.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const target = e.target.closest('[data-orbit-inspect-look], [data-orbit-open-piece]');
        if (target && target.tagName !== 'BUTTON') {
          e.preventDefault();
          target.click();
        }
      });
    }

    const galleryEl = document.getElementById('nike-orbit-gallery');
    if (galleryEl) {
      galleryEl.addEventListener('click', async e => {
        const filterBtn = e.target.closest('[data-orbit-filter]');
        if (filterBtn) {
          currentFilter = filterBtn.getAttribute('data-orbit-filter') || 'all';
          galleryEl.querySelectorAll('[data-orbit-filter]').forEach(b => {
            const on = b === filterBtn;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
          });
          renderGallery(currentCfg);
          return;
        }

        if (e.target.closest('[data-orbit-to-runway]')) {
          setView('runway');
          return;
        }

        const jumpLook = e.target.closest('[data-orbit-jump-look]');
        if (jumpLook) {
          const idx = parseInt(jumpLook.getAttribute('data-orbit-jump-look') || '0', 10);
          setView('runway', { lookIndex: idx });
          return;
        }

        const openPiece = e.target.closest('[data-orbit-open-piece]');
        if (openPiece) {
          openLightbox('piece', openPiece.getAttribute('data-orbit-open-piece'));
          return;
        }

        const inspectLook = e.target.closest('[data-orbit-inspect-look]');
        if (inspectLook) {
          openLightbox('look', parseInt(inspectLook.getAttribute('data-orbit-inspect-look') || '0', 10));
          return;
        }

        const sizePill = e.target.closest('[data-orbit-size-pill]');
        if (sizePill) {
          const card = sizePill.closest('.orbit-piece-card');
          if (card) {
            card.querySelectorAll('[data-orbit-size-pill]').forEach(p => {
              const on = p === sizePill;
              p.classList.toggle('is-selected', on);
              p.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            const vid = sizePill.getAttribute('data-variant-id') || '';
            const addBtn = card.querySelector('[data-orbit-add-piece]');
            if (addBtn) {
              addBtn.setAttribute('data-variant-id', vid);
              addBtn.classList.remove('is-added');
              addBtn.textContent = 'Add to bag';
            }
            const lockBtn = card.querySelector('[data-orbit-lock-piece]');
            if (lockBtn) {
              lockBtn.setAttribute('data-variant-id', vid);
            }
          }
          return;
        }

        const lockPieceBtn = e.target.closest('[data-orbit-lock-piece]');
        if (lockPieceBtn) {
          const vid = Number(lockPieceBtn.getAttribute('data-variant-id'));
          if (!vid || !window.RunwayBag?.lockNow) return;
          lockPieceBtn.disabled = true;
          try {
            await window.RunwayBag.lockNow(vid);
          } catch (_) {
            showShareToast('Gagal lock item. Sila cuba semula.');
          } finally {
            lockPieceBtn.disabled = false;
          }
          return;
        }

        const addPieceBtn = e.target.closest('[data-orbit-add-piece]');
        if (addPieceBtn) {
          const vid = Number(addPieceBtn.getAttribute('data-variant-id'));
          if (!vid || !window.RunwayBag) return;
          addPieceBtn.disabled = true;
          addPieceBtn.textContent = 'Adding...';
          try {
            await window.RunwayBag.add([{ id: vid, quantity: 1 }]);
            addPieceBtn.classList.add('is-added');
            addPieceBtn.textContent = 'Added to bag ✓';
          } catch (_) {
            addPieceBtn.textContent = 'Try again';
          } finally {
            addPieceBtn.disabled = false;
          }
        }
      });

      galleryEl.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const target = e.target.closest('[data-orbit-inspect-look], [data-orbit-open-piece]');
        if (target && target.tagName !== 'BUTTON') {
          e.preventDefault();
          target.click();
        }
      });
    }

    const lbDlg = document.getElementById('orbit-lightbox');
    if (lbDlg) {
      lbDlg.addEventListener('click', async e => {
        if (e.target === lbDlg) {
          lbDlg.close();
          return;
        }
        if (e.target.closest('[data-lb-close]')) {
          lbDlg.close();
          return;
        }
        const nav = e.target.closest('[data-lb-nav]');
        if (nav && lbState) {
          const delta = parseInt(nav.getAttribute('data-lb-nav') || '0', 10);
          openLightbox(lbState.type, lbState.index + delta);
          return;
        }
        const jump = e.target.closest('[data-orbit-jump-look]');
        if (jump) {
          const idx = parseInt(jump.getAttribute('data-orbit-jump-look') || '0', 10);
          lbDlg.close();
          setView('runway', { lookIndex: idx });
          return;
        }
        const inspectLook = e.target.closest('[data-orbit-inspect-look]');
        if (inspectLook) {
          openLightbox('look', parseInt(inspectLook.getAttribute('data-orbit-inspect-look') || '0', 10));
          return;
        }
        const openPiece = e.target.closest('[data-orbit-open-piece]');
        if (openPiece) {
          openLightbox('piece', openPiece.getAttribute('data-orbit-open-piece'));
          return;
        }
        const pin = e.target.closest('[data-lb-pin]');
        if (pin) {
          const n = pin.getAttribute('data-lb-pin');
          lbDlg.querySelectorAll('.is-hot').forEach(el => el.classList.remove('is-hot'));
          pin.classList.add('is-hot');
          const row = lbDlg.querySelector(`[data-lb-row="${n}"]`);
          if (row) {
            row.classList.add('is-hot');
            row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          return;
        }
        const sizePill = e.target.closest('[data-lb-size-pill]');
        if (sizePill) {
          const scope = sizePill.closest('.orbit-lb-item-row') || sizePill.closest('.orbit-lb-panel-body');
          if (scope) {
            scope.querySelectorAll('[data-lb-size-pill]').forEach(p => p.classList.toggle('is-selected', p === sizePill));
            const vid = sizePill.getAttribute('data-variant-id') || '';
            const addBtn = scope.querySelector('[data-lb-add-one]');
            if (addBtn) {
              addBtn.setAttribute('data-variant-id', vid);
              addBtn.textContent = addBtn.textContent.includes('piece') ? '+ Add piece' : '+ Add to bag';
            }
            const lockBtn = scope.querySelector('[data-lb-lock-one]');
            if (lockBtn) {
              lockBtn.setAttribute('data-variant-id', vid);
            }
          }
          return;
        }
        const lockOne = e.target.closest('[data-lb-lock-one]');
        if (lockOne) {
          const vid = Number(lockOne.getAttribute('data-variant-id'));
          if (!vid || !window.RunwayBag?.lockNow) return;
          lockOne.disabled = true;
          try {
            await window.RunwayBag.lockNow(vid);
          } catch (_) {
            showShareToast('Gagal lock item. Sila pilih saiz yang tersedia.');
          } finally {
            lockOne.disabled = false;
          }
          return;
        }
        const addOne = e.target.closest('[data-lb-add-one]');
        if (addOne) {
          const vid = Number(addOne.getAttribute('data-variant-id'));
          if (!vid || !window.RunwayBag) return;
          addOne.disabled = true;
          try {
            await window.RunwayBag.add([{ id: vid, quantity: 1 }]);
            addOne.textContent = 'Saved to bag ✓';
          } catch (_) {
            addOne.textContent = 'Select available size';
          } finally {
            addOne.disabled = false;
          }
          return;
        }
        const addBundle = e.target.closest('[data-lb-add-bundle]');
        if (addBundle) {
          const ids = Array.from(lbDlg.querySelectorAll('[data-lb-add-one]'))
            .map(b => Number(b.getAttribute('data-variant-id')))
            .filter(id => Number.isSafeInteger(id) && id > 0)
            .map(id => ({ id, quantity: 1 }));
          if (!ids.length || !window.RunwayBag) return;
          addBundle.disabled = true;
          addBundle.textContent = 'Saving full look...';
          try {
            await window.RunwayBag.add(ids);
            addBundle.textContent = 'Full look saved to bag ✓';
          } catch (_) {
            addBundle.textContent = 'Add full look to bag';
          } finally {
            addBundle.disabled = false;
          }
        }
      });

      lbDlg.addEventListener('close', () => {
        syncItemQueryInUrl('');
      });

      lbDlg.addEventListener('mouseover', e => {
        const row = e.target.closest('[data-lb-row]');
        if (row) {
          const n = row.getAttribute('data-lb-row');
          lbDlg.querySelectorAll('.is-hot').forEach(el => el.classList.remove('is-hot'));
          row.classList.add('is-hot');
          const pin = lbDlg.querySelector(`[data-lb-pin="${n}"]`);
          if (pin) pin.classList.add('is-hot');
        }
      });

      lbDlg.addEventListener('keydown', e => {
        if (!lbDlg.open || !lbState) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); openLightbox(lbState.type, lbState.index - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); openLightbox(lbState.type, lbState.index + 1); }
      });
    }

    const getSharedItemParam = () => {
      try {
        const q = new URLSearchParams(window.location.search).get('item');
        if (q) return q.trim();
        if (window.location.hash && window.location.hash.startsWith('#item=')) {
          return decodeURIComponent(window.location.hash.slice(6)).trim();
        }
      } catch (_) {}
      return '';
    };

    const syncFromHash = () => {
      if (window.location.hash === '#our-gallery' || window.location.hash === '#nike-orbit') setView('orbit', { skipHash: true });
      else if (window.location.hash === '#hand-rail-pro') setView('rail', { skipHash: true });
      else if (window.location.hash === '#runway') setView('runway', { skipHash: true });
      else setView('home', { skipHash: true });

      const sharedItemId = getSharedItemParam();
      if (sharedItemId) {
        const items = currentCfg.items || [];
        const matched = items.find(p => p.id === sharedItemId)
          || items.find(p => String(p.id).toLowerCase() === sharedItemId.toLowerCase());
        if (matched) {
          openLightbox('piece', matched.id, { skipUrlSync: true });
        }
      }
    };
    const showRunwayMobileChrome = (autoHideDelay = 4000) => {
      if (!document.body.classList.contains('is-runway-view')) return;
      document.body.classList.remove('is-runway-chrome-hidden');
      const rw = document.querySelector('runway-section');
      setTimeout(() => { if (rw && typeof rw.measure === 'function') rw.measure(); }, 320);
      clearTimeout(window._runwayChromeTimer);
      if (window.matchMedia('(max-width: 749px)').matches) {
        window._runwayChromeTimer = setTimeout(() => {
          if (!document.body.classList.contains('is-runway-view')) return;
          if (document.querySelector('.site-header [aria-expanded="true"]')) {
            showRunwayMobileChrome(3000);
            return;
          }
          document.body.classList.add('is-runway-chrome-hidden');
          setTimeout(() => { if (rw && typeof rw.measure === 'function') rw.measure(); }, 320);
        }, autoHideDelay);
      }
    };

    const showRailMobileChrome = (autoHideDelay = 4000) => {
      if (!document.body.classList.contains('is-rail-view')) return;
      document.body.classList.remove('is-rail-chrome-hidden');
      clearTimeout(window._railChromeTimer);
      if (window.matchMedia('(max-width: 749px)').matches) {
        window._railChromeTimer = setTimeout(() => {
          if (!document.body.classList.contains('is-rail-view')) return;
          if (document.querySelector('.site-header [aria-expanded="true"]')) {
            showRailMobileChrome(3000);
            return;
          }
          document.body.classList.add('is-rail-chrome-hidden');
        }, autoHideDelay);
      }
    };

    const hideRailMobileChrome = () => {
      if (!document.body.classList.contains('is-rail-view')) return;
      if (!window.matchMedia('(max-width: 749px)').matches) return;
      clearTimeout(window._railChromeTimer);
      if (!document.body.classList.contains('is-rail-chrome-hidden')) {
        document.body.classList.add('is-rail-chrome-hidden');
      }
    };

    document.querySelector('[data-runway-show-chrome]')?.addEventListener('click', e => {
      e.stopPropagation();
      showRunwayMobileChrome(4500);
    });
    document.querySelector('[data-runway-open-bag]')?.addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('open-bag')?.click();
    });
    document.querySelector('[data-page-show-chrome]')?.addEventListener('click', e => {
      e.stopPropagation();
      showPageMobileChrome(4500);
    });
    document.querySelector('[data-page-open-bag]')?.addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('open-bag')?.click();
    });
    document.querySelector('[data-rail-show-chrome]')?.addEventListener('click', e => {
      e.stopPropagation();
      showRailMobileChrome(4500);
    });
    document.querySelector('[data-rail-open-bag]')?.addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('open-bag')?.click();
    });
    document.querySelector('.site-header')?.addEventListener('pointerdown', () => {
      if (document.body.classList.contains('is-runway-view') && !document.body.classList.contains('is-runway-chrome-hidden')) {
        showRunwayMobileChrome(5000);
      }
      if (document.body.classList.contains('is-rail-view') && !document.body.classList.contains('is-rail-chrome-hidden')) {
        showRailMobileChrome(5000);
      }
      if (document.body.classList.contains('is-page-view') && !document.body.classList.contains('is-page-chrome-hidden')) {
        showPageMobileChrome(5000);
      }
    }, { passive: true });
    const railAppEl = document.getElementById('hand-rail-pro');
    railAppEl?.addEventListener('pointerdown', e => {
      if (e.target.closest('#rail-mobile-topbar, .rail-topbar')) return;
      hideRailMobileChrome();
    }, { passive: true });

    window.showRailMobileChrome = showRailMobileChrome;
    window.hideRailMobileChrome = hideRailMobileChrome;

    const railFeedEl = document.getElementById('rail-feed');
    let lastFeedScrollY = 0;
    railFeedEl?.addEventListener('scroll', () => {
      if (!document.body.classList.contains('is-rail-view')) return;
      if (!window.matchMedia('(max-width: 749px)').matches) return;
      const y = railFeedEl.scrollTop;
      if (y < lastFeedScrollY - 32) {
        window.showRailMobileChrome?.(4000);
        lastFeedScrollY = y;
      } else if (y > lastFeedScrollY) {
        lastFeedScrollY = y;
      }
    }, { passive: true });

    window.addEventListener('hashchange', syncFromHash);
    window.addEventListener('popstate', syncFromHash);
    syncFromHash();
  }

  window.HomeView = {
    render: renderHome
  };

  window.OrbitGallery = {
    render: renderGallery,
    setView,
    openLightbox
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindOrbitEvents);
  } else {
    bindOrbitEvents();
  }
})();

// ==========================================================================
// HAND RAIL PRO — TIKTOK-STYLE VIDEO FEED, COMMENTS & SHOPPABLE REELS
// ==========================================================================
(() => {
  const RAIL_STORAGE_KEY = 'hand_rail_pro_social_v1';
  const REEL_DURATION = 10.5; // seconds per curated motion reel

  const money = v => { const n = Number(v) || 0; const abs = Math.abs(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return n < 0 ? `-RM ${abs}` : `RM ${abs}`; };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const compactNum = n => {
    const v = Number(n) || 0;
    if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(v);
  };
  const fmtTime = s => {
    const sec = Math.max(0, Math.floor(s || 0));
    return `00:${String(sec).padStart(2, '0')}`;
  };

  function loadSocialState() {
    const cached = getReelSocialCache();
    return {
      likedReels: cached.likedReels || {},
      savedReels: cached.savedReels || {},
      followedHandles: cached.followedHandles || {},
      likedComments: cached.likedComments || {},
      commentsByReel: cached.commentsByReel || {},
      customReels: cached.customReels || []
    };
  }

  let socialState = loadSocialState();
  function saveSocialState() {
    // No-op: social state is persisted via individual toggle functions to Supabase
  }

  // Session-only custom reels (supports temporary Blob URL uploads cleanly)
  let sessionCustomReels = (socialState.customReels || []).slice();

  let currentFeedFilter = 'all';
  let currentDrawerTab = 'comments';
  let currentCommentSort = 'top';
  let activeReelIndex = 0;
  let activeReelId = 'reel-look-4';
  let replyTarget = null; // { commentId, author }
  let isMuted = true;
  let playbackRate = 1;
  let autoNext = false;
  let railCfg = activeConfig;
  let imageCache = new Map();
  let playerLoops = new Map(); // reelId -> controller
  let activeObserver = null;

  // Web Audio minimalist runway groove generator for unmuted canvas reels
  let audioCtx = null;
  let beatTimer = null;
  let beatStep = 0;
  function startAmbientBeat() {
    if (isMuted || beatTimer) return;
    window.SahiraCafeAudio?.duckForMedia?.(true);
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const notes = [110, 110, 130.81, 98];
      beatTimer = setInterval(() => {
        if (isMuted || !audioCtx) return;
        const activeCtrl = playerLoops.get(activeReelId);
        if (!activeCtrl || !activeCtrl.playing || activeCtrl.isRealVideo) return;
        const now = audioCtx.currentTime;
        // Soft sub kick on downbeat
        if (beatStep % 2 === 0) {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(notes[(beatStep / 2) % notes.length], now);
          osc.frequency.exponentialRampToValueAtTime(48, now + 0.18);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.23);
        } else {
          // Crisp minimalist hi-hat tick
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(880, now);
          gain.gain.setValueAtTime(0.015, now);
          gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.045);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.05);
        }
        beatStep++;
      }, Math.round(280 / playbackRate));
    } catch (_) {}
  }

  function stopAmbientBeat() {
    if (beatTimer) {
      clearInterval(beatTimer);
      beatTimer = null;
    }
  }

  function getCachedImage(src) {
    if (!src) return null;
    if (imageCache.has(src)) return imageCache.get(src);
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    imageCache.set(src, img);
    return img;
  }

  function getAllReels() {
    const configReels = Array.isArray(railCfg.reels) && railCfg.reels.length ? railCfg.reels : DEFAULT_REELS;
    const merged = [...sessionCustomReels, ...configReels];
    return merged.map(r => {
      const look = (railCfg.looks || [])[r.lookIndex] || (railCfg.looks || [])[0] || {};
      const items = (look.products || []).map(pid => (railCfg.items || []).find(p => p.id === pid)).filter(Boolean);
      const isFollowing = socialState.followedHandles[r.handle] !== undefined
        ? Boolean(socialState.followedHandles[r.handle])
        : Boolean(r.following);
      const isLiked = Boolean(socialState.likedReels[r.id]);
      const isSaved = Boolean(socialState.savedReels[r.id]);
      const storedComments = socialState.commentsByReel[r.id];
      const comments = Array.isArray(storedComments) ? storedComments : (r.comments || []);
      return {
        ...r,
        look,
        items,
        isFollowing,
        isLiked,
        isSaved,
        likesCount: (r.baseLikes || 0) + (isLiked ? 1 : 0),
        savesCount: (r.baseSaves || 0) + (isSaved ? 1 : 0),
        comments
      };
    });
  }

  function getFilteredReels() {
    const all = getAllReels();
    if (currentFeedFilter === 'following') return all.filter(r => r.isFollowing);
    if (currentFeedFilter !== 'all') {
      const target = normalizeCategory(currentFeedFilter);
      return all.filter(r =>
        normalizeCategory(r.category) === target ||
        (r.items || []).some(it => normalizeCategory(it.category) === target)
      );
    }
    return all;
  }

  function countTotalComments(comments) {
    return (comments || []).reduce((sum, c) => sum + 1 + ((c.replies || []).length), 0);
  }

  function toast(msg) {
    const status = document.getElementById('bag-status');
    if (!status) return;
    status.textContent = msg;
    status.classList.add('is-on');
    clearTimeout(status.hideTimer);
    status.hideTimer = setTimeout(() => status.classList.remove('is-on'), 2400);
  }

  // Draw 60fps TikTok-style editorial fashion video on 9:16 canvas
  function drawReelFrame(ctx, w, h, reel, tSec) {
    const progress = (tSec % REEL_DURATION) / REEL_DURATION;
    const [bgA, bgB] = reel.bgTone || ['#181716', '#2a2826'];

    // Background studio gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, bgA);
    grad.addColorStop(0.55, bgB);
    grad.addColorStop(1, '#0b0b0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle moving editorial vertical lines & stage glow
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    const drift = (progress * 90) % 90;
    for (let x = -90 + drift; x < w; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Radial spotlight on stage
    const spot = ctx.createRadialGradient(w * 0.5, h * 0.48, 20, w * 0.5, h * 0.48, h * 0.45);
    spot.addColorStop(0, 'rgba(255,255,255,0.16)');
    spot.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, w, h);

    const modelImg = getCachedImage(reel.look?.src);
    if (modelImg && modelImg.complete && modelImg.naturalWidth > 0) {
      const ar = modelImg.naturalWidth / modelImg.naturalHeight;
      let drawH, drawW, dx, dy;

      if (tSec < 3.5) {
        // Scene 1: Kinetic Dolly Entrance
        const p = tSec / 3.5;
        const ease = 1 - Math.pow(1 - p, 3);
        const zoom = 0.84 + ease * 0.08;
        drawH = h * zoom;
        drawW = drawH * ar;
        dx = (w - drawW) * 0.5;
        dy = h * 0.9 - drawH + (1 - ease) * 18;
      } else if (tSec < 7.0) {
        // Scene 2: Macro Garment & Sneaker Vertical Pan
        const p = (tSec - 3.5) / 3.5;
        const smooth = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        drawH = h * 1.24;
        drawW = drawH * ar;
        dx = (w - drawW) * 0.5 + Math.sin(p * Math.PI) * 12;
        dy = -h * 0.05 - smooth * (h * 0.25);
      } else {
        // Scene 3: Editorial Split & Studio Cut
        const p = (tSec - 7.0) / 3.5;
        drawH = h * 0.86;
        drawW = drawH * ar;
        dx = (w - drawW) * 0.5 - Math.sin(p * Math.PI * 0.5) * 28;
        dy = h * 0.88 - drawH;
      }

      // Floor shadow under model
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, Math.min(h * 0.89, dy + drawH - 8), drawW * 0.28, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.drawImage(modelImg, dx, dy, drawW, drawH);

      // Animated framing reticle in Scene 2
      if (tSec >= 3.5 && tSec < 7.0) {
        const p = (tSec - 3.5) / 3.5;
        const boxY = h * (0.28 + p * 0.36);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.42)';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(w * 0.22, boxY, w * 0.56, 110);
        ctx.fillStyle = 'rgba(14,14,14,0.72)';
        ctx.fillRect(w * 0.22, boxY - 22, 132, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = '500 10px Helvetica, Arial, sans-serif';
        ctx.fillText(`FIT DETAIL · LOOK ${String(reel.lookIndex + 1).padStart(2, '0')}`, w * 0.22 + 8, boxY - 8);
        ctx.restore();
      }

      // Sliding tagged Studio Piece Showcase cards in Scene 3
      if (tSec >= 7.0 && reel.items?.length) {
        const p = Math.min(1, (tSec - 7.0) / 0.6);
        const slideX = (1 - Math.pow(1 - p, 3)) * 120;
        const cardW = 90;
        const cardH = 96;
        reel.items.slice(0, 3).forEach((prod, i) => {
          const cx = w - cardW - 18 + (120 - slideX);
          const cy = 128 + i * (cardH + 10);
          ctx.save();
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          ctx.fillRect(cx, cy, cardW, cardH);
          ctx.strokeStyle = 'rgba(21,20,19,0.2)';
          ctx.strokeRect(cx, cy, cardW, cardH);

          const pImg = getCachedImage(prod.image);
          if (pImg && pImg.complete && pImg.naturalWidth > 0) {
            const pAr = pImg.naturalWidth / pImg.naturalHeight;
            const maxW = cardW - 16;
            const maxH = cardH - 34;
            let pw = maxW;
            let ph = pw / pAr;
            if (ph > maxH) { ph = maxH; pw = ph * pAr; }
            ctx.drawImage(pImg, cx + (cardW - pw) / 2, cy + 7 + (maxH - ph) / 2, pw, ph);
          }

          const disc = clampDiscount(prod.discount);
          if (disc > 0) {
            ctx.fillStyle = '#b91c1c';
            ctx.fillRect(cx + cardW - 32, cy + 4, 28, 13);
            ctx.fillStyle = '#ffffff';
            ctx.font = '700 8.5px Helvetica, Arial, sans-serif';
            ctx.fillText(`-${disc}%`, cx + cardW - 29, cy + 13);
          }

          ctx.fillStyle = disc > 0 ? '#b91c1c' : '#151413';
          ctx.font = '600 10px Helvetica, Arial, sans-serif';
          ctx.fillText(money(getSalePrice(prod)), cx + 8, cy + cardH - 9);
          ctx.restore();
        });
      }
    }

    // Subtle editorial kinetic title top-left inside scene 1 safe zone
    if (tSec < 3.4) {
      const alpha = tSec < 0.4 ? tSec / 0.4 : (tSec > 2.8 ? Math.max(0, (3.4 - tSec) / 0.6) : 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.font = '500 11px Helvetica, Arial, sans-serif';
      ctx.fillText(`HAND RAIL PRO · LOOK ${String(reel.lookIndex + 1).padStart(2, '0')}`, 20, 124);
      ctx.fillStyle = '#ffffff';
      ctx.font = '400 25px Helvetica, Arial, sans-serif';
      ctx.fillText(reel.look?.name || 'Runway Edit', 20, 154);
      ctx.restore();
    }
  }

  function renderDrawerForActiveReel() {
    const reels = getFilteredReels();
    const reel = reels.find(r => r.id === activeReelId) || reels[0];
    if (!reel) return;
    activeReelId = reel.id;

    const totalComments = countTotalComments(reel.comments);
    document.querySelectorAll('[data-rail-comment-total]').forEach(el => { el.textContent = String(totalComments); });
    document.querySelectorAll('[data-rail-shop-total]').forEach(el => { el.textContent = String((reel.items || []).length); });

    const labelEl = document.getElementById('rail-active-reel-label');
    if (labelEl) {
      labelEl.textContent = `Look ${String(reel.lookIndex + 1).padStart(2, '0')} · ${reel.handle}`;
    }

    const counterEl = document.querySelector('[data-rail-counter]');
    if (counterEl) {
      const idx = Math.max(0, reels.findIndex(r => r.id === reel.id));
      counterEl.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(reels.length).padStart(2, '0')} · HAND RAIL PRO`;
    }

    const prevBtn = document.getElementById('rail-prev-btn');
    const nextBtn = document.getElementById('rail-next-btn');
    const idx = reels.findIndex(r => r.id === reel.id);
    if (prevBtn) prevBtn.disabled = idx <= 0;
    if (nextBtn) nextBtn.disabled = idx >= reels.length - 1;

    renderCommentsList(reel);
    renderShopPanel(reel);
  }

  function renderCommentsList(reel) {
    const listEl = document.getElementById('rail-comments-list');
    if (!listEl) return;

    const sorted = [...(reel.comments || [])].sort((a, b) => {
      if (currentCommentSort === 'newest') return (b.ts || 0) - (a.ts || 0);
      return ((b.likes || 0) + (socialState.likedComments[b.id] ? 1 : 0)) - ((a.likes || 0) + (socialState.likedComments[a.id] ? 1 : 0));
    });

    if (!sorted.length) {
      listEl.innerHTML = `<p style="font-size:13px;color:#66625c;text-align:center;margin:32px 0;">Belum ada komen lagi. Jadi yang pertama komen look ni!</p>`;
      return;
    }

    listEl.innerHTML = sorted.map(c => {
      const isLiked = Boolean(socialState.likedComments[c.id]);
      const likeCount = (c.likes || 0) + (isLiked ? 1 : 0);
      const initials = String(c.author || '@u').replace('@', '').slice(0, 2);
      return `
        <div class="rail-comment-item" data-comment-id="${esc(c.id)}">
          <div class="rail-comment-avatar">${esc(initials)}</div>
          <div>
            <div class="rail-comment-author">
              <span>${esc(c.author)}</span>
              ${c.isCreator || c.author === reel.handle ? '<span class="rail-creator-tag">Creator</span>' : ''}
            </div>
            <p class="rail-comment-body">${esc(c.text)}</p>
            <div class="rail-comment-meta">
              <span>${esc(c.time || 'Just now')}</span>
              <button type="button" class="rail-comment-reply-btn" data-reply-comment="${esc(c.id)}" data-reply-author="${esc(c.author)}">Reply</button>
            </div>
            ${(c.replies && c.replies.length) ? `
              <div class="rail-replies-wrap">
                ${c.replies.map(rp => `
                  <div class="rail-reply-row">
                    <div>
                      <div class="rail-comment-author" style="font-size:11px;">
                        <span>${esc(rp.author)}</span>
                        ${rp.isCreator || rp.author === reel.handle ? '<span class="rail-creator-tag">Creator</span>' : ''}
                        <span style="font-weight:400;color:#66625c;">· ${esc(rp.time || 'Just now')}</span>
                      </div>
                      <p class="rail-comment-body" style="font-size:12px;">${esc(rp.text)}</p>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
          <button type="button" class="rail-comment-like-btn${isLiked ? ' is-liked' : ''}" data-like-comment="${esc(c.id)}" aria-label="Like comment">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span>${likeCount}</span>
          </button>
        </div>
      `;
    }).join('');
  }

  function renderShopPanel(reel) {
    const listEl = document.getElementById('rail-shop-list');
    const footEl = document.getElementById('rail-shop-foot');
    if (!listEl || !footEl) return;

    const items = reel.items || [];
    const origSum = items.reduce((s, p) => s + getSalePrice(p), 0);
    const bundleSum = origSum * 0.9;

    listEl.innerHTML = items.map((prod, idx) => {
      const variants = buildVariantsForItem(prod);
      const stock = prod?.stock !== undefined ? Math.max(0, Number(prod.stock) || 0) : 15;
      const soldOut = stock <= 0;
      const firstVar = variants[0];
      const stockTxt = soldOut ? '<p class="orbit-stock-note is-out">Habis stok</p>' : (stock <= 5 ? `<p class="orbit-stock-note is-low">Stok rendah: ${stock} unit</p>` : `<p class="orbit-stock-note">Stok: ${stock} unit</p>`);
      return `
        <div class="orbit-lb-item-row" data-rail-shop-row>
          <div class="orbit-lb-item-thumb">
            <span class="orbit-mini-num">${idx + 1}</span>
            <img src="${esc(prod.image)}" alt="${esc(prod.name)}">
          </div>
          <div>
            <div class="orbit-piece-vendor">${esc(prod.type)}</div>
            <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;">
              <strong style="font-size:13px;font-weight:500;">${esc(prod.name)}</strong>
              <span style="font-size:12px;">${formatItemPriceHtml(prod)}</span>
            </div>
            ${stockTxt}
            <div class="orbit-piece-sizes" style="margin-bottom:8px;">
              ${variants.map((v, vIdx) => `
                <button type="button" class="orbit-size-pill${vIdx === 0 ? ' is-selected' : ''}" data-rail-size-pill data-variant-id="${v.id}">${esc(v.o)}</button>
              `).join('')}
            </div>
            <div class="orbit-lb-row-btns">
              <button type="button" class="orbit-btn-secondary" style="min-height:34px;flex:1 1 auto;font-size:11px;padding:0 10px;" data-rail-add-one data-variant-id="${firstVar ? firstVar.id : ''}" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Sold out' : '+ Add to bag'}</button>
              <button type="button" class="orbit-btn-primary" style="min-height:34px;flex:0 0 auto;font-size:11px;padding:0 12px;" data-rail-lock-one data-variant-id="${firstVar ? firstVar.id : ''}" ${soldOut ? 'disabled' : ''}>🔒 Lock</button>
              <button type="button" class="orbit-share-btn orbit-share-btn-sm" data-share-item="${esc(prod.id)}" title="Salin link item" aria-label="Salin link ${esc(prod.name)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    footEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <span style="font-size:12px;color:#66625c;">Complete look bundle (Save 10%)</span>
        <span style="font-variant-numeric:tabular-nums;"><s style="font-size:11px;color:#66625c;margin-right:6px;">${money(origSum)}</s><strong style="font-size:16px;font-weight:500;">${money(bundleSum)}</strong></span>
      </div>
      <button type="button" class="orbit-btn-primary" data-rail-add-bundle>Add full look to bag</button>
      <button type="button" class="orbit-btn-secondary" data-rail-to-runway="${reel.lookIndex}">Inspect Look ${String(reel.lookIndex + 1).padStart(2, '0')} in 3D Runway ↗</button>
    `;
  }

  function destroyFeedLoops() {
    playerLoops.forEach(ctrl => ctrl.destroy());
    playerLoops.clear();
    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }
    stopAmbientBeat();
  }

  function buildFeed() {
    const feedEl = document.getElementById('rail-feed');
    if (!feedEl) return;
    destroyFeedLoops();

    const reels = getFilteredReels();
    if (!reels.length) {
      feedEl.innerHTML = `<div style="color:#fff;text-align:center;padding:64px 24px;margin:auto;"><p style="font-size:16px;margin:0 0 12px;">Tiada video dalam senarai ini lagi.</p><button type="button" class="orbit-btn-secondary" data-rail-reset-filter style="background:#fff;color:#151413;padding:10px 18px;">Papar Semua Video</button></div>`;
      return;
    }

    if (!reels.some(r => r.id === activeReelId)) {
      activeReelId = reels[0].id;
      activeReelIndex = 0;
    }

    feedEl.replaceChildren();

    reels.forEach((reel, idx) => {
      const card = document.createElement('article');
      card.className = 'rail-reel-card';
      card.dataset.reelId = reel.id;
      card.dataset.reelIndex = String(idx);

      const commentCount = countTotalComments(reel.comments);
      const avatarSrc = reel.look?.src || '/assets/aistudio/Hijabi_Woman_in_Casual_Denim_Style_ec4eaf01.png';
      const hasRealVideo = Boolean(reel.videoUrl);

      card.innerHTML = `
        <div class="rail-player" data-rail-player="${esc(reel.id)}">
          ${hasRealVideo
            ? `<video class="rail-real-video" src="${esc(reel.videoUrl)}" playsinline loop muted preload="auto"></video>`
            : `<canvas class="rail-video-canvas" width="540" height="960"></canvas>`
          }
          <div class="rail-top-hud">
            <span class="rail-hud-badge">HAND RAIL · LOOK ${String(reel.lookIndex + 1).padStart(2, '0')}${hasRealVideo ? ' · 360°' : ''}</span>
            <div class="rail-hud-controls">
              <button type="button" class="rail-hud-btn" data-rail-speed title="Playback speed">${playbackRate}x</button>
              <button type="button" class="rail-hud-btn" data-rail-mute aria-label="Toggle audio">${isMuted ? '🔇' : '🔊'}</button>
            </div>
          </div>

          <div class="rail-pause-indicator" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
          </div>

          <div class="rail-overlay-bottom">
            <div class="rail-author-row">
              <span class="rail-author-handle">${esc(reel.handle)}</span>
              ${reel.verified ? '<span class="rail-verified" title="Verified Creator">✓</span>' : ''}
              <button type="button" class="rail-follow-pill${reel.isFollowing ? ' is-following' : ''}" data-rail-follow="${esc(reel.handle)}">
                ${reel.isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
            <p class="rail-caption">${esc(reel.caption)}</p>
            <div class="rail-audio-line">
              <span class="rail-audio-disc">♫</span>
              <span>${esc(reel.audio || 'Original Runway Audio')}</span>
            </div>
            <button type="button" class="rail-shop-tag" data-rail-open-shop>
              <svg width="13" height="13" viewBox="0 0 24 26" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8h16l1 16H3L4 8zM8 8V6a4 4 0 0 1 8 0v2"/></svg>
              <span>Shop ${(reel.items || []).length} items in this look</span>
            </button>
          </div>

          <span class="rail-timecode" data-rail-time>00:00 / 00:10</span>
          <div class="rail-scrubber-wrap" data-rail-scrubber aria-label="Seek video">
            <div class="rail-scrubber-track">
              <div class="rail-scrubber-fill" data-rail-fill></div>
            </div>
          </div>
        </div>

        <div class="rail-action-rail">
          <div class="rail-act-avatar">
            <img src="${esc(avatarSrc)}" alt="${esc(reel.handle)}">
            <button type="button" class="rail-act-follow-dot${reel.isFollowing ? ' is-following' : ''}" data-rail-follow="${esc(reel.handle)}" aria-label="Follow ${esc(reel.handle)}">${reel.isFollowing ? '✓' : '+'}</button>
          </div>

          <button type="button" class="rail-act-btn${reel.isLiked ? ' is-liked' : ''}" data-rail-like="${esc(reel.id)}" aria-label="Like video">
            <span class="rail-act-circle">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="${reel.isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </span>
            <span class="rail-act-count" data-like-count="${esc(reel.id)}">${compactNum(reel.likesCount)}</span>
          </button>

          <button type="button" class="rail-act-btn" data-rail-open-comments aria-label="Open comments">
            <span class="rail-act-circle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            </span>
            <span class="rail-act-count" data-comment-count="${esc(reel.id)}">${commentCount}</span>
          </button>

          <button type="button" class="rail-act-btn${reel.isSaved ? ' is-saved' : ''}" data-rail-save="${esc(reel.id)}" aria-label="Save video">
            <span class="rail-act-circle">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="${reel.isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </span>
            <span class="rail-act-count" data-save-count="${esc(reel.id)}">${compactNum(reel.savesCount)}</span>
          </button>

          <button type="button" class="rail-act-btn" data-rail-share="${esc(reel.id)}" aria-label="Share video">
            <span class="rail-act-circle">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </span>
            <span class="rail-act-count">${compactNum(reel.baseShares || 120)}</span>
          </button>
        </div>
      `;

      feedEl.appendChild(card);

      // Attach Player Loop Controller
      const playerEl = card.querySelector('.rail-player');
      const fillEl = card.querySelector('[data-rail-fill]');
      const timeEl = card.querySelector('[data-rail-time]');
      const videoEl = card.querySelector('.rail-real-video');
      const canvasEl = card.querySelector('.rail-video-canvas');
      const ctx = canvasEl ? canvasEl.getContext('2d') : null;

      const ctrl = {
        id: reel.id,
        isRealVideo: hasRealVideo,
        playing: false,
        t: 0,
        raf: 0,
        lastTs: 0,
        play() {
          this.playing = true;
          playerEl.classList.remove('is-paused');
          if (videoEl) {
            videoEl.muted = isMuted;
            videoEl.playbackRate = playbackRate;
            videoEl.play().catch(() => {});
          } else if (!this.raf) {
            this.lastTs = performance.now();
            const tick = now => {
              if (!this.playing) { this.raf = 0; return; }
              const dt = Math.min(0.1, (now - this.lastTs) / 1000) * playbackRate;
              this.lastTs = now;
              const prevT = this.t;
              this.t += dt;
              if (this.t >= REEL_DURATION) {
                this.t = this.t % REEL_DURATION;
                if (autoNext && prevT > REEL_DURATION - 0.35) {
                  goToReelIndex(idx + 1);
                }
              }
              if (ctx) drawReelFrame(ctx, canvasEl.width, canvasEl.height, reel, this.t);
              if (fillEl) fillEl.style.width = `${(this.t / REEL_DURATION) * 100}%`;
              if (timeEl) timeEl.textContent = `${fmtTime(this.t)} / ${fmtTime(REEL_DURATION)}`;
              this.raf = requestAnimationFrame(tick);
            };
            this.raf = requestAnimationFrame(tick);
          }
          if (!isMuted && !hasRealVideo) startAmbientBeat();
        },
        pause() {
          this.playing = false;
          playerEl.classList.add('is-paused');
          if (videoEl) videoEl.pause();
          if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
        },
        seek(ratio) {
          const r = Math.max(0, Math.min(1, ratio));
          if (videoEl && Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
            videoEl.currentTime = r * videoEl.duration;
          } else {
            this.t = r * REEL_DURATION;
            if (ctx) drawReelFrame(ctx, canvasEl.width, canvasEl.height, reel, this.t);
            if (fillEl) fillEl.style.width = `${r * 100}%`;
            if (timeEl) timeEl.textContent = `${fmtTime(this.t)} / ${fmtTime(REEL_DURATION)}`;
          }
        },
        syncAudioAndRate() {
          if (videoEl) {
            videoEl.muted = isMuted;
            videoEl.playbackRate = playbackRate;
          } else {
            if (isMuted) stopAmbientBeat();
            else if (this.playing) startAmbientBeat();
          }
        },
        destroy() {
          this.pause();
        }
      };

      if (videoEl) {
        const syncVideoTime = () => {
          const dur = Number.isFinite(videoEl.duration) && videoEl.duration > 0 ? videoEl.duration : 10;
          if (fillEl) fillEl.style.width = `${(videoEl.currentTime / dur) * 100}%`;
          if (timeEl) timeEl.textContent = `${fmtTime(videoEl.currentTime)} / ${fmtTime(dur)}`;
        };
        videoEl.addEventListener('loadedmetadata', syncVideoTime);
        videoEl.addEventListener('timeupdate', syncVideoTime);
      } else if (ctx) {
        // Draw crisp poster frame immediately
        drawReelFrame(ctx, canvasEl.width, canvasEl.height, reel, 1.2);
      }

      playerLoops.set(reel.id, ctrl);
    });

    // Observe snapped active card
    activeObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const id = entry.target.getAttribute('data-reel-id');
        const idx = parseInt(entry.target.getAttribute('data-reel-index') || '0', 10);
        const ctrl = playerLoops.get(id);
        if (!ctrl) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
          activeReelId = id;
          activeReelIndex = idx;
          playerLoops.forEach((other, oid) => { if (oid !== id) other.pause(); });
          ctrl.play();
          renderDrawerForActiveReel();
        } else if (!entry.isIntersecting) {
          ctrl.pause();
        }
      });
    }, { root: feedEl, threshold: [0.15, 0.6] });

    feedEl.querySelectorAll('.rail-reel-card').forEach(card => activeObserver.observe(card));
    renderDrawerForActiveReel();
  }

  function goToReelIndex(idx) {
    const feedEl = document.getElementById('rail-feed');
    if (!feedEl) return;
    const cards = Array.from(feedEl.querySelectorAll('.rail-reel-card'));
    if (!cards.length) return;
    const clamped = Math.max(0, Math.min(cards.length - 1, idx));
    cards[clamped].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toggleLike(reelId, forceLike = false) {
    const currently = Boolean(socialState.likedReels[reelId]);
    const next = forceLike ? true : !currently;
    socialState.likedReels[reelId] = next;
    toggleReelLike(reelId, next);
    saveSocialState();

    const btn = document.querySelector(`[data-rail-like="${reelId}"]`);
    if (btn) {
      btn.classList.toggle('is-liked', next);
      const svg = btn.querySelector('svg');
      if (svg) svg.setAttribute('fill', next ? 'currentColor' : 'none');
    }
    const reels = getAllReels();
    const r = reels.find(x => x.id === reelId);
    const countEl = document.querySelector(`[data-like-count="${reelId}"]`);
    if (r && countEl) countEl.textContent = compactNum(r.likesCount);
  }

  function spawnHeartBurst(playerEl, clientX, clientY) {
    const rect = playerEl.getBoundingClientRect();
    const burst = document.createElement('div');
    burst.className = 'rail-heart-burst';
    burst.style.left = `${clientX - rect.left}px`;
    burst.style.top = `${clientY - rect.top}px`;
    burst.innerHTML = `<svg viewBox="0 0 24 24" width="84" height="84" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    playerEl.appendChild(burst);
    setTimeout(() => burst.remove(), 750);
  }

  function openDrawerTab(tabName) {
    currentDrawerTab = tabName === 'shop' ? 'shop' : 'comments';
    const drawer = document.getElementById('rail-drawer');
    const backdrop = document.getElementById('rail-drawer-backdrop');
    const cPanel = document.getElementById('rail-comments-panel');
    const sPanel = document.getElementById('rail-shop-panel');
    document.querySelectorAll('[data-rail-drawer-tab]').forEach(t => {
      const on = t.getAttribute('data-rail-drawer-tab') === currentDrawerTab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (cPanel) cPanel.hidden = currentDrawerTab !== 'comments';
    if (sPanel) sPanel.hidden = currentDrawerTab !== 'shop';
    if (drawer) drawer.classList.add('is-open');
    if (backdrop) backdrop.classList.add('is-open');
  }

  function closeDrawer() {
    document.getElementById('rail-drawer')?.classList.remove('is-open');
    document.getElementById('rail-drawer-backdrop')?.classList.remove('is-open');
  }

  function bindHandRailEvents() {
    const app = document.getElementById('hand-rail-pro');
    if (!app) return;

    // Swipe-down to dismiss mobile bottom sheet
    const drawerEl = document.getElementById('rail-drawer');
    const grabberEl = drawerEl?.querySelector('.rail-drawer-grabber');
    const headEl = drawerEl?.querySelector('.rail-drawer-head');
    let touchStartY = 0;
    [grabberEl, headEl].forEach(handle => {
      if (!handle) return;
      handle.addEventListener('touchstart', ev => {
        touchStartY = ev.touches?.[0]?.clientY || 0;
      }, { passive: true });
      handle.addEventListener('touchend', ev => {
        const endY = ev.changedTouches?.[0]?.clientY || 0;
        if (touchStartY && endY - touchStartY > 55) closeDrawer();
        touchStartY = 0;
      }, { passive: true });
    });

    let tapTimer = null;
    let lastTap = 0;

    app.addEventListener('click', async e => {
      const resetFilter = e.target.closest('[data-rail-reset-filter]');
      if (resetFilter) {
        currentFeedFilter = 'all';
        app.querySelectorAll('[data-rail-feed]').forEach(b => b.classList.toggle('is-active', b.getAttribute('data-rail-feed') === 'all'));
        buildFeed();
        return;
      }

      const feedTab = e.target.closest('[data-rail-feed]');
      if (feedTab) {
        currentFeedFilter = feedTab.getAttribute('data-rail-feed') || 'all';
        app.querySelectorAll('[data-rail-feed]').forEach(b => {
          const on = b === feedTab;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        buildFeed();
        return;
      }

      const speedBtn = e.target.closest('[data-rail-speed]');
      if (speedBtn) {
        playbackRate = playbackRate === 1 ? 1.5 : (playbackRate === 1.5 ? 0.5 : 1);
        app.querySelectorAll('[data-rail-speed]').forEach(b => { b.textContent = `${playbackRate}x`; });
        playerLoops.forEach(c => c.syncAudioAndRate());
        return;
      }

      const muteBtn = e.target.closest('[data-rail-mute]');
      if (muteBtn) {
        isMuted = !isMuted;
        app.querySelectorAll('[data-rail-mute]').forEach(b => { b.textContent = isMuted ? '🔇' : '🔊'; });
        window.SahiraCafeAudio?.duckForMedia?.(!isMuted);
        playerLoops.forEach(c => c.syncAudioAndRate());
        return;
      }

      const scrubber = e.target.closest('[data-rail-scrubber]');
      if (scrubber) {
        const player = scrubber.closest('[data-rail-player]');
        const rid = player?.getAttribute('data-rail-player');
        const ctrl = playerLoops.get(rid);
        if (ctrl) {
          const rect = scrubber.getBoundingClientRect();
          ctrl.seek((e.clientX - rect.left) / rect.width);
        }
        return;
      }

      const followBtn = e.target.closest('[data-rail-follow]');
      if (followBtn) {
        const handle = followBtn.getAttribute('data-rail-follow');
        const current = socialState.followedHandles[handle] !== undefined
          ? Boolean(socialState.followedHandles[handle])
          : Boolean((railCfg.reels || DEFAULT_REELS).find(r => r.handle === handle)?.following);
        const next = !current;
        socialState.followedHandles[handle] = next;
        toggleReelFollow(handle, next);
        saveSocialState();
        app.querySelectorAll(`[data-rail-follow="${CSS.escape(handle)}"]`).forEach(el => {
          el.classList.toggle('is-following', next);
          if (el.classList.contains('rail-follow-pill')) el.textContent = next ? 'Following' : 'Follow';
          else el.textContent = next ? '✓' : '+';
        });
        toast(next ? `Following ${handle}` : `Unfollowed ${handle}`);
        return;
      }

      const likeBtn = e.target.closest('[data-rail-like]');
      if (likeBtn) {
        toggleLike(likeBtn.getAttribute('data-rail-like'), false);
        return;
      }

      const saveBtn = e.target.closest('[data-rail-save]');
      if (saveBtn) {
        const rid = saveBtn.getAttribute('data-rail-save');
        const next = !Boolean(socialState.savedReels[rid]);
        socialState.savedReels[rid] = next;
        toggleReelSave(rid, next);
        saveSocialState();
        saveBtn.classList.toggle('is-saved', next);
        const svg = saveBtn.querySelector('svg');
        if (svg) svg.setAttribute('fill', next ? 'currentColor' : 'none');
        const r = getAllReels().find(x => x.id === rid);
        const cntEl = document.querySelector(`[data-save-count="${rid}"]`);
        if (r && cntEl) cntEl.textContent = compactNum(r.savesCount);
        toast(next ? 'Video disimpan ke koleksi anda' : 'Dibuang daripada simpanan');
        return;
      }

      const shareBtn = e.target.closest('[data-rail-share]');
      if (shareBtn) {
        const url = window.location.origin + window.location.pathname + '#hand-rail-pro';
        if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
        toast('Pautan video Hand Rail Pro disalin!');
        return;
      }

      if (e.target.closest('[data-rail-open-comments]')) {
        openDrawerTab('comments');
        const input = document.getElementById('rail-comment-input');
        if (input && window.innerWidth > 960) input.focus();
        return;
      }

      if (e.target.closest('[data-rail-open-shop]')) {
        openDrawerTab('shop');
        return;
      }

      if (e.target.closest('#rail-drawer-close') || e.target.closest('#rail-drawer-backdrop')) {
        closeDrawer();
        return;
      }

      const dTab = e.target.closest('[data-rail-drawer-tab]');
      if (dTab) {
        openDrawerTab(dTab.getAttribute('data-rail-drawer-tab'));
        return;
      }

      const sortBtn = e.target.closest('[data-rail-sort]');
      if (sortBtn) {
        currentCommentSort = sortBtn.getAttribute('data-rail-sort') || 'top';
        app.querySelectorAll('[data-rail-sort]').forEach(b => b.classList.toggle('is-active', b === sortBtn));
        renderDrawerForActiveReel();
        return;
      }

      const likeCommentBtn = e.target.closest('[data-like-comment]');
      if (likeCommentBtn) {
        const cid = likeCommentBtn.getAttribute('data-like-comment');
        socialState.likedComments[cid] = !socialState.likedComments[cid];
        saveSocialState();
        renderDrawerForActiveReel();
        return;
      }

      const replyBtn = e.target.closest('[data-reply-comment]');
      if (replyBtn) {
        replyTarget = {
          commentId: replyBtn.getAttribute('data-reply-comment'),
          author: replyBtn.getAttribute('data-reply-author')
        };
        const banner = document.getElementById('rail-reply-banner');
        const rText = document.getElementById('rail-reply-text');
        if (banner && rText) {
          rText.textContent = `Membalas komen ${replyTarget.author}`;
          banner.hidden = false;
        }
        document.getElementById('rail-comment-input')?.focus();
        return;
      }

      if (e.target.closest('#rail-cancel-reply')) {
        replyTarget = null;
        const banner = document.getElementById('rail-reply-banner');
        if (banner) banner.hidden = true;
        return;
      }

      const quickChip = e.target.closest('[data-quick-comment]');
      if (quickChip) {
        const input = document.getElementById('rail-comment-input');
        if (input) {
          input.value = quickChip.getAttribute('data-quick-comment') || '';
          input.focus();
        }
        return;
      }

      const sizePill = e.target.closest('[data-rail-size-pill]');
      if (sizePill) {
        const row = sizePill.closest('[data-rail-shop-row]');
        if (row) {
          row.querySelectorAll('[data-rail-size-pill]').forEach(p => p.classList.toggle('is-selected', p === sizePill));
          const vid = sizePill.getAttribute('data-variant-id') || '';
          const addBtn = row.querySelector('[data-rail-add-one]');
          if (addBtn) {
            addBtn.setAttribute('data-variant-id', vid);
            addBtn.textContent = '+ Add to bag';
          }
          const lockBtn = row.querySelector('[data-rail-lock-one]');
          if (lockBtn) {
            lockBtn.setAttribute('data-variant-id', vid);
          }
        }
        return;
      }

      const lockOne = e.target.closest('[data-rail-lock-one]');
      if (lockOne) {
        const vid = Number(lockOne.getAttribute('data-variant-id'));
        if (!vid || !window.RunwayBag?.lockNow) return;
        lockOne.disabled = true;
        try {
          await window.RunwayBag.lockNow(vid);
        } catch (_) {
          showShareToast('Gagal lock item. Sila cuba semula.');
        } finally {
          lockOne.disabled = false;
        }
        return;
      }

      const addOne = e.target.closest('[data-rail-add-one]');
      if (addOne) {
        const vid = Number(addOne.getAttribute('data-variant-id'));
        if (!vid || !window.RunwayBag) return;
        addOne.disabled = true;
        try {
          await window.RunwayBag.add([{ id: vid, quantity: 1 }]);
          addOne.textContent = 'Added to bag ✓';
        } catch (_) {
          addOne.textContent = 'Try again';
        } finally {
          addOne.disabled = false;
        }
        return;
      }

      const addBundle = e.target.closest('[data-rail-add-bundle]');
      if (addBundle) {
        const ids = Array.from(app.querySelectorAll('[data-rail-add-one]'))
          .map(b => Number(b.getAttribute('data-variant-id')))
          .filter(id => Number.isSafeInteger(id) && id > 0)
          .map(id => ({ id, quantity: 1 }));
        if (!ids.length || !window.RunwayBag) return;
        addBundle.disabled = true;
        addBundle.textContent = 'Adding full look...';
        try {
          await window.RunwayBag.add(ids);
          addBundle.textContent = 'Full look in bag ✓';
        } catch (_) {
          addBundle.textContent = 'Add full look to bag';
        } finally {
          addBundle.disabled = false;
        }
        return;
      }

      const toRunway = e.target.closest('[data-rail-to-runway]');
      if (toRunway && window.OrbitGallery) {
        const idx = parseInt(toRunway.getAttribute('data-rail-to-runway') || '0', 10);
        window.OrbitGallery.setView('runway', { lookIndex: idx });
        return;
      }

      // Tap / Double-Tap on Video Player
      const player = e.target.closest('[data-rail-player]');
      if (player && !e.target.closest('button, a, input, [data-rail-scrubber]')) {
        const rid = player.getAttribute('data-rail-player');
        const now = performance.now();
        if (now - lastTap < 270) {
          clearTimeout(tapTimer);
          lastTap = 0;
          toggleLike(rid, true);
          spawnHeartBurst(player, e.clientX, e.clientY);
        } else {
          lastTap = now;
          tapTimer = setTimeout(() => {
            const ctrl = playerLoops.get(rid);
            if (ctrl) {
              if (ctrl.playing) ctrl.pause();
              else ctrl.play();
            }
          }, 230);
        }
      }
    });

    // Prev / Next arrows
    document.getElementById('rail-prev-btn')?.addEventListener('click', () => goToReelIndex(activeReelIndex - 1));
    document.getElementById('rail-next-btn')?.addEventListener('click', () => goToReelIndex(activeReelIndex + 1));

    // Auto-Next checkbox
    document.getElementById('rail-autoscroll-input')?.addEventListener('change', e => {
      autoNext = Boolean(e.target.checked);
      toast(autoNext ? 'Auto-Next diaktifkan' : 'Loop video yang sama');
    });

    // Comment submission
    document.getElementById('rail-comment-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const handleInput = document.getElementById('rail-handle-input');
      const commentInput = document.getElementById('rail-comment-input');
      if (!commentInput) return;

      const text = commentInput.value.trim();
      if (!text) return;
      let author = (handleInput?.value || '@naz_style').trim();
      if (!author.startsWith('@')) author = '@' + author;

      const reel = getAllReels().find(r => r.id === activeReelId);
      if (!reel) return;

      const existing = Array.isArray(socialState.commentsByReel[activeReelId])
        ? [...socialState.commentsByReel[activeReelId]]
        : JSON.parse(JSON.stringify(reel.comments || []));

      if (replyTarget) {
        const parent = existing.find(c => c.id === replyTarget.commentId);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push({
            id: 'r_' + Date.now(),
            author,
            isCreator: author === reel.handle,
            time: 'Baru saja',
            text
          });
        }
        replyTarget = null;
        const banner = document.getElementById('rail-reply-banner');
        if (banner) banner.hidden = true;
      } else {
        existing.unshift({
          id: 'c_' + Date.now(),
          author,
          isCreator: author === reel.handle,
          time: 'Baru saja',
          ts: Date.now(),
          likes: 0,
          text,
          replies: []
        });
      }

      socialState.commentsByReel[activeReelId] = existing;
      saveSocialState();
      commentInput.value = '';
      renderDrawerForActiveReel();
      const badge = document.querySelector(`[data-comment-count="${activeReelId}"]`);
      if (badge) badge.textContent = String(countTotalComments(existing));
      toast('Komen anda telah disiarkan!');
    });

    // Keyboard navigation when viewing Hand Rail Pro
    document.addEventListener('keydown', e => {
      if (app.hidden) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowDown') { e.preventDefault(); goToReelIndex(activeReelIndex + 1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); goToReelIndex(activeReelIndex - 1); }
      if (e.key === ' ') {
        e.preventDefault();
        const ctrl = playerLoops.get(activeReelId);
        if (ctrl) { if (ctrl.playing) ctrl.pause(); else ctrl.play(); }
      }
    });

    // Upload / Post New Video Modal
    const upDlg = document.getElementById('rail-upload-dialog');
    const upFile = document.getElementById('rail-up-file');
    const upFileName = document.getElementById('rail-up-file-name');
    let pendingBlobUrl = '';

    const closeUpPickers = () => {
      upDlg?.querySelectorAll('[data-prod-picker].is-open').forEach(p => {
        p.classList.remove('is-open');
        const t = p.querySelector('[data-picker-toggle]');
        const m = p.querySelector('.admin-picker-menu');
        if (t) t.setAttribute('aria-expanded', 'false');
        if (m) m.hidden = true;
      });
      upDlg?.querySelectorAll('.is-picker-open').forEach(el => el.classList.remove('is-picker-open'));
    };

    document.getElementById('rail-open-upload')?.addEventListener('click', () => {
      if (upDlg && !upDlg.open) upDlg.showModal();
    });
    const closeUp = () => { closeUpPickers(); if (upDlg?.open) upDlg.close(); };
    document.getElementById('rail-upload-close')?.addEventListener('click', closeUp);
    document.getElementById('rail-upload-cancel')?.addEventListener('click', closeUp);
    upDlg?.addEventListener('click', e => {
      if (e.target === upDlg) { closeUp(); return; }
      const toggle = e.target.closest('[data-picker-toggle]');
      if (toggle) {
        const picker = toggle.closest('[data-prod-picker]');
        const wasOpen = picker.classList.contains('is-open');
        closeUpPickers();
        if (!wasOpen) {
          picker.classList.add('is-open');
          picker.closest('.rail-field')?.classList.add('is-picker-open');
          toggle.setAttribute('aria-expanded', 'true');
          const menu = picker.querySelector('.admin-picker-menu');
          if (menu) {
            menu.hidden = false;
            menu.classList.remove('open-up', 'align-right');
            const dlgRect = upDlg.getBoundingClientRect();
            const trigRect = toggle.getBoundingClientRect();
            if (trigRect.bottom + 240 > dlgRect.bottom && trigRect.top - 240 > dlgRect.top) {
              menu.classList.add('open-up');
            }
            const sInp = menu.querySelector('[data-picker-search]');
            if (sInp) {
              sInp.value = '';
              menu.querySelectorAll('[data-picker-choose]').forEach(opt => { opt.hidden = false; });
              requestAnimationFrame(() => sInp.focus());
            }
          }
        }
        return;
      }
      const choice = e.target.closest('[data-picker-choose]');
      if (choice) {
        const picker = choice.closest('[data-prod-picker]');
        const idx = Math.min(Math.max(0, (railCfg.looks || []).length - 1), Math.max(0, parseInt(choice.dataset.pickerChoose || '0', 10) || 0));
        const hid = picker.querySelector('input[type="hidden"]');
        if (hid) hid.value = String(idx);
        const trig = picker.querySelector('[data-picker-toggle]');
        const lk = (railCfg.looks || [])[idx];
        if (trig && lk) trig.innerHTML = renderLookThumbPickerTrigger(lk, idx);
        picker.querySelectorAll('[data-picker-choose]').forEach(opt => {
          const isSel = opt === choice;
          opt.classList.toggle('is-selected', isSel);
          const chk = opt.querySelector('.admin-picker-opt-check');
          if (isSel && !chk) opt.insertAdjacentHTML('beforeend', '<span class="admin-picker-opt-check" aria-hidden="true">✓</span>');
          else if (!isSel && chk) chk.remove();
        });
        closeUpPickers();
        return;
      }
      if (!e.target.closest('[data-prod-picker]')) closeUpPickers();
    });
    upDlg?.addEventListener('input', e => {
      if (e.target.matches('[data-picker-search]')) {
        const q = e.target.value.trim().toLowerCase();
        const list = e.target.closest('.admin-picker-menu')?.querySelector('.admin-picker-list');
        if (list) {
          list.querySelectorAll('[data-picker-choose]').forEach(opt => {
            const hay = opt.dataset.searchText || '';
            opt.hidden = Boolean(q && !hay.includes(q));
          });
        }
      }
    });

    upFile?.addEventListener('change', () => {
      const f = upFile.files?.[0];
      if (!f) return;
      pendingBlobUrl = URL.createObjectURL(f);
      if (upFileName) upFileName.textContent = `${f.name} (${(f.size / (1024 * 1024)).toFixed(1)} MB)`;
    });

    document.getElementById('rail-upload-form')?.addEventListener('submit', e => {
      e.preventDefault();
      let handle = (document.getElementById('rail-up-handle')?.value || '@naz_style').trim();
      if (!handle.startsWith('@')) handle = '@' + handle;
      const urlVal = (document.getElementById('rail-up-url')?.value || '').trim();
      const lookIndex = parseInt(document.getElementById('rail-up-look')?.value || '0', 10);
      const caption = (document.getElementById('rail-up-caption')?.value || '').trim();
      const videoUrl = pendingBlobUrl || urlVal;

      const chosenLook = (railCfg.looks || [])[isNaN(lookIndex) ? 0 : lookIndex];
      const primaryItem = chosenLook?.products?.[0] ? (railCfg.items || []).find(it => it.id === chosenLook.products[0]) : null;

      const newReel = {
        id: 'reel-custom-' + Date.now(),
        lookIndex: isNaN(lookIndex) ? 0 : lookIndex,
        handle,
        verified: false,
        following: true,
        category: primaryItem ? normalizeCategory(primaryItem.category) : 'apparel',
        caption,
        audio: videoUrl ? `Original Sound — ${handle}` : `Hand Rail Studio Cut — ${handle}`,
        videoUrl,
        baseLikes: 1,
        baseSaves: 0,
        baseShares: 0,
        bgTone: ['#141413', '#2a2826'],
        comments: []
      };

      sessionCustomReels.unshift(newReel);
      if (!videoUrl.startsWith('blob:')) {
        socialState.customReels = [newReel, ...(socialState.customReels || [])];
        saveSocialState();
      }
      pendingBlobUrl = '';
      if (upFile) upFile.value = '';
      if (upFileName) upFileName.textContent = 'Tiada fail dipilih (pilihan: tampal URL di bawah)';
      document.getElementById('rail-upload-form')?.reset();
      closeUp();

      currentFeedFilter = 'all';
      app.querySelectorAll('[data-rail-feed]').forEach(b => b.classList.toggle('is-active', b.getAttribute('data-rail-feed') === 'all'));
      activeReelId = newReel.id;
      buildFeed();
      goToReelIndex(0);
      toast('Video reel anda kini disiarkan di Hand Rail Pro!');
    });
  }

  window.HandRailPro = {
    activate() {
      buildFeed();
      const first = playerLoops.get(activeReelId);
      if (first) first.play();
    },
    pauseAll() {
      closeDrawer();
      playerLoops.forEach(c => c.pause());
      stopAmbientBeat();
      window.SahiraCafeAudio?.duckForMedia?.(false);
    },
    refresh(cfg) {
      railCfg = cfg || activeConfig;
      const app = document.getElementById('hand-rail-pro');
      if (app && !app.hidden) {
        buildFeed();
      } else {
        renderDrawerForActiveReel();
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindHandRailEvents);
  } else {
    bindHandRailEvents();
  }
})();

// ==========================================================================
// SAHIRA BOUTIQUE JINGLE & CAFE VIBE BACKGROUND MUSIC ENGINE (ZERO-API WEB AUDIO)
// ==========================================================================
function setupCafeAudio() {
  const STORAGE_KEY = 'sahira_cafe_audio_v1';
  const dock = document.getElementById('cafe-audio-dock');
  const playBtn = document.getElementById('cafe-audio-play');
  const menuBtn = document.getElementById('cafe-audio-menu-btn');
  const popover = document.getElementById('cafe-audio-popover');
  const labelEl = document.getElementById('cafe-audio-label');
  const statusEl = document.getElementById('cafe-pop-status');
  const jingleBtn = document.getElementById('cafe-jingle-btn');
  const volRange = document.getElementById('cafe-volume-range');
  const volVal = document.getElementById('cafe-volume-val');
  if (!dock || !playBtn) return;

  const VIBES = {
    lofi: {
      name: 'Warm Cafe Lo-Fi',
      stepMs: 208, // ~72 BPM 16ths
      swingMs: 26,
      chords: [
        [261.63, 329.63, 392.00, 493.88, 587.33], // Cmaj9
        [220.00, 261.63, 329.63, 392.00, 493.88], // Am9
        [174.61, 220.00, 261.63, 329.63, 392.00], // Fmaj9
        [196.00, 246.94, 293.66, 349.23, 440.00]  // G13
      ],
      bass: [130.81, 110.00, 87.31, 98.00],
      melody: [659.25, 0, 587.33, 523.25, 0, 493.88, 440.00, 392.00]
    },
    bossa: {
      name: 'Parisian Bossa',
      stepMs: 163, // ~92 BPM 16ths
      swingMs: 10,
      chords: [
        [261.63, 329.63, 392.00, 493.88, 587.33], // Cmaj9
        [220.00, 277.18, 349.23, 392.00, 523.25], // A7(b13)
        [293.66, 349.23, 440.00, 523.25, 659.25], // Dm9
        [196.00, 246.94, 329.63, 349.23, 440.00]  // G13
      ],
      bass: [130.81, 110.00, 146.83, 98.00],
      melody: [587.33, 659.25, 0, 783.99, 659.25, 0, 523.25, 440.00]
    },
    velvet: {
      name: 'Velvet Lounge',
      stepMs: 242, // ~62 BPM 16ths
      swingMs: 0,
      chords: [
        [220.00, 261.63, 329.63, 392.00, 493.88], // Am9
        [174.61, 220.00, 261.63, 329.63, 392.00], // Fmaj9
        [261.63, 329.63, 392.00, 493.88, 587.33], // Cmaj9
        [196.00, 246.94, 293.66, 329.63, 440.00]  // G6/9
      ],
      bass: [110.00, 87.31, 130.81, 98.00],
      melody: [523.25, 0, 0, 659.25, 587.33, 0, 493.88, 0]
    }
  };

  let prefs = { vibe: 'lofi', volume: 0.48 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && VIBES[parsed.vibe]) prefs.vibe = parsed.vibe;
      if (parsed && Number.isFinite(Number(parsed.volume))) {
        prefs.volume = Math.min(1, Math.max(0, Number(parsed.volume)));
      }
    }
  } catch (_) {}

  const savePrefs = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch (_) {}
  };

  let ctx = null;
  let masterGain = null;
  let delayNode = null;
  let noiseBuffer = null;
  let warmthSource = null;
  let warmthGain = null;
  let loopTimer = null;
  let jingleTimeout = null;
  let stepIdx = 0;
  let playing = false;
  let ducked = false;
  let pausedByMedia = false;

  const ensureAudioGraph = () => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    if (!ctx) {
      ctx = new Ctx();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 3;
      masterGain = ctx.createGain();
      masterGain.gain.value = ducked ? prefs.volume * 0.1 : prefs.volume * 0.65;

      // Soft warm cafe room delay
      delayNode = ctx.createDelay(1.0);
      delayNode.delayTime.value = 0.27;
      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 1650;
      const delayFb = ctx.createGain();
      delayFb.gain.value = 0.28;
      delayNode.connect(delayFilter);
      delayFilter.connect(delayFb);
      delayFb.connect(delayNode);
      delayFilter.connect(comp);

      comp.connect(masterGain);
      masterGain.connect(ctx.destination);

      // Subtle warm brown noise buffer for cafe room air + brushed percussion
      const sr = ctx.sampleRate;
      const len = sr * 2;
      noiseBuffer = ctx.createBuffer(1, len, sr);
      const data = noiseBuffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.03 * w) / 1.03;
        data[i] = lastOut * 2.8;
      }
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return true;
  };

  const startWarmthBed = () => {
    if (!ctx || !noiseBuffer || !masterGain || warmthSource) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 620;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 0.6);
    src.connect(filt);
    filt.connect(g);
    g.connect(masterGain);
    src.start();
    warmthSource = src;
    warmthGain = g;
  };

  const stopWarmthBed = () => {
    if (!warmthSource || !ctx) return;
    try {
      const src = warmthSource;
      const g = warmthGain;
      warmthSource = null;
      warmthGain = null;
      if (g) g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
      setTimeout(() => { try { src.stop(); } catch (_) {} }, 350);
    } catch (_) {}
  };

  const triggerRhodesNote = (freq, when, dur, peak = 0.09) => {
    if (!ctx || !masterGain || !freq) return;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1900, when);
    lp.frequency.exponentialRampToValueAtTime(680, when + Math.min(dur, 1.2));

    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(freq, when);

    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(freq * 2, when);
    const o2Gain = ctx.createGain();
    o2Gain.gain.setValueAtTime(0.18, when);
    o2Gain.gain.exponentialRampToValueAtTime(0.01, when + 0.18);

    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0004, when + dur);

    o1.connect(lp);
    o2.connect(o2Gain);
    o2Gain.connect(lp);
    lp.connect(g);
    g.connect(masterGain);
    if (delayNode) {
      const send = ctx.createGain();
      send.gain.value = 0.24;
      g.connect(send);
      send.connect(delayNode);
    }
    o1.start(when);
    o2.start(when);
    o1.stop(when + dur + 0.04);
    o2.stop(when + dur + 0.04);
  };

  const triggerChord = (freqs, when, dur, peak = 0.055, strum = 0.025) => {
    freqs.forEach((f, idx) => {
      triggerRhodesNote(f, when + idx * strum, dur, peak);
    });
  };

  const triggerBass = (freq, when, dur = 0.48, peak = 0.14) => {
    if (!ctx || !masterGain || !freq) return;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, when);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(340, when);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    o.connect(lp);
    lp.connect(g);
    g.connect(masterGain);
    o.start(when);
    o.stop(when + dur + 0.03);
  };

  const triggerKick = (when, peak = 0.16) => {
    if (!ctx || !masterGain) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(105, when);
    o.frequency.exponentialRampToValueAtTime(46, when + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, when);
    g.gain.exponentialRampToValueAtTime(0.0008, when + 0.16);
    o.connect(g);
    g.connect(masterGain);
    o.start(when);
    o.stop(when + 0.18);
  };

  const triggerBrush = (when, dur = 0.055, peak = 0.04, hpHz = 2800) => {
    if (!ctx || !masterGain || !noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(hpHz, when);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, when);
    g.gain.exponentialRampToValueAtTime(0.0005, when + dur);
    src.connect(hp);
    hp.connect(g);
    g.connect(masterGain);
    src.start(when);
    src.stop(when + dur + 0.02);
  };

  const triggerRim = (when, peak = 0.045) => {
    if (!ctx || !masterGain) return;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(640, when);
    o.frequency.exponentialRampToValueAtTime(380, when + 0.03);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, when);
    g.gain.exponentialRampToValueAtTime(0.0005, when + 0.038);
    o.connect(g);
    g.connect(masterGain);
    o.start(when);
    o.stop(when + 0.045);
  };

  // Sahira Signature Boutique Jingle (~2.6s warm bell + Rhodes chime)
  const playJingle = () => {
    if (!ensureAudioGraph() || !ctx) return;
    const now = ctx.currentTime + 0.04;
    triggerChord([349.23, 440.00, 523.25, 659.25], now, 1.0, 0.075, 0.03); // Fmaj7 swell
    triggerRhodesNote(1046.50, now + 0.08, 0.7, 0.08);  // C6 chime
    triggerRhodesNote(987.77, now + 0.34, 0.7, 0.075);  // B5
    triggerRhodesNote(783.99, now + 0.60, 0.85, 0.08);  // G5
    triggerChord([392.00, 493.88, 587.33, 659.25], now + 0.92, 0.9, 0.068, 0.028); // G13
    triggerRhodesNote(880.00, now + 0.96, 0.7, 0.075);  // A5
    triggerRhodesNote(1174.66, now + 1.24, 0.75, 0.078); // D6
    triggerChord([261.63, 329.63, 392.00, 493.88, 587.33], now + 1.56, 1.85, 0.078, 0.032); // Cmaj9 resolve
    triggerRhodesNote(1046.50, now + 1.66, 1.5, 0.085); // C6 resolve shimmer
  };

  const runLoopStep = () => {
    if (!playing || !ctx || ducked) return;
    const vibe = VIBES[prefs.vibe] || VIBES.lofi;
    const s = stepIdx % 64;
    const bar = Math.floor(s / 16);
    const beatStep = s % 16;
    const swingOffset = (beatStep % 2 === 1) ? vibe.swingMs / 1000 : 0;
    const when = ctx.currentTime + 0.045 + swingOffset;

    const chord = vibe.chords[bar % vibe.chords.length];
    const bassNote = vibe.bass[bar % vibe.bass.length];

    if (prefs.vibe === 'velvet') {
      if (beatStep === 0) {
        triggerChord(chord, when, 3.2, 0.052, 0.06);
        triggerBass(bassNote, when, 1.5, 0.1);
      } else if (beatStep === 8) {
        triggerChord(chord.slice(1, 4), when, 1.8, 0.035, 0.05);
      }
      if (beatStep % 2 === 0) {
        const note = vibe.melody[(bar * 2 + Math.floor(beatStep / 2)) % vibe.melody.length];
        if (note) triggerRhodesNote(note, when, 1.45, 0.055);
      }
    } else if (prefs.vibe === 'bossa') {
      if (beatStep === 0 || beatStep === 3 || beatStep === 6 || beatStep === 10 || beatStep === 13) {
        triggerChord(chord, when, beatStep === 0 ? 1.2 : 0.55, beatStep === 0 ? 0.055 : 0.038, 0.018);
      }
      if (beatStep === 0 || beatStep === 8) {
        triggerBass(beatStep === 0 ? bassNote : bassNote * 1.498, when, 0.55, 0.13);
      }
      if (beatStep === 0 || beatStep === 6 || beatStep === 8 || beatStep === 14) {
        triggerKick(when, 0.12);
      }
      if (beatStep === 2 || beatStep === 6 || beatStep === 10 || beatStep === 14) {
        triggerRim(when, 0.038);
      }
      if (beatStep % 2 === 0) {
        triggerBrush(when, 0.035, 0.025, 3600);
      }
      if (beatStep % 4 === 2) {
        const note = vibe.melody[(bar * 4 + Math.floor(beatStep / 4)) % vibe.melody.length];
        if (note) triggerRhodesNote(note, when, 0.72, 0.048);
      }
    } else {
      // Warm Cafe Lo-Fi
      if (beatStep === 0) {
        triggerChord(chord, when, 2.35, 0.055, 0.03);
        triggerBass(bassNote, when, 0.85, 0.14);
      } else if (beatStep === 10) {
        triggerChord(chord.slice(1, 4), when, 0.85, 0.034, 0.025);
        triggerBass(bassNote * 1.498, when, 0.45, 0.1);
      }
      if (beatStep === 0 || beatStep === 10) {
        triggerKick(when, 0.15);
      }
      if (beatStep === 4 || beatStep === 12) {
        triggerBrush(when, 0.075, 0.045, 1900);
        triggerRim(when, 0.028);
      } else if (beatStep % 2 === 0) {
        triggerBrush(when, 0.035, 0.02, 3900);
      }
      if (beatStep === 2 || beatStep === 6 || beatStep === 14) {
        const mNote = vibe.melody[(bar * 3 + Math.floor(beatStep / 4)) % vibe.melody.length];
        if (mNote && Math.random() > 0.18) {
          triggerRhodesNote(mNote, when, 0.95, 0.052);
        }
      }
    }

    stepIdx++;
  };

  const syncUI = () => {
    const activeVibe = VIBES[prefs.vibe] || VIBES.lofi;
    dock.classList.toggle('is-playing', playing && !ducked);
    playBtn.setAttribute('aria-pressed', String(playing));
    if (labelEl) {
      labelEl.textContent = playing ? (ducked ? 'Dijeda' : activeVibe.name.split(' ')[0]) : 'Cafe Vibe';
    }
    if (statusEl) {
      statusEl.textContent = playing
        ? (ducked ? 'Dijeda untuk Audio Reel' : `Sedang Main · ${activeVibe.name}`)
        : 'Jingle & Cafe Santai';
    }
    popover?.querySelectorAll('[data-cafe-vibe]').forEach(btn => {
      const isSel = btn.getAttribute('data-cafe-vibe') === prefs.vibe;
      btn.classList.toggle('is-active', isSel);
      btn.setAttribute('aria-checked', String(isSel));
    });
    if (volRange) volRange.value = String(Math.round(prefs.volume * 100));
    if (volVal) volVal.textContent = `${Math.round(prefs.volume * 100)}%`;
  };

  const clearTimers = () => {
    if (loopTimer) {
      clearInterval(loopTimer);
      loopTimer = null;
    }
    if (jingleTimeout) {
      clearTimeout(jingleTimeout);
      jingleTimeout = null;
    }
  };

  const startLoop = (withJingle = false) => {
    if (!ensureAudioGraph()) return;
    clearTimers();
    playing = true;
    startWarmthBed();
    const vibe = VIBES[prefs.vibe] || VIBES.lofi;
    if (withJingle) {
      playJingle();
      stepIdx = 0;
      jingleTimeout = setTimeout(() => {
        jingleTimeout = null;
        if (!playing) return;
        runLoopStep();
        loopTimer = setInterval(runLoopStep, vibe.stepMs);
      }, 2450);
    } else {
      runLoopStep();
      loopTimer = setInterval(runLoopStep, vibe.stepMs);
    }
    syncUI();
  };

  const stopLoop = () => {
    playing = false;
    clearTimers();
    stopWarmthBed();
    syncUI();
  };

  playBtn.addEventListener('click', () => {
    ducked = false;
    pausedByMedia = false;
    if (playing) {
      stopLoop();
    } else {
      startLoop(true);
    }
  });

  menuBtn?.addEventListener('click', e => {
    e.stopPropagation();
    if (!popover) return;
    const willOpen = popover.hidden;
    popover.hidden = !willOpen;
    menuBtn.setAttribute('aria-expanded', String(willOpen));
  });

  jingleBtn?.addEventListener('click', () => {
    ducked = false;
    pausedByMedia = false;
    startLoop(true);
  });

  popover?.querySelectorAll('[data-cafe-vibe]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-cafe-vibe');
      if (!next || !VIBES[next]) return;
      prefs.vibe = next;
      savePrefs();
      if (playing) {
        startLoop(false);
      } else {
        startLoop(true);
      }
      syncUI();
    });
  });

  volRange?.addEventListener('input', () => {
    const pct = Math.min(100, Math.max(0, Number(volRange.value) || 0));
    prefs.volume = pct / 100;
    savePrefs();
    if (masterGain && ctx) {
      masterGain.gain.setTargetAtTime(ducked ? 0.001 : prefs.volume * 0.65, ctx.currentTime, 0.06);
    }
    syncUI();
  });

  document.addEventListener('click', e => {
    if (popover && !popover.hidden && !dock.contains(e.target)) {
      popover.hidden = true;
      menuBtn?.setAttribute('aria-expanded', 'false');
    }
  });

  window.SahiraCafeAudio = {
    isPlaying: () => playing && !ducked,
    playJingle,
    duckForMedia(shouldDuck) {
      ducked = Boolean(shouldDuck);
      if (ducked && playing) {
        pausedByMedia = true;
      } else if (!ducked && pausedByMedia) {
        pausedByMedia = false;
      }
      if (masterGain && ctx) {
        masterGain.gain.setTargetAtTime(ducked ? 0.0008 : prefs.volume * 0.65, ctx.currentTime, 0.1);
      }
      if (warmthGain && ctx) {
        warmthGain.gain.setTargetAtTime(ducked ? 0.0001 : 0.035, ctx.currentTime, 0.1);
      }
      syncUI();
    }
  };

  syncUI();
}

// Initial apply on boot
// Initialize Supabase database before rendering, then apply config
(async () => {
  await initDatabase();
  // After DB init, reload config from cache
  activeConfig = getStoredAdminConfig();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyConfigToDOM(activeConfig);
      setupAdminPortal();
      setupCafeAudio();
      if (window.location.hash === '#hand-rail-pro') {
        window.OrbitGallery?.setView('rail', { skipHash: true });
      }
    });
  } else {
    applyConfigToDOM(activeConfig);
    setupAdminPortal();
    setupCafeAudio();
    if (window.location.hash === '#hand-rail-pro') {
      window.OrbitGallery?.setView('rail', { skipHash: true });
    }
  }
})();
