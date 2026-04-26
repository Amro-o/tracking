// ══════════════════════════════════════════════════════════
function initAttendance() {
  setDateToday('attDate', 'attDateHijri');
  const sel = document.getElementById('attClass');
  sel.innerHTML = '<option value="">— اختر الحلقة —</option>';
  const classes = visibleClasses();
  classes.forEach(cls => {
    const opt = document.createElement('option');
    opt.value = cls.id; opt.textContent = cls.name; sel.appendChild(opt);
  });
  // Auto-select if only one class visible (teacher with one assigned class)
  if (classes.length === 1) {
    sel.value = classes[0].id;
    loadAttendanceClass();
  } else {
    document.getElementById('attStudentList').innerHTML = '';
    document.getElementById('attMarkRow')?.classList.add('hidden');
    document.getElementById('attStickyBar')?.classList.add('hidden');
  }
}

async function loadAttendanceClass() {
  const date    = document.getElementById('attDate').value;
  const classId = document.getElementById('attClass').value;
  if (!classId) return;
  const holiday = await apiFetch(`/holidays/check/${date}`);
  const noteEl  = document.getElementById('attHolidayNote');
  if (holiday?.isHoliday) {
    noteEl.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> هذا اليوم إجازة: <strong>${holiday.reason}</strong> — ${formatDateDisplayFull(date)}`;
    noteEl.classList.remove('hidden');
  } else { noteEl.classList.add('hidden'); }
  await loadAttendanceStudents();
}

async function loadAttendanceStudents() {
  const date    = document.getElementById('attDate').value;
  const classId = document.getElementById('attClass').value;
  if (!classId || !date) return;
  updateHijriLabel(document.getElementById('attDate'), 'attDateHijri');
  const students   = state.students.filter(s => s.classId === classId);
  const attendance = await apiFetch(`/attendance?date=${date}&classId=${classId}`);
  const leaves     = await apiFetch(`/leaves?date=${date}&classId=${classId}`);
  const attMap     = {}; if (attendance) attendance.forEach(a => attMap[a.studentId] = a);
  const leaveMap   = {}; if (leaves)     leaves.forEach(l => leaveMap[l.studentId] = l);
  _currentLeaveMap = leaveMap;  // store for saveAttendance
  const holiday    = await apiFetch(`/holidays/check/${date}`);
  const container  = document.getElementById('attStudentList');
  const markRow    = document.getElementById('attMarkRow');
  container.innerHTML = '';

  // ── Once-a-day lock: check if attendance already saved today for this class ──
  const todayISO_ = todayISO();
  const isToday   = (date === todayISO_);
  const alreadySaved = !_attForceUnlocked && isToday && attendance && attendance.length > 0 &&
    students.every(s => attMap[s.id]);  // every student has a record
  _attAlreadySaved   = alreadySaved;
  _attForceUnlocked  = false; // reset after use

  // Reset leave tracking
  _leaveStudentIds = new Set();
  if (leaves) leaves.forEach(l => {
    // Only block if no override attendance record exists
    if (!attMap[l.studentId]) _leaveStudentIds.add(l.studentId);
  });

  if (students.length === 0) {
    container.innerHTML = '<div class="info-banner">لا يوجد طلاب في هذه الحلقة بعد.</div>';
    markRow?.classList.add('hidden');
    return;
  }



  const leaveTypeLabel = { Sick: ic('thermometer','ic-red')+' مرض', Permission: ic('clipboard','ic-blue')+' إذن خروج', Travel: ic('plane','ic-sky')+' سفر', Family: ic('alert-circle','ic-amber')+' طارئ', Other: ic('file-text','ic-gray')+' أخرى' };

  students.forEach((s, idx) => {
    const rec    = attMap[s.id];
    const leave  = leaveMap[s.id];
    // A student is "leave-locked" if they have a leave and no override record
    const isLeaveLocked = !!leave && !rec;
    const status = holiday?.isHoliday ? 'Holiday' : (rec?.status || (isLeaveLocked ? 'Excused' : ''));
    const div    = document.createElement('div');
    div.id        = `att-row-${s.id}`;

    const firstLetter = s.name.trim().charAt(0);
    const rowNum      = String(idx + 1).padStart(2, '0');

    // Leave badge + cancel button (only if no record yet)
    const leaveBadge = leave
      ? `<span class="leave-badge">${leaveTypeLabel[leave.type]||'إذن'}</span>`
      : '';
    const cancelBtn = leave && !rec
      ? `<button class="att-btn-cancel-leave" onclick="cancelLeave('${leave.id}','${s.id}','${date}','${classId}')" title="إلغاء الإذن"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`
      : '';

    // Gray out: student has active leave (no override) OR attendance already saved (and not unlocked)
    const leaveClass = isLeaveLocked ? 'att-row-has-leave att-row-leave-locked' : '';
    const savedClass = (alreadySaved && !isLeaveLocked) ? 'att-row-saved' : '';

    div.className = `att-row ${status ? 'status-'+status : ''} ${leaveClass} ${savedClass}`.trim();

    // For leave-locked students: show grayed-out controls with hint
    const leaveLockedControls = isLeaveLocked ? `
      <div class="att-leave-locked-hint">
        <span>${leaveTypeLabel[leave.type]||'إذن'} — ${leave.reason||''}</span>
        <span class="att-leave-hint-txt">غير متاح للتعديل من هنا • عدّل من ملف الطالب</span>
      </div>` : '';

    // For already-saved (but not leave-locked): show status with lock icon
    const savedControls = (alreadySaved && !isLeaveLocked) ? `
      <div class="att-saved-row-hint">
        <span class="badge badge-${status?.toLowerCase()||'default'}">${{Present:'حاضر',Absent:'غائب',Late:'متأخر',Excused:'بعذر',Holiday:'إجازة'}[status]||status}</span>
        <span class="att-leave-hint-txt">مُسجَّل — اضغط "تعديل" أعلاه للتغيير</span>
      </div>` : '';

    div.innerHTML = `
      <div class="att-row-top">
        <div class="att-avatar">${firstLetter}</div>
        <div class="att-info">
          <span class="att-name">${s.name}</span>
          ${leaveBadge}
        </div>
        <span class="att-row-idx">${rowNum}</span>
        ${cancelBtn}
      </div>
      <div class="att-controls">
        ${holiday?.isHoliday
          ? `<div class="att-holiday-bar"><span class="badge badge-holiday">إجازة اليوم</span></div>`
          : isLeaveLocked
            ? leaveLockedControls
            : alreadySaved
              ? savedControls
              : `
                <button class="att-btn att-btn-present ${status==='Present'?'active':''}" onclick="setAttStatus('${s.id}','Present')">
                  <span class="att-btn-icon ui-ic ic-green"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span><span>حاضر</span>
                </button>
                <button class="att-btn att-btn-absent ${status==='Absent'?'active':''}" onclick="setAttStatus('${s.id}','Absent')">
                  <span class="att-btn-icon ui-ic ic-red"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span><span>غائب</span>
                </button>
                <button class="att-btn att-btn-late ${status==='Late'?'active':''}" onclick="setAttStatus('${s.id}','Late')">
                  <span class="att-btn-icon ui-ic ic-amber"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span><span>متأخر</span>
                </button>
                <button class="att-btn att-btn-excused ${status==='Excused'?'active':''}" onclick="setAttStatus('${s.id}','Excused')" title="بعذر (ليس مرضاً أو طارئاً — استخدم إذن مسبق لذلك)">
                  <span class="att-btn-icon ui-ic ic-purple"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l1.5-3 2 4.5 1.5-3 1.5 3h5.27"/></svg></span><span>بعذر</span>
                </button>
              `
        }
      </div>
      <input type="text" class="att-notes" placeholder="ملاحظات…" ${isLeaveLocked || alreadySaved ? 'disabled' : ''} value="${rec?.notes||(isLeaveLocked?`${leaveTypeLabel[leave.type]||''} — ${leave.reason||''}`:'')||''}" />
    `;
    container.appendChild(div);
  });

  if (!holiday?.isHoliday) {
    markRow?.classList.remove('hidden');
    document.getElementById('attSaveBottom')?.classList.remove('hidden');
    updateAttCounter();
  } else {
    markRow?.classList.add('hidden');
    document.getElementById('attSaveBottom')?.classList.add('hidden');
  }
}

function setAttStatus(studentId, status) {
  const row = document.getElementById(`att-row-${studentId}`);
  if (!row) return;
  // Block if student has an active leave (no override)
  if (_leaveStudentIds.has(studentId)) {
    toast('هذا الطالب لديه إذن غياب — عدّل حالته من ملف الطالب');
    return;
  }
  // Block if attendance already saved and not unlocked
  if (_attAlreadySaved) {
    toast('تم تسجيل الحضور مسبقاً لهذا اليوم');
    return;
  }
  row.className = `att-row status-${status}${row.classList.contains('att-row-has-leave') ? ' att-row-has-leave' : ''}`;
  row.querySelectorAll('.att-btn').forEach(b => b.classList.remove('active'));
  const map = { Present:'att-btn-present', Absent:'att-btn-absent', Late:'att-btn-late', Excused:'att-btn-excused' };
  row.querySelector(`.${map[status]}`)?.classList.add('active');
  updateAttCounter();
}

// Unlock the once-a-day lock so the user can re-edit attendance
function unlockAttendance() {
  _attAlreadySaved = false;
  _attForceUnlocked = true;
  loadAttendanceStudents();
}

function updateAttCounter() {
  const classId = document.getElementById('attClass')?.value;
  if (!classId) return;
  const cnt = { Present: 0, Absent: 0, Late: 0, Excused: 0 };
  state.students.filter(s => s.classId === classId).forEach(s => {
    const row = document.getElementById(`att-row-${s.id}`);
    if (!row) return;
    const sc = [...row.classList].find(c => c.startsWith('status-'));
    const st = sc ? sc.replace('status-', '') : '';
    if (cnt[st] !== undefined) cnt[st]++;
  });
  const el = (id) => document.getElementById(id);
  if (el('attCountPresent')) el('attCountPresent').textContent = cnt.Present;
  if (el('attCountAbsent'))  el('attCountAbsent').textContent  = cnt.Absent;
  if (el('attCountLate'))    el('attCountLate').textContent    = cnt.Late;
  if (el('attCountExcused')) el('attCountExcused').textContent = cnt.Excused;
}

function markAll(status) {
  state.students.filter(s => s.classId === document.getElementById('attClass').value)
    .forEach(s => setAttStatus(s.id, status));
}

// ── State for the saved-modal flow ────────────────────────
let _savedClassId   = '';
let _savedDate      = '';
let _savedAbsent    = [];  // [{id, name, phone, studentId}]
let _waSendingInModal = false;

async function saveAttendance() {
  const date    = document.getElementById('attDate').value;
  const classId = document.getElementById('attClass').value;
  if (!classId || !date) return toast('يرجى اختيار الحلقة والتاريخ');
  const students = state.students.filter(s => s.classId === classId);
  
  // Check all students have a status assigned
  const unassigned = students.filter(s => {
    const row = document.getElementById(`att-row-${s.id}`);
    if (!row) return false;
    // Skip holiday / leave-locked rows
    if (row.classList.contains('att-row-leave-locked')) return false;
    if (row.querySelector('.att-holiday-bar')) return false;
    if (row.querySelector('.att-saved-row-hint')) return false; // already saved
    const statusClass = [...row.classList].find(c => c.startsWith('status-'));
    return !statusClass;
  });
  if (unassigned.length > 0) {
    const names = unassigned.slice(0, 3).map(s => s.name).join('، ');
    const extra = unassigned.length > 3 ? ` و${unassigned.length - 3} آخرين` : '';
    toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:4px"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> لم يُحدَّد حضور: ${names}${extra}`, 4000);
    // Highlight unassigned rows
    unassigned.forEach(s => {
      const row = document.getElementById(`att-row-${s.id}`);
      if (row) { row.classList.add('att-row-unassigned'); setTimeout(() => row.classList.remove('att-row-unassigned'), 3000); }
    });
    return;
  }
  const records  = students.map(s => {
    const row        = document.getElementById(`att-row-${s.id}`);
    if (!row) return null;
    const statusClass = [...row.classList].find(c => c.startsWith('status-'));
    let   status     = statusClass ? statusClass.replace('status-','') : '';
    if (!status) return null; // no status selected — skip this student
    // If student has an active leave with no manual override, force Excused
    if (_currentLeaveMap[s.id] && status === 'Absent') status = 'Excused';
    const notes      = row.querySelector('.att-notes')?.value || '';
    return { studentId: s.id, status, notes };
  }).filter(Boolean);

  await apiFetch('/attendance/batch', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ date, classId, records, teacherName: currentUserName || '' }),
  });

  // ── حساب الملخص ──────────────────────────────────────
  const cnt = { Present:0, Absent:0, Late:0, Excused:0, Holiday:0 };
  records.forEach(r => { if (cnt[r.status] !== undefined) cnt[r.status]++; });
  const cls       = state.classes.find(c => c.id === classId);
  const dateHijri = formatDateDisplayFull(date);

  // ── حفظ الحالة للنافذة ───────────────────────────────
  _savedClassId = classId;
  _savedDate    = date;
  _waSendingInModal = false;

  // ── الغائبون ─────────────────────────────────────────
  _savedAbsent = records
    .filter(r => r.status === 'Absent')
    .map(r => {
      const s = students.find(x => x.id === r.studentId);
      return s ? { id: s.id, name: s.name, phone: s.parentPhone || '', studentId: r.studentId } : null;
    }).filter(Boolean);

  // ── الحلقة التالية — من الحلقات المرئية فقط ──────────
  const visClasses = visibleClasses();
  const classIds   = visClasses.map(c => c.id);
  const curIdx     = classIds.indexOf(classId);
  const nextClass  = curIdx >= 0 && curIdx < classIds.length - 1
    ? visClasses[curIdx + 1] : null;

  // ── تعبئة النافذة ────────────────────────────────────
  document.getElementById('attSavedDate').textContent     = dateHijri;
  document.getElementById('attSavedClass').textContent    = cls?.name || '—';
  document.getElementById('attSavedPresent').textContent  = cnt.Present;
  document.getElementById('attSavedAbsent').textContent   = cnt.Absent;
  document.getElementById('attSavedLate').textContent     = cnt.Late;
  document.getElementById('attSavedExcused').textContent  = cnt.Excused;
  document.getElementById('attSavedTotal').textContent    = records.length;

  // بادج الحلقة التالية
  const nextBadge = document.getElementById('attSavedNextBadge');
  if (nextClass) {
    nextBadge.textContent = `التالية: ${nextClass.name}`;
    nextBadge.classList.remove('hidden');
  } else {
    nextBadge.classList.add('hidden');
  }

  // ── قسم واتساب ───────────────────────────────────────
  const waSection = document.getElementById('attSavedWaSection');
  if (_savedAbsent.length > 0) {
    waSection.classList.remove('hidden');
    _renderModalWaList();
  } else {
    waSection.classList.add('hidden');
  }
  document.getElementById('attSavedWaSendStatus')?.classList.add('hidden');

  // ── أزرار الإجراءات ──────────────────────────────────
  _renderSavedModalActions(nextClass);

  // إظهار النافذة
  document.getElementById('attSavedModal').classList.remove('hidden');

  // إخفاء لوحة واتساب القديمة تحت القائمة
  document.getElementById('waNotifyPanel')?.classList.add('hidden');
}

function _renderModalWaList() {
  const list = document.getElementById('attSavedWaList');
  if (!list) return;
  list.innerHTML = _savedAbsent.map((s, i) => `
    <div class="att-wa-row" id="att-wa-row-${i}">
      <div class="att-wa-name">${s.name}</div>
      <div class="att-wa-phone">
        ${s.phone
          ? `<span class="att-wa-num">${s.phone}</span>`
          : `<input type="tel" class="att-wa-input" placeholder="رقم الهاتف" data-widx="${i}" />`}
      </div>
      <div class="att-wa-status" id="att-wa-status-${i}">
        ${s.phone ? '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span>' : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'}
      </div>
    </div>
  `).join('');
}

function _renderSavedModalActions(nextClass) {
  const container = document.getElementById('attSavedActions');
  if (!container) return;
  const hasAbsent = _savedAbsent.length > 0;
  const hasNext   = !!nextClass;
  const nextName  = nextClass?.name || '';

  let html = `<div class="att-saved-actions-grid">`;

  // Always: close + home
  html += `<button class="att-action-btn att-action-close" onclick="closeModal('attSavedModal')">
    <span class="att-action-icon ui-ic ic-red"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>
    <span class="att-action-label">إغلاق</span>
  </button>`;

  html += `<button class="att-action-btn att-action-home" onclick="closeModal('attSavedModal');navigate('dashboard')">
    <span class="att-action-icon ui-ic ic-sky"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
    <span class="att-action-label">الرئيسية</span>
  </button>`;

  // Next class button
  if (hasNext) {
    html += `<button class="att-action-btn att-action-next" onclick="goToNextClass()">
      <span class="att-action-icon ui-ic ic-blue"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg></span>
      <span class="att-action-label">الحلقة التالية</span>
      <span class="att-action-sub">${nextName}</span>
    </button>`;
  }

  // WhatsApp button — only for admin/moderator
  // Teachers: silently add to WA queue without showing button
  if (hasAbsent) {
// Teachers: silently add to WA queue without showing button
// (No action needed — absent attendance records automatically appear in admin's WA queue)
    if (currentRole === 'teacher') {
      // Nothing to do — the saved attendance records feed the WA queue automatically
    } else if (hasNext) {
      html += `<button class="att-action-btn att-action-wa-next" id="attWaNextBtn" onclick="sendWaThenNextClass()">
        <span class="att-action-icon ui-ic ic-teal"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
        <span class="att-action-label">واتساب + التالية</span>
        <span class="att-action-sub">إرسال ثم ${nextName}</span>
      </button>`;
    } else {
      html += `<button class="att-action-btn att-action-wa-next" id="attWaNextBtn" onclick="sendWaFromModal()">
        <span class="att-action-icon ui-ic ic-teal"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
        <span class="att-action-label">إرسال واتساب</span>
        <span class="att-action-sub">إشعار أولياء ${_savedAbsent.length} غائب</span>
      </button>`;
    }
  }

  html += `</div>`;
  container.innerHTML = html;
}

function goToNextClass() {
  const visClasses = visibleClasses();
  const classIds   = visClasses.map(c => c.id);
  const curIdx     = classIds.indexOf(_savedClassId);
  if (curIdx < 0 || curIdx >= classIds.length - 1) return;
  const nextId  = classIds[curIdx + 1];
  const nextCls = visClasses[curIdx + 1];
  closeModal('attSavedModal');
  const sel = document.getElementById('attClass');
  if (sel) { sel.value = nextId; loadAttendanceClass(); }
  if (document.getElementById('page-attendance').classList.contains('hidden')) {
    navigate('attendance');
  }
  document.querySelector('.page-container')?.scrollTo({ top: 0, behavior: 'smooth' });
  toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> الحلقة التالية: ${nextCls?.name}`);
}

// For teachers: silently add absent students to the WA queue (no sending, just queue)
async function _queueWaAbsentSilent(absentStudents, classId, date) {
  if (!absentStudents?.length) return;
  try {
    await apiFetch('/whatsapp/queue', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ students: absentStudents, classId, date, source: 'teacher' }),
    });
  } catch(e) { /* silent — teacher doesn't see errors */ }
}

async function sendWaThenNextClass() {
  if (_waSendingInModal) return;
  _waSendingInModal = true;
  const btn    = document.getElementById('attWaNextBtn');
  const status = document.getElementById('attSavedWaSendStatus');
  if (btn)    { btn.disabled = true; btn.querySelector('.att-action-label').innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ الإرسال…'; }
  if (status) { status.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ إرسال إشعارات الغياب…'; status.classList.remove('hidden'); }

  await _doSendWaFromModal();

  // بعد الإرسال — انتقل للحلقة التالية
  setTimeout(() => { goToNextClass(); _waSendingInModal = false; }, 900);
}

async function sendWaFromModal() {
  if (_waSendingInModal) return;
  _waSendingInModal = true;
  const btn    = document.getElementById('attWaNextBtn');
  const status = document.getElementById('attSavedWaSendStatus');
  if (btn)    { btn.disabled = true; btn.querySelector('.att-action-label').innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ الإرسال…'; }
  if (status) { status.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ إرسال إشعارات الغياب…'; status.classList.remove('hidden'); }

  const result = await _doSendWaFromModal();
  if (btn) btn.disabled = false;
  _waSendingInModal = false;
}

async function _doSendWaFromModal() {
  const cls     = state.classes.find(c => c.id === _savedClassId);
  const records = _savedAbsent.map((s, i) => ({
    studentId: s.id,
    name:      s.name,
    phone:     s.phone || document.querySelector(`[data-widx="${i}"]`)?.value?.trim() || '',
  }));

  // تحديث حالة كل صف
  records.forEach((_, i) => {
    const el = document.getElementById(`att-wa-status-${i}`);
    if (el) el.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span>';
  });

  const res = await apiFetch('/whatsapp/send-bulk', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records, date: _savedDate, classId: _savedClassId }),
  });

  const status = document.getElementById('attSavedWaSendStatus');
  if (res?.results) {
    res.results.forEach((r, i) => {
      const el = document.getElementById(`att-wa-status-${i}`);
      if (el) el.innerHTML = r.ok ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    });
    const msg = res.failed === 0
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم إرسال جميع الرسائل بنجاح (${res.sent})`
      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> ${res.sent} نجح&nbsp; <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ${res.failed} فشل`;
    if (status) { status.textContent = msg; status.classList.remove('hidden'); }
    showWaSummaryNotif(res.sent, res.failed);
    if (res.failed > 0) showWaFailNotif('رسائل الغياب', res.failed, null);
  } else if (res?.error) {
    if (status) { status.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ${res.error}`; status.classList.remove('hidden'); }
    showWaSummaryNotif(0, 0, res.error);
    showWaFailNotif('رسائل الغياب', 0, res.error);
  }
  return res;
}



// ══════════════════════════════════════════════════════════


/* ── modules/whatsapp.js ── */
//  واتساب — إشعارات الغياب
// ══════════════════════════════════════════════════════════
let _waAbsent = [], _waDate = '', _waClassId = '';

function renderWhatsAppPanel(absentStudents, date, classId) {
  _waAbsent  = absentStudents;
  _waDate    = date;
  _waClassId = classId;
  const panel = document.getElementById('waNotifyPanel');
  const list  = document.getElementById('waAbsentList');
  if (!panel || !list) return;

  list.innerHTML = absentStudents.map((s, i) => `
    <div class="wa-absent-row" id="wa-row-${i}">
      <div class="wa-absent-name">${s.name}</div>
      <div class="wa-absent-phone">
        ${s.phone
          ? `<span class="wa-phone-num">${s.phone}</span>`
          : `<input type="tel" class="wa-phone-input" placeholder="أدخل رقم الهاتف" data-idx="${i}" value="" />`
        }
      </div>
      <div class="wa-absent-status" id="wa-status-${i}">
        ${s.phone ? '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> في الانتظار' : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> لا يوجد رقم'}
      </div>
    </div>
  `).join('');

  document.getElementById('waSendStatus').textContent = '';
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function sendWhatsAppSingle(idx) {
  const s      = _waAbsent[idx];
  const phone  = s.phone || document.querySelector(`[data-idx="${idx}"]`)?.value?.trim();
  const status = document.getElementById(`wa-status-${idx}`);
  if (!phone) { if (status) status.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> أدخل الرقم أولاً'; return; }
  if (status) status.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ الإرسال…';
  const cls  = state.classes.find(c => c.id === _waClassId);
  const res  = await apiFetch('/whatsapp/send', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ phone, studentName: s.name, className: cls?.name||'', date: _waDate }),
  });
  if (status) status.innerHTML = res?.ok ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم الإرسال' : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ${res?.error||'فشل'}`;
}

async function sendWhatsAppBulk() {
  const btn    = document.getElementById('waSendAllBtn');
  const status = document.getElementById('waSendStatus');
  if (btn) btn.disabled = true;

  // تجميع الأرقام (بما فيها المدخلة يدوياً)
  const records = _waAbsent.map((s, i) => ({
    studentId: s.id,
    name:      s.name,
    phone:     s.phone || document.querySelector(`[data-idx="${i}"]`)?.value?.trim() || '',
  }));

  // تحديث حالة كل صف
  records.forEach((_, i) => {
    const el = document.getElementById(`wa-status-${i}`);
    if (el) el.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ…';
  });

  if (status) status.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ الإرسال — قد يستغرق بضع ثوانٍ…';

  const res = await apiFetch('/whatsapp/send-bulk', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ records, date: _waDate, classId: _waClassId }),
  });

  if (res?.results) {
    res.results.forEach((r, i) => {
      const el = document.getElementById(`wa-status-${i}`);
      if (el) el.innerHTML = r.ok ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم الإرسال' : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ${r.error||'فشل'}`;
    });
    if (status) status.innerHTML = res.failed === 0
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم إرسال جميع الرسائل (${res.sent})`
      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> ${res.sent} نجح&nbsp; <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ${res.failed} فشل`;
    showWaSummaryNotif(res.sent, res.failed);
    if (res.failed > 0) showWaFailNotif('رسائل الغياب', res.failed, null);
  } else if (res?.error) {
    if (status) { status.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ${res.error}`; status.style.color = 'var(--error)'; }
    showWaSummaryNotif(0, 0, res.error);
    showWaFailNotif('رسائل الغياب', 0, res.error);
  }
  if (btn) btn.disabled = false;
}

// ══════════════════════════════════════════════════════════
//  إعدادات واتساب
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  قوالب واتساب
// ══════════════════════════════════════════════════════════
let _editingTemplateId = null;

function renderTemplateList() {
  const list = document.getElementById('waTemplateList');
  if (!list) return;
  const templates = state.waTemplates || [];
  if (!templates.length) {
    list.innerHTML = '<div class="section-desc" style="padding:10px 0">لا توجد قوالب محفوظة — اضغط «إضافة قالب» لإنشاء أول قالب.</div>';
    return;
  }
  list.innerHTML = templates.map(t => `
    <div class="template-item" id="tpl-${t.id}">
      <div class="template-item-name">${t.name}</div>
      <div class="template-item-preview">${t.body.slice(0,80)}${t.body.length>80?'…':''}</div>
      <div class="template-item-actions">
        <button class="btn-secondary" style="font-size:12px;padding:4px 10px" onclick="editTemplate('${t.id}')"><span class="ui-ic ic-blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span> تعديل</button>
        <button class="btn-secondary" style="font-size:12px;padding:4px 10px;color:var(--error)" onclick="deleteTemplate('${t.id}')"><span class="ui-ic ic-red"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span></button>
      </div>
    </div>
  `).join('');
}

function openTemplateModal(id = null) {
  _editingTemplateId = id;
  const t = id ? (state.waTemplates||[]).find(x=>x.id===id) : null;
  document.getElementById('templateModalTitle').textContent = id ? 'تعديل قالب' : 'إضافة قالب جديد';
  document.getElementById('fTemplateName').value = t?.name || '';
  document.getElementById('fTemplateBody').value = t?.body || '';
  document.getElementById('templateModal').classList.remove('hidden');
}

function editTemplate(id) { openTemplateModal(id); }

async function saveTemplate() {
  const name = document.getElementById('fTemplateName').value.trim();
  const body = document.getElementById('fTemplateBody').value.trim();
  if (!name) return toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> اسم القالب مطلوب');
  if (!body) return toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> نص القالب مطلوب');
  const templates = [...(state.waTemplates||[])];
  if (_editingTemplateId) {
    const i = templates.findIndex(t=>t.id===_editingTemplateId);
    if (i>=0) templates[i] = { ...templates[i], name, body };
  } else {
    templates.push({ id: 'tpl_'+Date.now(), name, body });
  }
  state.waTemplates = templates;
  await apiFetch('/settings', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ waTemplates: templates }) });
  closeModal('templateModal');
  renderTemplateList();
  toast('<span data-toast="ok"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span> تم حفظ القالب');
}

async function deleteTemplate(id) {
  if (!confirm('هل تريد حذف هذا القالب؟')) return;
  state.waTemplates = (state.waTemplates||[]).filter(t=>t.id!==id);
  await apiFetch('/settings', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ waTemplates: state.waTemplates }) });
  renderTemplateList();
  toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> تم حذف القالب');
}

function insertTemplateVar(varText) {
  const ta = document.getElementById('fTemplateBody');
  if (!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  ta.value = ta.value.slice(0,start) + varText + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + varText.length;
  ta.focus();
}
// ══════════════════════════════════════════════════════════
//  Telegram Backup
// ══════════════════════════════════════════════════════════

async function saveTelegramSettings() {
  const botToken = document.getElementById('settTgBotToken')?.value.trim();
  const chatId   = document.getElementById('settTgChatId')?.value.trim();
  const status   = document.getElementById('tgBackupStatus');
  if (!botToken || !chatId) {
    if (status) { status.style.color = 'var(--error)'; status.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> أدخل Bot Token وChat ID أولاً'; }
    return;
  }
  await apiFetch('/settings', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegramBotToken: botToken, telegramChatId: chatId }),
  });
  if (status) { status.style.color = 'var(--success)'; status.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم الحفظ'; }
  setTimeout(() => { if (status) status.textContent = ''; }, 3000);
}

async function telegramBackup() {
  const status  = document.getElementById('tgBackupStatus');
  const dashBtn = document.getElementById('dashDriveBtn');
  const dashLbl = document.getElementById('dashDriveBtnLabel');

  // ── Auto-save settings from form fields if present ─────
  const botTokenInput = document.getElementById('settTgBotToken');
  const chatIdInput   = document.getElementById('settTgChatId');
  if (botTokenInput?.value.trim() && chatIdInput?.value.trim()) {
    await apiFetch('/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramBotToken: botTokenInput.value.trim(), telegramChatId: chatIdInput.value.trim() }),
    });
  }

  // ── Loading state ──────────────────────────────────────
  if (dashBtn) { dashBtn.disabled = true; }
  if (dashLbl) { dashLbl.textContent = 'جار الإرسال...'; }
  if (status)  { status.style.color = 'var(--text2)'; status.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ الإرسال…'; }

  try {
    const res = await apiFetch('/backup/telegram', { method: 'POST' });

    if (res?.ok) {
      // ── Success ──────────────────────────────────────────
      _saveBackupTs();

      // Dismiss backup reminder from notif panel (auto-dismiss)
      refreshNotifBadge();
      const panel = document.getElementById('notifPanel');
      if (panel && !panel.classList.contains('hidden')) renderNotifPanel();

      if (status) { status.style.color = 'var(--success)'; status.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم إرسال النسخة الاحتياطية إلى Drive'; }
      _showBackupResultNotif(true, null);
      toast('<span data-toast="ok"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span> تم إرسال النسخة الاحتياطية إلى Drive');
    } else {
      // ── Failure ──────────────────────────────────────────
      const msg = res?.error || 'فشل الإرسال';
      if (status) { status.style.color = 'var(--error)'; status.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ' + msg; }
      _showBackupResultNotif(false, msg);
    }
  } catch(e) {
    if (status) { status.style.color = 'var(--error)'; status.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ' + e.message; }
    _showBackupResultNotif(false, e.message);
  }

  // ── Restore button ─────────────────────────────────────
  if (dashBtn) { dashBtn.disabled = false; }
  if (dashLbl) { dashLbl.textContent = 'نسخ Drive'; }
  setTimeout(() => { if (status) status.textContent = ''; }, 5000);
}

function _showBackupResultNotif(success, errorMsg) {
  const existing = document.getElementById('backupResultNotif');
  if (existing) existing.remove();

  const notif = document.createElement('div');
  notif.id = 'backupResultNotif';
  notif.style.cssText =
    'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
    'color:#fff;border-radius:12px;padding:14px 20px;font-size:14px;font-weight:600;' +
    'box-shadow:0 8px 32px rgba(0,0,0,0.3);z-index:9999;display:flex;align-items:center;' +
    'gap:12px;min-width:300px;animation:slideDown 0.3s ease;' +
    (success
      ? 'background:#14532d;border-right:4px solid #22c55e;'
      : 'background:#7f1d1d;border-right:4px solid #ef4444;');

  const icon = success ? 'cloud' : 'error';
  const title = success ? 'تم إرسال النسخة الاحتياطية <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' : 'فشل إرسال النسخة الاحتياطية';
  const sub   = success ? 'وصلت النسخة إلى Telegram بنجاح' : (errorMsg || 'تحقق من إعدادات Telegram');

  notif.innerHTML =
    '<span style="font-size:20px">' + icon + '</span>' +
    '<div style="flex:1">' +
      '<div>' + title + '</div>' +
      '<div style="font-size:11px;opacity:0.75;margin-top:2px;font-weight:400">' + sub + '</div>' +
    '</div>';

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  closeBtn.style.cssText = 'background:none;border:none;color:rgba(255,255,255,0.6);cursor:pointer;font-size:14px;padding:0 0 0 8px;';
  closeBtn.onclick = function() { notif.remove(); };
  notif.appendChild(closeBtn);

  document.body.appendChild(notif);
  setTimeout(function() { if (notif.parentNode) notif.remove(); }, 6000);
}