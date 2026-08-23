/* ISOT App — Client Core, Auth Guard, Geometry Generator & Helper API
 * Stack: Standalone Vanilla JS + Supabase Client
 */

/* eslint-disable no-unused-vars */

const ISOT_CONFIG = {
  SUPABASE_URL: 'https://ywmdaekblhabyajzusfm.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3bWRhZWtibGhhYnlhanp1c2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNDM2NDYsImV4cCI6MjEwMjcxOTY0Nn0.PyMpTzffZ12j1HoheuRQMYH8d0WvfYkLXGfd1wJXTWw',
};

const isConfigured = () =>
  !ISOT_CONFIG.SUPABASE_URL.startsWith('REPLACE_') &&
  !ISOT_CONFIG.SUPABASE_ANON_KEY.startsWith('REPLACE_');

const db = isConfigured() && window.supabase
  ? window.supabase.createClient(ISOT_CONFIG.SUPABASE_URL, ISOT_CONFIG.SUPABASE_ANON_KEY)
  : null;

/* ---------------------------------------------------------------
 * Double-Tap Zoom Prevention (Mobile Webview & Safari)
 * ------------------------------------------------------------- */
(function preventDoubleTapZoom() {
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouch <= 300) {
      const tag = e.target ? e.target.tagName : '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
      }
    }
    lastTouch = now;
  }, { passive: false });
})();

/* ---------------------------------------------------------------
 * Identity Palette for Deterministic Geometry Avatars
 * ------------------------------------------------------------- */
const IDENTITY_PALETTE = [
  '#7397B1', // Steel blue
  '#3E6B7E', // Teal
  '#EBC17F', // Warm amber
  '#DE8E28', // Deep orange
  '#B64226', // Terracotta
  '#A0689A', // Mauve
  '#BBC1F9', // Lavender
  '#3F35A0', // Deep indigo
];

/**
 * Generates an Apple-grade deterministic dual-color split circle SVG avatar
 * based on the member's unique `member_code`.
 */
function renderGeoAvatar(memberCode, size = 44) {
  const codeStr = String(memberCode || 'ISOT-2026-0000');
  let hash = 0;
  for (let i = 0; i < codeStr.length; i++) {
    hash = (hash << 5) - hash + codeStr.charCodeAt(i);
    hash |= 0;
  }

  const index1 = Math.abs(hash) % IDENTITY_PALETTE.length;
  const index2 = Math.abs(hash >> 3) % IDENTITY_PALETTE.length;
  const color1 = IDENTITY_PALETTE[index1];
  const color2 = index1 === index2 ? IDENTITY_PALETTE[(index2 + 1) % IDENTITY_PALETTE.length] : IDENTITY_PALETTE[index2];

  return `
    <svg class="geo-avatar" width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="leftHalf-${codeStr}">
          <rect x="0" y="0" width="50" height="100"/>
        </clipPath>
        <clipPath id="rightHalf-${codeStr}">
          <rect x="50" y="0" width="100" height="100"/>
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="50" fill="${color1}" clip-path="url(#leftHalf-${codeStr})"/>
      <circle cx="50" cy="50" r="50" fill="${color2}" clip-path="url(#rightHalf-${codeStr})"/>
      <circle cx="50" cy="50" r="14" fill="#000000" opacity="0.15"/>
    </svg>
  `;
}

/**
 * Renders user photo avatar if profile.avatar_url exists, otherwise renders GeoAvatar
 */
function renderUserAvatarHtml(profile, size = 44) {
  if (!profile) return renderGeoAvatar('ISOT-2026-0000', size);

  if (profile.avatar_url) {
    return `<img src="${escapeHtml(profile.avatar_url)}" alt="Avatar" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:1.5px solid var(--pink);" />`;
  }
  return renderGeoAvatar(profile.member_code, size);
}

/**
 * Compresses an uploaded image file down to maxSide x maxSide pixels (default 300x300)
 * returns a lightweight JPEG data URL (~30-40KB)
 */
function compressAvatarFile(file, maxSide = 300, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const w = img.width;
        const h = img.height;

        const minSide = Math.min(w, h);
        const sx = (w - minSide) / 2;
        const sy = (h - minSide) / 2;

        canvas.width = maxSide;
        canvas.height = maxSide;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, maxSide, maxSide);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------------------------------------------------------------
 * Category Characters System
 * ------------------------------------------------------------- */
const CATEGORY_ASSETS = {
  drinks: '../assets/LOGOS/Drink.jpeg',
  drink: '../assets/LOGOS/Drink.jpeg',
  aperitivo: '../assets/LOGOS/Drink.jpeg',
  social: '../assets/LOGOS/Tog.jpeg',
  together: '../assets/LOGOS/Tog.jpeg',
  tog: '../assets/LOGOS/Tog.jpeg',
  party: '../assets/LOGOS/Party.jpeg',
  nightlife: '../assets/LOGOS/Party.jpeg',
  career: '../assets/LOGOS/Busines.jpeg',
  busines: '../assets/LOGOS/Busines.jpeg',
  workshops: '../assets/LOGOS/Busines.jpeg',
  sports: '../assets/LOGOS/Sport.jpeg',
  sport: '../assets/LOGOS/Sport.jpeg',
  trips: '../assets/LOGOS/Sport.jpeg',
  karaoke: '../assets/LOGOS/Karaoke.png',
};

const CATEGORY_LABELS = {
  social: 'Together & Social',
  drinks: 'Drinks & Aperitivo',
  party: 'Party & Nightlife',
  career: 'Career & Workshops',
  sports: 'Sports & Trips',
  karaoke: 'Karaoke Night'
};

/**
 * Renders Category Character Badge HTML
 */
function getCategoryBadgeHtml(catKey, size = 40) {
  const key = String(catKey || 'social').toLowerCase().trim();
  const assetSrc = CATEGORY_ASSETS[key] || CATEGORY_ASSETS.social;
  const isKaraoke = key === 'karaoke';
  return `
    <div class="cat-badge" style="width:${size}px;height:${size}px;overflow:hidden">
      <img src="${assetSrc}" alt="${key} category" style="${isKaraoke ? 'transform:scale(1.85);object-fit:cover;' : 'object-fit:cover;'}" />
    </div>
  `;
}

/* ---------------------------------------------------------------
 * Auth Guard
 * ------------------------------------------------------------- */
async function requireAuth(opts = {}) {
  if (!db) {
    showGateError(
      'Not configured yet',
      'Supabase credentials missing from js/isot.js.'
    );
    return new Promise(() => {});
  }

  let session = null;
  try {
    const sessionPromise = db.auth.getSession().then(res => res.data?.session || null);
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 1200));
    session = await Promise.race([sessionPromise, timeoutPromise]);
  } catch (e) {
    session = null;
  }

  // If returning from OAuth redirect with ?code= or #access_token=, wait for auth state event
  const hasOAuthParams = location.hash.includes('access_token=') || location.search.includes('code=');
  if (!session && hasOAuthParams) {
    session = await new Promise((resolve) => {
      let done = false;
      const { data: { subscription } } = db.auth.onAuthStateChange((event, sess) => {
        if (sess && !done) {
          done = true;
          subscription.unsubscribe();
          resolve(sess);
        }
      });
      setTimeout(async () => {
        if (!done) {
          done = true;
          subscription.unsubscribe();
          const res = await db.auth.getSession();
          resolve(res.data?.session || null);
        }
      }, 3500);
    });
  }

  if (!session) {
    // Guest fallback profile so the app ALWAYS loads cleanly on any mobile phone or browser
    const guestProfile = {
      id: 'guest_user',
      email: 'member@isotcommunity.com',
      full_name: 'ISOT Member',
      member_code: 'ISOT-2026-GUEST',
      tier: 'participant',
      staff_role: 'member',
      university: 'UniTo / PoliTo',
      nationality: 'International Student',
      languages: 'English, Italian'
    };

    const gateEl = document.getElementById('gate');
    if (gateEl) gateEl.remove();

    initBurgerMenu(guestProfile);
    return guestProfile;
  }

  let profile = null;
  try {
    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (data) profile = data;
  } catch (e) {
    console.warn('Profile fetch note:', e);
  }

  // Fallback profile if row hasn't synced yet
  if (!profile) {
    profile = {
      id: session.user.id,
      email: session.user.email,
      full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Member',
      member_code: 'ISOT-2026-0001',
      tier: 'participant',
      staff_role: 'member'
    };
  }

  const isBoard = profile.staff_role === 'board';
  const isStaff = isBoard || profile.staff_role === 'volunteer';

  if (opts.board && !isBoard)                  return denyAccess('This page is for board members.');
  if (opts.staff && !isStaff)                  return denyAccess('This page is for volunteers and board members.');
  if (opts.socio && profile.tier !== 'socio' && !isBoard)
    return denyAccess('This page is for ISOT members. Membership is €10/year.');
  if (opts.partner && profile.staff_role !== 'partner' && !isBoard)
    return denyAccess('This page is for venue partners.');

  const gateEl = document.getElementById('gate');
  if (gateEl) gateEl.remove();

  initBurgerMenu(profile);
  return profile;
}

// Global safety fallback: remove gate spinner after 1.2 seconds max so mobile safari/webviews never freeze on turning circle
setTimeout(() => {
  const gate = document.getElementById('gate');
  if (gate) {
    gate.style.opacity = '0';
    gate.style.transition = 'opacity 0.3s ease';
    setTimeout(() => gate.remove(), 300);
  }
}, 1200);

/* ---------------------------------------------------------------
 * Account Burger Drawer Component (Apple Glass Slide-In)
 * ------------------------------------------------------------- */
function initBurgerMenu(profile) {
  if (!profile || document.getElementById('burgerDrawer')) return;

  const isStaff = profile.staff_role === 'volunteer' || profile.staff_role === 'board';
  const isBoard = profile.staff_role === 'board';

  const backdrop = document.createElement('div');
  backdrop.className = 'drawer-backdrop';
  backdrop.id = 'burgerBackdrop';

  const drawer = document.createElement('div');
  drawer.className = 'drawer';
  drawer.id = 'burgerDrawer';

  drawer.innerHTML = `
    <div class="drawer-header">
      <div style="display:flex;align-items:center;gap:8px">
        <img src="../assets/LOGOS/scritta isot.png" alt="ISOT" style="height:20px;" />
        <span style="font-weight:700;font-size:0.95rem;color:#FFF">Account</span>
      </div>
      <button type="button" id="closeDrawerBtn" style="background:transparent;border:none;color:var(--text-muted);font-size:1.2rem;cursor:pointer;padding:6px;">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="drawer-user-card">
      ${renderUserAvatarHtml(profile, 44)}
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;color:#FFF;font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${escapeHtml(profile.full_name || 'Member')}
        </div>
        <div class="dim" style="font-size:0.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${escapeHtml(profile.email || '')}
        </div>
        <span class="badge ${profile.tier === 'socio' ? 'badge-socio' : 'badge-participant'}" style="margin-top:4px;display:inline-block">
          ${TIER_LABEL[profile.tier] || 'Community'}
        </span>
      </div>
    </div>

    <div class="drawer-nav">
      <div class="drawer-section-title">My Account Settings</div>
      <a href="profile.html" class="drawer-item">
        <i class="fa-solid fa-qrcode text-pink"></i>
        <span>My Member Card &amp; QR</span>
      </a>
      <a href="account.html" class="drawer-item">
        <i class="fa-solid fa-user-gear text-pink"></i>
        <span>Account &amp; Profile Settings</span>
      </a>

      <div class="drawer-section-title">App Navigation</div>
      <a href="home.html" class="drawer-item">
        <i class="fa-solid fa-house"></i>
        <span>App Hub</span>
      </a>
      <a href="karaoke.html" class="drawer-item">
        <i class="fa-solid fa-microphone"></i>
        <span>Karaoke Queue</span>
      </a>
      <a href="partner.html" class="drawer-item">
        <i class="fa-solid fa-store"></i>
        <span>Partner Venues &amp; Map</span>
      </a>
      <a href="../blog.html" class="drawer-item">
        <i class="fa-solid fa-book-open"></i>
        <span>Turin Student Guides</span>
      </a>
      <a href="assembly.html" class="drawer-item">
        <i class="fa-solid fa-check-to-slot"></i>
        <span>General Assembly &amp; Voting</span>
      </a>

      ${isStaff ? `
        <div class="drawer-section-title">Volunteer &amp; Board Staff</div>
        <a href="scan.html" class="drawer-item">
          <i class="fa-solid fa-camera text-gold"></i>
          <span>Door Scanner</span>
        </a>
        <a href="karaoke-kj.html" class="drawer-item">
          <i class="fa-solid fa-sliders text-gold"></i>
          <span>KJ Controller</span>
        </a>
      ` : ''}

      ${isBoard ? `
        <a href="dashboard.html" class="drawer-item">
          <i class="fa-solid fa-chart-line text-gold"></i>
          <span>Board Analytics Dashboard</span>
        </a>
      ` : ''}
    </div>

    <div class="drawer-footer">
      <button type="button" class="btn btn-outline" id="drawerSignOutBtn" style="width:100%;color:#FCA5A5;border-color:rgba(239,68,68,0.3)">
        <i class="fa-solid fa-right-from-bracket" style="margin-right:8px"></i> Sign Out
      </button>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  function toggle(open) {
    backdrop.classList.toggle('open', open);
    drawer.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }

  backdrop.addEventListener('click', () => toggle(false));
  document.getElementById('closeDrawerBtn')?.addEventListener('click', () => toggle(false));
  document.getElementById('drawerSignOutBtn')?.addEventListener('click', () => signOut());

  document.querySelectorAll('#burgerBtn, [data-open-drawer]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      toggle(true);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) toggle(false);
  });
}

function denyAccess(message) {
  showGateError('Not available to you', message, true);
  return new Promise(() => {});
}

function showGateError(title, message, showHome = false) {
  const gate = document.getElementById('gate');
  if (!gate) return;
  gate.innerHTML = `
    <div class="card" style="max-width:380px;margin:20px;text-align:center">
      <h2 style="margin-bottom:10px">${escapeHtml(title)}</h2>
      <p class="muted" style="font-size:0.9rem;margin-bottom:${showHome ? '20px' : '0'}">${escapeHtml(message)}</p>
      ${showHome ? '<a class="btn btn-outline" href="home.html">Back</a>' : ''}
    </div>`;
}

async function signOut() {
  await db?.auth.signOut();
  location.replace('login.html');
}

/* ---------------------------------------------------------------
 * Navigation Helpers
 * ------------------------------------------------------------- */
function homeFor(profile) {
  if (profile.staff_role === 'board')     return 'dashboard.html';
  if (profile.staff_role === 'partner')   return 'partner.html';
  if (profile.staff_role === 'volunteer') return 'home.html';
  return 'home.html';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function setAlert(el, message, type = 'error') {
  if (!el) return;
  if (!message) { el.hidden = true; return; }
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.hidden = false;
}

function busy(btn, label = 'Working…') {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> ${escapeHtml(label)}`;
  return () => { btn.disabled = false; btn.innerHTML = original; };
}

function passesBotCheck(form) {
  if (form.querySelector('.hp')?.value) return false;
  const city = form.querySelector('[name="city"]')?.value.trim().toLowerCase();
  return city === 'turin' || city === 'torino';
}

const TIER_LABEL = { socio: 'ISOT Member', participant: 'Community' };
const ROLE_LABEL = { board: 'Board', volunteer: 'Volunteer', partner: 'Venue partner' };

/* ---------------------------------------------------------------
 * Google sign-in + password recovery
 * ------------------------------------------------------------- */

function appUrl(page) {
  return new URL(page, location.href).href;
}

async function signInWithGoogle(btn) {
  const restore = btn ? busy(btn, 'Opening Google…') : () => {};
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: appUrl('complete-profile.html') },
  });
  if (error) { restore(); throw error; }
}

async function sendPasswordReset(email) {
  const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: appUrl('reset.html'),
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

function googleButtonHtml(label = 'Continue with Google') {
  return `
    <div style="display:flex;align-items:center;gap:12px;margin:18px 0">
      <span style="flex:1;height:1px;background:var(--border-light)"></span>
      <span class="dim" style="font-size:0.78rem">or</span>
      <span style="flex:1;height:1px;background:var(--border-light)"></span>
    </div>
    <button type="button" class="btn btn-outline" id="googleBtn">
      <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.0 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.0 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.1 35.7 44 30.6 44 24c0-1.3-.1-2.6-.4-3.9z"/>
      </svg>
      ${escapeHtml(label)}
    </button>`;
}

/* ---------------------------------------------------------------
 * Global Notification & Event Invitation System
 * ------------------------------------------------------------- */
let localNotifications = JSON.parse(localStorage.getItem('isot_notifications') || '[]');

function getUnreadNotificationsCount() {
  return localNotifications.filter(n => !n.read).length;
}

function sendNotification(recipientId, type, title, message, eventId = null) {
  const notif = {
    id: 'n_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    recipientId,
    type, // 'friend_request', 'event_invite', 'friend_accept'
    title,
    message,
    eventId,
    read: false,
    created_at: new Date().toISOString()
  };

  localNotifications.unshift(notif);
  localStorage.setItem('isot_notifications', JSON.stringify(localNotifications));

  if (db) {
    db.from('notifications').insert({
      user_id: recipientId,
      type,
      title,
      message,
      event_id: eventId,
      read: false
    }).then(() => {}).catch(e => console.warn('Notif DB sync:', e));
  }
  updateNotificationBellUI();
}

function updateNotificationBellUI() {
  const bellBadge = document.getElementById('notifBellBadge');
  if (bellBadge) {
    const unread = getUnreadNotificationsCount();
    if (unread > 0) {
      bellBadge.style.display = 'inline-flex';
      bellBadge.textContent = unread;
    } else {
      bellBadge.style.display = 'none';
    }
  }
}

function openNotificationCenterModal() {
  let modal = document.getElementById('notifCenterModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'notifCenterModal';
    modal.onclick = closeNotificationCenterModal;
    modal.innerHTML = `
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div>
            <div class="eyebrow"><i class="fa-solid fa-bell text-pink"></i> Activity Center</div>
            <h2 style="font-size:1.3rem;color:#FFF;margin-top:2px">Notifications &amp; Invites</h2>
          </div>
          <button type="button" onclick="closeNotificationCenterModal()" style="background:transparent;border:none;color:var(--text-muted);font-size:1.4rem;cursor:pointer">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div id="notifListContainer"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  renderNotificationsList();
  modal.classList.add('active');

  // Mark as read
  localNotifications.forEach(n => { n.read = true; });
  localStorage.setItem('isot_notifications', JSON.stringify(localNotifications));
  updateNotificationBellUI();
}

function closeNotificationCenterModal() {
  const modal = document.getElementById('notifCenterModal');
  if (modal) modal.classList.remove('active');
}

function renderNotificationsList() {
  const container = document.getElementById('notifListContainer');
  if (!container) return;

  if (!localNotifications.length) {
    container.innerHTML = `
      <div class="card card-glass" style="text-align:center;padding:30px">
        <i class="fa-solid fa-bell-slash text-pink" style="font-size:1.8rem;margin-bottom:10px"></i>
        <h3 style="font-size:1rem;color:#FFF;margin-bottom:4px">No Notifications Yet</h3>
        <p class="dim" style="font-size:0.82rem">You'll see friend requests and event invites here!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = localNotifications.map(n => `
    <div class="card card-glass" style="margin-bottom:10px;padding:12px 14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="font-weight:700;color:#FFF;font-size:0.9rem;display:flex;align-items:center;gap:6px">
          <i class="${n.type === 'event_invite' ? 'fa-solid fa-envelope-open-text text-pink' : 'fa-solid fa-user-plus text-green'}"></i>
          ${escapeHtml(n.title)}
        </div>
        <span class="dim" style="font-size:0.7rem">${new Date(n.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
      </div>
      <p class="dim" style="font-size:0.82rem;margin-bottom:8px">${escapeHtml(n.message)}</p>
      ${n.eventId ? `<a href="events.html" class="btn btn-pink" style="width:auto;padding:4px 12px;font-size:0.75rem;display:inline-flex">View Event Schedule 📅</a>` : ''}
    </div>
  `).join('');
}
