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

  // ── If session is still valid, restore directly to the app ──
  if (_loadSession()) {
    const targetPage = new URLSearchParams(location.search).get('page')
                    || localStorage.getItem('halaqat_last_page')
                    || 'dashboard';
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
