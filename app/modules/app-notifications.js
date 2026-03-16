// ══════════════════════════════════════════════════════════
//  NOTIFICATION PANEL
// ══════════════════════════════════════════════════════════

// ── Backup reminder helpers ──────────────────────────
const BACKUP_REMINDER_DAYS = 7;
const BACKUP_TS_KEY = 'last_backup_ts'; // kept for local cache only
let _backupTsCache = parseInt(localStorage.getItem(BACKUP_TS_KEY) || '0', 10);

async function _saveBackupTs() {
  const now = Date.now();
  _backupTsCache = now;
  localStorage.setItem(BACKUP_TS_KEY, now.toString());
  // Also persist on server so all accounts share the same reminder
  try { await apiFetch('/settings', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ lastBackupTs: now }) }); } catch(e){}
  setTimeout(refreshNotifBadge, 300);
}

async function _loadBackupTs() {
  // Sync server value into local cache (called on loadAll)
  try {
    const s = await apiFetch('/settings');
    if (s?.lastBackupTs && s.lastBackupTs > _backupTsCache) {
      _backupTsCache = s.lastBackupTs;
      localStorage.setItem(BACKUP_TS_KEY, String(_backupTsCache));
    }
  } catch(e){}
}

function _backupDaysAgo() {
  const ts = _backupTsCache;
  if (!ts) return 999;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}
function _needsBackupReminder() {
  return _backupDaysAgo() >= BACKUP_REMINDER_DAYS;
}

const NOTIF_DISMISS_KEY     = 'halaqat_dismissed_notifs';
const NOTIF_QUEUE_DISMISSED = 'halaqat_notif_queue_dismissed_count'; // stores the count at dismiss time
const NOTIF_FAILED_DISMISSED= 'halaqat_notif_failed_dismissed_count';

function getDismissed() {
  try { return JSON.parse(localStorage.getItem(NOTIF_DISMISS_KEY) || '[]'); }
  catch { return []; }
}
function addDismissed(id) {
  const list = getDismissed();
  if (!list.includes(id)) { list.push(id); localStorage.setItem(NOTIF_DISMISS_KEY, JSON.stringify(list)); }
}
function dismissQueueNotif() {
  // Remember the count at time of dismiss — only re-show if count increases
  localStorage.setItem(NOTIF_QUEUE_DISMISSED, String(_waQueueNotifCount));
  renderNotifPanel();
}
function dismissFailedNotif() {
  const failedCount = (window._waLogData || []).filter(l => l.status === 'failed').length;
  localStorage.setItem(NOTIF_FAILED_DISMISSED, String(failedCount));
  renderNotifPanel();
}
function _queueNotifVisible() {
  if (_waQueueNotifCount <= 0) return false;
  const dismissed = parseInt(localStorage.getItem(NOTIF_QUEUE_DISMISSED) || '0', 10);
  return _waQueueNotifCount > dismissed;
}
function _failedNotifVisible() {
  const failedCount = (window._waLogData || []).filter(l => l.status === 'failed').length;
  if (failedCount <= 0) return false;
  const dismissed = parseInt(localStorage.getItem(NOTIF_FAILED_DISMISSED) || '0', 10);
  return failedCount > dismissed;
}
function dismissAllNotifs() {
  const items = document.querySelectorAll('#notifPanelBody .notif-card[data-notif-id]');
  items.forEach(el => addDismissed(el.dataset.notifId));
  dismissQueueNotif();
  dismissFailedNotif();
  _lastWaResult = null;
  _attendanceNotifs.forEach(n => { n.dismissed = true; });
  _attNotifsSave();
  renderNotifPanel();
  updateNotifBadge(0);
}

function toggleNotifPanel() {
  const panel   = document.getElementById('notifPanel');
  const overlay = document.getElementById('notifOverlay');
  const isOpen  = !panel.classList.contains('hidden');
  if (isOpen) {
    closeNotifPanel();
  } else {
    panel.classList.remove('hidden');
    overlay.classList.remove('hidden');
    renderNotifPanel();
  }
}
function closeNotifPanel() {
  document.getElementById('notifPanel')?.classList.add('hidden');
  document.getElementById('notifOverlay')?.classList.add('hidden');
}

function updateNotifBadge(count) {
  const badge = document.getElementById('notifBadge');
  const bell  = document.getElementById('notifBellBtn');
  const badgeMobile = document.getElementById('notifBadgeMobile');
  const bellMobile  = document.getElementById('notifBellBtnMobile');
  if (!badge || !bell) return;
  if (count > 0) {
    const label = count > 99 ? '99+' : count;
    badge.textContent = label;
    badge.classList.remove('hidden');
    bell.classList.add('has-notifs');
    if (badgeMobile) { badgeMobile.textContent = label; badgeMobile.classList.remove('hidden'); }
    if (bellMobile)  { bellMobile.classList.add('has-notifs'); }
  } else {
    badge.classList.add('hidden');
    bell.classList.remove('has-notifs');
    if (badgeMobile) { badgeMobile.classList.add('hidden'); }
    if (bellMobile)  { bellMobile.classList.remove('has-notifs'); }
  }
}

async function loadNotifData() {
  const today = todayISO();
  const dismissed = getDismissed();

  // 1 — Today's calendar events
  let events = [];
  try {
    const all = await apiFetch('/calendar');
    if (Array.isArray(all)) {
      events = all.filter(ev => {
        if (dismissed.includes('ev_' + ev.id)) return false;
        // Matches today exactly, or today is within a range event
        if (ev.date === today) return true;
        if (ev.endDate && ev.date <= today && ev.endDate >= today) return true;
        return false;
      });
    }
  } catch(e) {}

  return { events, waResult: _lastWaResult, queueCount: _waQueueNotifCount, needsBackup: _needsBackupReminder() };
}

async function refreshNotifBadge() {
  if (currentRole === 'teacher') { updateNotifBadge(0); return; }
  const { events, waResult, needsBackup } = await loadNotifData();
  const attCount = _attendanceNotifs.filter(n => !n.dismissed).length;
  const total = events.length
    + (waResult ? 1 : 0)
    + (_queueNotifVisible() ? 1 : 0)
    + (_failedNotifVisible() ? 1 : 0)
    + (needsBackup ? 1 : 0)
    + attCount;
  updateNotifBadge(total);
}

async function renderNotifPanel() {
  if (currentRole === 'teacher') return;
  const body = document.getElementById('notifPanelBody');
  if (!body) return;
  body.innerHTML = '<div class="notif-loading"><span class="ui-ic ic-gray" style="display:inline-flex;align-items:center;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg></span> جارٍ التحميل…</div>';

  const { events, waResult, queueCount, needsBackup } = await loadNotifData();
  const activeAttNotifs = _attendanceNotifs.filter(n => !n.dismissed);
  const attCount = activeAttNotifs.length;

  // Single source of truth for total — always includes ALL notification types
  const total = events.length
    + (waResult ? 1 : 0)
    + (_queueNotifVisible() ? 1 : 0)
    + (_failedNotifVisible() ? 1 : 0)
    + (needsBackup ? 1 : 0)
    + attCount;

  updateNotifBadge(total);

  if (total === 0) {
    body.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon ui-ic ic-gray"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg></div>
        <div class="notif-empty-text">لا توجد إشعارات اليوم</div>
        <div class="notif-empty-sub">ستظهر هنا أحداث اليوم ورسائل واتساب المُرسَلة</div>
      </div>`;
    return;
  }

  const TYPE_ICON  = { event: '<span class="ui-ic ic-amber" style="display:inline-flex;align-items:center;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg></span>', holiday: '<span class="ui-ic ic-sky" style="display:inline-flex;align-items:center;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"/></svg></span>', offday: '<span class="ui-ic ic-gray" style="display:inline-flex;align-items:center;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 5a10.94 10.94 0 0 0-1.956 2.428"/><path d="m10.68 5.545.053-.001"/></svg></span>', reminder: '<span class="ui-ic ic-purple" style="display:inline-flex;align-items:center;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span>', message: '<span class="ui-ic ic-teal" style="display:inline-flex;align-items:center;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 19-9-9 19-2-8-8-2z"/></svg></span>', default:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' };
  const TYPE_LABEL = { event:'حدث', holiday:'إجازة رسمية', offday:'يوم إجازة', reminder:'تذكير', message:'رسالة مجدولة' };

  let html = '';

  // ── Backup reminder card ──
  if (needsBackup) {
    const days = _backupDaysAgo();
    const daysLabel = days >= 999 ? 'لم تقم بنسخة احتياطية من قبل' : `آخر نسخة احتياطية منذ ${days} يوم`;
    html += `
      <div class="notif-card" style="border-right:3px solid var(--primary);cursor:pointer" onclick="closeNotifPanel();navigate('settings')">
        <div class="notif-card-icon ui-ic ic-blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></div>
        <div class="notif-card-body">
          <div class="notif-card-title">حان وقت النسخة الاحتياطية</div>
          <div class="notif-card-sub">${daysLabel} — اضغط للذهاب إلى الإعدادات</div>
        </div>
      </div>`;
  }

  // ── Failed WA messages card ──
  if (_failedNotifVisible()) {
    const failedLogs = (window._waLogData || []).filter(l => l.status === 'failed');
    const sample = failedLogs[0];
    const sampleName = sample.studentName || sample.phone || '';
    html += `
      <div class="notif-card" style="border-right:3px solid var(--error);cursor:pointer">
        <div class="notif-card-icon ui-ic ic-red" onclick="closeNotifPanel();navigate('whatsapp')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
        <div class="notif-card-body" onclick="closeNotifPanel();navigate('whatsapp')">
          <div class="notif-card-title">فشل إرسال ${failedLogs.length} رسالة</div>
          <div class="notif-card-sub">${failedLogs.length === 1 ? sampleName + (sample.error ? ' — ' + sample.error : '') : 'اضغط لعرض السجل والتفاصيل'}</div>
        </div>
        <button class="notif-card-dismiss" onclick="dismissFailedNotif()" title="تجاهل"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>`;
  }

  // ── WA queue pending card ──
  if (_queueNotifVisible()) {
    html += `
      <div class="notif-card" style="border-right:3px solid var(--warn);cursor:pointer">
        <div class="notif-card-icon ui-ic ic-teal" onclick="closeNotifPanel();navigate('whatsapp')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
        <div class="notif-card-body" onclick="closeNotifPanel();navigate('whatsapp')">
          <div class="notif-card-title">لديك ${_waQueueNotifCount} رسالة في قائمة الانتظار</div>
          <div class="notif-card-sub">اضغط للذهاب إلى صفحة واتساب وإرسالها</div>
        </div>
        <button class="notif-card-dismiss" onclick="dismissQueueNotif()" title="تجاهل"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>`;
  }

  // ── WA send result card ──
  if (waResult) {
    const time = waResult.time ? new Date(waResult.time).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'}) : '';
    let icon, title, sub, color;
    if (waResult.error) {
      icon='x-circle'; title='فشل إرسال رسائل واتساب'; sub=waResult.error; color='var(--error)';
    } else if (waResult.failed === 0) {
      icon='check-circle'; title=`تم إرسال جميع الرسائل (${waResult.sent})`; sub=`الساعة ${time}`; color='var(--success)';
    } else {
      icon='message'; title='نتيجة إرسال واتساب';
      sub=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> ${waResult.sent} أُرسلت  |  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ${waResult.failed} فشلت`; color='var(--warn)';
    }
    html += `
      <div class="notif-card" style="border-right:3px solid ${color}">
        <div class="notif-card-icon">${icon}</div>
        <div class="notif-card-body">
          <div class="notif-card-title">${title}</div>
          <div class="notif-card-sub">${sub}</div>
        </div>
        <button class="notif-card-dismiss" onclick="_lastWaResult=null;renderNotifPanel()" title="تجاهل"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>`;
  }

  // ── Attendance notifications section ──
  const attNotifsToShow = _attendanceNotifs.filter(n => !n.dismissed);
  if (attNotifsToShow.length > 0) {
    html += `<div class="notif-section-title"><span class="ui-ic ic-green" style="display:inline-flex;align-items:center;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span> تسجيل الحضور</div>`;
    attNotifsToShow.forEach(n => {
      const time = n.ts ? new Date(n.ts).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'}) : '';
      html += `
        <div class="notif-card" style="border-right:3px solid var(--success)" data-notif-id="${n.id}">
          <div class="notif-card-icon ui-ic ic-green"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
          <div class="notif-card-body">
            <div class="notif-card-title">${n.teacherName} — ${n.className}</div>
            <div class="notif-card-sub">
              ${n.total} طالب · <span style="color:var(--success)">حاضر: ${n.present}</span> · <span style="color:var(--error)">غائب: ${n.absent}</span>${n.late ? ` · متأخر: ${n.late}` : ''}
            </div>
            ${time ? `<div class="notif-card-time">الساعة ${time}</div>` : ''}
          </div>
          <button class="notif-card-dismiss" onclick="dismissAttendanceNotif('${n.id}')" title="تجاهل"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>`;
    });
  }

  // ── Calendar events section ──
  if (events.length > 0) {
    html += `<div class="notif-section-title"><span class="ui-ic ic-blue" style="display:inline-flex;align-items:center;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span> أحداث اليوم</div>`;
    events.forEach(ev => {
      const icon  = TYPE_ICON[ev.type] || TYPE_ICON.default;
      const label = TYPE_LABEL[ev.type] || ev.type;
      const range = ev.endDate && ev.endDate !== ev.date
        ? ` — حتى ${ev.endDate}` : '';
      html += `
        <div class="notif-card type-${ev.type}" data-notif-id="ev_${ev.id}">
          <div class="notif-card-icon">${icon}</div>
          <div class="notif-card-body">
            <div class="notif-card-title">${ev.title || label}</div>
            <div class="notif-card-sub">${label}${range}</div>
            ${ev.note ? `<div class="notif-card-time">${ev.note}</div>` : ''}
          </div>
          <button class="notif-card-dismiss" onclick="dismissNotif('ev_${ev.id}')" title="تجاهل"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>`;
    });
  }



  body.innerHTML = html;
}

// ── Failed message notification ──────────────────────────
function showWaFailNotif(context, failCount, errorMsg) {
  var existing = document.getElementById('waFailNotif');
  if (existing) existing.remove();

  var notif = document.createElement('div');
  notif.id = 'waFailNotif';
  notif.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
    'background:#7f1d1d;color:#fff;border-radius:12px;padding:14px 20px;font-size:14px;font-weight:600;' +
    'box-shadow:0 8px 32px rgba(0,0,0,0.3);z-index:9999;display:flex;align-items:center;' +
    'gap:12px;min-width:280px;animation:slideDown 0.3s ease;border-right:4px solid #ef4444;cursor:pointer;';
  notif.onclick = function() { notif.remove(); closeNotifPanel(); navigate('whatsapp'); };

  var title = failCount > 0
    ? 'فشل إرسال ' + failCount + ' رسالة' + (context ? ' — ' + context : '')
    : 'فشل الإرسال' + (context ? ' — ' + context : '');
  var sub = errorMsg || 'تحقق من اتصال واتساب وسجل الرسائل';

  notif.innerHTML = '<span class="ui-ic ic-red" style="font-size:16px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>' +
    '<div style="flex:1"><div>' + title + '</div>' +
    '<div style="font-size:11px;opacity:0.75;margin-top:2px;font-weight:400">' + sub + '</div></div>';

  var closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  closeBtn.style.cssText = 'background:none;border:none;color:rgba(255,255,255,0.6);cursor:pointer;font-size:14px;padding:0 0 0 8px;';
  closeBtn.onclick = function(e) { e.stopPropagation(); notif.remove(); };
  notif.appendChild(closeBtn);
  document.body.appendChild(notif);
  setTimeout(function() { if (notif.parentNode) notif.remove(); }, 8000);
}

// Single summary notification after sending WA messages
let _lastWaResult = null; // {sent, failed, error, time}
let _waQueueNotifCount = 0; // live queue count for notif panel

function showQueueNotif(count) {
  if (currentRole === 'teacher') return; // teachers never see WA notifications
  // Remove any existing queue notif
  var existing = document.getElementById('waQueueNotifPopup');
  if (existing) existing.remove();

  var notif = document.createElement('div');
  notif.id = 'waQueueNotifPopup';
  notif.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
    'background:#1e293b;color:#fff;border-radius:12px;padding:14px 20px;font-size:14px;font-weight:600;' +
    'box-shadow:0 8px 32px rgba(0,0,0,0.3);z-index:9999;display:flex;align-items:center;gap:12px;' +
    'min-width:280px;cursor:pointer;animation:slideDown 0.3s ease;border-right:4px solid #f59e0b;';
  notif.title = 'انتقل إلى واتساب';
  notif.onclick = function() { notif.remove(); closeNotifPanel(); navigate('whatsapp'); };
  notif.innerHTML = '<span class="ui-ic ic-teal" style="font-size:16px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>' +
    '<div style="flex:1"><div>لديك ' + count + ' رسالة في قائمة الانتظار</div>' +
    '<div style="font-size:11px;color:#94a3b8;margin-top:2px;font-weight:400">اضغط للانتقال إلى واتساب</div></div>';

  var closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  closeBtn.style.cssText = 'background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;padding:0 0 0 8px;';
  closeBtn.onclick = function(e) { e.stopPropagation(); notif.remove(); };
  notif.appendChild(closeBtn);

  document.body.appendChild(notif);
  setTimeout(function() { if (notif.parentNode) notif.remove(); }, 7000);
}

function showWaSummaryNotif(sent, failed, error) {
  _lastWaResult = { sent, failed, error, time: new Date().toISOString() };
  refreshNotifBadge();

  const existing = document.getElementById('waSummaryNotif');
  if (existing) existing.remove();

  const notif = document.createElement('div');
  notif.id = 'waSummaryNotif';
  notif.style.cssText = `
    position:fixed; top:20px; left:50%; transform:translateX(-50%);
    background:#1e293b; color:#fff; border-radius:12px;
    padding:14px 22px; font-size:14px; font-weight:600;
    box-shadow:0 8px 32px rgba(0,0,0,0.25); z-index:9999;
    display:flex; align-items:center; gap:12px; min-width:260px;
    animation: slideDown 0.3s ease;
  `;

  if (error) {
    notif.innerHTML = `<span class="ui-ic ic-red" style="font-size:16px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span><span>${error}</span>`;
    notif.style.background = '#7f1d1d';
  } else if (failed === 0) {
    notif.innerHTML = `<span class="ui-ic ic-green" style="font-size:16px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span><span>تم إرسال جميع الرسائل بنجاح — ${sent} رسالة</span>`;
    notif.style.background = '#14532d';
  } else {
    notif.innerHTML = `
      <span class="ui-ic ic-blue" style="font-size:16px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
      <span>
        <span style="color:#86efac"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> ${sent} رسالة أُرسلت</span>
        &nbsp;|&nbsp;
        <span style="color:#fca5a5"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ${failed} فشلت</span>
      </span>`;
  }

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  closeBtn.style.cssText = 'background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;margin-right:4px;padding:0 0 0 8px;';
  closeBtn.onclick = () => notif.remove();
  notif.appendChild(closeBtn);

  document.body.appendChild(notif);
  setTimeout(() => { if (notif.parentNode) notif.remove(); }, 6000);
}

// ── Attendance notifications (real-time SSE) ─────────────
// Persisted in localStorage so badge survives tab close/reopen
const _ATT_SS_KEY = 'halaqat_att_notifs_v2';

function _attNotifsLoad() {
  try { return JSON.parse(localStorage.getItem(_ATT_SS_KEY) || '[]'); } catch(e) { return []; }
}
function _attNotifsSave() {
  try { localStorage.setItem(_ATT_SS_KEY, JSON.stringify(_attendanceNotifs.slice(0,30))); } catch(e) {}
}

const _attendanceNotifs = _attNotifsLoad();

function showAttendanceNotif(d) {
  // Deduplicate — same class within same 10-second window
  const key = (d.classId || '') + '_' + Math.floor(Number(d.ts || Date.now()) / 10000);
  if (_attendanceNotifs.some(n => n._key === key)) return;

  const notif = { ...d, id: 'att_' + (d.ts || Date.now()), _key: key, dismissed: false };
  _attendanceNotifs.unshift(notif);
  if (_attendanceNotifs.length > 20) _attendanceNotifs.length = 20;
  _attNotifsSave();

  // Update badge immediately — no async needed here
  const attCount = _attendanceNotifs.filter(n => !n.dismissed).length;
  // Kick off full refresh (for calendar events etc) then override badge
  refreshNotifBadge();

  // Play ping sound
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[660, 0], [880, 130], [1100, 240]].forEach(([freq, delay]) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
      }, delay);
    });
  } catch(e) {}

  // Shake the bell + pulse the badge
  ['notifBellBtn','notifBellBtnMobile'].forEach(btnId => {
    const el = document.getElementById(btnId);
    if (!el) return;
    el.classList.remove('bell-shake');
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add('bell-shake');
    setTimeout(() => el.classList.remove('bell-shake'), 800);
  });
  // Pulse the badge number
  ['notifBadge','notifBadgeMobile'].forEach(badgeId => {
    const el = document.getElementById(badgeId);
    if (!el) return;
    el.classList.remove('badge-pop');
    void el.offsetWidth;
    el.classList.add('badge-pop');
    setTimeout(() => el.classList.remove('badge-pop'), 600);
  });

  // If panel is already open, refresh it live
  const panel = document.getElementById('notifPanel');
  if (panel && !panel.classList.contains('hidden')) renderNotifPanel();

  // ── Big obvious banner BELOW the top header ──────────────
  document.querySelectorAll('.att-live-banner').forEach(b => b.remove());

  // Get header height so banner appears below it, not behind it
  const headerEl = document.querySelector('.app-header') || document.querySelector('header') || document.querySelector('.top-bar');
  const headerH  = headerEl ? headerEl.offsetHeight : 56;

  const banner = document.createElement('div');
  banner.className = 'att-live-banner';
  banner.setAttribute('style', [
    'position:fixed',
    `top:${headerH}px`,
    'left:0',
    'right:0',
    'z-index:99999',
    'background:#166534',
    'color:#fff',
    'padding:14px 18px',
    'display:flex',
    'align-items:center',
    'gap:12px',
    'box-shadow:0 6px 24px rgba(0,0,0,.45)',
    'cursor:pointer',
    'direction:rtl',
    'border-bottom:3px solid rgba(255,255,255,.25)',
    'transform:translateY(-130%)',
    'transition:transform .4s cubic-bezier(.34,1.3,.64,1)',
  ].join(';'));

  banner.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);flex-shrink:0">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">✅ ${d.teacherName} سجّل الحضور</div>
      <div style="font-size:12px;opacity:.9;margin-top:3px">
        ${d.className} &nbsp;·&nbsp; حاضر: <strong>${d.present}</strong> &nbsp;·&nbsp; غائب: <strong>${d.absent}</strong>${d.late ? ` &nbsp;·&nbsp; متأخر: <strong>${d.late}</strong>` : ''} &nbsp;·&nbsp; المجموع: ${d.total}
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
      <span style="font-size:11px;opacity:.8">اضغط للتفاصيل</span>
      <button class="att-banner-close" style="background:rgba(0,0,0,.2);border:none;color:#fff;cursor:pointer;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">✕</button>
    </div>
  `;

  banner.querySelector('.att-banner-close').addEventListener('click', e => {
    e.stopPropagation();
    _closeBanner(banner);
  });
  banner.addEventListener('click', () => { _closeBanner(banner); toggleNotifPanel(); });

  document.body.appendChild(banner);

  // Slide in after paint
  requestAnimationFrame(() => requestAnimationFrame(() => {
    banner.style.transform = 'translateY(0)';
  }));

  // Auto-dismiss after 9s
  const t = setTimeout(() => _closeBanner(banner), 9000);
  banner._t = t;
}

function _closeBanner(banner) {
  if (!banner || !banner.parentNode) return;
  clearTimeout(banner._t);
  banner.style.transform = 'translateY(-110%)';
  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 400);
}

function dismissAttendanceNotif(id) {
  const n = _attendanceNotifs.find(n => n.id === id);
  if (n) { n.dismissed = true; _attNotifsSave(); }
  const card = document.querySelector(`[data-notif-id="${id}"]`);
  if (card) { card.style.opacity='0'; card.style.transform='translateX(20px)'; card.style.transition='.2s'; setTimeout(()=>{ card.remove(); renderNotifPanel(); }, 200); }
  refreshNotifBadge();
}



function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}