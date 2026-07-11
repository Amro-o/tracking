// ══════════════════════════════════════════════════════════════════

//  صفحة واتساب — WhatsApp Manager
// ══════════════════════════════════════════════════════════════════

let _waQueueData   = [];   // items from /api/whatsapp/queue
let _waLogData     = [];   // items from /api/whatsapp/log
let _waGroupsData  = [];   // [{id, name, members}]
let _editingGroupId = null;
let _waComposeRecipients = []; // [{name,phone}] for compose tab

// ── الدخول للصفحة ────────────────────────────────────────────────
async function initWhatsappPage() {
  await Promise.all([
    waLoadQueue(),
    waLoadGroups(),      // still needed for send-tab picker
    waLoadLog(),
    waLoadScheduled(),
    waLoadFonnteGroups(), // Fonnte WhatsApp groups tab
  ]);
  waShowTab('queue');
  waUpdateNavBadge();
}

// ── تحميل البيانات ───────────────────────────────────────────────
async function waLoadQueue() {
  const data = await apiFetch('/whatsapp/queue');
  _waQueueData = data || [];
  waRenderQueue();
}

async function waLoadGroups() {
  const data = await apiFetch('/whatsapp/groups');
  _waGroupsData = data || [];
  waRenderGroups();
  waPopulateGroupPicker();
}

const _WA_NOTIFIED_FAILED_KEY = 'wa_notified_failed_ids';
function _getNotifiedFailedIds() {
  try { return JSON.parse(localStorage.getItem(_WA_NOTIFIED_FAILED_KEY) || '[]'); } catch(e) { return []; }
}
function _addNotifiedFailedId(id) {
  const ids = _getNotifiedFailedIds();
  if (!ids.includes(id)) { ids.push(id); localStorage.setItem(_WA_NOTIFIED_FAILED_KEY, JSON.stringify(ids)); }
}

async function waLoadLog() {
  const [logData, calData] = await Promise.all([
    apiFetch('/whatsapp/log'),
    apiFetch('/calendar'),
  ]);
  _waLogData   = logData || [];
  _waSchedData = (calData || []).filter(e => e.type === 'message');
  waRenderLog();
  _waCheckNewFailures(_waLogData);
  refreshNotifBadge();
}

function _waCheckNewFailures(logData) {
  const notified = _getNotifiedFailedIds();
  const newFailed = (logData || []).filter(l => l.status === 'failed' && !notified.includes(l.id));
  if (!newFailed.length) return;
  // Mark all as notified before showing popup
  newFailed.forEach(l => _addNotifiedFailedId(l.id));
  const count = newFailed.length;
  const sample = newFailed[0];
  const name = sample.studentName || sample.phone || '';
  const context = sample.type === 'absence' ? 'رسائل الغياب'
    : sample.type === 'bulk'       ? 'إرسال جماعي'
    : sample.type === 'group-chat' ? 'رسالة مجموعة'
    : sample.type === 'scheduled'  ? 'رسالة مجدولة'
    : 'واتساب';
  const errorMsg = count === 1
    ? (sample.error || 'تحقق من الرقم والاتصال') + (name ? ' — ' + name : '')
    : count + ' رسائل فشلت — افتح السجل للتفاصيل';
  showWaFailNotif(context, count, errorMsg);
}

// ── شارة الانتظار في الناف ───────────────────────────────────────
async function waUpdateNavBadge() {
  // Teachers have no WhatsApp access — always hide badge
  if (currentRole === 'teacher') {
    ['waQueueBadge','menuWaBadge','waTabCount'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = ''; el.classList.add('hidden'); }
    });
    return;
  }
  const data  = await apiFetch('/whatsapp/queue');
  const count = (data||[]).length;
  const badge    = document.getElementById('waQueueBadge');
  const tabCount = document.getElementById('waTabCount');
  const menuBadge= document.getElementById('menuWaBadge');
  const label = count > 99 ? '99+' : (count > 0 ? String(count) : '');
  if (badge) {
    badge.textContent = label;
    badge.classList.toggle('hidden', count === 0);
  }
  if (tabCount) {
    tabCount.textContent = label;
    tabCount.classList.toggle('hidden', count === 0);
  }
  if (menuBadge) {
    menuBadge.textContent = label;
    menuBadge.classList.toggle('hidden', count === 0);
  }
}

// ── تبديل التبويبات ──────────────────────────────────────────────
function waShowTab(tab) {
  document.querySelectorAll('.wa-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.wa-tab-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById(`waTab-${tab}`)?.classList.remove('hidden');
  // Load WA settings data when settings tab is opened
  if (tab === 'wasettings') { _loadWaSettingsTab(); }
}

async function _loadWaSettingsTab() {
  const s = await apiFetch('/settings');
  if (!s) return;
  const waKey      = document.getElementById('settWaApiKey');
  const waPhone    = document.getElementById('settAdminPhone');
  const waTemplate = document.getElementById('settWaTemplate');
  if (waKey)      waKey.value      = s.whatsappApiKey   || '';
  if (waPhone)    waPhone.value    = s.adminPhone        || '';
  if (waTemplate) waTemplate.value = s.whatsappTemplate || '';
  renderWaTemplateList();
}

// ══════════════════════════════════════════════════════════════════
//  تبويب: قائمة الانتظار
// ══════════════════════════════════════════════════════════════════
function waRenderQueue() {
  const list = document.getElementById('waQueueList');
  const info = document.getElementById('waQueueInfo');
  const btn  = document.getElementById('waSendQueueBtn');
  if (!list) return;

  const q = _waQueueData;
  if (info) info.innerHTML = q.length === 0
    ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> لا توجد رسائل معلقة' : `${q.length} رسالة غياب لم تُرسل بعد`;

  if (q.length === 0) {
    list.innerHTML = `
      <div class="wa-empty">
        <div class="wa-empty-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
        <div class="wa-empty-title">كل الرسائل أُرسلت!</div>
        <div class="wa-empty-sub">لا توجد إشعارات غياب معلقة حتى الآن</div>
      </div>`;
    if (btn) btn.disabled = true;
    return;
  }

  // Group by date
  const byDate = {};
  q.forEach(item => {
    if (!byDate[item.date]) byDate[item.date] = [];
    byDate[item.date].push(item);
  });

  list.innerHTML = Object.entries(byDate)
    .sort(([a],[b]) => b.localeCompare(a))
    .map(([date, items]) => `
      <div class="wa-queue-group">
        <div class="wa-queue-date-header">
          <label class="wa-check-all-label">
            <input type="checkbox" class="wa-date-check" data-date="${date}"
              onchange="waToggleDateGroup('${date}', this.checked)" />
            <span class="wa-queue-date">${formatDateAr(date)}</span>
          </label>
          <span class="wa-queue-date-count">${items.length} طالب</span>
        </div>
        ${items.map(item => `
          <div class="wa-queue-item" id="wqi-${item.attendanceId}">
            <label class="wa-queue-item-label">
              <input type="checkbox" class="wa-queue-check" data-id="${item.attendanceId}"
                data-student="${item.studentId}" data-name="${item.studentName}"
                data-phone="${item.phone}" data-class="${item.className}"
                data-classid="${item.classId}" data-date="${item.date}"
                onchange="waUpdateSendBtn()" />
              <div class="wa-queue-avatar">${item.studentName.charAt(0)}</div>
              <div class="wa-queue-info">
                <div class="wa-queue-name">${item.studentName}</div>
                <div class="wa-queue-meta">${item.className} · ${item.date}</div>
              </div>
            </label>
            <div class="wa-queue-phone">
              ${item.phone
                ? `<span class="wa-phone-chip">${item.phone}</span>`
                : `<input type="tel" class="wa-phone-inline" placeholder="أدخل الرقم"
                    data-id="${item.attendanceId}" onchange="waPhoneInlineChange(this)" />`
              }
            </div>
            <div class="wa-queue-item-status" id="wqs-${item.attendanceId}"></div>
            <button class="wa-queue-dismiss" onclick="waDismissItem('${item.attendanceId}','${item.studentId}','${item.date}')" title="حذف من القائمة"><span class="ui-ic ic-red"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span></button>
          </div>
        `).join('')}
      </div>
    `).join('');

  if (btn) btn.disabled = false;
}

function waToggleDateGroup(date, checked) {
  document.querySelectorAll(`.wa-queue-check[data-date="${date}"]`).forEach(cb => {
    cb.checked = checked;
  });
  waUpdateSendBtn();
}

function waSelectAllQueue() {
  const all = document.querySelectorAll('.wa-queue-check');
  const anyUnchecked = [...all].some(cb => !cb.checked);
  all.forEach(cb => cb.checked = anyUnchecked);
  document.querySelectorAll('.wa-date-check').forEach(cb => cb.checked = anyUnchecked);
  waUpdateSendBtn();
}

function waUpdateSendBtn() {
  const count = document.querySelectorAll('.wa-queue-check:checked').length;
  const btn   = document.getElementById('waSendQueueBtn');
  if (btn) {
    btn.disabled    = count === 0;
    btn.textContent = count > 0 ? `📤 إرسال ${count} رسالة` : '📤 إرسال المحدد';
  }
  const delBtn = document.getElementById('waDeleteQueueBtn');
  if (delBtn) {
    delBtn.disabled    = count === 0;
    delBtn.innerHTML = count > 0 ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> حذف ${count}` : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> حذف المحدد';
  }
}

async function waDeleteSelected() {
  const checked = [...document.querySelectorAll('.wa-queue-check:checked')];
  if (!checked.length) return;
  if (!confirm(`هل تريد حذف ${checked.length} عنصر من قائمة الانتظار؟`)) return;

  const ids = checked.map(cb => cb.dataset.id);
  let deleted = 0;

  await Promise.all(ids.map(async id => {
    const item = _waQueueData.find(x => x.attendanceId === id);
    if (!item) return;
    const res = await apiFetch('/whatsapp/queue/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: item.studentId, date: item.date }),
    });
    if (res?.ok !== false) {
      _waQueueData = _waQueueData.filter(x => x.attendanceId !== id);
      document.getElementById(`wqi-${id}`)?.remove();
      deleted++;
    }
  }));

  // Clean up empty date groups
  document.querySelectorAll('.wa-queue-group').forEach(g => {
    if (g.querySelectorAll('.wa-queue-item').length === 0) g.remove();
  });

  waUpdateSendBtn();
  waUpdateNavBadge();

  const info = document.getElementById('waQueueInfo');
  if (info) info.innerHTML = _waQueueData.length === 0
    ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> لا توجد رسائل معلقة' : `${_waQueueData.length} رسالة غياب لم تُرسل بعد`;
  if (_waQueueData.length === 0) waRenderQueue();

  toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> تم حذف ${deleted} عنصر من قائمة الانتظار`);
}

function waPhoneInlineChange(input) {
  const id = input.dataset.id;
  const item = _waQueueData.find(x => x.attendanceId === id);
  if (item) item.phone = input.value.trim();
}

async function waSendSelected() {
  const checked = [...document.querySelectorAll('.wa-queue-check:checked')];
  if (!checked.length) return;

  const btn = document.getElementById('waSendQueueBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ الإرسال…'; }

  const items = checked.map(cb => ({
    attendanceId: cb.dataset.id,
    studentId:    cb.dataset.student,
    studentName:  cb.dataset.name,
    phone:        cb.dataset.phone || document.querySelector(`.wa-phone-inline[data-id="${cb.dataset.id}"]`)?.value?.trim() || '',
    className:    cb.dataset.class,
    classId:      cb.dataset.classid,
    date:         cb.dataset.date,
  }));

  // Show spinner on each row
  items.forEach(item => {
    const el = document.getElementById(`wqs-${item.attendanceId}`);
    if (el) el.innerHTML = `<span class="wa-status-spin"><span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span></span>`;
  });

  const res = await apiFetch('/whatsapp/queue/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });

  if (res?.results) {
    res.results.forEach((r, i) => {
      const id = items[i]?.attendanceId;
      const el = document.getElementById(`wqs-${id}`);
      if (r.ok) {
        if (el) el.innerHTML = `<span class="wa-status-ok"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم</span>`;
        // Remove from queue after success
        setTimeout(() => {
          document.getElementById(`wqi-${id}`)?.remove();
          _waQueueData = _waQueueData.filter(x => x.attendanceId !== id);
        }, 1200);
      } else {
        if (el) el.innerHTML = `<span class="wa-status-fail" title="${r.error}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> فشل</span>`;
      }
    });
    toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> ${res.sent} نجح&nbsp; <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ${res.failed} فشل`);
    showWaSummaryNotif(res.sent, res.failed);
    if (res.failed > 0) showWaFailNotif('قائمة الانتظار', res.failed, null);
  } else if (res?.error) {
    toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ${res.error}`);
    showWaFailNotif('قائمة الانتظار', 0, res.error);
  }

  await waLoadQueue();
  waUpdateNavBadge();
  if (btn) { btn.disabled = false; btn.textContent = '📤 إرسال المحدد'; }
  // Refresh log
  await waLoadLog();
}

// ══════════════════════════════════════════════════════════════════
//  تبويب: رسالة جديدة
// ══════════════════════════════════════════════════════════════════
function waPopulateGroupPicker() {
  const sel = document.getElementById('waGroupPicker');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">— اختر مجموعة —</option>' +
    _waGroupsData.map(g => `<option value="${g.id}">${g.name} (${g.members.length})</option>`).join('');
  sel.value = current;
}

function waPickGroup() {
  const id = document.getElementById('waGroupPicker')?.value;
  if (!id) return;
  const group = _waGroupsData.find(g => g.id === id);
  if (!group) return;
  group.members.forEach(m => {
    if (!_waComposeRecipients.find(r => r.phone === m.phone))
      _waComposeRecipients.push({...m});
  });
  waRenderComposeRecipients();
  document.getElementById('waGroupPicker').value = '';
}

function waAddRecipientRow() {
  _waComposeRecipients.push({ name: '', phone: '' });
  waRenderComposeRecipients();
}

function waRenderComposeRecipients() {
  const el = document.getElementById('waRecipientList');
  if (!el) return;
  if (_waComposeRecipients.length === 0) {
    el.innerHTML = `<div class="wa-recipients-empty">لا يوجد مستلمون — أضف مجموعة أو رقماً يدوياً</div>`;
    return;
  }
  el.innerHTML = _waComposeRecipients.map((r, i) => `
    <div class="wa-recipient-row" id="wcrr-${i}">
      <input type="text" class="wa-rec-name" placeholder="الاسم (اختياري)"
        value="${r.name}" onchange="_waComposeRecipients[${i}].name=this.value" />
      <input type="tel" class="wa-rec-phone" placeholder="رقم الواتساب"
        value="${r.phone}" onchange="_waComposeRecipients[${i}].phone=this.value"
        dir="ltr" />
      <button class="wa-rec-del" onclick="waRemoveRecipient(${i})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
  `).join('');
}

function waRemoveRecipient(i) {
  _waComposeRecipients.splice(i, 1);
  waRenderComposeRecipients();
}

async function waSendCustom() {
  const message = document.getElementById('waCustomMsg')?.value?.trim();
  const status  = document.getElementById('waCustomStatus');
  const btn     = document.getElementById('waSendCustomBtn');

  if (!message) { toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> الرسالة فارغة'); return; }
  // collect latest values from inputs
  _waComposeRecipients = _waComposeRecipients.map((r, i) => ({
    name:  document.querySelector(`#wcrr-${i} .wa-rec-name`)?.value?.trim()  || r.name,
    phone: document.querySelector(`#wcrr-${i} .wa-rec-phone`)?.value?.trim() || r.phone,
  }));
  const targets = _waComposeRecipients.filter(r => r.phone);
  if (!targets.length) { toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> أضف مستلماً واحداً على الأقل'); return; }

  btn.disabled = true;
  if (status) { status.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ الإرسال…'; status.className = 'wa-compose-status'; }

  const res = await apiFetch('/whatsapp/send-custom', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, targets }),
  });

  if (res?.results) {
    if (status) {
      status.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم الإرسال: ${res.sent} | <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> فشل: ${res.failed}`;
      status.className = 'wa-compose-status ' + (res.failed > 0 ? 'wa-status-warn' : 'wa-status-ok-text');
    }
    toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> إرسال ${res.sent}/${targets.length}`);
    if (res.failed > 0) showWaFailNotif('إرسال مخصص', res.failed, null);
    await waLoadLog();
    waShowTab('log');
  } else {
    if (status) { status.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ${res?.error||'فشل الإرسال'}`; status.className = 'wa-compose-status wa-status-fail-text'; }
    showWaFailNotif('إرسال مخصص', 0, res?.error || 'فشل الإرسال');
  }
  btn.disabled = false;
}

// ══════════════════════════════════════════════════════════════════
//  تبويب: المجموعات — Fonnte WhatsApp Groups
// ══════════════════════════════════════════════════════════════════
let _waFonnteGroups = [];   // [{id, name}] fetched from Fonnte

// Get the saved Fonnte token from state or settings
async function _getFonnteToken() {
  if (state.settings?.whatsappApiKey) return state.settings.whatsappApiKey;
  const s = await apiFetch('/settings');
  const tok = s?.whatsappApiKey || '';
  if (!state.settings) state.settings = {};
  state.settings.whatsappApiKey = tok;
  return tok;
}

// Load cached group list from Fonnte (fast, no WA interaction)
async function waLoadFonnteGroups() {
  const el = document.getElementById('waGroupsList');
  if (el) el.innerHTML = `<div class="wa-fg-loading"><span class="wa-fg-spinner"></span> جارٍ تحميل المجموعات…</div>`;

  const token = await _getFonnteToken();
  if (!token) {
    waRenderFonnteGroups(null, 'no-token');
    return;
  }
  try {
    const res  = await fetch('https://api.fonnte.com/get-whatsapp-group', {
      method: 'POST',
      headers: { 'Authorization': token },
    });
    const data = await res.json();
    if (data.status === false) {
      waRenderFonnteGroups(null, data.detail || 'error');
    } else {
      _waFonnteGroups = data.data || [];
      waRenderFonnteGroups(_waFonnteGroups, null);
    }
  } catch(e) {
    waRenderFonnteGroups(null, 'network');
  }
}

// Refresh: tell Fonnte to re-fetch from WhatsApp first, then load
async function waRefreshFonnteGroups() {
  const btn = document.getElementById('waFgRefreshBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ التحديث…'; }

  const token = await _getFonnteToken();
  if (!token) { toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> أدخل Fonnte Token في الإعدادات أولاً'); if (btn) { btn.disabled=false; btn.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:5px;flex-shrink:0"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> تحديث من WhatsApp'; } return; }

  try {
    toast('<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ جلب المجموعات من WhatsApp… قد يستغرق بضع ثوانٍ');
    await fetch('https://api.fonnte.com/fetch-group', {
      method: 'POST',
      headers: { 'Authorization': token },
    });
  } catch(e) { /* non-fatal */ }

  await waLoadFonnteGroups();
  if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> تحديث من WhatsApp'; }
  toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم تحديث قائمة المجموعات');
}

function waRenderFonnteGroups(groups, errorType) {
  const el = document.getElementById('waGroupsList');
  if (!el) return;

  if (errorType === 'no-token') {
    el.innerHTML = `
      <div class="wa-fg-error">
        <div class="wa-fg-error-icon">🔑</div>
        <div class="wa-fg-error-title">لا يوجد Fonnte Token</div>
        <div class="wa-fg-error-sub">أضف الـ Token في صفحة الإعدادات (إعدادات واتساب) ثم حاول مجدداً.</div>
        <button class="btn-secondary" onclick="navigate('settings')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> الإعدادات</button>
      </div>`;
    return;
  }

  if (errorType === 'network') {
    el.innerHTML = `
      <div class="wa-fg-error">
        <div class="wa-fg-error-icon">📡</div>
        <div class="wa-fg-error-title">تعذّر الاتصال بـ Fonnte</div>
        <div class="wa-fg-error-sub">تأكد من الاتصال بالإنترنت وصحة الـ Token، ثم اضغط تحديث.</div>
      </div>`;
    return;
  }

  if (errorType) {
    // e.g. "cannot fetch with disconnected device"
    el.innerHTML = `
      <div class="wa-fg-error">
        <div class="wa-fg-error-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
        <div class="wa-fg-error-title">خطأ من Fonnte</div>
        <div class="wa-fg-error-sub">${errorType}</div>
        <div class="wa-fg-error-hint">إذا لم تُحدِّث قائمة المجموعات من قبل، اضغط «تحديث من WhatsApp» أعلاه.</div>
      </div>`;
    return;
  }

  if (!groups || groups.length === 0) {
    el.innerHTML = `
      <div class="wa-empty">
        <div class="wa-empty-icon">👥</div>
        <div class="wa-empty-title">لا توجد مجموعات</div>
        <div class="wa-empty-sub">اضغط «تحديث من WhatsApp» لجلب المجموعات التي أنت فيها من Fonnte.</div>
      </div>`;
    return;
  }

  el.innerHTML = groups.map(g => `
    <div class="wa-fg-card">
      <div class="wa-fg-card-icon">👥</div>
      <div class="wa-fg-card-info">
        <div class="wa-fg-card-name">${g.name}</div>
        <div class="wa-fg-card-id" dir="ltr">${g.id}</div>
      </div>
      <div class="wa-fg-card-actions">
        <button class="wa-fg-btn wa-fg-send"     onclick="waFgSendNow('${g.id}', '${g.name.replace(/'/g,'\\\'')}')"    title="إرسال الآن">📤 إرسال</button>
        <button class="wa-fg-btn wa-fg-schedule" onclick="waFgSchedule('${g.id}', '${g.name.replace(/'/g,'\\\'')}')"  title="جدولة رسالة"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> جدولة</button>
      </div>
    </div>
  `).join('');
}

// إرسال الآن: انتقل لتبويب الإرسال مع ملء معرّف المجموعة
function waFgSendNow(groupId, groupName) {
  waShowTab('send');
  const inp = document.getElementById('waGroupChatId');
  const lbl = document.getElementById('waGroupChatLabel');
  if (inp) {
    inp.value = groupId;
    // Highlight it briefly
    inp.style.transition = 'box-shadow 0.3s';
    inp.style.boxShadow  = '0 0 0 3px var(--primary-l)';
    setTimeout(() => { inp.style.boxShadow = ''; }, 1200);
  }
  if (lbl) lbl.textContent = `💬 إرسال لـ: ${groupName}`;
  document.getElementById('waGroupChatMsg')?.focus();
  toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg> تم تحديد: ${groupName}`);
}

// جدولة: افتح نافذة حدث التقويم مع ملء المعلومات
function waFgSchedule(groupId, groupName) {
  openCalEventModal(null, null, null, true);
  setTimeout(() => {
    const titleEl = document.getElementById('calEventTitle');
    if (titleEl && !titleEl.value) titleEl.value = `رسالة لـ ${groupName}`;

    // Add the group directly into _calWaRows so validation passes
    if (!_calWaRows.find(r => r.phone === groupId)) {
      _calWaRows.push({ name: groupName, phone: groupId, isGroup: true });
      _renderCalWaRows();
    }

    _waFgPendingGroupId   = groupId;
    _waFgPendingGroupName = groupName;

    const body = document.querySelector('#calEventModal .modal-body');
    if (body && !document.getElementById('waFgGroupHint')) {
      const hint = document.createElement('div');
      hint.id        = 'waFgGroupHint';
      hint.className = 'wa-fg-modal-hint';
      hint.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> ستُرسَل هذه الرسالة لمجموعة: <strong>${groupName}</strong>`;
      body.insertBefore(hint, body.firstChild);
    }
  }, 120);
}

let _waFgPendingGroupId   = null;
let _waFgPendingGroupName = null;

// Keep old group functions for the contact-group picker in send tab
function waMemberRowHTML(i, name='', phone='') {
  return `<div class="wa-member-row" id="wmr-${i}">
    <input type="text" class="wm-name"  placeholder="الاسم" value="${name}"  />
    <input type="tel"  class="wm-phone" placeholder="رقم الواتساب" value="${phone}" dir="ltr" />
    <button class="wa-rec-del" onclick="this.parentElement.remove()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
  </div>`;
}
function waAddMemberRow() {
  const list = document.getElementById('waGroupMembersList');
  const idx  = list.children.length;
  list.insertAdjacentHTML('beforeend', waMemberRowHTML(idx));
}
function waImportFromClass() {
  const sel = document.getElementById('waImportClassSel');
  sel.classList.toggle('hidden');
  if (!sel.classList.contains('hidden')) {
    sel.innerHTML = '<option value="">— اختر الحلقة —</option>' +
      state.classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }
}
function waDoImportClass() {
  const classId = document.getElementById('waImportClassSel').value;
  if (!classId) return;
  const students = state.students.filter(s => s.classId === classId && s.parentPhone);
  const list = document.getElementById('waGroupMembersList');
  students.forEach(s => {
    const idx = list.children.length;
    list.insertAdjacentHTML('beforeend', waMemberRowHTML(idx, s.name, s.parentPhone));
  });
  document.getElementById('waImportClassSel').classList.add('hidden');
  document.getElementById('waImportClassSel').value = '';
  toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم استيراد ${students.length} طالب`);
}
async function waSaveGroup() {
  const name = document.getElementById('waGroupName').value.trim();
  if (!name) { toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> أدخل اسم المجموعة'); return; }
  const rows = document.querySelectorAll('#waGroupMembersList .wa-member-row');
  const members = [...rows].map(row => ({
    name:  row.querySelector('.wm-name')?.value?.trim()  || '',
    phone: row.querySelector('.wm-phone')?.value?.trim() || '',
  })).filter(m => m.phone);
  if (_editingGroupId) {
    await apiFetch(`/whatsapp/groups/${_editingGroupId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,members}) });
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم تحديث المجموعة');
  } else {
    await apiFetch('/whatsapp/groups', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,members}) });
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم إنشاء المجموعة');
  }
  closeModal('waGroupModal');
  await waLoadGroups();
}
async function waDeleteGroup(id) {
  const g = _waGroupsData.find(x => x.id === id);
  if (!confirm(`حذف مجموعة "${g?.name}"؟`)) return;
  await apiFetch(`/whatsapp/groups/${id}`, { method:'DELETE' });
  toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> تم الحذف');
  await waLoadGroups();
}
function waSendToGroup(id) {
  const g = _waGroupsData.find(x => x.id === id);
  if (!g) return;
  _waComposeRecipients = g.members.map(m => ({...m}));
  waRenderComposeRecipients();
  waShowTab('send');
  document.getElementById('waCustomMsg')?.focus();
}

// ══════════════════════════════════════════════════════════════════
//  تبويب: السجل
// ══════════════════════════════════════════════════════════════════
// ── Bulk select state ───────────────────────────────────────────────
let _waLogSelected = new Set();   // set of entry IDs

function _waLogUpdateBulkBar() {
  const bar = document.getElementById('waLogBulkBar');
  const cnt = document.getElementById('waLogBulkCount');
  const btn = document.getElementById('waLogBulkDeleteBtn');
  const anySelected = _waLogSelected.size > 0;
  if (bar) bar.classList.toggle('hidden', !anySelected);
  if (cnt) cnt.textContent = _waLogSelected.size + ' محدد';
  if (btn) btn.disabled = !anySelected;
}

function waLogToggleItem(id) {
  if (_waLogSelected.has(id)) _waLogSelected.delete(id);
  else _waLogSelected.add(id);
  const el = document.querySelector(`[data-log-id="${CSS.escape(id)}"]`);
  if (el) el.classList.toggle('wa-log-item-selected', _waLogSelected.has(id));
  const cb = el?.querySelector('.wa-log-cb');
  if (cb) cb.checked = _waLogSelected.has(id);
  _waLogUpdateBulkBar();
}

function waLogSelectAll() {
  const items = document.querySelectorAll('#waLogList .wa-log-item[data-log-id]');
  const allSelected = items.length > 0 && _waLogSelected.size === items.length;
  _waLogSelected.clear();
  if (!allSelected) items.forEach(el => _waLogSelected.add(el.dataset.logId));
  items.forEach(el => {
    const sel = _waLogSelected.has(el.dataset.logId);
    el.classList.toggle('wa-log-item-selected', sel);
    const cb = el.querySelector('.wa-log-cb');
    if (cb) cb.checked = sel;
  });
  _waLogUpdateBulkBar();
}

async function waLogDeleteSelected() {
  if (_waLogSelected.size === 0) return;
  if (!confirm(`حذف ${_waLogSelected.size} رسالة؟`)) return;
  const btn = document.getElementById('waLogBulkDeleteBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ الحذف…'; }

  for (const id of [..._waLogSelected]) {
    if (id.startsWith('sched_')) {
      await apiFetch(`/calendar/${id.replace('sched_','')}`, { method: 'DELETE' });
      _waSchedData = _waSchedData.filter(e => 'sched_'+e.id !== id);
    } else {
      await apiFetch(`/whatsapp/log/${id}`, { method: 'DELETE' });
      _waLogData = _waLogData.filter(l => l.id !== id);
    }
  }
  const count = _waLogSelected.size;
  _waLogSelected.clear();
  if (btn) { btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> حذف المحدد'; }
  waRenderLog();
  toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> تم حذف ${count} رسالة`);
}

function waRenderLog() {
  const el          = document.getElementById('waLogList');
  const filter      = document.getElementById('waLogFilter')?.value || '';
  const hideCustom  = document.getElementById('waLogHideCustom')?.checked || false;
  if (!el) return;

  // ── Merge real log entries with scheduled messages ──────────────
  const today   = todayISO();
  const nowTime = new Date().toTimeString().slice(0, 5);

  // Scheduled messages from calendar (type==='message')
  // Build per-eventId map from real waLog entries for accurate status
  const schedLogMap = {};
  (_waLogData || []).filter(l => l.type === 'scheduled' && l.eventId).forEach(l => {
    if (!schedLogMap[l.eventId]) schedLogMap[l.eventId] = [];
    schedLogMap[l.eventId].push(l);
  });

  const schedEntries = _waSchedData.map(ev => {
    const isPastDate        = ev.date < today || (ev.date === today && ev.time && ev.time <= nowTime);
    const isFonnteScheduled = ev.fonnteScheduled?.length > 0;
    const logEntries        = schedLogMap[ev.id] || [];
    const failedEntries     = logEntries.filter(l => l.status === 'failed');
    const totalTargets      = (ev.waTargets || []).length;
    let status, errorSummary = null;

    if (logEntries.length > 0) {
      if (failedEntries.length === logEntries.length) {
        status = 'failed';
        const reasons = [...new Set(failedEntries.map(l => l.error).filter(Boolean))];
        errorSummary = reasons.length ? reasons.join(' | ') : 'فشل الإرسال لجميع المستلمين';
      } else if (failedEntries.length > 0) {
        status = 'partial';
        const reasons = [...new Set(failedEntries.map(l => l.error).filter(Boolean))];
        errorSummary = failedEntries.length + ' من أصل ' + logEntries.length + ' فشلت' + (reasons.length ? ': ' + reasons[0] : '');
      } else {
        status = isPastDate ? 'sent' : 'waiting';
      }
    } else if (!isFonnteScheduled) {
      status = isPastDate ? 'failed' : 'not_scheduled';
      if (isPastDate) errorSummary = 'لم يتم الجدولة على Fonnte';
    } else {
      status = isPastDate ? 'sent' : 'waiting';
    }

    return {
      id:           'sched_' + ev.id,
      type:         'scheduled',
      status,
      studentName:  ev.title || '—',
      phone:        totalTargets + ' مستلم',
      sentAt:       ev.date + (ev.time ? 'T' + ev.time : 'T00:00'),
      className:    '',
      error:        errorSummary,
      _isScheduled: true,
      _targets:     ev.waTargets || [],
      _msg:         ev.waMessage || '',
      _failCount:   failedEntries.length,
      _totalCount:  logEntries.length || totalTargets,
    };
  });

  // Combine, real log first (newest first), scheduled below
  let combined = [
    ...[...(_waLogData || [])].reverse(),
    ...schedEntries,
  ];

  // ── Apply filters ────────────────────────────────────────────────
  if (hideCustom)             combined = combined.filter(l => l.type !== 'custom');
  if (filter === 'absence')   combined = combined.filter(l => l.type === 'absence');
  if (filter === 'custom')    combined = combined.filter(l => l.type === 'custom');
  if (filter === 'scheduled') combined = combined.filter(l => l.type === 'scheduled');
  if (filter === 'sent')      combined = combined.filter(l => l.status === 'sent');
  if (filter === 'failed')    combined = combined.filter(l => l.status === 'failed');
  if (filter === 'pending')   combined = combined.filter(l => l.status === 'pending' || l.status === 'scheduled');

  if (combined.length === 0) {
    el.innerHTML = `
      <div class="wa-empty">
        <div class="wa-empty-icon">🕐</div>
        <div class="wa-empty-title">السجل فارغ</div>
        <div class="wa-empty-sub">ستظهر هنا كل الرسائل المرسلة والمجدولة</div>
      </div>`;
    return;
  }

  el.innerHTML = combined.map(entry => {
    const isAbsence   = entry.type === 'absence';
    const isScheduled = entry.type === 'scheduled';

    // Status styling
    let statusClass, dotClass, statusLabel;
    if (entry.status === 'sent') {
      statusClass = 'wa-log-sent';    dotClass = 'wa-dot-sent';    statusLabel = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> أُرسلت';
    } else if (entry.status === 'failed') {
      statusClass = 'wa-log-failed';  dotClass = 'wa-dot-failed';  statusLabel = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> فشلت';
    } else if (entry.status === 'partial') {
      statusClass = 'wa-log-partial'; dotClass = 'wa-dot-partial'; statusLabel = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> جزئي — ' + (entry._failCount||'?') + '/' + (entry._totalCount||'?') + ' فشلت';
    } else if (entry.status === 'waiting') {
      statusClass = 'wa-log-waiting'; dotClass = 'wa-dot-waiting'; statusLabel = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> في انتظار الإرسال';
    } else if (entry.status === 'not_scheduled') {
      statusClass = 'wa-log-failed';  dotClass = 'wa-dot-failed';  statusLabel = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> لم يُجدَّل';
    } else if (entry.status === 'scheduled') {
      statusClass = 'wa-log-waiting'; dotClass = 'wa-dot-waiting'; statusLabel = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> في انتظار الإرسال';
    } else if (entry.status === 'expired') {
      statusClass = 'wa-log-sent';    dotClass = 'wa-dot-sent';    statusLabel = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> أُرسلت';
    } else {
      statusClass = 'wa-log-waiting'; dotClass = 'wa-dot-waiting'; statusLabel = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> في انتظار الإرسال';
    }

    // Type badge
    let typeBadge;
    if      (isAbsence)   typeBadge = `<span class="wa-log-type-badge wa-badge-absence">غياب</span>`;
    else if (isScheduled) typeBadge = `<span class="wa-log-type-badge wa-badge-sched">مجدولة</span>`;
    else                  typeBadge = `<span class="wa-log-type-badge wa-badge-custom">مخصص</span>`;

    const timeStr = entry.sentAt
      ? new Date(entry.sentAt).toLocaleString('ar-SA', {hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'})
      : '—';

    const deleteBtn = entry._isScheduled
      ? `<button class="wa-log-del" onclick="waDeleteScheduled('${entry.id.replace('sched_','')}'); waRenderLog();" title="حذف"><span class="ui-ic ic-red"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span></button>`
      : `<button class="wa-log-del" onclick="waDeleteLogEntry('${entry.id}')" title="حذف"><span class="ui-ic ic-red"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span></button>`;

    const isSelected = _waLogSelected.has(entry.id);
    const cbHtml = `<label class="wa-log-cb-wrap" onclick="event.stopPropagation()"><input type="checkbox" class="wa-log-cb" data-id="${entry.id}" ${isSelected?'checked':''} onchange="waLogToggleItem('${entry.id}')" /></label>`;

    return `
      <div class="wa-log-item ${statusClass}${isSelected?' wa-log-item-selected':''}" data-log-id="${entry.id}">
        ${cbHtml}
        <div class="wa-log-item-left">
          <div class="wa-log-status-dot ${dotClass}"></div>
          <div class="wa-log-content">
            <div class="wa-log-recipient">
              ${typeBadge}
              <span class="wa-log-status-pill">${statusLabel}</span>
              ${entry.studentName || entry.phone}
            </div>
            <div class="wa-log-meta">
              ${entry.phone}${entry.className ? ' · ' + entry.className : ''} · ${timeStr}
            </div>
            ${(entry.status === 'failed' || entry.status === 'partial' || entry.status === 'not_scheduled') && entry.error ? `<div class="wa-log-error"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> ${entry.error}</div>` : ''}
            ${isScheduled && entry._msg ? `<div class="wa-log-sched-preview">${entry._msg.slice(0,60)}${entry._msg.length>60?'…':''}</div>` : ''}
          </div>
        </div>
        ${deleteBtn}
      </div>
    `;
  }).join('');
}

async function waDeleteLogEntry(id) {
  await apiFetch(`/whatsapp/log/${id}`, { method: 'DELETE' });
  _waLogData = _waLogData.filter(l => l.id !== id);
  waRenderLog();
}

async function waClearLog() {
  if (!confirm('مسح كامل السجل؟')) return;
  await apiFetch('/whatsapp/log', { method: 'DELETE' });
  _waLogData = [];
  waRenderLog();
  toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> تم مسح السجل');
}

// ── مساعد تنسيق التاريخ ──────────────────────────────────────────
function formatDateAr(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ar-SA', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

// ══════════════════════════════════════════════════════════════════
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
  const currentHijri = toHijri(todayISO());

  function buildMonthBlocks() {
    if (!monthlyHistory.length) return '<div class="info-banner">لا توجد سجلات حضور بعد.</div>';
    return monthlyHistory.map(mon => {
      const isCurrent = mon.year===currentHijri.year && mon.month===currentHijri.month;
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
      return `<div class="tp-month-block ${isCurrent?'tp-month-current':''}">
        <div class="tp-month-header" onclick="tpToggleMonth('${bid}')">
          <div class="tp-month-header-right">
            <span class="tp-month-name">${mon.monthName} ${mon.year}هـ</span>
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
//  طباعة ملف المعلم
// ════════════════════════════════════════════════════════
async function printTeacherProfile(teacherId) {
  const t = await apiFetch(`/teachers/${teacherId}`);
  if (!t) return;

  const school      = state.settings?.schoolName || 'حضور الحلقات';
  const subtitle    = state.settings?.subtitle   || '';
  const logos       = state.settings?.logos      || [];
  const logoUrl     = logos.length ? logos[0].url : null;
  const initials    = t.name.trim().split(' ').map(w => w[0]).slice(0, 2).join('');
  const totalMins   = t.totalMins   || 0;
  const monthlyMins = t.monthlyMins || 0;
  const todayMins   = t.todayMins   || 0;
  const days        = t.daysPresent || 0;
  const monthlyHistory = t.monthlyHistory || [];

  function fmtDur(m) {
    if (!m || m <= 0) return '—';
    const h = Math.floor(m / 60), min = m % 60;
    return h > 0 ? h + 'س' + (min ? ' ' + min + 'د' : '') : min + 'د';
  }

  const DAY_AR = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

  const logRows = monthlyHistory.flatMap((mon, mi) =>
    mon.logs.map((l, li) => {
      const d   = new Date(l.date + 'T00:00:00');
      const dur = l.durationMins > 0 ? fmtDur(l.durationMins) : (l.checkIn && !l.checkOut ? 'جارٍ' : '—');
      const done = !!l.checkOut;
      const rowIdx = monthlyHistory.slice(0, mi).reduce((a, mm) => a + mm.logs.length, 0) + li;
      return `<tr class="${rowIdx % 2 === 0 ? 'row-even' : ''}">
        <td>${formatDateDisplay(l.date)}</td>
        <td>${DAY_AR[d.getDay()] || ''}</td>
        <td>${l.checkIn || '—'}</td>
        <td>${l.checkOut || '—'}</td>
        <td style="font-weight:800">${dur}</td>
        <td><span class="badge" style="background:${done ? '#dcfce7' : '#fef3c7'};color:${done ? '#15803d' : '#92400e'}">${done ? 'اكتمل' : 'حاضر'}</span></td>
      </tr>`;
    })
  ).join('');

  const avatarHtml = t.photo
    ? `<img src="${t.photo}" class="avatar-img" alt="${t.name}" />`
    : `<div class="avatar-placeholder">${initials}</div>`;

  const todayLog    = (t.log || []).find(l => l.date === todayISO());
  const todayStatus = todayLog
    ? (todayLog.checkOut
        ? `انصرف الساعة ${todayLog.checkOut}`
        : `حاضر منذ ${todayLog.checkIn}`)
    : 'لم يسجّل الحضور اليوم';
  const todayDone = todayLog?.checkOut;

  const metaItems = [
    t.subject   && `<div class="meta-item"><span class="meta-icon">📚</span>${t.subject}</div>`,
    t.teacherId && `<div class="meta-item"><span class="meta-icon">#</span>${t.teacherId}</div>`,
    t.phone     && `<div class="meta-item"><span class="meta-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></span>${t.phone}</div>`,
  ].filter(Boolean).join('');

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>ملف المعلم — ${t.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Tajawal', 'Segoe UI', Arial, sans-serif;
    background: #fff; color: #1e293b; font-size: 13px; line-height: 1.5;
  }
  .page {
    width: 210mm; min-height: 297mm;
    padding: 14mm 16mm 10mm;
    margin: 0 auto;
    display: flex; flex-direction: column; gap: 12px;
  }

  /* ── BANNER ── */
  .banner {
    display: flex; justify-content: space-between; align-items: center;
    background: #14532d; color: #fff;
    border-radius: 12px; padding: 12px 18px;
  }
  .banner-right { display: flex; align-items: center; gap: 12px; }
  .banner-logo  { width: 48px; height: 48px; object-fit: contain; background: #fff; border-radius: 8px; padding: 3px; flex-shrink: 0; }
  .banner-school-name { font-size: 17px; font-weight: 900; }
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
  .avatar-img         { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 3px solid #15803d; }
  .avatar-placeholder { width: 72px; height: 72px; border-radius: 50%; background: #dcfce7; color: #15803d; font-size: 28px; font-weight: 900; display: flex; align-items: center; justify-content: center; border: 3px solid #15803d; }
  .id-info  { flex: 1; }
  .id-name  { font-size: 21px; font-weight: 900; color: #14532d; margin-bottom: 8px; }
  .id-meta  { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-bottom: 8px; }
  .meta-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #475569; }
  .meta-icon { font-size: 13px; }
  .today-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 700;
    background: ${todayDone ? '#dcfce7' : todayLog ? '#fef3c7' : '#f1f5f9'};
    color: ${todayDone ? '#15803d' : todayLog ? '#92400e' : '#64748b'};
    border: 1.5px solid ${todayDone ? '#86efac' : todayLog ? '#fde68a' : '#e2e8f0'};
  }

  /* ── STATS STRIP ── */
  .stats-strip { display: flex; gap: 8px; }
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
    font-size: 13px; font-weight: 800; color: #14532d;
    padding: 7px 12px; background: #f0fdf4;
    border-radius: 8px; border-right: 4px solid #15803d;
    margin-top: 4px;
  }

  /* ── TABLE ── */
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th {
    background: #14532d; color: #fff;
    padding: 8px 10px; text-align: right; font-weight: 700; font-size: 12px;
  }
  thead th:first-child { border-radius: 0 6px 6px 0; }
  thead th:last-child  { border-radius: 6px 0 0 6px; }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  tbody tr.row-even td { background: #f8fafc; }
  tbody tr:last-child td { border-bottom: none; }

  /* ── BADGE ── */
  .badge {
    display: inline-block; padding: 3px 10px; border-radius: 20px;
    font-size: 11px; font-weight: 700; white-space: nowrap;
  }

  /* ── SIGNATURE ROW ── */
  .sig-row { display: flex; gap: 16px; margin-top: auto; padding-top: 8px; }
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
<body>
<div class="page">

  <!-- ── BANNER ── -->
  <div class="banner">
    <div class="banner-right">
      ${logoUrl ? `<img src="${logoUrl}" class="banner-logo" alt="logo" />` : ''}
      <div class="banner-school">
        <div class="banner-school-name">${school}</div>
        ${subtitle ? `<div class="banner-subtitle">${subtitle}</div>` : ''}
      </div>
    </div>
    <div class="banner-left">
      <div class="banner-doc-type">ملف المعلم</div>
      <div class="banner-date">${formatDateDisplay(todayISO())}</div>
    </div>
  </div>

  <!-- ── IDENTITY CARD ── -->
  <div class="id-card">
    <div class="id-avatar">${avatarHtml}</div>
    <div class="id-info">
      <div class="id-name">${t.name}</div>
      <div class="id-meta">${metaItems}</div>
      <span class="today-pill">🕐 ${todayStatus}</span>
    </div>
  </div>

  <!-- ── STATS STRIP ── -->
  <div class="stats-strip">
    <div class="stat-cell" style="border-color:#15803d">
      <div class="stat-num" style="color:#15803d">${days}</div>
      <div class="stat-lbl">أيام الحضور</div>
    </div>
    <div class="stat-cell" style="border-color:#1d4ed8">
      <div class="stat-num" style="color:#1d4ed8">${fmtDur(monthlyMins)}</div>
      <div class="stat-lbl">هذا الشهر</div>
    </div>
    <div class="stat-cell" style="border-color:#d97706">
      <div class="stat-num" style="color:#d97706">${fmtDur(todayMins)}</div>
      <div class="stat-lbl">اليوم</div>
    </div>
    <div class="stat-cell" style="border-color:#7c3aed">
      <div class="stat-num" style="color:#7c3aed">${fmtDur(totalMins)}</div>
      <div class="stat-lbl">الإجمالي</div>
    </div>
  </div>

  <!-- ── ATTENDANCE TABLE ── -->
  ${logRows ? `
  <div class="section-hdr"><span class="ui-ic ic-blue" style="display:inline-flex;align-items:center;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span> سجل الحضور الشهري</div>
  <table>
    <thead><tr><th>التاريخ الهجري</th><th>اليوم</th><th>وقت الحضور</th><th>وقت الانصراف</th><th>المدة</th><th>الحالة</th></tr></thead>
    <tbody>${logRows}</tbody>
  </table>` : `<div class="empty-note">لا توجد سجلات حضور بعد.</div>`}

  <!-- ── SIGNATURE ROW ── -->
  <div class="sig-row">
    <div class="sig-box"><div class="sig-line"></div><div class="sig-label">توقيع المعلم</div></div>
    <div class="sig-box"><div class="sig-line"></div><div class="sig-label">توقيع المدير</div></div>
    <div class="sig-box"><div class="sig-line"></div><div class="sig-label">ختم المنشأة</div></div>
  </div>

  <!-- ── FOOTER ── -->
  <div class="footer">
    <span>${school}</span>
    <span>·</span>
    <span>تاريخ الطباعة: ${formatDateDisplay(todayISO())}</span>
    <span>·</span>
    <span>إجمالي ساعات الحضور: ${fmtDur(totalMins)}</span>
  </div>

</div>
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 800);
}

// ══════════════════════════════════════════════════════════════════
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
// _attEditData declared in students.js
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
//  WA Group Chat — Send ONE message to a WhatsApp group chat ID
// ══════════════════════════════════════════════════════════════════
async function waSendGroupChat() {
  const groupId = document.getElementById('waGroupChatId')?.value?.trim();
  const message = document.getElementById('waGroupChatMsg')?.value?.trim();
  const status  = document.getElementById('waGroupChatStatus');
  const btn     = document.getElementById('waGroupChatSendBtn');

  if (!groupId) { toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> أدخل معرّف مجموعة واتساب'); return; }
  if (!message) { toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> الرسالة فارغة'); return; }

  btn.disabled = true;
  if (status) { status.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ الإرسال…'; status.className = 'wa-compose-status'; }

  const res = await apiFetch('/whatsapp/send-group-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, message }),
  });

  if (res?.ok) {
    if (status) { status.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم الإرسال بنجاح'; status.className = 'wa-compose-status wa-status-ok-text'; }
    toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم إرسال الرسالة للمجموعة');
    await waLoadLog();
  } else {
    if (status) { status.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ${res?.error||'فشل الإرسال'}`; status.className = 'wa-compose-status wa-status-fail-text'; }
    toast(`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ${res?.error||'فشل'}`);
    showWaFailNotif('رسالة مجموعة', 0, res?.error || 'فشل الإرسال');
  }
  btn.disabled = false;
}
// ══════════════════════════════════════════════════════════════════

//  واتساب — تبويب الرسائل المجدولة
// ════════════════════════════════════════════════════════

let _waSchedData = [];

async function waLoadScheduled() {
  const data = await apiFetch('/calendar');
  _waSchedData = (data || []).filter(e => e.type === 'message');
  waRenderScheduled();
}

function waRenderScheduled() {
  const list = document.getElementById('waSchedList');
  if (!list) return;

  const today    = todayISO();
  const nowTime  = new Date().toTimeString().slice(0,5); // "HH:MM"
  const all      = [..._waSchedData].sort((a, b) => a.date.localeCompare(b.date));

  // "Past" = date before today, OR same day but time has already passed
  const isPast = ev => {
    if (ev.date < today) return true;
    if (ev.date === today && ev.time && ev.time <= nowTime) return true;
    return false;
  };

  const upcoming = all.filter(ev => !isPast(ev));
  const past     = all.filter(ev =>  isPast(ev));
  // Legacy "sent via Fonnte" stays labelled differently
  const sent     = past.filter(ev => ev.fonnteScheduled?.length);
  const expired  = past.filter(ev => !ev.fonnteScheduled?.length);

  // Render mini calendar of upcoming messages
  const miniCal = _buildWaSchedMiniCal(upcoming);

  const cardHTML = (ev, isSent, isExpired) => {
    let statusIcon;
    if (isSent)    statusIcon = 'أُرسلت';
    else if (isExpired) statusIcon = 'انتهى وقتها';
    else           statusIcon = ev.fonnteScheduled?.length ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> مجدول` : `<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> في الانتظار`;

    const isPastCard = isSent || isExpired;
    const targets = (ev.waTargets || []).length;
    return `
    <div class="wa-sched-card${isPastCard?' wa-sched-card-sent wa-sched-card-past':''}">
      <div class="wa-sched-card-top">
        <div class="wa-sched-info">
          <div class="wa-sched-title">${ev.title || '—'}</div>
          <div class="wa-sched-meta">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${formatDateDisplay(ev.date)}${ev.time ? ' · ⏰ ' + ev.time : ''} · <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> ${targets} مستلم
          </div>
          <div class="wa-sched-msg">${(ev.waMessage||'').slice(0,80)}${ev.waMessage?.length>80?'…':''}</div>
        </div>
        <span class="wa-sched-badge${isPastCard?' wa-sched-badge-past':''}">${statusIcon}</span>
      </div>
      <div class="wa-sched-actions">
        ${isPastCard ? '' : `<button class="btn-secondary" style="font-size:12px" onclick="waEditScheduled('${ev.id}')"><span class="ui-ic ic-blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span> تعديل</button>`}
        <button class="btn-danger" style="font-size:12px;padding:6px 12px" onclick="waDeleteScheduled('${ev.id}')"><span class="ui-ic ic-red"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span> حذف</button>
      </div>
    </div>`;
  };

  let html = miniCal;

  if (!upcoming.length && !past.length) {
    html += '<div class="info-banner">لا توجد رسائل مجدولة. اضغط «رسالة جديدة» للإضافة.</div>';
  } else {
    if (upcoming.length) {
      html += `<div class="wa-sched-section-title"><span class="ui-ic ic-blue" style="display:inline-flex;align-items:center;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span> قادمة (${upcoming.length})</div>`;
      html += upcoming.map(ev => cardHTML(ev, false, false)).join('');
    }
    if (expired.length) {
      html += `<div class="wa-sched-section-title wa-sched-sent-hdr"><span class="ui-ic ic-green" style="display:inline-flex;align-items:center;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span> انتهى وقتها (${expired.length})</div>`;
      html += expired.map(ev => cardHTML(ev, false, true)).join('');
    }
    if (sent.length) {
      html += `<div class="wa-sched-section-title wa-sched-sent-hdr"><span class="ui-ic ic-green" style="display:inline-flex;align-items:center;vertical-align:middle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span> أُرسلت عبر Fonnte (${sent.length})</div>`;
      html += sent.map(ev => cardHTML(ev, true, false)).join('');
    }
  }
  list.innerHTML = html;
}

function _buildWaSchedMiniCal(events) {
  if (!events.length) return '';
  const today = todayISO();
  // Use current Gregorian month/year
  const now   = new Date();
  const year  = now.getFullYear(), month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = now.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });

  // Build set of dates with events
  const evDates = new Set(events.map(e => e.date));

  let cells = '';
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) cells += '<div class="wmc-cell wmc-empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const hasEv = evDates.has(iso);
    const isToday = iso === today;
    const cls = ['wmc-cell', hasEv?'wmc-has-ev':'', isToday?'wmc-today':''].filter(Boolean).join(' ');
    cells += `<div class="${cls}" title="${hasEv ? events.filter(e=>e.date===iso).map(e=>e.title).join('، ') : ''}">${d}${hasEv?'<span class="wmc-dot"></span>':''}</div>`;
  }
  const dayNames = ['أح','اث','ث','أر','خ','ج','س'];
  return `
  <div class="wmc-wrap">
    <div class="wmc-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${monthName}</div>
    <div class="wmc-dow">${dayNames.map(d=>`<div>${d}</div>`).join('')}</div>
    <div class="wmc-grid">${cells}</div>
  </div>`;
}

function waOpenNewScheduled() {
  openCalEventModal(null, null, null, true);  // waMode=true locks to message type
}

function waEditScheduled(id) {
  openCalEventModal(id, null, null, true);    // waMode=true even when editing
}

async function waDeleteScheduled(id) {
  const ev = _waSchedData.find(e => e.id === id);
  if (!ev) return;
  const label = ev.groupId
    ? `هذه الرسالة جزء من سلسلة. حذف السلسلة كاملة؟`
    : `هل تريد حذف رسالة "${ev.title}"؟`;
  if (!confirm(label)) return;
  const url = ev.groupId ? `/calendar/${id}?all=1` : `/calendar/${id}`;
  await apiFetch(url, { method: 'DELETE' });
  toast('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> تم حذف الرسالة المجدولة');
  await waLoadScheduled();
}

// Refresh scheduled list after saving a calendar event (called from saveCalEvent)
async function _waMaybeRefreshScheduled() {
  if (document.getElementById('waTab-scheduled') &&
      !document.getElementById('waTab-scheduled').classList.contains('hidden')) {
    await waLoadScheduled();
  }
}

// ════════════════════════════════════════════════════════

//  Fonnte — ربط واتساب عبر QR Code
// ════════════════════════════════════════════════════════

let _waQrAutoRefresh = null; // interval for auto-refreshing QR

async function fonnteLoadQR() {
  var statusEl    = document.getElementById('waQrStatus');
  var panel       = document.getElementById('waQrPanel');
  var spinner     = document.getElementById('waQrSpinner');
  var imgEl       = document.getElementById('waQrImage');
  var expiryEl    = document.getElementById('waQrExpiry');
  var instrEl     = document.getElementById('waQrInstructions');
  var btn         = document.getElementById('waQrRefreshBtn');

  // Show panel, hide image, show spinner
  if (panel)   panel.classList.remove('hidden');
  if (spinner) { spinner.classList.remove('hidden'); spinner.textContent = 'جارٍ تحميل رمز QR…'; }
  if (imgEl)   imgEl.classList.add('hidden');
  if (expiryEl)expiryEl.classList.add('hidden');
  if (instrEl) instrEl.classList.add('hidden');
  if (statusEl){ statusEl.textContent = ''; }
  if (btn)     { btn.disabled = true; btn.textContent = 'جارٍ التحميل…'; }

  try {
    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); }, 12000);
    var res  = await fetch('/api/fonnte/qr', { signal: controller.signal });
    clearTimeout(timer);
    var data = await res.json();
    console.log('[fonnte/qr]', data);

    if (data.status === true && (data.url || data.base64)) {
      if (spinner) spinner.classList.add('hidden');
      if (imgEl) {
        imgEl.src = 'data:image/png;base64,' + (data.url || data.base64);
        imgEl.classList.remove('hidden');
      }
      if (expiryEl) { expiryEl.textContent = 'رمز QR صالح لمدة 60 ثانية — اضغط تحديث QR إن انتهت الصلاحية'; expiryEl.classList.remove('hidden'); }
      if (instrEl)  instrEl.classList.remove('hidden');
      if (statusEl) { statusEl.style.color = 'var(--success)'; statusEl.textContent = 'امسح رمز QR بواتساب الآن'; }
    } else if (data.status === false && data.reason && data.reason.indexOf('already connect') !== -1) {
      if (spinner) { spinner.classList.remove('hidden'); spinner.textContent = ''; }
      if (statusEl) { statusEl.style.color = 'var(--success)'; statusEl.textContent = 'الجهاز مرتبط بالفعل — لا حاجة لمسح QR'; }
    } else {
      if (spinner) { spinner.classList.remove('hidden'); spinner.textContent = ''; }
      var msg = data.reason || data.detail || data.message || JSON.stringify(data).slice(0, 100);
      if (statusEl) { statusEl.style.color = 'var(--error)'; statusEl.textContent = msg; }
      console.error('[fonnte/qr] unexpected:', data);
    }
  } catch(e) {
    console.error('[fonnte/qr] error:', e);
    if (spinner) { spinner.classList.remove('hidden'); spinner.textContent = ''; }
    if (statusEl) { statusEl.style.color = 'var(--error)'; statusEl.textContent = e.name === 'AbortError' ? 'انتهت مهلة الاتصال' : e.message; }
  }
  if (btn) { btn.disabled = false; btn.textContent = 'تحديث QR'; }
}

async function fonnteCheckStatus() {
  var statusEl = document.getElementById('waQrStatus');
  var btn      = document.getElementById('waQrStatusBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الفحص…'; }
  if (statusEl) { statusEl.style.color = 'var(--text2)'; statusEl.textContent = ''; }
  try {
    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); }, 10000);
    var res  = await fetch('/api/fonnte/device', { signal: controller.signal });
    clearTimeout(timer);
    var data = await res.json();
    console.log('[fonnte/device]', data);
    if (data.status === true) {
      var ds = (data.device_status || '').toLowerCase();
      fonnteShowDeviceCard(ds === 'connect' || ds === 'connected', data);
      if (statusEl) statusEl.textContent = '';
    } else {
      var msg = data.reason || data.detail || data.message || JSON.stringify(data).slice(0,120);
      if (statusEl) { statusEl.style.color = 'var(--error)'; statusEl.textContent = msg; }
    }
  } catch(e) {
    console.error('[fonnte/device] error:', e);
    if (statusEl) { statusEl.style.color = 'var(--error)'; statusEl.textContent = e.name === 'AbortError' ? 'انتهت مهلة الاتصال' : e.message; }
  }
  if (btn) { btn.disabled = false; btn.textContent = 'فحص حالة الجهاز'; }
}

function fonnteShowDeviceCard(connected, dev) {
  var bar      = document.getElementById('waDeviceStatusBar');
  var iconEl   = document.getElementById('waDeviceStatusIcon');
  var titleEl  = document.getElementById('waDeviceStatusText');
  var subEl    = document.getElementById('waDeviceStatusSub');
  var gridEl   = document.getElementById('waDeviceInfoGrid');
  if (!bar) return;

  // Show bar, set colour class
  bar.classList.remove('hidden', 'wa-device-connected', 'wa-device-disconnected');
  bar.classList.add(connected ? 'wa-device-connected' : 'wa-device-disconnected');

  if (iconEl)  iconEl.innerHTML   = connected ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>';
  if (titleEl) titleEl.textContent = connected ? 'واتساب متصل' : 'واتساب غير متصل';
  if (subEl)   subEl.textContent   = connected ? 'الجهاز مرتبط وجاهز للإرسال' : 'اضغط عرض رمز QR لربط واتساب';

  if (gridEl) {
    if (connected) {
      var phone  = dev.device  || '';
      var name   = dev.name    || '';
      var quota  = dev.quota   != null ? dev.quota + ' رسالة' : '—';
      var pkg    = dev.package || '—';
      var expiry = dev.expired || '—';
      var el;
      el = document.getElementById('waDvcName');  if (el) el.textContent = name + (phone ? ' (' + phone + ')' : '');
      el = document.getElementById('waDvcPkg');   if (el) el.textContent = pkg;
      el = document.getElementById('waDvcQuota'); if (el) el.textContent = quota;
      el = document.getElementById('waDvcExpiry');if (el) el.textContent = expiry;
      gridEl.classList.remove('hidden');
    } else {
      gridEl.classList.add('hidden');
    }
  }
}



/* ── modules/backup.js ── */
//  النسخ الاحتياطي والاستعادة والإعادة
// ══════════════════════════════════════════════════════════════════

// ── Download full backup ──────────────────────────────────────────
async function backupDownload() {
  const status = document.getElementById('backupStatus');
  status.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ التحضير…'; status.style.color = 'var(--text2)';
  try {
    const res = await fetch('/api/sync/export');
    if (!res.ok) throw new Error('فشل التنزيل');
    const blob = await res.blob();
    const date = new Date().toLocaleDateString('ar-SA-u-nu-latn').replace(/\//g,'-');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup-${date}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    // Record timestamp so backup reminder knows last backup date
    _saveBackupTs();
    status.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم تنزيل النسخة الاحتياطية'; status.style.color = 'var(--success)';
    setTimeout(() => status.textContent = '', 4000);
    refreshNotifBadge(); // dismiss backup reminder if showing
  } catch(e) {
    status.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ${e.message}`; status.style.color = 'var(--error)';
  }
}

// ── Restore from file ─────────────────────────────────────────────
let _restoreData = null;
function backupRestoreSelected() {
  const file = document.getElementById('restoreFile').files[0];
  if (!file) return;
  document.getElementById('restoreFileName').textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      _restoreData = JSON.parse(e.target.result);
      document.getElementById('restoreConfirmBtn').classList.remove('hidden');
      document.getElementById('restoreStatus').innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> الملف صالح — اضغط "استعادة الآن" للمتابعة`;
      document.getElementById('restoreStatus').style.color = 'var(--success)';
    } catch {
      _restoreData = null;
      document.getElementById('restoreConfirmBtn').classList.add('hidden');
      document.getElementById('restoreStatus').innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> الملف غير صالح — تأكد أنه ملف JSON صحيح';
      document.getElementById('restoreStatus').style.color = 'var(--error)';
    }
  };
  reader.readAsText(file);
}

async function backupRestore() {
  if (!_restoreData) return;
  if (!confirm('سيتم دمج البيانات من الملف مع البيانات الحالية.\n\nهل تريد المتابعة؟')) return;
  const status = document.getElementById('restoreStatus');
  status.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ الاستعادة…'; status.style.color = 'var(--text2)';
  const res = await apiFetch('/sync/import', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify(_restoreData),
  });
  if (res?.ok) {
    status.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تمت الاستعادة — تم دمج ${res.merged} سجل جديد`;
    status.style.color = 'var(--success)';
    _restoreData = null;
    document.getElementById('restoreConfirmBtn').classList.add('hidden');
    document.getElementById('restoreFile').value = '';
    document.getElementById('restoreFileName').textContent = 'لم يُختر ملف';
    await loadAll();
  } else {
    status.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> فشلت الاستعادة: ${res?.error || 'خطأ غير معروف'}`;
    status.style.color = 'var(--error)';
  }
}

// ── Selective reset ───────────────────────────────────────────────
function backupToggleResetAll(checkbox) {
  const all = checkbox.checked;
  ['resetAttendance','resetTeacherLog','resetCalendar','resetWaLog','resetQuran'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = all;
  });
}

async function backupResetSelected() {
  const targets = {
    attendance:  document.getElementById('resetAttendance')?.checked,
    teacherLog:  document.getElementById('resetTeacherLog')?.checked,
    calendar:    document.getElementById('resetCalendar')?.checked,
    waLog:       document.getElementById('resetWaLog')?.checked,
    quran:       document.getElementById('resetQuran')?.checked,
    everything:  document.getElementById('resetEverything')?.checked,
  };

  const selected = Object.entries(targets).filter(([,v]) => v).map(([k]) => k);
  if (!selected.length) { toast('<span data-toast="warn"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span> لم تختر أي شيء لإعادة تعيينه'); return; }

  const labels = {
    attendance: 'سجلات الحضور', teacherLog: 'حضور المعلمين',
    calendar: 'التقويم', waLog: 'سجل واتساب', quran: 'تقدم القرآن',
    everything: 'كل البيانات (بما فيها الطلاب والحلقات)',
  };
  const labelList = selected.map(k => `• ${labels[k]}`).join('\n');
  if (!confirm(`سيتم حذف البيانات التالية نهائياً:\n\n${labelList}\n\nهذه العملية لا يمكن التراجع عنها. هل أنت متأكد؟`)) return;
  if (targets.everything && !confirm('تأكيد أخير: سيتم حذف كل البيانات تماماً. هل تريد المتابعة؟')) return;

  const status = document.getElementById('resetStatus');
  status.innerHTML = '<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ إعادة التعيين…'; status.style.color = 'var(--text2)';

  const res = await apiFetch('/settings/reset', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify(targets),
  });

  if (res?.ok) {
    const cleared = res.cleared.map(k => labels[k]).join('، ');
    status.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تمت إعادة التعيين: ${cleared}`;
    status.style.color = 'var(--success)';
    // Uncheck all
    ['resetAttendance','resetTeacherLog','resetCalendar','resetWaLog','resetQuran','resetEverything']
      .forEach(id => { const el=document.getElementById(id); if(el) el.checked=false; });
    await loadAll();
    toast('<span data-toast="ok"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span> تمت إعادة التعيين بنجاح');
  } else {
    status.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> فشل: ${res?.error || 'خطأ غير معروف'}`;
    status.style.color = 'var(--error)';
  }
}

async function saveWhatsAppSettings() {
  const whatsappApiKey   = document.getElementById('settWaApiKey').value.trim();
  const whatsappTemplate = document.getElementById('settWaTemplate').value.trim();
  const adminPhone       = (document.getElementById('settAdminPhone')?.value||'').trim();
  await apiFetch('/settings', {
    method:'PUT', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ whatsappApiKey, whatsappTemplate, adminPhone }),
  });
  const el = document.getElementById('waSettStatus');
  el.style.color = 'var(--success)';
  el.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم حفظ إعدادات واتساب!';
  setTimeout(() => el.textContent = '', 3000);
}

async function testWhatsApp() {
  const token  = document.getElementById('settWaApiKey').value.trim();
  const phone  = document.getElementById('settAdminPhone')?.value?.trim();
  const status = document.getElementById('waTestStatus');
  if (!token) { status.style.color='var(--error)'; status.textContent='أدخل Fonnte Token أولاً'; return; }
  if (!phone) { status.style.color='var(--error)'; status.textContent='أدخل رقم هاتف المدير للاختبار'; return; }
  // حفظ أولاً
  await apiFetch('/settings', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ whatsappApiKey: token, adminPhone: phone }) });
  status.style.color='var(--text2)'; status.innerHTML='<span class="ic-spin ic-inline"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg></span> جارٍ الإرسال…';
  const res = await apiFetch('/whatsapp/send', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ studentName:'اختبار', className:'حلقة الاختبار', date: todayISO() }),
  });
  if (res?.ok) {
    status.style.color='var(--success)'; status.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> تم الإرسال! تحقق من واتساب';
  } else {
    status.style.color='var(--error)'; status.innerHTML=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:3px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ${res?.error||'فشل — تأكد من صحة Token ورقم الهاتف'}`;
  }
}