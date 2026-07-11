// ══════════════════════════════════════════════════════════
//  الساعة والتاريخ
// ══════════════════════════════════════════════════════════
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ══════════════════════════════════════════════════════════
//  QR Code — يتجدد عند كل تحميل للصفحة
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  QR Code — يُولَّد من جانب العميل (لا يحتاج إلى الخادم)
// ══════════════════════════════════════════════════════════
let _qrNetworkUrl = '';

async function loadPinQR() {
  try {
    const info = await apiFetch('/network-info');
    if (!info?.url) return;
    _qrNetworkUrl = info.url;
    const urlEl = document.getElementById('pinQrUrl');
    if (urlEl) urlEl.textContent = info.url;
    _renderQR('pinQrCanvas', info.url, 120);
  } catch(e) { console.warn('QR load error:', e); }
}

function buildAllQRCodes() {
  if (!_qrNetworkUrl) { loadPinQR(); return; }
  _renderQR('pinQrCanvas',  _qrNetworkUrl, 120);
  _renderQR('dashQrCanvas', _qrNetworkUrl, 180);
  _renderQR('settQrCanvas', _qrNetworkUrl, 150);
  const urlEl = document.getElementById('dashQrUrl');
  if (urlEl) urlEl.textContent = _qrNetworkUrl;
}

function _renderQR(containerId, text, size) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';   // مسح القديم
  if (typeof QRCode === 'undefined') {
    // Fallback نصي إذا لم تُحمَّل المكتبة
    el.innerHTML = `<div style="padding:10px;font-size:11px;color:#666;max-width:140px;word-break:break-all;direction:ltr">${text}</div>`;
    return;
  }
  try {
    new QRCode(el, { text, width: size, height: size, colorDark:'#1e3a5f', colorLight:'#ffffff', correctLevel: QRCode.CorrectLevel.M });
  } catch(e) {
    el.innerHTML = `<div style="padding:8px;font-size:10px;color:#999">${text}</div>`;
  }
}

// Shows the CROSS-CALENDAR equivalent under any date input.
// In Gregorian mode → shows the Hijri date (so user sees هـ translation)
// In Hijri mode → shows the Gregorian date (so user sees م translation)
function updateHijriLabel(input, labelId) {
  const el = document.getElementById(labelId);
  if (!el) return;
  if (!input.value) { el.textContent = ''; return; }
  const iso = input.value;
  if (getCalType() === 'gregorian') {
    // Main display is Gregorian — show Hijri as cross-reference
    const h = toHijri(iso);
    const d = new Date(iso + 'T00:00:00');
    el.textContent = `${ARABIC_DAYS[d.getDay()]}، ${h.day} ${HIJRI_MONTHS[h.month]} ${h.year}هـ`;
  } else {
    // Main display is Hijri — show Gregorian as cross-reference
    const d = new Date(iso + 'T00:00:00');
    const parts = iso.split('-');
    el.textContent = `${ARABIC_DAYS[d.getDay()]}، ${+parts[2]} ${GREGORIAN_MONTHS[+parts[1]]} ${parts[0]}`;
  }
}

// Initialize a date input with today's date and its Hijri label
function setDateToday(inputId, labelId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.value = todayISO();
  if (labelId) updateHijriLabel(input, labelId);
}

function buildHijriDateString(tokens, sep) {
  const h = toHijri(todayISO());
  const vals = { day: String(h.day), month: HIJRI_MONTHS[h.month], year: String(h.year) };
  return tokens
    .filter(t => t.on)
    .map(t => {
      if (t.key === 'year') return `<bdi>${vals.year}</bdi>هـ`;
      return `<bdi>${vals[t.key] || ''}</bdi>`;
    })
    .join(sep);
}

function buildGregorianDateString(fmt) {
  const today = todayISO();
  const parts = today.split('-');
  const vals = { day: String(+parts[2]), month: GREGORIAN_MONTHS[+parts[1]], year: String(parts[0]) };
  const f = fmt || (state && state.settings && state.settings.dateFormat) || dfDefaultFormat();
  const sep = f.sep || ' ';
  const activeTokens = (f.tokens || [{key:'day',on:true},{key:'month',on:true},{key:'year',on:true}]).filter(t=>t.on);
  if (!activeTokens.length) return `<bdi>${vals.day}</bdi> ${vals.month} <bdi>${vals.year}</bdi>`;
  return activeTokens.map(t => {
    if (t.key === 'month') return vals.month;
    return `<bdi>${vals[t.key] || ''}</bdi>`;
  }).join(sep);
}

function updateTodayBadge(fmt) {
  const badge = document.getElementById('todayBadge');
  if (!badge) return;
  const f = fmt || (state && state.settings && state.settings.dateFormat) || dfDefaultFormat();
  if (getCalType() === 'gregorian') {
    badge.innerHTML = buildGregorianDateString(f);
    return;
  }
  badge.innerHTML = buildHijriDateString(f.tokens, f.sep);
}

function startClock() {
  function tick() {
    const now   = new Date();
    const clock = document.getElementById('liveClock');
    const date  = document.getElementById('liveDate');
    if (clock) {
      const hh = String(now.getHours()).padStart(2,'0');
      const mm = String(now.getMinutes()).padStart(2,'0');
      const ss = String(now.getSeconds()).padStart(2,'0');
      clock.textContent = `${hh}:${mm}:${ss}`;
    }
    if (date) date.textContent = formatDateDisplayFull(todayISO());
  }
  tick(); setInterval(tick, 1000);
}

// ══════════════════════════════════════════════════════════


// ── Date Format Builder (required by updateTodayBadge) ──
//  تنسيق التاريخ — بناء وحفظ
// ════════════════════════════════════════════════════════

// ── Date Format Builder ──────────────────────────────────

function dfDefaultFormat() {
  return {
    tokens: [
      { key: 'day',   label: 'اليوم',  on: true },
      { key: 'month', label: 'الشهر',  on: true },
      { key: 'year',  label: 'السنة',  on: true },
    ],
    sep: ' '
  };
}

function dfGetCurrentFormat() {
  const list = document.getElementById('dfTokenList');
  if (!list) return dfDefaultFormat();
  const tokens = [...list.querySelectorAll('.df-token')].map(el => ({
    key:   el.dataset.key,
    label: el.dataset.label,
    on:    el.classList.contains('df-token-on'),
  }));
  const activeBtn = document.querySelector('.df-sep-btn.active');
  const sep = activeBtn ? activeBtn.dataset.sep : ' ';
  return { tokens, sep };
}

function dfRenderTokens(fmt) {
  const list = document.getElementById('dfTokenList');
  if (!list) return;
  list.innerHTML = '';
  fmt.tokens.forEach((t, i) => {
    const total = fmt.tokens.length;
    const el = document.createElement('div');
    el.className = 'df-token' + (t.on ? ' df-token-on' : '');
    el.dataset.key   = t.key;
    el.dataset.label = t.label;
    el.innerHTML = `
      <div class="df-token-arrows">
        <button class="df-arrow-btn" onclick="dfMoveToken(this,-1)" ${i===0?'disabled':''}>▲</button>
        <button class="df-arrow-btn" onclick="dfMoveToken(this,1)"  ${i===total-1?'disabled':''}>▼</button>
      </div>
      <span class="df-token-label">${t.label}</span>
      <button class="df-token-toggle" onclick="dfToggleToken(this)">
        <span class="df-toggle-track"><span class="df-toggle-thumb"></span></span>
      </button>`;
    list.appendChild(el);
  });
  dfUpdatePreview();
}

function dfMoveToken(btn, dir) {
  const token = btn.closest('.df-token');
  const list  = document.getElementById('dfTokenList');
  const items = [...list.children];
  const idx   = items.indexOf(token);
  const swap  = items[idx + dir];
  if (!swap) return;
  if (dir === -1) list.insertBefore(token, swap);
  else            list.insertBefore(swap, token);
  // Re-render arrows to update disabled state
  const newItems = [...list.children];
  newItems.forEach((el, i) => {
    const btns = el.querySelectorAll('.df-arrow-btn');
    if (btns[0]) btns[0].disabled = i === 0;
    if (btns[1]) btns[1].disabled = i === newItems.length - 1;
  });
  dfUpdatePreview();
}

function dfToggleToken(btn) {
  const token = btn.closest('.df-token');
  token.classList.toggle('df-token-on');
  dfUpdatePreview();
}

function dfPickSep(btn) {
  document.querySelectorAll('.df-sep-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  dfUpdatePreview();
}

function dfSetActiveSep(sep) {
  document.querySelectorAll('.df-sep-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.sep === sep);
  });
}

function dfUpdatePreview() {
  const preview = document.getElementById('dfPreview');
  if (!preview) return;
  const fmt = dfGetCurrentFormat();
  if (getCalType() === 'gregorian') {
    preview.innerHTML = buildGregorianDateString(fmt);
    return;
  }
  preview.innerHTML = buildHijriDateString(fmt.tokens, fmt.sep);
}

function dfReset() {
  dfRenderTokens(dfDefaultFormat());
  dfSetActiveSep(' ');
}

async function saveDateFormat() {
  const fmt = dfGetCurrentFormat();
  const statusEl = document.getElementById('dfStatus');
  await apiFetch('/settings', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dateFormat: fmt }),
  });
  if (!state.settings) state.settings = {};
  state.settings.dateFormat = fmt;
  updateTodayBadge(fmt);
  if (statusEl) {
    statusEl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم حفظ التنسيق';
    statusEl.style.color = 'var(--success)';
    setTimeout(() => statusEl.textContent = '', 2500);
  }
  toast('<span data-toast="ok"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span> تم حفظ تنسيق التاريخ');
}

// ════════════════════════════════════════════════════════
//  واتساب — تبويب الرسائل المجدولة


/* ── modules/dashboard.js ── */
//  الرئيسية
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  مودالات الحضور — الغائبون / الحاضرون
// ══════════════════════════════════════════════════════════

// Shared: fetch today attendance + render for a given status
async function _showAttModal(modalId, status) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('hidden');
  const bodyEl  = document.getElementById(modalId + 'Body');
  const countEl = document.getElementById(modalId + 'Count');
  const subEl   = document.getElementById(modalId + 'Sub');
  const isAbsent = status === 'Absent';

  bodyEl.innerHTML = `<div class="aom-loading"><span class="ic-spin ic-inline"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span></div>`;

  try {
    const today  = todayISO();
    const allAtt = await apiFetch('/attendance?date=' + today);
    const attMap = {};
    if (allAtt) allAtt.forEach(a => attMap[a.studentId] = a);

    const matched = state.students.filter(s => attMap[s.id]?.status === status);

    // Update header
    const hijriToday = formatHijri(today);
    countEl.textContent = matched.length;
    subEl.textContent   = hijriToday;

    if (matched.length === 0) {
      const emptyIcon  = isAbsent
        ? `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
        : `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
      const emptyMsg = isAbsent ? 'لا يوجد غائبون اليوم 🎉' : 'لا يوجد حضور مسجّل بعد';
      const emptySubMsg = isAbsent ? 'جميع الطلاب المسجلون حاضرون' : 'سجّل الحضور أولاً من صفحة تسجيل الحضور';
      bodyEl.innerHTML = `<div class="aom-empty">${emptyIcon}<div class="aom-empty-title">${emptyMsg}</div><div class="aom-empty-sub">${emptySubMsg}</div></div>`;
      return;
    }

    // Group by class
    const byClass = {};
    matched.forEach(s => {
      const cls = state.classes.find(c => c.id === s.classId);
      const key = s.classId || '__none__';
      const lbl = cls?.name || 'بدون حلقة';
      if (!byClass[key]) byClass[key] = { label: lbl, students: [] };
      byClass[key].students.push(s);
    });

    let html = '';
    Object.values(byClass).forEach((group, gi) => {
      html += `<div class="aom-group${gi > 0 ? ' aom-group--spaced' : ''}">
        <div class="aom-group-label">
          <span>${group.label}</span>
          <span class="aom-group-count">${group.students.length}</span>
        </div>
        <div class="aom-cards">`;
      group.students.forEach(s => {
        const initials = s.name.trim().split(' ').slice(0,2).map(w=>w[0]||'').join('');
        const avatarInner = s.photo
          ? `<img src="${s.photo}" alt="${s.name}" onerror="this.style.display='none'" />`
          : `<span class="aom-initials">${initials}</span>`;
        const phone = s.parentPhone
          ? `<span class="aom-card-phone"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> ${s.parentPhone}</span>`
          : '';
        const statusClass = isAbsent ? 'aom-card--absent' : 'aom-card--present';
        const indicator = isAbsent
          ? `<div class="aom-card-indicator aom-ind--absent"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>`
          : `<div class="aom-card-indicator aom-ind--present"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>`;
        html += `
          <div class="aom-card ${statusClass}" onclick="closeModal('${modalId}');viewStudent('${s.id}')">
            <div class="aom-avatar ${isAbsent ? 'aom-avatar--absent' : 'aom-avatar--present'}">${avatarInner}</div>
            <div class="aom-card-body">
              <div class="aom-card-name">${s.name}</div>
              <div class="aom-card-meta">${s.studentId||''}${phone ? ' · ' : ''}${phone}</div>
            </div>
            ${indicator}
          </div>`;
      });
      html += `</div></div>`;
    });

    bodyEl.innerHTML = html;
  } catch(e) {
    bodyEl.innerHTML = `<div class="aom-error">تعذّر تحميل البيانات</div>`;
  }
}

async function showAbsentModal()  { await _showAttModal('absentModal',  'Absent');  }
async function showPresentModal() { await _showAttModal('presentModal', 'Present'); }



async function renderDashboard() {
  if (currentRole === 'teacher')   { await renderTeacherDashboard();   return; }
  if (currentRole === 'moderator') { await renderModeratorDashboard(); return; }
  await renderAdminDashboard();
}

// ── Admin dashboard (original, unchanged) ──────────────
async function renderAdminDashboard() {
  applyDashWidgets();

  // Build stats URL — teachers only see their assigned classes
  let statsUrl = '/stats';
  if (currentRole === 'teacher' && currentAssignedClasses.length > 0) {
    statsUrl += '?classIds=' + currentAssignedClasses.join(',');
  }
  const stats = await apiFetch(statsUrl);
  if (!stats) return;

  document.getElementById('stat-students').textContent   = stats.totalStudents;
  document.getElementById('stat-present').textContent    = stats.presentToday;
  document.getElementById('stat-absent').textContent     = stats.absentToday;
  document.getElementById('stat-classes').textContent    = stats.totalClasses;
  document.getElementById('stat-teachers').textContent   = stats.totalTeachers;
  document.getElementById('stat-teachersin').textContent = stats.teachersIn;
  const lateEl    = document.getElementById('stat-late');
  const excusedEl = document.getElementById('stat-excused');
  if (lateEl)    lateEl.textContent    = stats.lateToday    || 0;
  if (excusedEl) excusedEl.textContent = stats.excusedToday || 0;

  // Show/hide cards based on role
  const isTeacher = currentRole === 'teacher';
  // Teachers don't see: total teachers count, teachers-in, backup button
  document.getElementById('statTeachersCard')?.style.setProperty('display', isTeacher ? 'none' : '');
  document.getElementById('statTeachersInCard')?.style.setProperty('display', isTeacher ? 'none' : '');
  document.getElementById('dashDriveBar')?.style.setProperty('display', isTeacher ? 'none' : '');
  // Update label for students card — teacher sees "طلابي" not "الطلاب"
  const studentsLbl = document.querySelector('#statStudentsCard .stat-lbl');
  if (studentsLbl) studentsLbl.textContent = isTeacher ? 'طلابي' : 'الطلاب';
  const classesLbl = document.querySelector('#statClassesCard .stat-lbl');
  if (classesLbl) classesLbl.textContent = isTeacher ? 'حلقاتي' : 'الحلقات';

  // Class coverage card
  const coverage     = stats.classCoverage || [];
  const done         = coverage.filter(c => c.count > 0 && c.done).length;
  const total        = coverage.filter(c => c.count > 0).length;
  const coverageNum  = document.getElementById('stat-coverage-num');
  const coverageBar  = document.getElementById('stat-coverage-bar');
  const coverageTodo = document.getElementById('stat-coverage-todo');
  const coverageCard = document.getElementById('statCoverageCard');
  if (coverageNum) coverageNum.textContent = `${done} / ${total}`;
  if (coverageBar && total > 0) {
    const pct = Math.round(done / total * 100);
    const color = done === total ? '#16a34a' : done > 0 ? '#d97706' : '#dc2626';
    coverageBar.innerHTML = `<div style="height:6px;background:var(--border);border-radius:4px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width .5s"></div>
    </div>`;
  }
  if (coverageTodo) {
    const todo = stats.classesTodo || [];
    coverageTodo.innerHTML = todo.length === 0
      ? (total > 0 ? '<span style="color:#16a34a;font-size:11px;font-weight:600">✓ جميع الحلقات سُجِّلت اليوم</span>' : '')
      : `<span style="color:#b45309;font-size:11px">لم تُسجَّل بعد: ${todo.join(' · ')}</span>`;
  }
  if (coverageCard) {
    coverageCard.className = 'stat-card stat-card-clickable ' +
      (done === total && total > 0 ? 'stat-att-coverage-done' : 'stat-att-coverage');
  }
  const banner = document.getElementById('dashHolidayBanner');
  if (stats.isHoliday) {
    banner.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"/></svg> إجازة اليوم: ${stats.holidayReason}</span>`;
    banner.classList.remove('hidden');
  } else { banner.classList.add('hidden'); }

  const w = getDashWidgets();

  // 1. Attendance ring
  if (w.attRing) {
    const total   = (stats.presentToday||0) + (stats.absentToday||0) + (stats.lateToday||0) + (stats.excusedToday||0);
    const present = stats.presentToday  || 0;
    const late    = stats.lateToday     || 0;
    const excused = stats.excusedToday  || 0;
    const absent  = stats.absentToday   || 0;
    const rate    = total > 0 ? Math.round((present + late) / total * 100) : 0;
    const pctEl   = document.getElementById('dashAttPct');
    const ringEl  = document.getElementById('dashRingFill');
    const breakEl = document.getElementById('dashAttBreakdown');
    if (pctEl) pctEl.textContent = total > 0 ? rate : '—';
    if (ringEl) {
      const r = 38, circ = 2 * Math.PI * r;
      const offset = total > 0 ? circ * (1 - rate / 100) : circ;
      const color  = rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626';
      ringEl.style.strokeDasharray  = circ;
      ringEl.style.strokeDashoffset = offset;
      ringEl.style.stroke = color;
      if (pctEl) pctEl.style.color = color;
    }
    if (breakEl && total > 0) {
      breakEl.innerHTML = `
        <span class="dash-bd-chip dash-bd-p">✓ ${present}</span>
        <span class="dash-bd-chip dash-bd-l">⏱ ${late}</span>
        <span class="dash-bd-chip dash-bd-e">📋 ${excused}</span>
        <span class="dash-bd-chip dash-bd-a">✗ ${absent}</span>`;
    }
  }

  // 2. WA waiting queue
  if (w.queue) {
    const queueEl = document.getElementById('dwQueueList');
    const badgeEl = document.getElementById('dwQueueBadge');
    if (queueEl) {
      const queue = await apiFetch('/whatsapp/queue');
      const items = queue || [];
      if (badgeEl) { badgeEl.textContent = items.length; badgeEl.style.display = items.length > 0 ? '' : 'none'; }
      if (items.length === 0) {
        queueEl.innerHTML = `<div class="dash-list-empty"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> لا توجد رسائل معلقة</div>`;
      } else {
        queueEl.innerHTML = items.map(item => `
          <div class="dash-list-item" id="dwq-${item.attendanceId}">
            <div class="dash-li-avatar" onclick="navigate('whatsapp')" style="cursor:pointer">${(item.studentName||'؟').charAt(0)}</div>
            <div class="dash-li-body" onclick="navigate('whatsapp')" style="cursor:pointer">
              <div class="dash-li-name">${item.studentName||'—'}</div>
              <div class="dash-li-sub">${item.className||''} · ${item.date||''}</div>
            </div>
            <button class="dash-dismiss-btn" onclick="dashDismissQueue('${item.attendanceId}','${item.studentId}','${item.date}')" title="حذف">✕</button>
          </div>`).join('');
      }
    }
  }

  // 3. Upcoming calendar events
  if (w.events) {
    const evEl = document.getElementById('dwEventsList');
    if (evEl) {
      const allCal  = await apiFetch('/calendar');
      const todayS  = todayISO();
      const limit   = new Date(); limit.setDate(limit.getDate() + 30);
      const limitStr = limit.toISOString().slice(0,10);
      const dismissed = _getDismissed(DW_DISMISSED_EVENTS);
      const upcoming = (allCal || [])
        .filter(e => e.date >= todayS && e.date <= limitStr && e.type !== 'message' && !dismissed.has(String(e.id)))
        .sort((a,b) => a.date.localeCompare(b.date))
        .slice(0, 20);
      if (upcoming.length === 0) {
        evEl.innerHTML = `<div class="dash-list-empty">لا توجد فعاليات قادمة خلال 30 يوماً</div>`;
      } else {
        const typeIcon  = { holiday:'🏖', offday:'🔴', reminder:'🔔', event:'📌' };
        const typeLabel = { holiday:'إجازة', offday:'عطلة', reminder:'تذكير', event:'حدث' };
        evEl.innerHTML = upcoming.map(e => {
          const isToday  = e.date === todayS;
          const daysAway = Math.round((new Date(e.date) - new Date(todayS)) / 86400000);
          const dayLabel = isToday ? '<span class="dash-ev-today">اليوم</span>' : `بعد ${daysAway}ي`;
          return `<div class="dash-list-item" id="dwev-${e.id}">
            <div class="dash-ev-icon" onclick="navigate('calendar')" style="cursor:pointer">${typeIcon[e.type]||'📅'}</div>
            <div class="dash-li-body" onclick="navigate('calendar')" style="cursor:pointer">
              <div class="dash-li-name">${e.title||'—'}</div>
              <div class="dash-li-sub">${formatDateAr(e.date)} · ${typeLabel[e.type]||'حدث'}</div>
            </div>
            <span class="dash-ev-days">${dayLabel}</span>
            <button class="dash-dismiss-btn" onclick="dashDismissEvent('${e.id}')" title="إخفاء">✕</button>
          </div>`;
        }).join('');
      }
    }
  }

  // 4. Scheduled messages status
  if (w.sched) {
    const schedEl  = document.getElementById('dwSchedList');
    const sbadgeEl = document.getElementById('dwSchedBadge');
    if (schedEl) {
      const allCal  = await apiFetch('/calendar');
      const todayS  = todayISO();
      const nowTime = new Date().toTimeString().slice(0,5);
      const msgs = (allCal || []).filter(e => e.type === 'message');
      const dismissedSched = _getDismissed(DW_DISMISSED_SCHED);
      const entries = msgs.map(ev => {
        const isPast  = ev.date < todayS || (ev.date === todayS && ev.time && ev.time <= nowTime);
        const hasFon  = ev.fonnteScheduled?.length > 0;
        const status  = isPast ? (hasFon ? 'sent' : 'failed') : 'pending';
        return { ...ev, _status: status };
      }).filter(e => !dismissedSched.has(String(e.id))).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 20);

      const failCount = entries.filter(e => e._status === 'failed').length;
      if (sbadgeEl) { sbadgeEl.textContent = failCount; sbadgeEl.style.display = failCount > 0 ? '' : 'none'; }

      if (entries.length === 0) {
        schedEl.innerHTML = `<div class="dash-list-empty">لا توجد رسائل مجدولة</div>`;
      } else {
        const stIcon  = { sent:'✅', pending:'⏳', failed:'❌' };
        const stLabel = { sent:'أُرسلت', pending:'معلقة', failed:'فاشلة' };
        const stClass = { sent:'dash-status-ok', pending:'dash-status-warn', failed:'dash-status-err' };
        schedEl.innerHTML = entries.map(e => `
          <div class="dash-list-item" id="dwsc-${e.id}">
            <div class="dash-ev-icon" style="font-size:16px;cursor:pointer" onclick="navigate('whatsapp')">${stIcon[e._status]||'⏳'}</div>
            <div class="dash-li-body" onclick="navigate('whatsapp')" style="cursor:pointer">
              <div class="dash-li-name">${e.title||'—'}</div>
              <div class="dash-li-sub">${formatDateAr(e.date)}${e.time?' · '+e.time:''} · ${(e.waTargets||[]).length} مستلم</div>
            </div>
            <span class="dash-li-status ${stClass[e._status]||''}">${stLabel[e._status]||'—'}</span>
            <button class="dash-dismiss-btn" onclick="dashDismissSched('${e.id}')" title="إخفاء">✕</button>
          </div>`).join('');
      }
    }
  }

  // QR
  if (!_qrNetworkUrl) {
    const info = await apiFetch('/network-info');
    if (info?.url) {
      _qrNetworkUrl = info.url;
      const urlEl = document.getElementById('dashQrUrl');
      if (urlEl) urlEl.textContent = info.url;
    }
  }
  buildAllQRCodes();
}

// ── Dismiss / clear functions ─────────────────────────────
const DW_DISMISSED_EVENTS = 'halaqat_dw_dismissed_events';
const DW_DISMISSED_SCHED  = 'halaqat_dw_dismissed_sched';

function _getDismissed(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); }
  catch(e) { return new Set(); }
}
function _saveDismissed(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

async function dashDismissQueue(attendanceId, studentId, date) {
  const el = document.getElementById('dwq-' + attendanceId);
  if (el) { el.style.opacity = '0'; el.style.transition = 'opacity .2s'; setTimeout(() => el.remove(), 200); }
  // call the same dismiss API as the WA page
  await apiFetch(`/whatsapp/queue/dismiss`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attendanceId, studentId, date }),
  });
  // update badge
  const list = document.getElementById('dwQueueList');
  const remaining = list ? list.querySelectorAll('.dash-list-item').length - 1 : 0;
  const badge = document.getElementById('dwQueueBadge');
  if (badge) { badge.textContent = remaining; badge.style.display = remaining > 0 ? '' : 'none'; }
  if (remaining <= 0 && list) list.innerHTML = `<div class="dash-list-empty"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> لا توجد رسائل معلقة</div>`;
}

async function dashClearQueue() {
  if (!confirm('هل تريد مسح جميع رسائل الانتظار؟')) return;
  const list  = document.getElementById('dwQueueList');
  const queue = await apiFetch('/whatsapp/queue');
  if (!queue?.length) return;
  for (const item of queue) {
    await apiFetch(`/whatsapp/queue/dismiss`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendanceId: item.attendanceId, studentId: item.studentId, date: item.date }),
    });
  }
  if (list) list.innerHTML = `<div class="dash-list-empty"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> لا توجد رسائل معلقة</div>`;
  const badge = document.getElementById('dwQueueBadge');
  if (badge) badge.style.display = 'none';
}

function dashDismissEvent(id) {
  const el = document.getElementById('dwev-' + id);
  if (el) { el.style.opacity = '0'; el.style.transition = 'opacity .2s'; setTimeout(() => el.remove(), 200); }
  const dismissed = _getDismissed(DW_DISMISSED_EVENTS);
  dismissed.add(String(id));
  _saveDismissed(DW_DISMISSED_EVENTS, dismissed);
  const list = document.getElementById('dwEventsList');
  if (list && !list.querySelector('.dash-list-item')) {
    setTimeout(() => { list.innerHTML = `<div class="dash-list-empty">لا توجد فعاليات قادمة</div>`; }, 250);
  }
}

function dashDismissSched(id) {
  const el = document.getElementById('dwsc-' + id);
  if (el) { el.style.opacity = '0'; el.style.transition = 'opacity .2s'; setTimeout(() => el.remove(), 200); }
  const dismissed = _getDismissed(DW_DISMISSED_SCHED);
  dismissed.add(String(id));
  _saveDismissed(DW_DISMISSED_SCHED, dismissed);
  const list = document.getElementById('dwSchedList');
  if (list && !list.querySelector('.dash-list-item')) {
    setTimeout(() => { list.innerHTML = `<div class="dash-list-empty">لا توجد رسائل مجدولة</div>`; }, 250);
  }
  // update failed badge
  const badge = document.getElementById('dwSchedBadge');
  if (badge) {
    const count = parseInt(badge.textContent) - 1;
    badge.textContent = count;
    badge.style.display = count > 0 ? '' : 'none';
  }
}

// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Dashboard widget visibility (localStorage)
// ══════════════════════════════════════════════════════════
const DW_KEY = 'halaqat_dash_widgets';
function getDashWidgets() {
  try {
    const stored = JSON.parse(localStorage.getItem(DW_KEY) || '{}');
    return {
      attRing: stored.attRing !== false,
      queue:   stored.queue   !== false,
      events:  stored.events  !== false,
      sched:   stored.sched   !== false,
    };
  } catch(e) { return { attRing:true, queue:true, events:true, sched:true }; }
}
function applyDashWidgets() {
  const w = getDashWidgets();
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('dwAttRing', w.attRing);
  show('dwQueue',   w.queue);
  show('dwEvents',  w.events);
  show('dwSched',   w.sched);
}

// ══════════════════════════════════════════════════════════
//  Teacher Dashboard
// ══════════════════════════════════════════════════════════
async function renderTeacherDashboard() {
  // Greeting
  const greetEl = document.getElementById('teacherGreeting');
  const dateEl  = document.getElementById('teacherDate');
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء النور';
  if (greetEl) greetEl.textContent = `${greet}، ${currentUserName || 'المعلم'} 👋`;
  if (dateEl)  dateEl.textContent  = formatHijriFull(todayISO());

  const classes  = visibleClasses();
  const students = visibleStudents();
  const today    = todayISO();
  const attData  = await apiFetch('/attendance?date=' + today) || [];

  // My class cards
  const cardsEl = document.getElementById('teacherClassCards');
  if (cardsEl) {
    if (classes.length === 0) {
      cardsEl.innerHTML = '<div class="rdb-empty">لم تُسند إليك حلقات بعد</div>';
    } else {
      cardsEl.innerHTML = classes.map(cls => {
        const clsStudents = students.filter(s => s.classId === cls.id);
        const clsAtt = attData.filter(a => a.classId === cls.id);
        const present = clsAtt.filter(a => a.status === 'Present').length;
        const absent  = clsAtt.filter(a => a.status === 'Absent').length;
        const late    = clsAtt.filter(a => a.status === 'Late').length;
        const total   = clsStudents.length;
        const recorded = clsAtt.length > 0;
        return `
          <div class="rdb-class-card" onclick="navigate('attendance')">
            <div class="rdb-class-card-top">
              <div class="rdb-class-name">${cls.name}</div>
              <div class="rdb-class-badge ${recorded ? 'rdb-badge-done' : 'rdb-badge-pending'}">
                ${recorded ? '✓ سُجِّل' : '⏳ لم يُسجَّل'}
              </div>
            </div>
            <div class="rdb-class-stats">
              <span class="rdb-cs-chip rdb-cs-total"><b>${total}</b> طالب</span>
              ${recorded ? `
              <span class="rdb-cs-chip rdb-cs-present"><b>${present}</b> حاضر</span>
              <span class="rdb-cs-chip rdb-cs-absent"><b>${absent}</b> غائب</span>
              ${late > 0 ? `<span class="rdb-cs-chip rdb-cs-late"><b>${late}</b> متأخر</span>` : ''}
              ` : ''}
            </div>
          </div>`;
      }).join('');
    }
  }

  // Attendance summary (recent absences for my students)
  const summaryEl = document.getElementById('teacherAttSummary');
  if (summaryEl) {
    const absentToday = attData.filter(a => a.status === 'Absent' && students.find(s => s.id === a.studentId));
    if (absentToday.length === 0) {
      summaryEl.innerHTML = '<div class="rdb-empty rdb-empty-good">🎉 لا غائبين اليوم!</div>';
    } else {
      summaryEl.innerHTML = `<div class="rdb-absent-list">` +
        absentToday.map(a => {
          const s   = students.find(x => x.id === a.studentId);
          const cls = classes.find(c => c.id === a.classId);
          return s ? `<div class="rdb-absent-item">
            <div class="rdb-absent-avatar">${s.name.charAt(0)}</div>
            <div class="rdb-absent-info">
              <div class="rdb-absent-name">${s.name}</div>
              <div class="rdb-absent-class">${cls?.name || ''}</div>
            </div>
          </div>` : '';
        }).join('') + `</div>`;
    }
  }
}

// ══════════════════════════════════════════════════════════
//  Moderator Dashboard
// ══════════════════════════════════════════════════════════
async function renderModeratorDashboard() {
  const stats = await apiFetch('/stats');
  if (!stats) return;

  // Stats
  document.getElementById('mod-stat-students').textContent = stats.totalStudents;
  document.getElementById('mod-stat-present').textContent  = stats.presentToday;
  document.getElementById('mod-stat-absent').textContent   = stats.absentToday;
  document.getElementById('mod-stat-classes').textContent  = stats.totalClasses;

  // Coverage
  const coverage = stats.classCoverage || [];
  const done     = coverage.filter(c => c.count > 0 && c.done).length;
  const total    = coverage.filter(c => c.count > 0).length;
  const numEl    = document.getElementById('mod-stat-coverage-num');
  const barEl    = document.getElementById('mod-stat-coverage-bar');
  const todoEl   = document.getElementById('mod-stat-coverage-todo');
  if (numEl) numEl.textContent = `${done} / ${total}`;
  if (barEl && total > 0) {
    const pct = Math.round(done / total * 100);
    const color = done === total ? '#16a34a' : done > 0 ? '#d97706' : '#dc2626';
    barEl.innerHTML = `<div style="height:6px;background:var(--border);border-radius:4px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width .5s"></div></div>`;
  }
  if (todoEl) {
    const todo = stats.classesTodo || [];
    todoEl.innerHTML = todo.length === 0
      ? (total > 0 ? '<span style="color:#16a34a;font-size:11px;font-weight:600">✓ جميع الحلقات سُجِّلت اليوم</span>' : '')
      : `<span style="color:#b45309;font-size:11px">لم تُسجَّل بعد: ${todo.join(' · ')}</span>`;
  }

  // Holiday banner
  const banner = document.getElementById('dashHolidayBannerMod');
  if (banner) {
    if (stats.isHoliday) {
      banner.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"/></svg> إجازة اليوم: ${stats.holidayReason}</span>`;
      banner.classList.remove('hidden');
    } else { banner.classList.add('hidden'); }
  }

  // Attendance ring
  const tot = (stats.presentToday||0)+(stats.absentToday||0)+(stats.lateToday||0)+(stats.excusedToday||0);
  const rate = tot > 0 ? Math.round((stats.presentToday+stats.lateToday)/tot*100) : 0;
  const pctEl  = document.getElementById('modDashAttPct');
  const ringEl = document.getElementById('modDashRingFill');
  const brkEl  = document.getElementById('modDashAttBreakdown');
  if (pctEl) { pctEl.textContent = tot > 0 ? rate : '—'; }
  if (ringEl) {
    const r = 38, circ = 2*Math.PI*r;
    const color = rate>=80 ? '#16a34a' : rate>=60 ? '#d97706' : '#dc2626';
    ringEl.style.strokeDasharray  = circ;
    ringEl.style.strokeDashoffset = tot > 0 ? circ*(1-rate/100) : circ;
    ringEl.style.stroke = color;
    if (pctEl) pctEl.style.color = color;
  }
  if (brkEl && tot > 0) {
    brkEl.innerHTML = `
      <span class="dash-bd-chip dash-bd-p">✓ ${stats.presentToday}</span>
      <span class="dash-bd-chip dash-bd-l">⏱ ${stats.lateToday}</span>
      <span class="dash-bd-chip dash-bd-e">📋 ${stats.excusedToday}</span>
      <span class="dash-bd-chip dash-bd-a">✗ ${stats.absentToday}</span>`;
  }

  // Events widget
  const evListEl = document.getElementById('modDwEventsList');
  if (evListEl) {
    const events = await apiFetch('/calendar') || [];
    const today  = todayISO();
    const upcoming = events.filter(e => e.date >= today).sort((a,b) => a.date.localeCompare(b.date)).slice(0,5);
    if (upcoming.length === 0) {
      evListEl.innerHTML = '<div class="dash-list-empty">لا توجد فعاليات قادمة</div>';
    } else {
      evListEl.innerHTML = upcoming.map(ev => `
        <div class="dash-list-item">
          <div class="dash-li-avatar" style="background:#EDE9FE;color:#7C3AED">📅</div>
          <div class="dash-li-body">
            <div class="dash-li-title">${ev.title}</div>
            <div class="dash-li-sub">${formatDateAr(ev.date)}</div>
          </div>
        </div>`).join('');
    }
  }
}


/* ── modules/attendance.js ── */
//  تسجيل الحضور