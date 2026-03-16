// ══════════════════════════════════════════════════════════


/* ── modules/api.js ── */
//  تحميل البيانات
// ══════════════════════════════════════════════════════════
async function loadAll() {
  const [students, classes, teachers, teacherLog, holidays, settings2] = await Promise.all([
    apiFetch('/students'), apiFetch('/classes'), apiFetch('/teachers'),
    apiFetch('/teacher-log?date='+todayISO()), apiFetch('/holidays'),
    apiFetch('/settings'),
  ]);
  state.students   = students   || [];
  state.classes    = classes    || [];
  state.teachers   = teachers   || [];
  state.teacherLog = teacherLog || [];
  state.waTemplates = settings2?.waTemplates || [];
  state.holidays   = holidays   || [];
  // Sync backup timestamp from server so all accounts share the same reminder
  if (settings2?.lastBackupTs && settings2.lastBackupTs > _backupTsCache) {
    _backupTsCache = settings2.lastBackupTs;
    localStorage.setItem(BACKUP_TS_KEY, String(_backupTsCache));
  }
}

// ══════════════════════════════════════════════════════════
//  الشعارات — تحميل وعرض في الواجهة
// ══════════════════════════════════════════════════════════
async function loadAndDisplayLogos() {
  try {
    const settings = await apiFetch('/settings');
    if (!settings) return;
    const logos = settings.logos || [];

    // اسم المنشأة في شاشة PIN
    const titleEl = document.getElementById('pinTitle');
    const subEl   = document.getElementById('pinSubtitle');
    if (titleEl && settings.schoolName) titleEl.textContent = settings.schoolName;
    if (subEl   && settings.subtitle)   subEl.textContent   = settings.subtitle;

    // شعارات شاشة PIN
    const pinLogosEl = document.getElementById('pinOrgLogos');
    const pinIconEl  = document.getElementById('pinLogoIcon');
    if (pinLogosEl && logos.length > 0) {
      pinLogosEl.innerHTML = logos.map(l =>
        `<img src="${l.url}" alt="${l.name}" class="pin-org-logo" onerror="this.style.display='none'" />`
      ).join('');
      if (pinIconEl) pinIconEl.style.display = 'none';
    }

    // شعارات الهيدر
    // Cache dateFormat in state so updateTodayBadge can use it without an extra fetch
    if (!state.settings) state.settings = {};
    state.settings.dateFormat      = settings.dateFormat      || dfDefaultFormat();
    state.settings.whatsappApiKey  = settings.whatsappApiKey  || '';
    updateTodayBadge(state.settings.dateFormat);

    const headerLogosEl = document.getElementById('headerLogos');
    if (headerLogosEl && logos.length > 0) {
      headerLogosEl.innerHTML = logos.slice(0,2).map(l =>
        `<img src="${l.url}" alt="${l.name}" class="header-logo" onerror="this.style.display='none'" />`
      ).join('');
      // Set first logo as browser-tab favicon
      _setFavicon(logos[0].url);
    }

    // شعارات السايدبار
    const sidebarLogosEl = document.getElementById('sidebarLogos');
    if (sidebarLogosEl && logos.length > 0) {
      sidebarLogosEl.innerHTML = `<img src="${logos[0].url}" alt="${logos[0].name}" class="sidebar-logo" onerror="this.style.display='none'" />`;
    }
  } catch(e) { console.warn('Logo load error:', e); }
}

async function apiFetch(path, opts={}) {
  try { const r = await fetch(`${API}${path}`, opts); return await r.json(); }
  catch(e) { console.error('API error:', path, e); return null; }
}

// Set browser-tab favicon from a URL (PNG/JPG/SVG/ICO all work)
function _setFavicon(url) {
  try {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url;
    // Also set apple touch icon for iOS home screen
    let apple = document.querySelector("link[rel='apple-touch-icon']");
    if (!apple) {
      apple = document.createElement('link');
      apple.rel = 'apple-touch-icon';
      document.head.appendChild(apple);
    }
    apple.href = url;
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════


/* ── modules/nav.js ── */
//  التنقل
// ══════════════════════════════════════════════════════════
// ── Browser History Navigation (pushState / popState) ──────────
let _navByHistory = false;

window.addEventListener('popstate', function(e) {
  const page = e.state && e.state.page ? e.state.page : 'dashboard';
  _navByHistory = true;
  navigate(page);
});

// ── Skeleton helpers ───────────────────────────────────

async function navigate(page) {
  // Role guard
  if (!canAccess(page)) { page = 'dashboard'; }

  // Persist page for refresh restore — sessionStorage only (clears on tab close)
  sessionStorage.setItem('halaqat_last_page', page);

  // Push to browser history (skip when triggered by popstate)
  if (!_navByHistory) {
    const currentState = history.state && history.state.page;
    if (currentState !== page) {
      history.pushState({ page }, '', `?page=${page}`);
    }
  }
  _navByHistory = false;

  state.currentPage = page; closeSidebar();

  // Scroll to top immediately — like every proper app
  window.scrollTo({ top: 0, behavior: 'instant' });
  const _pageContainer = document.querySelector('.page-container');
  if (_pageContainer) _pageContainer.scrollTo({ top: 0, behavior: 'instant' });
  // Hide attendance sticky bar when leaving that page
  if (page !== 'attendance') {
    document.getElementById('attMarkRow')?.classList.add('hidden');
    document.getElementById('attSaveBottom')?.classList.add('hidden');
  }
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));

  // Route dashboard to role-specific page
  const dashPageId = page === 'dashboard'
    ? (currentRole === 'teacher' ? 'page-dashboard-teacher'
     : currentRole === 'moderator' ? 'page-dashboard-moderator'
     : 'page-dashboard')
    : `page-${page}`;
  document.getElementById(dashPageId)?.classList.remove('hidden');
  const titles = {
    dashboard:'الرئيسية', attendance:'تسجيل الحضور', students:'الطلاب',
    quran:'تقدم القرآن الكريم', whatsapp:'واتساب',
    classes:'الحلقات', teachers:'المعلمون', checkin:'حضور المعلمين',
    holidays:'الإجازات', reports:'التقارير', sync:'مزامنة ونسخ احتياطي', settings:'الإعدادات',
    calendar:'التقويم', accounts:'إدارة الحسابات',
  };
  document.getElementById('headerTitle').textContent = titles[page] || page;
  document.querySelectorAll('.nav-item, .bnav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page));

  await loadAll();

  switch(page) {
    case 'dashboard':  renderDashboard();   break;
    case 'attendance': initAttendance();    break;
    case 'whatsapp':   initWhatsappPage();  break;
    case 'students':   renderStudentList(); break;
    case 'quran':      initQuranPage();     break;
    case 'classes':    renderClassList();   break;
    case 'teachers':   renderTeacherList(); break;
    case 'checkin':    renderCheckinList(); loadTeacherSummary(); break;
    case 'holidays':   renderHolidayList(); break;
    case 'reports':    initReports();       break;
    case 'settings':   initSettings();      break;
    case 'sync':       initSyncPage();      break;
    case 'calendar':   initCalendarPage();  break;
    case 'accounts':   initAccountsPage();  break;
  }
  // Re-render icons after page switch (dynamic content uses data-lucide)
  setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);
}

// ══════════════════════════════════════════════════════════
//  ACCOUNTS PAGE (admin only)
// ══════════════════════════════════════════════════════════
let _accountsList = [];

async function initAccountsPage() {
  const res = await fetch(`${API}/accounts`);
  _accountsList = await res.json();
  renderAccountsList();
}

function renderAccountsList() {
  const el = document.getElementById('accountsList');
  if (!el) return;
  if (!_accountsList.length) {
    el.innerHTML = '<div class="empty-state"><p>لا توجد حسابات بعد</p></div>';
    return;
  }

  const roleLabel = { admin:'مدير', moderator:'مشرف', teacher:'معلم' };
  const roleColor = { admin:'var(--primary)', moderator:'var(--accent)', teacher:'var(--success)' };
  const roleBg    = { admin:'#E4EDF8', moderator:'#FEF3C7', teacher:'#DCFCE7' };
  const roleIcon  = {
    admin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    moderator: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    teacher: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  };

  const groups = { admin: [], moderator: [], teacher: [] };
  _accountsList.forEach(a => { (groups[a.role] || groups.teacher).push(a); });

  const groupOrder = ['admin','moderator','teacher'];
  const groupTitle = { admin:'المدراء', moderator:'المشرفون', teacher:'المعلمون' };

  el.innerHTML = groupOrder.filter(r => groups[r].length > 0).map(role => `
    <div class="acc-group">
      <div class="acc-group-header">
        <span class="acc-group-icon" style="background:${roleBg[role]};color:${roleColor[role]}">${roleIcon[role]}</span>
        <span class="acc-group-title">${groupTitle[role]}</span>
        <span class="acc-group-count">${groups[role].length}</span>
      </div>
      <div class="acc-group-list">
        ${groups[role].map(a => {
          const assignedNames = (a.assignedClasses||[])
            .map(id => { const c = state.classes?.find(x=>x.id===id); return c?.name||null; })
            .filter(Boolean);
          return `
          <div class="acc-item">
            <div class="acc-item-avatar" style="background:${roleBg[role]};color:${roleColor[role]}">
              ${a.name.charAt(0)}
            </div>
            <div class="acc-item-body">
              <div class="acc-item-name">${a.name}</div>
              <div class="acc-item-meta">
                <span class="acc-item-username">@${a.username}</span>
                ${role === 'teacher' && assignedNames.length
                  ? `<span class="acc-item-classes">${assignedNames.join(' · ')}</span>`
                  : role === 'teacher' ? `<span class="acc-item-warn">لا توجد حلقات مُسندة</span>` : ''}
              </div>
            </div>
            <div class="acc-item-actions">
              <button class="acc-action-btn acc-action-edit" onclick="openAccountModal('${a.id}')" title="تعديل">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              ${a.id !== 'admin' ? `
              <button class="acc-action-btn acc-action-del" onclick="deleteAccount('${a.id}','${a.name}')" title="حذف">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`).join('');
}

function accPickRole(role) {
  document.getElementById('accRole').value = role;
  document.querySelectorAll('.acc-role-card').forEach(c =>
    c.classList.toggle('acc-role-card--active', c.dataset.role === role));
  document.getElementById('accClassesRow').style.display = role === 'teacher' ? '' : 'none';
}

function accTogglePw(btn) {
  const inp = document.getElementById('accPassword');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function accToggleClasses() { accPickRole(document.getElementById('accRole').value); }

function openAccountModal(id) {
  const acc = id ? _accountsList.find(a => a.id === id) : null;
  const classes = (state.classes || []);
  const classOptions = classes.map(c =>
    `<label class="acc-cls-check">
      <input type="checkbox" value="${c.id}" ${acc?.assignedClasses?.includes(c.id) ? 'checked' : ''}> ${c.name}
    </label>`).join('');

  document.getElementById('accModal').classList.remove('hidden');
  document.getElementById('accModalTitle').textContent = acc ? 'تعديل الحساب' : 'حساب جديد';
  document.getElementById('accId').value       = acc?.id       || '';
  document.getElementById('accName').value     = acc?.name     || '';
  document.getElementById('accUsername').value = acc?.username || '';
  document.getElementById('accPassword').value = '';
  document.getElementById('accClassesList').innerHTML = classOptions || '<span style="font-size:13px;color:var(--text2)">لا توجد حلقات مسجلة</span>';
  accPickRole(acc?.role || 'teacher');
}

async function saveAccount() {
  const id        = document.getElementById('accId').value;
  const name      = document.getElementById('accName').value.trim();
  const username  = document.getElementById('accUsername').value.trim();
  const password  = document.getElementById('accPassword').value;
  const role      = document.getElementById('accRole').value;
  const assigned  = [...document.querySelectorAll('#accClassesList input:checked')].map(i => i.value);

  if (!name || !username) { toast('<span data-toast="err">⚠️</span> الاسم واسم المستخدم مطلوبان'); return; }
  if (!id && !password)   { toast('<span data-toast="err">⚠️</span> كلمة المرور مطلوبة لحساب جديد'); return; }

  const body = { name, username, role, assignedClasses: assigned };
  if (password) body.password = password;

  const url    = id ? `${API}/accounts/${id}` : `${API}/accounts`;
  const method = id ? 'PUT' : 'POST';
  const res    = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const data   = await res.json();

  if (data.error) { toast(`<span data-toast="err">⚠️</span> ${data.error}`); return; }
  toast(`<span data-toast="ok">✓</span> ${id ? 'تم تحديث الحساب' : 'تم إنشاء الحساب'}`);
  closeModal('accModal');
  initAccountsPage();
}

async function deleteAccount(id, name) {
  if (!confirm(`هل تريد حذف حساب "${name}"؟`)) return;
  const res  = await fetch(`${API}/accounts/${id}`, { method:'DELETE' });
  const data = await res.json();
  if (data.error) { toast(`<span data-toast="err">⚠️</span> ${data.error}`); return; }
  toast(`تم حذف الحساب`);
  initAccountsPage();
}

function exportAccounts() {
  window.open(`${API}/accounts/export`, '_blank');
  toast('<span data-toast="ok">⬇</span> جارٍ تصدير الحسابات…');
}

let _accImportData = null;
function previewAccountsImport(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      const accounts = parsed.accounts || (Array.isArray(parsed) ? parsed : null);
      if (!accounts) { toast('<span data-toast="err">⚠️</span> الملف غير صالح'); return; }
      _accImportData = accounts;
      const summary = document.getElementById('accImportSummary');
      const roles = { admin:0, moderator:0, teacher:0 };
      accounts.forEach(a => { if (roles[a.role] !== undefined) roles[a.role]++; });
      summary.innerHTML = `يحتوي الملف على <strong>${accounts.length}</strong> حساب:<br>
        مدراء: ${roles.admin} · مشرفون: ${roles.moderator} · معلمون: ${roles.teacher}`;
      document.getElementById('accImportModal').classList.remove('hidden');
    } catch(err) {
      toast('<span data-toast="err">⚠️</span> خطأ في قراءة الملف');
    }
    input.value = '';
  };
  reader.readAsText(file);
}

async function confirmAccountsImport() {
  if (!_accImportData) return;
  const mode = document.querySelector('input[name="accImportMode"]:checked')?.value || 'merge';
  const res = await fetch(`${API}/accounts/import`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ accounts: _accImportData, mode }),
  });
  const data = await res.json();
  if (data.error) { toast(`<span data-toast="err">⚠️</span> ${data.error}`); return; }
  toast(`<span data-toast="ok">✓</span> تم استيراد ${data.count} حساب`);
  closeModal('accImportModal');
  _accImportData = null;
  initAccountsPage();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}