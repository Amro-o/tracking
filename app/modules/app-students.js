// ══════════════════════════════════════════════════════════

//  مزامنة / نسخ احتياطي
// ══════════════════════════════════════════════════════════
function exportData() {
  window.open(`${API}/sync/export`,'_blank');
  toast('⬇ جارٍ التصدير…');
  _saveBackupTs();
  setTimeout(refreshNotifBadge, 500);
}

async function initSyncPage() {
  await checkExeStatus();
  // Load Telegram settings
  const s = await apiFetch('/settings');
  if (s) {
    const tgBot  = document.getElementById('settTgBotToken');
    const tgChat = document.getElementById('settTgChatId');
    if (tgBot)  tgBot.value  = s.telegramBotToken || '';
    if (tgChat) tgChat.value = s.telegramChatId   || '';
  }
  syncShowTab('network');
}

function syncShowTab(tab) {
  document.querySelectorAll('.wa-page-tabs .wa-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('#page-sync .wa-tab-panel').forEach(p => p.classList.add('hidden'));
  const el = document.getElementById('syncTab-' + tab);
  if (el) el.classList.remove('hidden');
}

async function checkExeStatus() {
  try {
    const s = await apiFetch('/launcher-status');
    if (!s) return;

    // بطاقة الحالة
    const card = document.getElementById('launcherStatusCard');
    if (card) {
      const ip = s.networkIP;
      card.innerHTML = `
        <div class="launcher-status-row">
          <span class="launcher-status-dot ${s.vbsExists ? 'dot-green' : 'dot-red'}"></span>
          <span>launch.vbs — ${s.vbsExists ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> موجود' : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> غير موجود'}</span>
        </div>
        <div class="launcher-status-row">
          <span class="launcher-status-dot ${s.jsExists ? 'dot-green' : 'dot-red'}"></span>
          <span>launcher.js — ${s.jsExists ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> موجود' : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> غير موجود'}</span>
        </div>
        <div class="launcher-status-row">
          <span class="launcher-status-dot ${s.exeBuilt ? 'dot-green' : 'dot-orange'}"></span>
          <span>ملف .exe — ${s.exeBuilt ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> جاهز للتنزيل' : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> لم يُبنَ بعد (شغّل build-exe.bat)'}</span>
        </div>
        ${ip ? `<div class="launcher-status-row" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
          <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> رابط الشبكة للجوال:</span>
          <code class="launcher-ip-code" onclick="copyNetworkLink('http://${ip}:${s.port}')">http://${ip}:${s.port} <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg></code>
        </div>` : ''}
      `;
    }

    // زر تنزيل exe
    const exeBtn = document.getElementById('exeBtnArea');
    const exeDesc = document.getElementById('exeCardDesc');
    if (exeBtn) {
      if (s.exeBuilt) {
        exeBtn.innerHTML = `<a class="btn-primary launcher-dl-btn" href="/api/download/exe" download>⬇ تنزيل .exe</a>`;
        if (exeDesc) exeDesc.textContent = 'ملف .exe جاهز — يعمل بنقرة واحدة بدون Node.js';
        document.getElementById('launcherExeCard')?.classList.add('launcher-card-ready');
      } else {
        exeBtn.innerHTML = `<a class="btn-secondary launcher-dl-btn" href="/api/download/build-bat" download="build-exe.bat">⬇ build-exe.bat</a>`;
      }
    }
  } catch(e) { console.warn('Launcher status error:', e); }
}

async function copyNetworkLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> تم نسخ الرابط: ' + url);
  } catch(e) {
    toast('الرابط: ' + url);
  }
}

async function importData() {
  const file     = document.getElementById('importFile').files[0]; if (!file) return;
  const statusEl = document.getElementById('importStatus');
  statusEl.textContent = 'جارٍ الاستيراد…'; statusEl.style.color = 'var(--text2)';
  try {
    const bundle = JSON.parse(await file.text());
    const res    = await apiFetch('/sync/import', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(bundle) });
    if (res?.ok) {
      statusEl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم الاستيراد بنجاح! تم دمج البيانات.';
      statusEl.style.color = 'var(--success)'; await loadAll();
    } else {
      statusEl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> فشل الاستيراد. تحقق من صيغة الملف.';
      statusEl.style.color = 'var(--error)';
    }
  } catch(e) {
    statusEl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ملف غير صالح. تأكد من أنه ملف JSON صحيح.';
    statusEl.style.color = 'var(--error)';
  }
  document.getElementById('importFile').value = '';
}

// ══════════════════════════════════════════════════════════

//  نسخ احتياطي وإعادة ضبط البيانات
// ════════════════════════════════════════════════════════

const RESET_LABELS = {
  attendance:  'سجل حضور الطلاب',
  teacherLog:  '⏱ حضور المعلمين والإداريين',
  quran:       'تقدم القرآن الكريم',
  waLog:       'سجل رسائل واتساب',
  calendar:    'أحداث التقويم',
  holidays:    'الإجازات الرسمية',
  students:    'الطلاب',
  teachers:    'المعلمون',
  classes:     'الحلقات',
  notices:     'التعهدات والإنذارات',
  waGroups:    'مجموعات واتساب',
  waDismissed: 'الرسائل المتجاهَلة',
  accounts:    '🔐 الحسابات (يُبقي المدير الافتراضي)',
};

function resetGetSelected() {
  return [...document.querySelectorAll('.reset-cb:checked')].map(cb => cb.dataset.key);
}

function resetUpdateCount() {
  const selected = resetGetSelected();
  const countEl  = document.getElementById('resetSelCount');
  const btn      = document.getElementById('resetConfirmBtn');
  if (countEl) countEl.textContent = selected.length ? `تم اختيار ${selected.length} عنصر` : '';
  if (btn)     btn.disabled = selected.length === 0;
}

function resetSelectAll() {
  document.querySelectorAll('.reset-cb').forEach(cb => { cb.checked = true; });
  resetUpdateCount();
}

function resetClearAll() {
  document.querySelectorAll('.reset-cb').forEach(cb => { cb.checked = false; });
  resetUpdateCount();
}

function openResetConfirmModal() {
  const selected = resetGetSelected();
  if (!selected.length) return;
  const listEl = document.getElementById('resetConfirmList');
  if (listEl) {
    listEl.innerHTML = selected.map(k => `<div><span class="ui-ic ic-red" style="vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span> ${RESET_LABELS[k] || k}</div>`).join('');
  }
  document.getElementById('resetConfirmModal').classList.remove('hidden');
}

async function executeReset() {
  const selected = resetGetSelected();
  if (!selected.length) return;
  closeModal('resetConfirmModal');

  const body = {};
  selected.forEach(k => body[k] = true);

  const statusEl = document.getElementById('resetStatus');
  if (statusEl) { statusEl.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ الحذف…'; statusEl.className = 'status-msg'; }

  const res = await apiFetch('/settings/reset', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res?.ok) {
    const labels = (res.cleared || selected).map(k => RESET_LABELS[k] || k).join('، ');
    if (statusEl) { statusEl.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم الحذف بنجاح: ${labels}`; statusEl.className = 'status-msg status-success'; }
    toast('<span data-toast="ok"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span> تم الحذف بنجاح');
    resetClearAll();
    // Reload state
    await loadData();
    renderStudentList?.();
    renderCheckinList?.();
  } else {
    if (statusEl) { statusEl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> تعذّر الحذف — حاول مرة أخرى'; statusEl.className = 'status-msg status-error'; }
    toast('<span data-toast="err"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></span> تعذّر الحذف');
  }
}

function openFullResetModal() {
  const inp = document.getElementById('fullResetConfirmInput');
  if (inp) inp.value = '';
  document.getElementById('fullResetModal').classList.remove('hidden');
}

async function executeFullReset() {
  const inp = document.getElementById('fullResetConfirmInput');
  if (!inp || inp.value.trim() !== 'حذف') {
    toast('<span data-toast="warn"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span> اكتب كلمة "حذف" للتأكيد');
    inp?.focus();
    return;
  }
  closeModal('fullResetModal');

  const statusEl = document.getElementById('resetStatus');
  if (statusEl) { statusEl.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ إعادة الضبط…'; statusEl.className = 'status-msg'; }

  const res = await apiFetch('/settings/reset', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ everything: true }),
  });

  if (res?.ok) {
    if (statusEl) { statusEl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تمت إعادة الضبط الكاملة بنجاح'; statusEl.className = 'status-msg status-success'; }
    toast('<span data-toast="ok"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span> تمت إعادة الضبط الكاملة');
    await loadData();
    renderStudentList?.();
    renderCheckinList?.();
    navigate('dashboard');
  } else {
    if (statusEl) { statusEl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> تعذّرت إعادة الضبط'; statusEl.className = 'status-msg status-error'; }
    toast('<span data-toast="err"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></span> تعذّرت إعادة الضبط');
  }
}

// ════════════════════════════════════════════════════════


/* ── modules/students.js ── */
//  استيراد الطلاب من Excel
// ══════════════════════════════════════════════════════════
let _importData = { headers:[], rows:[], mapping:{}, defaultClass:'' };

const FIELD_ALIASES = {
  name:        ['اسم الطالب','الاسم','الاسم الكامل','name','student name','student_name'],
  studentId:   ['رقم الطالب','الرقم','رقم','studentid','id','student id','رقم المتدرب'],
  parentPhone: ['هاتف ولي الأمر','هاتف','الهاتف','جوال','parentphone','phone','parent phone','رقم الجوال'],
  birthday:    ['تاريخ الميلاد','الميلاد','birthday','birth date','birthdate'],
};

function autoDetectMapping(headers) {
  const mapping = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const match = headers.find(h =>
      aliases.some(a => h.trim().toLowerCase() === a.toLowerCase())
    );
    if (match) mapping[field] = match;
  }
  return mapping;
}

function openBulkImportModal() {
  resetImport();
  // populate default class dropdown
  const sel = document.getElementById('importDefaultClass');
  if (sel) {
    sel.innerHTML = '<option value="">— لا تُعيَّن حلقة —</option>';
    state.classes.forEach(c => {
      const o = document.createElement('option'); o.value=c.id; o.textContent=c.name; sel.appendChild(o);
    });
  }
  setupImportDragDrop();
  document.getElementById('bulkImportModal').classList.remove('hidden');
}

function closeBulkImport() {
  document.getElementById('bulkImportModal').classList.add('hidden');
  resetImport();
}

function resetImport() {
  _importData = { headers:[], rows:[], mapping:{}, defaultClass:'' };
  document.getElementById('importStep1').classList.remove('hidden');
  document.getElementById('importStep2').classList.add('hidden');
  document.getElementById('importStep3').classList.add('hidden');
  document.getElementById('importConfirmBtn').classList.add('hidden');
  // Clone the file input to clear its value AND allow re-selecting the same file
  const inp = document.getElementById('importExcelFile');
  if (inp) {
    const fresh = inp.cloneNode(true);
    fresh.value = '';
    inp.parentNode.replaceChild(fresh, inp);
    fresh.addEventListener('change', handleImportFile);
  }
}

function setupImportDragDrop() {
  const zone = document.getElementById('importDropZone');
  if (!zone || zone._dd) return;
  zone._dd = true;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processImportFile(file);
  });
}

async function handleImportFile() {
  const file = document.getElementById('importExcelFile').files[0];
  if (file) processImportFile(file);
}

async function processImportFile(file) {
  const info = document.getElementById('importFileInfo');
  if (info) info.textContent = `📄 ${file.name} (${(file.size/1024).toFixed(0)} KB) — جارٍ التحليل…`;
  document.getElementById('importStep1').classList.add('hidden');
  document.getElementById('importStep2').classList.remove('hidden');

  let data;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API}/students/import-preview`, { method:'POST', body:fd });
    if (!res.ok) throw new Error(`خطأ في الخادم (${res.status})`);
    data = await res.json();
  } catch(e) {
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ' + (e.message || 'تعذر الاتصال بالخادم'));
    resetImport(); return;
  }

  if (!data.ok) {
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ' + (data.error || 'فشل قراءة الملف'));
    resetImport(); return;
  }

  _importData.headers = data.headers;
  _importData.rows    = data.rows;
  _importData.mapping = autoDetectMapping(data.headers);

  if (info) info.textContent = `📄 ${file.name} — ${data.total} صف تم قراءتها`;
  renderMappingGrid();
  renderImportPreview();
  document.getElementById('importConfirmBtn').classList.remove('hidden');

  const note = document.getElementById('importMappingNote');
  if (!_importData.mapping.name) {
    if (note) note.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> لم يتم التعرف على عمود الاسم تلقائياً — يرجى تحديده يدوياً.';
  } else {
    if (note) note.textContent = '';
  }
}

function renderMappingGrid() {
  const grid = document.getElementById('importMappingGrid');
  if (!grid) return;
  const fieldLabels = { name:'اسم الطالب *', studentId:'رقم الطالب', parentPhone:'هاتف ولي الأمر', birthday:'تاريخ الميلاد' };
  grid.innerHTML = Object.entries(fieldLabels).map(([field, label]) => `
    <div class="import-map-row">
      <div class="import-map-field">${label}</div>
      <div class="import-map-arrow">←</div>
      <select class="import-map-select" data-field="${field}" onchange="updateMapping(this)">
        <option value="">— غير محدد —</option>
        ${_importData.headers.map(h =>
          `<option value="${h}" ${_importData.mapping[field]===h?'selected':''}>${h}</option>`
        ).join('')}
      </select>
    </div>
  `).join('');
}

function updateMapping(sel) {
  _importData.mapping[sel.dataset.field] = sel.value || undefined;
  renderImportPreview();
}

function renderImportPreview() {
  const tbl = document.getElementById('importPreviewTable');
  if (!tbl || _importData.rows.length === 0) return;
  const m     = _importData.mapping;
  const preview = _importData.rows.slice(0, 5);
  tbl.innerHTML = `
    <thead><tr>
      <th>الاسم</th><th>الرقم</th><th>هاتف ولي الأمر</th><th>تاريخ الميلاد</th>
    </tr></thead>
    <tbody>${preview.map(row => `<tr>
      <td>${m.name ? (row[m.name]||'—') : '<span style="color:var(--error)">غير محدد</span>'}</td>
      <td>${m.studentId ? (row[m.studentId]||'—') : '—'}</td>
      <td>${m.parentPhone ? (row[m.parentPhone]||'—') : '—'}</td>
      <td>${m.birthday ? (row[m.birthday]||'—') : '—'}</td>
    </tr>`).join('')}</tbody>
  `;
}

async function confirmBulkImport() {
  const m = _importData.mapping;
  if (!m.name) return toast('يرجى تحديد عمود اسم الطالب');
  const classId = document.getElementById('importDefaultClass')?.value || '';
  if (!classId) return toast('<span data-toast="warn"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span> يرجى اختيار الحلقة الافتراضية قبل الاستيراد');

  const students = _importData.rows.map(row => ({
    name:        m.name        ? row[m.name]        : '',
    studentId:   m.studentId   ? row[m.studentId]   : '',
    parentPhone: m.parentPhone ? row[m.parentPhone] : '',
    birthday:    m.birthday    ? row[m.birthday]    : '',
    classId,
  })).filter(s => s.name?.trim());

  if (students.length === 0) return toast('لا توجد بيانات صالحة للاستيراد');

  const btn = document.getElementById('importConfirmBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ الاستيراد…'; }
  await _doImport(students, classId, false);
}

async function _doImport(students, classId, forceAdd) {
  const btn = document.getElementById('importConfirmBtn');

  const res = await apiFetch('/students/import-confirm', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ students, classId, forceAdd }),
  });

  // ── Duplicates found — show warning before proceeding ──
  if (res?.needsConfirm && res.duplicates?.length) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> استيراد الطلاب'; }
    const dupList = res.duplicates.map(d =>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
        <span>${d.name}</span>
        <span style="color:var(--text2)">موجود في: ${d.existingClass}</span>
      </div>`
    ).join('');

    document.getElementById('importStep2').classList.add('hidden');
    document.getElementById('importStep3').classList.remove('hidden');
    const result = document.getElementById('importResult');
    result.innerHTML = `
      <div style="border:1.5px solid var(--warn);border-radius:12px;padding:16px;background:var(--warn-l)">
        <div style="font-size:15px;font-weight:700;color:var(--warn);margin-bottom:8px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> تم اكتشاف ${res.duplicates.length} طالب مكرر</div>
        <div style="margin-bottom:12px;font-size:13px;color:var(--text2)">هؤلاء الطلاب موجودون بالفعل في النظام. اختر كيف تريد المتابعة:</div>
        <div style="max-height:200px;overflow-y:auto;margin-bottom:14px">${dupList}</div>
        ${res.added > 0 ? `<div style="margin-bottom:12px;font-size:13px;color:var(--success)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تمت إضافة ${res.added} طالب جديد بنجاح</div>` : ''}
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn-secondary" onclick="closeBulkImport()" style="flex:1">تجاهل المكررين والإغلاق</button>
          <button class="btn-primary" onclick="_doImport(window._pendingImportStudents, '${classId}', true)" style="flex:1">إضافة المكررين كطلاب جدد</button>
        </div>
      </div>`;
    // Store for potential force-add
    window._pendingImportStudents = students;
    return;
  }

  document.getElementById('importStep2').classList.add('hidden');
  document.getElementById('importStep3').classList.remove('hidden');

  const result = document.getElementById('importResult');
  if (res?.ok) {
    result.innerHTML = `
      <div class="import-success">
        <div class="import-success-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
        <div class="import-success-title">تم الاستيراد بنجاح!</div>
        <div class="import-success-stats">
          <span class="import-stat green">تمت إضافة: <strong>${res.added}</strong> طالب</span>
          ${res.skipped > 0 ? `<span class="import-stat gray">تخطّى (مكرر أو فارغ): <strong>${res.skipped}</strong></span>` : ''}
        </div>
      </div>`;
    await loadAll(); renderStudentList();
    toast('<span data-toast="ok"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span> تم استيراد ' + res.added + ' طالب');
  } else {
    result.innerHTML = `<div class="import-error"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> فشل الاستيراد: ${res?.error||'خطأ غير معروف'}</div>`;
  }

  const footer = document.getElementById('importFooter');
  if (footer) footer.innerHTML = `<button class="btn-primary" onclick="closeBulkImport()">إغلاق</button>`;
}

// ══════════════════════════════════════════════════════════
//  الطلاب
// ══════════════════════════════════════════════════════════
function renderStudentList() {
  const search  = document.getElementById('studentSearch')?.value?.toLowerCase() || '';
  const classId = document.getElementById('studentClassFilter')?.value || '';
  const filter  = document.getElementById('studentClassFilter');
  if (filter) {
    const cur = filter.value;
    filter.innerHTML = '<option value="">كل الحلقات</option>';
    [...visibleClasses()].sort((a, b) => a.name.localeCompare(b.name, 'ar')).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.name;
      if (c.id === cur) opt.selected = true;
      filter.appendChild(opt);
    });
  }
  let students = visibleStudents();
  if (search)  students = students.filter(s => s.name.toLowerCase().includes(search) || (s.studentId||'').toLowerCase().includes(search));
  if (classId) students = students.filter(s => s.classId === classId);

  // Sort
  const sortBy = document.getElementById('studentSort')?.value || 'name_asc';
  if (sortBy === 'age' || sortBy === 'age_desc') {
    const dir = sortBy === 'age_desc' ? 1 : -1;
    students = [...students].sort((a, b) => {
      if (!a.birthday && !b.birthday) return 0;
      if (!a.birthday) return 1;
      if (!b.birthday) return -1;
      return dir * b.birthday.localeCompare(a.birthday);
    });
  } else {
    const dir = sortBy === 'name_desc' ? -1 : 1;
    students = [...students].sort((a, b) =>
      dir * a.name.localeCompare(b.name, 'ar', { sensitivity: 'base', numeric: true })
    );
  }
  const list = document.getElementById('studentList');
  list.innerHTML = '';
  if (students.length === 0) {
    list.innerHTML = '<div class="info-banner">لا يوجد طلاب. أضف طالبًا بالضغط على زر +</div>'; return;
  }
  students.forEach(s => {
    const cls  = state.classes.find(c => c.id === s.classId);
    const card = document.createElement('div');
    const inBulk = _studentBulkMode;
    card.className = 'list-card' + (inBulk ? ' list-card-selectable' : '');
    card.dataset.studentId = s.id;
    if (inBulk) {
      const checked = _studentBulkSelected.has(s.id);
      card.classList.toggle('list-card-selected', checked);
      card.innerHTML = `
        <div class="bulk-checkbox">${checked ? '☑' : '☐'}</div>
        <div class="list-card-avatar">${s.photo?`<img src="${s.photo}" alt="${s.name}" onerror="this.style.display='none'" />`:'👤'}</div>
        <div class="list-card-body" style="cursor:default">
          <div class="list-card-name">${s.name}</div>
          <div class="list-card-sub">${s.studentId||'—'} · ${cls?.name||'بدون حلقة'}</div>
        </div>`;
      card.onclick = () => studentBulkToggle(s.id);
    } else {
      card.innerHTML = `
        <div class="list-card-avatar">${s.photo?`<img src="${s.photo}" alt="${s.name}" onerror="this.style.display='none'" />`:'👤'}</div>
        <div class="list-card-body" onclick="viewStudent('${s.id}')">
          <div class="list-card-name">${s.name}</div>
          <div class="list-card-sub">${s.studentId||'—'} · ${cls?.name||'بدون حلقة'}</div>
        </div>
        <div class="list-card-actions">
          <button class="btn-icon" onclick="openStudentModal('${s.id}')"><span class="ui-ic ic-blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span></button>
          <button class="btn-icon" onclick="deleteStudent('${s.id}')"><span class="ui-ic ic-red"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span></button>
        </div>`;
    }
    list.appendChild(card);
  });
}

// ── Build the "change today's attendance" HTML for the profile ──
// Uses data attributes + delegated listener to avoid innerHTML onclick escaping issues
function _buildAttChangeSectionHTML(studentId, classId, history) {
  const todayRec  = history.find(h => h.date === todayISO());
  const curStatus = todayRec ? todayRec.status : null;
  const statusMap = { Present:'حاضر', Absent:'غائب', Late:'متأخر', Excused:'بعذر', Holiday:'إجازة' };
  const bc        = st => ({ Present:'present', Absent:'absent', Late:'late', Excused:'excused', Holiday:'holiday' }[st]||'default');

  const statusBadge = curStatus
    ? '<span class="badge badge-' + bc(curStatus) + '">' + (statusMap[curStatus]||curStatus) + '</span>'
    : '<span style="color:var(--text2);font-size:13px">لم يُسجَّل اليوم</span>';

  // Use data attributes — no escaping nightmares
  const mkBtn = (st, icon, label) => {
    const active = curStatus === st ? ' active' : '';
    return '<button class="sp-att-btn sp-att-' + st.toLowerCase() + active + '" '
         + 'data-student-id="' + studentId + '" data-class-id="' + classId + '" data-status="' + st + '">'
         + icon + ' ' + label + '</button>';
  };

  return '<div class="sp-att-today-status"><span>حالة اليوم: </span>' + statusBadge + '</div>'
       + '<div class="sp-att-change-btns">'
       + mkBtn('Present', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>', 'حاضر')
       + mkBtn('Late',    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', 'متأخر')
       + mkBtn('Absent',  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>', 'غائب')
       + mkBtn('Excused', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>', 'بعذر')
       + '</div>'
       + '<div id="spAttChangeResult_' + studentId + '" class="sp-qa-result hidden"></div>';
}

// Delegated click handler — set once after modal opens
function _initAttChangeDelegation(studentId) {
  const box = document.getElementById('spAttChangeBox_' + studentId);
  if (!box) return;
  box.addEventListener('click', async function(e) {
    const btn = e.target.closest('.sp-att-btn[data-status]');
    if (!btn) return;
    const sid     = btn.dataset.studentId;
    const cid     = btn.dataset.classId;
    const status  = btn.dataset.status;
    await changeStudentAttStatus(sid, cid, status);
  });
}

async function viewStudent(id) {
  const s = await apiFetch(`/students/${id}`);
  if (!s) return;
  const cls     = state.classes.find(c => c.id === s.classId);
  const history = (s.history||[]).slice(0,30);
  const qpList  = await apiFetch(`/quran-progress?studentId=${id}`);
  const translateStatus = st => ({ Present:'حاضر', Absent:'غائب', Late:'متأخر', Excused:'بعذر', Holiday:'إجازة' }[st]||st);
  const badgeClass      = st => ({ Present:'present', Absent:'absent', Late:'late', Excused:'excused', Holiday:'holiday' }[st]||'default');

  const latestQP = qpList && qpList.length ? qpList[0] : null;
  const qpProgress = latestQP ? formatQPPosition(latestQP) : 'لم يُسجَّل بعد';

  // attendance stats
  const leaves     = s.leaves || [];
  const exitPerms  = leaves.filter(l => l.type === 'Permission');
  const exitCount  = exitPerms.length;
  const notices    = s.notices || [];
  const pledgeCnt  = notices.filter(n => n.type === 'تعهد').length;
  const warnCnt    = notices.filter(n => n.type === 'إنذار').length;
  const totalRecs  = history.length;
  const presentCnt = history.filter(h=>h.status==='Present').length;
  const absentCnt  = history.filter(h=>h.status==='Absent').length;
  const lateCnt    = history.filter(h=>h.status==='Late').length;
  const excusedCnt = history.filter(h=>h.status==='Excused').length;
  const attendRate = totalRecs ? Math.round((presentCnt + excusedCnt) / totalRecs * 100) : '—';

  // today's attendance record (if any)
  const todayRec = history.find(h => h.date === todayISO()) || null;
  const todayStatusLabel = {
    Present: 'حاضر', Absent: 'غائب', Late: 'متأخر', Excused: 'بعذر', Holiday: 'إجازة'
  };
  const todayStatusColor = {
    Present:'#16a34a', Absent:'#dc2626', Late:'#d97706', Excused:'#7c3aed', Holiday:'#0891b2'
  };
  const todayStatusBg = {
    Present:'#f0fdf4', Absent:'#fef2f2', Late:'#fffbeb', Excused:'#faf5ff', Holiday:'#ecfeff'
  };

  document.getElementById('studentDetailBody').innerHTML = `
    <!-- رأس الملف -->
    <div class="sp-hero">
      <div class="sp-avatar">${s.photo ? `<img src="${s.photo}" alt="${s.name}" />` : s.name.charAt(0)}</div>
      <div class="sp-hero-info">
        <div class="sp-name">${s.name}</div>
        <div class="sp-meta">
          ${cls ? `<span class="profile-class">${cls.name}</span>` : ''}
          ${s.studentId ? `<span class="sp-id-chip"># ${s.studentId}</span>` : ''}
        </div>
        ${s.parentPhone ? `<div class="sp-phone"><a href="tel:${s.parentPhone}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> ${s.parentPhone}</a></div>` : ''}
        ${s.birthday    ? `<div class="sp-dob">🎂 ${s.birthday}</div>` : ''}
        ${todayRec ? `<div class="sp-today-status" style="margin-top:6px;display:inline-flex;align-items:center;gap:6px;background:${todayStatusBg[todayRec.status]||'#f3f4f6'};color:${todayStatusColor[todayRec.status]||'#374151'};border:1.5px solid ${todayStatusColor[todayRec.status]||'#d1d5db'}33;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700">
          حضور اليوم: ${todayStatusLabel[todayRec.status] || todayRec.status}
        </div>` : '<div class="sp-today-status" style="margin-top:6px;display:inline-flex;align-items:center;gap:6px;background:#f8fafc;color:#94a3b8;border:1.5px solid #e2e8f0;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600">لم يُسجَّل حضور اليوم</div>'}
      </div>
      <button class="btn-secondary sp-edit-btn" onclick="closeModal('studentDetailModal');openStudentModal('${s.id}')"><span class="ui-ic ic-blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span> تعديل</button>
    </div>

    <!-- غياب بعذر — مرض / طارئ / سفر -->
    <div class="sp-quick-actions">
      <div class="sp-qa-title">تسجيل غياب بعذر</div>
      <div style="font-size:11px;color:#92400E;margin-bottom:10px;margin-top:-4px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> سيُسجَّل الغياب تلقائياً كـ <strong>بعذر</strong> — وليس غائباً</div>
      <div class="sp-qa-grid">
        <button class="sp-qa-btn sp-qa-sick"      onclick="quickLeave('${s.id}','${s.classId}','Sick')">
          <span class="sp-qa-icon">🤒</span><span class="sp-qa-label">مرض</span>
        </button>
        <button class="sp-qa-btn sp-qa-emergency" onclick="quickLeave('${s.id}','${s.classId}','Family')">
          <span class="sp-qa-icon">🚨</span><span class="sp-qa-label">طارئ</span>
        </button>
        <button class="sp-qa-btn sp-qa-travel"    onclick="quickLeave('${s.id}','${s.classId}','Travel')">
          <span class="sp-qa-icon" style="font-size:18px;line-height:1">✈️</span><span class="sp-qa-label">سفر</span>
        </button>
        <button class="sp-qa-btn sp-qa-other"     onclick="quickLeave('${s.id}','${s.classId}','Other')">
          <span class="sp-qa-icon">📝</span><span class="sp-qa-label">أخرى</span>
        </button>
      </div>
      <div class="sp-qa-date-row">
        <label class="sp-qa-date-lbl">التاريخ:</label>
        <input type="date" id="spQuickDate" value="${todayISO()}" onchange="updateHijriLabel(this,'spQuickHijri')" />
        <span class="hijri-label" id="spQuickHijri" style="font-size:11px"></span>
      </div>
      <div id="spQuickResult" class="sp-qa-result hidden"></div>
    </div>

    <!-- إذن خروج — فقط للطلاب الحاضرين -->
    <div class="sp-exit-card">
      <div class="sp-exit-header">
        <span class="sp-exit-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg></span>
        <div>
          <div class="sp-exit-title">إذن خروج
            ${exitCount > 0 ? `<span class="sp-exit-count-badge">${exitCount} سابق</span>` : ''}
          </div>
          <div class="sp-exit-subtitle">يُعطى فقط للطالب الحاضر الذي يغادر مبكراً — لا يُغيِّر حالة الحضور</div>
        </div>
      </div>
      ${todayRec?.status === 'Present' ? `
        <div class="sp-exit-form">
          <input type="text" id="spExitNote" placeholder="سبب الخروج (اختياري)…" class="sp-exit-note-input" />
          <button class="btn-primary sp-exit-btn" onclick="grantExitPermit('${s.id}','${s.classId}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg> منح إذن الخروج
          </button>
        </div>
        ${exitCount > 0 ? `
        <div class="sp-exit-history">
          ${exitPerms.slice(0,3).map(l => `<div class="sp-exit-hist-row"><span class="sp-exit-hist-date">${formatDateDisplay(l.date)}</span><span class="sp-exit-hist-note">${l.reason || '—'}</span></div>`).join('')}
          ${exitCount > 3 ? `<div style="font-size:11px;color:var(--text2);margin-top:4px">+ ${exitCount - 3} أخرى</div>` : ''}
        </div>` : ''}
      ` : `
        <div class="sp-exit-locked">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> الطالب غير حاضر اليوم — إذن الخروج متاح فقط بعد تسجيل الحضور
        </div>
      `}
    </div>

    ${todayRec ? `
    <!-- تعديل حالة الحضور — يظهر فقط إذا سُجِّل الحضور اليوم -->
    <div class="sp-edit-att-card">
      <div class="sp-edit-att-header">
        <span class="sp-edit-att-icon"><span class="ui-ic ic-blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span></span>
        <span class="sp-edit-att-title">تعديل حالة الحضور</span>
      </div>
      <p class="sp-edit-att-desc">اختر التاريخ ثم اضغط «تعديل» لتغيير الحالة.</p>
      <div class="sp-edit-att-row">
        <input type="date" id="spEditAttDate" value="${todayISO()}" />
        <button class="btn-primary sp-edit-att-btn" onclick="openAttEditFromProfile('${s.id}')"><span class="ui-ic ic-blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span> تعديل الحالة</button>
      </div>
    </div>` : ''}

    <!-- إحصائيات الحضور -->
    <div class="sp-stats-grid">
      <div class="sp-stat sp-stat-present"><div class="sp-stat-num">${presentCnt}</div><div class="sp-stat-lbl">حاضر</div></div>
      <div class="sp-stat sp-stat-absent"><div class="sp-stat-num">${absentCnt}</div><div class="sp-stat-lbl">غائب</div></div>
      <div class="sp-stat sp-stat-late"><div class="sp-stat-num">${lateCnt}</div><div class="sp-stat-lbl">متأخر</div></div>
      <div class="sp-stat sp-stat-excused"><div class="sp-stat-num">${excusedCnt}</div><div class="sp-stat-lbl">بعذر</div></div>
      <div class="sp-stat sp-stat-exit"><div class="sp-stat-num">${exitCount}</div><div class="sp-stat-lbl">إذن خروج</div></div>
      ${warnCnt>0?`<div class="sp-stat" style="background:#fef2f2"><div class="sp-stat-num" style="color:#dc2626">${warnCnt}</div><div class="sp-stat-lbl">إنذار</div></div>`:''}
      <div class="sp-stat sp-stat-rate"><div class="sp-stat-num">${attendRate}${attendRate!=='—'?'%':''}</div><div class="sp-stat-lbl">نسبة الحضور</div></div>
    </div>

    <!-- تقدم القرآن -->
    <div class="section-title" style="margin-top:4px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> تقدم القرآن</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;flex-wrap:wrap">
      <div style="font-size:13px;color:var(--text2)">آخر موقع: <strong style="color:var(--primary)">${qpProgress}</strong></div>
      <div style="display:flex;gap:8px">
        <button class="btn-secondary" style="font-size:12px;padding:5px 12px" onclick="window.open('${API}/reports/attendance/student/${s.id}','_blank')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> سجل الحضور Excel</button>
        <button class="btn-secondary" style="font-size:12px;padding:5px 12px" onclick="window.open('${API}/reports/quran/student/${s.id}','_blank')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> تقرير القرآن Excel</button>
        <button class="btn-secondary" style="font-size:12px;padding:5px 12px" onclick="window.open('${API}/print/quran/student/${s.id}','_blank')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> طباعة</button>
        <button class="btn-secondary" style="font-size:12px;padding:5px 12px" onclick="closeModal('studentDetailModal');openProgressModal('${s.id}')">+ تسجيل تقدم</button>
      </div>
    </div>
    ${qpList && qpList.length ? `
    <div style="overflow-x:auto;margin-bottom:16px">
      <table class="history-table">
        <thead><tr><th>التاريخ</th><th>النوع</th><th>الموقع</th><th>التقييم</th><th>ملاحظات</th><th></th></tr></thead>
        <tbody>${qpList.slice(0,10).map(p=>`
          <tr>
            <td style="font-size:12px;direction:rtl">${formatDateDisplay(p.date)}</td>
            <td><span style="font-size:11px">${QURAN_TYPE_AR[p.type]||p.type}</span></td>
            <td style="font-size:12px">${formatQPPosition(p)}</td>
            <td>${p.grade?`<span class="qp-grade-badge" style="background:${qpGradeBg(p.grade)};color:${qpGradeColor(p.grade)}">${p.grade}/10</span>`:'—'}</td>
            <td style="font-size:12px;color:var(--text2)">${p.notes||'—'}</td>
            <td><button class="btn-icon" style="font-size:12px" onclick="deleteProgress('${p.id}','${s.id}')"><span class="ui-ic ic-red"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span></button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '<p style="color:var(--text2);font-size:13px;margin-bottom:16px">لا توجد سجلات تقدم قرآني بعد.</p>'}

    <!-- سجل الحضور -->
    <div class="section-title"><span class="ui-ic ic-blue" style="display:inline-flex;align-items:center;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span> سجل الحضور</div>
    ${history.length===0 ? '<p style="color:var(--text2);font-size:13px">لا توجد سجلات بعد.</p>' : `
    <div style="overflow-x:auto">
      <table class="history-table">
        <thead><tr><th>التاريخ الهجري</th><th>اليوم</th><th>الحالة</th><th>ملاحظات</th><th></th></tr></thead>
        <tbody>${history.map(h => `
          <tr>
            <td style="font-family:var(--mono);font-size:12px;direction:rtl">${formatDateDisplay(h.date)}</td>
            <td>${ARABIC_DAYS[new Date(h.date+'T00:00:00').getDay()]}</td>
            <td><span class="badge badge-${badgeClass(h.status)}">${translateStatus(h.status)}</span></td>
            <td style="font-size:12px;color:var(--text2)">${h.notes||'—'}</td>
            <td><button class="btn-icon att-hist-edit-btn" title="تعديل الحضور"
              onclick="openAttEditModal('${s.id}','${s.classId}',${JSON.stringify(s.name)},'${s.parentPhone||''}','${h.date}','${h.status}','${(h.notes||'')}','${h.id||''}')"><span class="ui-ic ic-blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span></button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`}
    <!-- تعهدات وإنذارات -->
    <div class="section-title" style="margin-top:4px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg> تعهدات وإنذارات</div>
    <div class="sp-notices-toolbar">
      <button class="btn-secondary" style="font-size:12px" onclick="openNoticeModal('${s.id}','تعهد')">+ تعهد</button>
      <button class="btn-secondary" style="font-size:12px;color:#dc2626;border-color:#fca5a5" onclick="openNoticeModal('${s.id}','إنذار')">+ إنذار</button>
      <span class="sp-notice-counts">${pledgeCnt ? `<span class="sp-notice-chip sp-notice-pledge">${pledgeCnt} تعهد</span>` : ''}${warnCnt ? `<span class="sp-notice-chip sp-notice-warn">${warnCnt} إنذار</span>` : ''}</span>
    </div>
    ${notices.length ? `
    <div class="sp-notices-list">
      ${notices.map(n => `
      <div class="sp-notice-row">
        <span class="sp-notice-type-badge ${n.type==='إنذار'?'sp-notice-warn':'sp-notice-pledge'}">${n.type}</span>
        <span class="sp-notice-date">${formatDateDisplay(n.date)}</span>
        <span class="sp-notice-reason">${n.reason||'—'}</span>
        <button class="btn-icon" style="font-size:11px;flex-shrink:0" onclick="deleteNotice('${n.id}','${s.id}')"><span class="ui-ic ic-red"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span></button>
      </div>`).join('')}
    </div>` : '<p style="color:var(--text2);font-size:13px;margin-bottom:12px">لا توجد تعهدات أو إنذارات.</p>'}

    <!-- زر طباعة الملف -->
    <div style="display:flex;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
      <button class="btn-secondary" onclick="printStudentProfile('${s.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> طباعة الملف</button>
    </div>
  `;
  // init hijri label for quick-leave date
  updateHijriLabel(document.getElementById('spQuickDate'), 'spQuickHijri');
  document.getElementById('studentDetailModal').classList.remove('hidden');
}

function openStudentModal(id=null) {
  const sel = document.getElementById('fStudentClass');
  sel.innerHTML = '<option value="">— اختر الحلقة —</option>';
  state.classes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name; sel.appendChild(opt);
  });
  if (id) {
    const s = state.students.find(x => x.id === id); if (!s) return;
    document.getElementById('studentModalTitle').textContent = 'تعديل بيانات الطالب';
    document.getElementById('studentId').value     = s.id;
    document.getElementById('fStudentId').value    = s.studentId||'';
    document.getElementById('fStudentName').value  = s.name;
    document.getElementById('fStudentBday').value  = s.birthday||'';
    document.getElementById('fStudentPhone').value = s.parentPhone||'';
    document.getElementById('fStudentClass').value = s.classId||'';
    const prev = document.getElementById('fStudentPhotoPreview');
    if (s.photo) { prev.src = s.photo; prev.classList.remove('hidden'); }
    else prev.classList.add('hidden');
  } else {
    document.getElementById('studentModalTitle').textContent = 'إضافة طالب';
    ['studentId','fStudentId','fStudentName','fStudentBday','fStudentPhone'].forEach(i => document.getElementById(i).value='');
    document.getElementById('fStudentClass').value = '';
    document.getElementById('fStudentPhotoPreview').classList.add('hidden');
  }
  document.getElementById('studentModal').classList.remove('hidden');
}

function previewPhoto() {
  const file = document.getElementById('fStudentPhoto').files[0]; if (!file) return;
  const prev = document.getElementById('fStudentPhotoPreview');
  prev.src   = URL.createObjectURL(file); prev.classList.remove('hidden');
}

async function saveStudent() {
  const id   = document.getElementById('studentId').value;
  const data = {
    studentId: document.getElementById('fStudentId').value.trim(),
    name:      document.getElementById('fStudentName').value.trim(),
    birthday:  document.getElementById('fStudentBday').value,
    parentPhone: document.getElementById('fStudentPhone').value.trim(),
    classId:   document.getElementById('fStudentClass').value,
  };
  if (!data.name) return toast('الاسم مطلوب');
  let savedId = id;
  if (id) {
    await apiFetch(`/students/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
  } else {
    const res = await apiFetch('/students', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    savedId   = res?.id;
  }
  const photoFile = document.getElementById('fStudentPhoto').files[0];
  if (photoFile && savedId) {
    const fd = new FormData(); fd.append('photo', photoFile);
    await fetch(`${API}/students/${savedId}/photo`, { method:'POST', body:fd });
  }
  closeModal('studentModal'); await loadAll(); renderStudentList();
  toast(id ? '<span data-toast="ok"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span> تم تحديث بيانات الطالب' : '<span data-toast="ok"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span> تمت إضافة الطالب');
}

async function deleteStudent(id) {
  if (!confirm('هل تريد حذف هذا الطالب؟')) return;
  await apiFetch(`/students/${id}`, { method:'DELETE' });
  await loadAll(); renderStudentList(); toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> تم حذف الطالب');
}

// ══════════════════════════════════════════════════════════

//  إجراء سريع من ملف الطالب — Quick Leave
// ══════════════════════════════════════════════════════════════════
async function quickLeave(studentId, classId, type, reason = '') {
  const dateEl   = document.getElementById('spQuickDate');
  const resultEl = document.getElementById('spQuickResult');
  const date     = dateEl?.value || todayISO();

  const typeLabels = {
    Sick: ic('thermometer','ic-red')+' مرض', Family: ic('alert-circle','ic-amber')+' ظرف طارئ', Travel: ic('plane','ic-sky')+' سفر',
    Permission: ic('clipboard','ic-blue')+' إذن خروج', Other: ic('file-text','ic-gray')+' أخرى',
  };
  const label = typeLabels[type] || type;

  if (!classId) { toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> الطالب غير مرتبط بحلقة'); return; }

  // إذن خروج requires the student to already be marked Present
  if (type === 'Permission') {
    const todayAtt = await apiFetch(`/attendance?date=${date}&classId=${classId}`);
    const rec = todayAtt?.find(a => a.studentId === studentId);
    if (!rec || rec.status !== 'Present') {
      toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> إذن الخروج يُعطى فقط للطلاب الحاضرين. سجّل الحضور أولاً.');
      return;
    }
  }

  // Highlight selected button briefly
  document.querySelectorAll('.sp-qa-btn').forEach(b => b.classList.remove('sp-qa-active'));
  event?.target?.closest('.sp-qa-btn')?.classList.add('sp-qa-active');

  const res = await apiFetch('/leaves', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, classId, date, type, reason }),
  });

  if (resultEl) {
    resultEl.className = 'sp-qa-result';
    resultEl.innerHTML = res?.ok !== false
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم تسجيل <strong>${label}</strong> بتاريخ ${date}${reason ? ' — ' + reason : ''}`
      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> تعذّر التسجيل`;
    resultEl.classList.add(res?.ok !== false ? 'sp-qa-success' : 'sp-qa-error');
    resultEl.classList.remove('hidden');
    setTimeout(() => {
      resultEl.classList.add('hidden');
      document.querySelectorAll('.sp-qa-btn').forEach(b => b.classList.remove('sp-qa-active'));
    }, 3500);
  }

  toast(res?.ok !== false ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> ${label} — ${date}` : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> تعذّر التسجيل');

  // For non-Permission: if student already Absent → upgrade to Excused
  if (res?.ok !== false && classId && date && type !== 'Permission') {
    const existing = await apiFetch(`/attendance?date=${date}&classId=${classId}`);
    if (existing) {
      const absentRec = existing.find(a => a.studentId === studentId && a.status === 'Absent');
      if (absentRec) {
        await apiFetch('/attendance/batch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, classId, records: [{ studentId, status: 'Excused', notes: label }] }),
        });
      }
    }
  }

  // Refresh profile if open
  if (res?.ok !== false) viewStudent(studentId);
}
function attEditSelectStatus(btn) {
  document.querySelectorAll('.att-edit-status-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── Attendance Edit Modal (from student profile history) ──
let _attEditData = {};
function openAttEditModal(studentId, classId, studentName, parentPhone, date, currentStatus, notes, recId) {
  _attEditData = { studentId, classId, studentName, parentPhone, date, recId };
  document.getElementById('attEditStudentName').textContent = studentName + ' — ' + formatDateDisplay(date);
  document.getElementById('attEditDate').textContent = formatDateDisplayFull(date);
  // set active button
  document.querySelectorAll('.att-edit-status-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.status === currentStatus);
  });
  document.getElementById('attEditNotes').value = notes || '';
  document.getElementById('attEditResult').className = 'sp-qa-result hidden';
  document.getElementById('attEditResult').textContent = '';
  document.getElementById('attEditModal').classList.remove('hidden');
}
function closeAttEditModal() {
  document.getElementById('attEditModal').classList.add('hidden');
}

// ── Open edit modal from student profile date picker ──
async function openAttEditFromProfile(studentId) {
  // Look up student from state — avoids encoding names in onclick attributes
  const s = state.students.find(x => x.id === studentId);
  if (!s) return toast('لم يُعثر على بيانات الطالب');
  const classId    = s.classId    || '';
  const studentName= s.name       || '';
  const parentPhone= s.parentPhone|| '';

  const dateEl = document.getElementById('spEditAttDate');
  const date   = dateEl?.value || todayISO();
  if (!date) return toast('اختر التاريخ أولاً');

  // Fetch current attendance record for that date
  let currentStatus = 'Absent';
  let currentNotes  = '';
  let recId         = '';
  try {
    const recs = await apiFetch(`/attendance?date=${date}${classId ? '&classId=' + classId : ''}`);
    const rec  = recs?.find(a => a.studentId === studentId);
    if (rec) {
      currentStatus = rec.status || 'Absent';
      currentNotes  = rec.notes  || '';
      recId         = rec.id     || '';
    }
  } catch(e) { /* no record yet */ }

  openAttEditModal(studentId, classId, studentName, parentPhone, date, currentStatus, currentNotes, recId);
}
async function saveAttEdit() {
  const newStatus = document.querySelector('.att-edit-status-btn.active')?.dataset.status;
  if (!newStatus) return toast('اختر الحالة أولاً');
  const { studentId, classId, date, parentPhone, studentName } = _attEditData;
  const notes = document.getElementById('attEditNotes').value.trim();
  const res = await apiFetch('/attendance/batch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, classId, records: [{ studentId, status: newStatus, notes }] }),
  });
  const ok = res && res.ok !== false;
  const resultEl = document.getElementById('attEditResult');
  const statusLabels = { Present:'حاضر', Absent:'غائب', Late:'متأخر', Excused:'بعذر' };
  if (ok) {
    resultEl.className = 'sp-qa-result sp-qa-success';
    resultEl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم تغيير الحالة إلى ' + (statusLabels[newStatus] || newStatus);
    resultEl.classList.remove('hidden');
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم تحديث حضور ' + studentName);
    // Send WA if changed to Absent
    if (newStatus === 'Absent' && parentPhone && date === todayISO()) {
      const s = state.students.find(x => x.id === studentId);
      if (s) {
        const cls = state.classes.find(c => c.id === classId);
        const records = [{ studentId, name: studentName, phone: parentPhone }];
        apiFetch('/whatsapp/send-bulk', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records, date, classId }),
        }).then(r => {
          if (r?.sent > 0) toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> تم إرسال إشعار الغياب لولي الأمر');
        });
      }
    }
    setTimeout(() => {
      closeAttEditModal();
      viewStudent(studentId); // refresh profile
    }, 1200);
  } else {
    resultEl.className = 'sp-qa-result sp-qa-error';
    resultEl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> تعذّر التحديث';
    resultEl.classList.remove('hidden');
  }
}

// ── Edit attendance for a specific date from the history table ──
function openAttEditForDate(studentId, classId, studentName, date, parentPhone, btnEl) {
  const row    = btnEl.closest('tr');
  const panel  = row.querySelector('.att-hist-edit-panel');
  if (!panel) return;

  // Toggle: close if already open
  if (!panel.classList.contains('hidden')) {
    panel.classList.add('hidden');
    return;
  }
  // Close any other open panels first
  document.querySelectorAll('.att-hist-edit-panel').forEach(p => p.classList.add('hidden'));

  const mkBtn = (st, icon, label, color) =>
    `<button class="att-hist-status-btn" style="background:${color}" `
    + `onclick="changeStudentAttStatus('${studentId}','${classId}','${st}','${date}','${studentName}','${parentPhone}',this.closest('tr'))">`
    + `${icon} ${label}</button>`;

  panel.innerHTML = `<div class="att-hist-edit-row">
    ${mkBtn('Present','<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>','حاضر','#dcfce7')}
    ${mkBtn('Late','<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>','متأخر','#fef3c7')}
    ${mkBtn('Absent','<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>','غائب','#fee2e2')}
    ${mkBtn('Excused','<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>','بعذر (إذن)','#ede9fe')}
    ${mkBtn('Sick','<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>','مريض','#fce7f3')}
    ${mkBtn('Emergency','<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>','طارئ','#fff1f2')}
  </div>`;
  panel.classList.remove('hidden');
}

async function changeStudentAttStatus(studentId, classId, newStatus, date, studentName, parentPhone, rowEl) {
  if (!date) date = todayISO();
  const statusLabels = { Present:'حاضر', Absent:'غائب', Late:'متأخر', Excused:'بعذر (إذن)', Sick:'مريض', Emergency:'طارئ' };
  const badgeMap     = { Present:'present', Absent:'absent', Late:'late', Excused:'excused', Sick:'excused', Emergency:'absent' };

  // Map Sick/Emergency → Excused in the DB (they're sub-types, visually distinct)
  const dbStatus = (newStatus === 'Sick' || newStatus === 'Emergency') ? 'Excused' : newStatus;
  const notes    = newStatus === 'Sick' ? 'مرض' : newStatus === 'Emergency' ? 'طارئ' : '';

  const existing = await apiFetch('/attendance?date=' + date + (classId ? '&classId=' + classId : ''));
  const existingRec = existing?.find(a => a.studentId === studentId);
  const finalNotes = notes || existingRec?.notes || '';

  const res = await apiFetch('/attendance/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, classId, records: [{ studentId, status: dbStatus, notes: finalNotes }] }),
  });

  const ok = res && res.ok !== false;
  if (!ok) { toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> تعذّر التغيير'); return; }

  // Update badge in the table row
  if (rowEl) {
    const badge = rowEl.querySelector('.badge');
    if (badge) {
      badge.className = 'badge badge-' + (badgeMap[newStatus] || 'default');
      badge.textContent = statusLabels[newStatus] || newStatus;
    }
    const panel = rowEl.querySelector('.att-hist-edit-panel');
    if (panel) panel.classList.add('hidden');
  }

  toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم التغيير إلى: ' + (statusLabels[newStatus] || newStatus));

  // If changed to Absent → send WA to guardian
  if (newStatus === 'Absent' && parentPhone) {
    const cls = state.classes.find(c => c.id === classId);
    const waRes = await apiFetch('/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: parentPhone, studentName, className: cls?.name || '', date }),
    });
    if (waRes?.ok) toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> تم إرسال إشعار الغياب على واتساب');
    else           toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> تغيّرت الحالة لكن تعذّر إرسال واتساب');
  }
}

async function waDismissItem(attendanceId, studentId, date) {
  const res = await apiFetch('/whatsapp/queue/dismiss', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, date }),
  });

  if (!res || res.ok === false) {
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> تعذّر الحذف: ' + (res?.error || 'خطأ في الاتصال'));
    return;
  }

  // Server confirmed save — now remove from local state and DOM
  _waQueueData = _waQueueData.filter(x => x.attendanceId !== attendanceId);
  document.getElementById(`wqi-${attendanceId}`)?.remove();
  waUpdateSendBtn();
  waUpdateNavBadge();

  // Remove empty date groups
  document.querySelectorAll('.wa-queue-group').forEach(g => {
    if (g.querySelectorAll('.wa-queue-item').length === 0) g.remove();
  });

  const info = document.getElementById('waQueueInfo');
  if (info) info.innerHTML = _waQueueData.length === 0
    ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> لا توجد رسائل معلقة' : `${_waQueueData.length} رسالة غياب لم تُرسل بعد`;
  if (_waQueueData.length === 0) waRenderQueue();
  toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> تم حذف الرسالة من القائمة');
}

// ══════════════════════════════════════════════════════════════════

//  الطلاب — الحذف الجماعي
// ════════════════════════════════════════════════════════

let _studentBulkMode     = false;
let _studentBulkSelected = new Set();

function studentToggleBulkMode() {
  _studentBulkMode = !_studentBulkMode;
  _studentBulkSelected.clear();
  const btn     = document.getElementById('studentBulkToggleBtn');
  const bar     = document.getElementById('studentBulkBar');
  if (btn) btn.innerHTML   = _studentBulkMode ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> إلغاء التحديد' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> تحديد';
  bar?.classList.toggle('hidden', !_studentBulkMode);
  renderStudentList();
}

function studentBulkToggle(id) {
  if (_studentBulkSelected.has(id)) _studentBulkSelected.delete(id);
  else _studentBulkSelected.add(id);
  _studentBulkUpdateCount();
  // Re-render just the card state to avoid full re-render flicker
  const card = document.querySelector(`.list-card[data-student-id="${id}"]`);
  if (card) {
    card.classList.toggle('list-card-selected', _studentBulkSelected.has(id));
    const cb = card.querySelector('.bulk-checkbox');
    if (cb) cb.textContent = _studentBulkSelected.has(id) ? '☑' : '☐';
  }
}

function studentBulkSelectAll() {
  const search  = document.getElementById('studentSearch')?.value?.toLowerCase() || '';
  const classId = document.getElementById('studentClassFilter')?.value || '';
  let students  = state.students;
  if (search)  students = students.filter(s => s.name.toLowerCase().includes(search) || (s.studentId||'').toLowerCase().includes(search));
  if (classId) students = students.filter(s => s.classId === classId);
  students.forEach(s => _studentBulkSelected.add(s.id));
  _studentBulkUpdateCount();
  renderStudentList();
}

function studentBulkClearAll() {
  _studentBulkSelected.clear();
  _studentBulkUpdateCount();
  renderStudentList();
}

function _studentBulkUpdateCount() {
  const n = _studentBulkSelected.size;
  const countEl = document.getElementById('studentBulkCount');
  const delBtn  = document.getElementById('studentBulkDeleteBtn');
  if (countEl) countEl.textContent = `${n} محدد`;
  if (delBtn)  delBtn.disabled = n === 0;
}

async function studentBulkDelete() {
  const ids = [..._studentBulkSelected];
  if (!ids.length) return;
  const names = ids.map(id => state.students.find(s => s.id === id)?.name || id).join('، ');
  if (!confirm(`سيتم حذف ${ids.length} طالب نهائياً:\n${names.slice(0,200)}${names.length>200?'…':''}\n\nهل أنت متأكد؟`)) return;

  // Delete sequentially
  let done = 0;
  for (const id of ids) {
    await apiFetch(`/students/${id}`, { method: 'DELETE' });
    done++;
  }
  toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> تم حذف ${done} طالب`);
  _studentBulkSelected.clear();
  _studentBulkMode = false;
  const btn = document.getElementById('studentBulkToggleBtn');
  const bar = document.getElementById('studentBulkBar');
  if (btn) btn.textContent = '☑ تحديد';
  bar?.classList.add('hidden');
  await loadAll();
  renderStudentList();
}

// ════════════════════════════════════════════════════════
//  إذن الخروج — منح الإذن من ملف الطالب
// ════════════════════════════════════════════════════════
async function grantExitPermit(studentId, classId) {
  const noteEl = document.getElementById('spExitNote');
  const reason = noteEl?.value?.trim() || '';
  const date   = document.getElementById('spQuickDate')?.value || todayISO();

  // Double-check student is Present
  const att = await apiFetch(`/attendance?date=${date}&classId=${classId}`);
  const rec = att?.find(a => a.studentId === studentId);
  if (!rec || rec.status !== 'Present') {
    toast('<span data-toast="warn"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span> الطالب غير حاضر — لا يمكن منح إذن الخروج');
    return;
  }

  const now  = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const res = await apiFetch('/leaves', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, classId, date, type: 'Permission', reason, time }),
  });

  if (res?.ok !== false) {
    toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم منح إذن الخروج — ${time}${reason ? ' | ' + reason : ''}`);
    if (noteEl) noteEl.value = '';
    viewStudent(studentId); // refresh profile to show updated count
  } else {
    toast('<span data-toast="err"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></span> تعذّر تسجيل إذن الخروج');
  }
}

// ════════════════════════════════════════════════════════
//  تعهدات وإنذارات
// ════════════════════════════════════════════════════════

let _noticeStudentId = null;

function openNoticeModal(studentId, type) {
  _noticeStudentId = studentId;
  document.getElementById('noticeType').value   = type;
  document.getElementById('noticeDate').value   = todayISO();
  document.getElementById('noticeReason').value = '';
  updateHijriLabel(document.getElementById('noticeDate'), 'noticeHijri');
  document.getElementById('noticeModal').classList.remove('hidden');
}

async function saveNotice() {
  const type   = document.getElementById('noticeType').value;
  const date   = document.getElementById('noticeDate').value;
  const reason = document.getElementById('noticeReason').value.trim();
  if (!_noticeStudentId || !date) return;
  await apiFetch('/notices', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: _noticeStudentId, type, date, reason }),
  });
  closeModal('noticeModal');
  toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم تسجيل ${type}`);
  viewStudent(_noticeStudentId);
}

async function deleteNotice(noticeId, studentId) {
  if (!confirm('هل تريد حذف هذا السجل؟')) return;
  await apiFetch(`/notices/${noticeId}`, { method: 'DELETE' });
  toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> تم الحذف');
  viewStudent(studentId);
}

// ════════════════════════════════════════════════════════
//  طباعة ملف الطالب
// ════════════════════════════════════════════════════════

async function printStudentProfile(studentId) {
  const s = await apiFetch(`/students/${studentId}`);
  if (!s) return;
  _printStudentProfiles([s]);
}

async function studentBulkPrint() {
  const ids = [..._studentBulkSelected];
  if (!ids.length) return;
  toast('<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ تحضير الملفات…');
  const profiles = await Promise.all(ids.map(id => apiFetch(`/students/${id}`)));
  _printStudentProfiles(profiles.filter(Boolean));
}

function _printStudentProfiles(students) {
  const school   = state.settings?.schoolName || 'حضور الحلقات';
  const subtitle = state.settings?.subtitle   || '';
  const logos    = (state.settings?.logos     || []);
  const logoUrl  = logos.length ? logos[0].url : null;

  const ST_LABEL = { Present:'حاضر', Absent:'غائب', Late:'متأخر', Excused:'بعذر', Holiday:'إجازة' };
  const ST_BG    = { Present:'#dcfce7', Absent:'#fee2e2', Late:'#fef3c7', Excused:'#ede9fe', Holiday:'#e0f2fe' };
  const ST_COLOR = { Present:'#15803d', Absent:'#b91c1c', Late:'#b45309', Excused:'#6d28d9', Holiday:'#0369a1' };

  const profileHTML = students.map(s => {
    const cls     = state.classes.find(c => c.id === s.classId);
    const history = (s.history  || []).slice(0, 30);
    const leaves  = s.leaves   || [];
    const notices = s.notices  || [];
    const exitCnt = leaves.filter(l => l.type === 'Permission').length;
    const present = history.filter(h => h.status === 'Present').length;
    const absent  = history.filter(h => h.status === 'Absent').length;
    const late    = history.filter(h => h.status === 'Late').length;
    const excused = history.filter(h => h.status === 'Excused').length;
    const total   = history.length;
    const rateNum = total ? Math.round((present + excused + late) / total * 100) : null;
    const rateStr = rateNum !== null ? rateNum + '%' : '—';

    // Circular rate indicator (SVG)
    const rateCircle = (() => {
      if (rateNum === null) return `<div class="rate-circle rate-circle-none"><span class="rate-num">—</span><span class="rate-lbl">نسبة الحضور</span></div>`;
      const r = 30, circ = 2 * Math.PI * r;
      const dash = (rateNum / 100) * circ;
      const color = rateNum >= 80 ? '#16a34a' : rateNum >= 60 ? '#d97706' : '#dc2626';
      return `<div class="rate-circle-wrap">
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="8"/>
          <circle cx="44" cy="44" r="${r}" fill="none" stroke="${color}" stroke-width="8"
            stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
            stroke-dashoffset="${(circ * 0.25).toFixed(1)}"
            stroke-linecap="round" transform="rotate(-90 44 44)"/>
          <text x="44" y="40" text-anchor="middle" font-size="14" font-weight="800" fill="${color}">${rateNum}%</text>
          <text x="44" y="54" text-anchor="middle" font-size="8" fill="#64748b">نسبة الحضور</text>
        </svg>
      </div>`;
    })();

    const histRows = history.slice(0, 25).map((h, i) => {
      const bg = ST_BG[h.status] || '#f3f4f6';
      const fg = ST_COLOR[h.status] || '#374151';
      return `<tr class="${i % 2 === 0 ? 'row-even' : ''}">
        <td>${formatDateDisplay(h.date)}</td>
        <td>${ARABIC_DAYS[new Date(h.date+'T00:00:00').getDay()] || ''}</td>
        <td><span class="badge" style="background:${bg};color:${fg}">${ST_LABEL[h.status] || h.status}</span></td>
        <td class="notes-col">${h.notes || ''}</td>
      </tr>`;
    }).join('');

    const noticeRows = notices.map(n => {
      const isWarn = n.type === 'إنذار';
      return `<tr>
        <td><span class="badge" style="background:${isWarn?'#fee2e2':'#dbeafe'};color:${isWarn?'#b91c1c':'#1d4ed8'}">${n.type}</span></td>
        <td>${formatDateDisplay(n.date)}</td>
        <td>${n.reason || '—'}</td>
      </tr>`;
    }).join('');

    const avatarHtml = s.photo
      ? `<img src="${s.photo}" class="avatar-img" alt="${s.name}" />`
      : `<div class="avatar-placeholder">${s.name.trim().charAt(0)}</div>`;

    const metaItems = [
      cls          && `<div class="meta-item"><span class="meta-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg></span>${cls.name}</div>`,
      s.studentId  && `<div class="meta-item"><span class="meta-icon">#</span>${s.studentId}</div>`,
      s.parentPhone&& `<div class="meta-item"><span class="meta-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></span>${s.parentPhone}</div>`,
      s.birthday   && `<div class="meta-item"><span class="meta-icon">🎂</span>${s.birthday}</div>`,
    ].filter(Boolean).join('');

    return `<div class="profile-page">

      <!-- ── HEADER BANNER ── -->
      <div class="banner">
        <div class="banner-right">
          ${logoUrl ? `<img src="${logoUrl}" class="banner-logo" alt="logo" />` : ''}
          <div class="banner-school">
            <div class="banner-school-name">${school}</div>
            ${subtitle ? `<div class="banner-subtitle">${subtitle}</div>` : ''}
          </div>
        </div>
        <div class="banner-left">
          <div class="banner-doc-type">ملف الطالب</div>
          <div class="banner-date">${formatDateDisplay(todayISO())}</div>
        </div>
      </div>

      <!-- ── IDENTITY CARD ── -->
      <div class="id-card">
        <div class="id-avatar">${avatarHtml}</div>
        <div class="id-info">
          <div class="id-name">${s.name}</div>
          <div class="id-meta">${metaItems}</div>
        </div>
        ${rateCircle}
      </div>

      <!-- ── STATS STRIP ── -->
      <div class="stats-strip">
        <div class="stat-cell" style="border-color:#16a34a">
          <div class="stat-num" style="color:#16a34a">${present}</div>
          <div class="stat-lbl">حاضر</div>
        </div>
        <div class="stat-cell" style="border-color:#dc2626">
          <div class="stat-num" style="color:#dc2626">${absent}</div>
          <div class="stat-lbl">غائب</div>
        </div>
        <div class="stat-cell" style="border-color:#d97706">
          <div class="stat-num" style="color:#d97706">${late}</div>
          <div class="stat-lbl">متأخر</div>
        </div>
        <div class="stat-cell" style="border-color:#7c3aed">
          <div class="stat-num" style="color:#7c3aed">${excused}</div>
          <div class="stat-lbl">بعذر</div>
        </div>
        <div class="stat-cell" style="border-color:#0891b2">
          <div class="stat-num" style="color:#0891b2">${exitCnt}</div>
          <div class="stat-lbl">إذن خروج</div>
        </div>
        <div class="stat-cell" style="border-color:#475569">
          <div class="stat-num" style="color:#475569">${total}</div>
          <div class="stat-lbl">إجمالي الأيام</div>
        </div>
      </div>

      <!-- ── ATTENDANCE TABLE ── -->
      ${history.length ? `
      <div class="section-hdr"><span class="section-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span> سجل الحضور — آخر ${Math.min(history.length, 25)} يوم</div>
      <table>
        <thead><tr><th>التاريخ الهجري</th><th>اليوم</th><th>الحالة</th><th>ملاحظات</th></tr></thead>
        <tbody>${histRows}</tbody>
      </table>` : `<div class="empty-note">لا توجد سجلات حضور بعد.</div>`}

      <!-- ── NOTICES TABLE ── -->
      ${notices.length ? `
      <div class="section-hdr"><span class="ui-ic ic-amber" style="display:inline-flex;align-items:center;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></span> تعهدات وإنذارات</div>
      <table>
        <thead><tr><th>النوع</th><th>التاريخ</th><th>السبب / الملاحظة</th></tr></thead>
        <tbody>${noticeRows}</tbody>
      </table>` : ''}

      <!-- ── SIGNATURE ROW ── -->
      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">توقيع ولي الأمر</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">توقيع المعلم</div></div>
        <div class="sig-box"><div class="sig-line"></div><div class="sig-label">ختم المنشأة</div></div>
      </div>

      <!-- ── FOOTER ── -->
      <div class="footer">
        <span>${school}</span>
        <span>·</span>
        <span>تاريخ الطباعة: ${formatDateDisplay(todayISO())}</span>
        <span>·</span>
        <span>نسبة الحضور: ${rateStr}</span>
      </div>
    </div>`;
  }).join('');

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>ملفات الطلاب — ${school}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Tajawal', 'Segoe UI', Arial, sans-serif;
    background: #fff; color: #1e293b; font-size: 13px; line-height: 1.5;
  }

  /* ── PAGE ── */
  .profile-page {
    width: 210mm; min-height: 297mm;
    padding: 14mm 16mm 10mm;
    margin: 0 auto;
    page-break-after: always;
    display: flex; flex-direction: column; gap: 12px;
  }
  .profile-page:last-child { page-break-after: auto; }

  /* ── BANNER ── */
  .banner {
    display: flex; justify-content: space-between; align-items: center;
    background: #1e3a8a; color: #fff;
    border-radius: 12px; padding: 12px 18px;
  }
  .banner-right { display: flex; align-items: center; gap: 12px; }
  .banner-logo  { width: 48px; height: 48px; object-fit: contain; background: #fff; border-radius: 8px; padding: 3px; flex-shrink: 0; }
  .banner-school-name { font-size: 17px; font-weight: 900; letter-spacing: -0.3px; }
  .banner-subtitle    { font-size: 11px; opacity: 0.8; margin-top: 2px; }
  .banner-left  { text-align: left; }
  .banner-doc-type { font-size: 13px; font-weight: 700; opacity: 0.9; }
  .banner-date     { font-size: 11px; opacity: 0.7; margin-top: 3px; }

  /* ── IDENTITY CARD ── */
  .id-card {
    display: flex; align-items: center; gap: 16px;
    border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 18px;
    background: #f8fafc;
  }
  .id-avatar { flex-shrink: 0; }
  .avatar-img         { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 3px solid #1e3a8a; }
  .avatar-placeholder { width: 72px; height: 72px; border-radius: 50%; background: #dbeafe; color: #1e3a8a; font-size: 30px; font-weight: 900; display: flex; align-items: center; justify-content: center; border: 3px solid #1e3a8a; }
  .id-info  { flex: 1; }
  .id-name  { font-size: 21px; font-weight: 900; color: #1e3a8a; margin-bottom: 8px; }
  .id-meta  { display: flex; flex-wrap: wrap; gap: 6px 18px; }
  .meta-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #475569; }
  .meta-icon { font-size: 13px; }
  .rate-circle-wrap { flex-shrink: 0; }

  /* ── STATS STRIP ── */
  .stats-strip {
    display: flex; gap: 8px;
  }
  .stat-cell {
    flex: 1; text-align: center; padding: 10px 6px;
    border-radius: 10px; border-top: 4px solid;
    background: #f8fafc;
  }
  .stat-num { font-size: 22px; font-weight: 900; line-height: 1; }
  .stat-lbl { font-size: 10px; color: #64748b; margin-top: 4px; font-weight: 600; }

  /* ── SECTION HEADER ── */
  .section-hdr {
    display: flex; align-items: center; gap: 7px;
    font-size: 13px; font-weight: 800; color: #1e3a8a;
    padding: 7px 12px; background: #eff6ff;
    border-radius: 8px; border-right: 4px solid #1e3a8a;
    margin-top: 4px;
  }
  .section-icon { font-size: 14px; }

  /* ── TABLE ── */
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th {
    background: #1e3a8a; color: #fff;
    padding: 8px 10px; text-align: right;
    font-weight: 700; font-size: 12px;
  }
  thead th:first-child { border-radius: 0 6px 6px 0; }
  thead th:last-child  { border-radius: 6px 0 0 6px; }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  tbody tr.row-even td { background: #f8fafc; }
  tbody tr:last-child td { border-bottom: none; }
  .notes-col { color: #64748b; font-size: 11px; }

  /* ── BADGE ── */
  .badge {
    display: inline-block; padding: 3px 10px; border-radius: 20px;
    font-size: 11px; font-weight: 700; white-space: nowrap;
  }

  /* ── SIGNATURE ROW ── */
  .sig-row {
    display: flex; gap: 16px; margin-top: auto; padding-top: 8px;
  }
  .sig-box  { flex: 1; text-align: center; }
  .sig-line { border-bottom: 1.5px dashed #cbd5e1; margin-bottom: 6px; height: 36px; }
  .sig-label{ font-size: 11px; color: #94a3b8; font-weight: 600; }

  /* ── FOOTER ── */
  .footer {
    display: flex; justify-content: center; gap: 10px;
    font-size: 10px; color: #94a3b8;
    border-top: 1px solid #e2e8f0; padding-top: 8px;
  }

  .empty-note { font-size: 12px; color: #94a3b8; padding: 10px 0; }

  @page { size: A4 portrait; margin: 0; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>${profileHTML}</body>
</html>`);
  win.document.close();
  setTimeout(() => win.print(), 800);
}

// ════════════════════════════════════════════════════════
//  Update bulk count to enable/disable print button too
// ════════════════════════════════════════════════════════


/* ── modules/classes.js ── */
//  الحلقات