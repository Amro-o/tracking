// ══════════════════════════════════════════════════════════════════
//  Custom Calendar Date Picker
//  Replaces input[type=date] — immune to Arabic locale on Android.
//  API: hidden input keeps YYYY-MM-DD value, all existing code unchanged.
// ══════════════════════════════════════════════════════════════════

(function() {
  // ── State ────────────────────────────────────────────────
  let _activeId  = null;   // which picker is open
  let _viewYear  = 0;
  let _viewMonth = 0;      // 0-based
  let _popup     = null;

  const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                     'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const DAYS_AR   = ['أح','إث','ث','أر','خ','ج','س'];

  // ── Open picker ──────────────────────────────────────────
  window._cdpOpen = function(id) {
    if (_activeId === id) { _cdpClose(); return; }
    _activeId = id;

    const hidden = document.getElementById(id);
    const btn    = document.getElementById(id + '_btn');
    if (!hidden || !btn) return;

    // Parse current value or default to today
    const today = new Date();
    let y = today.getFullYear(), m = today.getMonth();
    if (hidden.value && /^\d{4}-\d{2}-\d{2}$/.test(hidden.value)) {
      const parts = hidden.value.split('-');
      y = parseInt(parts[0]); m = parseInt(parts[1]) - 1;
    }
    _viewYear = y; _viewMonth = m;

    _buildPopup();
    _positionPopup(btn);
    document.addEventListener('click', _outsideClick, true);
  };

  // ── Build popup DOM ──────────────────────────────────────
  function _buildPopup() {
    if (!_popup) {
      _popup = document.createElement('div');
      _popup.id = 'cdpPopup';
      _popup.className = 'cdp-popup';
      _popup.onclick = e => e.stopPropagation();
      document.body.appendChild(_popup);
    }
    _renderPopup();
    _popup.classList.remove('cdp-hidden');
  }

  function _renderPopup() {
    if (!_popup) return;

    const hidden  = document.getElementById(_activeId);
    const selDate = hidden?.value || '';

    // Days in month
    const firstDay = new Date(_viewYear, _viewMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(_viewYear, _viewMonth + 1, 0).getDate();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    // Header
    let html = `
      <div class="cdp-header">
        <button class="cdp-nav" onclick="_cdpPrevMonth()">&#8249;</button>
        <div class="cdp-hm">
          <button class="cdp-month-btn" onclick="_cdpToggleMonthPicker()">${MONTHS_AR[_viewMonth]}</button>
          <button class="cdp-year-btn" onclick="_cdpToggleYearPicker()">${_viewYear}</button>
        </div>
        <button class="cdp-nav" onclick="_cdpNextMonth()">&#8250;</button>
      </div>`;

    // Day headers (Sun..Sat)
    html += '<div class="cdp-grid cdp-days-header">';
    for (const d of DAYS_AR) html += `<div class="cdp-dh">${d}</div>`;
    html += '</div><div class="cdp-grid cdp-days">';

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) html += '<div></div>';

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${_viewYear}-${String(_viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday    = iso === todayStr ? ' cdp-today' : '';
      const isSelected = iso === selDate  ? ' cdp-selected' : '';
      html += `<button class="cdp-day${isToday}${isSelected}" onclick="_cdpPick('${iso}')">${d}</button>`;
    }
    html += '</div>';

    // Today shortcut + clear
    html += `<div class="cdp-footer">
      <button class="cdp-foot-btn" onclick="_cdpPick('${todayStr}')">اليوم</button>
      <button class="cdp-foot-btn cdp-clear" onclick="_cdpClear()">مسح</button>
    </div>`;

    _popup.innerHTML = html;
  }

  // ── Month / year overlay pickers ────────────────────────
  window._cdpToggleMonthPicker = function() {
    // Replace grid with 3×4 month buttons
    const grid = _popup.querySelector('.cdp-days, .cdp-picker-overlay');
    let ov = _popup.querySelector('.cdp-picker-overlay');
    if (ov) { _renderPopup(); return; }

    ov = document.createElement('div');
    ov.className = 'cdp-picker-overlay';
    let h = '';
    MONTHS_AR.forEach((mn, i) => {
      const sel = i === _viewMonth ? ' cdp-selected' : '';
      h += `<button class="cdp-pick-item${sel}" onclick="_cdpSetMonth(${i})">${mn}</button>`;
    });
    ov.innerHTML = h;
    _popup.querySelector('.cdp-days-header')?.insertAdjacentElement('afterend', ov);
    _popup.querySelector('.cdp-days')?.classList.add('cdp-hidden');
  };

  window._cdpSetMonth = function(m) { _viewMonth = m; _renderPopup(); };

  window._cdpToggleYearPicker = function() {
    let ov = _popup.querySelector('.cdp-picker-overlay');
    if (ov) { _renderPopup(); return; }

    ov = document.createElement('div');
    ov.className = 'cdp-picker-overlay';
    let h = '';
    const curY = new Date().getFullYear();
    for (let y = curY - 5; y <= curY + 5; y++) {
      const sel = y === _viewYear ? ' cdp-selected' : '';
      h += `<button class="cdp-pick-item${sel}" onclick="_cdpSetYear(${y})">${y}</button>`;
    }
    ov.innerHTML = h;
    _popup.querySelector('.cdp-days-header')?.insertAdjacentElement('afterend', ov);
    _popup.querySelector('.cdp-days')?.classList.add('cdp-hidden');
  };

  window._cdpSetYear = function(y) { _viewYear = y; _renderPopup(); };

  // ── Navigation ───────────────────────────────────────────
  window._cdpPrevMonth = function() {
    if (_viewMonth === 0) { _viewMonth = 11; _viewYear--; }
    else _viewMonth--;
    _renderPopup();
  };
  window._cdpNextMonth = function() {
    if (_viewMonth === 11) { _viewMonth = 0; _viewYear++; }
    else _viewMonth++;
    _renderPopup();
  };

  // ── Pick a date ──────────────────────────────────────────
  window._cdpPick = function(iso) {
    const id     = _activeId;
    const hidden = document.getElementById(id);
    const btn    = document.getElementById(id + '_btn');
    const txt    = document.getElementById(id + '_txt');
    if (!hidden) return;

    hidden.value = iso;
    _updateTriggerText(id, iso);

    // Fire original onchange
    const wrap = document.getElementById(id + '_wrap') || hidden.closest('.custom-date-picker');
    const onchangeStr = wrap?.dataset?.onchange || '';
    if (onchangeStr) {
      try {
        (new Function('elem', onchangeStr.replace(/\bthis\b/g,'elem')))(hidden);
      } catch(e) {
        try { hidden.dispatchEvent(new Event('change')); } catch(e2){}
      }
    }

    _cdpClose();
  };

  window._cdpClear = function() {
    const hidden = document.getElementById(_activeId);
    const txt    = document.getElementById(_activeId + '_txt');
    if (hidden) hidden.value = '';
    if (txt)    txt.textContent = 'اختر تاريخاً';
    _cdpClose();
  };

  // ── Position popup near button ───────────────────────────
  function _positionPopup(btn) {
    if (!_popup) return;
    _popup.style.cssText = 'top:0;left:0;'; // reset
    const r   = btn.getBoundingClientRect();
    const pw  = 280;
    const ph  = 320;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;

    let top  = r.bottom + 6;
    let left = r.left;

    if (left + pw > vw - 8) left = vw - pw - 8;
    if (left < 8) left = 8;
    if (top + ph > vh - 8) top = r.top - ph - 6;

    _popup.style.top  = top  + window.scrollY + 'px';
    _popup.style.left = left + window.scrollX + 'px';
  }

  // ── Close ────────────────────────────────────────────────
  function _cdpClose() {
    _activeId = null;
    _popup?.classList.add('cdp-hidden');
    document.removeEventListener('click', _outsideClick, true);
  }
  window._cdpClose = _cdpClose;

  function _outsideClick(e) {
    if (!_popup?.contains(e.target) && !e.target.closest('.cdp-trigger')) {
      _cdpClose();
    }
  }

  // ── Update trigger button text ───────────────────────────
  function _updateTriggerText(id, iso) {
    const txt = document.getElementById(id + '_txt');
    if (!txt) return;
    if (!iso) { txt.textContent = 'اختر تاريخاً'; return; }
    try {
      const [y, m, d] = iso.split('-').map(Number);
      txt.textContent = `${d} ${MONTHS_AR[m-1]} ${y}`;
    } catch(e) { txt.textContent = iso; }
  }

  // ── Wire up all pickers (call after DOM ready or modal open) ─
  window._initCustomDatePickers = function() {
    document.querySelectorAll('.custom-date-picker').forEach(wrap => {
      if (wrap._cdpReady) return;
      wrap._cdpReady = true;

      const id = wrap.dataset.id;
      if (!id) return;

      // Override .value setter on hidden input so JS assignments update the button text
      const hidden = document.getElementById(id);
      if (!hidden) return;

      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      Object.defineProperty(hidden, 'value', {
        get() { return proto.get.call(this); },
        set(v) {
          proto.set.call(this, v || '');
          _updateTriggerText(id, v || '');
        },
        configurable: true,
      });

      // Sync existing value to button text
      if (hidden.value) _updateTriggerText(id, hidden.value);
    });
  };

  window._fixDateInputLocale = window._initCustomDatePickers;

})();


// ══════════════════════════════════════════════════════════════════
//  تهيئة Lucide Icons + Pull-to-Refresh
// ══════════════════════════════════════════════════════════════════
function _initLucideIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function _initPullToRefresh() {
  // Completely custom PTR — no library.
  // The ONLY way to reliably prevent mid-scroll triggers is to gate everything
  // at touchstart: if scrollY > 0 at that exact moment, the whole gesture is dead.

  var THRESHOLD = 64;   // px of pull needed to trigger
  var MAX_DIST  = 80;   // px max visual pull
  var MIN_DEG   = 55;   // min angle from horizontal to count as a downward pull

  // Build indicator using the same class names the library used (keeps your CSS)
  var bar = document.createElement('div');
  bar.className = 'ptr--ptr';
  var SVG_ARROW = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="7 10 12 15 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
  var SVG_SPIN  = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="ptr-spin"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
  bar.innerHTML = '<div class="ptr--text"><span class="ptr--icon">' + SVG_ARROW + '</span><span class="ptr--msg">اسحب للتحديث</span></div>';
  document.body.insertBefore(bar, document.body.firstChild);

  var iconEl = bar.querySelector('.ptr--icon');
  var msgEl  = bar.querySelector('.ptr--msg');

  // The actual scrolling element is .page-container, NOT window.
  // window.scrollY is always 0 — that's why all previous gates failed.
  var scroller = document.querySelector('.page-container') || document.body;

  var active     = false;
  var refreshing = false;
  var startY = 0, startX = 0;
  var angleLocked = false;
  var angleOk     = false;

  function scrollTop() {
    return scroller.scrollTop;
  }

  function setHeight(h) {
    bar.style.height = h + 'px';
  }

  function setReady(yes) {
    iconEl.style.transform = yes ? 'rotate(180deg)' : 'rotate(0deg)';
    msgEl.textContent = yes ? 'أطلق للتحديث' : 'اسحب للتحديث';
  }

  function reset() {
    bar.style.transition = 'height 0.25s cubic-bezier(0.22,1,0.36,1)';
    setHeight(0);
    setTimeout(function() {
      bar.style.transition = '';
      iconEl.innerHTML = SVG_ARROW;
      iconEl.style.transform = '';
      msgEl.textContent = 'اسحب للتحديث';
    }, 260);
    active = false; angleLocked = false; angleOk = false; startY = 0;
  }

  function doRefresh() {
    refreshing = true;
    iconEl.innerHTML = SVG_SPIN;
    iconEl.style.transform = '';
    msgEl.textContent = 'جارٍ التحديث…';
    setHeight(MAX_DIST);
    var page = (typeof state !== 'undefined' && state.currentPage) ? state.currentPage : 'dashboard';
    Promise.resolve(navigate(page)).finally(function() {
      setTimeout(function() { reset(); refreshing = false; }, 300);
    });
  }

  // Attach to the scroller, not document — so we read the right element's position
  scroller.addEventListener('touchstart', function(e) {
    if (refreshing) return;
    if (e.touches.length > 1) return;
    // ── THE REAL GATE: scroller must be at top when finger lands ──
    if (scrollTop() > 0) return;
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    angleLocked = false;
    angleOk     = false;
    active      = false;
  }, { passive: true });

  scroller.addEventListener('touchmove', function(e) {
    if (refreshing || startY === 0) return;

    var dy = e.touches[0].clientY - startY;
    var dx = e.touches[0].clientX - startX;

    // Dragging upward or scroller scrolled down — kill gesture
    if (dy <= 0 || scrollTop() > 0) { reset(); return; }

    // One-time angle check
    if (!angleLocked && (Math.abs(dy) + Math.abs(dx)) > 6) {
      angleLocked = true;
      angleOk = Math.atan2(Math.abs(dy), Math.abs(dx)) * (180 / Math.PI) >= MIN_DEG;
      if (!angleOk) { reset(); return; }
    }
    if (!angleLocked) return;

    active = true;
    var pull = Math.min(dy * 0.5, MAX_DIST);
    setHeight(pull);
    setReady(pull >= THRESHOLD * 0.5);
  }, { passive: true });

  scroller.addEventListener('touchend', function(e) {
    if (!active) { startY = 0; return; }
    var dy   = e.changedTouches[0].clientY - startY;
    var pull = Math.min(dy * 0.5, MAX_DIST);
    if (pull >= THRESHOLD * 0.5) { doRefresh(); } else { reset(); }
  }, { passive: true });

  scroller.addEventListener('touchcancel', function() { reset(); }, { passive: true });
}

document.addEventListener('DOMContentLoaded', async function() {
  _initLucideIcons();
  _initPullToRefresh();

  // Force all date inputs to use en-US field order on Arabic devices
  _fixDateInputLocale();

  // Auto-wire any date picker that becomes visible (e.g. inside modals)
  new MutationObserver(() => _initCustomDatePickers())
    .observe(document.body, { childList: true, subtree: true, attributeFilter: ['class'] });

  // ── If session is still valid, restore directly to the app ──
  if (_loadSession()) {
    const targetPage = new URLSearchParams(location.search).get('page')
                    || sessionStorage.getItem('halaqat_last_page')
                    || 'dashboard';
    // Hide all pages before showing to prevent flash of wrong dashboard
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById('pinScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    applyRoleUI();
    await loadAll(); await loadAndDisplayLogos(); navigate(targetPage);
    refreshNotifBadge();
    waUpdateNavBadge();
    return;
  }

  // ── No valid session — show PIN / login screen ──
  const urlPage = new URLSearchParams(location.search).get('page');
  if (urlPage) {
    history.replaceState({ page: urlPage }, '', '?page=' + urlPage);
  } else {
    history.replaceState({ page: 'dashboard' }, '', location.href);
  }
  const saved = _getSavedUser();
  if (saved) { loginShowQuickForm(); } else { loginShowFullForm(); }
  bioCheckAndShow();
});

// ── Service Worker registration ──────────────────────────
// Unregister any old service workers and clear their caches so updated files always load fresh
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.getRegistrations().then(function(regs) {
      regs.forEach(function(reg) { reg.unregister(); });
    });
    if (window.caches) {
      caches.keys().then(function(keys) {
        keys.forEach(function(key) { caches.delete(key); });
      });
    }
  });
}