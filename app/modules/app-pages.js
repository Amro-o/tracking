// ══════════════════════════════════════════════════════════
function renderClassList() {
  const list = document.getElementById('classList');
  list.innerHTML = '';
  const classes = visibleClasses();
  if (classes.length === 0) {
    list.innerHTML = '<div class="info-banner">لا توجد حلقات بعد. أضف حلقة للبدء.</div>'; return;
  }
  classes.forEach(cls => {
    const count = state.students.filter(s => s.classId === cls.id).length;
    const card  = document.createElement('div');
    card.className = 'list-card';
    const isTeacher = currentRole === 'teacher';
    card.innerHTML = `
      <div class="list-card-avatar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg></div>
      <div class="list-card-body">
        <div class="list-card-name">${cls.name}</div>
        <div class="list-card-sub">${cls.grade||''} · قاعة ${cls.room||'—'} · ${count} طالب</div>
      </div>
      <div class="list-card-actions">
        <button class="btn-icon" title="طباعة تقدم القرآن" onclick="window.open('${API}/print/quran/class/${cls.id}','_blank')">🖨</button>
        <button class="btn-icon" title="تقرير القرآن Excel" onclick="downloadClassQuranReport('${cls.id}','${cls.name.replace(/'/g,'')}')">📥</button>
        ${isTeacher ? '' : `
        <button class="btn-icon" onclick="openClassModal('${cls.id}')"><span class="ui-ic ic-blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span></button>
        <button class="btn-icon" onclick="deleteClass('${cls.id}')"><span class="ui-ic ic-red"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span></button>
        `}
      </div>`;
    list.appendChild(card);
  });
}

function openClassModal(id=null) {
  if (id) {
    const cls = state.classes.find(c=>c.id===id); if (!cls) return;
    document.getElementById('classModalTitle').textContent = 'تعديل الحلقة';
    document.getElementById('classId').value    = cls.id;
    document.getElementById('fClassName').value = cls.name;
    document.getElementById('fClassGrade').value= cls.grade||'';
    document.getElementById('fClassRoom').value = cls.room||'';
  } else {
    document.getElementById('classModalTitle').textContent = 'إضافة حلقة';
    ['classId','fClassName','fClassGrade','fClassRoom'].forEach(i=>document.getElementById(i).value='');
  }
  document.getElementById('classModal').classList.remove('hidden');
}

async function saveClass() {
  const id   = document.getElementById('classId').value;
  const data = { name:document.getElementById('fClassName').value.trim(), grade:document.getElementById('fClassGrade').value.trim(), room:document.getElementById('fClassRoom').value.trim() };
  if (!data.name) return toast('اسم الحلقة مطلوب');
  if (id) await apiFetch(`/classes/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
  else    await apiFetch('/classes', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
  closeModal('classModal'); await loadAll(); renderClassList();
  toast(id ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم تحديث الحلقة' : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تمت إضافة الحلقة');
}

async function deleteClass(id) {
  if (!confirm('هل تريد حذف هذه الحلقة؟')) return;
  await apiFetch(`/classes/${id}`, { method:'DELETE' });
  await loadAll(); renderClassList(); toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> تم حذف الحلقة');
}

function downloadClassQuranReport(classId, className) {
  toast('<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ إنشاء تقرير القرآن…');
  window.open(`${API}/reports/quran/class/${classId}`, '_blank');
}

// ══════════════════════════════════════════════════════════


/* ── modules/teachers.js ── */
//  المعلمون
// ══════════════════════════════════════════════════════════
function renderTeacherList() {
  const list = document.getElementById('teacherList');
  list.innerHTML = '';
  if (state.teachers.length === 0) {
    list.innerHTML = '<div class="info-banner">لا يوجد معلمون بعد. أضف معلمًا للبدء.</div>'; return;
  }
  state.teachers.forEach(t => {
    const log         = state.teacherLog.find(l => l.teacherId === t.id);
    const mins        = log ? calcMinutes(log.checkIn, log.checkOut) : 0;
    const duration    = mins > 0 ? formatDuration(mins) : '';
    const statusClass = log ? (log.checkOut ? 'out' : 'in') : 'absent';
    const statusLabel = log ? (log.checkOut ? 'انصرف' : 'حاضر الآن') : 'غائب';
    const card        = document.createElement('div');
    card.className    = 'list-card teacher-list-card';
    card.onclick      = () => viewTeacher(t.id);
    const initials    = t.name.trim().split(' ').map(w=>w[0]).slice(0,2).join('');
    const avatarHtml  = t.photo
      ? `<div class="list-card-avatar"><img src="${t.photo}" alt="${t.name}" onerror="this.parentElement.innerHTML='<span>${initials}</span>'" /></div>`
      : `<div class="list-card-avatar teacher-avatar-initials">${initials}</div>`;
    card.innerHTML = `
      ${avatarHtml}
      <div class="list-card-body">
        <div class="list-card-name">${t.name}</div>
        <div class="list-card-sub">${t.subject||'معلم'} ${t.teacherId ? '· #'+t.teacherId : ''}</div>
        <div style="margin-top:4px">
          <span class="checkin-status ${statusClass}">${statusLabel}</span>
          ${log && log.checkIn ? `<span style="font-size:11px;color:var(--text2);margin-right:6px;font-family:var(--mono)">${log.checkIn}${log.checkOut?' — '+log.checkOut:''}</span>` : ''}
        </div>
      </div>
      <div class="list-card-actions" onclick="event.stopPropagation()">
        <button class="btn-icon" title="تعديل" onclick="openTeacherModal('${t.id}')"><span class="ui-ic ic-blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span></button>
        <button class="btn-icon" title="حذف"   onclick="deleteTeacher('${t.id}')"><span class="ui-ic ic-red"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span></button>
      </div>`;
    list.appendChild(card);
  });
}

function openTeacherModal(id=null) {
  if (id) {
    const t = state.teachers.find(x=>x.id===id); if (!t) return;
    document.getElementById('teacherModalTitle').textContent = 'تعديل بيانات المعلم';
    document.getElementById('teacherId').value       = t.id;
    document.getElementById('fTeacherId').value      = t.teacherId||'';
    document.getElementById('fTeacherName').value    = t.name;
    document.getElementById('fTeacherSubject').value = t.subject||'';
    document.getElementById('fTeacherPhone').value   = t.phone||'';
    const prev = document.getElementById('fTeacherPhotoPreview');
    const placeholder = document.getElementById('fTeacherPhotoPlaceholder');
    if (t.photo) {
      prev.src = t.photo; prev.classList.remove('hidden');
      if (placeholder) placeholder.style.display = 'none';
    } else {
      prev.classList.add('hidden');
      if (placeholder) placeholder.style.display = '';
    }
  } else {
    document.getElementById('teacherModalTitle').textContent = 'إضافة معلم';
    ['teacherId','fTeacherId','fTeacherName','fTeacherSubject','fTeacherPhone'].forEach(i=>document.getElementById(i).value='');
    const prev = document.getElementById('fTeacherPhotoPreview');
    prev.classList.add('hidden');
    const placeholder = document.getElementById('fTeacherPhotoPlaceholder');
    if (placeholder) placeholder.style.display = '';
    document.getElementById('fTeacherPhoto').value = '';
  }
  document.getElementById('teacherModal').classList.remove('hidden');
}

function previewTeacherPhoto() {
  const file = document.getElementById('fTeacherPhoto').files[0]; if (!file) return;
  const prev = document.getElementById('fTeacherPhotoPreview');
  const placeholder = document.getElementById('fTeacherPhotoPlaceholder');
  prev.src = URL.createObjectURL(file); prev.classList.remove('hidden');
  if (placeholder) placeholder.style.display = 'none';
}

async function saveTeacher() {
  const id   = document.getElementById('teacherId').value;
  const data = { teacherId:document.getElementById('fTeacherId').value.trim(), name:document.getElementById('fTeacherName').value.trim(), subject:document.getElementById('fTeacherSubject').value.trim(), phone:document.getElementById('fTeacherPhone').value.trim() };
  if (!data.name) return toast('الاسم مطلوب');
  let savedId = id;
  if (id) {
    await apiFetch(`/teachers/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
  } else {
    const res = await apiFetch('/teachers', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    savedId = res?.id;
  }
  const photoFile = document.getElementById('fTeacherPhoto').files[0];
  if (photoFile && savedId) {
    const fd = new FormData(); fd.append('photo', photoFile);
    await fetch(`${API}/teachers/${savedId}/photo`, { method:'POST', body:fd });
  }
  closeModal('teacherModal'); await loadAll(); renderTeacherList();
  toast(id ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم تحديث بيانات المعلم' : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تمت إضافة المعلم');
}

async function deleteTeacher(id) {
  if (!confirm('هل تريد حذف هذا المعلم؟')) return;
  await apiFetch(`/teachers/${id}`, { method:'DELETE' });
  await loadAll(); renderTeacherList(); toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> تم حذف المعلم');
}

// ══════════════════════════════════════════════════════════
//  حضور المعلمين (Check-In)
// ══════════════════════════════════════════════════════════
function renderCheckinList() {
  const search   = document.getElementById('checkinSearch')?.value?.toLowerCase() || '';
  let teachers   = state.teachers;
  if (search) teachers = teachers.filter(t => t.name.toLowerCase().includes(search));
  const list     = document.getElementById('checkinList');
  list.innerHTML = '';
  if (teachers.length === 0) {
    list.innerHTML = '<div class="info-banner">لا يوجد معلمون.</div>'; return;
  }
  teachers.forEach(t => {
    const log      = state.teacherLog.find(l => l.teacherId === t.id);
    const mins     = log ? calcMinutes(log.checkIn, log.checkOut) : 0;
    const duration = mins > 0 ? formatDuration(mins) : '';
    const statusClass = log ? (log.checkOut ? 'out' : 'in') : 'absent';
    const statusLabel = log ? (log.checkOut ? 'انصرف' : 'حاضر') : 'غائب';
    const row = document.createElement('div');
    row.className = 'checkin-row';
    row.innerHTML = `
      <div style="flex:1">
        <div style="font-weight:600;font-size:15px">${t.name}</div>
        <div style="font-size:12px;color:var(--text2)">${t.subject||t.teacherId||'—'}</div>
        ${log ? `
          <div class="checkin-times">
            حضور: ${log.checkIn}
            ${log.checkOut ? ' | انصراف: '+log.checkOut : ''}
            ${duration ? ' | <strong>'+duration+'</strong>' : ''}
          </div>` : ''}
      </div>
      <span class="checkin-status ${statusClass}">${statusLabel}</span>
      <div style="display:flex;flex-direction:column;gap:6px;margin-right:8px">
        ${!log ? `<button class="btn-primary" style="font-size:12px;padding:8px 12px" onclick="checkIn('${t.id}')">تسجيل حضور</button>` : ''}
        ${log && !log.checkOut ? `<button class="btn-secondary" style="font-size:12px;padding:8px 12px" onclick="checkOut('${t.id}')">تسجيل انصراف</button>` : ''}
      </div>`;
    list.appendChild(row);
  });
}

async function checkIn(teacherId) {
  const res = await apiFetch('/teacher-log/checkin', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({teacherId}) });
  if (res?.error) return toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> '+res.error);
  await loadAll(); renderCheckinList(); loadTeacherSummary(); toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم تسجيل الحضور!');
}
async function checkOut(teacherId) {
  const res = await apiFetch('/teacher-log/checkout', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({teacherId}) });
  if (res?.error) return toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> '+res.error);
  await loadAll();
  // عرض مدة الحضور في الإشعار
  const duration = res.duration || '';
  renderCheckinList();
  loadTeacherSummary();
  toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم تسجيل الانصراف! ${duration ? '| المدة: '+duration : ''}`);
}

// ── ملخص ساعات المعلمين اليومية ──────────────────────
async function loadTeacherSummary() {
  const data = await apiFetch('/teacher-log/today-summary');
  const card  = document.getElementById('teacherSummaryCard');
  const body  = document.getElementById('teacherSummaryBody');
  const total = document.getElementById('teacherSummaryTotal');
  if (!card || !body || !data) return;
  if (!data.logs || data.logs.length === 0) { card.style.display='none'; return; }
  card.style.display = 'block';
  body.innerHTML = data.logs.map(l => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="font-weight:600">${l.name}</span>
      <span style="font-family:var(--mono);font-size:12px;color:var(--text2)">
        ${l.checkIn||'—'} → ${l.checkOut||'<span style=color:var(--warn)>لم ينصرف</span>'}
        ${l.mins ? `<strong style="color:var(--success);margin-right:8px">${l.duration}</strong>` : ''}
      </span>
    </div>`).join('');
  total.textContent = data.totalDuration;
}

// ══════════════════════════════════════════════════════════

//  ملف المعلم — Teacher Profile
// ══════════════════════════════════════════════════════════════════
async function viewTeacher(id) {
  const t = await apiFetch(`/teachers/${id}`);
  if (!t || t.error) return toast('تعذّر تحميل بيانات المعلم');

  const initials       = t.name.trim().split(' ').map(w => w[0]).slice(0, 2).join('');
  const todayLog       = (t.log||[]).find(l => l.date === todayISO());
  const todayStatus    = todayLog
    ? (todayLog.checkOut ? `انصرف ${todayLog.checkOut}` : `حاضر منذ ${todayLog.checkIn}`)
    : 'لم يسجّل الحضور اليوم';
  const todayClass     = todayLog ? (todayLog.checkOut ? 'out' : 'in') : 'absent';
  const totalMins      = t.totalMins      || 0;
  const monthlyMins    = t.monthlyMins    || 0;
  const todayMins      = t.todayMins      || 0;
  const todayLive      = !!t.todayLive;
  const days           = t.daysPresent    || 0;
  const monthlyHistory = t.monthlyHistory || [];

  function fmtHM(m) {
    if (!m) return '0<span class="tp-stat-unit">س</span>';
    const h = Math.floor(m/60), min = m%60;
    return h + '<span class="tp-stat-unit">س</span>' + (min ? min + '<span class="tp-stat-unit">د</span>' : '');
  }
  function fmtDur(m) {
    if (!m || m<=0) return '—';
    const h = Math.floor(m/60), min = m%60;
    return h>0 ? h+'س'+(min?' '+min+'د':'') : min+'د';
  }

  const DAY_AR = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const GM_AR  = ['','يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const isGreg = getCalType() === 'gregorian';

  // FIX: re-group logs by Gregorian month when calendar is set to Gregorian
  function _buildMonthGroups() {
    const allLogs = t.log || [];
    if (!allLogs.length) return [];
    if (!isGreg) return monthlyHistory; // server already grouped by Hijri — use as-is

    // Group by Gregorian year-month
    const map = {};
    allLogs.forEach(l => {
      if (!l.date) return;
      const parts = l.date.split('-');
      const key = parts[0] + '-' + parts[1]; // "YYYY-MM"
      if (!map[key]) map[key] = { year: +parts[0], month: +parts[1], logs: [], totalMins: 0, days: 0 };
      map[key].logs.push(l);
      map[key].totalMins += l.durationMins || 0;
      if (l.checkIn) map[key].days++;
    });
    return Object.values(map).sort((a, b) => a.year !== b.year ? b.year - a.year : b.month - a.month);
  }

  function buildMonthBlocks() {
    const groups = _buildMonthGroups();
    if (!groups.length) return '<div class="info-banner">لا توجد سجلات حضور بعد.</div>';
    const todayParts = todayISO().split('-');
    const curYear  = +todayParts[0], curMonth = +todayParts[1];
    const curHijri = isGreg ? null : toHijri(todayISO());

    return groups.map(mon => {
      // FIX: isCurrent check respects calendar type
      const isCurrent = isGreg
        ? (mon.year === curYear && mon.month === curMonth)
        : (mon.year === curHijri.year && mon.month === curHijri.month);

      const bid = 'tpMonth_'+t.id+'_'+mon.year+'_'+mon.month;
      const rows = mon.logs.map(l => {
        const d = new Date(l.date+'T00:00:00');
        const isFri = d.getDay()===5;
        const m = l.durationMins||0;
        const dur = m>0 ? fmtDur(m) : (l.checkIn&&!l.checkOut?'جارٍ':'—');
        return `<div class="tp-log-row${isFri?' tp-log-row-fri':''}">
          <div class="tp-log-day">
            <div class="tp-log-day-name">${DAY_AR[d.getDay()]}${isFri?' 🟡':''}</div>
            <div class="tp-log-date">${formatDateDisplay(l.date)}</div>
          </div>
          <div class="tp-log-times">
            <span class="tp-log-in">▶ ${l.checkIn||'—'}</span>
            ${l.checkOut?`<span class="tp-log-arrow">←</span><span class="tp-log-out">⏹ ${l.checkOut}</span>`:'<span class="tp-log-arrow" style="opacity:.3">…</span>'}
          </div>
          <div class="tp-log-dur ${m>0?'tp-dur-ok':''}">${dur}</div>
          <span class="checkin-status ${l.checkOut?'out':'in'}">${l.checkOut?'اكتمل':'حاضر'}</span>
        </div>`;
      }).join('');
      const th=Math.floor(mon.totalMins/60), tm=mon.totalMins%60;
      const tot=mon.totalMins>0?(th>0?th+'س ':'')+( tm>0?tm+'د':(th>0?'':'—')):'—';

      // FIX: month header label respects calendar type
      const monthLabel = isGreg
        ? `${GM_AR[mon.month]} ${mon.year}`
        : `${mon.monthName || ''} ${mon.year}هـ`;

      return `<div class="tp-month-block ${isCurrent?'tp-month-current':''}">
        <div class="tp-month-header" onclick="tpToggleMonth('${bid}')">
          <div class="tp-month-header-right">
            <span class="tp-month-name">${monthLabel}</span>
            ${isCurrent?'<span class="tp-month-badge-current">الشهر الحالي</span>':''}
          </div>
          <div class="tp-month-header-meta">
            <span class="tp-month-days">${mon.days} يوم</span>
            <span class="tp-month-hours">${tot}</span>
            <span class="tp-month-chevron" id="${bid}_chev">${isCurrent?'▲':'▼'}</span>
          </div>
        </div>
        <div class="tp-month-rows" id="${bid}" style="display:${isCurrent?'block':'none'}">
          <div class="tp-log-list">${rows}</div>
        </div>
      </div>`;
    }).join('');
  }

  document.getElementById('teacherProfileBody').innerHTML = `
    <div class="tp-hero">
      <div class="tp-avatar ${t.photo?'':'tp-avatar-initials'}">
        ${t.photo?`<img src="${t.photo}" alt="${t.name}" onerror="this.parentElement.innerHTML='${initials}';this.parentElement.classList.add('tp-avatar-initials')" />`:`<span>${initials}</span>`}
      </div>
      <div class="tp-hero-info">
        <div class="tp-name">${t.name}</div>
        <div class="tp-role">${t.subject||'معلم'}</div>
        <div class="tp-meta-row">
          ${t.teacherId?`<span class="tp-chip tp-chip-id"># ${t.teacherId}</span>`:''}
          ${t.phone?`<a href="tel:${t.phone}" class="tp-chip tp-chip-phone"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> ${t.phone}</a>`:''}
        </div>
        <span class="checkin-status ${todayClass}" style="margin-top:6px;display:inline-block">${todayStatus}</span>
      </div>
      <button class="btn-secondary tp-edit-btn" onclick="closeModal('teacherProfileModal');openTeacherModal('${t.id}')"><span class="ui-ic ic-blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span> تعديل</button>
    </div>
    <div class="tp-stats">
      <div class="tp-stat tp-stat-blue"><div class="tp-stat-num">${days}</div><div class="tp-stat-lbl">أيام الحضور</div></div>
      <div class="tp-stat tp-stat-purple"><div class="tp-stat-num">${fmtHM(monthlyMins)}</div><div class="tp-stat-lbl">ساعات هذا الشهر</div></div>
      <div class="tp-stat ${todayLive?'tp-stat-live':'tp-stat-amber'}"><div class="tp-stat-num">${todayLive?'<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#ef4444;margin-left:4px;vertical-align:middle"></span> ':''}${fmtHM(todayMins)}</div><div class="tp-stat-lbl">${todayLive?'مباشر الآن':'ساعات اليوم'}</div></div>
      <div class="tp-stat tp-stat-green"><div class="tp-stat-num">${fmtHM(totalMins)}</div><div class="tp-stat-lbl">إجمالي كل الوقت</div></div>
    </div>
    <div class="tp-section-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> السجل الشهري</div>
    <div class="tp-months-container">${buildMonthBlocks()}</div>
    <!-- زر طباعة الملف -->
    <div style="display:flex;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
      <button class="btn-secondary" onclick="printTeacherProfile('${t.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> طباعة الملف</button>
    </div>
  `;
  document.getElementById('teacherProfileModal').classList.remove('hidden');
}

function tpToggleMonth(bid) {
  const el = document.getElementById(bid), ch = document.getElementById(bid+'_chev');
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (ch) ch.textContent = open ? '▼' : '▲';
}

// ════════════════════════════════════════════════════════


/* ── modules/holidays.js ── */
//  الإجازات
// ══════════════════════════════════════════════════════════
function renderHolidayList() {
  const list   = document.getElementById('holidayList');
  list.innerHTML = '';
  const sorted = [...state.holidays].sort((a,b) => b.date.localeCompare(a.date));
  if (sorted.length === 0) {
    list.innerHTML = '<div class="info-banner">لا توجد إجازات يدوية. أيام الجمعة تُضاف تلقائيًا.</div>'; return;
  }
  sorted.forEach(h => {
    const card = document.createElement('div');
    card.className = 'list-card';
    card.innerHTML = `
      <div class="list-card-avatar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
      <div class="list-card-body">
        <div class="list-card-name">${formatDateDisplayFull(h.date)}</div>
        <div class="list-card-sub"><span class="badge badge-holiday">${h.type}</span> ${h.reason||''}</div>
      </div>
      <div class="list-card-actions">
        <button class="btn-danger" onclick="deleteHoliday('${h.date}')">حذف</button>
      </div>`;
    list.appendChild(card);
  });
}

function openHolidayModal() {
  setDateToday('fHolidayDate', 'holidayDateHijri');
  document.getElementById('fHolidayType').value   = 'Weather';
  document.getElementById('fHolidayReason').value = '';
  // Reset multi-day state
  _holidayDates = [];
  holidaySetMode('single');
  const btn = document.getElementById('holidaySaveBtn');
  if (btn) btn.textContent = 'حفظ';
  document.getElementById('holidayModal').classList.remove('hidden');
}
async function saveHoliday() {
  const type   = document.getElementById('fHolidayType').value;
  const reason = document.getElementById('fHolidayReason').value.trim();

  // ── Multi-day mode ──────────────────────────────────────
  const isMulti = document.getElementById('holidayModeMulti')?.classList.contains('active');
  if (isMulti) {
    if (!_holidayDates.length) return toast('يرجى اختيار يوم واحد على الأقل');
    let saved = 0;
    for (const date of _holidayDates) {
      await apiFetch('/holidays', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, type, reason }),
      });
      saved++;
    }
    closeModal('holidayModal');
    await loadAll();
    renderHolidayList();
    toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تمت إضافة ${saved} إجازة`);
    return;
  }

  // ── Single-day mode ─────────────────────────────────────
  const date = document.getElementById('fHolidayDate').value;
  if (!date) return toast('يرجى اختيار تاريخ');
  await apiFetch('/holidays', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, type, reason }),
  });
  closeModal('holidayModal');
  await loadAll();
  renderHolidayList();
  toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تمت إضافة الإجازة');
}

// ── Holiday modal helpers ────────────────────────────────
function holidaySetMode(mode) {
  const isSingle = mode === 'single';
  document.getElementById('holidayModeSingle')?.classList.toggle('active', isSingle);
  document.getElementById('holidayModeMulti')?.classList.toggle('active', !isSingle);
  document.getElementById('holidaySingleSection')?.classList.toggle('hidden', !isSingle);
  document.getElementById('holidayMultiSection')?.classList.toggle('hidden', isSingle);
  const btn = document.getElementById('holidaySaveBtn');
  if (btn) btn.textContent = (!isSingle && _holidayDates.length > 1)
    ? `حفظ (${_holidayDates.length} أيام)` : 'حفظ';
}

function openHolidayDayPicker() {
  _dpMode = 'holiday';
  if (_holidayDates.length) {
    const h = toHijri(_holidayDates[0]);
    _dpHYear = h.year; _dpHMonth = h.month;
  } else {
    const h = toHijri(todayISO());
    _dpHYear = h.year; _dpHMonth = h.month;
  }
  _dpTempSelected = [..._holidayDates];
  _renderDpGrid();
  document.getElementById('dayPickerModal')?.classList.remove('hidden');
}

function _renderHolidayChips() {
  const el = document.getElementById('holidayDatesChips');
  if (!el) return;
  if (!_holidayDates.length) {
    el.innerHTML = '<span style="color:var(--text2);font-size:13px">لم يتم اختيار أيام بعد</span>';
    return;
  }
  el.innerHTML = _holidayDates.map(iso =>
    `<span class="cal-specific-chip">${formatDateDisplay(iso)}
      <button onclick="_holidayDates=_holidayDates.filter(d=>d!=='${iso}');_renderHolidayChips();
        const b=document.getElementById('holidaySaveBtn');if(b)b.textContent=_holidayDates.length>1?'حفظ ('+_holidayDates.length+' أيام)':'حفظ';"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </span>`
  ).join('');
}

async function deleteHoliday(date) {
  if (!confirm(`هل تريد حذف إجازة يوم ${formatDateDisplay(date)}؟`)) return;
  await apiFetch(`/holidays/${date}`, { method:'DELETE' });
  await loadAll(); renderHolidayList(); toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> تم حذف الإجازة');
}

// ══════════════════════════════════════════════════════════


/* ── modules/reports.js ── */
//  التقارير
// ══════════════════════════════════════════════════════════
function initReports() {
  setDateToday('rptDailyDate', 'rptDateHijri');
  setDateToday('rptTeacherDailyDate', 'rptTeacherDateHijri');
  const isGreg = getCalType() === 'gregorian';
  if (isGreg) {
    const now = new Date();
    document.getElementById('rptYear').value  = now.getFullYear();
    document.getElementById('rptMonth').value = now.getMonth() + 1;
    const teacherYearEl = document.getElementById('rptTeacherYear');
    const teacherMonthEl = document.getElementById('rptTeacherMonth');
    if (teacherYearEl)  teacherYearEl.value  = now.getFullYear();
    if (teacherMonthEl) teacherMonthEl.value = now.getMonth() + 1;
  } else {
    const todayH = toHijri(todayISO());
    document.getElementById('rptYear').value  = todayH.year;
    document.getElementById('rptMonth').value = todayH.month;
    const teacherYearEl = document.getElementById('rptTeacherYear');
    const teacherMonthEl = document.getElementById('rptTeacherMonth');
    if (teacherYearEl)  teacherYearEl.value  = todayH.year;
    if (teacherMonthEl) teacherMonthEl.value = todayH.month;
  }
  // Update year/month labels to reflect calendar type
  _updateReportMonthLabels();
  // Populate class dropdowns — sorted alphabetically
  const sortedClasses = [...state.classes].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const classOpts = '<option value="">جميع الحلقات</option>' +
    sortedClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const dc = document.getElementById('rptDailyClass');
  const mc = document.getElementById('rptMonthlyClass');
  if (dc) dc.innerHTML = classOpts;
  if (mc) mc.innerHTML = classOpts;
}

// Helper: update report month/year labels and dropdown options based on calendar type
function _updateReportMonthLabels() {
  const isGreg = getCalType() === 'gregorian';
  // Year label
  const yearLbls = document.querySelectorAll('.rpt-year-lbl');
  yearLbls.forEach(el => el.textContent = isGreg ? 'السنة الميلادية' : 'السنة الهجرية');
  // Month label
  const monthLbls = document.querySelectorAll('.rpt-month-lbl');
  monthLbls.forEach(el => el.textContent = isGreg ? 'الشهر الميلادي' : 'الشهر الهجري');
  // Year input range
  const yearInputs = [document.getElementById('rptYear'), document.getElementById('rptTeacherYear')];
  yearInputs.forEach(el => {
    if (!el) return;
    if (isGreg) { el.min='2000'; el.max='2100'; el.placeholder='مثال: 2025'; }
    else        { el.min='1400'; el.max='1600'; el.placeholder='مثال: 1446'; }
  });
  // Month dropdown options
  const hijriOpts = `<option value="1">محرم</option><option value="2">صفر</option><option value="3">ربيع الأول</option><option value="4">ربيع الثاني</option><option value="5">جمادى الأولى</option><option value="6">جمادى الآخرة</option><option value="7">رجب</option><option value="8">شعبان</option><option value="9">رمضان</option><option value="10">شوال</option><option value="11">ذو القعدة</option><option value="12">ذو الحجة</option>`;
  const gregOpts  = `<option value="1">يناير</option><option value="2">فبراير</option><option value="3">مارس</option><option value="4">أبريل</option><option value="5">مايو</option><option value="6">يونيو</option><option value="7">يوليو</option><option value="8">أغسطس</option><option value="9">سبتمبر</option><option value="10">أكتوبر</option><option value="11">نوفمبر</option><option value="12">ديسمبر</option>`;
  const monthSels = [document.getElementById('rptMonth'), document.getElementById('rptTeacherMonth')];
  monthSels.forEach(sel => {
    if (!sel) return;
    const curVal = sel.value;
    sel.innerHTML = isGreg ? gregOpts : hijriOpts;
    sel.value = curVal;
  });
}

function downloadReport(type) {
  let url;
  const isGreg = getCalType() === 'gregorian';
  const dailyClass   = document.getElementById('rptDailyClass')?.value   || '';
  const monthlyClass = document.getElementById('rptMonthlyClass')?.value || '';

  if (type==='daily-attendance') {
    const date = document.getElementById('rptDailyDate').value;
    if (!date) return toast('اختر تاريخًا');
    url = `${API}/reports/daily-attendance/${date}?calType=${getCalType()}` + (dailyClass ? `&classId=${dailyClass}` : '');
  } else if (type==='pdf-daily') {
    const date = document.getElementById('rptDailyDate').value;
    if (!date) return toast('اختر تاريخًا');
    url = `${API}/reports/pdf/daily/${date}?calType=${getCalType()}` + (dailyClass ? `&classId=${dailyClass}` : '');
  } else if (type==='teacher-log') {
    const date = document.getElementById('rptTeacherDailyDate').value;
    if (!date) return toast('اختر تاريخًا');
    url = `${API}/reports/teacher-log/${date}`;
  } else if (type==='monthly') {
    const hYear  = document.getElementById('rptYear').value;
    const hMonth = document.getElementById('rptMonth').value;
    if (!hYear || !hMonth) return toast(isGreg ? 'اختر الشهر والسنة الميلادية' : 'اختر الشهر والسنة الهجرية');
    url = isGreg
      ? `${API}/reports/monthly/gregorian/${hYear}/${hMonth}` + (monthlyClass ? `?classId=${monthlyClass}` : '')
      : `${API}/reports/monthly/hijri/${hYear}/${hMonth}` + (monthlyClass ? `?classId=${monthlyClass}` : '');
  } else if (type==='pdf-teacher-monthly') {
    const hYear  = document.getElementById('rptTeacherYear').value;
    const hMonth = document.getElementById('rptTeacherMonth').value;
    if (!hYear || !hMonth) return toast(isGreg ? 'اختر الشهر والسنة الميلادية' : 'اختر الشهر والسنة الهجرية');
    url = isGreg
      ? `${API}/reports/pdf/teacher-monthly/gregorian/${hYear}/${hMonth}`
      : `${API}/reports/pdf/teacher-monthly/hijri/${hYear}/${hMonth}`;
  } else if (type==='teacher-monthly-excel') {
    const hYear  = document.getElementById('rptTeacherYear').value;
    const hMonth = document.getElementById('rptTeacherMonth').value;
    if (!hYear || !hMonth) return toast(isGreg ? 'اختر الشهر والسنة الميلادية' : 'اختر الشهر والسنة الهجرية');
    url = isGreg
      ? `${API}/reports/teacher-monthly/gregorian/${hYear}/${hMonth}`
      : `${API}/reports/teacher-monthly/hijri/${hYear}/${hMonth}`;
  } else if (type==='print-daily-attendance') {
    const date = document.getElementById('rptDailyDate').value;
    if (!date) return toast('اختر تاريخًا');
    url = `${API}/print/daily-attendance/${date}?calType=${getCalType()}` + (dailyClass ? `&classId=${dailyClass}` : '');
  } else if (type==='print-teacher-log') {
    const date = document.getElementById('rptTeacherDailyDate').value;
    if (!date) return toast('اختر تاريخًا');
    url = `${API}/print/teacher-log/${date}`;
  } else if (type==='print-monthly') {
    const hYear  = document.getElementById('rptYear').value;
    const hMonth = document.getElementById('rptMonth').value;
    if (!hYear || !hMonth) return toast(isGreg ? 'اختر الشهر والسنة الميلادية' : 'اختر الشهر والسنة الهجرية');
    url = isGreg
      ? `${API}/print/monthly-attendance/gregorian/${hYear}/${hMonth}` + (monthlyClass ? `?classId=${monthlyClass}` : '')
      : `${API}/print/monthly-attendance/${hYear}/${hMonth}` + (monthlyClass ? `?classId=${monthlyClass}` : '');
  } else if (type==='print-teacher-monthly') {
    const hYear  = document.getElementById('rptTeacherYear').value;
    const hMonth = document.getElementById('rptTeacherMonth').value;
    if (!hYear || !hMonth) return toast(isGreg ? 'اختر الشهر والسنة الميلادية' : 'اختر الشهر والسنة الهجرية');
    url = isGreg
      ? `${API}/print/teacher-monthly/gregorian/${hYear}/${hMonth}`
      : `${API}/print/teacher-monthly/${hYear}/${hMonth}`;
  } else if (type==='print-students-list') {
    const listClass = document.getElementById('rptDailyClass')?.value;
    url = `${API}/print/students-list` + (listClass ? `?classId=${listClass}` : '');
  } else if (type==='print-teachers-list') {
    url = `${API}/print/teachers-list`;
  }
  if (url) {
    if (type.startsWith('print-')) {
      // Fetch the HTML from the server, write into a blank window, trigger print
      // This avoids the "just shows HTML page" problem on all browsers/mobile
      toast('<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ تحميل الصفحة…');
      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(r.status);
          return r.text();
        })
        .then(html => {
          // Inject auto-print script before </body>
          const printHtml = html.replace(
            /<\/body>/i,
            `<script>window.onload=function(){window.focus();window.print();}<\/script></body>`
          );
          const win = window.open('', '_blank', 'width=900,height=700');
          if (!win) { toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> السماح بالنوافذ المنبثقة مطلوب'); return; }
          win.document.open();
          win.document.write(printHtml);
          win.document.close();
        })
        .catch(err => {
          console.error('Print fetch error:', err);
          toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> تعذّر تحميل صفحة الطباعة');
        });
    } else {
      window.open(url, '_blank');
      toast('⬇ جارٍ التنزيل…');
    }
  }
}

// نسخ رابط الشبكة إلى الحافظة
async function copyNetworkLink() {
  const url = _qrNetworkUrl || window.location.origin;
  try {
    await navigator.clipboard.writeText(url);
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم نسخ الرابط: ' + url);
  } catch(e) {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم نسخ الرابط');
  }
}

// ══════════════════════════════════════════════════════════


/* ── modules/settings.js ── */
//  الإعدادات والهوية البصرية
// ══════════════════════════════════════════════════════════
async function initSettings() {
  const s = await apiFetch('/settings');
  if (!s) return;

  // For teachers: hide admin-only sections, show only password + bio
  const isTeacherView = currentRole === 'teacher';
  document.querySelectorAll('#page-settings .card.form-card, #page-settings .info-banner').forEach(el => {
    // Show everything for admin/mod; hide all except password+bio for teacher
    if (isTeacherView) el.classList.add('hidden');
  });
  // Always show password card and bio card
  const pwCard  = document.getElementById('settPwCard');
  const bioCard = document.getElementById('settBioCard');
  if (pwCard)  pwCard.classList.remove('hidden');
  if (bioCard) bioCard.classList.remove('hidden');
  // Update page title for teacher
  const head = document.querySelector('#page-settings .page-head h2');
  if (head) head.textContent = isTeacherView ? 'إعدادات الحساب' : 'الإعدادات والهوية البصرية';

  if (!isTeacherView) {
    // Calendar type toggle
    const calTypeHijri = document.getElementById('settCalTypeHijri');
    const calTypeGreg  = document.getElementById('settCalTypeGregorian');
    const savedCalType = s.calendarType || 'hijri';
    if (calTypeHijri) calTypeHijri.checked = savedCalType === 'hijri';
    if (calTypeGreg)  calTypeGreg.checked  = savedCalType === 'gregorian';

    // Brand
    const schoolName = document.getElementById('settSchoolName');
    const subtitle   = document.getElementById('settSubtitle');
    if (schoolName) schoolName.value = s.schoolName || '';
    if (subtitle)   subtitle.value   = s.subtitle   || '';

    // WhatsApp
    const waKey      = document.getElementById('settWaApiKey');
    const waPhone    = document.getElementById('settAdminPhone');
    const waTemplate = document.getElementById('settWaTemplate');
    if (waKey)      waKey.value      = s.whatsappApiKey   || '';
    if (waPhone)    waPhone.value    = s.adminPhone        || '';
    if (waTemplate) waTemplate.value = s.whatsappTemplate || '';

    // Logos & brand preview
    renderLogoList(s.logos || []);
    updateBrandPreview(s);
    initDashWidgets();
  }

  // Biometrics card
  bioSettingRender();
}

function bioSettingRender() {
  const containers = [
    { status: document.getElementById('bioSettingStatus'), actions: document.getElementById('bioSettingActions') },
  ];

  const enrolled  = !!localStorage.getItem(BIO_CRED_KEY);
  const supported = bioIsAvailable();

  containers.forEach(({ status: statusEl, actions: actionsEl }) => {
    if (!statusEl || !actionsEl) return;

    if (!supported) {
      statusEl.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="8" x2="16" y2="16"/></svg>
        جهازك لا يدعم الدخول البيومتري`;
      actionsEl.innerHTML = '';
      return;
    }

    if (enrolled) {
      statusEl.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <span style="color:var(--success);font-weight:600">مفعّل على هذا الجهاز</span>`;
      actionsEl.innerHTML = `
        <button class="btn-danger" onclick="bioResetDevice()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:4px"><path d="M12 10a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0v-4a2 2 0 0 0-2-2z"/><path d="M12 6a6 6 0 0 1 6 6v2a6 6 0 0 1-12 0v-2a6 6 0 0 1 6-6z"/><path d="M12 2a10 10 0 0 1 10 10v2a10 10 0 0 1-20 0v-2A10 10 0 0 1 12 2z"/></svg>
          إلغاء البصمة على هذا الجهاز
        </button>`;
    } else {
      statusEl.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        غير مفعّل على هذا الجهاز`;
      actionsEl.innerHTML = `
        <button class="btn-secondary" onclick="bioReEnroll()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:4px"><path d="M12 10a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0v-4a2 2 0 0 0-2-2z"/><path d="M12 6a6 6 0 0 1 6 6v2a6 6 0 0 1-12 0v-2a6 6 0 0 1 6-6z"/><path d="M12 2a10 10 0 0 1 10 10v2a10 10 0 0 1-20 0v-2A10 10 0 0 1 12 2z"/></svg>
          تفعيل البصمة على هذا الجهاز
        </button>`;
    }
  });
}

function bioResetDevice() {
  if (!confirm('هل تريد إلغاء تسجيل البصمة على هذا الجهاز فقط؟\nلن يؤثر ذلك على الأجهزة الأخرى أو الرمز السري.')) return;
  localStorage.removeItem(BIO_CRED_KEY);
  localStorage.removeItem(BIO_PIN_KEY);
  document.getElementById('bioBtnLogin')?.classList.add('hidden');
  toast('تم إلغاء البصمة على هذا الجهاز');
  bioSettingRender();
}

async function bioReEnroll() {
  const saved = _getSavedUser ? _getSavedUser() : null;
  const username = saved?.username || currentUserId || '';
  const password = prompt('أدخل كلمة مرورك لتفعيل البصمة:');
  if (!password) return;
  const verify = await apiFetch('/auth/verify', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ username, password }),
  });
  if (!verify?.valid) { toast('كلمة المرور غير صحيحة'); return; }
  await bioEnroll(password);
  bioSettingRender();
}

async function saveSettings() {
  const schoolName = document.getElementById('settSchoolName').value.trim();
  const subtitle   = document.getElementById('settSubtitle').value.trim();
  await apiFetch('/settings', {
    method:'PUT', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ schoolName, subtitle }),
  });
  const statusEl = document.getElementById('settStatus');
  statusEl.style.color = 'var(--success)';
  statusEl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم حفظ البيانات!';
  setTimeout(() => statusEl.textContent = '', 3000);
  updateBrandPreview({ schoolName, subtitle });
  loadAndDisplayLogos();
}

async function saveCalendarType(type) {
  if (!state.settings) state.settings = {};
  state.settings.calendarType = type;
  localStorage.setItem('calendarType', type);
  await apiFetch('/settings', {
    method: 'PUT', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ calendarType: type }),
  });
  // Refresh all date displays
  updateTodayBadge(state.settings.dateFormat);
  const dateEl = document.getElementById('liveDate');
  if (dateEl) dateEl.textContent = formatDateDisplayFull(todayISO());
  // Update all visible hijri labels
  document.querySelectorAll('input[type="hidden"].cdp-value, [id$="Date"]'). forEach(inp => {
    if (!inp.value) return;
    const wrap = inp.closest('[data-onchange]');
    if (wrap) {
      const labelMatch = wrap.getAttribute('data-onchange')?.match(/'([^']+)'/);
      if (labelMatch) updateHijriLabel(inp, labelMatch[1]);
    }
  });
  // Reload attendance label if any
  document.querySelectorAll('.hijri-label').forEach(el => {
    const nearInput = el.previousElementSibling?.querySelector('input[type="hidden"]') ||
                      document.getElementById(el.id.replace('Hijri','Date').replace('DateHijri','Date'));
    if (nearInput?.value) el.textContent = formatDateDisplayFull(nearInput.value);
  });
  // Reset calendar so it starts on correct year/month for new type
  _calYear = null; _calMonth = null;
  // Update report month labels
  _updateReportMonthLabels && _updateReportMonthLabels();
  const statusEl = document.getElementById('calTypeStatus');
  if (statusEl) {
    statusEl.style.color = 'var(--success)';
    statusEl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم حفظ نوع التقويم';
    setTimeout(() => statusEl.textContent = '', 2500);
  }
  toast('📅 تم تغيير نوع التقويم إلى ' + (type==='gregorian'?'الميلادي':'الهجري'));
}

async function changePin() {
  const oldPin  = document.getElementById('settOldPin').value;
  const newPin  = document.getElementById('settNewPin').value;
  const confPin = document.getElementById('settConfPin').value;
  const statusEl= document.getElementById('pinStatus');
  if (newPin.length < 1) {
    statusEl.style.color = 'var(--error)'; statusEl.textContent = 'أدخل كلمة المرور الجديدة.'; return;
  }
  if (newPin !== confPin) {
    statusEl.style.color = 'var(--error)'; statusEl.textContent = 'كلمة المرور الجديدة وتأكيدها غير متطابقين.'; return;
  }
  // Verify old password using current user's credentials
  const saved = _getSavedUser ? _getSavedUser() : null;
  const username = saved?.username || currentUserId || 'admin';
  const verify = await apiFetch('/auth/verify', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ username, password: oldPin }),
  });
  if (!verify?.valid) {
    statusEl.style.color = 'var(--error)'; statusEl.textContent = 'كلمة المرور الحالية غير صحيحة.'; return;
  }
  // Update the account password
  await apiFetch(`/accounts/${verify.userId || currentUserId}`, {
    method:'PUT', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ password: newPin }),
  });
  // Also update settings.pin for admin (legacy PIN support)
  if (currentRole === 'admin') {
    await apiFetch('/settings', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ pin: newPin }) });
  }
  // FIX: update stored fingerprint PIN so biometric login still works after password change
  if (localStorage.getItem('halaqat_bio_pin')) {
    localStorage.setItem('halaqat_bio_pin', newPin);
  }
  // Also keep the saved user credential in sync
  try {
    const saved = JSON.parse(localStorage.getItem('halaqat_saved_user') || 'null');
    if (saved) { saved.password = newPin; localStorage.setItem('halaqat_saved_user', JSON.stringify(saved)); }
  } catch(e) {}

  statusEl.style.color = 'var(--success)'; statusEl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم تغيير كلمة المرور!';
  ['settOldPin','settNewPin','settConfPin'].forEach(id => document.getElementById(id).value = '');
  setTimeout(() => statusEl.textContent = '', 3000);
}

// ─── الشعارات ────────────────────────────────────────────

function setupLogoDragDrop() {
  const area = document.getElementById('logoUploadArea');
  if (!area || area._ddSetup) return;
  area._ddSetup = true;
  area.addEventListener('dragover',  e => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', e => {
    e.preventDefault(); area.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) { document.getElementById('logoFile').files; showLogoPreview(file); }
  });
  area.addEventListener('click', () => document.getElementById('logoFile').click());
}

function handleLogoUpload() {
  const file = document.getElementById('logoFile').files[0];
  if (file) showLogoPreview(file);
}

function showLogoPreview(file) {
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('logoPreviewImg').src = e.target.result;
    document.getElementById('logoName').value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    document.getElementById('logoPreviewArea').classList.remove('hidden');
    document.getElementById('logoUploadArea').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

function cancelLogoPreview() {
  document.getElementById('logoPreviewArea').classList.add('hidden');
  document.getElementById('logoUploadArea').classList.remove('hidden');
  document.getElementById('logoFile').value = '';
}

async function uploadLogo() {
  const file = document.getElementById('logoFile').files[0];
  const name = document.getElementById('logoName').value.trim() || 'شعار';
  if (!file) return toast('اختر ملف شعار أولاً');

  const s = await apiFetch('/settings');
  if ((s?.logos||[]).length >= 4) return toast('الحد الأقصى 4 شعارات');

  const fd = new FormData();
  fd.append('logo', file);
  fd.append('name', name);

  try {
    const res = await fetch(`${API}/settings/logos`, { method:'POST', body: fd });
    if (!res.ok) throw new Error();
    cancelLogoPreview();
    const settings = await apiFetch('/settings');
    renderLogoList(settings.logos || []);
    updateBrandPreview(settings);
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم رفع الشعار بنجاح!');
  } catch(e) {
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> فشل رفع الشعار');
  }
}

async function deleteLogo(id) {
  if (!confirm('هل تريد حذف هذا الشعار؟')) return;
  await apiFetch(`/settings/logos/${id}`, { method:'DELETE' });
  const settings = await apiFetch('/settings');
  renderLogoList(settings.logos || []);
  updateBrandPreview(settings);
  toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> تم حذف الشعار');
}

function renderLogoList(logos) {
  const list = document.getElementById('logoList');
  list.innerHTML = '';
  if (logos.length === 0) {
    list.innerHTML = '<p style="color:var(--text2);font-size:13px;padding:8px 0">لا توجد شعارات بعد. أضف شعاراً لتظهر في جميع التقارير.</p>';
    return;
  }
  logos.forEach((logo, i) => {
    const item = document.createElement('div');
    item.className = 'logo-item';
    item.innerHTML = `
      <button class="logo-item-del" onclick="deleteLogo('${logo.id}')" title="حذف"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      <img src="${logo.url}" alt="${logo.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'><text y=\\'.9em\\'font-size=\\'90\\'>>🖼</text></svg>'" />
      <span class="logo-item-name" title="${logo.name}">${logo.name}</span>
      <span class="logo-item-badge">شعار ${i+1}</span>
    `;
    list.appendChild(item);
  });
}

function updateBrandPreview(settings) {
  document.getElementById('previewName').textContent = settings.schoolName || 'اسم المنشأة';
  document.getElementById('previewSub').textContent  = settings.subtitle   || '';
  const logosEl = document.getElementById('previewLogos');
  const logos   = settings.logos || [];
  if (logos.length === 0) {
    logosEl.innerHTML = '<span class="no-logo">لا توجد شعارات — أضف شعاراً ليظهر هنا</span>';
  } else {
    logosEl.innerHTML = logos.map(l =>
      `<img src="${l.url}" alt="${l.name}" title="${l.name}" onerror="this.style.display='none'" />`
    ).join('');
  }
}

// ══════════════════════════════════════════════════════════

// ── Dashboard widget customization ───────────────────────
function initDashWidgets() {
  const w = getDashWidgets();
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  set('dwtAttRing', w.attRing);
  set('dwtQueue',   w.queue);
  set('dwtEvents',  w.events);
  set('dwtSched',   w.sched);
}

function saveDashWidgets() {
  const get = id => { const el = document.getElementById(id); return el ? el.checked : true; };
  const w = {
    attRing: get('dwtAttRing'),
    queue:   get('dwtQueue'),
    events:  get('dwtEvents'),
    sched:   get('dwtSched'),
  };
  localStorage.setItem(DW_KEY, JSON.stringify(w));
  applyDashWidgets();
  const st = document.getElementById('dwtStatus');
  if (st) { st.style.color = 'var(--success)'; st.textContent = '✓ تم الحفظ'; setTimeout(() => st.textContent = '', 2000); }
}


/* ── modules/ui.js ── */
//  النوافذ المنبثقة والإشعارات
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  الإذن المسبق / الإجازة المرضية
// ══════════════════════════════════════════════════════════
function openLeaveModal() {
  const classId = document.getElementById('attClass').value;
  const date    = document.getElementById('attDate').value;
  if (!classId) return toast('يرجى اختيار الحلقة أولاً');
  const sel = document.getElementById('fLeaveStudent');
  sel.innerHTML = '<option value="">— اختر الطالب —</option>';
  state.students.filter(s => s.classId === classId).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.name; sel.appendChild(opt);
  });
  document.getElementById('fLeaveDate').value = date || todayISO();
  updateHijriLabel(document.getElementById('fLeaveDate'), 'leaveDateHijri');
  document.getElementById('fLeaveType').value   = 'Sick';
  document.getElementById('fLeaveReason').value = '';
  document.getElementById('leaveModal').classList.remove('hidden');
}

async function saveLeave() {
  const studentId = document.getElementById('fLeaveStudent').value;
  const date      = document.getElementById('fLeaveDate').value;
  const type      = document.getElementById('fLeaveType').value;
  const reason    = document.getElementById('fLeaveReason').value.trim();
  const classId   = document.getElementById('attClass').value;
  if (!studentId) return toast('يرجى اختيار الطالب');
  if (!date)      return toast('يرجى اختيار التاريخ');
  const leaveRes = await apiFetch('/leaves', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ studentId, classId, date, type, reason }),
  });
  // Auto-correct: if student was already marked Absent on that date, change to Excused
  if (leaveRes?.ok !== false && classId && date) {
    const existing = await apiFetch(`/attendance?date=${date}&classId=${classId}`);
    if (existing) {
      const absentRec = existing.find(a => a.studentId === studentId && a.status === 'Absent');
      if (absentRec) {
        const typeLabelsNote = { Sick: ic('thermometer','ic-red')+' مرض', Permission: ic('clipboard','ic-blue')+' إذن خروج', Travel: ic('plane','ic-sky')+' سفر', Family: ic('alert-circle','ic-amber')+' ظرف عائلي', Other: ic('file-text','ic-gray')+' أخرى' };
        await apiFetch('/attendance/batch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, classId, records: [{ studentId, status: 'Excused', notes: typeLabelsNote[type]||type }] }),
        });
      }
    }
  }
  closeModal('leaveModal');
  await loadAttendanceStudents();
  const typeLabels = { Sick:'مرض', Permission:'إذن خروج', Travel:'سفر', Family:'ظرف عائلي', Other:'أخرى' };
  toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم تسجيل الإذن: ${typeLabels[type]||type} — وتحديث الحضور إلى بعذر`);
}

async function cancelLeave(leaveId, studentId, date, classId) {
  if (!confirm('هل تريد إلغاء هذا الإذن؟')) return;
  await apiFetch(`/leaves/${leaveId}`, { method:'DELETE' });
  await loadAttendanceStudents();
  toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> تم إلغاء الإذن');
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('.modal-overlay').forEach(overlay =>
  overlay.addEventListener('click', e => { if (e.target===overlay) overlay.classList.add('hidden'); })
);

let toastTimer;
function toast(msg, duration=3200) {
  const el = document.getElementById('toast');
  el.innerHTML = msg;
  el.classList.remove('hidden', 'toast-success', 'toast-error', 'toast-warn');
  const plain = el.textContent || '';
  if (msg.includes('data-toast="ok"') || plain.includes('تم') || plain.includes('نجاح'))
    el.classList.add('toast-success');
  else if (msg.includes('data-toast="err"') || plain.includes('فشل') || plain.includes('تعذر') || plain.includes('خطأ'))
    el.classList.add('toast-error');
  else if (msg.includes('data-toast="warn"') || plain.includes('يرجى') || plain.includes('اختر'))
    el.classList.add('toast-warn');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
}

// ══════════════════════════════════════════════════════════


/* ── modules/quran.js ── */
//  تقدم القرآن الكريم
// ══════════════════════════════════════════════════════════
let _quranSummary = [];
let _quranViewStudentId = null;

function formatQPPosition(p) {
  if (!p) return '—';
  const parts = [];
  if (p.juz) parts.push(`الجزء ${p.juz}`);
  if (p.surahFromName) {
    const pos = p.surahFromName + (p.ayahFrom ? ` آية ${p.ayahFrom}` : '');
    const posTo = (p.surahToName && p.surahToName !== p.surahFromName)
      ? ` ← ${p.surahToName}${p.ayahTo?' آية '+p.ayahTo:''}` : (p.ayahTo && p.ayahTo !== p.ayahFrom ? `–${p.ayahTo}` : '');
    parts.push(pos + posTo);
  }
  if (p.pageFrom) parts.push(`ص ${p.pageFrom}${p.pageTo && p.pageTo!==p.pageFrom?'–'+p.pageTo:''}`);
  return parts.join(' · ') || '—';
}

async function initQuranPage() {
  const filter = document.getElementById('quranClassFilter');
  if (filter) {
    const cur = filter.value;
    const isTeacher = currentRole === 'teacher';
    filter.innerHTML = isTeacher ? '' : '<option value="">كل الحلقات</option>';
    visibleClasses().forEach(c => {
      const o = document.createElement('option'); o.value=c.id; o.textContent=c.name;
      if (c.id===cur) o.selected=true;
      filter.appendChild(o);
    });
    // Teachers auto-select first class
    if (isTeacher && !filter.value && filter.options.length > 0) {
      filter.value = filter.options[0].value;
    }
  }
  // show/hide class report button
  updateQuranClassReportBtn();
  await loadQuranSummary();
}

function updateQuranClassReportBtn() {
  const classId = document.getElementById('quranClassFilter')?.value || '';
  const btn = document.getElementById('quranClassReportBtn');
  if (!btn) return;
  if (classId) {
    btn.style.display = 'inline-flex';
    btn.onclick = () => { toast('<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ إنشاء تقرير الحلقة…'); window.open(`${API}/reports/quran/class/${classId}`, '_blank'); };
  } else {
    btn.style.display = 'none';
  }
}

async function loadQuranSummary() {
  const classId = document.getElementById('quranClassFilter')?.value || '';
  updateQuranClassReportBtn();
  const url = '/quran-progress/summary' + (classId ? `?classId=${classId}` : '');
  let summary = await apiFetch(url) || [];
  // Teachers: filter to only their assigned students regardless of filter value
  if (currentRole === 'teacher') {
    const visIds = new Set(visibleStudents().map(s => s.id));
    summary = summary.filter(r => visIds.has(r.studentId));
  }
  _quranSummary = summary;
  const allProgress = await apiFetch('/quran-progress') || [];
  _quranSummary.forEach(r => {
    r.allEntries = allProgress.filter(p => p.studentId === r.studentId).sort((a,b) => b.date.localeCompare(a.date));
  });
  renderQuranPage();
}

function renderQuranPage() {
  const search  = (document.getElementById('quranSearch')?.value||'').toLowerCase();
  const classId = document.getElementById('quranClassFilter')?.value || '';
  const grid    = document.getElementById('quranSummaryGrid');
  if (!grid) return;

  let list = _quranSummary;
  if (search)  list = list.filter(r => r.name.toLowerCase().includes(search));
  if (classId) list = list.filter(r => r.classId === classId);

  if (list.length === 0) {
    grid.innerHTML = '<div class="info-banner">لا يوجد طلاب لعرض تقدمهم.</div>'; return;
  }

  grid.innerHTML = '';
  list.forEach(r => {
    const cls   = state.classes.find(c => c.id === r.classId);
    const pos   = formatQPPosition(r.latest);
    const grade = r.latest?.grade || '';
    const gradeHtml = grade
      ? `<span class="qp-grade-badge" style="background:${qpGradeBg(grade)};color:${qpGradeColor(grade)}">${grade}/10</span>`
      : '';
    const typeHtml = r.latest
      ? `<span style="font-size:11px;color:var(--text2)">${QURAN_TYPE_AR[r.latest.type]||''}</span>` : '';
    const dateHtml = r.latest
      ? `<span style="font-size:11px;color:var(--text2)">${formatDateDisplay(r.latest.date)}</span>` : '';
    const hasData = r.totalEntries > 0;

    // Compute pace for card badge
    let paceBadge = '';
    if (hasData && r.allEntries) {
      const pace = qpComputePace(r.allEntries);
      if (pace && pace.weeksToFinishJuz) {
        const rateColor = pace.avgPerSession >= 2 ? '#166534' : pace.avgPerSession >= 1 ? '#92400e' : '#991b1b';
        paceBadge = `<div class="quran-card-pace" style="color:${rateColor}">🏁 جزء في ~${pace.weeksToFinishJuz} أسبوع · ${pace.avgPerSession} ص/جلسة</div>`;
      }
    }

    const card = document.createElement('div');
    card.className = 'quran-student-card' + (hasData ? '' : ' quran-card-empty');
    card.innerHTML = `
      <div class="quran-card-top">
        <div class="quran-card-avatar">${r.name.charAt(0)}</div>
        <div class="quran-card-info">
          <div class="quran-card-name">${r.name}</div>
          <div class="quran-card-class">${cls?.name||'—'} · ${r.totalEntries} جلسة</div>
        </div>
        ${gradeHtml}
      </div>
      <div class="quran-card-pos">${hasData ? `📍 ${pos}` : '📍 لم يُسجَّل بعد'}</div>
      <div class="quran-card-meta">${typeHtml}${typeHtml&&dateHtml?' · ':''}${dateHtml}</div>
      ${paceBadge}
      <div class="quran-card-actions">
        <button class="btn-secondary" style="font-size:12px;flex:1" onclick="viewStudentQuranHistory('${r.studentId}','${r.name}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg> السجل</button>
        <button class="btn-secondary" style="font-size:12px;padding:6px 8px" title="طباعة" onclick="window.open('${API}/print/quran/student/${r.studentId}','_blank')">🖨</button>
        <button class="btn-secondary" style="font-size:12px;padding:6px 8px" title="تحميل Excel" onclick="window.open('${API}/reports/quran/student/${r.studentId}','_blank')">📥</button>
        <button class="btn-primary"   style="font-size:12px;flex:1" onclick="openProgressModal('${r.studentId}')">+ تسجيل</button>
      </div>`;
    grid.appendChild(card);
  });
}

async function viewStudentQuranHistory(studentId, name) {
  _quranViewStudentId = studentId;
  document.getElementById('quranStudentModalTitle').innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> سجل تقدم القرآن — ${name}`;
  const body = document.getElementById('quranStudentModalBody');
  body.innerHTML = '<p style="color:var(--text2);font-size:13px"><span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ التحميل…</p>';
  document.getElementById('quranStudentModal').classList.remove('hidden');

  const list = await apiFetch(`/quran-progress?studentId=${studentId}`) || [];
  if (list.length === 0) {
    body.innerHTML = '<p style="color:var(--text2);font-size:13px;padding:12px 0">لا توجد سجلات بعد.</p>'; return;
  }
  body.innerHTML = `
    <div style="overflow-x:auto">
      <table class="history-table">
        <thead><tr><th>التاريخ</th><th>النوع</th><th>الموقع</th><th>التقييم</th><th>ملاحظات</th><th></th></tr></thead>
        <tbody>${list.map(p=>`
          <tr>
            <td style="font-size:12px;white-space:nowrap">${formatDateDisplay(p.date)}</td>
            <td style="font-size:11px">${QURAN_TYPE_AR[p.type]||p.type}</td>
            <td style="font-size:12px">${formatQPPosition(p)}</td>
            <td>${p.grade?`<span class="qp-grade-badge" style="background:${qpGradeBg(p.grade)};color:${qpGradeColor(p.grade)}">${p.grade}/10</span>`:'—'}</td>
            <td style="font-size:12px;color:var(--text2);max-width:140px">${p.notes||'—'}</td>
            <td><button class="btn-icon" onclick="deleteProgress('${p.id}','${studentId}','modal')"><span class="ui-ic ic-red"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span></button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function deleteProgress(id, studentId, context) {
  if (!confirm('هل تريد حذف هذا السجل؟')) return;
  await apiFetch(`/quran-progress/${id}`, { method:'DELETE' });
  toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> تم حذف السجل');
  if (context === 'modal') {
    const s = state.students.find(x=>x.id===studentId);
    await viewStudentQuranHistory(studentId, s?.name||'');
  } else {
    await loadQuranSummary();
    viewStudent(studentId);
  }
}

let _qpDefaultStudentId = null;

function openProgressModal(studentId=null) {
  _qpDefaultStudentId = studentId || null;
  document.getElementById('qpId').value = '';

  // Populate student dropdown — teachers only see their assigned classes
  const sel = document.getElementById('qpStudentId');
  sel.innerHTML = '<option value="">— اختر الطالب —</option>';
  [...visibleStudents()].sort((a,b)=>a.name.localeCompare(b.name,'ar')).forEach(s => {
    const o = document.createElement('option'); o.value=s.id; o.textContent=s.name;
    if (s.id === studentId) o.selected = true;
    sel.appendChild(o);
  });

  // Populate surah dropdowns
  qpPopulateSurahDropdowns();

  // Reset everything
  document.getElementById('qpDate').value   = todayISO();
  updateHijriLabel(document.getElementById('qpDate'), 'qpDateHijri');
  document.getElementById('qpIsRepeat').value = '';
  document.getElementById('qpNotes').value    = '';
  document.getElementById('qpAyahFrom').value = '';
  document.getElementById('qpAyahTo').value   = '';
  document.getElementById('qpSurahFrom').value = '';
  document.getElementById('qpSurahTo').value   = '';
  const lf = document.getElementById('qpSurahFromLabel');
  if (lf) { lf.textContent = '— اختر السورة —'; lf.classList.remove('qp-sd-value--filled'); }
  const lt = document.getElementById('qpSurahToLabel');
  if (lt) { lt.textContent = '— اختر السورة —'; lt.classList.remove('qp-sd-value--filled'); }
  document.getElementById('qpAyahFromHint').textContent = '';
  document.getElementById('qpAyahToHint').textContent   = '';
  qpSdClose('From'); qpSdClose('To');
  qpSetType('memorization');
  qpSetGrade('');
  const lastCard = document.getElementById('qpLastSession'); if(lastCard) lastCard.classList.add('hidden');
  const paceEl   = document.getElementById('qpPaceInfo');    if(paceEl)   paceEl.classList.add('hidden');
  window._qpLastByType = {};
  window._qpLastSessionData = null;

  if (studentId) onQpStudentChange();

  document.getElementById('quranProgressModal').classList.remove('hidden');
}

function qpSetType(type) {
  document.getElementById('qpType').value = type;
  document.querySelectorAll('.qp-type-card').forEach(btn => {
    btn.classList.toggle('qp-type-card--active', btn.dataset.type === type);
  });
  if (document.getElementById('qpStudentId')?.value) onQpStudentChange();
}

function qpSetGrade(grade) {
  const current = document.getElementById('qpGrade').value;
  const newVal  = current === grade ? '' : grade;
  document.getElementById('qpGrade').value = newVal;
  document.querySelectorAll('.qp-score-btn').forEach(btn => {
    btn.classList.toggle('qp-score-btn--active', btn.dataset.score === newVal);
  });
  // Red zone (1–3) → automatically mark as repeat
  const n = parseInt(newVal);
  document.getElementById('qpIsRepeat').value = (n >= 1 && n <= 3) ? '1' : '';
}


// ── Searchable surah dropdowns ─────────────────────────────

function qpPopulateSurahDropdowns() {
  qpSdBuildList('From', '');
  qpSdBuildList('To', '');
  // Close on outside click
  if (!window._qpSdOutsideSetup) {
    window._qpSdOutsideSetup = true;
    document.addEventListener('click', e => {
      ['From','To'].forEach(side => {
        const wrap = document.getElementById('qpSd'+side);
        if (wrap && !wrap.contains(e.target)) qpSdClose(side);
      });
    });
  }
}

function qpSdToggle(side) {
  const drop = document.getElementById('qpSd'+side+'Drop');
  const isOpen = drop.classList.contains('qp-sd-dropdown--open');
  // Close both first
  qpSdClose('From'); qpSdClose('To');
  if (!isOpen) {
    drop.classList.add('qp-sd-dropdown--open');
    document.getElementById('qpSd'+side).classList.add('qp-sd--open');
    // Clear + focus search
    const search = drop.querySelector('.qp-sd-search');
    search.value = '';
    qpSdBuildList(side, '');
    setTimeout(() => search.focus(), 30);
  }
}

function qpSdClose(side) {
  document.getElementById('qpSd'+side+'Drop')?.classList.remove('qp-sd-dropdown--open');
  document.getElementById('qpSd'+side)?.classList.remove('qp-sd--open');
}

function qpSdFilter(side, q) {
  qpSdBuildList(side, q);
}

function qpSdBuildList(side, q) {
  const list = document.getElementById('qpSd'+side+'List');
  if (!list) return;
  const query = (q || '').trim();
  const currentVal = document.getElementById('qpSurah'+side).value;
  const filtered = query
    ? SURAHS.filter(s => s.name.includes(query) || String(s.n).startsWith(query))
    : SURAHS;
  list.innerHTML = filtered.map(s => `
    <div class="qp-sd-option${s.n == currentVal ? ' qp-sd-option--selected' : ''}"
         onclick="qpSdPick('${side}',${s.n},'${s.name.replace(/'/g,"\\'")}')">
      <span class="qp-sd-num">${s.n}</span>
      <span class="qp-sd-name">${s.name}</span>
      ${s.n == currentVal ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
    </div>`).join('');
}

function qpSdPick(side, n, name) {
  document.getElementById('qpSurah'+side).value = n;
  const label = document.getElementById('qpSurah'+side+'Label');
  label.textContent = n + '. ' + name;
  label.classList.add('qp-sd-value--filled');
  qpSdClose(side);
  qpOnSurahChange(side);
}

function qpOnSurahChange(side) {
  // side = 'From' or 'To'
  const surahNum = +document.getElementById('qpSurah'+side).value || 0;
  const hint = document.getElementById('qpAyah'+side+'Hint');
  if (hint) hint.textContent = surahNum ? `(١–${qpMaxAyah(surahNum)})` : '';
  // clamp existing value
  const inp = document.getElementById('qpAyah'+side);
  if (inp && inp.value && surahNum && +inp.value > qpMaxAyah(surahNum)) inp.value = qpMaxAyah(surahNum);
}

function qpClampAyahField(inputId, surahId) {
  const surahNum = +document.getElementById(surahId)?.value || 0;
  const inp = document.getElementById(inputId);
  if (!inp || !inp.value || !surahNum) return;
  if (+inp.value < 1) inp.value = 1;
  if (+inp.value > qpMaxAyah(surahNum)) inp.value = qpMaxAyah(surahNum);
}

function _qpFillPosition(last) {
  const fromSurah = last.surahToNum || last.surahFromNum || null;
  const fromAyah  = last.ayahTo     || last.ayahFrom     || null;

  if (fromSurah) {
    const name = SURAHS.find(s => s.n === fromSurah)?.name || '';
    document.getElementById('qpSurahFrom').value = fromSurah;
    const lf = document.getElementById('qpSurahFromLabel');
    lf.textContent = fromSurah + '. ' + name;
    lf.classList.add('qp-sd-value--filled');
    qpOnSurahChange('From');
    document.getElementById('qpSurahTo').value = fromSurah;
    const lt = document.getElementById('qpSurahToLabel');
    lt.textContent = fromSurah + '. ' + name;
    lt.classList.add('qp-sd-value--filled');
    qpOnSurahChange('To');
  }
  if (fromAyah) document.getElementById('qpAyahFrom').value = fromAyah;
  document.getElementById('qpAyahTo').value = '';
}

function qpComputePace(list) {
  const memSessions = list.filter(e => e.type === 'memorization' && !e.isRepeat);
  if (memSessions.length < 2) return null;
  let units = [];
  memSessions.slice(0, 15).forEach(e => {
    if (e.ayahTo && e.ayahFrom) units.push(e.ayahTo - e.ayahFrom + 1);
  });
  if (!units.length) return null;
  const avgPerSession = Math.round(units.reduce((a,b)=>a+b,0) / units.length);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 28);
  const sessionsPerWeek = memSessions.filter(e => new Date(e.date) >= cutoff).length / 4;
  // ~6200 verses total in Quran, roughly 206 per juz
  const versesPerJuz = 206;
  const weeksToJuz = (avgPerSession > 0 && sessionsPerWeek > 0)
    ? Math.ceil(versesPerJuz / avgPerSession / sessionsPerWeek) : null;
  return { avgPerSession, sessionsPerWeek: Math.round(sessionsPerWeek * 10)/10, weeksToJuz };
}

async function onQpStudentChange() {
  const studentId = document.getElementById('qpStudentId').value;
  const lastCard  = document.getElementById('qpLastSession');
  const paceEl    = document.getElementById('qpPaceInfo');
  document.getElementById('qpIsRepeat').value = '';

  if (!studentId) {
    if (lastCard) lastCard.classList.add('hidden');
    if (paceEl)   paceEl.classList.add('hidden');
    return;
  }

  const list = await apiFetch(`/quran-progress?studentId=${studentId}`) || [];
  window._qpLastSessionData = list[0] || null;

  const byType = {};
  ['memorization','revision','recitation'].forEach(t => { byType[t] = list.find(e=>e.type===t)||null; });
  window._qpLastByType = byType;

  const currentType  = document.getElementById('qpType').value || 'memorization';
  const lastForType  = byType[currentType] || null;

  if (lastForType) {
    _qpFillPosition(lastForType);

    const typeAr    = { memorization:'حفظ', revision:'مراجعة', recitation:'تلاوة' };
    const surahName = lastForType.surahToName || lastForType.surahFromName || '';
    const ayah      = lastForType.ayahTo      || lastForType.ayahFrom      || '';
    const posText   = surahName ? `${surahName}${ayah ? ' · آية '+ayah : ''}` : formatQPPosition(lastForType);
    const gradeBg   = qpGradeBg(lastForType.grade);
    const gradeCol  = qpGradeColor(lastForType.grade);
    const gradeHtml = lastForType.grade
      ? `<span style="background:${gradeBg};color:${gradeCol};padding:2px 10px;border-radius:20px;font-size:12px;font-weight:700">${lastForType.grade}/10</span>` : '';

    if (lastCard) {
      lastCard.innerHTML = `
        <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:3px">آخر ${typeAr[currentType]} · ${formatDateDisplay(lastForType.date)}</div>
        <div style="font-size:15px;font-weight:700">📍 ${posText} ${gradeHtml}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:3px">↓ تم وضع البداية من هنا تلقائياً — عدّلها إن لزم</div>`;
      lastCard.classList.remove('hidden');
    }

    const pace = qpComputePace(list);
    if (paceEl && pace && pace.weeksToJuz) {
      const color = pace.avgPerSession >= 10 ? '#15803d' : pace.avgPerSession >= 5 ? '#b45309' : '#b91c1c';
      paceEl.innerHTML = `<span style="color:${color};font-weight:700">📈 معدله ${pace.avgPerSession} آية/جلسة</span> &nbsp;·&nbsp; <span style="font-weight:600">🏁 يكمل الجزء في ~${pace.weeksToJuz} أسبوع</span>`;
      paceEl.classList.remove('hidden');
    } else if (paceEl) { paceEl.classList.add('hidden'); }

  } else {
    if (lastCard) {
      lastCard.innerHTML = `<span style="font-size:13px;color:var(--text2)">لا يوجد سجل سابق — أدخل الموضع يدوياً</span>`;
      lastCard.classList.remove('hidden');
    }
    if (paceEl) paceEl.classList.add('hidden');
  }
}

async function saveProgress() {
  const studentId  = document.getElementById('qpStudentId').value;
  const date       = document.getElementById('qpDate').value || todayISO();
  const type       = document.getElementById('qpType').value;
  const surahFromN = +document.getElementById('qpSurahFrom').value || null;
  const surahToN   = +document.getElementById('qpSurahTo').value   || null;
  const ayahFrom   = +document.getElementById('qpAyahFrom').value  || null;
  const ayahTo     = +document.getElementById('qpAyahTo').value    || null;
  const grade      = document.getElementById('qpGrade').value || '';
  const notes      = document.getElementById('qpNotes').value.trim();

  if (!studentId)              return toast('يرجى اختيار الطالب');
  if (!surahFromN && !surahToN) return toast('يرجى تحديد السورة');

  // Validate ayah ranges
  if (surahFromN && ayahFrom && ayahFrom > qpMaxAyah(surahFromN)) {
    return toast(`سورة ${SURAHS.find(s=>s.n===surahFromN)?.name} تحتوي ${qpMaxAyah(surahFromN)} آيات فقط`);
  }
  if (surahToN && ayahTo && ayahTo > qpMaxAyah(surahToN)) {
    return toast(`سورة ${SURAHS.find(s=>s.n===surahToN)?.name} تحتوي ${qpMaxAyah(surahToN)} آيات فقط`);
  }

  const effectiveTo   = surahToN   || surahFromN;
  const surahFromData = SURAHS.find(s=>s.n===surahFromN);
  const surahToData   = SURAHS.find(s=>s.n===effectiveTo);
  const stu           = state.students.find(x=>x.id===studentId);

  const payload = {
    studentId, classId: stu?.classId||'', date, type,
    surahFromNum:  surahFromN,
    surahFromName: surahFromData?.name || null,
    surahToNum:    effectiveTo,
    surahToName:   surahToData?.name   || null,
    ayahFrom, ayahTo,
    juz: surahToData?.juz || surahFromData?.juz || null,
    grade, notes,
  };

  const existingId = document.getElementById('qpId').value;
  if (existingId) {
    await apiFetch(`/quran-progress/${existingId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    toast('✓ تم تحديث السجل');
  } else {
    await apiFetch('/quran-progress', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    toast('✓ تم حفظ التقدم');
  }
  closeModal('quranProgressModal');
  if (state.currentPage === 'quran') await loadQuranSummary();
}

// ── Page → Surah auto-detect (Medina mushaf standard page ranges) ──
const SURAH_PAGE_START = [
  1,1,2,50,77,103,128,151,177,187,208,221,235,249,262,267,282,293,305,312,322,332,342,350,359,367,
  377,385,396,404,411,415,418,428,434,440,446,453,458,467,477,483,489,495,499,503,507,510,513,517,
  520,523,526,528,531,534,537,539,542,545,549,551,553,554,556,558,560,562,564,566,568,570,572,574,
  575,577,578,580,582,583,584,586,587,587,588,589,590,591,591,592,593,594,595,595,596,596,597,597,
  598,598,599,599,600,600,601,601,601,602,602,602,603,603,603,603,604,604,604,604
];

// Approximate verses per juz (for pace estimation when tracking by ayah)
const JUZ_AYAH_COUNT = [148,111,132,176,124,110,149,148,159,127,150,170,154,227,185,128,111,110,128,134,
                         158,165,115,176,100,227,173,137,180,564];


// ══════════════════════════════════════════════════════════════════


/* ── modules/calendar.js ── */
//  التقويم — Calendar Page  (v2 — practical rebuild)
// ══════════════════════════════════════════════════════════════════

/* ── State ──────────────────────────────────────────────────────── */
let _calYear   = 0;
let _calMonth  = 0;
let _calEvents = [];      // events for current month
let _calAllEvents = [];   // all saved events
let _calDayDate   = '';   // currently-selected day ISO
let _calWaRows    = [];
let _calSelColor  = '#2563EB';
let _calSelType   = 'event';
let _calView      = 'grid';   // 'grid' | 'agenda'
let _calFilter    = 'all';

const CAL_TYPE_COLOR = { event:'#2563EB', holiday:'#DC2626', offday:'#D97706', message:'#7C3AED', reminder:'#0D9488' };
const CAL_TYPE_BG    = { event:'#EFF6FF', holiday:'#FEF2F2', offday:'#FFFBEB', message:'#F5F3FF', reminder:'#CCFBF1' };
const CAL_TYPE_LABEL = { event: '<span class="ui-ic ic-amber" style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg></span> حدث', holiday: '<span class="ui-ic ic-sky" style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"/></svg></span> إجازة', offday: '<span class="ui-ic ic-gray" style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12 12 0 0 0 2.54.72 2 2 0 0 1 1.64 2l.12 2a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 2 2 0 0 1-.37-.3"/><path d="M6.14 6.14A19.79 19.79 0 0 0 3.07 14.77a2 2 0 0 1-2.18 2l-2-.12a2 2 0 0 1-1.64-2 12 12 0 0 0 .72-2.54 2 2 0 0 1-.45-2.11l1.27-1.27a16 16 0 0 0 2.6-3.41"/><line x1="1" y1="1" x2="23" y2="23"/></svg></span> يوم إجازة', message:'💬 رسالة', reminder:'🔔 تذكير' };

/* ── Init / Nav ─────────────────────────────────────────────────── */
async function initCalendarPage() {
  if (getCalType() === 'gregorian') {
    const now = new Date();
    if (!_calYear)  _calYear  = now.getFullYear();
    if (!_calMonth) _calMonth = now.getMonth() + 1;
  } else {
    const today = toHijri(todayISO());
    if (!_calYear)  _calYear  = today.year;
    if (!_calMonth) _calMonth = today.month;
  }
  await renderCalendar();
}

function calChangeMonth(delta) {
  _calMonth += delta;
  if (_calMonth > 12) { _calMonth = 1;  _calYear++; }
  if (_calMonth < 1)  { _calMonth = 12; _calYear--; }
  renderCalendar();
}

function calGoToday() {
  if (getCalType() === 'gregorian') {
    const now = new Date();
    _calYear = now.getFullYear(); _calMonth = now.getMonth() + 1;
  } else {
    const t = toHijri(todayISO());
    _calYear = t.year; _calMonth = t.month;
  }
  renderCalendar();
}

function calSetView(v) {
  _calView = v;
  document.getElementById('calGridView')?.classList.toggle('hidden', v !== 'grid');
  document.getElementById('calAgendaView')?.classList.toggle('hidden', v !== 'agenda');
  document.getElementById('calViewGrid')?.classList.toggle('active', v === 'grid');
  document.getElementById('calViewAgenda')?.classList.toggle('active', v === 'agenda');
  if (v === 'agenda') _renderAgenda();
  else _renderCalGrid((getCalType()==='gregorian'?_buildGregorianMonthDates:_buildHijriMonthDates)(_calYear, _calMonth), new Set((state.holidays||[]).map(h=>h.date)));
}

function calSetFilter(f) {
  _calFilter = f;
  document.querySelectorAll('.cal-filter').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
  if (_calView === 'agenda') _renderAgenda();
  else _renderCalGrid((getCalType()==='gregorian'?_buildGregorianMonthDates:_buildHijriMonthDates)(_calYear, _calMonth), new Set((state.holidays||[]).map(h=>h.date)));
}

/* ── Main Render ────────────────────────────────────────────────── */
function _buildGregorianMonthDates(gy, gm) {
  const dates = [];
  const days = new Date(+gy, +gm, 0).getDate();
  for (let d = 1; d <= days; d++) {
    dates.push(gy + '-' + String(gm).padStart(2,'0') + '-' + String(d).padStart(2,'0'));
  }
  return dates;
}

async function renderCalendar() {
  const isGreg = getCalType() === 'gregorian';
  const labelEl = document.getElementById('calMonthLabel');
  const labelGregEl = document.getElementById('calMonthLabelGreg');
  const todayBtnEl  = document.getElementById('calTodayBtn');

  let dates;
  if (isGreg) {
    if (labelEl) labelEl.textContent = `${GREGORIAN_MONTHS[_calMonth]} ${_calYear}م`;
    if (labelGregEl) labelGregEl.textContent = '';
    const now = new Date();
    todayBtnEl?.classList.toggle('hidden', now.getFullYear()===_calYear && now.getMonth()+1===_calMonth);
    dates = _buildGregorianMonthDates(_calYear, _calMonth);
  } else {
    if (labelEl) labelEl.textContent = `${HIJRI_MONTHS[_calMonth]} ${_calYear}هـ`;
    if (dates === undefined) dates = _buildHijriMonthDates(_calYear, _calMonth);
    if (dates.length && labelGregEl) {
      const first = new Date(dates[0]+'T00:00:00'), last = new Date(dates[dates.length-1]+'T00:00:00');
      const fmt = d => d.toLocaleDateString('ar-SA', {month:'long', year:'numeric'});
      labelGregEl.textContent = first.getMonth() !== last.getMonth() ? fmt(first)+' — '+fmt(last) : fmt(first);
    }
    const now = toHijri(todayISO());
    todayBtnEl?.classList.toggle('hidden', now.year===_calYear && now.month===_calMonth);
    dates = _buildHijriMonthDates(_calYear, _calMonth);
  }

  // Fetch events for this month
  const calTypeParam = isGreg ? '&calType=gregorian' : '';
  _calEvents    = await apiFetch(`/calendar?year=${_calYear}&month=${_calMonth}${calTypeParam}`) || [];
  _calAllEvents = await apiFetch('/calendar') || [];

  const holidaySet = new Set((state.holidays||[]).map(h=>h.date));
  _renderSummaryBar(dates, holidaySet);
  if (_calView === 'grid') _renderCalGrid(dates, holidaySet);
  else _renderAgenda();

  // Close day panel if open month changed
  calCloseDayPanel();
}

/* ── Summary Bar ────────────────────────────────────────────────── */
function _renderSummaryBar(dates, holidaySet) {
  const el = document.getElementById('calSummaryBar');
  if (!el) return;
  const today = todayISO();
  let schoolDays=0, offDays=0, eventCount=0;
  dates.forEach(d => {
    const isFri = new Date(d+'T00:00:00').getDay()===5;
    const isHol = holidaySet.has(d);
    if (isFri||isHol) offDays++; else schoolDays++;
  });
  eventCount = _calEvents.filter(e=>!e.type||e.type==='event'||e.type==='reminder'||e.type==='message').length;
  const upcoming = _calAllEvents.filter(e=>e.date>today).length;
  el.innerHTML = `
    <div class="cal-sum-item">
      <span class="cal-sum-num">${dates.length}</span>
      <span class="cal-sum-lbl">يوم في الشهر</span>
    </div>
    <div class="cal-sum-divider"></div>
    <div class="cal-sum-item">
      <span class="cal-sum-num cal-sum-green">${schoolDays}</span>
      <span class="cal-sum-lbl">يوم دراسي</span>
    </div>
    <div class="cal-sum-divider"></div>
    <div class="cal-sum-item">
      <span class="cal-sum-num cal-sum-red">${offDays}</span>
      <span class="cal-sum-lbl">يوم إجازة</span>
    </div>
    <div class="cal-sum-divider"></div>
    <div class="cal-sum-item">
      <span class="cal-sum-num cal-sum-blue">${eventCount}</span>
      <span class="cal-sum-lbl">حدث هذا الشهر</span>
    </div>
    <div class="cal-sum-divider"></div>
    <div class="cal-sum-item">
      <span class="cal-sum-num cal-sum-purple">${upcoming}</span>
      <span class="cal-sum-lbl">حدث قادم</span>
    </div>`;
}

/* ── Hijri Helpers ──────────────────────────────────────────────── */
// Expand a repeating event into all matching dates within a given date range
function _expandRepeatEvent(ev, dates) {
  if (!ev.repeat) return [];
  const result = [];
  const origin = new Date(ev.date + 'T00:00:00');
  const originDow = origin.getDay(); // day-of-week for weekly

  dates.forEach(iso => {
    if (iso <= ev.date) return; // don't re-add the original date
    const d = new Date(iso + 'T00:00:00');
    if (ev.repeat === 'weekly' && d.getDay() === originDow) {
      result.push({ ...ev, id: ev.id + '_r_' + iso, date: iso, _isRepeat: true });
    } else if (ev.repeat === 'monthly') {
      // Same Hijri day, any future month
      const h = toHijri(iso);
      const hOrigin = toHijri(ev.date);
      if (h.day === hOrigin.day && iso > ev.date) {
        result.push({ ...ev, id: ev.id + '_r_' + iso, date: iso, _isRepeat: true });
      }
    } else if (ev.repeat === 'yearly') {
      const h = toHijri(iso);
      const hOrigin = toHijri(ev.date);
      if (h.day === hOrigin.day && h.month === hOrigin.month && iso > ev.date) {
        result.push({ ...ev, id: ev.id + '_r_' + iso, date: iso, _isRepeat: true });
      }
    }
  });
  return result;
}

function _buildHijriMonthDates(hy, hm) {
  const dates = [];
  for (let d=1;d<=30;d++) {
    const iso = _fromHijriClient(hy,hm,d);
    const back = toHijri(iso);
    if (back.year!==hy||back.month!==hm) break;
    dates.push(iso);
  }
  return dates;
}

function _fromHijriClient(hy,hm,hd) {
  const _HL=new Set([2,5,7,10,13,15,18,21,24,26,29]);
  const _HE=1948440,_HC=10631;
  const _yL=y=>_HL.has(y%30===0?30:y%30)?355:354;
  const _mL=(y,m)=>m%2===1?30:(m===12&&_HL.has(y%30===0?30:y%30)?30:29);
  const cyc=(hy-1)/30|0,yin=((hy-1)%30)+1;
  let jdn=_HE+cyc*_HC;
  for(let y=1;y<yin;y++) jdn+=_yL(y);
  for(let m=1;m<hm;m++) jdn+=_mL(hy,m);
  jdn+=hd-1;
  const L=jdn+68569,N=(4*L/146097)|0,L2=L-((146097*N+3)/4|0);
  const I=(4000*(L2+1)/1461001)|0,L3=L2-(1461*I/4|0)+31,J=(80*L3/2447)|0;
  const gd=L3-(2447*J/80|0),L4=(J/11)|0,gm=J+2-12*L4,gy=100*(N-49)+I+L4;
  return gy+'-'+String(gm).padStart(2,'0')+'-'+String(gd).padStart(2,'0');
}

/* ── Calendar Grid ──────────────────────────────────────────────── */
function _renderCalGrid(dates, holidaySet) {
  const grid = document.getElementById('calGrid');
  if (!grid) return;
  const today = todayISO();

  // Build event map (date → events), expand ranges and repeats
  const evMap = {};
  const filtered = _calFilter==='all' ? _calEvents : _calEvents.filter(e=>e.type===_calFilter);
  const allEventsForGrid = [];
  filtered.forEach(e => {
    allEventsForGrid.push(e);
    _expandRepeatEvent(e, dates).forEach(r => allEventsForGrid.push(r));
  });
  allEventsForGrid.forEach(e => {
    const addTo = iso => { if(!evMap[iso]) evMap[iso]=[]; evMap[iso].push(e); };
    // If event has specific non-contiguous dates, only show on those exact dates
    if (e.specificDates && e.specificDates.length > 0 && !e._isRepeat) {
      e.specificDates.forEach(iso => addTo(iso));
    } else {
      addTo(e.date);
      if (e.endDate && e.endDate!==e.date && !e._isRepeat) {
        let d=new Date(e.date+'T00:00:00'), end=new Date(e.endDate+'T00:00:00');
        d.setDate(d.getDate()+1);
        while(d<=end) { addTo(d.toISOString().split('T')[0]); d.setDate(d.getDate()+1); }
      }
    }
  });

  const firstDay = new Date(dates[0]+'T00:00:00').getDay();
  let html='';
  for(let i=0;i<firstDay;i++) html+='<div class="cal-cell cal-cell-empty"></div>';

  dates.forEach(iso => {
    const d=new Date(iso+'T00:00:00');
    const isGreg = getCalType() === 'gregorian';
    const hijriD = isGreg ? +iso.split('-')[2] : toHijri(iso).day;
    const isFri=d.getDay()===5, isToday=iso===today;
    const isHol=holidaySet.has(iso), dayEvs=evMap[iso]||[];
    const isSelected = iso===_calDayDate;

    const isPast = iso < today;
    let cls='cal-cell';
    if(isPast)     cls+=' cal-cell-past';
    if(isToday)    cls+=' cal-cell-today';
    if(isFri)      cls+=' cal-cell-fri';
    if(isHol&&!isFri) cls+=' cal-cell-hol';
    if(isSelected) cls+=' cal-cell-selected';

    // Holiday badge (only non-Friday)
    const holBadge = (!isFri && (isHol||dayEvs.some(e=>e.type==='holiday'||e.type==='offday')))
      ? `<div class="cal-hol-badge">${dayEvs.find(e=>e.type==='holiday'||e.type==='offday')?.title||'إجازة'}</div>` : '';

    // Event chips — show up to 3 with title
    const chips = dayEvs.slice(0,3).map(e => {
      const color = e.color||CAL_TYPE_COLOR[e.type]||'#2563EB';
      const bg    = CAL_TYPE_BG[e.type]||'#EFF6FF';
      const title = e.title.length>14 ? e.title.slice(0,13)+'…' : e.title;
      return `<div class="cal-chip" style="background:${bg};color:${color};border-color:${color}22">${title}</div>`;
    }).join('');
    const moreChip = dayEvs.length>3 ? `<div class="cal-chip cal-chip-more">+${dayEvs.length-3}</div>` : '';

    const isGreg2 = getCalType() === 'gregorian';
    const mainNum = isGreg2 ? d.getDate() : toHijri(iso).day;
    const subNum  = isGreg2 ? toHijri(iso).day : d.getDate();
    html+=`<div class="${cls}" onclick="calOpenDay('${iso}')">
      <div class="cal-cell-head">
        <span class="cal-cell-hijri">${mainNum}</span>
        <span class="cal-cell-greg">${subNum}</span>
      </div>
      ${holBadge}
      <div class="cal-chips">${chips}${moreChip}</div>
    </div>`;
  });

  const trail=(firstDay+dates.length)%7===0?0:7-((firstDay+dates.length)%7);
  for(let i=0;i<trail;i++) html+='<div class="cal-cell cal-cell-empty"></div>';
  grid.innerHTML=html;
}

/* ── Agenda View ────────────────────────────────────────────────── */
function _renderAgenda() {
  const el=document.getElementById('calAgendaList');
  if(!el) return;
  const today=todayISO();
  const dates = getCalType()==='gregorian'
    ? _buildGregorianMonthDates(_calYear,_calMonth)
    : _buildHijriMonthDates(_calYear,_calMonth);
  const startISO=dates[0], endISO=dates[dates.length-1];
  const holidaySet=new Set((state.holidays||[]).map(h=>h.date));

  // Collect all agenda items for the month
  const items=[];
  dates.forEach(iso=>{
    const d=new Date(iso+'T00:00:00');
    const isFri=d.getDay()===5, isHol=holidaySet.has(iso);
    if(!isFri && isHol) items.push({iso, type:'_system', label:'إجازة'});
  });
  const filtered = _calFilter==='all' ? _calAllEvents : _calAllEvents.filter(e=>e.type===_calFilter);
  filtered.forEach(e=>{
    if(new Date(e.date+'T00:00:00').getDay()===5) return;
    if(e.date>=startISO&&e.date<=endISO) items.push({...e,iso:e.date});
    else if(e.endDate&&e.endDate>=startISO&&e.date<=endISO) items.push({...e,iso:e.date});
    // Expand repeating events into this month
    _expandRepeatEvent(e, dates).forEach(r => {
      if(new Date(r.date+'T00:00:00').getDay()===5) return;
      items.push({...r,iso:r.date});
    });
  });
  items.sort((a,b)=>{
    const dc=a.iso.localeCompare(b.iso);
    if(dc!==0)return dc;
    return (a.time||'zz').localeCompare(b.time||'zz');
  });

  if(!items.length){el.innerHTML='<div class="info-banner">لا توجد أحداث هذا الشهر.</div>';return;}

  // Group by date
  let lastDate='', html='';
  items.forEach(item=>{
    if(item.iso!==lastDate){
      lastDate=item.iso;
      const d=new Date(item.iso+'T00:00:00');
      const DAY_AR=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
      const isToday=item.iso===today;
      const days=Math.round((new Date(item.iso)-new Date(today))/(1000*86400));
      const countdown = isToday?'<span class="cal-agenda-today">اليوم</span>'
        : days===1?'<span class="cal-agenda-soon">غداً</span>'
        : days>0&&days<=7?`<span class="cal-agenda-soon">بعد ${days} أيام</span>`
        : days<0?`<span class="cal-agenda-past">منذ ${Math.abs(days)} يوم</span>`:'';
      const _isGreg = getCalType() === 'gregorian';
      const _agendaDNum = _isGreg
        ? `${d.getDate()} ${GREGORIAN_MONTHS[d.getMonth()+1]}`
        : `${toHijri(item.iso).day} ${HIJRI_MONTHS[toHijri(item.iso).month]}`;
      const _agendaGreg = _isGreg ? '' : `${d.getDate()}/${d.getMonth()+1}`;
      html+=`<div class="cal-agenda-date-header ${isToday?'cal-agenda-today-header':''}">
        <span class="cal-agenda-dname">${DAY_AR[d.getDay()]}</span>
        <span class="cal-agenda-dnum">${_agendaDNum}</span>
        ${_agendaGreg ? `<span class="cal-agenda-greg">${_agendaGreg}</span>` : ''}
        ${countdown}
      </div>`;
    }
    if(item.type==='_system'){
      html+=`<div class="cal-agenda-row cal-agenda-system">
        <div class="cal-agenda-stripe" style="background:#94A3B8"></div>
        <div class="cal-agenda-body"><span class="cal-agenda-title">${item.label}</span></div>
      </div>`;
    } else {
      const color=item.color||CAL_TYPE_COLOR[item.type]||'#2563EB';
      const bg=CAL_TYPE_BG[item.type]||'#EFF6FF';
      html+=`<div class="cal-agenda-row" style="background:${bg}" onclick="calOpenDay('${item.iso}')">
        <div class="cal-agenda-stripe" style="background:${color}"></div>
        <div class="cal-agenda-body">
          <div class="cal-agenda-title">${item.title}</div>
          <div class="cal-agenda-meta">${CAL_TYPE_LABEL[item.type]||''}${item.time?' · ⏰'+item.time:''}${item.endDate&&item.endDate!==item.date?' · حتى '+formatDateDisplay(item.endDate):''}</div>
          ${item.note?`<div class="cal-agenda-note">${item.note}</div>`:''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;padding:6px">
          <button class="btn-icon" onclick="event.stopPropagation();openCalEventModal('${item.id}')" title="تعديل"><span class="ui-ic ic-blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span></button>
          <button class="btn-icon" onclick="event.stopPropagation();deleteCalEvent('${item.id}')" title="حذف"><span class="ui-ic ic-red"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span></button>
        </div>
      </div>`;
    }
  });
  el.innerHTML=html;
}

/* ── Day Panel (inline, replaces modal) ─────────────────────────── */
function calOpenDay(iso) {
  _calDayDate = iso;
  // Re-render grid to highlight selected
  const holidaySet=new Set((state.holidays||[]).map(h=>h.date));
  _renderCalGrid(_buildHijriMonthDates(_calYear,_calMonth), holidaySet);

  const panel=document.getElementById('calDayPanel');
  const title=document.getElementById('calDayPanelTitle');
  const body=document.getElementById('calDayPanelBody');
  if(!panel) return;

  title.textContent = formatDateDisplayFull(iso);

  const isFri=new Date(iso+'T00:00:00').getDay()===5;
  const isHol=(state.holidays||[]).some(h=>h.date===iso);
  const dayEvs=_calAllEvents.filter(e=>{
    if (e.specificDates && e.specificDates.length > 0) return e.specificDates.includes(iso);
    return e.date===iso||(e.endDate&&iso>=e.date&&iso<=e.endDate);
  });

  let html='';
  // System badges
  if(isFri) html+=`<div class="cal-day-sys"><span class="ui-ic ic-teal" style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 20H2"/><path d="M4 20V10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10"/><path d="M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4"/><path d="M9 20v-4a3 3 0 0 1 6 0v4"/></svg></span> يوم الجمعة — إجازة أسبوعية</div>`;
  if(isHol&&!isFri){
    const h=(state.holidays||[]).find(h=>h.date===iso);
    html+=`<div class="cal-day-sys cal-day-sys-red"><span class="ui-ic ic-sky" style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"/></svg></span> ${h?.reason||'إجازة'}</div>`;
  }

  if(!dayEvs.length&&!isFri&&!isHol){
    html+=`<div class="cal-day-empty">لا توجد أحداث — <a href="#" onclick="calAddEventForDay();return false">إضافة حدث</a></div>`;
  } else {
    html+=dayEvs.map(e=>{
      const color=e.color||CAL_TYPE_COLOR[e.type]||'#2563EB';
      const bg=CAL_TYPE_BG[e.type]||'#EFF6FF';
      const days=Math.round((new Date(iso)-new Date(todayISO()))/(1000*86400));
      const countdown=days===0?'<span class="cal-ev-badge cal-ev-today">اليوم</span>'
        :days===1?'<span class="cal-ev-badge cal-ev-soon">غداً</span>'
        :days>0&&days<=7?`<span class="cal-ev-badge cal-ev-soon">بعد ${days} أيام</span>`:'';
      return `<div class="cal-day-ev" style="background:${bg}">
        <div class="cal-day-ev-stripe" style="background:${color}"></div>
        <div class="cal-day-ev-body">
          <div class="cal-day-ev-top">
            <span class="cal-day-ev-title">${e.title}</span>
            ${countdown}
          </div>
          <div class="cal-day-ev-meta">${CAL_TYPE_LABEL[e.type]||''}${e.time?' · ⏰ '+e.time:''}${e.endDate&&e.endDate!==e.date?' · حتى '+formatDateDisplay(e.endDate):''}</div>
          ${e.note?`<div class="cal-day-ev-note">${e.note}</div>`:''}
          ${e.type==='message'&&e.waTargets?.length?`<div class="cal-day-ev-note"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> ${e.waTargets.length} مستلم</div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;padding:6px 8px;flex-shrink:0">
          <button class="btn-icon" onclick="openCalEventModal('${e.id}')" title="تعديل"><span class="ui-ic ic-blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span></button>
          <button class="btn-icon" onclick="deleteCalEvent('${e.id}')" title="حذف"><span class="ui-ic ic-red"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span></button>
        </div>
      </div>`;
    }).join('');
  }

  body.innerHTML=html;
  panel.classList.remove('hidden');
  // Scroll into view on mobile
  setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'nearest'}),50);
}

function calCloseDayPanel() {
  _calDayDate='';
  document.getElementById('calDayPanel')?.classList.add('hidden');
  // Remove selection highlight
  document.querySelectorAll('.cal-cell-selected').forEach(c=>c.classList.remove('cal-cell-selected'));
}

function calAddEventForDay() {
  openCalEventModal(null, _calDayDate||todayISO());
}

/* ── Event Modal ────────────────────────────────────────────────── */
// _calWaMode = true when the modal is opened from the WA tab (locks to message type only)
let _calWaMode = false;

async function openCalEventModal(id=null, prefillDate=null, prefillType=null, waMode=false) {
  _calWaMode = waMode;
  _calWaRows=[]; _calSelType='event'; _calSelColor='#2563EB'; _eventDates=[];
  _specificDates = [];
  const fields=['calEventId','calEventTitle','calEventDate','calEventEndDate','calEventTime','calEventNote','calWaMessage'];
  fields.forEach(f=>{ const el=document.getElementById(f); if(el) el.value=''; });
  document.getElementById('calEventDate').value = prefillDate||todayISO();
  document.getElementById('calEventRepeat').value = '';
  const drCb = document.getElementById('calDailyRepeat'); if(drCb) drCb.checked=false;
  const sdCb = document.getElementById('calUseSpecificDays'); if(sdCb) sdCb.checked=false;
  document.getElementById('calDailyRepeatSection')?.classList.add('hidden');
  document.getElementById('calDailyPreview')?.classList.add('hidden');
  document.getElementById('calSpecificDaysSection')?.classList.add('hidden');
  document.getElementById('calSpecificDaysBody')?.classList.add('hidden');
  document.getElementById('calSpecificDaysChips').innerHTML='';
  document.getElementById('calEndDateSection')?.classList.add('hidden');
  document.getElementById('calEventDayPickerSection')?.classList.remove('hidden');
  const evChips = document.getElementById('calEvDpChips');
  if (evChips) evChips.innerHTML = '<span style="color:var(--text2);font-size:13px">لم يتم اختيار أيام بعد</span>';
  updateHijriLabel(document.getElementById('calEventDate'),'calEventHijri');
  document.getElementById('calEventEndHijri').textContent='';
  document.getElementById('calWaSection')?.classList.add('hidden');
  document.getElementById('calWaRecipients').innerHTML='';
  document.querySelectorAll('.cal-type-btn').forEach(b=>b.classList.toggle('active',b.dataset.type==='event'));
  document.querySelectorAll('.cal-color-btn').forEach(b=>b.classList.toggle('active',b.dataset.color==='#2563EB'));

  // WA mode: hide type selector, show banner, lock to message
  const typeSection = document.getElementById('calTypeSection');
  const waBanner    = document.getElementById('calWaModeBanner');
  if (waMode) {
    typeSection?.classList.add('hidden');
    waBanner?.classList.remove('hidden');
  } else {
    typeSection?.classList.remove('hidden');
    waBanner?.classList.add('hidden');
  }

  if(id){
    // Try local cache first, then fetch from server
    const ev = _calAllEvents.find(e=>e.id===id) || (await apiFetch('/calendar'))?.find(e=>e.id===id);
    if(ev){
      document.getElementById('calEventModalTitle').textContent = waMode ? 'تعديل الرسالة المجدولة' : 'تعديل الحدث';
      document.getElementById('calEventId').value    = ev.id;
      document.getElementById('calEventTitle').value = ev.title||'';
      document.getElementById('calEventDate').value  = ev.date||'';
      document.getElementById('calEventEndDate').value = ev.endDate||'';
      document.getElementById('calEventTime').value  = ev.time||'';
      document.getElementById('calEventNote').value  = ev.note||'';
      document.getElementById('calEventRepeat').value = ev.repeat||'';
      updateHijriLabel(document.getElementById('calEventDate'),'calEventHijri');
      if(ev.endDate) updateHijriLabel(document.getElementById('calEventEndDate'),'calEventEndHijri');
      calSelectType(ev.type||'event');
      if(ev.waMessage) document.getElementById('calWaMessage').value=ev.waMessage;
      if(ev.waTargets){ _calWaRows=ev.waTargets.map(r=>({...r})); _renderCalWaRows(); }
      // Restore multi-day selection for non-message events
      if(ev.specificDates?.length && ev.type !== 'message') {
        _eventDates = [...ev.specificDates];
      } else if(ev.type !== 'message' && ev.date) {
        _eventDates = [ev.date];
        if(ev.endDate && ev.endDate !== ev.date) _eventDates.push(ev.endDate);
      }
      _calSelColor=ev.color||CAL_TYPE_COLOR[ev.type]||'#2563EB';
      document.querySelectorAll('.cal-color-btn').forEach(b=>b.classList.toggle('active',b.dataset.color===_calSelColor));
    }
  } else {
    document.getElementById('calEventModalTitle').textContent = waMode ? 'رسالة واتساب جديدة' : 'إضافة حدث';
    if (waMode || prefillType) calSelectType(waMode ? 'message' : prefillType);
  }
  document.getElementById('calEventModal').classList.remove('hidden');
}

// ══════════════════════════════════════════════════════════
//  Specific Days Picker — Hijri Calendar
// ══════════════════════════════════════════════════════════
let _specificDates = [];
let _dpHYear = 0, _dpHMonth = 0;
let _dpTempSelected = [];
let _dpMode = 'specific'; // 'specific' | 'event' | 'holiday'
let _holidayDates = [];   // selected dates for multi-day holiday

function calToggleSpecificDays() {
  const checked = document.getElementById('calUseSpecificDays')?.checked;
  document.getElementById('calSpecificDaysBody')?.classList.toggle('hidden', !checked);
  if (!checked) { _specificDates = []; _renderSpecificChips(); }
}

function openDayPickerModal() {
  _dpMode = 'specific';
  if (_specificDates.length) {
    const h = toHijri(_specificDates[0]);
    _dpHYear = h.year; _dpHMonth = h.month;
  } else {
    const h = toHijri(todayISO());
    _dpHYear = h.year; _dpHMonth = h.month;
  }
  _dpTempSelected = [..._specificDates];
  _renderDpGrid();
  document.getElementById('dayPickerModal')?.classList.remove('hidden');
}

function closeDayPickerModal() {
  document.getElementById('dayPickerModal')?.classList.add('hidden');
}

function saveDayPicker() {
  if (_dpMode === 'event') {
    _eventDates = [..._dpTempSelected].sort();
    _renderEventDpChips();
    // Sync first date to start input
    if (_eventDates.length > 0) {
      const inp = document.getElementById('calEventDate');
      if (inp) { inp.value = _eventDates[0]; updateHijriLabel(inp, 'calEventHijri'); }
    }
    closeDayPickerModal();
    toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم اختيار ${_eventDates.length} يوم`);
  } else if (_dpMode === 'holiday') {
    _holidayDates = [..._dpTempSelected].sort();
    _renderHolidayChips();
    closeDayPickerModal();
    const btn = document.getElementById('holidaySaveBtn');
    if (btn) btn.textContent = _holidayDates.length > 1 ? `حفظ (${_holidayDates.length} أيام)` : 'حفظ';
    toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم اختيار ${_holidayDates.length} يوم`);
  } else {
    _specificDates = [..._dpTempSelected].sort();
    _renderSpecificChips();
    closeDayPickerModal();
    toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم اختيار ${_specificDates.length} يوم`);
  }
}

function dpPrevMonth() {
  _dpHMonth--;
  if (_dpHMonth < 1) { _dpHMonth = 12; _dpHYear--; }
  _renderDpGrid();
}
function dpNextMonth() {
  _dpHMonth++;
  if (_dpHMonth > 12) { _dpHMonth = 1; _dpHYear++; }
  _renderDpGrid();
}

function _renderDpGrid() {
  document.getElementById('dpMonthLabel').textContent = `${HIJRI_MONTHS[_dpHMonth]} ${_dpHYear}هـ`;
  const grid = document.getElementById('dpGrid');
  if (!grid) return;

  const dates   = _buildHijriMonthDates(_dpHYear, _dpHMonth);
  const today   = todayISO();
  const holidays = new Set((state.holidays||[]).map(h => h.date));

  // Build event map for this month
  const evMap = {};
  (_calAllEvents||[]).forEach(e => {
    if (e.date >= dates[0] && e.date <= dates[dates.length-1]) {
      if (!evMap[e.date]) evMap[e.date] = [];
      evMap[e.date].push(e);
    }
  });

  // First day of week (0=Sun) for the first Gregorian date in this Hijri month
  const firstDow = new Date(dates[0]+'T00:00:00').getDay();

  let html = '';
  for (let i = 0; i < firstDow; i++) html += '<div class="dp-cell dp-empty"></div>';

  dates.forEach(iso => {
    const h         = toHijri(iso);
    const isFri     = new Date(iso+'T00:00:00').getDay() === 5;
    const isPast    = iso < today;
    const isToday   = iso === today;
    const isHol     = holidays.has(iso);
    const isSelected = _dpTempSelected.includes(iso);
    const dayEvs    = evMap[iso] || [];
    const hasEvent  = dayEvs.length > 0;

    let cls = 'dp-cell';
    if (isFri)       cls += ' dp-fri';
    if (isHol)       cls += ' dp-hol';
    if (isPast)      cls += ' dp-past';
    if (isToday)     cls += ' dp-today';
    if (isSelected)  cls += ' dp-selected';

    // Event dots — up to 3 colored dots
    const CAL_TYPE_COLOR_DP = { event:'#2563EB', holiday:'#DC2626', offday:'#7C3AED', message:'#0D9488', reminder:'#D97706' };
    const dots = hasEvent ? dayEvs.slice(0,3).map(e =>
      `<span class="dp-dot" style="background:${isSelected?'#fff':(e.color||CAL_TYPE_COLOR_DP[e.type]||'#2563EB')}"></span>`
    ).join('') : '';

    const tooltip = hasEvent ? dayEvs.map(e=>e.title).join('، ') : iso;

    html += `<div class="${cls}" onclick="dpToggleDay('${iso}')" title="${tooltip}">
      <span class="dp-hijri-num">${h.day}</span>
      <span class="dp-greg-sub">${new Date(iso+'T00:00:00').getDate()}</span>
      ${dots ? `<div class="dp-dots">${dots}</div>` : '<div class="dp-dots"></div>'}
    </div>`;
  });

  grid.innerHTML = html;
  const cnt = document.getElementById('dpSelectedCount');
  if (cnt) cnt.innerHTML = _dpTempSelected.length
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> ${_dpTempSelected.length} يوم مختار`
    : 'اضغط على الأيام لاختيارها';
}

function dpToggleDay(iso) {
  const idx = _dpTempSelected.indexOf(iso);
  if (idx >= 0) _dpTempSelected.splice(idx, 1);
  else _dpTempSelected.push(iso);
  _renderDpGrid();
}

function _renderSpecificChips() {
  const el = document.getElementById('calSpecificDaysChips');
  if (!el) return;
  if (!_specificDates.length) {
    el.innerHTML = '<span style="color:var(--text2);font-size:13px">لم يتم اختيار أيام بعد</span>';
  } else {
    el.innerHTML = _specificDates.map(iso =>
      `<span class="cal-specific-chip">${formatDateDisplay(iso)} <button onclick="calRemoveSpecificDay('${iso}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></span>`
    ).join('');
  }
  const saveBtn = document.getElementById('calSaveBtn');
  if (saveBtn && !_calSaving) saveBtn.textContent = _specificDates.length ? `حفظ (${_specificDates.length} رسالة)` : 'حفظ';
}

function calRemoveSpecificDay(iso) {
  _specificDates = _specificDates.filter(d => d !== iso);
  _renderSpecificChips();
}

// ── Event day picker — reuses the existing dayPickerModal ──────────
let _eventDates = [];  // selected dates for non-message events

function openEventDayPicker() {
  // Point the day picker save callback to the event chips container
  _dpMode = 'event';
  if (_eventDates.length) {
    const h = toHijri(_eventDates[0]);
    _dpHYear = h.year; _dpHMonth = h.month;
  } else {
    const v = document.getElementById('calEventDate')?.value;
    const h = toHijri(v || todayISO());
    _dpHYear = h.year; _dpHMonth = h.month;
  }
  _dpTempSelected = [..._eventDates];
  _renderDpGrid();
  document.getElementById('dayPickerModal')?.classList.remove('hidden');
}

function _renderEventDpChips() {
  const el = document.getElementById('calEvDpChips');
  if (!el) return;
  if (!_eventDates.length) {
    el.innerHTML = '<span style="color:var(--text2);font-size:13px">لم يتم اختيار أيام بعد</span>';
  } else {
    el.innerHTML = _eventDates.map(iso =>
      `<span class="cal-specific-chip">${formatDateDisplay(iso)} <button type="button" onclick="_eventDates=_eventDates.filter(d=>d!=='${iso}');_renderEventDpChips()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></span>`
    ).join('');
  }
  // Sync first date to start input
  if (_eventDates.length > 0) {
    const inp = document.getElementById('calEventDate');
    if (inp && !inp.value) { inp.value = _eventDates[0]; updateHijriLabel(inp,'calEventHijri'); }
  }
}

function calSelectType(type){
  if (_calWaMode) type = 'message';
  _calSelType=type;
  document.querySelectorAll('.cal-type-btn').forEach(b=>b.classList.toggle('active',b.dataset.type===type));
  _calSelColor=CAL_TYPE_COLOR[type]||'#2563EB';
  document.querySelectorAll('.cal-color-btn').forEach(b=>b.classList.toggle('active',b.dataset.color===_calSelColor));

  const isMsg = type === 'message';
  document.getElementById('calWaSection')?.classList.toggle('hidden', !isMsg);
  document.getElementById('calSpecificDaysSection')?.classList.toggle('hidden', !isMsg);
  document.getElementById('calEndDateSection')?.classList.toggle('hidden', !isMsg);
  document.getElementById('calEventDayPickerSection')?.classList.toggle('hidden', isMsg);

  calUpdateDailyPreview();
  if (isMsg) _calWaPopulateGroupSelect();
}

function calSelectColor(btn){
  _calSelColor=btn.dataset.color;
  document.querySelectorAll('.cal-color-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

/* WhatsApp recipients — Fonnte group picker */

// Populate the group select dropdown whenever the WA section becomes visible
async function _calWaPopulateGroupSelect() {
  const sel = document.getElementById('calWaGroupSelect');
  if (!sel) return;

  // If we already have groups loaded, use them
  if (_waFonnteGroups && _waFonnteGroups.length > 0) {
    _calWaFillGroupSelect(sel, _waFonnteGroups);
    return;
  }

  // Otherwise fetch lazily
  sel.innerHTML = '<option value="">جارٍ تحميل المجموعات…</option>';
  const token = await _getFonnteToken();
  if (!token) {
    sel.innerHTML = '<option value=""><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> أدخل Fonnte Token في الإعدادات</option>';
    return;
  }
  try {
    const res  = await fetch('https://api.fonnte.com/get-whatsapp-group', {
      method: 'POST',
      headers: { 'Authorization': token },
    });
    const data = await res.json();
    if (data.status === false || !data.data?.length) {
      sel.innerHTML = '<option value="">لا توجد مجموعات — انتقل لتبويب المجموعات وحدّث</option>';
      return;
    }
    _waFonnteGroups = data.data;
    _calWaFillGroupSelect(sel, _waFonnteGroups);
  } catch(e) {
    sel.innerHTML = '<option value="">تعذّر الاتصال بـ Fonnte</option>';
  }
}

function _calWaFillGroupSelect(sel, groups) {
  sel.innerHTML =
    '<option value="">— اختر مجموعة —</option>' +
    groups.map(g => `<option value="${g.id}" data-name="${g.name}">${g.name}</option>`).join('');
}

function calWaAddSelectedGroup() {
  const sel = document.getElementById('calWaGroupSelect');
  if (!sel || !sel.value) { toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> اختر مجموعة أولاً'); return; }
  const id   = sel.value;
  const name = sel.selectedOptions[0]?.dataset?.name || sel.selectedOptions[0]?.text || id;
  // Avoid duplicates
  if (_calWaRows.find(r => r.phone === id)) { toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> هذه المجموعة مضافة بالفعل'); return; }
  _calWaRows.push({ name, phone: id, isGroup: true });
  _renderCalWaRows();
  sel.value = ''; // reset
  toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تمت إضافة: ${name}`);
}

function calWaAddRow(){ _calWaRows.push({name:'',phone:''}); _renderCalWaRows(); }
function _renderCalWaRows(){
  const el=document.getElementById('calWaRecipients');
  if(!el)return;
  if(!_calWaRows.length){
    el.innerHTML='<div class="cal-wa-empty">لا يوجد مستلمون بعد</div>';
    return;
  }
  el.innerHTML=_calWaRows.map((r,i)=>{
    if(r.isGroup){
      // Group — show as a read-only chip
      return `
        <div class="cal-wa-row cal-wa-row-group">
          <span class="cal-wa-group-icon ui-ic ic-blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
          <div class="cal-wa-group-info">
            <span class="cal-wa-group-name">${r.name||'مجموعة'}</span>
            <span class="cal-wa-group-id" dir="ltr">${r.phone}</span>
          </div>
          <button class="wa-rec-del" onclick="_calWaRows.splice(${i},1);_renderCalWaRows()" title="إزالة"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>`;
    }
    return `
      <div class="cal-wa-row" data-row-idx="${i}">
        <input type="text" class="cal-wa-name"  placeholder="الاسم" value="${r.name||''}" onchange="_calWaRows[${i}].name=this.value" />
        <input type="text" class="cal-wa-phone" placeholder="رقم الواتساب" value="${r.phone||''}" dir="ltr" onchange="_calWaRows[${i}].phone=this.value" />
        <button class="wa-rec-del" onclick="_calWaRows.splice(${i},1);_renderCalWaRows()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>`;
  }).join('');
}

/* Save / Delete */
let _calSaving = false;
async function saveCalEvent(){
  if (_calSaving) return;
  _calSaving = true;
  const saveBtn = document.getElementById('calSaveBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ الحفظ…'; }
  try {
  const id=document.getElementById('calEventId').value;
  const title=document.getElementById('calEventTitle').value.trim();
  const date=document.getElementById('calEventDate').value;
  if(!title) { _calSaving=false; if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='حفظ';} return toast('يرجى إدخال عنوان الحدث'); }
  if(!date)  { _calSaving=false; if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='حفظ';} return toast('يرجى اختيار التاريخ'); }
  // Warn if message type but past date
  if(_calSelType==='message' && date < todayISO()) {
    if(!confirm(`تاريخ الرسالة (${date}) في الماضي — لن تُرسَل. هل تريد الحفظ فقط بدون إرسال؟`)) {
      _calSaving=false; if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='حفظ';} return;
    }
  }
  // Warn if message type but no recipients
  if(_calSelType==='message') {
    // Sync only manual rows (group rows already have their phone in _calWaRows)
    document.querySelectorAll('#calWaRecipients .cal-wa-row:not(.cal-wa-row-group)').forEach((row,i)=>{
      const idx = parseInt(row.dataset.rowIdx ?? i);
      if(!_calWaRows[idx]) _calWaRows[idx] = {};
      _calWaRows[idx].phone = row.querySelector('.cal-wa-phone')?.value?.trim() || '';
    });
    const validTargets = _calWaRows.filter(r=>r.phone);
    if(!validTargets.length) { _calSaving=false; if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='حفظ';} return toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> أضف مستلماً واحداً على الأقل للرسالة'); }
    if(!document.getElementById('calWaMessage').value.trim()) { _calSaving=false; if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='حفظ';} return toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> أدخل نص الرسالة'); }
  }
  // Final sync — only update manual rows, preserve group rows as-is
  document.querySelectorAll('#calWaRecipients .cal-wa-row:not(.cal-wa-row-group)').forEach((row,i)=>{
    const idx = parseInt(row.dataset.rowIdx ?? i);
    if(!_calWaRows[idx]) _calWaRows[idx] = {};
    _calWaRows[idx].name  = row.querySelector('.cal-wa-name')?.value?.trim()  || '';
    _calWaRows[idx].phone = row.querySelector('.cal-wa-phone')?.value?.trim() || '';
  });
  const useSpecific = _calSelType==='message' && !!(document.getElementById('calUseSpecificDays')?.checked) && _specificDates.length > 0;
  const dailyRepeat = _calSelType==='message' && !useSpecific && !!(document.getElementById('calDailyRepeat')?.checked);
  // For non-message types use the inline multi-day picker
  const useEventDates = _calSelType !== 'message' && _eventDates.length > 0;
  const endDate = _calSelType === 'message'
    ? (document.getElementById('calEventEndDate').value || null)
    : (useEventDates && _eventDates.length > 1 ? _eventDates[_eventDates.length-1] : null);
  // For non-message types: use inline picker dates; first date is the canonical `date`
  const finalDate = (useEventDates ? _eventDates[0] : null) || date;
  const payload={
    title,
    date:          finalDate,
    endDate,
    time:          document.getElementById('calEventTime').value||null,
    repeat:        document.getElementById('calEventRepeat').value||null,
    type:          _calSelType,
    note:          document.getElementById('calEventNote').value.trim(),
    color:         _calSelColor,
    dailyRepeat,
    specificDates: useEventDates ? _eventDates : (useSpecific ? _specificDates : null),
    waMessage:     _calSelType==='message' ? document.getElementById('calWaMessage').value.trim() : null,
    waTargets:     _calSelType==='message' ? _calWaRows.filter(r=>r.phone) : null,
  };
  if(id){
    const r = await apiFetch(`/calendar/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if (payload.type === 'message' && payload.waTargets?.length) {
      const sr = r?.scheduleResult;
      if (sr?.ok)    toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم تحديث الحدث وإعادة جدولة الرسالة على Fonnte`);
      else if (sr)   { toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> تم تحديث الحدث لكن فشل إعادة الجدولة: ${sr.error||'تحقق من الـ Token'}`); showWaFailNotif('رسالة مجدولة', 1, sr.error || 'تحقق من الـ Token'); }
      else           toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم تحديث الحدث');
    } else {
      toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم تحديث الحدث');
    }
  } else {
    const r = await apiFetch('/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if((dailyRepeat || useSpecific) && r?.ids?.length>1) {
      const scheduled = r.scheduleResults?.filter(s=>s.ok).length || 0;
      const failed    = r.scheduleResults?.filter(s=>!s.ok).length || 0;
      if(scheduled>0) toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم جدولة ${r.ids.length} رسالة على Fonnte (${scheduled} مجدول${failed>0?', <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> '+failed+' فشل':''})`);
      else if(failed>0) { toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> تم حفظ الأحداث لكن فشل الجدولة على Fonnte`); showWaFailNotif('رسائل مجدولة', failed, 'فشل الجدولة على Fonnte'); }
      else toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم جدولة ${r.ids.length} رسالة`);
    } else if(_calSelType==='message') {
      const sr = r?.scheduleResults?.[0];
      if(sr?.ok)    toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم جدولة الرسالة على Fonnte — ستُرسَل يوم ${payload.date}`);
      else if(sr)   { toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> تم حفظ الحدث لكن فشل الجدولة على Fonnte: ${sr.error||'تحقق من الـ Token'}`); showWaFailNotif('رسالة مجدولة', 1, sr.error || 'تحقق من الـ Token'); }
      else          toast('<span data-toast="ok"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span> تم حفظ الحدث');
    } else {
      toast('<span data-toast="ok"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span> تم حفظ الحدث');
    }
  }
  closeModal('calEventModal');
  await loadAll();
  renderCalendar();
  refreshNotifBadge();
  _waMaybeRefreshScheduled(); // refresh WA scheduled tab if open
  } finally {
    _calSaving = false;
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'حفظ'; }
  }
}

async function deleteCalEvent(id){
  const ev = _calAllEvents.find(e=>e.id===id);
  let deleteAll = false;
  if(ev?.groupId){
    const groupSize = _calAllEvents.filter(e=>e.groupId===ev.groupId).length;
    if(groupSize>1){
      const choice = confirm(`هذا الحدث جزء من سلسلة مكوّنة من ${groupSize} رسالة يومية.

• موافق = حذف السلسلة كاملة
• إلغاء = حذف هذا الحدث فقط`);
      if(choice===null) return;
      deleteAll = choice;
    } else if(!confirm('هل تريد حذف هذا الحدث؟')) return;
  } else if(!confirm('هل تريد حذف هذا الحدث؟')) return;

  const url = deleteAll ? `/calendar/${id}?all=1` : `/calendar/${id}`;
  await apiFetch(url,{method:'DELETE'});
  toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> تم حذف الحدث' + (deleteAll?' والسلسلة كاملة':''));
  await loadAll();
  calCloseDayPanel();
  renderCalendar();
}

// ══════════════════════════════════════════════════════════════════
//  التقويم — New practical features v3
// ══════════════════════════════════════════════════════════════════

/* ── Action menu ────────────────────────────────────────────────── */
function calToggleMenu() {
  const m = document.getElementById('calActionMenu');
  if (!m) return;
  m.classList.toggle('hidden');
  // Close on outside click
  if (!m.classList.contains('hidden')) {
    setTimeout(() => document.addEventListener('click', function _f(e) {
      if (!m.contains(e.target) && e.target.id !== 'calMenuBtn') { m.classList.add('hidden'); document.removeEventListener('click', _f); }
    }), 50);
  }
}

/* ── Search ─────────────────────────────────────────────────────── */
function calToggleSearch() {
  const bar = document.getElementById('calSearchBar');
  if (!bar) return;
  const hidden = bar.classList.toggle('hidden');
  if (!hidden) { document.getElementById('calSearchInput')?.focus(); }
  else { document.getElementById('calSearchResults').innerHTML = ''; document.getElementById('calSearchInput').value = ''; }
}

function calDoSearch(q) {
  const el = document.getElementById('calSearchResults');
  if (!el) return;
  if (!q || q.trim().length < 1) { el.innerHTML = ''; return; }
  const hits = _calAllEvents.filter(e =>
    (e.title||'').includes(q) || (e.note||'').includes(q) || (e.waMessage||'').includes(q)
  ).slice(0, 12);
  if (!hits.length) { el.innerHTML = '<div class="cal-search-empty">لا نتائج</div>'; return; }
  el.innerHTML = hits.map(e => {
    const color = e.color || CAL_TYPE_COLOR[e.type] || '#2563EB';
    const d = new Date(e.date+'T00:00:00');
    const dateStr = `${toHijri(e.date).day} ${HIJRI_MONTHS[toHijri(e.date).month]}`;
    return `<div class="cal-search-item" onclick="calGoToDate('${e.date}')">
      <span class="cal-search-dot" style="background:${color}"></span>
      <div class="cal-search-item-body">
        <div class="cal-search-item-title">${e.title}</div>
        <div class="cal-search-item-date">${dateStr} · ${CAL_TYPE_LABEL[e.type]||e.type}</div>
      </div>
    </div>`;
  }).join('');
}

function calGoToDate(iso) {
  const h = toHijri(iso);
  _calYear = h.year; _calMonth = h.month;
  document.getElementById('calSearchBar')?.classList.add('hidden');
  renderCalendar().then(() => calOpenDay(iso));
}

/* ── Export to Excel ────────────────────────────────────────────── */
async function calExportExcel() {
  const year = _calYear;
  toast('<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ إنشاء ملف Excel…');
  try {
    const res = await fetch(`/api/calendar/export?year=${year}`);
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `تقويم-${year}هـ.xlsx`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم تصدير تقويم ${year}هـ`);
  } catch(e) { toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> فشل التصدير: ' + e.message); }
}

/* ── Print month ────────────────────────────────────────────────── */
function calPrint() {
  const label   = document.getElementById('calMonthLabel')?.textContent || '';
  const gridEl  = document.getElementById('calGrid');
  const dowEl   = document.querySelector('.cal-dow-header');
  if (!gridEl) return;
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html dir="rtl"><head>
    <meta charset="UTF-8"><title>تقويم — ${label}</title>
    <style>
      * { box-sizing: border-box; margin:0; padding:0; font-family: Arial, sans-serif; }
      body { padding: 20px; background: white; }
      h1 { text-align: center; font-size: 22px; margin-bottom: 12px; color: #1D4ED8; }
      .dow { display: grid; grid-template-columns: repeat(7,1fr); background: #1D4ED8; border-radius: 8px 8px 0 0; }
      .dow div { text-align: center; padding: 8px; color: white; font-size: 11px; font-weight: 700; }
      .dow .fri { color: #FDE68A; }
      .grid { display: grid; grid-template-columns: repeat(7,1fr); border: 1px solid #E2E8F0; }
      .cell { min-height: 80px; border-right: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0; padding: 5px; font-size: 11px; }
      .cell:nth-child(7n) { border-right: none; }
      .cell-hijri { font-size: 15px; font-weight: 800; display: block; }
      .cell-greg  { font-size: 9px; color: #64748B; float: left; }
      .cell-fri { background: #FFFBEB; }
      .cell-hol { background: #FEF2F2; }
      .cell-today { background: #EFF6FF; box-shadow: inset 0 0 0 2px #2563EB; }
      .chip { display: block; font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 3px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .empty { background: #F8FAFC; }
      @page { size: A4 landscape; margin: 15mm; }
    </style></head><body>
    <h1><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${label}</h1>
    <div class="dow">${dowEl ? dowEl.innerHTML.replace(/cal-fri-hdr/g,'fri') : ''}</div>
    <div class="grid">${gridEl.innerHTML
      .replace(/cal-cell-today/g,'cell-today')
      .replace(/cal-cell-fri\b/g,'cell-fri')
      .replace(/cal-cell-hol\b/g,'cell-hol')
      .replace(/cal-cell-empty/g,'cell empty')
      .replace(/cal-cell\b/g,'cell')
      .replace(/cal-cell-hijri/g,'cell-hijri')
      .replace(/cal-cell-greg/g,'cell-greg')
      .replace(/cal-cell-head/g,'')
      .replace(/cal-chips|cal-chip-more|cal-hol-badge/g,'')
      .replace(/cal-chip/g,'chip')
    }</div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

/* ── Daily repeat preview ───────────────────────────────────────── */
function calUpdateDailyPreview() {
  const isMsg     = _calSelType === 'message';
  const startDate = document.getElementById('calEventDate')?.value;
  const endDate   = document.getElementById('calEventEndDate')?.value;
  const drSection = document.getElementById('calDailyRepeatSection');
  const preview   = document.getElementById('calDailyPreview');
  const checked   = document.getElementById('calDailyRepeat')?.checked;

  // Show daily repeat toggle only for messages with an end date
  const showToggle = isMsg && startDate && endDate && endDate > startDate;
  drSection?.classList.toggle('hidden', !showToggle);

  if (!showToggle || !checked || !preview) { preview?.classList.add('hidden'); return; }

  // Count days in range
  const s = new Date(startDate+'T00:00:00'), e = new Date(endDate+'T00:00:00');
  let days = 0;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate()+1)) days++;

  const saveBtn = document.getElementById('calSaveBtn');
  if (saveBtn) saveBtn.textContent = `حفظ (${days} رسالة)`;

  preview.classList.remove('hidden');
  preview.innerHTML = `
    <div class="cal-daily-info">
      <span class="cal-daily-count">${days}</span>
      <span>رسالة ستُجدول — واحدة لكل يوم من ${formatDateDisplay(startDate)} حتى ${formatDateDisplay(endDate)}</span>
    </div>
    <div class="cal-daily-note"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> ستظهر كل رسالة في يومها على التقويم، ويمكن حذفها مجتمعةً أو فرادى لاحقاً</div>`;
}

// Reset save button text when modal closes
const _origCloseModal = typeof closeModal === 'function' ? closeModal : null;

/* ── Week-Off Wizard ────────────────────────────────────────────── */
let _woRows = [];

function openWeekOffWizard() {
  _woRows = [];
  document.getElementById('woStartDate').value  = '';
  document.getElementById('woEndDate').value    = '';
  document.getElementById('woTitle').value      = '';
  document.getElementById('woStartHijri').textContent = '';
  document.getElementById('woEndHijri').textContent   = '';
  document.getElementById('woDaysCount')?.classList.add('hidden');
  document.getElementById('woMsgSection')?.classList.add('hidden');
  document.getElementById('woSendMsg').checked  = false;
  document.getElementById('woMessage').value    = '';
  document.getElementById('woRecipients').innerHTML = '';
  document.getElementById('woRecCount').textContent = '';
  document.getElementById('weekOffModal').classList.remove('hidden');
}

function woCountDays() {
  const s = document.getElementById('woStartDate').value;
  const e = document.getElementById('woEndDate').value;
  const el = document.getElementById('woDaysCount');
  if (!el) return;
  if (!s || !e || e < s) { el.classList.add('hidden'); return; }
  let days = 0, schoolDays = 0;
  const d = new Date(s+'T00:00:00'), end = new Date(e+'T00:00:00');
  while (d <= end) {
    days++;
    if (d.getDay() !== 5) schoolDays++; // exclude Fridays
    d.setDate(d.getDate()+1);
  }
  el.classList.remove('hidden');
  el.innerHTML = `
    <span class="wo-days-num">${days}</span> يوم إجمالاً
    <span style="color:var(--text2)">|</span>
    <span class="wo-days-school">${schoolDays}</span> يوم دراسي سيُوقَف`;
}

function woToggleMsg() {
  const on = document.getElementById('woSendMsg').checked;
  document.getElementById('woMsgSection')?.classList.toggle('hidden', !on);
}

function woAddAllParents() {
  _woRows = (state.students||[])
    .filter(s => s.parentPhone)
    .map(s => ({name: s.name, phone: s.parentPhone}));
  _renderWoRecipients();
  toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم إضافة ${_woRows.length} ولي أمر`);
}

function woAddGroupChat() {
  _woRows.push({ name: 'مجموعة واتساب', phone: '', isGroup: true });
  _renderWoRecipients();
}

function _renderWoRecipients() {
  const el = document.getElementById('woRecipients');
  if (!el) return;
  const chips = _woRows.filter(r => !r.isGroup);
  const groupIdx = _woRows.reduce((acc, r, i) => { if (r.isGroup) acc.push(i); return acc; }, []);
  el.innerHTML =
    chips.slice(0,5).map(r => `<span class="cal-wa-chip">${r.name||r.phone}</span>`).join('') +
    (chips.length > 5 ? `<span class="cal-wa-chip cal-wa-chip-more">+${chips.length-5}</span>` : '') +
    groupIdx.map(i => `
      <div class="cal-wa-row" style="margin-top:6px">
        <input type="text" class="cal-wa-name"  placeholder="اسم المجموعة" value="${_woRows[i].name||''}" onchange="_woRows[${i}].name=this.value" />
        <input type="text" class="cal-wa-phone" placeholder="Group Chat ID (مثال: 120363...@g.us)" value="${_woRows[i].phone||''}" dir="ltr" onchange="_woRows[${i}].phone=this.value" />
        <button class="wa-rec-del" onclick="_woRows.splice(${i},1);_renderWoRecipients()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>`).join('');
  const cnt = document.getElementById('woRecCount');
  if (cnt) cnt.textContent = _woRows.length ? `${_woRows.length} مستلم` : '';
}

async function saveWeekOff() {
  const startDate = document.getElementById('woStartDate').value;
  const endDate   = document.getElementById('woEndDate').value;
  const title     = document.getElementById('woTitle').value.trim();
  const sendMsg   = document.getElementById('woSendMsg').checked;
  const message   = document.getElementById('woMessage').value.trim();

  if (!startDate || !endDate) return toast('يرجى تحديد تاريخ البداية والنهاية');
  if (endDate < startDate)    return toast('تاريخ النهاية يجب أن يكون بعد البداية');
  if (!title)                 return toast('يرجى إدخال اسم الإجازة');
  if (sendMsg && !message)    return toast('يرجى كتابة نص الرسالة');
  if (sendMsg && !_woRows.length) return toast('يرجى إضافة مستلمين للرسالة');

  const btn = document.querySelector('#weekOffModal .btn-primary');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ الحفظ…'; }

  try {
    // 1. Save the off-day range as a single block event
    await apiFetch('/calendar', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ title, date: startDate, endDate, type:'offday', color:'#D97706', note:'' })
    });

    // 2. If daily messages requested, save one per day
    if (sendMsg) {
      const res = await apiFetch('/calendar', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          title: `📢 ${title}`,
          date: startDate, endDate,
          type: 'message', color: '#7C3AED',
          dailyRepeat: true,
          waMessage: message,
          waTargets: _woRows,
          note: `رسالة يومية خلال: ${title}`
        })
      });
      const days = res?.ids?.length || 0;
      toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم جدولة الإجازة + ${days} رسالة يومية`);
    } else {
      toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم جدولة إجازة "${title}"`);
    }

    closeModal('weekOffModal');
    await loadAll();
    renderCalendar();
  } catch(e) {
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> حدث خطأ: ' + (e.message||e));
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> جدولة الإجازة'; }
  }
}

// ════════════════════════════════════════════════════════


/* ── modules/main.js ── */
