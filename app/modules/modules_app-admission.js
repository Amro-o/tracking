// ══════════════════════════════════════════════════════════
//  نظام القبول — modules_app-admission.js
//  يُحمَّل من index.html بعد بقية الوحدات
// ══════════════════════════════════════════════════════════

// ── Global admission state ──────────────────────────────────
let _admissionsData   = [];   // كل الطلبات المحملة
let _admFilterStatus  = 'pending'; // pending | accepted | rejected | all
let _admSearchQ       = '';
let _pendingAdmCount  = 0;    // for notification badge

// ── قائمة الجنسيات ─────────────────────────────────────────
const ADM_NATIONALITIES = [
  'سعودي','يمني','مصري','سوري','فلسطيني','أردني','لبناني','عراقي','سوداني',
  'موريتاني','مغربي','جزائري','تونسي','ليبي','صومالي','جيبوتي','جزر القمر',
  'باكستاني','هندي','بنغلاديشي','أندونيسي','ماليزي','نيجيري','إيراني',
  'تركي','أفغاني','إثيوبي','أريتري','سريلانكي','فلبيني',
  'أمريكي','بريطاني','فرنسي','ألماني','كندي','أسترالي',
  'إماراتي','كويتي','بحريني','قطري','عُماني'
];

// ════════════════════════════════════════════════════════════
//  تحميل الطلبات من الخادم
// ════════════════════════════════════════════════════════════
async function loadAdmissions() {
  try {
    const data = await apiFetch('/admissions');
    _admissionsData  = Array.isArray(data) ? data : [];
    _pendingAdmCount = _admissionsData.filter(r => r.status === 'pending').length;
    _updateAdmNavBadge();
    renderAdmissionList();
  } catch(e) {
    _admissionsData = [];
    _pendingAdmCount = 0;
  }
}

function _updateAdmNavBadge() {
  const badge = document.getElementById('admNavBadge');
  if (!badge) return;
  if (_pendingAdmCount > 0) {
    badge.textContent = _pendingAdmCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// ════════════════════════════════════════════════════════════
//  عرض صفحة الطلبات
// ════════════════════════════════════════════════════════════
function renderAdmissionList() {
  const container = document.getElementById('admissionList');
  if (!container) return;

  // Filter
  let list = [..._admissionsData];
  if (_admFilterStatus !== 'all') list = list.filter(r => r.status === _admFilterStatus);
  if (_admSearchQ) {
    const q = _admSearchQ.toLowerCase();
    list = list.filter(r =>
      (r.fullName    || '').includes(_admSearchQ) ||
      (r.nationalId  || '').includes(_admSearchQ) ||
      (r.grade       || '').includes(_admSearchQ) ||
      (r.parentPhone1|| '').includes(_admSearchQ)
    );
  }

  // Sort newest first
  list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Update tab counts
  const counts = { pending:0, accepted:0, rejected:0, all: _admissionsData.length };
  _admissionsData.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
  ['pending','accepted','rejected','all'].forEach(s => {
    const el = document.getElementById(`admTab_${s}`);
    if (el) {
      const cnt = counts[s];
      el.dataset.count = cnt;
      const badge = el.querySelector('.adm-tab-badge');
      if (badge) badge.textContent = cnt;
    }
  });

  if (list.length === 0) {
    container.innerHTML = `
      <div class="info-banner" style="text-align:center;padding:40px 20px">
        <div style="font-size:36px;margin-bottom:12px">📋</div>
        <div style="font-weight:600;font-size:15px;margin-bottom:6px">لا توجد طلبات</div>
        <div style="color:var(--text2);font-size:13px">
          ${_admFilterStatus==='pending' ? 'لا توجد طلبات انتظار حالياً' : 'لا توجد طلبات في هذا التصنيف'}
        </div>
      </div>`;
    return;
  }

  const STATUS_CFG = {
    pending:  { label:'قيد المراجعة', cls:'adm-status-pending',  icon:'⏳' },
    accepted: { label:'مقبول',        cls:'adm-status-accepted', icon:'✅' },
    rejected: { label:'مرفوض',        cls:'adm-status-rejected', icon:'❌' },
  };

  container.innerHTML = list.map(r => {
    const s    = STATUS_CFG[r.status] || STATUS_CFG.pending;
    const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-SA', {year:'numeric',month:'short',day:'numeric'}) : '—';
    const isPending = r.status === 'pending';
    return `
    <div class="adm-request-card" id="adm_card_${r.id}">
      <div class="adm-req-header">
        <div class="adm-req-avatar">${(r.fullName||'?').charAt(0)}</div>
        <div class="adm-req-info">
          <div class="adm-req-name">${r.fullName || '—'}</div>
          <div class="adm-req-meta">
            <span>${r.grade || '—'}</span>
            <span class="adm-sep">·</span>
            <span>${r.nationality || '—'}</span>
            <span class="adm-sep">·</span>
            <span>رقم الإثبات: ${r.nationalId || '—'}</span>
          </div>
        </div>
        <div class="adm-req-badge ${s.cls}">${s.icon} ${s.label}</div>
      </div>
      <div class="adm-req-body">
        <div class="adm-req-row">
          <span class="adm-req-label">📅 تاريخ الميلاد:</span>
          <span>${r.birthDate || '—'}</span>
        </div>
        <div class="adm-req-row">
          <span class="adm-req-label">🏠 الحي:</span>
          <span>${r.district || '—'}</span>
        </div>
        <div class="adm-req-row">
          <span class="adm-req-label">📖 آخر سورة:</span>
          <span>${r.lastSurah || '—'}</span>
        </div>
        <div class="adm-req-row">
          <span class="adm-req-label">📞 جوال ولي الأمر:</span>
          <span dir="ltr">${r.parentPhone1 || '—'}${r.parentPhone2 ? ' / '+r.parentPhone2 : ''}</span>
        </div>
        ${r.studentPhone ? `<div class="adm-req-row"><span class="adm-req-label">📱 جوال الطالب:</span><span dir="ltr">${r.studentPhone}</span></div>` : ''}
        ${r.email ? `<div class="adm-req-row"><span class="adm-req-label">✉️ البريد:</span><span dir="ltr">${r.email}</span></div>` : ''}
        <div class="adm-req-row" style="color:var(--text2)">
          <span class="adm-req-label">🕐 تاريخ الطلب:</span>
          <span>${date}</span>
        </div>
        ${r.rejectReason ? `<div class="adm-req-row" style="color:var(--error)"><span class="adm-req-label">سبب الرفض:</span><span>${r.rejectReason}</span></div>` : ''}
      </div>
      ${isPending ? `
      <div class="adm-req-actions">
        <button class="btn-success adm-btn-accept" onclick="acceptAdmission('${r.id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:4px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          قبول
        </button>
        <button class="btn-danger adm-btn-reject" onclick="openRejectModal('${r.id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:4px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          رفض
        </button>
        <button class="btn-secondary" onclick="deleteAdmission('${r.id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:4px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          حذف
        </button>
      </div>` : `
      <div class="adm-req-actions">
        <button class="btn-secondary" onclick="deleteAdmission('${r.id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:4px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          حذف
        </button>
      </div>`}
    </div>`;
  }).join('');
}

// ── Filter tabs ────────────────────────────────────────────
function admSetFilter(status) {
  _admFilterStatus = status;
  document.querySelectorAll('.adm-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.filter === status);
  });
  renderAdmissionList();
}

function admSearch(q) {
  _admSearchQ = q;
  renderAdmissionList();
}

// ════════════════════════════════════════════════════════════
//  قبول الطلب — يفتح نافذة تعيين الحلقة
// ════════════════════════════════════════════════════════════
let _pendingAcceptId = null;

function acceptAdmission(id) {
  _pendingAcceptId = id;
  const req = _admissionsData.find(r => r.id === id);
  if (!req) return;

  // Populate class dropdown
  const sel = document.getElementById('admAcceptClass');
  if (sel) {
    sel.innerHTML = '<option value="">— بدون حلقة (يُعيَّن لاحقاً) —</option>' +
      (state.classes || []).map(c =>
        `<option value="${c.id}">${c.name}${c.grade ? ' — '+c.grade : ''}</option>`
      ).join('');
  }

  // Show student name in modal
  const nameEl = document.getElementById('admAcceptStudentName');
  if (nameEl) nameEl.textContent = req.fullName || '—';

  document.getElementById('admAcceptModal').classList.remove('hidden');
}

async function confirmAcceptAdmission() {
  if (!_pendingAcceptId) return;
  const classId = document.getElementById('admAcceptClass')?.value || '';
  const btn = document.querySelector('#admAcceptModal .btn-primary');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ القبول…'; }

  try {
    await apiFetch(`/admissions/${_pendingAcceptId}/accept`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId })
    });
    closeModal('admAcceptModal');
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم قبول الطالب وإضافته إلى قائمة الطلاب');
    await loadAdmissions();
    await loadAll();
    renderStudentList && renderStudentList();
  } catch(e) {
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> حدث خطأ: ' + (e.message || e));
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تأكيد القبول'; }
  }
}

// ════════════════════════════════════════════════════════════
//  رفض الطلب
// ════════════════════════════════════════════════════════════
let _pendingRejectId = null;

function openRejectModal(id) {
  _pendingRejectId = id;
  const req = _admissionsData.find(r => r.id === id);
  const nameEl = document.getElementById('admRejectStudentName');
  if (nameEl) nameEl.textContent = req?.fullName || '—';
  const reasonEl = document.getElementById('admRejectReason');
  if (reasonEl) reasonEl.value = '';
  document.getElementById('admRejectModal').classList.remove('hidden');
}

async function confirmRejectAdmission() {
  if (!_pendingRejectId) return;
  const reason = document.getElementById('admRejectReason')?.value.trim() || '';
  const btn = document.querySelector('#admRejectModal .btn-danger');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ الرفض…'; }

  try {
    await apiFetch(`/admissions/${_pendingRejectId}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    closeModal('admRejectModal');
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> تم رفض الطلب');
    await loadAdmissions();
  } catch(e) {
    toast('حدث خطأ: ' + (e.message || e));
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = 'تأكيد الرفض'; }
  }
}

// ════════════════════════════════════════════════════════════
//  حذف الطلب
// ════════════════════════════════════════════════════════════
async function deleteAdmission(id) {
  if (!confirm('هل تريد حذف هذا الطلب نهائياً؟')) return;
  try {
    await apiFetch(`/admissions/${id}`, { method: 'DELETE' });
    toast('تم حذف الطلب');
    await loadAdmissions();
  } catch(e) {
    toast('حدث خطأ: ' + (e.message || e));
  }
}

// ════════════════════════════════════════════════════════════
//  نافذة تسجيل طالب جديد (من داخل لوحة الإدارة)
// ════════════════════════════════════════════════════════════
let _admNatValue = '';

function openAdmissionFormModal() {
  // Reset form
  ['admf_fullName','admf_nationalId','admf_district','admf_lastSurah',
   'admf_studentPhone','admf_parentPhone1','admf_parentPhone2','admf_email'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const grade = document.getElementById('admf_grade');
  if (grade) grade.value = '';
  const bday = document.getElementById('admf_birthDate');
  if (bday) bday.value = '';
  _admNatValue = '';
  const natDisp = document.getElementById('admf_nationality_display');
  if (natDisp) natDisp.value = '';
  const natHid = document.getElementById('admf_nationality');
  if (natHid) natHid.value = '';
  const agree = document.getElementById('admf_agree');
  if (agree) agree.checked = false;

  // Clear errors
  document.querySelectorAll('#admissionFormModal .fg').forEach(fg => {
    fg.classList.remove('has-error');
    fg.querySelectorAll('input,select').forEach(el => el.classList.remove('error'));
  });
  document.getElementById('admf_agreeBox')?.classList.remove('error-agree');

  document.getElementById('admissionFormModal').classList.remove('hidden');
}

// Nationality dropdown for admin form
let _admNatDropdownOpen = false;

function admfFilterNationalities(q) {
  const filtered = q ? ADM_NATIONALITIES.filter(n => n.includes(q)) : ADM_NATIONALITIES;
  const dd = document.getElementById('admf_natDropdown');
  if (!dd) return;
  dd.innerHTML = filtered.length
    ? filtered.map(n => `<div class="ss-option${n===_admNatValue?' selected':''}" onmousedown="admfSelectNat('${n}')">${n}</div>`).join('')
    : '<div style="padding:10px 13px;color:#94a3b8;font-size:13px">لا توجد نتائج</div>';
  dd.classList.add('open');
}

function admfSelectNat(val) {
  _admNatValue = val;
  const disp = document.getElementById('admf_nationality_display');
  const hid  = document.getElementById('admf_nationality');
  if (disp) disp.value = val;
  if (hid)  hid.value  = val;
  document.getElementById('admf_natDropdown')?.classList.remove('open');
  document.getElementById('fg_admf_nationality')?.classList.remove('has-error');
  document.getElementById('admf_nationality_display')?.classList.remove('error');
}

function admfOpenNatDropdown() {
  admfFilterNationalities(document.getElementById('admf_nationality_display')?.value || '');
}
function admfCloseNatDropdown() {
  setTimeout(() => document.getElementById('admf_natDropdown')?.classList.remove('open'), 200);
}

function toggleAdmAgree() {
  const cb = document.getElementById('admf_agree');
  if (cb) cb.checked = !cb.checked;
  document.getElementById('admf_agreeBox')?.classList.remove('error-agree');
}

async function submitAdmissionForm() {
  let valid = true;

  const required = [
    { fgId:'fg_admf_fullName',    field:'admf_fullName' },
    { fgId:'fg_admf_nationalId',  field:'admf_nationalId' },
    { fgId:'fg_admf_nationality', field:'admf_nationality' },
    { fgId:'fg_admf_district',    field:'admf_district' },
    { fgId:'fg_admf_birthDate',   field:'admf_birthDate' },
    { fgId:'fg_admf_grade',       field:'admf_grade' },
    { fgId:'fg_admf_lastSurah',   field:'admf_lastSurah' },
    { fgId:'fg_admf_parentPhone1',field:'admf_parentPhone1' },
  ];

  required.forEach(({ fgId, field }) => {
    const val = (document.getElementById(field)?.value || '').trim();
    const fg  = document.getElementById(fgId);
    const inp = document.getElementById(field);
    if (!val) {
      if (fg) fg.classList.add('has-error');
      if (inp) inp.classList.add('error');
      valid = false;
    } else {
      if (fg) fg.classList.remove('has-error');
      if (inp) inp.classList.remove('error');
    }
  });

  if (!document.getElementById('admf_agree')?.checked) {
    document.getElementById('admf_agreeBox')?.classList.add('error-agree');
    valid = false;
  }

  if (!valid) {
    const first = document.querySelector('#admissionFormModal .has-error, #admissionFormModal .error-agree');
    if (first) first.scrollIntoView({ behavior:'smooth', block:'center' });
    return;
  }

  const btn = document.querySelector('#admissionFormModal .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الإرسال…'; }

  const data = {
    fullName:     document.getElementById('admf_fullName')?.value.trim(),
    nationalId:   document.getElementById('admf_nationalId')?.value.trim(),
    nationality:  document.getElementById('admf_nationality')?.value.trim(),
    district:     document.getElementById('admf_district')?.value.trim(),
    birthDate:    document.getElementById('admf_birthDate')?.value,
    grade:        document.getElementById('admf_grade')?.value,
    lastSurah:    document.getElementById('admf_lastSurah')?.value.trim(),
    studentPhone: document.getElementById('admf_studentPhone')?.value.trim(),
    parentPhone1: document.getElementById('admf_parentPhone1')?.value.trim(),
    parentPhone2: document.getElementById('admf_parentPhone2')?.value.trim(),
    email:        document.getElementById('admf_email')?.value.trim(),
  };

  try {
    await apiFetch('/admissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    closeModal('admissionFormModal');
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم إضافة طلب التسجيل بنجاح');
    await loadAdmissions();
    // Auto-navigate to admissions page
    if (typeof navigate === 'function') navigate('admissions');
  } catch(e) {
    toast('حدث خطأ: ' + (e.message || e));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'إرسال الطلب'; }
  }
}

// ════════════════════════════════════════════════════════════
//  SSE — استقبال إشعار طلب جديد من الخادم (real-time)
// ════════════════════════════════════════════════════════════
(function _hookAdmissionSSE() {
  // نتأكد أن الدالة تُستدعى بعد تهيئة SSE الأصلي
  const _origOnSSEEvent = window._onSSEAdmission;
  window._onSSEAdmission = function(data) {
    if (typeof _origOnSSEEvent === 'function') _origOnSSEEvent(data);
    _pendingAdmCount++;
    _updateAdmNavBadge();
    loadAdmissions();
    refreshNotifBadge && refreshNotifBadge();
    // إشعار مرئي فوري
    _showAdmissionPopupNotif(data?.fullName || 'طالب جديد');
  };
})();

function _showAdmissionPopupNotif(name) {
  const existing = document.getElementById('admNewNotifPopup');
  if (existing) existing.remove();

  const notif = document.createElement('div');
  notif.id = 'admNewNotifPopup';
  notif.style.cssText = [
    'position:fixed;top:20px;left:50%;transform:translateX(-50%);',
    'background:#1e293b;color:#fff;border-radius:12px;padding:14px 20px;',
    'font-size:14px;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,0.3);',
    'z-index:9999;display:flex;align-items:center;gap:12px;min-width:280px;',
    'cursor:pointer;animation:slideDown 0.3s ease;border-right:4px solid #f59e0b;'
  ].join('');
  notif.title = 'انتقل إلى طلبات القبول';
  notif.onclick = () => { notif.remove(); if(typeof navigate==='function') navigate('admissions'); };
  notif.innerHTML = `
    <span style="font-size:20px">📋</span>
    <div style="flex:1">
      <div>طلب تسجيل جديد</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px;font-weight:400">${name}</div>
    </div>`;
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  closeBtn.style.cssText = 'background:none;border:none;color:#94a3b8;cursor:pointer;';
  closeBtn.onclick = (e) => { e.stopPropagation(); notif.remove(); };
  notif.appendChild(closeBtn);
  document.body.appendChild(notif);
  setTimeout(() => { if (notif.parentNode) notif.remove(); }, 8000);
}

// ════════════════════════════════════════════════════════════
//  رابط التسجيل العام — نسخ للحافظة
// ════════════════════════════════════════════════════════════
function copyAdmissionLink() {
  const link = window.location.origin + '/admission';
  navigator.clipboard.writeText(link).then(() => {
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم نسخ رابط التسجيل');
  }).catch(() => {
    prompt('رابط التسجيل:', link);
  });
}

function openAdmissionLink() {
  window.open('/admission', '_blank');
}

// ════════════════════════════════════════════════════════════
//  Init — يُستدعى عند التنقل إلى صفحة الطلبات
// ════════════════════════════════════════════════════════════
async function initAdmissionsPage() {
  await loadAdmissions();
  // Set default tab to pending
  admSetFilter('pending');
}

// ════════════════════════════════════════════════════════════
//  لافتة رابط التسجيل
// ════════════════════════════════════════════════════════════
function _updateAdmissionLinkBanner() {
  const urlEl = document.getElementById('admLinkUrl');
  if (urlEl) urlEl.textContent = window.location.origin + '/admission';
}
