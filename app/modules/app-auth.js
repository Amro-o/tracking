// ══════════════════════════════════════════════════════════
//  AUTH — multi-account with roles
// ══════════════════════════════════════════════════════════

const ROLE_PAGES = {
  admin:     ['dashboard','attendance','students','quran','classes','teachers','checkin','holidays','calendar','reports','sync','settings','whatsapp','accounts'],
  moderator: ['dashboard','attendance','students','classes','teachers','checkin','holidays','calendar','reports','settings'],
  teacher:   ['dashboard','attendance','quran','students','settings'],
};

let currentRole            = 'admin';
let currentUserId          = '';
let currentUserName        = '';
let currentAssignedClasses = [];

const AUTH_KEY       = 'halaqat_auth_v2';
const SAVED_USER_KEY = 'halaqat_saved_user'; // persists through lock — only cleared on logout

/* ── Session helpers ─────────────────────────────── */
function _saveSession(data) {
  currentRole            = data.role            || 'admin';
  currentUserId          = data.userId          || '';
  currentUserName        = data.name            || data.username || '';
  currentAssignedClasses = data.assignedClasses || [];
  const payload = JSON.stringify({
    role: currentRole, userId: currentUserId,
    name: currentUserName, assignedClasses: currentAssignedClasses,
    username: data.username || ''
  });
  // sessionStorage: survives Ctrl+R but clears on tab close
  sessionStorage.setItem(AUTH_KEY, payload);
  // Always save the username for quick-unlock screen — survives lock
  localStorage.setItem(SAVED_USER_KEY, JSON.stringify({
    username: data.username || '',
    name:     currentUserName,
  }));
}

function _loadSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    const s = JSON.parse(raw || 'null');
    if (!s || !s.role) return false;
    currentRole = s.role; currentUserId = s.userId || '';
    currentUserName = s.name || ''; currentAssignedClasses = s.assignedClasses || [];
    return true;
  } catch(e) { return false; }
}

function _getSavedUser() {
  try { return JSON.parse(localStorage.getItem(SAVED_USER_KEY) || 'null'); } catch(e) { return null; }
}

/* ── Login screen helpers ─────────────────────────── */
function loginShowQuickForm() {
  const saved = _getSavedUser();
  if (!saved) { loginShowFullForm(); return; }
  document.getElementById('loginQuickForm').classList.remove('hidden');
  document.getElementById('loginFullForm').classList.add('hidden');
  const nameEl   = document.getElementById('loginQuickName');
  const avatarEl = document.getElementById('loginQuickAvatar');
  if (nameEl)   nameEl.textContent   = saved.name || saved.username;
  if (avatarEl) avatarEl.textContent = (saved.name || saved.username || '؟').charAt(0);
  _dialReset();
  bioCheckAndShow();
}

function loginShowFullForm() {
  document.getElementById('loginQuickForm').classList.add('hidden');
  document.getElementById('loginFullForm').classList.remove('hidden');
  setTimeout(() => document.getElementById('loginUsername')?.focus(), 100);
}

function loginSwitchUser() {
  // "تغيير الحساب" — show full form without wiping saved user yet
  loginShowFullForm();
}

function loginTogglePw(btn) {
  const inp = document.getElementById('loginPassword');
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = show
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}
function loginTogglePw2(btn) {
  const inp = document.getElementById('loginQuickPassword');
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = show
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

function canAccess(page) { return currentRole === 'admin' || (ROLE_PAGES[currentRole] || []).includes(page); }

// Returns only the classes the current user can see
function visibleClasses() {
  if (currentRole !== 'teacher') return state.classes;
  return state.classes.filter(c => currentAssignedClasses.includes(c.id));
}
// Returns only students in visible classes
function visibleStudents() {
  if (currentRole !== 'teacher') return state.students;
  const ids = new Set(currentAssignedClasses);
  return state.students.filter(s => ids.has(s.classId));
}

function applyRoleUI() {
  const isAdmin    = currentRole === 'admin';
  const isMod      = currentRole === 'moderator';
  const isTeacher  = currentRole === 'teacher';
  const allowed    = ROLE_PAGES[currentRole] || [];

  // Sidebar nav items
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.style.display = (isAdmin || allowed.includes(el.dataset.page)) ? '' : 'none';
  });

  // Bottom navs — teacher gets its own, everyone else gets admin nav
  const bnavAdmin   = document.getElementById('bnavAdmin');
  const bnavTeacher = document.getElementById('bnavTeacher');
  if (bnavAdmin)   bnavAdmin.classList.toggle('hidden', isTeacher);
  if (bnavTeacher) bnavTeacher.classList.toggle('hidden', !isTeacher);

  // Hide notification bell entirely for teachers
  ['notifBellBtn','notifBellBtnMobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isTeacher ? 'none' : '';
  });
  const badge = document.getElementById('headerRoleBadge');
  if (badge) {
    const labels = { admin:'مدير', moderator:'مشرف', teacher:'معلم' };
    const colors = { admin:'var(--primary)', moderator:'var(--accent)', teacher:'var(--success)' };
    badge.textContent = (currentUserName ? currentUserName + ' · ' : '') + (labels[currentRole] || currentRole);
    badge.style.background = colors[currentRole] || 'var(--primary)';
    badge.classList.remove('hidden');
  }
}

// ── PIN dial state ──────────────────────────────────────
let _dialBuffer = '';
const DIAL_MAX = 4; // 4-digit PIN — auto-submits when full

function dialPress(digit) {
  if (_dialBuffer.length >= DIAL_MAX) return;
  _dialBuffer += digit;
  _dialUpdateDots();
  if (_dialBuffer.length === DIAL_MAX) {
    // Small delay so the last dot animates before submitting
    setTimeout(pinSubmit, 120);
  }
}
function dialDelete() {
  if (!_dialBuffer.length) return;
  _dialBuffer = _dialBuffer.slice(0, -1);
  _dialUpdateDots();
}
function _dialUpdateDots() {
  const len = _dialBuffer.length;
  for (let i = 0; i < DIAL_MAX; i++) {
    const dot = document.getElementById('d' + (i + 1));
    if (dot) dot.classList.toggle('filled', i < len);
  }
}
function _dialReset() {
  _dialBuffer = '';
  _dialUpdateDots();
}

// Physical keyboard handled by existing DOMContentLoaded listener above

function pinPress(digit) { dialPress(String(digit)); }
function pinClear()      { dialDelete(); }
function updatePinDots() { _dialUpdateDots(); }

async function pinSubmit(overridePin) {
  const errEl = document.getElementById('pinError');

  const quickFormVisible = !document.getElementById('loginQuickForm')?.classList.contains('hidden');
  let username, password;

  if (quickFormVisible) {
    const saved = _getSavedUser();
    username = saved?.username || '';
    password = overridePin || _dialBuffer;
    if (!password) {
      if (errEl) { errEl.textContent = 'أدخل كلمة المرور.'; setTimeout(()=>errEl.textContent='',2500); }
      return;
    }
  } else {
    username = (document.getElementById('loginUsername')?.value || '').trim();
    password = document.getElementById('loginPassword')?.value || overridePin || '';
    if (!username || !password) {
      if (errEl) errEl.textContent = 'أدخل اسم المستخدم وكلمة المرور.';
      return;
    }
  }

  if (errEl) errEl.textContent = '';

  try {
    const res  = await fetch(`${API}/auth/verify`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (data.valid) {
      data.username = username; // ensure we save it
      _saveSession(data);
      // Clear dial + password fields
      _dialReset();
      if (document.getElementById('loginPassword')) document.getElementById('loginPassword').value = '';

      // ── Hide ALL pages immediately to prevent flash of wrong dashboard ──
      document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));

      document.getElementById('pinScreen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      applyRoleUI();

      // After tab close+reopen, always go home — only restore within the same session
      const _savedPage = new URLSearchParams(location.search).get('page')
        || sessionStorage.getItem('halaqat_last_page')
        || 'dashboard';
      await loadAll(); await loadAndDisplayLogos(); navigate(_savedPage);
      refreshNotifBadge();
      waUpdateNavBadge();
      bioOfferEnroll(password);
      // Real-time WA badge via SSE — admin/moderator only
      if (currentRole !== 'teacher') {
      (function() {
        var es = null;
        var _lastQueueCount = -1;
        function connectSSE() {
          if (es) { try { es.close(); } catch(e){} }
          es = new EventSource('/api/whatsapp/queue/stream');
          es.onmessage = function(e) {
            var count = parseInt(e.data, 10);
            if (isNaN(count)) return;
            var label = count > 99 ? '99+' : (count > 0 ? String(count) : '');
            ['waQueueBadge','menuWaBadge'].forEach(function(id) {
              var el = document.getElementById(id);
              if (!el) return;
              el.textContent = label;
              el.classList.toggle('hidden', count === 0);
            });
            var tc = document.getElementById('waTabCount');
            if (tc) { tc.textContent = label; tc.classList.toggle('hidden', count === 0); }
            _waQueueNotifCount = count;
            refreshNotifBadge();
            if (_lastQueueCount !== -1 && count > _lastQueueCount) {
              showQueueNotif(count);
            }
            _lastQueueCount = count;
          };
          es.onerror = function() {
            try { es.close(); } catch(e){}
            setTimeout(connectSSE, 5000);
          };
        }
        connectSSE();
        setInterval(waUpdateNavBadge, 60000);
      })();

      // Unified real-time events stream (attendance, future events)
      (function() {
        var _es = null;
        function connectEvents() {
          if (_es) { try { _es.close(); } catch(e){} }
          _es = new EventSource('/api/events/stream?role=' + encodeURIComponent(currentRole));
          _es.addEventListener('attendance', function(e) {
            try {
              var d = JSON.parse(e.data);
              showAttendanceNotif(d);
            } catch(err) {}
          });
          _es.onerror = function() {
            try { _es.close(); } catch(e){}
            setTimeout(connectEvents, 8000);
          };
        }
        connectEvents();
      })();

      } // end teacher guard

      // ── Fonnte device status — admin/moderator only ──
      if (currentRole !== 'teacher') {
      (function() {
        var _lastDeviceStatus = null;
        var _devicePollTimer  = null;

        function showFonnteNotif(connected) {
          var existing = document.getElementById('fonnteStatusNotif');
          if (existing) existing.remove();
          var notif = document.createElement('div');
          notif.id = 'fonnteStatusNotif';
          notif.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
            'color:#fff;border-radius:12px;padding:14px 20px;font-size:14px;font-weight:600;' +
            'box-shadow:0 8px 32px rgba(0,0,0,0.3);z-index:9999;display:flex;align-items:center;' +
            'gap:12px;min-width:280px;animation:slideDown 0.3s ease;' +
            (connected ? 'background:#14532d;border-right:4px solid #22c55e;' : 'background:#7f1d1d;border-right:4px solid #ef4444;');
          notif.innerHTML = (connected
            ? '<span style="font-size:18px">✅</span><div><div>واتساب متصل الآن</div><div style="font-size:11px;opacity:.75;margin-top:2px;font-weight:400">الجهاز جاهز للإرسال</div></div>'
            : '<span style="font-size:18px">❌</span><div><div>واتساب انقطع الاتصال</div><div style="font-size:11px;opacity:.75;margin-top:2px;font-weight:400">تحقق من هاتفك</div></div>');
          var closeBtn = document.createElement('button');
          closeBtn.innerHTML = '✕';
          closeBtn.style.cssText = 'background:none;border:none;color:rgba(255,255,255,0.6);cursor:pointer;font-size:16px;padding:0 0 0 8px;margin-right:auto;';
          closeBtn.onclick = function() { notif.remove(); };
          notif.appendChild(closeBtn);
          document.body.appendChild(notif);
          setTimeout(function() { if (notif.parentNode) notif.remove(); }, 8000);
        }

        async function pollDeviceStatus() {
          try {
            var res  = await fetch('/api/fonnte/device');
            var data = await res.json();
            if (!data) return;
            if (data.reason === 'rate limit') {
              clearTimeout(_devicePollTimer);
              _devicePollTimer = setTimeout(pollDeviceStatus, 60000);
              return;
            }
            if (data.status !== true) return;
            var ds = (data.device_status || '').toLowerCase();
            var connected = ds === 'connect' || ds === 'connected';
            var statusKey = connected ? 'connect' : 'disconnect';
            fonnteShowDeviceCard(connected, data);
            if (_lastDeviceStatus !== null && _lastDeviceStatus !== statusKey) {
              showFonnteNotif(connected);
              if (connected && _waQueueNotifCount > 0) {
                setTimeout(function() { showQueueNotif(_waQueueNotifCount); }, 3000);
              }
            }
            _lastDeviceStatus = statusKey;
            clearTimeout(_devicePollTimer);
            _devicePollTimer = setTimeout(pollDeviceStatus, connected ? 30000 : 10000);
          } catch(e) {
            clearTimeout(_devicePollTimer);
            _devicePollTimer = setTimeout(pollDeviceStatus, 15000);
          }
        }
        setTimeout(pollDeviceStatus, 3000);
      })();
      } // end teacher guard for Fonnte

    } else {
      if (errEl) { errEl.textContent = 'كلمة المرور غير صحيحة.'; setTimeout(()=>errEl.textContent='',2500); }
      // Shake and clear the dial
      const dotsRow = document.getElementById('pinDisplay');
      if (dotsRow) { dotsRow.classList.add('pin-shake'); setTimeout(()=>dotsRow.classList.remove('pin-shake'),500); }
      _dialReset();
      if (document.getElementById('loginPassword')) {
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginPassword').focus();
      }
    }
  } catch(e) {
    if (errEl) errEl.textContent = 'تعذّر الاتصال بالخادم.';
  }
}

/* ── lockApp: just lock the screen, keep username saved ── */
function lockApp() {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem('halaqat_last_page'); // always go home after locking
  localStorage.removeItem(AUTH_KEY); // clear any legacy localStorage token
  currentRole = 'admin'; currentUserId = ''; currentUserName = ''; currentAssignedClasses = [];
  _dialReset();
  if (document.getElementById('loginPassword')) document.getElementById('loginPassword').value = '';
  if (document.getElementById('pinError'))      document.getElementById('pinError').textContent = '';
  document.getElementById('headerRoleBadge')?.classList.add('hidden');
  const saved = _getSavedUser();
  if (saved) { loginShowQuickForm(); } else { loginShowFullForm(); }
  document.getElementById('pinScreen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  closeSidebar();
  bioCheckAndShow();
}

/* ── logoutApp: full logout — wipe everything including saved username ── */
function logoutApp() {
  sessionStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_KEY); // clear any legacy localStorage token
  localStorage.removeItem(SAVED_USER_KEY);
  localStorage.removeItem('halaqat_last_page');
  sessionStorage.removeItem('halaqat_last_page');
  sessionStorage.removeItem('halaqat_auth');
  currentRole = 'admin'; currentUserId = ''; currentUserName = ''; currentAssignedClasses = [];
  _dialReset();
  if (document.getElementById('loginUsername'))  document.getElementById('loginUsername').value = '';
  if (document.getElementById('loginPassword'))  document.getElementById('loginPassword').value = '';
  if (document.getElementById('pinError'))       document.getElementById('pinError').textContent = '';
  document.getElementById('headerRoleBadge')?.classList.add('hidden');
  loginShowFullForm();
  document.getElementById('pinScreen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  closeSidebar();
}

function confirmLogout() {
  if (confirm('تسجيل الخروج؟\n\nستحتاج لإدخال اسم المستخدم وكلمة المرور في المرة القادمة.')) {
    logoutApp();
  }
}

// ══════════════════════════════════════════════════════════
//  بيومتري — WebAuthn (بصمة الإصبع / Face ID)
// ══════════════════════════════════════════════════════════
const BIO_CRED_KEY = 'halaqat_bio_cred';
const BIO_PIN_KEY  = 'halaqat_bio_pin';

function bioIsAvailable() {
  return !!window.PublicKeyCredential;
}

// Show or hide the fingerprint button on the PIN screen
async function bioCheckAndShow() {
  const btn = document.getElementById('dialBioBtn');
  if (!btn) return;
  if (!bioIsAvailable()) { btn.style.display = 'none'; return; }
  const cred = localStorage.getItem(BIO_CRED_KEY);
  const pin  = localStorage.getItem(BIO_PIN_KEY);
  if (!cred || !pin) { btn.style.display = 'none'; return; }
  btn.style.display = 'flex';
  // Auto-trigger biometric login on mobile after a short delay
  if (navigator.maxTouchPoints > 0) {
    setTimeout(() => bioLogin(true), 600);
  }
}

// Triggered by tapping the fingerprint button
async function bioLogin(silent = false) {
  const credB64 = localStorage.getItem(BIO_CRED_KEY);
  const pin     = localStorage.getItem(BIO_PIN_KEY);
  if (!credB64 || !pin) return;

  const btn = document.getElementById('dialBioBtn');
  if (btn) { btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }

  try {
    const credId   = Uint8Array.from(atob(credB64), c => c.charCodeAt(0));
    const hostname = window.location.hostname || 'localhost';
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge:        crypto.getRandomValues(new Uint8Array(32)),
        rpId:             hostname,
        userVerification: 'required',
        timeout:          60000,
        allowCredentials: [{ id: credId, type: 'public-key' }],
      }
    });
    if (btn) { btn.style.opacity = ''; btn.style.pointerEvents = ''; }
    if (assertion) {
      await pinSubmit(pin);
    }
  } catch(e) {
    if (btn) { btn.style.opacity = ''; btn.style.pointerEvents = ''; }
    if (e.name === 'NotAllowedError') return; // user cancelled
    if (e.name === 'NotFoundError' || e.name === 'InvalidStateError') {
      localStorage.removeItem(BIO_CRED_KEY);
      localStorage.removeItem(BIO_PIN_KEY);
      bioCheckAndShow();
    }
    if (!silent) {
      const errEl = document.getElementById('pinError');
      if (errEl) { errEl.textContent = 'تعذّر التحقق البيومتري — أدخل كلمة المرور.'; setTimeout(()=>{errEl.textContent='';},3000); }
    }
  }
}

// Offer biometric enrollment after first successful login
async function bioOfferEnroll(pin) {
  if (!window.PublicKeyCredential) return;
  if (localStorage.getItem(BIO_CRED_KEY)) return; // already enrolled
  // Only offer on touch devices (phones/tablets)
  if (!navigator.maxTouchPoints || navigator.maxTouchPoints === 0) return;

  // Remove any old banner
  document.getElementById('bioOfferBanner')?.remove();

  const banner = document.createElement('div');
  banner.id = 'bioOfferBanner';
  banner.className = 'bio-offer-banner';
  banner.innerHTML = `
    <div class="bio-offer-icon">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 10a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0v-4a2 2 0 0 0-2-2z"/>
        <path d="M12 6a6 6 0 0 1 6 6v2a6 6 0 0 1-6 6 6 6 0 0 1-6-6v-2a6 6 0 0 1 6-6z"/>
        <path d="M12 2a10 10 0 0 1 10 10v2a10 10 0 0 1-10 10A10 10 0 0 1 2 14v-2A10 10 0 0 1 12 2z"/>
      </svg>
    </div>
    <div class="bio-offer-text">
      <strong>تفعيل الدخول البيومتري</strong>
      <span>سجّل دخولك بلمسة إصبع أو بصمة الوجه في المرة القادمة</span>
    </div>
    <div class="bio-offer-actions">
      <button class="btn-secondary" onclick="document.getElementById('bioOfferBanner').remove()">لاحقاً</button>
      <button class="btn-primary" id="bioEnrollBtn" onclick="bioEnroll('${pin.replace(/'/g,"\\'")}')">تفعيل</button>
    </div>`;
  document.body.appendChild(banner);
  requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('bio-offer-banner--show')));
  // Auto-dismiss after 20s
  setTimeout(() => { if (banner.parentNode) { banner.classList.remove('bio-offer-banner--show'); setTimeout(() => banner.remove(), 400); } }, 20000);
}

// Register the WebAuthn credential
async function bioEnroll(pin) {
  document.getElementById('bioOfferBanner')?.remove();
  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'حلقات مجمع الخير', id: window.location.hostname || 'localhost' },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'admin', displayName: 'المشرف' },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000,
      }
    });
    if (credential) {
      const credB64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      localStorage.setItem(BIO_CRED_KEY, credB64);
      localStorage.setItem(BIO_PIN_KEY, pin);
      localStorage.setItem('halaqat_bio_user', currentUserId || 'admin');
      toast('<span data-toast="ok"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span> تم تفعيل الدخول البيومتري بنجاح');
    }
  } catch(e) {
    if (e.name !== 'NotAllowedError') toast('<span data-toast="err">⚠️</span> تعذّر تفعيل البيومتري. تأكد من دعم الجهاز لهذه الميزة.');
  }
}

// Revoke / remove stored biometric (can be called from settings)
function bioRevoke() {
  localStorage.removeItem(BIO_CRED_KEY);
  localStorage.removeItem(BIO_PIN_KEY);
  document.getElementById('bioBtnLogin')?.classList.add('hidden');
  toast('تم إلغاء تفعيل البصمة');
}