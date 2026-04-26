/* حلقات مجمع الخير — bundled 2026-03-08T16:28:45.982Z */
/* ── modules/utils.js ── */
/**
 * ═══════════════════════════════════════════════════════════
 * حلقات مجمع الخير — app.js
 *  منطق الواجهة الأمامية بالكامل
 * ═══════════════════════════════════════════════════════════
 */

const BASE = window.location.origin;
const API  = `${BASE}/api`;

let state = {
  students: [], classes: [], teachers: [],
  teacherLog: [], holidays: [], quranProgress: [], currentPage: 'dashboard', waTemplates: [],
};

// Track students with active leaves so setAttStatus can block them
let _leaveStudentIds = new Set();
// Full leave map for current attendance view {studentId: leaveObj}
let _currentLeaveMap = {};
// Track if attendance is already saved for current class+date (once-a-day lock)
let _attAlreadySaved  = false;
let _attForceUnlocked = false;

// ══════════════════════════════════════════════════════════
//  القرآن الكريم — أسماء السور وأرقام الأجزاء
// ══════════════════════════════════════════════════════════
const SURAHS = [
  {n:1,name:'الفاتحة',juz:1},{n:2,name:'البقرة',juz:1},{n:3,name:'آل عمران',juz:3},
  {n:4,name:'النساء',juz:4},{n:5,name:'المائدة',juz:6},{n:6,name:'الأنعام',juz:7},
  {n:7,name:'الأعراف',juz:8},{n:8,name:'الأنفال',juz:9},{n:9,name:'التوبة',juz:10},
  {n:10,name:'يونس',juz:11},{n:11,name:'هود',juz:11},{n:12,name:'يوسف',juz:12},
  {n:13,name:'الرعد',juz:13},{n:14,name:'إبراهيم',juz:13},{n:15,name:'الحجر',juz:14},
  {n:16,name:'النحل',juz:14},{n:17,name:'الإسراء',juz:15},{n:18,name:'الكهف',juz:15},
  {n:19,name:'مريم',juz:16},{n:20,name:'طه',juz:16},{n:21,name:'الأنبياء',juz:17},
  {n:22,name:'الحج',juz:17},{n:23,name:'المؤمنون',juz:18},{n:24,name:'النور',juz:18},
  {n:25,name:'الفرقان',juz:18},{n:26,name:'الشعراء',juz:19},{n:27,name:'النمل',juz:19},
  {n:28,name:'القصص',juz:20},{n:29,name:'العنكبوت',juz:20},{n:30,name:'الروم',juz:21},
  {n:31,name:'لقمان',juz:21},{n:32,name:'السجدة',juz:21},{n:33,name:'الأحزاب',juz:21},
  {n:34,name:'سبأ',juz:22},{n:35,name:'فاطر',juz:22},{n:36,name:'يس',juz:22},
  {n:37,name:'الصافات',juz:23},{n:38,name:'ص',juz:23},{n:39,name:'الزمر',juz:23},
  {n:40,name:'غافر',juz:24},{n:41,name:'فصلت',juz:24},{n:42,name:'الشورى',juz:25},
  {n:43,name:'الزخرف',juz:25},{n:44,name:'الدخان',juz:25},{n:45,name:'الجاثية',juz:25},
  {n:46,name:'الأحقاف',juz:26},{n:47,name:'محمد',juz:26},{n:48,name:'الفتح',juz:26},
  {n:49,name:'الحجرات',juz:26},{n:50,name:'ق',juz:26},{n:51,name:'الذاريات',juz:26},
  {n:52,name:'الطور',juz:27},{n:53,name:'النجم',juz:27},{n:54,name:'القمر',juz:27},
  {n:55,name:'الرحمن',juz:27},{n:56,name:'الواقعة',juz:27},{n:57,name:'الحديد',juz:27},
  {n:58,name:'المجادلة',juz:28},{n:59,name:'الحشر',juz:28},{n:60,name:'الممتحنة',juz:28},
  {n:61,name:'الصف',juz:28},{n:62,name:'الجمعة',juz:28},{n:63,name:'المنافقون',juz:28},
  {n:64,name:'التغابن',juz:28},{n:65,name:'الطلاق',juz:28},{n:66,name:'التحريم',juz:28},
  {n:67,name:'الملك',juz:29},{n:68,name:'القلم',juz:29},{n:69,name:'الحاقة',juz:29},
  {n:70,name:'المعارج',juz:29},{n:71,name:'نوح',juz:29},{n:72,name:'الجن',juz:29},
  {n:73,name:'المزمل',juz:29},{n:74,name:'المدثر',juz:29},{n:75,name:'القيامة',juz:29},
  {n:76,name:'الإنسان',juz:29},{n:77,name:'المرسلات',juz:29},{n:78,name:'النبأ',juz:30},
  {n:79,name:'النازعات',juz:30},{n:80,name:'عبس',juz:30},{n:81,name:'التكوير',juz:30},
  {n:82,name:'الانفطار',juz:30},{n:83,name:'المطففين',juz:30},{n:84,name:'الانشقاق',juz:30},
  {n:85,name:'البروج',juz:30},{n:86,name:'الطارق',juz:30},{n:87,name:'الأعلى',juz:30},
  {n:88,name:'الغاشية',juz:30},{n:89,name:'الفجر',juz:30},{n:90,name:'البلد',juz:30},
  {n:91,name:'الشمس',juz:30},{n:92,name:'الليل',juz:30},{n:93,name:'الضحى',juz:30},
  {n:94,name:'الشرح',juz:30},{n:95,name:'التين',juz:30},{n:96,name:'العلق',juz:30},
  {n:97,name:'القدر',juz:30},{n:98,name:'البينة',juz:30},{n:99,name:'الزلزلة',juz:30},
  {n:100,name:'العاديات',juz:30},{n:101,name:'القارعة',juz:30},{n:102,name:'التكاثر',juz:30},
  {n:103,name:'العصر',juz:30},{n:104,name:'الهمزة',juz:30},{n:105,name:'الفيل',juz:30},
  {n:106,name:'قريش',juz:30},{n:107,name:'الماعون',juz:30},{n:108,name:'الكوثر',juz:30},
  {n:109,name:'الكافرون',juz:30},{n:110,name:'النصر',juz:30},{n:111,name:'المسد',juz:30},
  {n:112,name:'الإخلاص',juz:30},{n:113,name:'الفلق',juz:30},{n:114,name:'الناس',juz:30},
];
const QURAN_TYPE_AR  = { memorization:'حفظ جديد', revision:'مراجعة', recitation:'تلاوة' };

// Verse count per surah (114 surahs in order)
const SURAH_AYAH_COUNT = [
  7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,
  112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,
  54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,
  14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,
  29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,
  11,8,3,9,5,4,7,3,6,3,5,4,5,6
];

function qpMaxAyah(surahNum) {
  if (!surahNum || surahNum < 1 || surahNum > 114) return 286;
  return SURAH_AYAH_COUNT[surahNum - 1];
}

// Clamp an ayah input to valid range for its surah, show hint
function qpClampAyah(inputId, surahSelectId) {
  const surahNum = +document.getElementById(surahSelectId)?.value || 0;
  const max = qpMaxAyah(surahNum);
  const inp = document.getElementById(inputId);
  if (!inp) return;
  let val = +inp.value;
  if (val < 1) { inp.value = 1; val = 1; }
  if (surahNum && val > max) { inp.value = max; }
  // show hint label if surah chosen
  const hintId = inputId + 'Hint';
  let hint = document.getElementById(hintId);
  if (!hint) {
    hint = document.createElement('span');
    hint.id = hintId;
    hint.style.cssText = 'font-size:10px;color:var(--text2);margin-top:2px;display:block';
    inp.parentNode.appendChild(hint);
  }
  hint.textContent = surahNum ? `max: ${max} آية` : '';
}

// ══════════════════════════════════════════════════════════
//  نظام الأيقونات — Icon System
// ══════════════════════════════════════════════════════════
// Inline SVG paths (Lucide-style, stroke-based)
const SVG_ICONS = {
  check:        `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  'check-circle':`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  'x-circle':   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  x:            `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  alert:        `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  trash:        `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  pencil:       `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  save:         `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
  calendar:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  clipboard:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
  plane:        `✈️`,
  'alert-circle':`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  'file-text':  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  thermometer:  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`,
  'heart-pulse':`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l1.5-3 2 4.5 1.5-3 1.5 3h5.27"/></svg>`,
  home:         `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  message:      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  bell:         `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  'bell-off':   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
  megaphone:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v3a1 1 0 0 0 1 1h1l2 3h1V8H5L3 11z"/><path d="M11 8v7"/><path d="M14 6.5v10"/><path d="M17 5v13"/><path d="M20 4v15"/></svg>`,
  pin:          `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`,
  umbrella:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"/></svg>`,
  'phone-off':  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c1.12.45 2.3.77 3.53.93a2 2 0 0 1 1.8 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07"/><path d="M6.61 6.61A13.526 13.526 0 0 0 4.07 8.4a2 2 0 0 0-.45 2.11c.46 1.12.77 2.3.93 3.53a2 2 0 0 1-2 1.96H0a2 2 0 0 1-2-2.18 19.79 19.79 0 0 1 3.07-8.63"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
  cloud:        `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`,
  loader:       `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`,
  refresh:      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  link:         `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  users:        `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  teacher:      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
  mosque:       `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 20H2"/><path d="M4 20V10.5a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4V20"/><path d="M12 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4"/><path d="M4 10.5c0-2.2 1.8-4 4-4h.5c.5-2 2-3.5 3.5-3.5S14.5 4.5 15 6.5h.5c2.2 0 4 1.8 4 4"/><path d="M9 20v-4a3 3 0 0 1 6 0v4"/></svg>`,
  phone:        `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  book:         `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  school:       `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
  light:        `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  moon:         `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  palette:      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.477-1.125C12.896 18.799 12 17.38 12 16c0-2.21 1.79-4 4-4h2c2.21 0 4-1.79 4-4 0-5.5-4.5-6-10-6z"/></svg>`,
  sparkles:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>`,
  'circle-dot': `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`,
};

/**
 * Returns an inline icon span. Color is applied via CSS when data-icons="color".
 * @param {string} name - key from SVG_ICONS
 * @param {string} colorClass - 'ic-green' | 'ic-red' | 'ic-amber' | 'ic-blue' | 'ic-purple' | 'ic-sky' | 'ic-teal' | 'ic-gray'
 * @param {number} [size=15] - icon size in px
 */
function ic(name, colorClass = 'ic-gray', size = 15) {
  const svg = SVG_ICONS[name] || SVG_ICONS['circle-dot'];
  const sized = svg.replace(/width="\d+"/, `width="${size}"`).replace(/height="\d+"/, `height="${size}"`);
  return `<span class="ui-ic ${colorClass}" style="display:inline-flex;align-items:center;vertical-align:middle;line-height:1;margin-inline-start:2px">${sized}</span>`;
}

// ── Icon style toggle ────────────────────────────────────
function setIconStyle(mode) {
  document.documentElement.setAttribute('data-icons', mode);
  localStorage.setItem('appIconStyle', mode);
  document.querySelectorAll('.icon-style-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.icons === mode));
  const s = document.getElementById('iconStyleStatus');
  if (s) { s.textContent = mode === 'color' ? 'أيقونات ملوّنة مفعّلة' : 'أيقونات بدون ألوان'; setTimeout(() => s.textContent = '', 2000); }
}
function initIconStyleUI() {
  const mode = localStorage.getItem('appIconStyle') || 'color';
  document.documentElement.setAttribute('data-icons', mode);
  document.querySelectorAll('.icon-style-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.icons === mode));
}
const QURAN_GRADE_COLOR = { 'ممتاز':'#166534','جيد جداً':'#1e40af','جيد':'#92400e','مقبول':'#374151','ضعيف':'#991b1b' };
const QURAN_GRADE_BG    = { 'ممتاز':'#dcfce7','جيد جداً':'#dbeafe','جيد':'#fef3c7','مقبول':'#f3f4f6','ضعيف':'#fee2e2' };

function qpGradeColor(grade) {
  const n = parseInt(grade);
  if (!n) return '#6b7280';
  if (n <= 3) return '#991b1b';
  if (n <= 6) return '#92400e';
  return '#166534';
}
function qpGradeBg(grade) {
  const n = parseInt(grade);
  if (!n) return '#f3f4f6';
  if (n <= 3) return '#fee2e2';
  if (n <= 6) return '#fef3c7';
  return '#dcfce7';
}
function qpGradeLabel(grade) {
  const n = parseInt(grade);
  if (!n) return '';
  if (n <= 3) return `${n}/10`;
  if (n <= 6) return `${n}/10`;
  return `${n}/10`;
}

// ══════════════════════════════════════════════════════════
//  أسماء الأيام والأشهر بالعربية
// ══════════════════════════════════════════════════════════
const HIJRI_MONTHS = [
  '', 'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني',
  'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
  'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
];
const GREGORIAN_MONTHS = [
  '', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];
const ARABIC_DAYS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

// ══════════════════════════════════════════════════════════
//  تحويل التاريخ الميلادي إلى هجري
// ══════════════════════════════════════════════════════════
function toHijri(dateStr) {
  // Parse date parts directly from string to avoid timezone shifts
  const parts = (typeof dateStr === 'string' ? dateStr : dateStr.toISOString().slice(0,10)).split('-');
  const gy = +parts[0], gm = +parts[1], gd = +parts[2];

  // Gregorian → Julian Day Number (proleptic Gregorian calendar)
  const a   = Math.floor((14 - gm) / 12);
  const yy  = gy + 4800 - a;
  const mm  = gm + 12 * a - 3;
  const jdn = gd + Math.floor((153 * mm + 2) / 5) + 365 * yy +
              Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;

  // Julian Day Number → Hijri (tabular Islamic calendar, epoch JDN 1948440)
  const EPOCH = 1948440, CYCLE = 10631;
  const LEAP  = new Set([2,5,7,10,13,15,18,21,24,26,29]);
  const yLen  = y => LEAP.has(y % 30 === 0 ? 30 : y % 30) ? 355 : 354;
  const mLen  = (y, m) => m % 2 === 1 ? 30 : (m === 12 && LEAP.has(y % 30 === 0 ? 30 : y % 30) ? 30 : 29);

  let n      = jdn - EPOCH;
  const cyc  = Math.floor(n / CYCLE);
  n         -= cyc * CYCLE;

  let yin = 1;
  while (n >= yLen(yin)) { n -= yLen(yin); yin++; if (yin > 30) break; }

  const hYear = cyc * 30 + yin;
  let hMonth = 1;
  while (n >= mLen(hYear, hMonth)) { n -= mLen(hYear, hMonth); hMonth++; if (hMonth > 12) break; }

  return { year: hYear, month: hMonth, day: n + 1 };
}

function formatHijri(dateStr) {
  const h = toHijri(dateStr);
  return `${h.day} ${HIJRI_MONTHS[h.month]} ${h.year}هـ`;
}

function formatHijriFull(dateStr) {
  const iso = typeof dateStr === 'string' ? dateStr : dateStr.toISOString().slice(0,10);
  const d   = new Date(iso + 'T00:00:00');
  const h   = toHijri(iso);
  const day = ARABIC_DAYS[d.getDay()];
  return `${day}، ${h.day} ${HIJRI_MONTHS[h.month]} ${h.year}هـ`;
}

// ══════════════════════════════════════════════════════════
//  نظام التقويم — الهجري أو الميلادي
// ══════════════════════════════════════════════════════════
function getCalType() {
  return (state && state.settings && state.settings.calendarType)
    || localStorage.getItem('calendarType') || 'hijri';
}

// Universal date display respecting the active calendar type
function formatDateDisplay(dateStr) {
  const iso = typeof dateStr === 'string' ? dateStr : dateStr.toISOString().slice(0,10);
  if (getCalType() === 'gregorian') {
    const parts = iso.split('-');
    return `${+parts[2]} ${GREGORIAN_MONTHS[+parts[1]]} ${parts[0]}`;
  }
  return formatHijri(iso);
}

function formatDateDisplayFull(dateStr) {
  const iso = typeof dateStr === 'string' ? dateStr : dateStr.toISOString().slice(0,10);
  const d   = new Date(iso + 'T00:00:00');
  const day = ARABIC_DAYS[d.getDay()];
  if (getCalType() === 'gregorian') {
    const parts = iso.split('-');
    return `${day}، ${+parts[2]} ${GREGORIAN_MONTHS[+parts[1]]} ${parts[0]}`;
  }
  const h = toHijri(iso);
  return `${day}، ${h.day} ${HIJRI_MONTHS[h.month]} ${h.year}هـ`;
}

function calcMinutes(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const [h1, m1] = checkIn.split(':').map(Number);
  const [h2, m2] = checkOut.split(':').map(Number);
  return Math.max(0, (h2*60+m2) - (h1*60+m1));
}

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes/60), m = minutes%60;
  if (h===0) return `${m} دقيقة`;
  if (m===0) return `${h} ساعة`;
  return `${h} ساعة ${m} دقيقة`;
}

// ══════════════════════════════════════════════════════════
//  تهيئة
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  updateTodayBadge();
  startClock();
  loadAndDisplayLogos();
  loadPinQR();

  // ── Logo Home Button Ripple ──────────────────────────
  (function() {
    const brand = document.querySelector('.header-brand');
    if (!brand) return;
    brand.addEventListener('click', function(e) {
      const rect = brand.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.4;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top  - size / 2;
      const ripple = document.createElement('span');
      ripple.className = 'logo-ripple';
      ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
      brand.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  })();

  // ── Keyboard PIN entry (desktop only — real keyboard) ────
  document.addEventListener('keydown', (e) => {
    const pinScreen = document.getElementById('pinScreen');
    if (!pinScreen || pinScreen.classList.contains('hidden')) return;
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      pinPress(Number(e.key));
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      pinClear();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pinSubmit();
    }
  });
});



/* ── modules/auth.js ── */