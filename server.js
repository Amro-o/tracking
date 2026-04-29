/**
 * ══════════════════════════════════════════════════════════
 * حلقات مجمع الخير — server.js  (إصدار مُصلَح كامل)
 *  جميع نقاط API تحت /api/
 *  قاعدة البيانات: data/db.json
 * ══════════════════════════════════════════════════════════
 */

const express    = require('express');
const path       = require('path');
const fs         = require('fs');
let XLSX; try { XLSX = require('xlsx-js-style'); } catch(e) { XLSX = require('xlsx'); }
const ExcelJS = require('exceljs');
const PDFDocument= require('pdfkit');
const multer     = require('multer');
const https      = require('https');
const os         = require('os');

const { createClient } = require('@supabase/supabase-js');

// اختياري: مكتبة QR
let QRCode;
try { QRCode = require('qrcode'); } catch(e) { /* سيستخدم API خارجي */ }

const app  = express();
const PORT = process.env.PORT || 3000;

// ── المسارات ─────────────────────────────────────────────
const ROOT_DIR   = __dirname;
const DATA_DIR   = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');
const DB_FILE    = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR= path.join(DATA_DIR, 'uploads');
const APP_DIR    = path.join(ROOT_DIR, 'app');   // للملفات الثابتة (index.html, app.js, styles.css)

[DATA_DIR, UPLOADS_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── قاعدة البيانات الافتراضية ────────────────────────────
const DEFAULT_DB = {
  students: [], classes: [], teachers: [],
  teacherLog: [], attendance: [], leaves: [], holidays: [], quranProgress: [],
  calendarEvents: [],
  notices: [],
  waGroups:    [],
  waLog:       [],
  waDismissed: [],
  admissionRequests: [],
  accounts: [
    { id: 'admin', name: 'المدير', username: 'admin', password: '1234', role: 'admin', assignedClasses: [] }
  ],
  settings: {
    pin: '1234',
    schoolName: 'حضور الحلقات',
    subtitle: '',
    whatsappApiKey: '',
    adminPhone: '',
    whatsappTemplate: '',
    telegramBotToken: '',
    telegramChatId: '',
    logos: [],
    calendarType: 'hijri'
  }
};

// ══════════════════════════════════════════════════════════════
//  قاعدة البيانات — Supabase
//  نفس API السابق (readDB / writeDB / saveDB / writeKey) بدون
//  أي تغيير في بقية الكود.
//  البيانات تُخزَّن في جدول Supabase: store(key TEXT PK, value TEXT)
//  يُحمَّل الجدول كاملاً في الذاكرة عند بدء التشغيل (_cache)،
//  وكل كتابة تُحدِّث الذاكرة فوراً ثم تُزامَن مع Supabase بشكل
//  غير متزامن — لا يتأثر أداء الطلبات.
//
//  متغيرات البيئة المطلوبة في Render:
//    SUPABASE_URL  — رابط مشروع Supabase
//    SUPABASE_KEY  — service_role key (ليس anon key)
//
//  أنشئ الجدول مرة واحدة في Supabase SQL Editor:
//    CREATE TABLE IF NOT EXISTS store (
//      key   TEXT PRIMARY KEY,
//      value TEXT NOT NULL
//    );
// ══════════════════════════════════════════════════════════════

const _supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ── ذاكرة التخزين المؤقت (تُملأ عند بدء التشغيل) ───────────
let _cache = null;

// ── تهيئة الكاش من Supabase ─────────────────────────────────
async function _initCache() {
  const { data, error } = await _supabase.from('store').select('key, value');
  if (error) throw new Error('[DB] Supabase init error: ' + error.message);

  if (!data || data.length === 0) {
    // قاعدة بيانات جديدة — اكتب القيم الافتراضية
    _cache = JSON.parse(JSON.stringify(DEFAULT_DB));
    await _supabaseWriteAll(_cache);
    console.log('[DB] ✓ قاعدة بيانات جديدة أُنشئت في Supabase');
  } else {
    _cache = {};
    for (const row of data) {
      try { _cache[row.key] = JSON.parse(row.value); } catch(e) { _cache[row.key] = row.value; }
    }
    // ضمان المفاتيح الافتراضية
    Object.keys(DEFAULT_DB).forEach(k => { if (_cache[k] === undefined) _cache[k] = DEFAULT_DB[k]; });
    if (_cache.settings) {
      Object.keys(DEFAULT_DB.settings).forEach(k => {
        if (_cache.settings[k] === undefined) _cache.settings[k] = DEFAULT_DB.settings[k];
      });
    }
    if (!_cache.settings.pin) _cache.settings.pin = '1234';
    if (!_cache.accounts) _cache.accounts = [];
    if (!_cache.accounts.find(a => a.role === 'admin')) {
      _cache.accounts.unshift({
        id: 'admin', name: 'المدير', username: 'admin',
        password: _cache.settings.pin || '1234', role: 'admin', assignedClasses: []
      });
      await _supabaseWriteAll(_cache);
    }
    console.log('[DB] ✓ تم تحميل البيانات من Supabase');
  }
}

// ── كتابة كل المفاتيح دفعة واحدة إلى Supabase ───────────────
async function _supabaseWriteAll(db) {
  const rows = Object.entries(db).map(([key, value]) => ({ key, value: JSON.stringify(value) }));
  const { error } = await _supabase.from('store').upsert(rows, { onConflict: 'key' });
  if (error) console.error('[DB] Supabase writeAll error:', error.message);
}

// ── كتابة مفتاح واحد إلى Supabase ───────────────────────────
async function _supabaseWriteKey(key, value) {
  const { error } = await _supabase
    .from('store')
    .upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' });
  if (error) console.error('[DB] Supabase writeKey error:', error.message);
}

// ── دوال قاعدة البيانات (API مطابق للسابق) ──────────────────
function readDB() {
  if (!_cache) throw new Error('[DB] Cache not initialized — server still starting up');
  return _cache;
}

function writeDB(db) {
  _cache = db;
  _supabaseWriteAll(db).catch(e => console.error('[DB] async writeAll error:', e.message));
}

// writeKey — كتابة مفتاح واحد فقط (أداء أفضل للعمليات الكبيرة)
function writeKey(key, value) {
  if (_cache) _cache[key] = value;
  _supabaseWriteKey(key, value).catch(e => console.error('[DB] async writeKey error:', e.message));
}

function saveDB(fn) {
  const db = readDB();
  fn(db);
  writeDB(db);
}

function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ── التوقيت المحلي (مع دعم المنطقة الزمنية) ─────────────
// يستخدم Intl.DateTimeFormat لضمان الحصول على التوقيت الصحيح
// بغض النظر عن توقيت الخادم — toISOString() دائماً UTC.
// المنطقة الزمنية الافتراضية: Asia/Riyadh (يمكن تغييرها عبر TZ_NAME)
const _TZ = process.env.TZ_NAME || 'Asia/Riyadh';
function nowDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: _TZ });
}
function nowTime() {
  return new Date().toLocaleTimeString('en-GB', { timeZone: _TZ, hour: '2-digit', minute: '2-digit' });
}

// ── IP الشبكة المحلية ────────────────────────────────────
function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return '127.0.0.1';
}

// ── تحويل التاريخ الميلادي → هجري ───────────────────────
// Shared Hijri calendar constants (tabular Islamic, 30-year cycle)
const _HL = new Set([2,5,7,10,13,15,18,21,24,26,29]);
const _HE = 1948440, _HC = 10631;
const _yL = y => _HL.has(y%30===0?30:y%30) ? 355 : 354;
const _mL = (y,m) => m%2===1 ? 30 : (m===12 && _HL.has(y%30===0?30:y%30) ? 30 : 29);

function toHijri(dateStr) {
  // Parse string directly — new Date("YYYY-MM-DD") shifts by timezone offset
  const p = (typeof dateStr==='string' ? dateStr : dateStr.toISOString().slice(0,10)).split('-');
  const gy=+p[0], gm=+p[1], gd=+p[2];
  const a=Math.floor((14-gm)/12), yy=gy+4800-a, mm=gm+12*a-3;
  const jdn=gd+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)-32045;
  let n=jdn-_HE; const cyc=Math.floor(n/_HC); n-=cyc*_HC;
  let yin=1; while(n>=_yL(yin)){n-=_yL(yin);yin++;if(yin>30)break;}
  const hYear=cyc*30+yin; let hMonth=1;
  while(n>=_mL(hYear,hMonth)){n-=_mL(hYear,hMonth);hMonth++;if(hMonth>12)break;}
  return {year:hYear, month:hMonth, day:n+1};
}
const HM = ['','محرم','صفر','ربيع الأول','ربيع الثاني','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
const HD = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
function formatHijri(dateStr) { const h=toHijri(dateStr); return `${h.day} ${HM[h.month]} ${h.year}هـ`; }
function formatHijriShort(dateStr) { const h=toHijri(dateStr); return `${h.day}\n${HD[new Date(dateStr).getDay()]}`; }
function dayNameAr(dateStr) { return HD[new Date(dateStr).getDay()]; }
function inHijriMonth(dateStr, y, m) { const h=toHijri(dateStr); return h.year==y && h.month==m; }

// Convert Hijri date → Gregorian ISO string  (exact inverse of toHijri above)
function fromHijri(hy, hm, hd) {
  const cyc=Math.floor((hy-1)/30), yin=((hy-1)%30)+1;
  let jdn=_HE+cyc*_HC;
  for(let y=1;y<yin;y++) jdn+=_yL(y);
  for(let m=1;m<hm;m++) jdn+=_mL(hy,m);
  jdn+=hd-1;
  const L=jdn+68569, N=Math.floor(4*L/146097), L2=L-Math.floor((146097*N+3)/4);
  const I=Math.floor(4000*(L2+1)/1461001), L3=L2-Math.floor(1461*I/4)+31, J=Math.floor(80*L3/2447);
  const gd=L3-Math.floor(2447*J/80), L4=Math.floor(J/11), gm=J+2-12*L4, gy=100*(N-49)+I+L4;
  return gy+'-'+String(gm).padStart(2,'0')+'-'+String(gd).padStart(2,'0');
}

// Get all ISO date strings for a full Hijri month (29 or 30 days)
function getAllHijriMonthDates(hy, hm) {
  const dates = [];
  for (let d = 1; d <= 30; d++) {
    const iso = fromHijri(hy, hm, d);
    const check = toHijri(iso);
    // Stop when converting back gives a different month (month was only 29 days)
    if (check.year !== hy || check.month !== hm) break;
    dates.push(iso);
  }
  return dates;
}
// Gregorian month helpers
function inGregorianMonth(dateStr, y, m) {
  const parts = dateStr.split('-');
  return +parts[0] === +y && +parts[1] === +m;
}
function getAllGregorianMonthDates(gy, gm) {
  const dates = [];
  const days = new Date(+gy, +gm, 0).getDate();
  for (let d = 1; d <= days; d++) {
    dates.push(gy + '-' + String(gm).padStart(2,'0') + '-' + String(d).padStart(2,'0'));
  }
  return dates;
}
const GM = ['','يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

// Calculate session minutes. Handles midnight-crossing sessions (e.g. 16:00 -> 02:00 next day).
function calcSessionMins(checkIn, checkOut) {
  if (!checkIn || typeof checkIn !== 'string') return 0;
  const p1 = checkIn.split(':').map(Number);
  const h1 = p1[0], m1 = p1[1] || 0;
  if (isNaN(h1) || isNaN(m1)) return 0;
  const startMins = h1 * 60 + m1;
  let endStr = (checkOut && typeof checkOut === 'string' && checkOut !== 'null') ? checkOut : null;
  if (!endStr) {
    const tot = Math.min(startMins + 240, 1439);
    endStr = String(Math.floor(tot/60)).padStart(2,'0')+':'+String(tot%60).padStart(2,'0');
  }
  const p2 = endStr.split(':').map(Number);
  const h2 = p2[0], m2 = p2[1] || 0;
  if (isNaN(h2) || isNaN(m2)) return 0;
  let endMins = h2 * 60 + m2;
  if (endMins < startMins) endMins += 24 * 60; // midnight crossing
  return Math.max(0, endMins - startMins);
}
const STATUS_AR = { Present:'حاضر', Absent:'غائب', Late:'متأخر', Excused:'بعذر', Holiday:'إجازة' };
const STATUS_SH = { Present:'ح', Absent:'غ', Late:'م', Excused:'ع', Holiday:'ج' }; // رمز مختصر
const STATUS_CLR = { Present:'DCFCE7', Absent:'FEE2E2', Late:'FEF3C7', Excused:'DBEAFE', Holiday:'F3F4F6' };
const STATUS_FNT = { Present:'166534', Absent:'991B1B', Late:'92400E', Excused:'1E40AF', Holiday:'6B7280' };
function minsToStr(mins) {
  if (!mins) return '—';
  const h=Math.floor(mins/60), m=mins%60;
  return m ? `${h}س ${m}د` : `${h}س`;
}
// ══════════════════════════════════════════════════════════
//  Excel helpers — ExcelJS (proper colors, borders, images)
// ══════════════════════════════════════════════════════════
const C = {
  navy:    '1E3A5F', slate:   '3B5280',
  headBg:  'D9E2F0', headFg:  '1E3A5F',
  rowA:    'FFFFFF', rowB:    'EEF2FA',
  greenBg: 'D6EAD8', greenFg: '1A4D2E',
  redBg:   'F0D8D8', redFg:   '6B1F1F',
  amberBg: 'F5EDCE', amberFg: '6B4B0F',
  blueBg:  'D9E2F0', blueFg:  '1E3A5F',
  border:  '9AABB8', totalBg: 'D9E2F0',
  white:   'FFFFFF', emptyBg: 'F4F4F4',
};
const STATUS_BG = { Present:C.greenBg, Absent:C.redBg, Late:C.amberBg, Excused:C.blueBg, Holiday:'E8E8E8' };
const STATUS_FG = { Present:C.greenFg, Absent:C.redFg, Late:C.amberFg, Excused:C.blueFg, Holiday:'555555' };

function xBorder(color) { const s={style:'thin',color:{argb:'FF'+(color||C.border)}}; return {top:s,left:s,bottom:s,right:s}; }
function xFill(hex)  { return {type:'pattern',pattern:'solid',fgColor:{argb:'FF'+hex}}; }
function xFont(o)    { return {name:'Arial',size:o.sz||10,bold:!!o.bold,color:{argb:'FF'+(o.color||'000000')}}; }
function xAlign(h,v,wrap) { return {horizontal:h||'right',vertical:v||'middle',wrapText:!!wrap,readingOrder:2}; }

function sc(cell, value, fillHex, fontOpts, alignH, wrap, border) {
  cell.value = value;
  if (fillHex)          cell.fill      = xFill(fillHex);
  cell.font             = xFont(fontOpts);
  cell.alignment        = xAlign(alignH||'center', 'middle', wrap);
  if (border !== false) cell.border    = xBorder();
}

function titleRow(ws, rowNum, text, fillHex, fontOpts, totalCols, height) {
  ws.getRow(rowNum).height = height||36;
  ws.mergeCells(rowNum, 1, rowNum, totalCols);
  const cell = ws.getCell(rowNum, 1);
  cell.value = text;
  cell.fill  = xFill(fillHex);
  cell.font  = xFont(fontOpts);
  cell.alignment = xAlign('center','middle',false);
}

function dataCell(cell, value, isEven, alignH, isBold, fillOverride) {
  cell.value     = value;
  cell.fill      = xFill(fillOverride || (isEven ? C.rowA : C.rowB));
  cell.font      = xFont({sz:10, bold:!!isBold});
  cell.alignment = xAlign(alignH||'right', 'middle');
  cell.border    = xBorder();
}

async function addLogoImage(wb, ws, totalCols, db) {
  const logoMeta = (db.settings?.logos||[])[0];
  if (!logoMeta?.url) return 3;
  const logoPath = path.join(UPLOADS_DIR, path.basename(logoMeta.url));
  if (!fs.existsSync(logoPath)) return 3;
  try {
    const ext = path.extname(logoPath).replace('.','').toLowerCase();
    const imgType = ext==='jpg'?'jpeg':(ext==='png'?'png':null);
    if (!imgType) return 3;
    const imgId = wb.addImage({base64:fs.readFileSync(logoPath).toString('base64'), extension:imgType});
    ws.addImage(imgId, {tl:{col:0,row:0}, br:{col:2,row:2}, editAs:'oneCell'});
    ws.getRow(1).height = 35; ws.getRow(2).height = 35;
    return 2;
  } catch(e) { return 3; }
}

// ══════════════════════════════════════════════════════════
//  Sheet builders
// ══════════════════════════════════════════════════════════

async function buildDailySheet(db, date, classId, calType) {
  const wb  = new ExcelJS.Workbook();
  const ws  = wb.addWorksheet('الحضور', {views:[{rightToLeft:true}]});
  const school = db.settings.schoolName||'حضور الحلقات';
  const att    = db.attendance.filter(a=>a.date===date&&(!classId||a.classId===classId));
  const cols   = 6;
  ws.columns = [{width:6},{width:28},{width:14},{width:20},{width:12},{width:24}];

  const logoEnd = await addLogoImage(wb, ws, cols, db);
  const r1 = logoEnd+1;
  titleRow(ws, r1, school, C.navy, {sz:14,bold:true,color:C.white}, cols, 36);
  const r2 = r1+1;
  const _dailyDateLabel = calType==='gregorian'
    ? (()=>{ const dp=date.split('-'); return `${+dp[2]} ${GM[+dp[1]]} ${dp[0]}`; })()
    : formatHijri(date);
  titleRow(ws, r2, `كشف الحضور اليومي — يوم ${dayNameAr(date)} ${_dailyDateLabel}`, C.slate, {sz:11,bold:true,color:C.white}, cols, 28);
  const r3 = r2+1;
  ws.getRow(r3).height = 26;
  ['م','اسم الطالب','رقم الطالب','الحلقة','الحالة','ملاحظات'].forEach((h,i) =>
    sc(ws.getCell(r3,i+1), h, C.headBg, {sz:10,bold:true,color:C.headFg}, 'center', true));

  let dr = r3+1, idx=1;
  const cnt = {Present:0,Absent:0,Late:0,Excused:0,Holiday:0};
  att.forEach(a => {
    const s=db.students.find(x=>x.id===a.studentId), cls=db.classes.find(c=>c.id===a.classId), st=a.status||'';
    if (cnt[st]!==undefined) cnt[st]++;
    const even = dr%2===0;
    ws.getRow(dr).height = 22;
    dataCell(ws.getCell(dr,1), idx++,             even,'center');
    dataCell(ws.getCell(dr,2), s?.name||'—',      even,'right');
    dataCell(ws.getCell(dr,3), s?.studentId||'—', even,'center');
    dataCell(ws.getCell(dr,4), cls?.name||'—',    even,'right');
    const sc2=ws.getCell(dr,5);
    sc2.value=STATUS_AR[st]||st; sc2.fill=xFill(STATUS_BG[st]||C.rowA);
    sc2.font=xFont({sz:10,bold:true,color:STATUS_FG[st]||'000000'}); sc2.alignment=xAlign('center'); sc2.border=xBorder();
    const exitToday = (db.leaves||[]).find(l=>l.studentId===a.studentId&&l.date===date&&l.type==='Permission');
    const notesTxt = exitToday
      ? `📋 إذن خروج${exitToday.reason?': '+exitToday.reason:''}${a.notes?' | '+a.notes:''}`
      : (a.notes||'');
    dataCell(ws.getCell(dr,6), notesTxt, even,'right');
    dr++;
  });
  ws.getRow(dr).height=6; for(let c=1;c<=cols;c++) ws.getCell(dr,c).fill=xFill(C.headBg); dr++;
  ws.getRow(dr).height=24; ws.mergeCells(dr,1,dr,2);
  sc(ws.getCell(dr,1),'الملخص:',      C.totalBg,{sz:10,bold:true,color:C.headFg},'right');
  sc(ws.getCell(dr,3),`حاضر: ${cnt.Present}`,  C.greenBg,{sz:10,bold:true,color:C.greenFg},'center');
  sc(ws.getCell(dr,4),`غائب: ${cnt.Absent}`,   C.redBg,  {sz:10,bold:true,color:C.redFg},  'center');
  sc(ws.getCell(dr,5),`متأخر: ${cnt.Late}`,    C.amberBg,{sz:10,bold:true,color:C.amberFg},'center');
  sc(ws.getCell(dr,6),`بعذر: ${cnt.Excused}`,  C.blueBg, {sz:10,bold:true,color:C.blueFg}, 'center');
  return wb;
}

async function buildMonthlySheet(db, year, month, classId) {
  const wb  = new ExcelJS.Workbook();
  const ws  = wb.addWorksheet('الشهري', {views:[{rightToLeft:true}]});
  const school = db.settings.schoolName||'حضور الحلقات';
  const att    = db.attendance.filter(a=>inHijriMonth(a.date,+year,+month)&&(!classId||a.classId===classId));
  // ALL days in the Hijri month (29 or 30 days)
  const dates  = getAllHijriMonthDates(+year, +month);
  const studs  = classId ? db.students.filter(s=>s.classId===classId) : db.students;
  const holidays = new Set((db.holidays||[]).filter(h=>inHijriMonth(h.date,+year,+month)).map(h=>h.date));

  const totalDayCols = dates.length;
  const summaryStart = 4+totalDayCols;
  const totalCols    = summaryStart+3;

  ws.columns = [{width:5},{width:26},{width:18},...Array(totalDayCols).fill({width:6}),{width:8},{width:8},{width:8},{width:8},{width:8}];

  const logoEnd = await addLogoImage(wb, ws, totalCols, db);
  const r1=logoEnd+1; titleRow(ws,r1,school,C.navy,{sz:14,bold:true,color:C.white},totalCols,36);
  const r2=r1+1;
  const sub=`كشف الحضور الشهري — ${HM[+month]} ${year}هـ`+(classId?` — ${db.classes.find(c=>c.id===classId)?.name||''}`:'');
  titleRow(ws,r2,sub,C.slate,{sz:11,bold:true,color:C.white},totalCols,28);
  const r3=r2+1; ws.getRow(r3).height=34;
  ['م','اسم الطالب','الحلقة'].forEach((h,i)=>sc(ws.getCell(r3,i+1),h,C.headBg,{sz:10,bold:true,color:C.headFg},'center',true));

  // Day-column headers — grey out Fridays
  dates.forEach((d,i)=>{
    const h=toHijri(d), dow=new Date(d).getDay();
    const isFri=(dow===5), isHol=holidays.has(d);
    const bg = isFri||isHol ? C.emptyBg : C.headBg;
    sc(ws.getCell(r3,4+i), `${h.day}\n${dayNameAr(d)}`, bg, {sz:8,bold:true,color:isFri||isHol?'888888':C.headFg},'center',true);
  });
  sc(ws.getCell(r3,summaryStart),  'الحضور\nإجمالي', C.greenBg,{sz:9,bold:true,color:C.greenFg},'center',true);
  sc(ws.getCell(r3,summaryStart+1),'الغياب\nإجمالي', C.redBg,  {sz:9,bold:true,color:C.redFg},  'center',true);
  sc(ws.getCell(r3,summaryStart+2),'التأخير\nإجمالي',C.amberBg,{sz:9,bold:true,color:C.amberFg},'center',true);
  sc(ws.getCell(r3,summaryStart+3),'الاعذار\nإجمالي', C.blueBg, {sz:9,bold:true,color:C.blueFg}, 'center',true);
  sc(ws.getCell(r3,summaryStart+4),'إذن خروج', C.slate,{sz:9,bold:true,color:C.headFg},'center',true);

  let dr=r3+1;
  studs.forEach((s,si)=>{
    let present=0,absent=0,late=0,excused=0;
    const even=si%2===0;
    ws.getRow(dr).height=22;
    dataCell(ws.getCell(dr,1),si+1,       even,'center');
    dataCell(ws.getCell(dr,2),s.name||'—',even,'right');
    const cls=db.classes.find(c=>c.id===s.classId);
    dataCell(ws.getCell(dr,3),cls?.name||'—',even,'right');

    dates.forEach((d,i)=>{
      const cell=ws.getCell(dr,4+i);
      const isFri=new Date(d).getDay()===5, isHol=holidays.has(d);
      if (isFri||isHol) {
        // Weekend/holiday — dimmed empty cell
        cell.value=''; cell.fill=xFill(C.emptyBg);
        cell.font=xFont({sz:9,color:'AAAAAA'}); cell.alignment=xAlign('center'); cell.border=xBorder();
        return;
      }
      const a=att.find(x=>x.studentId===s.id&&x.date===d), st=a?.status||'';
      if (!st) {
        // No record yet — plain alternating cell with dash
        dataCell(cell,'—',even,'center'); return;
      }
      const sym=STATUS_SH[st]||'—';
      cell.value=sym; cell.fill=xFill(STATUS_BG[st]||C.rowA);
      cell.font=xFont({sz:9,bold:true,color:STATUS_FG[st]||'000000'});
      cell.alignment=xAlign('center'); cell.border=xBorder();
      if (st==='Present') present++;
      else if (st==='Absent') absent++;
      else if (st==='Late') late++;
      else if (st==='Excused') excused++;
    });

    const exitCnt = (db.leaves||[]).filter(l=>l.studentId===s.id&&l.type==='Permission'&&inHijriMonth(l.date,+year,+month)).length;
    dataCell(ws.getCell(dr,summaryStart),  present, even,'center',true,C.greenBg);
    dataCell(ws.getCell(dr,summaryStart+1),absent,  even,'center',true,C.redBg);
    dataCell(ws.getCell(dr,summaryStart+2),late,    even,'center',true,C.amberBg);
    dataCell(ws.getCell(dr,summaryStart+3),excused, even,'center',true,C.blueBg);
    dataCell(ws.getCell(dr,summaryStart+4),exitCnt, even,'center',true,C.slate);
    dr++;
  });
  return wb;
}

async function buildTeacherDailySheet(db, date) {
  const wb  = new ExcelJS.Workbook();
  const ws  = wb.addWorksheet('المعلمون', {views:[{rightToLeft:true}]});
  const school = db.settings.schoolName||'حضور الحلقات';
  const logs   = db.teacherLog.filter(l=>l.date===date);
  const cols=6;
  ws.columns = [{width:6},{width:26},{width:13},{width:15},{width:15},{width:24}];

  const logoEnd=await addLogoImage(wb,ws,cols,db);
  const r1=logoEnd+1; titleRow(ws,r1,school,C.navy,{sz:14,bold:true,color:C.white},cols,36);
  const r2=r1+1; titleRow(ws,r2,`سجل حضور المعلمين — يوم ${dayNameAr(date)} ${formatHijri(date)}`,C.slate,{sz:11,bold:true,color:C.white},cols,28);
  const r3=r2+1; ws.getRow(r3).height=26;
  ['م','اسم المعلم','وقت الحضور','وقت الانصراف','مدة الحضور','ملاحظات'].forEach((h,i)=>
    sc(ws.getCell(r3,i+1),h,C.headBg,{sz:10,bold:true,color:C.headFg},'center',true));

  let dr=r3+1, totalMins=0;
  logs.forEach((l,i)=>{
    const t=db.teachers.find(x=>x.id===l.teacherId);
    const mins=calcSessionMins(l.checkIn, l.checkOut);
    totalMins+=mins; const even=i%2===0;
    ws.getRow(dr).height=22;
    dataCell(ws.getCell(dr,1),i+1,           even,'center');
    dataCell(ws.getCell(dr,2),t?.name||'—',  even,'right');
    dataCell(ws.getCell(dr,3),l.checkIn||'—',even,'center');
    dataCell(ws.getCell(dr,4),l.checkOut||'—',even,'center');
    dataCell(ws.getCell(dr,5),minsToStr(mins),even,'center',!!mins,mins?C.greenBg:null);
    dataCell(ws.getCell(dr,6),l.notes||'',   even,'right');
    dr++;
  });
  ws.getRow(dr).height=6; for(let c=1;c<=cols;c++) ws.getCell(dr,c).fill=xFill(C.headBg); dr++;
  ws.getRow(dr).height=26; ws.mergeCells(dr,1,dr,3);
  sc(ws.getCell(dr,1),'الإجمالي:',      C.totalBg,{sz:10,bold:true,color:C.headFg},'right');
  sc(ws.getCell(dr,4),`${logs.length} معلم`,C.totalBg,{sz:10,bold:true,color:C.headFg},'center');
  sc(ws.getCell(dr,5),minsToStr(totalMins), C.greenBg,{sz:10,bold:true,color:C.greenFg},'center');
  sc(ws.getCell(dr,6),'',                   C.totalBg,{sz:10},'center');
  return wb;
}

async function buildTeacherMonthlySheet(db, year, month) {
  const wb  = new ExcelJS.Workbook();
  const ws  = wb.addWorksheet('ساعات المعلمين', {views:[{rightToLeft:true}]});
  const school = db.settings.schoolName||'حضور الحلقات';
  const logs   = db.teacherLog.filter(l=>inHijriMonth(l.date,+year,+month));
  // ALL days in the Hijri month
  const dates  = getAllHijriMonthDates(+year, +month);
  const holidays = new Set((db.holidays||[]).filter(h=>inHijriMonth(h.date,+year,+month)).map(h=>h.date));
  const totalDayCols=dates.length, summaryStart=3+totalDayCols, totalCols=summaryStart+2;

  ws.columns=[{width:24},{width:16},...Array(totalDayCols).fill({width:10}),{width:10},{width:12},{width:10}];

  const logoEnd=await addLogoImage(wb,ws,totalCols,db);
  const r1=logoEnd+1; titleRow(ws,r1,school,C.navy,{sz:14,bold:true,color:C.white},totalCols,36);
  const r2=r1+1; titleRow(ws,r2,`تقرير ساعات المعلمين — ${HM[+month]} ${year}هـ`,C.slate,{sz:11,bold:true,color:C.white},totalCols,28);
  const r3=r2+1; ws.getRow(r3).height=34;
  sc(ws.getCell(r3,1),'اسم المعلم',C.headBg,{sz:10,bold:true,color:C.headFg},'center',true);
  sc(ws.getCell(r3,2),'التخصص',   C.headBg,{sz:10,bold:true,color:C.headFg},'center',true);
  dates.forEach((d,i)=>{
    const h=toHijri(d), isFri=new Date(d).getDay()===5, isHol=holidays.has(d);
    const bg=isFri||isHol?C.emptyBg:C.headBg;
    sc(ws.getCell(r3,3+i),`${h.day}\n${dayNameAr(d)}`,bg,{sz:8,bold:true,color:isFri||isHol?'888888':C.headFg},'center',true);
  });
  sc(ws.getCell(r3,summaryStart),  'أيام\nالحضور',   C.headBg, {sz:9,bold:true,color:C.headFg}, 'center',true);
  sc(ws.getCell(r3,summaryStart+1),'إجمالي\nالساعات', C.greenBg,{sz:9,bold:true,color:C.greenFg},'center',true);
  sc(ws.getCell(r3,summaryStart+2),'إجمالي\nالدقائق', C.headBg, {sz:9,bold:true,color:C.headFg}, 'center',true);

  let dr=r3+1, grandTotal=0;
  db.teachers.forEach((t,ti)=>{
    const tLogs=logs.filter(l=>l.teacherId===t.id);
    let totalMins=0; const even=ti%2===0;
    ws.getRow(dr).height=26;
    dataCell(ws.getCell(dr,1),t.name||'—',   even,'right');
    dataCell(ws.getCell(dr,2),t.subject||'—',even,'right');
    dates.forEach((d,i)=>{
      const cell=ws.getCell(dr,3+i);
      const isFri=new Date(d).getDay()===5, isHol=holidays.has(d);
      const l=tLogs.find(x=>x.date===d);
      if (isFri||isHol) {
        if (l && l.checkIn) {
          const mins=calcSessionMins(l.checkIn, l.checkOut);
          totalMins+=mins;
          cell.value=l.checkIn+(l.checkOut?'\n'+l.checkOut:' *');
          cell.fill=xFill('FEF3C7');
          cell.font=xFont({sz:8,color:'92400E'});
          cell.alignment=xAlign('center','middle',true); cell.border=xBorder();
        } else {
          cell.value=''; cell.fill=xFill(C.emptyBg);
          cell.font=xFont({sz:9,color:'AAAAAA'}); cell.alignment=xAlign('center'); cell.border=xBorder();
        }
        return;
      }
      if (!l) { dataCell(cell,'—',even,'center'); return; }
      const mins=calcSessionMins(l.checkIn, l.checkOut);
      totalMins+=mins;
      cell.value=l.checkIn+(l.checkOut?'\n'+l.checkOut:' *');
      cell.fill=xFill(mins?C.greenBg:(even?C.rowA:C.rowB));
      cell.font=xFont({sz:8,color:mins?C.greenFg:'444444'});
      cell.alignment=xAlign('center','middle',true); cell.border=xBorder();
    });
    grandTotal+=totalMins;
    dataCell(ws.getCell(dr,summaryStart),  tLogs.filter(l=>l.checkIn).length,even,'center',true);
    dataCell(ws.getCell(dr,summaryStart+1),Math.floor(totalMins/60),          even,'center',true,C.greenBg);
    dataCell(ws.getCell(dr,summaryStart+2),totalMins%60,                      even,'center');
    dr++;
  });
  ws.getRow(dr).height=6; for(let c=1;c<=totalCols;c++) ws.getCell(dr,c).fill=xFill(C.headBg); dr++;
  ws.getRow(dr).height=26; ws.mergeCells(dr,1,dr,summaryStart);
  sc(ws.getCell(dr,1),'الإجمالي الكلي:',        C.totalBg,{sz:10,bold:true,color:C.headFg},'right');
  sc(ws.getCell(dr,summaryStart+1),Math.floor(grandTotal/60),C.greenBg,{sz:10,bold:true,color:C.greenFg},'center');
  sc(ws.getCell(dr,summaryStart+2),grandTotal%60,            C.totalBg,{sz:10,bold:true,color:C.headFg}, 'center');
  return wb;
}

// ── Gregorian Sheet Builders ─────────────────────────────
async function buildMonthlySheetGregorian(db, year, month, classId) {
  const wb  = new ExcelJS.Workbook();
  const ws  = wb.addWorksheet('الشهري', {views:[{rightToLeft:true}]});
  const school = db.settings.schoolName||'حضور الحلقات';
  const att    = db.attendance.filter(a=>inGregorianMonth(a.date,+year,+month)&&(!classId||a.classId===classId));
  const dates  = getAllGregorianMonthDates(+year, +month);
  const studs  = classId ? db.students.filter(s=>s.classId===classId) : db.students;
  const holidays = new Set((db.holidays||[]).filter(h=>inGregorianMonth(h.date,+year,+month)).map(h=>h.date));
  const totalDayCols = dates.length, summaryStart = 4+totalDayCols, totalCols = summaryStart+3;
  ws.columns = [{width:5},{width:26},{width:18},...Array(totalDayCols).fill({width:6}),{width:8},{width:8},{width:8},{width:8},{width:8}];
  const logoEnd = await addLogoImage(wb, ws, totalCols, db);
  const r1=logoEnd+1; titleRow(ws,r1,school,C.navy,{sz:14,bold:true,color:C.white},totalCols,36);
  const r2=r1+1;
  const sub=`كشف الحضور الشهري — ${GM[+month]} ${year}م`+(classId?` — ${db.classes.find(c=>c.id===classId)?.name||''}`:'');
  titleRow(ws,r2,sub,C.slate,{sz:11,bold:true,color:C.white},totalCols,28);
  const r3=r2+1; ws.getRow(r3).height=34;
  ['م','اسم الطالب','الحلقة'].forEach((h,i)=>sc(ws.getCell(r3,i+1),h,C.headBg,{sz:10,bold:true,color:C.headFg},'center',true));
  dates.forEach((d,i)=>{
    const dow=new Date(d).getDay(), day=+d.split('-')[2];
    const isFri=(dow===5), isHol=holidays.has(d);
    const bg = isFri||isHol ? C.emptyBg : C.headBg;
    sc(ws.getCell(r3,4+i), `${day}\n${dayNameAr(d)}`, bg, {sz:8,bold:true,color:isFri||isHol?'888888':C.headFg},'center',true);
  });
  sc(ws.getCell(r3,summaryStart),  'الحضور\nإجمالي', C.greenBg,{sz:9,bold:true,color:C.greenFg},'center',true);
  sc(ws.getCell(r3,summaryStart+1),'الغياب\nإجمالي', C.redBg,  {sz:9,bold:true,color:C.redFg},  'center',true);
  sc(ws.getCell(r3,summaryStart+2),'التأخير\nإجمالي',C.amberBg,{sz:9,bold:true,color:C.amberFg},'center',true);
  sc(ws.getCell(r3,summaryStart+3),'الاعذار\nإجمالي', C.blueBg, {sz:9,bold:true,color:C.blueFg}, 'center',true);
  sc(ws.getCell(r3,summaryStart+4),'إذن خروج', C.slate,{sz:9,bold:true,color:C.headFg},'center',true);
  let dr=r3+1;
  studs.forEach((s,si)=>{
    let present=0,absent=0,late=0,excused=0; const even=si%2===0;
    ws.getRow(dr).height=22;
    dataCell(ws.getCell(dr,1),si+1,even,'center');
    dataCell(ws.getCell(dr,2),s.name||'—',even,'right');
    const cls=db.classes.find(c=>c.id===s.classId);
    dataCell(ws.getCell(dr,3),cls?.name||'—',even,'right');
    dates.forEach((d,i)=>{
      const cell=ws.getCell(dr,4+i);
      const isFri=new Date(d).getDay()===5, isHol=holidays.has(d);
      if (isFri||isHol) { cell.value=''; cell.fill=xFill(C.emptyBg); cell.font=xFont({sz:9,color:'AAAAAA'}); cell.alignment=xAlign('center'); cell.border=xBorder(); return; }
      const a=att.find(x=>x.studentId===s.id&&x.date===d), st=a?.status||'';
      if (!st) { dataCell(cell,'—',even,'center'); return; }
      const sym=STATUS_SH[st]||'—';
      cell.value=sym; cell.fill=xFill(STATUS_BG[st]||C.rowA);
      cell.font=xFont({sz:9,bold:true,color:STATUS_FG[st]||'000000'});
      cell.alignment=xAlign('center'); cell.border=xBorder();
      if (st==='Present') present++; else if (st==='Absent') absent++; else if (st==='Late') late++; else if (st==='Excused') excused++;
    });
    const exitCnt = (db.leaves||[]).filter(l=>l.studentId===s.id&&l.type==='Permission'&&inGregorianMonth(l.date,+year,+month)).length;
    dataCell(ws.getCell(dr,summaryStart),present,even,'center',true,C.greenBg);
    dataCell(ws.getCell(dr,summaryStart+1),absent,even,'center',true,C.redBg);
    dataCell(ws.getCell(dr,summaryStart+2),late,even,'center',true,C.amberBg);
    dataCell(ws.getCell(dr,summaryStart+3),excused,even,'center',true,C.blueBg);
    dataCell(ws.getCell(dr,summaryStart+4),exitCnt,even,'center',true,C.slate);
    dr++;
  });
  return wb;
}

async function buildTeacherMonthlySheetGregorian(db, year, month) {
  const wb  = new ExcelJS.Workbook();
  const ws  = wb.addWorksheet('ساعات المعلمين', {views:[{rightToLeft:true}]});
  const school = db.settings.schoolName||'حضور الحلقات';
  const logs   = db.teacherLog.filter(l=>inGregorianMonth(l.date,+year,+month));
  const dates  = getAllGregorianMonthDates(+year, +month);
  const holidays = new Set((db.holidays||[]).filter(h=>inGregorianMonth(h.date,+year,+month)).map(h=>h.date));
  const totalDayCols=dates.length, summaryStart=3+totalDayCols, totalCols=summaryStart+2;
  ws.columns=[{width:24},{width:16},...Array(totalDayCols).fill({width:10}),{width:10},{width:12},{width:10}];
  const logoEnd=await addLogoImage(wb,ws,totalCols,db);
  const r1=logoEnd+1; titleRow(ws,r1,school,C.navy,{sz:14,bold:true,color:C.white},totalCols,36);
  const r2=r1+1; titleRow(ws,r2,`تقرير ساعات المعلمين — ${GM[+month]} ${year}م`,C.slate,{sz:11,bold:true,color:C.white},totalCols,28);
  const r3=r2+1; ws.getRow(r3).height=34;
  sc(ws.getCell(r3,1),'اسم المعلم',C.headBg,{sz:10,bold:true,color:C.headFg},'center',true);
  sc(ws.getCell(r3,2),'التخصص',   C.headBg,{sz:10,bold:true,color:C.headFg},'center',true);
  dates.forEach((d,i)=>{
    const day=+d.split('-')[2], isFri=new Date(d).getDay()===5, isHol=holidays.has(d);
    const bg=isFri||isHol?C.emptyBg:C.headBg;
    sc(ws.getCell(r3,3+i),`${day}\n${dayNameAr(d)}`,bg,{sz:8,bold:true,color:isFri||isHol?'888888':C.headFg},'center',true);
  });
  sc(ws.getCell(r3,summaryStart),  'أيام\nالحضور',   C.headBg, {sz:9,bold:true,color:C.headFg}, 'center',true);
  sc(ws.getCell(r3,summaryStart+1),'إجمالي\nالساعات', C.greenBg,{sz:9,bold:true,color:C.greenFg},'center',true);
  sc(ws.getCell(r3,summaryStart+2),'إجمالي\nالدقائق', C.headBg, {sz:9,bold:true,color:C.headFg}, 'center',true);
  let dr=r3+1, grandTotal=0;
  db.teachers.forEach((t,ti)=>{
    const tLogs=logs.filter(l=>l.teacherId===t.id);
    let totalMins=0; const even=ti%2===0;
    ws.getRow(dr).height=26;
    dataCell(ws.getCell(dr,1),t.name||'—',even,'right');
    dataCell(ws.getCell(dr,2),t.subject||'—',even,'right');
    dates.forEach((d,i)=>{
      const cell=ws.getCell(dr,3+i);
      const isFri=new Date(d).getDay()===5, isHol=holidays.has(d);
      const l=tLogs.find(x=>x.date===d);
      if (isFri||isHol) {
        if (l&&l.checkIn) { const mins=calcSessionMins(l.checkIn,l.checkOut); totalMins+=mins; cell.value=l.checkIn+(l.checkOut?'\n'+l.checkOut:' *'); cell.fill=xFill('FEF3C7'); cell.font=xFont({sz:8,color:'92400E'}); cell.alignment=xAlign('center','middle',true); cell.border=xBorder(); }
        else { cell.value=''; cell.fill=xFill(C.emptyBg); cell.font=xFont({sz:9,color:'AAAAAA'}); cell.alignment=xAlign('center'); cell.border=xBorder(); }
        return;
      }
      if (!l) { dataCell(cell,'—',even,'center'); return; }
      const mins=calcSessionMins(l.checkIn,l.checkOut); totalMins+=mins;
      cell.value=l.checkIn+(l.checkOut?'\n'+l.checkOut:' *');
      cell.fill=xFill(mins?C.greenBg:(even?C.rowA:C.rowB));
      cell.font=xFont({sz:8,color:mins?C.greenFg:'444444'});
      cell.alignment=xAlign('center','middle',true); cell.border=xBorder();
    });
    grandTotal+=totalMins;
    dataCell(ws.getCell(dr,summaryStart),tLogs.filter(l=>l.checkIn).length,even,'center',true);
    dataCell(ws.getCell(dr,summaryStart+1),Math.floor(totalMins/60),even,'center',true,C.greenBg);
    dataCell(ws.getCell(dr,summaryStart+2),totalMins%60,even,'center');
    dr++;
  });
  ws.getRow(dr).height=6; for(let c=1;c<=totalCols;c++) ws.getCell(dr,c).fill=xFill(C.headBg); dr++;
  ws.getRow(dr).height=26; ws.mergeCells(dr,1,dr,summaryStart);
  sc(ws.getCell(dr,1),'الإجمالي الكلي:',C.totalBg,{sz:10,bold:true,color:C.headFg},'right');
  sc(ws.getCell(dr,summaryStart+1),Math.floor(grandTotal/60),C.greenBg,{sz:10,bold:true,color:C.greenFg},'center');
  sc(ws.getCell(dr,summaryStart+2),grandTotal%60,C.totalBg,{sz:10,bold:true,color:C.headFg},'center');
  return wb;
}

// ── Multer ───────────────────────────────────────────────
// multer — ذاكرة مؤقتة (الملفات تُرفع لـ Supabase Storage مباشرة)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10*1024*1024 }
});

// ── رفع ملف إلى Supabase Storage ────────────────────────
// أنشئ الحاوية مرة واحدة: Supabase → Storage → New bucket → uploads → Public
const STORAGE_BUCKET = process.env.SUPABASE_BUCKET || 'uploads';
async function uploadToSupabase(buffer, mimetype, originalName) {
  const ext      = (originalName.split('.').pop() || 'bin').replace(/[^\w]/g, '');
  const filename = `${newId()}.${ext}`;
  const { error } = await _supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filename, buffer, { contentType: mimetype, upsert: false });
  if (error) throw new Error('Supabase Storage error: ' + error.message);
  const { data } = _supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

// ── Middleware ───────────────────────────────────────────
app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true }));
app.use('/uploads', express.static(UPLOADS_DIR));

// خدمة الملفات الثابتة: أولاً app/ ثم المجلد الجذر
if (fs.existsSync(APP_DIR)) app.use(express.static(APP_DIR));
app.use(express.static(ROOT_DIR));

// ════════════════════════════════════════════════════════
//  SSE — Server-Sent Events (real-time push to clients)
// ════════════════════════════════════════════════════════
const _sseClients = new Set();

// Each client connects here and gets a persistent stream
app.get('/api/events/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx passthrough
  res.flushHeaders();

  // Send a heartbeat immediately so the browser knows we're alive
  res.write('event: connected\ndata: ok\n\n');

  const client = { res, role: req.query.role || 'admin' };
  _sseClients.add(client);

  // Heartbeat every 25s to keep connection alive through proxies
  const hb = setInterval(() => { try { res.write(':hb\n\n'); } catch(e){} }, 25000);

  req.on('close', () => {
    clearInterval(hb);
    _sseClients.delete(client);
  });
});

// Push an event to all admin/moderator clients (not teachers)
function ssePush(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  _sseClients.forEach(client => {
    if (client.role === 'teacher') return; // teachers don't get admin notifs
    try { client.res.write(payload); } catch(e) { _sseClients.delete(client); }
  });
}

// Also keep the old WA queue stream working (redirect to unified stream)
app.get('/api/whatsapp/queue/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const db = readDB();
  const pending = (db.waQueue || []).filter(m => m.status === 'pending').length;
  res.write(`data: ${pending}\n\n`);

  const client = { res, role: 'admin', _waOnly: true };
  _sseClients.add(client);
  const hb = setInterval(() => { try { res.write(':hb\n\n'); } catch(e){} }, 25000);
  req.on('close', () => { clearInterval(hb); _sseClients.delete(client); });
});

// Helper: push WA queue count to all wa-only legacy clients
function ssePushWaCount() {
  const db = readDB();
  const count = (db.waQueue || []).filter(m => m.status === 'pending').length;
  _sseClients.forEach(client => {
    if (!client._waOnly) return;
    try { client.res.write(`data: ${count}\n\n`); } catch(e) { _sseClients.delete(client); }
  });
}


app.get('/api/debug/accounts', (req, res) => {
  const db = readDB();
  res.json(db.accounts.map(a => ({ id: a.id, username: a.username, role: a.role, name: a.name })));
});

// ── Force-create/reset admin account ─────────────────────
app.get('/api/debug/reset-admin', (req, res) => {
  const db = readDB();
  const pin = db.settings.pin || '1234';
  db.accounts = db.accounts.filter(a => a.id !== 'admin');
  db.accounts.unshift({ id:'admin', name:'المدير', username:'admin', password: pin, role:'admin', assignedClasses:[] });
  writeDB(db);
  res.json({ ok: true, username: 'admin', password: pin });
});

// ════════════════════════════════════════════════════════
//  1. المصادقة
// ════════════════════════════════════════════════════════
app.post('/api/auth/verify', (req, res) => {
  const { pin, username, password } = req.body;
  const db = readDB();
  console.log('[auth] attempt:', { username, password, accounts: db.accounts.map(a=>({u:a.username,p:a.password})) });

  // Legacy PIN-only login → maps to admin account
  if (pin !== undefined && username === undefined) {
    const valid = String(pin) === String(db.settings.pin || '1234');
    if (valid) {
      const admin = db.accounts.find(a => a.role === 'admin') || { id:'admin', name:'المدير', role:'admin', assignedClasses:[] };
      return res.json({ valid: true, role:'admin', userId: admin.id, name: admin.name, assignedClasses: [] });
    }
    return res.json({ valid: false });
  }

  // Username + password login
  const user = (db.accounts || []).find(a =>
    a.username === (username||'').trim() &&
    a.password === String(password||pin||'')
  );
  console.log('[auth] result:', user ? 'FOUND' : 'NOT FOUND');
  if (user) {
    return res.json({ valid: true, role: user.role, userId: user.id, name: user.name, assignedClasses: user.assignedClasses || [] });
  }
  res.json({ valid: false });
});

// ════════════════════════════════════════════════════════
//  الحسابات — Accounts (admin only)
// ════════════════════════════════════════════════════════
// تصدير الحسابات (مع كلمات المرور — للمدير فقط)
app.get('/api/accounts/export', async (req, res) => {
  try {
    const db   = readDB();
    const wb   = new ExcelJS.Workbook();
    const ws   = wb.addWorksheet('الحسابات', { views:[{rightToLeft:true}] });
    const school = db.settings.schoolName || 'حضور الحلقات';

    ws.columns = [
      {width:6}, {width:22}, {width:20}, {width:18}, {width:12}, {width:28}
    ];

    // Title rows
    const logoEnd = await addLogoImage(wb, ws, 6, db);
    const r1 = logoEnd + 1;
    titleRow(ws, r1, school, C.navy, {sz:13,bold:true,color:C.white}, 6, 34);
    const r2 = r1 + 1;
    titleRow(ws, r2, 'قائمة الحسابات', C.slate, {sz:11,bold:true,color:C.white}, 6, 28);

    // Header row
    const r3 = r2 + 1;
    ws.getRow(r3).height = 26;
    ['م','الاسم','اسم المستخدم','كلمة المرور','الدور','الحلقات المُسندة'].forEach((h,i) =>
      sc(ws.getCell(r3,i+1), h, C.headBg, {sz:10,bold:true,color:C.headFg}, 'center', true));

    const ROLE_AR = { admin:'مدير', moderator:'مشرف', teacher:'معلم' };
    let dr = r3 + 1;
    db.accounts.forEach((a, idx) => {
      const even = idx % 2 === 0;
      ws.getRow(dr).height = 22;
      const assigned = (a.assignedClasses||[])
        .map(id => db.classes.find(c=>c.id===id)?.name).filter(Boolean).join('، ') || '—';
      dataCell(ws.getCell(dr,1), idx+1, even, 'center');
      dataCell(ws.getCell(dr,2), a.name||'—', even, 'right');
      dataCell(ws.getCell(dr,3), a.username||'—', even, 'center');
      dataCell(ws.getCell(dr,4), a.password||'—', even, 'center');
      // Role with color badge
      const roleColors = { admin:C.navy, moderator:C.amberBg, teacher:C.greenBg };
      const roleFg     = { admin:C.white, moderator:C.amberFg, teacher:C.greenFg };
      const rc = ws.getCell(dr,5);
      rc.value = ROLE_AR[a.role]||a.role; rc.fill = xFill(roleColors[a.role]||C.rowA);
      rc.font = xFont({sz:10,bold:true,color:roleFg[a.role]||'000000'});
      rc.alignment = xAlign('center','middle'); rc.border = xBorder();
      dataCell(ws.getCell(dr,6), assigned, even, 'right');
      dr++;
    });

    // Footer bar
    ws.getRow(dr).height = 6;
    for(let c=1;c<=6;c++) ws.getCell(dr,c).fill = xFill(C.headBg);
    dr++;
    ws.mergeCells(dr,1,dr,6);
    sc(ws.getCell(dr,1), `إجمالي: ${db.accounts.length} حساب`, C.totalBg, {sz:10,bold:true,color:C.headFg}, 'right');

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', arabicFilename('الحسابات'));
    await wb.xlsx.write(res);
  } catch(e) { console.error(e); res.status(500).json({error:e.message}); }
});

// استيراد الحسابات
app.post('/api/accounts/import', (req, res) => {
  const { accounts, mode } = req.body; // mode: 'merge' | 'replace'
  if (!Array.isArray(accounts)) return res.status(400).json({ error: 'بيانات غير صالحة' });
  saveDB(db => {
    if (mode === 'replace') {
      // Keep existing admin if import has none
      const hasAdmin = accounts.some(a => a.role === 'admin');
      if (!hasAdmin) {
        const existingAdmin = db.accounts.find(a => a.role === 'admin');
        if (existingAdmin) accounts.unshift(existingAdmin);
      }
      db.accounts = accounts;
    } else {
      // Merge: add new accounts, update existing by username
      accounts.forEach(imported => {
        const idx = db.accounts.findIndex(a => a.username === imported.username);
        if (idx >= 0) { db.accounts[idx] = { ...db.accounts[idx], ...imported }; }
        else { db.accounts.push({ ...imported, id: imported.id || newId() }); }
      });
    }
  });
  res.json({ ok: true, count: accounts.length });
});

app.get('/api/accounts', (req, res) => {
  const db = readDB();
  // Never send passwords to the client
  res.json((db.accounts || []).map(a => ({ ...a, password: undefined })));
});

app.post('/api/accounts', (req, res) => {
  const { name, username, password, role, assignedClasses } = req.body;
  if (!name || !username || !password || !role) return res.status(400).json({ error: 'بيانات ناقصة' });
  const db = readDB();
  if (db.accounts.find(a => a.username === username)) return res.status(400).json({ error: 'اسم المستخدم مستخدم بالفعل' });
  const account = { id: newId(), name, username, password, role, assignedClasses: assignedClasses || [] };
  db.accounts.push(account);
  writeDB(db);
  res.json({ id: account.id });
});

app.put('/api/accounts/:id', (req, res) => {
  const db = readDB();
  const i = db.accounts.findIndex(a => a.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'الحساب غير موجود' });
  const { name, username, password, role, assignedClasses } = req.body;
  // Check username uniqueness
  if (username && db.accounts.some((a, idx) => a.username === username && idx !== i))
    return res.status(400).json({ error: 'اسم المستخدم مستخدم بالفعل' });
  db.accounts[i] = {
    ...db.accounts[i],
    ...(name && { name }),
    ...(username && { username }),
    ...(password && { password }),
    ...(role && { role }),
    ...(assignedClasses !== undefined && { assignedClasses }),
  };
  writeDB(db);
  res.json({ ok: true });
});

app.delete('/api/accounts/:id', (req, res) => {
  const db = readDB();
  const account = db.accounts.find(a => a.id === req.params.id);
  if (account?.role === 'admin' && db.accounts.filter(a => a.role === 'admin').length <= 1)
    return res.status(400).json({ error: 'لا يمكن حذف آخر حساب مدير' });
  db.accounts = db.accounts.filter(a => a.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});


// ════════════════════════════════════════════════════════
//  2. الطلاب
// ════════════════════════════════════════════════════════
app.get('/api/students', (_, res) => res.json(readDB().students));

app.post('/api/students', (req, res) => {
  const id = newId();
  saveDB(db => db.students.push({ ...req.body, id }));
  res.json({ id });
});

app.put('/api/students/:id', (req, res) => {
  saveDB(db => {
    const i = db.students.findIndex(s => s.id === req.params.id);
    if (i>=0) db.students[i] = { ...db.students[i], ...req.body, id:req.params.id };
  });
  res.json({ ok:true });
});

app.delete('/api/students/:id', (req, res) => {
  saveDB(db => { db.students = db.students.filter(s => s.id !== req.params.id); });
  res.json({ ok:true });
});


// ════════════════════════════════════════════════════════
//  PUBLIC — صفحة التسجيل (بدون تسجيل دخول)
// ════════════════════════════════════════════════════════
app.get('/admission', (req, res) => {
  const fromApp  = path.join(APP_DIR, 'admission.html');
  const fromRoot = path.join(ROOT_DIR, 'admission.html');
  if (fs.existsSync(fromApp))  return res.sendFile(fromApp);
  if (fs.existsSync(fromRoot)) return res.sendFile(fromRoot);
  res.status(404).send('admission.html not found');
});

// Public POST — لا يحتاج تسجيل دخول (للطلاب وأولياء الأمور)
app.post('/api/public/admissions', (req, res) => {
  const id = newId();
  const entry = { ...req.body, id, status: 'pending', createdAt: new Date().toISOString() };
  saveDB(db => {
    if (!db.admissionRequests) db.admissionRequests = [];
    db.admissionRequests.push(entry);
  });
  // Push real-time notification to all admin/moderator clients
  ssePush('newAdmission', { id, fullName: entry.fullName, grade: entry.grade });
  res.json({ ok: true, id });
});

// ════════════════════════════════════════════════════════
//  نظام القبول — Admission Requests
// ════════════════════════════════════════════════════════
// Add to DEFAULT_DB:
//   admissionRequests: []

app.get('/api/admissions', (req, res) => {
  res.json(readDB().admissionRequests || []);
});

app.post('/api/admissions', (req, res) => {
  const id = newId();
  const entry = { ...req.body, id, status: 'pending', createdAt: new Date().toISOString() };
  saveDB(db => {
    if (!db.admissionRequests) db.admissionRequests = [];
    db.admissionRequests.push(entry);
  });
  ssePush('newAdmission', { id, fullName: entry.fullName, grade: entry.grade });
  res.json({ ok: true, id });
});

app.put('/api/admissions/:id/accept', (req, res) => {
  const db = readDB();
  const req_ = (db.admissionRequests || []).find(r => r.id === req.params.id);
  if (!req_) return res.status(404).json({ error: 'not found' });
  const studentId = newId();
  saveDB(db => {
    const i = (db.admissionRequests || []).findIndex(r => r.id === req.params.id);
    if (i >= 0) db.admissionRequests[i].status = 'accepted';
    db.students.push({
      id: studentId,
      name: req_.fullName,
      nationalId: req_.nationalId,
      nationality: req_.nationality,
      district: req_.district,
      birthDate: req_.birthDate,
      grade: req_.grade,
      lastSurah: req_.lastSurah,
      parentPhone: req_.parentPhone1,
      parentPhone2: req_.parentPhone2,
      email: req_.email || '',
      studentPhone: req_.studentPhone,
      classId: req.body?.classId || '',
      studentId: req_.nationalId || '',
    });
  });
  res.json({ ok: true, studentId });
});

app.put('/api/admissions/:id/reject', (req, res) => {
  saveDB(db => {
    const i = (db.admissionRequests || []).findIndex(r => r.id === req.params.id);
    if (i >= 0) { db.admissionRequests[i].status = 'rejected'; db.admissionRequests[i].rejectReason = req.body?.reason || ''; }
  });
  res.json({ ok: true });
});

app.delete('/api/admissions/:id', (req, res) => {
  saveDB(db => { db.admissionRequests = (db.admissionRequests || []).filter(r => r.id !== req.params.id); });
  res.json({ ok: true });
});


// ════════════════════════════════════════════════════════
//  2b. تقدم القرآن
// ════════════════════════════════════════════════════════
app.get('/api/quran-progress', (req, res) => {
  const { studentId, classId } = req.query;
  const db = readDB();
  let list = db.quranProgress || [];
  if (studentId) list = list.filter(p => p.studentId === studentId);
  if (classId)   list = list.filter(p => p.classId   === classId);
  list = list.sort((a,b) => b.date.localeCompare(a.date));
  res.json(list);
});

app.post('/api/quran-progress', (req, res) => {
  const id = newId();
  saveDB(db => {
    if (!db.quranProgress) db.quranProgress = [];
    db.quranProgress.push({ ...req.body, id });
  });
  res.json({ id });
});

app.put('/api/quran-progress/:id', (req, res) => {
  saveDB(db => {
    const i = (db.quranProgress||[]).findIndex(p => p.id === req.params.id);
    if (i>=0) db.quranProgress[i] = { ...db.quranProgress[i], ...req.body, id:req.params.id };
  });
  res.json({ ok:true });
});

app.delete('/api/quran-progress/:id', (req, res) => {
  saveDB(db => { db.quranProgress = (db.quranProgress||[]).filter(p => p.id !== req.params.id); });
  res.json({ ok:true });
});

// Summary: latest position per student (for class overview)
app.get('/api/quran-progress/summary', (req, res) => {
  const { classId } = req.query;
  const db = readDB();
  let students = db.students;
  if (classId) students = students.filter(s => s.classId === classId);
  const progress = db.quranProgress || [];
  const summary = students.map(s => {
    const entries = progress.filter(p => p.studentId === s.id).sort((a,b) => b.date.localeCompare(a.date));
    const latest  = entries[0] || null;
    const totalMemorized = entries.filter(e=>e.type==='memorization').reduce((acc,e)=>{
      const from = e.ayahFrom||0, to = e.ayahTo||0;
      return acc + Math.max(0, to - from + 1);
    }, 0);
    return { studentId:s.id, name:s.name, classId:s.classId, latest, totalEntries:entries.length, totalMemorized };
  });
  res.json(summary);
});

// يجب أن يأتي قبل /:id
app.post('/api/students/import-preview', upload.single('file'), (req, res) => {
  if (!req.file) return res.json({ ok:false, error:'لم يتم استلام الملف — تأكد من اختيار ملف Excel أو CSV' });
  try {
    const ext = path.extname(req.file.originalname || '').toLowerCase();
    let wb;
    if (ext === '.csv') {
      const content = fs.readFileSync(req.file.path, 'utf8');
      wb = XLSX.read(content, { type:'string' });
    } else {
      wb = XLSX.readFile(req.file.path);
    }
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:'' });
    try { fs.unlinkSync(req.file.path); } catch(e){}
    if (!rows.length) return res.json({ ok:false, error:'الملف فارغ أو لا يحتوي على بيانات' });
    res.json({ ok:true, headers:Object.keys(rows[0]), rows:rows.slice(0,100), total:rows.length });
  } catch(e) {
    try { if (req.file && req.file.path) fs.unlinkSync(req.file.path); } catch(_){}
    res.json({ ok:false, error:'خطأ في قراءة الملف: ' + e.message });
  }
});

app.post('/api/students/import-confirm', (req, res) => {
  const { students:incoming=[], classId='', forceAdd=false } = req.body;
  const db = readDB();
  let added=0, skipped=0;
  const duplicates = []; // [{name, existingClass}]

  for (const s of incoming) {
    if (!s.name?.trim()) { skipped++; continue; }
    // Check duplicate by name (anywhere in the system, not just same class)
    const dup = db.students.find(x => x.name.trim().toLowerCase() === s.name.trim().toLowerCase());
    if (dup) {
      if (!forceAdd) {
        const cls = db.classes.find(c => c.id === dup.classId);
        duplicates.push({ name: s.name.trim(), existingClass: cls?.name || 'بدون حلقة' });
        continue;
      }
      // forceAdd=true means user confirmed — still skip exact duplicates in same class
      const exactDup = db.students.find(x =>
        x.name.trim().toLowerCase() === s.name.trim().toLowerCase() &&
        x.classId === (classId || s.classId || '')
      );
      if (exactDup) { skipped++; continue; }
    }
    db.students.push({ ...s, name:s.name.trim(), id:newId(), classId:classId||s.classId||'' });
    added++;
  }
  writeDB(db);
  // If duplicates found and not forced, return them for user review
  if (duplicates.length > 0 && !forceAdd) {
    return res.json({ ok:true, added, skipped, duplicates, needsConfirm: true });
  }
  res.json({ ok:true, added, skipped, duplicates:[] });
});

app.get('/api/students/:id', (req, res) => {
  const db = readDB();
  const s  = db.students.find(x => x.id===req.params.id);
  if (!s) return res.json({ success:false });
  const history = db.attendance.filter(a=>a.studentId===s.id).sort((a,b)=>b.date.localeCompare(a.date));
  const leaves  = db.leaves.filter(l=>l.studentId===s.id).sort((a,b)=>b.date.localeCompare(a.date));
  const notices = (db.notices||[]).filter(n=>n.studentId===s.id).sort((a,b)=>b.date.localeCompare(a.date));
  res.json({ ...s, history, leaves, notices });
});

app.post('/api/students/:id/photo', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.json({ ok:false, error:'لم يتم استلام الملف' });
  try {
    const url = await uploadToSupabase(req.file.buffer, req.file.mimetype, req.file.originalname);
    saveDB(db => { const i=db.students.findIndex(s=>s.id===req.params.id); if(i>=0) db.students[i].photo=url; });
    res.json({ ok:true, url });
  } catch(e) {
    console.error('[photo] student:', e.message);
    res.status(500).json({ ok:false, error: e.message });
  }
});

// صورة المعلم
app.post('/api/teachers/:id/photo', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.json({ ok:false, error:'لم يتم استلام الملف' });
  try {
    const url = await uploadToSupabase(req.file.buffer, req.file.mimetype, req.file.originalname);
    saveDB(db => { const i=db.teachers.findIndex(t=>t.id===req.params.id); if(i>=0) db.teachers[i].photo=url; });
    res.json({ ok:true, url });
  } catch(e) {
    console.error('[photo] teacher:', e.message);
    res.status(500).json({ ok:false, error: e.message });
  }
});

// صورة الحساب (مدير / مشرف)
app.post('/api/accounts/:id/photo', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.json({ ok:false, error:'لم يتم استلام الملف' });
  try {
    const url = await uploadToSupabase(req.file.buffer, req.file.mimetype, req.file.originalname);
    saveDB(db => { const i=db.accounts.findIndex(a=>a.id===req.params.id); if(i>=0) db.accounts[i].photo=url; });
    res.json({ ok:true, url });
  } catch(e) {
    console.error('[photo] account:', e.message);
    res.status(500).json({ ok:false, error: e.message });
  }
});


// ════════════════════════════════════════════════════════
//  3. الحلقات
// ════════════════════════════════════════════════════════
app.get('/api/classes', (_, res) => res.json(readDB().classes));
app.post('/api/classes', (req, res) => {
  const id=newId(); saveDB(db=>db.classes.push({...req.body,id})); res.json({id});
});
app.put('/api/classes/:id', (req, res) => {
  saveDB(db=>{ const i=db.classes.findIndex(c=>c.id===req.params.id); if(i>=0) db.classes[i]={...db.classes[i],...req.body,id:req.params.id}; });
  res.json({ok:true});
});
app.delete('/api/classes/:id', (req, res) => {
  saveDB(db=>{ db.classes=db.classes.filter(c=>c.id!==req.params.id); }); res.json({ok:true});
});


// ════════════════════════════════════════════════════════
//  4. المعلمون
// ════════════════════════════════════════════════════════
app.get('/api/teachers', (_, res) => res.json(readDB().teachers));

app.get('/api/teachers/:id', (req, res) => {
  const db = readDB();
  const t  = db.teachers.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'المعلم غير موجود' });
  const log = db.teacherLog
    .filter(l => l.teacherId === t.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const today   = nowDate();
  const _nowStr = nowTime(); // FIX: was `const nowTime = nowTime()` — crashed every teacher request

  // Duration per entry:
  //  • checkOut exists → actual duration
  //  • no checkOut + today → live (current time)
  //  • no checkOut + past → fallback: checkIn + 4 h (calcSessionMins)
  const logWithDuration = log.map(l => {
    let mins = 0;
    if (l.checkIn) {
      if (l.checkOut) {
        mins = calcSessionMins(l.checkIn, l.checkOut);
      } else if (l.date === today) {
        const [h1,m1] = l.checkIn.split(':').map(Number);
        const [h2,m2] = _nowStr.split(':').map(Number);
        mins = Math.max(0,(h2*60+m2)-(h1*60+m1));
      } else {
        mins = calcSessionMins(l.checkIn, null); // 4-hour fallback
      }
    }
    return { ...l, durationMins: mins };
  });

  const totalMins   = logWithDuration.reduce((s, l) => s + l.durationMins, 0);
  const daysPresent = logWithDuration.filter(l => l.checkIn).length;

  // Monthly hours: use Hijri month (matches Excel reports & frontend)
  const _th = toHijri(today);
  const monthlyMins = logWithDuration
    .filter(l => { if(!l.date) return false; const h=toHijri(l.date); return h.year===_th.year && h.month===_th.month; })
    .reduce((s, l) => s + l.durationMins, 0);

  // Today's hours
  const todayEntry  = logWithDuration.find(l => l.date === today);
  const todayMins   = todayEntry ? todayEntry.durationMins : 0;
  const todayLive   = !!(todayEntry && todayEntry.checkIn && !todayEntry.checkOut);

  const monthMap = {};
  logWithDuration.forEach(l => {
    if (!l.date) return;
    const h = toHijri(l.date);
    const key = `${h.year}-${String(h.month).padStart(2,'0')}`;
    if (!monthMap[key]) monthMap[key] = { year: h.year, month: h.month, logs: [] };
    monthMap[key].logs.push(l);
  });
  const monthlyHistory = Object.values(monthMap)
    .sort((a, b) => a.year !== b.year ? b.year - a.year : b.month - a.month)
    .map(m => ({
      year: m.year, month: m.month, monthName: HM[m.month],
      days: m.logs.filter(l => l.checkIn).length,
      totalMins: m.logs.reduce((s, l) => s + (l.durationMins || 0), 0),
      logs: m.logs.sort((a, b) => b.date.localeCompare(a.date)),
    }));
  res.json({ ...t, log: logWithDuration, totalMins, daysPresent, monthlyMins, todayMins, todayLive, monthlyHistory });
});
app.post('/api/teachers', (req, res) => {
  const id=newId(); saveDB(db=>db.teachers.push({...req.body,id})); res.json({id});
});
app.put('/api/teachers/:id', (req, res) => {
  saveDB(db=>{ const i=db.teachers.findIndex(t=>t.id===req.params.id); if(i>=0) db.teachers[i]={...db.teachers[i],...req.body,id:req.params.id}; });
  res.json({ok:true});
});
app.delete('/api/teachers/:id', (req, res) => {
  saveDB(db=>{ db.teachers=db.teachers.filter(t=>t.id!==req.params.id); }); res.json({ok:true});
});


// ════════════════════════════════════════════════════════
//  5. سجل حضور المعلمين
// ════════════════════════════════════════════════════════
app.get('/api/teacher-log', (req, res) => {
  const {date} = req.query;
  const {teacherLog} = readDB();
  res.json(date ? teacherLog.filter(l=>l.date===date) : teacherLog);
});

app.post('/api/teacher-log/checkin', (req, res) => {
  const {teacherId} = req.body;
  const today = nowDate();
  const time  = nowTime();
  const db    = readDB();
  // Auto-close any open sessions from previous days (teacher forgot to checkout)
  db.teacherLog.forEach(l => {
    if (l.teacherId===teacherId && l.date<today && l.checkIn && !l.checkOut) {
      const [hIn,mIn]=l.checkIn.split(':').map(Number);
      const tot=Math.min(hIn*60+mIn+240,1439);
      l.checkOut=String(Math.floor(tot/60)).padStart(2,'0')+':'+String(tot%60).padStart(2,'0');
    }
  });
  if (db.teacherLog.find(l=>l.teacherId===teacherId && l.date===today))
    return res.json({error:'تم تسجيل الحضور مسبقاً لهذا اليوم'});
  db.teacherLog.push({id:newId(), teacherId, date:today, checkIn:time, checkOut:null});
  writeDB(db);
  res.json({ok:true, time});
});

app.post('/api/teacher-log/checkout', (req, res) => {
  const {teacherId} = req.body;
  const today = nowDate();
  const time  = nowTime();
  const db    = readDB();
  const entry = db.teacherLog.find(l=>l.teacherId===teacherId && l.date===today);
  if (!entry)          return res.json({error:'لم يتم تسجيل الحضور بعد'});
  if (entry.checkOut)  return res.json({error:'تم تسجيل الانصراف مسبقاً'});
  entry.checkOut = time;
  const mins = calcSessionMins(entry.checkIn, time);
  const duration = `${Math.floor(mins/60)} ساعة ${mins%60} دقيقة`;
  writeDB(db);
  res.json({ok:true, duration});
});


// ════════════════════════════════════════════════════════
//  6. الإجازات
// ════════════════════════════════════════════════════════
app.get('/api/holidays', (_, res) => res.json(readDB().holidays));

app.get('/api/holidays/check/:date', (req, res) => {
  const {date} = req.params;
  if (new Date(date).getDay()===5) return res.json({isHoliday:true, reason:'يوم الجمعة'});
  const h = readDB().holidays.find(x=>x.date===date);
  res.json(h ? {isHoliday:true, reason:h.reason||h.type||'إجازة'} : {isHoliday:false});
});

app.post('/api/holidays', (req, res) => {
  const id=newId();
  saveDB(db=>{ db.holidays=db.holidays.filter(h=>h.date!==req.body.date); db.holidays.push({...req.body,id}); });
  res.json({ok:true,id});
});

app.delete('/api/holidays/:date', (req, res) => {
  saveDB(db=>{ db.holidays=db.holidays.filter(h=>h.date!==req.params.date); }); res.json({ok:true});
});


// ════════════════════════════════════════════════════════
//  7. الحضور
// ════════════════════════════════════════════════════════
app.get('/api/attendance', (req, res) => {
  const {date,classId} = req.query;
  let r = readDB().attendance;
  if (date)    r = r.filter(a=>a.date===date);
  if (classId) r = r.filter(a=>a.classId===classId);
  res.json(r);
});

app.post('/api/attendance/batch', (req, res) => {
  const {date, classId, records, teacherName} = req.body;
  const db = readDB();
  for (const r of records) {
    const i = db.attendance.findIndex(a=>a.studentId===r.studentId && a.date===date);
    if (i>=0) { db.attendance[i] = {...db.attendance[i], status:r.status, notes:r.notes||''}; }
    else      { db.attendance.push({id:newId(), date, classId, studentId:r.studentId, status:r.status, notes:r.notes||''}); }
  }
  writeDB(db);

  // Push real-time notification to admins/moderators
  const cls     = db.classes.find(c => c.id === classId);
  const present = records.filter(r => r.status === 'Present').length;
  const absent  = records.filter(r => r.status === 'Absent').length;
  const late    = records.filter(r => r.status === 'Late').length;
  const clsName = cls?.name || 'حلقة';
  const teacher = teacherName || 'معلم';

  const pushData = {
    type: 'attendance', classId,
    className: clsName, teacherName: teacher,
    date, total: String(records.length),
    present: String(present), absent: String(absent), late: String(late),
    ts: String(Date.now()),
  };

  // SSE — for open browser sessions
  ssePush('attendance', pushData);

  // WhatsApp — notify admin phone if configured
  const waToken = db.settings.whatsappApiKey;
  const adminPhone = db.settings.adminPhone;
  if (waToken && adminPhone) {
    const today = new Date().toLocaleDateString('ar-SA-u-ca-islamic', { day:'numeric', month:'long', year:'numeric' });
    const waMsg = `📋 *تسجيل حضور جديد*\n\n👨‍🏫 المعلم: ${teacher}\n📚 الحلقة: ${clsName}\n📅 ${today}\n\n✅ حاضر: ${present}\n❌ غائب: ${absent}${late ? `\n⏰ متأخر: ${late}` : ''}\n👥 الإجمالي: ${records.length}`;
    fonnteRequest(waToken, adminPhone, waMsg).catch(() => {});
  }

  res.json({ok:true});
});


// ════════════════════════════════════════════════════════
//  8. الإذن المسبق / الإجازة المرضية
// ════════════════════════════════════════════════════════
app.get('/api/leaves', (req, res) => {
  const {date,classId} = req.query;
  let r = readDB().leaves;
  if (date)    r = r.filter(l=>l.date===date);
  if (classId) r = r.filter(l=>l.classId===classId);
  res.json(r);
});

app.post('/api/leaves', (req, res) => {
  const id = newId();
  const { studentId, classId, date, type } = req.body;
  saveDB(db => {
    // Upsert: one record per student per date per type (no duplicates)
    db.leaves = db.leaves.filter(l => !(l.studentId === studentId && l.date === date && l.type === type));
    db.leaves.push({ ...req.body, id });
    // Auto-correct attendance: Absent → Excused ONLY for non-Permission types
    // إذن خروج is given to a student who ATTENDED and left early — do NOT change status
    if (studentId && date && type !== 'Permission') {
      const i = db.attendance.findIndex(a => a.studentId === studentId && a.date === date && a.status === 'Absent');
      if (i >= 0) {
        db.attendance[i] = { ...db.attendance[i], status: 'Excused', notes: type || 'إذن' };
      }
    }
  });
  res.json({ ok: true, id });
});

app.delete('/api/leaves/:id', (req, res) => {
  saveDB(db=>{ db.leaves=db.leaves.filter(l=>l.id!==req.params.id); }); res.json({ok:true});
});

// ════════════════════════════════════════════════════════
//  تعهدات وإنذارات
// ════════════════════════════════════════════════════════
app.get('/api/notices', (req, res) => {
  const { studentId } = req.query;
  let r = readDB().notices || [];
  if (studentId) r = r.filter(n => n.studentId === studentId);
  res.json(r);
});

app.post('/api/notices', (req, res) => {
  const id = newId();
  const createdAt = new Date().toISOString();
  saveDB(db => {
    if (!db.notices) db.notices = [];
    db.notices.push({ ...req.body, id, createdAt });
  });
  res.json({ ok: true, id });
});

app.delete('/api/notices/:id', (req, res) => {
  saveDB(db => { db.notices = (db.notices||[]).filter(n => n.id !== req.params.id); });
  res.json({ ok: true });
});


// ════════════════════════════════════════════════════════
//  9. الإحصائيات
// ════════════════════════════════════════════════════════
app.get('/api/stats', (req, res) => {
  const db    = readDB();
  const today = new Date().toISOString().split('T')[0];
  // Optional filter for teacher role: ?classIds=id1,id2
  const classFilter = req.query.classIds
    ? new Set(req.query.classIds.split(',').filter(Boolean))
    : null;

  const allClasses  = classFilter ? db.classes.filter(c => classFilter.has(c.id)) : db.classes;
  const allStudents = classFilter ? db.students.filter(s => classFilter.has(s.classId)) : db.students;
  const allClassIds = new Set(allClasses.map(c => c.id));

  const todayAtt = db.attendance.filter(a => a.date === today && (!classFilter || classFilter.has(a.classId)));
  const holiday  = db.holidays.find(h => h.date === today);
  const isHoliday = !!holiday || new Date().getDay() === 5;
  const teachersIn = db.teacherLog.filter(l => l.date === today && l.checkIn && !l.checkOut).length;

  const existingStudentIds = new Set(allStudents.map(s => s.id));
  const attByStudent = {};
  todayAtt.forEach(a => { if (existingStudentIds.has(a.studentId)) attByStudent[a.studentId] = a; });
  const uniqueAtt = Object.values(attByStudent);

  const classCoverage = allClasses.map(cls => {
    const clsStudents = allStudents.filter(s => s.classId === cls.id);
    if (clsStudents.length === 0) return { id: cls.id, name: cls.name, done: true, count: 0 };
    const recorded = clsStudents.filter(s => attByStudent[s.id]);
    return { id: cls.id, name: cls.name, done: recorded.length === clsStudents.length, count: clsStudents.length, recorded: recorded.length };
  });
  const classesTodo = classCoverage.filter(c => c.count > 0 && !c.done).map(c => c.name);

  res.json({
    totalStudents: allStudents.length,
    totalClasses:  allClasses.length,
    totalTeachers: db.teachers.length,
    presentToday:  uniqueAtt.filter(a => a.status === 'Present').length,
    absentToday:   uniqueAtt.filter(a => a.status === 'Absent').length,
    lateToday:     uniqueAtt.filter(a => a.status === 'Late').length,
    excusedToday:  uniqueAtt.filter(a => a.status === 'Excused').length,
    teachersIn,
    isHoliday,
    holidayReason: holiday?.reason || (isHoliday ? 'يوم الجمعة' : ''),
    classCoverage,
    classesTodo,
  });
});


// ════════════════════════════════════════════════════════
//  10. الإعدادات
// ════════════════════════════════════════════════════════
app.get('/api/settings', (_, res) => {
  const {settings} = readDB();
  const {pin, ...safe} = settings;   // لا نُرسل الـ PIN للواجهة
  res.json(safe);
});

app.put('/api/settings', (req, res) => {
  saveDB(db => {
    const {pin, ...rest} = req.body;
    if (pin) db.settings.pin = String(pin);
    Object.assign(db.settings, rest);
  });
  res.json({ok:true});
});

// رفع شعار
app.post('/api/settings/logos', upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ok:false, error:'لم يتم رفع ملف'});
  try {
    const url  = await uploadToSupabase(req.file.buffer, req.file.mimetype, req.file.originalname);
    const name = req.body.name || req.file.originalname;
    const id   = newId();
    saveDB(db => { if (!db.settings.logos) db.settings.logos=[]; db.settings.logos.push({id,url,name}); });
    res.json({ok:true, id, url});
  } catch(e) {
    console.error('[logo] upload:', e.message);
    res.status(500).json({ok:false, error: e.message});
  }
});

// حذف شعار
app.delete('/api/settings/logos/:id', (req, res) => {
  saveDB(db => {
    if (!db.settings.logos) return;
    const logo = db.settings.logos.find(l=>l.id===req.params.id);
    // الصورة مخزنة في Supabase Storage — لا حاجة لحذف ملف محلي
    db.settings.logos = db.settings.logos.filter(l=>l.id!==req.params.id);
  });
  res.json({ok:true});
});


// ════════════════════════════════════════════════════════
//  11. واتساب — Fonnte API (مجاني، وصل رقمك وأرسل لأي رقم)
//  https://md.fonnte.com  — سجّل وربط رقم واتساب خاصتك
// ════════════════════════════════════════════════════════
function buildMsg(settings, studentName, className, date) {
  const tmpl = settings.whatsappTemplate;
  if (tmpl) return tmpl
    .replace(/{اسم_الطالب}/g, studentName)
    .replace(/{الحلقة}/g, className)
    .replace(/{التاريخ}/g, formatHijri(date))
    .replace(/{اليوم}/g,   dayNameAr(date))
    .replace(/{المنشأة}/g, settings.schoolName||'');
  return `السلام عليكم،\n\nنُعلمكم بغياب الطالب *${studentName}* عن حلقة *${className}* يوم *${dayNameAr(date)}* بتاريخ ${formatHijri(date)}.\n\nرجاء التواصل مع الإدارة إن كان هناك عذر.\n\n— ${settings.schoolName||'إدارة الحلقات'}`;
}

function fonnteRequest(token, target, message, scheduleTs = 0) {
  return new Promise(resolve => {
    const raw = String(target||'').trim();
    const cleanTarget = raw.endsWith('@g.us') ? raw : raw.replace(/\D/g,'');
    if (!cleanTarget) return resolve({ ok: false, error: 'رقم الهاتف فارغ أو غير صالح' });
    const payload = { target: cleanTarget, message, delay:'2', countryCode:'966' };
    if (scheduleTs) payload.schedule = scheduleTs; // unix timestamp — Fonnte holds & sends it
    const body = JSON.stringify(payload);
    const opts = {
      hostname: 'api.fonnte.com',
      path:     '/send',
      method:   'POST',
      headers:  { 'Authorization': token, 'Content-Type':'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(opts, resp => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => {
        try {
          const j = JSON.parse(data);
          // Fonnte returns { status: true, id: ["12345"], ... } on success
          resolve({ ok: j.status === true, fonnteIds: j.id || [], error: j.reason || j.message || '', raw: data.slice(0,200) });
        } catch(e) {
          resolve({ ok: false, fonnteIds: [], error: 'استجابة غير متوقعة من الخادم', raw: data.slice(0,200) });
        }
      });
    });
    req.on('error', e => resolve({ ok:false, fonnteIds:[], error: e.message }));
    req.write(body);
    req.end();
  });
}

// Delete a previously scheduled Fonnte message by its Fonnte ID
function fonnteDeleteMessage(token, fonnteId) {
  return new Promise(resolve => {
    // Fonnte requires multipart/form-data (same as PHP curl with array postfields)
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="id"\r\n\r\n${fonnteId}\r\n--${boundary}--`;
    const opts = {
      hostname: 'api.fonnte.com',
      path:     '/delete-message',
      method:   'POST',
      headers:  {
        'Authorization': token,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(opts, resp => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => {
        console.log('[fonnte-delete] raw response:', data.slice(0,300));
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({ status: false, error: 'parse error', raw: data.slice(0,200) }); }
      });
    });
    req.on('error', e => resolve({ status: false, error: e.message }));
    req.write(body);
    req.end();
  });
}

// Schedule a calendar message event on Fonnte for each waTarget.
// Uses the existing fonnteRequest (same as absence messages — already proven to work).
async function scheduleEventOnFonnte(token, ev, schoolName) {
  if (!token || !ev.waTargets?.length || !ev.waMessage) return [];

  // Build schedule timestamp from user-set time in Saudi timezone (UTC+3)
  const timeStr = (ev.time && /^\d{1,2}:\d{2}$/.test(ev.time)) ? ev.time : '09:00';
  const scheduledMoment = new Date(`${ev.date}T${timeStr}:00+03:00`).getTime();
  const nowMs           = Date.now();

  // If event date+time is already past, skip — do NOT send immediately
  if (scheduledMoment < nowMs - 60000) {
    console.warn(`[fonnte-schedule] SKIPPED "${ev.title}" — date ${ev.date} ${timeStr} is in the past`);
    return [];
  }

  // If <2 min away, schedule 2 min from now
  const sendAt     = scheduledMoment > nowMs + 120000 ? scheduledMoment : nowMs + 120000;
  const scheduleTs = Math.floor(sendAt / 1000);

  console.log(`[fonnte-schedule] "${ev.title}" on ${ev.date} at ${timeStr} → ts=${scheduleTs} (${new Date(sendAt).toISOString()})`);

  const storedIds = [];

  for (const target of ev.waTargets) {
    if (!target.phone) continue;

    const msg = (ev.waMessage || '')
      .replace(/{اسم}/g,      target.name || '')
      .replace(/{الاسم}/g,    target.name || '')
      .replace(/{التاريخ}/g,  formatHijri(ev.date))
      .replace(/{اليوم}/g,    dayNameAr(ev.date))
      .replace(/{العنوان}/g,  ev.title || '')
      .replace(/{المنشأة}/g,  schoolName || '');

    // Use the SAME fonnteRequest used for absence messages — it works
    const result = await fonnteRequest(token, target.phone, msg, scheduleTs);

    console.log(`[fonnte-schedule] ${target.phone}: ${result.ok ? '✅ scheduled IDs=' + result.fonnteIds.join(',') : '❌ ' + result.error}`);

    if (result.fonnteIds?.length) {
      result.fonnteIds.forEach(fid => storedIds.push({ phone: target.phone, fonnteId: String(fid) }));
    }

    // Log to waLog — appears in notification panel and WA history
    saveDB(db3 => {
      db3.waLog = db3.waLog || [];
      db3.waLog.push({
        id:           newId(),
        type:         'scheduled',
        eventId:      ev.id,
        date:         ev.date,
        studentName:  target.name || target.phone,
        phone:        target.phone,
        className:    ev.title || '',
        message:      msg,
        status:       result.ok ? 'scheduled' : 'failed',
        fonnteIds:    result.fonnteIds || [],
        sentAt:       new Date().toISOString(),
        scheduledFor: new Date(sendAt).toISOString(),
        error:        result.ok ? '' : result.error,
      });
    });

    await new Promise(r => setTimeout(r, 700));
  }

  return storedIds;
}

app.post('/api/whatsapp/send', async (req, res) => {
  const { phone, studentName, className, date } = req.body;
  const { settings } = readDB();
  const token = settings.whatsappApiKey;

  if (!token) return res.json({ ok:false, error:'لم يتم إعداد Fonnte Token بعد — ادخل إلى الإعدادات' });

  const isTest      = !phone || phone === token;
  const actualPhone = isTest ? (settings.adminPhone||'') : phone;

  if (!actualPhone) return res.json({ ok:false, error: isTest
    ? 'أدخل رقم هاتف المدير في الإعدادات لاستخدام الاختبار'
    : 'رقم الهاتف غير موجود في بيانات الطالب'
  });

  const msg    = buildMsg(settings, studentName||'اختبار', className||'حلقة', date || new Date().toISOString().split('T')[0]);
  const result = await fonnteRequest(token, actualPhone, msg);
  res.json(result);
});

app.post('/api/whatsapp/send-bulk', async (req, res) => {
  const { records=[], date, classId } = req.body;
  const db           = readDB();
  const { settings } = db;
  const token        = settings.whatsappApiKey;
  const cls          = db.classes.find(c => c.id === classId);

  if (!token) return res.json({ ok:false, error:'Fonnte Token غير مُعيَّن في الإعدادات' });

  const results = []; let sent=0, failed=0;
  for (const r of records) {
    if (!r.phone) { results.push({ ok:false, error:'لا يوجد رقم هاتف' }); failed++; continue; }
    const msg    = buildMsg(settings, r.name, cls?.name||'', date);
    const result = await fonnteRequest(token, r.phone, msg);
    results.push(result);

    // تسجيل في السجل
    const db2 = readDB();
    db2.waLog = db2.waLog || [];
    db2.waLog.push({
      id: newId(), type:'absence', date,
      studentId: r.studentId||'', studentName: r.name,
      phone: r.phone, className: cls?.name||'', classId: classId||'',
      message: msg, status: result.ok ? 'sent' : 'failed',
      sentAt: new Date().toISOString(), error: result.error||''
    });
    writeDB(db2);

    if (result.ok) sent++; else failed++;
    await new Promise(ok => setTimeout(ok, 800));
  }
  res.json({ results, sent, failed });
});


// ════════════════════════════════════════════════════════
//  12-B. واتساب — Queue / Groups / Log / Custom Send
// ════════════════════════════════════════════════════════

// GET queue: all Absent records with no sent or dismissed waLog entry
app.get('/api/whatsapp/queue', (req, res) => {
  const db = readDB();

  const sentKeys = new Set(
    (db.waLog||[])
      .filter(l => l.status === 'sent' && l.studentId && l.date)
      .map(l => `${l.studentId}__${l.date}`)
  );

  const dismissedKeys = new Set(
    (db.waDismissed||[])
      .filter(d => d.studentId && d.date)
      .map(d => `${d.studentId}__${d.date}`)
  );

  const cutoff = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];
  const allAbsent = db.attendance.filter(a => a.status === 'Absent' && a.date >= cutoff);
  console.log('[waQueue] cutoff:', cutoff, '| absent records:', allAbsent.length, '| sent:', sentKeys.size, '| dismissed:', dismissedKeys.size);

  const queue = allAbsent
    .filter(a => {
      const key = `${a.studentId}__${a.date}`;
      return !sentKeys.has(key) && !dismissedKeys.has(key);
    })
    .map(a => {
      const s   = db.students.find(x=>x.id===a.studentId);
      const cls = db.classes.find(c=>c.id===a.classId);
      return {
        attendanceId: a.id,
        studentId:    a.studentId,
        studentName:  s?.name || '—',
        phone:        s?.parentPhone || '',
        className:    cls?.name || '—',
        classId:      a.classId,
        date:         a.date,
      };
    })
    .sort((a,b) => b.date.localeCompare(a.date));

  console.log('[waQueue] returning', queue.length, 'items');
  res.json(queue);
});

// POST send from queue (single or bulk)
app.post('/api/whatsapp/queue/send', async (req, res) => {
  const { items=[] } = req.body;   // [{studentId, studentName, phone, className, classId, date, attendanceId}]
  const db = readDB();
  const token = db.settings.whatsappApiKey;
  if (!token) return res.json({ ok:false, error:'Fonnte Token غير مُعيَّن في الإعدادات' });

  const results=[]; let sent=0, failed=0;
  for (const item of items) {
    if (!item.phone) { results.push({...item, ok:false, error:'لا يوجد رقم'}); failed++; continue; }
    const msg = buildMsg(db.settings, item.studentName, item.className, item.date);
    const r   = await fonnteRequest(token, item.phone, msg);
    results.push({...item, ok:r.ok, error:r.error||''});
    const db2 = readDB();
    db2.waLog = db2.waLog||[];
    db2.waLog.push({
      id:newId(), type:'absence', date:item.date,
      studentId:item.studentId, studentName:item.studentName,
      phone:item.phone, className:item.className, classId:item.classId,
      message:msg, status:r.ok?'sent':'failed',
      sentAt:new Date().toISOString(), error:r.error||''
    });
    writeDB(db2);
    if (r.ok) sent++; else failed++;
    await new Promise(ok=>setTimeout(ok,800));
  }
  res.json({ results, sent, failed });
});

// GET waLog history
app.get('/api/whatsapp/log', (req, res) => {
  const db = readDB();
  const log = (db.waLog||[]).sort((a,b)=>b.sentAt.localeCompare(a.sentAt));
  res.json(log);
});

// DELETE waLog entry
app.delete('/api/whatsapp/log/:id', (req, res) => {
  saveDB(db => { db.waLog = (db.waLog||[]).filter(l=>l.id!==req.params.id); });
  res.json({ok:true});
});

// DELETE all waLog
app.delete('/api/whatsapp/log', (req, res) => {
  saveDB(db => { db.waLog = []; });
  res.json({ok:true});
});

// GET groups
app.get('/api/whatsapp/groups', (req, res) => {
  const db = readDB();
  res.json(db.waGroups||[]);
});

// POST create group
app.post('/api/whatsapp/groups', (req, res) => {
  const {name, members=[]} = req.body;
  if (!name) return res.status(400).json({ok:false,error:'اسم المجموعة مطلوب'});
  const group = {id:newId(), name, members, createdAt:new Date().toISOString()};
  saveDB(db=>{ (db.waGroups=db.waGroups||[]).push(group); });
  res.json(group);
});

// PUT update group
app.put('/api/whatsapp/groups/:id', (req, res) => {
  const {name, members} = req.body;
  saveDB(db=>{
    const g = (db.waGroups||[]).find(x=>x.id===req.params.id);
    if (!g) return;
    if (name    !== undefined) g.name    = name;
    if (members !== undefined) g.members = members;
  });
  res.json({ok:true});
});

// DELETE group
app.delete('/api/whatsapp/groups/:id', (req, res) => {
  saveDB(db=>{ db.waGroups = (db.waGroups||[]).filter(g=>g.id!==req.params.id); });
  res.json({ok:true});
});

// POST dismiss a queue item — stored in waDismissed (separate from waLog, never wiped by log-clear)
app.post('/api/whatsapp/queue/dismiss', (req, res) => {
  const { studentId, date } = req.body;
  if (!studentId || !date) return res.json({ ok: false, error: 'بيانات ناقصة: studentId و date مطلوبان' });
  saveDB(db => {
    db.waDismissed = db.waDismissed || [];
    const already = db.waDismissed.find(d => d.studentId === studentId && d.date === date);
    if (!already) {
      db.waDismissed.push({ studentId, date, dismissedAt: new Date().toISOString() });
    }
  });
  res.json({ ok: true });
});

// POST send ONE message to a WhatsApp group chat by its group ID
app.post('/api/whatsapp/send-group-chat', async (req, res) => {
  const { groupId, message } = req.body;
  const db    = readDB();
  const token = db.settings.whatsappApiKey;
  if (!token)   return res.json({ ok:false, error:'Fonnte Token غير مُعيَّن في الإعدادات' });
  if (!groupId) return res.json({ ok:false, error:'معرّف المجموعة مطلوب' });
  if (!message) return res.json({ ok:false, error:'الرسالة فارغة' });

  const result = await fonnteRequest(token, groupId, message);

  saveDB(db2 => {
    db2.waLog = db2.waLog || [];
    db2.waLog.push({
      id: newId(), type: 'group-chat', date: new Date().toISOString().split('T')[0],
      studentName: `مجموعة: ${groupId}`, phone: groupId,
      message, status: result.ok ? 'sent' : 'failed',
      sentAt: new Date().toISOString(), error: result.error || '',
    });
  });

  res.json(result);
});
app.post('/api/whatsapp/send-custom', async (req, res) => {
  const { message='', targets=[], groupId='' } = req.body;
  const db    = readDB();
  const token = db.settings.whatsappApiKey;
  if (!token)   return res.json({ok:false, error:'Fonnte Token غير مُعيَّن في الإعدادات'});
  if (!message) return res.json({ok:false, error:'الرسالة فارغة'});

  let recipients = targets; // [{name, phone}]
  if (groupId) {
    const g = (db.waGroups||[]).find(x=>x.id===groupId);
    if (g) recipients = [...recipients, ...g.members];
  }
  if (!recipients.length) return res.json({ok:false, error:'لا يوجد مستلمون'});

  const results=[]; let sent=0, failed=0;
  for (const t of recipients) {
    if (!t.phone) { results.push({...t, ok:false, error:'لا يوجد رقم'}); failed++; continue; }
    const r = await fonnteRequest(token, t.phone, message);
    results.push({...t, ok:r.ok, error:r.error||''});
    const db2 = readDB();
    db2.waLog = db2.waLog||[];
    db2.waLog.push({
      id:newId(), type:'custom', date:new Date().toISOString().split('T')[0],
      studentName:t.name||t.phone, phone:t.phone,
      message, status:r.ok?'sent':'failed',
      sentAt:new Date().toISOString(), error:r.error||''
    });
    writeDB(db2);
    if (r.ok) sent++; else failed++;
    await new Promise(ok=>setTimeout(ok,800));
  }
  res.json({results, sent, failed});
});

// ════════════════════════════════════════════════════════
//  إرسال تقرير القرآن عبر واتساب PDF
// ════════════════════════════════════════════════════════

// Shared: build the quran report HTML (used by both print endpoint and PDF generator)
function _buildQuranReportHTML(db, studentId) {
  const s       = db.students.find(x => x.id === studentId);
  if (!s) throw new Error('الطالب غير موجود');
  const cls     = db.classes.find(c => c.id === s.classId);
  const school  = db.settings.schoolName || 'حضور الحلقات';
  const entries = (db.quranProgress || [])
    .filter(p => p.studentId === studentId)
    .sort((a,b) => b.date.localeCompare(a.date));

  const TYPE_AR  = { memorization:'حفظ جديد', revision:'مراجعة', recitation:'تلاوة وتجويد' };
  const TYPE_CLR = { memorization:'#1e40af',  revision:'#92400e', recitation:'#7e22ce' };
  const TYPE_BG  = { memorization:'#eff6ff',  revision:'#fffbeb', recitation:'#faf5ff' };
  const GRADE_STYLE = {
    'ممتاز':    'background:#dcfce7;color:#166534',
    'جيد جداً': 'background:#dbeafe;color:#1e40af',
    'جيد':      'background:#fef3c7;color:#92400e',
    'مقبول':    'background:#f3f4f6;color:#374151',
    'ضعيف':     'background:#fee2e2;color:#991b1b',
  };

  const cnt = { memorization:0, revision:0, recitation:0 };
  const allGraded = entries.filter(e => e.grade);
  const avgGrade  = allGraded.length
    ? (allGraded.reduce((s,e)=>s+Number(e.grade)||0,0)/allGraded.length).toFixed(1) : null;
  const repeatCnt = entries.filter(e => e.isRepeat==='1'||e.isRepeat===true).length;
  const latestMem = entries.find(e => e.type==='memorization');
  const latestPos = latestMem
    ? (latestMem.surahToName||latestMem.surahFromName||'—') + (latestMem.ayahTo?` آية ${latestMem.ayahTo}`:'')
    : '—';

  // Mobile-friendly cards instead of wide table rows
  const cards = entries.map((p, i) => {
    if (cnt[p.type] !== undefined) cnt[p.type]++;
    const from     = [p.surahFromName, p.ayahFrom?`آية ${p.ayahFrom}`:''].filter(Boolean).join(' ') || '—';
    const to       = [p.surahToName,   p.ayahTo  ?`آية ${p.ayahTo}`  :''].filter(Boolean).join(' ') || '—';
    const pages    = p.pageFrom ? (p.pageTo&&p.pageTo!==p.pageFrom?`${p.pageFrom}–${p.pageTo}`:`${p.pageFrom}`) : null;
    const typeBg   = TYPE_BG[p.type]  || '#f8fafc';
    const typeFg   = TYPE_CLR[p.type] || '#374151';
    const typeStr  = TYPE_AR[p.type]  || p.type || '—';
    const gradeStyle = p.grade ? (GRADE_STYLE[p.grade]||'background:#f1f5f9;color:#475569') : '';
    const isRepeat = p.isRepeat==='1'||p.isRepeat===true;
    return `<div class="card" style="border-right:4px solid ${typeFg}">
      <div class="card-top">
        <span class="tag" style="background:${typeBg};color:${typeFg}">${typeStr}${isRepeat?' 🔁':''}</span>
        <span class="date">${formatHijri(p.date)}</span>
      </div>
      <div class="card-range">📖 ${from} ← ${to}${pages?` &nbsp;|&nbsp; 📄 ص${pages}`:''}</div>
      ${p.juz?`<div class="card-juz">الجزء ${p.juz}</div>`:''}
      <div class="card-bottom">
        ${p.grade?`<span class="badge" style="${gradeStyle}">${p.grade}</span>`:''}
        ${p.notes?`<span class="note">${p.notes}</span>`:''}
      </div>
    </div>`;
  }).join('');

  const now = new Date().toLocaleDateString('ar-SA', { calendar:'islamic', year:'numeric', month:'long', day:'numeric' });

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>تقدم القرآن — ${s.name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,Tahoma,'Segoe UI',sans-serif}
body{background:#f1f5f9;color:#1e293b;padding:12px;max-width:480px;margin:auto}
.header{background:linear-gradient(135deg,#1e3a8a,#1d4ed8);color:#fff;border-radius:14px;padding:16px;margin-bottom:12px;text-align:center}
.header h1{font-size:15px;font-weight:800;margin-bottom:4px}
.header p{font-size:12px;color:#bfdbfe;margin-bottom:2px}
.header .date{font-size:11px;color:#93c5fd}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.stat{background:#fff;border-radius:10px;padding:10px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.07)}
.stat .n{font-size:24px;font-weight:800}
.stat .l{font-size:10px;font-weight:700;margin-top:2px}
.stat .s{font-size:10px;color:#64748b;margin-top:1px}
.infobar{background:#fff;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:12px;box-shadow:0 1px 3px rgba(0,0,0,.07)}
.infobar div{padding:3px 0;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between}
.infobar div:last-child{border:none}
.infobar strong{color:#1e3a8a}
.section-title{font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;padding-right:4px}
.card{background:#fff;border-radius:10px;padding:12px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,.07)}
.card-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}
.tag{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
.date{font-size:11px;color:#94a3b8}
.card-range{font-size:13px;color:#1e293b;font-weight:600;margin-bottom:4px;line-height:1.5}
.card-juz{font-size:11px;color:#64748b;margin-bottom:5px}
.card-bottom{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
.note{font-size:11px;color:#64748b;font-style:italic}
.footer{text-align:center;font-size:10px;color:#94a3b8;margin-top:14px;padding-top:10px;border-top:1px solid #e2e8f0}
@page{size:A4 portrait;margin:8mm}
@media print{body{background:#fff;padding:0;max-width:100%}}
</style></head><body>
<div class="header">
  <h1>${school}</h1>
  <p>تقرير تقدم القرآن الكريم</p>
  <p>👤 ${s.name}${cls?' &nbsp;|&nbsp; 🏫 '+cls.name:''}</p>
  <div class="date">${now}</div>
</div>
<div class="stats">
  <div class="stat" style="border-top:3px solid #0ea5e9">
    <div class="n" style="color:#0c4a6e">${entries.length}</div>
    <div class="l" style="color:#0369a1">إجمالي الجلسات</div>
    ${avgGrade?`<div class="s">متوسط ${avgGrade}/10</div>`:''}
  </div>
  <div class="stat" style="border-top:3px solid #22c55e">
    <div class="n" style="color:#14532d">${cnt.memorization}</div>
    <div class="l" style="color:#166534">حفظ جديد</div>
  </div>
  <div class="stat" style="border-top:3px solid #eab308">
    <div class="n" style="color:#713f12">${cnt.revision}</div>
    <div class="l" style="color:#854d0e">مراجعة</div>
  </div>
  <div class="stat" style="border-top:3px solid #a855f7">
    <div class="n" style="color:#4a1772">${cnt.recitation}</div>
    <div class="l" style="color:#7e22ce">تلاوة وتجويد</div>
  </div>
</div>
<div class="infobar">
  <div><span>آخر موقع حفظ</span><strong>${latestPos}</strong></div>
  <div><span>جلسات بتقييم</span><strong>${allGraded.length} / ${entries.length}</strong></div>
  ${repeatCnt?`<div><span>جلسات تكرار</span><strong style="color:#ea580c">${repeatCnt}</strong></div>`:''}
  <div><span>ولي الأمر</span><strong>${s.parentPhone||'—'}</strong></div>
</div>
<div class="section-title">سجل الجلسات</div>
${cards||'<div class="card" style="text-align:center;color:#94a3b8;padding:24px">لا توجد جلسات مسجلة بعد</div>'}
<div class="footer">${school} — تاريخ الإصدار: ${now}</div>
</body></html>`;
}

// Convert HTML to PDF using puppeteer-core + @sparticuz/chromium (Render-compatible)
async function _htmlToPDF(html) {
  const puppeteer  = require('puppeteer-core');
  const chromium   = require('@sparticuz/chromium');

  const browser = await puppeteer.launch({
    args:            chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath:  await chromium.executablePath(),
    headless:        chromium.headless,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', landscape: false, printBackground: true, margin: { top:'8mm', bottom:'8mm', left:'8mm', right:'8mm' } });
    return pdf;
  } finally {
    await browser.close();
  }
}


function _buildQuranReportPDF(db, studentId) {
  const s      = db.students.find(x => x.id === studentId);
  if (!s) throw new Error('الطالب غير موجود');
  const cls    = db.classes.find(c => c.id === s.classId);
  const school = db.settings.schoolName || 'حضور الحلقات';
  const rows   = (db.quranProgress || [])
    .filter(p => p.studentId === studentId)
    .sort((a, b) => b.date.localeCompare(a.date));

  const TYPE_AR   = { memorization:'حفظ جديد', revision:'مراجعة', recitation:'تلاوة وتجويد' };
  const TYPE_CLR  = { memorization:'#1d4ed8', revision:'#d97706', recitation:'#7c3aed' };
  const TYPE_BG   = { memorization:'#eff6ff', revision:'#fffbeb', recitation:'#faf5ff' };
  const GRADE_CLR = g => g>=8?'#166534':g>=5?'#854d0e':'#9b1c1c';
  const GRADE_BG  = g => g>=8?'#dcfce7':g>=5?'#fef9c3':'#fee2e2';

  // ── Per-type stats ───────────────────────────────────
  function typeStats(type) {
    const t = rows.filter(r => r.type === type);
    const graded = t.filter(r => r.grade && !isNaN(Number(r.grade)));
    const avg = graded.length ? (graded.reduce((s,r)=>s+Number(r.grade),0)/graded.length).toFixed(1) : null;
    return { count: t.length, avg };
  }
  const memSt  = typeStats('memorization');
  const revSt  = typeStats('revision');
  const recSt  = typeStats('recitation');
  const allGraded = rows.filter(r => r.grade && !isNaN(Number(r.grade)));
  const overallAvg = allGraded.length
    ? (allGraded.reduce((s,r)=>s+Number(r.grade),0)/allGraded.length).toFixed(1) : null;
  const repeatCount = rows.filter(r => r.isRepeat === '1' || r.isRepeat === true).length;

  // Latest position
  const latestMem = rows.find(r => r.type === 'memorization');
  const latestPos = latestMem
    ? (latestMem.surahToName || latestMem.surahFromName || '—') + (latestMem.ayahTo ? ` (آية ${latestMem.ayahTo})` : '')
    : '—';

  return new Promise((resolve, reject) => {
    const W   = 595.28; // A4 width in points
    const doc = new PDFDocument({ margin:0, size:'A4', info:{ Title: `تقرير القرآن — ${s.name}` } });
    const bufs = [];
    doc.on('data', d => bufs.push(d));
    doc.on('end',  () => resolve(Buffer.concat(bufs)));
    doc.on('error', reject);

    const M = 36; // page margin

    // ── HEADER ──────────────────────────────────────────
    doc.rect(0, 0, W, 72).fill('#1e3a8a');
    doc.rect(0, 72, W, 4).fill('#3b82f6');
    doc.fillColor('#ffffff').fontSize(17).font('Helvetica-Bold')
       .text(school, M, 14, { align:'center', width: W-M*2 });
    doc.fillColor('#bfdbfe').fontSize(10).font('Helvetica')
       .text(`تقرير تقدم القرآن الكريم  •  ${s.name}${cls ? '  •  ' + cls.name : ''}`, M, 42, { align:'center', width: W-M*2 });
    doc.fillColor('#93c5fd').fontSize(8)
       .text(`تاريخ الإصدار: ${new Date().toLocaleDateString('ar-SA')} — إجمالي الجلسات: ${rows.length}`, M, 58, { align:'center', width: W-M*2 });

    let y = 88;

    // ── SUMMARY CARDS (4 cards) ──────────────────────────
    const cards = [
      { label:'المجموع الكلي', val: String(rows.length),      sub: overallAvg ? `متوسط ${overallAvg}/10` : 'لا تقييمات', bg:'#f0f9ff', border:'#0ea5e9', text:'#0c4a6e' },
      { label:'حفظ جديد',      val: String(memSt.count),      sub: memSt.avg  ? `متوسط ${memSt.avg}/10`  : '—', bg:'#f0fdf4', border:'#22c55e', text:'#14532d' },
      { label:'مراجعة',         val: String(revSt.count),      sub: revSt.avg  ? `متوسط ${revSt.avg}/10`  : '—', bg:'#fefce8', border:'#eab308', text:'#713f12' },
      { label:'تلاوة وتجويد',  val: String(recSt.count),      sub: recSt.avg  ? `متوسط ${recSt.avg}/10`  : '—', bg:'#faf5ff', border:'#a855f7', text:'#4a1772' },
    ];
    const CW = (W - M*2 - 12) / 4;
    cards.forEach((c, i) => {
      const cx = M + i*(CW+4);
      doc.roundedRect(cx, y, CW, 52, 6).fill(c.bg);
      doc.roundedRect(cx, y, CW, 52, 6).stroke(c.border).lineWidth(1);
      doc.fillColor(c.text).fontSize(22).font('Helvetica-Bold')
         .text(c.val, cx, y+6, { width: CW, align:'center' });
      doc.fontSize(8).font('Helvetica-Bold')
         .text(c.label, cx, y+30, { width: CW, align:'center' });
      doc.fillColor(c.border).fontSize(7.5).font('Helvetica')
         .text(c.sub, cx, y+42, { width: CW, align:'center' });
    });
    y += 64;

    // ── INFO ROW (latest position + repeat count) ────────
    doc.roundedRect(M, y, W-M*2, 26, 4).fill('#f8fafc');
    doc.roundedRect(M, y, W-M*2, 26, 4).stroke('#e2e8f0').lineWidth(0.5);
    doc.fillColor('#374151').fontSize(8).font('Helvetica-Bold')
       .text(`آخر موقع حفظ: `, M+8, y+9, { continued:true })
       .font('Helvetica').fillColor('#1d4ed8').text(latestPos, { continued:true })
       .fillColor('#374151').text(`     •     جلسات تكرار: `, { continued:true })
       .fillColor('#dc2626').text(String(repeatCount), { continued:true })
       .fillColor('#374151').text(`     •     جلسات بتقييم: ${allGraded.length} / ${rows.length}`);
    y += 36;

    // ── SESSION TABLE ────────────────────────────────────
    if (!rows.length) {
      doc.roundedRect(M, y, W-M*2, 40, 6).fill('#f1f5f9');
      doc.fillColor('#94a3b8').fontSize(12).font('Helvetica')
         .text('لا توجد جلسات مسجلة بعد', M, y+13, { width: W-M*2, align:'center' });
    } else {
      // Table header
      const COL  = [56, 56, 100, 100, 34, 52, 40, 80]; // total = 518, close to W-M*2=523
      const XOFF = M + 2;
      const HDR  = ['التاريخ', 'النوع', 'من', 'إلى', 'الجزء', 'الصفحات', 'تقييم', 'ملاحظات'];
      const ROW_H = 18;

      doc.rect(XOFF-2, y, W-M*2+2, ROW_H).fill('#1e3a8a');
      let hx = XOFF;
      HDR.forEach((h, i) => {
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
           .text(h, hx, y+5, { width: COL[i], align:'center', lineBreak:false });
        hx += COL[i];
      });
      y += ROW_H;

      rows.forEach((p, ri) => {
        if (y > 780) {
          doc.addPage();
          // repeat header on new page
          y = 30;
          doc.rect(XOFF-2, y, W-M*2+2, ROW_H).fill('#1e3a8a');
          let _hx = XOFF;
          HDR.forEach((h, i) => {
            doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
               .text(h, _hx, y+5, { width:COL[i], align:'center', lineBreak:false });
            _hx += COL[i];
          });
          y += ROW_H;
        }

        const rowBg = ri % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(XOFF-2, y, W-M*2+2, ROW_H).fill(rowBg);

        const typeBg  = TYPE_BG[p.type]  || '#f8fafc';
        const typeFg  = TYPE_CLR[p.type] || '#374151';
        const typeStr = TYPE_AR[p.type]  || p.type || '—';
        const from    = p.surahFromName ? (p.surahFromName + (p.ayahFrom ? ':'+p.ayahFrom : '')) : '—';
        const to      = p.surahToName   ? (p.surahToName   + (p.ayahTo   ? ':'+p.ayahTo   : '')) : '—';
        const pages   = p.pageFrom
          ? (p.pageTo && p.pageTo !== p.pageFrom ? `${p.pageFrom}–${p.pageTo}` : `${p.pageFrom}`)
          : '—';
        const gradeN  = p.grade ? Number(p.grade) : null;

        let cx = XOFF;
        // Date
        doc.fillColor('#374151').fontSize(7.5).font('Helvetica')
           .text(p.date || '—', cx, y+5, { width:COL[0], align:'center', lineBreak:false });
        cx += COL[0];

        // Type badge
        doc.roundedRect(cx+2, y+3, COL[1]-4, 12, 3).fill(typeBg);
        doc.fillColor(typeFg).fontSize(7).font('Helvetica-Bold')
           .text(typeStr, cx, y+5, { width:COL[1], align:'center', lineBreak:false });
        cx += COL[1];

        // From / To
        doc.fillColor('#1e293b').fontSize(7).font('Helvetica')
           .text(from, cx+1, y+5, { width:COL[2]-2, align:'center', lineBreak:false });
        cx += COL[2];
        doc.text(to, cx+1, y+5, { width:COL[3]-2, align:'center', lineBreak:false });
        cx += COL[3];

        // Juz
        doc.fillColor('#475569').fontSize(7.5)
           .text(p.juz ? `جزء ${p.juz}` : '—', cx, y+5, { width:COL[4], align:'center', lineBreak:false });
        cx += COL[4];

        // Pages
        doc.fillColor('#475569')
           .text(pages, cx, y+5, { width:COL[5], align:'center', lineBreak:false });
        cx += COL[5];

        // Grade
        if (gradeN !== null) {
          doc.roundedRect(cx+4, y+3, COL[6]-8, 12, 3).fill(GRADE_BG(gradeN));
          doc.fillColor(GRADE_CLR(gradeN)).fontSize(7.5).font('Helvetica-Bold')
             .text(`${gradeN}/10`, cx, y+5, { width:COL[6], align:'center', lineBreak:false });
        } else {
          doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
             .text('—', cx, y+5, { width:COL[6], align:'center', lineBreak:false });
        }
        cx += COL[6];

        // Notes
        doc.fillColor('#64748b').fontSize(7).font('Helvetica')
           .text(p.notes || '—', cx+2, y+5, { width:COL[7]-4, align:'right', lineBreak:false });

        // Repeat badge
        if (p.isRepeat === '1' || p.isRepeat === true) {
          doc.circle(XOFF - 8, y + ROW_H/2, 3).fill('#f97316');
        }

        // Row separator
        doc.moveTo(XOFF-2, y+ROW_H).lineTo(XOFF-2+W-M*2+2, y+ROW_H)
           .strokeColor('#e2e8f0').lineWidth(0.3).stroke();
        y += ROW_H;
      });
    }

    // ── FOOTER ───────────────────────────────────────────
    y += 10;
    doc.moveTo(M, y).lineTo(W-M, y).strokeColor('#cbd5e1').lineWidth(0.7).stroke();
    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
       .text(`${school}  •  تم الإنشاء تلقائياً بتاريخ ${new Date().toLocaleDateString('ar-SA')}`, M, y+6, { width:W-M*2, align:'center' });
    doc.end();
  });
} // end _buildQuranReportPDF



app.post('/api/whatsapp/send-quran-pdf/:studentId', async (req, res) => {
  const db    = readDB();
  const token = db.settings.whatsappApiKey;
  if (!token) return res.json({ ok:false, error:'Fonnte Token غير مُعيَّن في الإعدادات' });

  const s = db.students.find(x => x.id === req.params.studentId);
  if (!s)            return res.status(404).json({ ok:false, error:'الطالب غير موجود' });
  if (!s.parentPhone) return res.json({ ok:false, error:'لا يوجد رقم هاتف لولي الأمر' });

  try {
    // 1. Generate PDF from HTML (proper Arabic rendering via Puppeteer)
    const html   = _buildQuranReportHTML(db, req.params.studentId);
    const pdfBuf = await _htmlToPDF(html);

    // 2. Upload to Supabase Storage
    const filename = `quran-${req.params.studentId}-${Date.now()}.pdf`;
    const { error: upErr } = await _supabase.storage
      .from(STORAGE_BUCKET).upload(filename, pdfBuf, { contentType:'application/pdf', upsert:true });
    if (upErr) throw new Error('فشل رفع الملف: ' + upErr.message);
    // Use permanent public URL — Fonnte cannot handle Supabase signed URLs (complex query params)
    const { data: urlData } = _supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filename);
    const fileUrl = urlData.publicUrl;

    // 3. Build caption and send via Fonnte
    const cls     = db.classes.find(c => c.id === s.classId);
    const entries = (db.quranProgress || []).filter(p => p.studentId === req.params.studentId);
    const mem  = entries.filter(e=>e.type==='memorization').length;
    const rev  = entries.filter(e=>e.type==='revision').length;
    const rec  = entries.filter(e=>e.type==='recitation').length;
    const caption = `السلام عليكم 👋\n\n`
      + `📖 *تقرير تقدم القرآن الكريم*\n`
      + `👤 الطالب: *${s.name}*\n`
      + (cls ? `🏫 الحلقة: ${cls.name}\n` : '')
      + `\n`
      + `📊 *ملخص الجلسات*\n`
      + `• الإجمالي: ${entries.length} جلسة\n`
      + `• حفظ جديد: ${mem}\n`
      + `• مراجعة: ${rev}\n`
      + (rec ? `• تلاوة وتجويد: ${rec}\n` : '')
      + `\n— ${db.settings.schoolName || 'إدارة الحلقات'}`;

    // Fonnte helper using application/x-www-form-urlencoded — avoids multipart parsing bugs
    // URLSearchParams handles all encoding (newlines → %0A, Arabic → %XX, etc.)
    const cleanPhone = String(s.parentPhone).replace(/\D/g, '');

    function fonntePost(fields) {
      return new Promise(resolve => {
        const body    = new URLSearchParams(fields).toString();
        const bodyBuf = Buffer.from(body, 'utf8');
        const opts = {
          hostname: 'api.fonnte.com', path: '/send', method: 'POST',
          headers: {
            'Authorization': token,
            'Content-Type':  'application/x-www-form-urlencoded',
            'Content-Length': bodyBuf.length
          }
        };
        const r = https.request(opts, resp => {
          let d = ''; resp.on('data', c => d += c);
          resp.on('end', () => {
            console.log('[send-quran-pdf] Fonnte raw:', d.slice(0, 300));
            try { const j = JSON.parse(d); resolve({ ok: !!j.status, error: j.reason || j.message || '' }); }
            catch(e) { resolve({ ok: false, error: 'bad response: ' + d.slice(0, 100) }); }
          });
        });
        r.on('error', e => resolve({ ok: false, error: e.message }));
        r.write(bodyBuf); r.end();
      });
    }

    // Send PDF as a clickable link in the message (free plan compatible)
    const messageWithLink = caption + `\n\n📄 *اضغط هنا لفتح التقرير كاملاً:*\n${fileUrl}`;
    const fileResult = await fonntePost({
      target:      cleanPhone,
      message:     messageWithLink,
      countryCode: '966',
      delay:       '2'
    });
    console.log('[send-quran-pdf] file result:', JSON.stringify(fileResult));

    const result = { ok: fileResult.ok, error: fileResult.error || '' };

    // 4. Log
    saveDB(db2 => {
      db2.waLog = db2.waLog || [];
      db2.waLog.push({ id:newId(), type:'quran-pdf', date:nowDate(),
        studentId:req.params.studentId, studentName:s.name, phone:s.parentPhone,
        className:cls?.name||'', classId:s.classId||'',
        message:caption, status:result.ok?'sent':'failed',
        sentAt:new Date().toISOString(), error:result.error||'' });
    }, 'waLog');

    res.json({ ok:result.ok, error:result.error||'' });
  } catch(e) {
    console.error('[send-quran-pdf]', e.message);
    res.status(500).json({ ok:false, error:e.message });
  }
});


// ════════════════════════════════════════════════════════
//  Fonnte — QR Code & Device Status
// ════════════════════════════════════════════════════════

function fonnteFormRequest(token, path, fields) {
  return new Promise(resolve => {
    const boundary = '----FonnteBoundary' + Math.random().toString(36).slice(2);
    const bodyParts = Object.entries(fields || {}).map(([k, v]) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}`
    );
    const body = bodyParts.join('\r\n') + '\r\n--' + boundary + '--';
    const opts = {
      hostname: 'api.fonnte.com',
      path,
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, resp => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => {
        try { resolve({ ok: true, data: JSON.parse(data) }); }
        catch(e) { resolve({ ok: false, error: 'استجابة غير متوقعة من Fonnte', raw: data.slice(0, 300) }); }
      });
    });
    req.on('error', e => resolve({ ok: false, error: e.message }));
    req.write(body);
    req.end();
  });
}

// GET /api/fonnte/qr — returns { status, url } where url is base64 PNG
app.get('/api/fonnte/qr', async (req, res) => {
  const db    = readDB();
  const token = db.settings.whatsappApiKey;
  if (!token) return res.json({ status: false, reason: 'Fonnte Token غير مُعيَّن — أضفه من الإعدادات' });
  const result = await fonnteFormRequest(token, '/qr', { type: 'qr' });
  if (!result.ok) return res.json({ status: false, reason: result.error, raw: result.raw });
  res.json(result.data);
});

// GET /api/fonnte/device — returns device connection info (cached 60s to avoid rate limits)
let _deviceCache = null;
let _deviceCacheTs = 0;
app.get('/api/fonnte/device', async (req, res) => {
  const db    = readDB();
  const token = db.settings.whatsappApiKey;
  if (!token) return res.json({ status: false, reason: 'Fonnte Token غير مُعيَّن — أضفه من الإعدادات' });
  const now = Date.now();
  if (_deviceCache && (now - _deviceCacheTs) < 60_000) {
    return res.json(_deviceCache); // serve cached result
  }
  const result = await fonnteFormRequest(token, '/device', {});
  if (!result.ok) return res.json({ status: false, reason: result.error, raw: result.raw });
  // Only cache a real (non-rate-limited) response
  if (result.data?.reason !== 'rate limit') {
    _deviceCache = result.data;
    _deviceCacheTs = now;
  }
  res.json(result.data);
});

// ════════════════════════════════════════════════════════
//  12. معلومات الشبكة (QR يُولَّد من جانب العميل)
// ════════════════════════════════════════════════════════
app.get('/api/network-info', (_, res) => {
  const ip = getLocalIP();
  res.json({ ip, port:PORT, url:`http://${ip}:${PORT}` });
});


// ════════════════════════════════════════════════════════
//  13. التقارير
// ════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  تقرير تقدم القرآن — طالب واحد
// ══════════════════════════════════════════════════════════
async function buildStudentQuranSheet(db, studentId) {
  const wb  = new ExcelJS.Workbook();
  const ws  = wb.addWorksheet('تقدم القرآن', {views:[{rightToLeft:true}]});
  const school = db.settings.schoolName || 'حضور الحلقات';
  const s    = db.students.find(x => x.id === studentId);
  if (!s) throw new Error('الطالب غير موجود');
  const cls  = db.classes.find(c => c.id === s.classId);
  const entries = (db.quranProgress || [])
    .filter(p => p.studentId === studentId)
    .sort((a,b) => b.date.localeCompare(a.date));

  const TYPE_AR  = { memorization:'حفظ جديد', revision:'مراجعة', recitation:'تلاوة وتجويد' };
  const GRADE_BG = { 'ممتاز':C.greenBg,'جيد جداً':C.blueBg,'جيد':C.amberBg,'مقبول':'EEEEEE','ضعيف':C.redBg };
  const GRADE_FG = { 'ممتاز':C.greenFg,'جيد جداً':C.blueFg,'جيد':C.amberFg,'مقبول':'444444','ضعيف':C.redFg };

  const cols = 8;
  ws.columns = [{width:16},{width:14},{width:18},{width:18},{width:8},{width:12},{width:12},{width:28}];

  const logoEnd = await addLogoImage(wb, ws, cols, db);
  const r1 = logoEnd + 1;
  titleRow(ws, r1, school, C.navy, {sz:14,bold:true,color:C.white}, cols, 36);

  const r2 = r1 + 1;
  titleRow(ws, r2, `تقرير تقدم القرآن الكريم — ${s.name}${cls ? ' — ' + cls.name : ''}`, C.slate, {sz:11,bold:true,color:C.white}, cols, 28);

  const r3 = r2 + 1;
  ws.getRow(r3).height = 26;
  ['التاريخ','نوع الجلسة','من (سورة/آية)','إلى (سورة/آية)','الجزء','الصفحات','التقييم','ملاحظات المعلم'].forEach((h,i) =>
    sc(ws.getCell(r3, i+1), h, C.headBg, {sz:10,bold:true,color:C.headFg}, 'center', true));

  let dr = r3 + 1;
  const cnt = { memorization:0, revision:0, recitation:0 };
  entries.forEach((p, idx) => {
    const even = idx % 2 === 0;
    ws.getRow(dr).height = 22;
    if (cnt[p.type] !== undefined) cnt[p.type]++;

    const fromPos = [p.surahFromName, p.ayahFrom ? `آية ${p.ayahFrom}` : ''].filter(Boolean).join(' ');
    const toPos   = [p.surahToName,   p.ayahTo   ? `آية ${p.ayahTo}`   : ''].filter(Boolean).join(' ');
    const pages   = p.pageFrom ? (p.pageTo && p.pageTo !== p.pageFrom ? `${p.pageFrom}–${p.pageTo}` : `${p.pageFrom}`) : '—';

    dataCell(ws.getCell(dr,1), formatHijri(p.date), even, 'center');
    dataCell(ws.getCell(dr,2), TYPE_AR[p.type] || p.type, even, 'center');
    dataCell(ws.getCell(dr,3), fromPos || '—', even, 'right');
    dataCell(ws.getCell(dr,4), toPos   || '—', even, 'right');
    dataCell(ws.getCell(dr,5), p.juz   ? String(p.juz) : '—', even, 'center');
    dataCell(ws.getCell(dr,6), pages, even, 'center');

    const gc  = ws.getCell(dr,7);
    const gbg = p.grade ? (GRADE_BG[p.grade]||C.rowA) : (even?C.rowA:C.rowB);
    const gfg = p.grade ? (GRADE_FG[p.grade]||'000000') : '666666';
    gc.value = p.grade || '—';
    gc.fill  = xFill(gbg); gc.font = xFont({sz:10, bold:!!p.grade, color:gfg});
    gc.alignment = xAlign('center','middle'); gc.border = xBorder();

    dataCell(ws.getCell(dr,8), p.notes || '—', even, 'right');
    dr++;
  });

  if (entries.length === 0) {
    ws.getRow(dr).height = 28;
    ws.mergeCells(dr,1,dr,cols);
    sc(ws.getCell(dr,1), 'لا توجد سجلات تقدم قرآني لهذا الطالب بعد.', C.emptyBg, {sz:11,color:'888888'}, 'center');
    dr++;
  }

  ws.getRow(dr).height = 6;
  for (let c=1;c<=cols;c++) ws.getCell(dr,c).fill = xFill(C.headBg);
  dr++;

  ws.getRow(dr).height = 26;
  ws.mergeCells(dr,1,dr,2);
  sc(ws.getCell(dr,1), 'الملخص:', C.totalBg, {sz:10,bold:true,color:C.headFg}, 'right');
  sc(ws.getCell(dr,3), `${entries.length} جلسة`, C.totalBg, {sz:10,bold:true,color:C.headFg}, 'center');
  sc(ws.getCell(dr,4), `حفظ: ${cnt.memorization}`, C.greenBg, {sz:10,bold:true,color:C.greenFg}, 'center');
  sc(ws.getCell(dr,5), `مراجعة: ${cnt.revision}`, C.blueBg, {sz:10,bold:true,color:C.blueFg}, 'center');
  sc(ws.getCell(dr,6), `تلاوة: ${cnt.recitation}`, C.amberBg, {sz:10,bold:true,color:C.amberFg}, 'center');
  sc(ws.getCell(dr,7), '', C.totalBg, {sz:10}, 'center');
  sc(ws.getCell(dr,8), '', C.totalBg, {sz:10}, 'center');

  return wb;
}

// ══════════════════════════════════════════════════════════
//  تقرير تقدم القرآن — حلقة كاملة
// ══════════════════════════════════════════════════════════
async function buildClassQuranSheet(db, classId) {
  const wb      = new ExcelJS.Workbook();
  const school  = db.settings.schoolName || 'حضور الحلقات';
  const cls     = db.classes.find(c => c.id === classId);
  if (!cls) throw new Error('الحلقة غير موجودة');
  const students = db.students.filter(s => s.classId === classId);
  const allProg  = db.quranProgress || [];

  const TYPE_AR  = { memorization:'حفظ جديد', revision:'مراجعة', recitation:'تلاوة وتجويد' };
  const GRADE_BG = { 'ممتاز':C.greenBg,'جيد جداً':C.blueBg,'جيد':C.amberBg,'مقبول':'EEEEEE','ضعيف':C.redBg };
  const GRADE_FG = { 'ممتاز':C.greenFg,'جيد جداً':C.blueFg,'جيد':C.amberFg,'مقبول':'444444','ضعيف':C.redFg };

  // helper: format a position label from a progress entry (from-side or to-side)
  function posFrom(p) {
    if (!p) return '—';
    return [p.surahFromName, p.ayahFrom ? `آية ${p.ayahFrom}` : ''].filter(Boolean).join(' ') || '—';
  }
  function posTo(p) {
    if (!p) return '—';
    const surah = p.surahToName || p.surahFromName;
    const ayah  = p.ayahTo   ? `آية ${p.ayahTo}`   :
                  p.ayahFrom ? `آية ${p.ayahFrom}`  : '';
    return [surah, ayah].filter(Boolean).join(' ') || '—';
  }
  function pageRange(p) {
    if (!p || !p.pageFrom) return '—';
    return p.pageTo && p.pageTo !== p.pageFrom ? `${p.pageFrom}–${p.pageTo}` : String(p.pageFrom);
  }

  // ─── الورقة 1: ملخص الحلقة ───────────────────────────
  const ws   = wb.addWorksheet('ملخص الحلقة', {views:[{rightToLeft:true}]});
  //  1:م  2:اسم  3:بداية الرحلة  4:آخر موقع  5:المسافة  6:جلسات  7:حفظ  8:مراجعة  9:تلاوة  10:آخر تقييم
  const cols = 10;
  ws.columns = [
    {width:5},{width:26},{width:22},{width:22},{width:18},
    {width:8},{width:8},{width:8},{width:8},{width:14}
  ];

  const logoEnd = await addLogoImage(wb, ws, cols, db);
  const r1 = logoEnd+1;
  titleRow(ws, r1, school, C.navy, {sz:14,bold:true,color:C.white}, cols, 36);
  const r2 = r1+1;
  titleRow(ws, r2, `تقرير تقدم القرآن الكريم — حلقة: ${cls.name}`, C.slate, {sz:11,bold:true,color:C.white}, cols, 28);

  const r3 = r2+1; ws.getRow(r3).height = 30;
  [
    'م','اسم الطالب',
    'بداية الرحلة\n(أول جلسة)',
    'آخر موقع\n(آخر جلسة)',
    'المسيرة',
    'الجلسات','حفظ','مراجعة','تلاوة',
    'آخر تقييم'
  ].forEach((h,i) =>
    sc(ws.getCell(r3,i+1), h, C.headBg, {sz:9,bold:true,color:C.headFg}, 'center', true));

  let dr = r3+1;
  students.forEach((s, si) => {
    // Sort oldest→newest for "first", newest first for "latest"
    const sEntries = allProg
      .filter(p => p.studentId === s.id)
      .sort((a,b) => a.date.localeCompare(b.date));   // oldest first
    const first    = sEntries[0]  || null;
    const latest   = sEntries[sEntries.length-1] || null;
    const memCount = sEntries.filter(e=>e.type==='memorization').length;
    const revCount = sEntries.filter(e=>e.type==='revision').length;
    const recCount = sEntries.filter(e=>e.type==='recitation').length;
    const even = si % 2 === 0;
    ws.getRow(dr).height = 26;

    // "بداية الرحلة" = first session's starting point
    const startPos = posFrom(first);

    // "آخر موقع" = latest session's ending point
    const endPos   = posTo(latest);

    // "المسيرة" = a readable range like "الفاتحة آية 1 ← البقرة آية 286"
    let journey = '—';
    if (first && latest) {
      if (startPos === endPos) {
        journey = startPos;
      } else {
        journey = `${startPos}  ←  ${endPos}`;
      }
    }

    const lastJuz  = latest?.juz ? String(latest.juz) : (first?.juz ? String(first.juz) : '—');

    dataCell(ws.getCell(dr,1), si+1, even, 'center');
    dataCell(ws.getCell(dr,2), s.name||'—', even, 'right');

    // بداية الرحلة — green tint if has data
    const sc3 = ws.getCell(dr,3);
    sc3.value     = startPos;
    sc3.fill      = xFill(first ? C.greenBg : (even?C.rowA:C.rowB));
    sc3.font      = xFont({sz:10, bold:!!first, color: first?C.greenFg:'888888'});
    sc3.alignment = xAlign('right','middle',true); sc3.border = xBorder();

    // آخر موقع — navy tint
    const sc4 = ws.getCell(dr,4);
    sc4.value     = endPos;
    sc4.fill      = xFill(latest ? C.blueBg : (even?C.rowA:C.rowB));
    sc4.font      = xFont({sz:10, bold:!!latest, color: latest?C.blueFg:'888888'});
    sc4.alignment = xAlign('right','middle',true); sc4.border = xBorder();

    // المسيرة — amber tint, shows the full arc
    const sc5 = ws.getCell(dr,5);
    sc5.value     = journey;
    sc5.fill      = xFill((first && latest && startPos!==endPos) ? C.amberBg : (even?C.rowA:C.rowB));
    sc5.font      = xFont({sz:9, bold:false, color:(first&&latest)?C.amberFg:'888888'});
    sc5.alignment = xAlign('right','middle',true); sc5.border = xBorder();

    dataCell(ws.getCell(dr,6), sEntries.length||'—', even, 'center', true);
    dataCell(ws.getCell(dr,7), memCount||'—', even, 'center', true, memCount?C.greenBg:null);
    dataCell(ws.getCell(dr,8), revCount||'—', even, 'center', true, revCount?C.blueBg:null);
    dataCell(ws.getCell(dr,9), recCount||'—', even, 'center', true, recCount?C.amberBg:null);

    const gc    = ws.getCell(dr,10);
    const grade = latest?.grade || '';
    gc.value    = grade || (latest ? '—' : 'لم يُسجَّل');
    gc.fill     = xFill(grade ? (GRADE_BG[grade]||C.rowA) : (even?C.rowA:C.rowB));
    gc.font     = xFont({sz:10, bold:!!grade, color: grade?(GRADE_FG[grade]||'000000'):'999999'});
    gc.alignment= xAlign('center','middle'); gc.border=xBorder();
    dr++;
  });

  if (students.length === 0) {
    ws.getRow(dr).height = 28; ws.mergeCells(dr,1,dr,cols);
    sc(ws.getCell(dr,1),'لا يوجد طلاب في هذه الحلقة.',C.emptyBg,{sz:11,color:'888888'},'center'); dr++;
  }

  // separator
  ws.getRow(dr).height = 6;
  for (let c=1;c<=cols;c++) ws.getCell(dr,c).fill = xFill(C.headBg); dr++;

  // totals
  ws.getRow(dr).height = 26;
  ws.mergeCells(dr,1,dr,2);
  const totalSessions = allProg.filter(p => students.some(s=>s.id===p.studentId)).length;
  sc(ws.getCell(dr,1), 'الإجمالي:', C.totalBg, {sz:10,bold:true,color:C.headFg}, 'right');
  sc(ws.getCell(dr,3), `${students.length} طالب`, C.totalBg, {sz:10,bold:true,color:C.headFg}, 'center');
  sc(ws.getCell(dr,4), `${totalSessions} جلسة مسجَّلة`, C.greenBg, {sz:10,bold:true,color:C.greenFg}, 'center');
  for (let c=5;c<=cols;c++) sc(ws.getCell(dr,c),'',C.totalBg,{sz:10},'center');

  // ─── ورقة تفصيلية لكل طالب (مرتبة من الأقدم للأحدث) ──
  students.forEach(s => {
    // oldest → newest so the journey reads top-to-bottom
    const sEntries = allProg
      .filter(p=>p.studentId===s.id)
      .sort((a,b)=>a.date.localeCompare(b.date));
    if (sEntries.length === 0) return;

    const sheetName = s.name.length > 25 ? s.name.slice(0,25) : s.name;
    const ws2 = wb.addWorksheet(sheetName, {views:[{rightToLeft:true}]});
    const c2  = 8;
    ws2.columns = [{width:16},{width:14},{width:20},{width:20},{width:8},{width:12},{width:12},{width:28}];

    titleRow(ws2,1,school,C.navy,{sz:13,bold:true,color:C.white},c2,30);
    titleRow(ws2,2,`${s.name} — ${cls.name}`,C.slate,{sz:10,bold:true,color:C.white},c2,24);

    // Journey summary bar
    ws2.getRow(3).height = 22;
    ws2.mergeCells(3,1,3,c2);
    const first2  = sEntries[0];
    const latest2 = sEntries[sEntries.length-1];
    const journeyTxt = `المسيرة: ${posFrom(first2)}  ←  ${posTo(latest2)}  (${sEntries.length} جلسة)`;
    sc(ws2.getCell(3,1), journeyTxt, C.amberBg, {sz:10,bold:true,color:C.amberFg}, 'center', false);

    ws2.getRow(4).height = 24;
    ['التاريخ','نوع الجلسة','من (سورة/آية)','إلى (سورة/آية)','الجزء','الصفحات','التقييم','ملاحظات'].forEach((h,i)=>
      sc(ws2.getCell(4,i+1),h,C.headBg,{sz:9,bold:true,color:C.headFg},'center',true));

    sEntries.forEach((p,idx)=>{
      const even=idx%2===0, dr2=5+idx;
      ws2.getRow(dr2).height=22;
      dataCell(ws2.getCell(dr2,1),formatHijri(p.date),even,'center');
      dataCell(ws2.getCell(dr2,2),TYPE_AR[p.type]||p.type,even,'center');

      // from — highlight first row green (starting point)
      const fromCell = ws2.getCell(dr2,3);
      fromCell.value     = posFrom(p);
      fromCell.fill      = xFill(idx===0 ? C.greenBg : (even?C.rowA:C.rowB));
      fromCell.font      = xFont({sz:10, bold:idx===0, color:idx===0?C.greenFg:'000000'});
      fromCell.alignment = xAlign('right','middle'); fromCell.border=xBorder();

      // to — highlight last row blue (end point)
      const isLast = idx===sEntries.length-1;
      const toCell   = ws2.getCell(dr2,4);
      toCell.value     = posTo(p);
      toCell.fill      = xFill(isLast ? C.blueBg : (even?C.rowA:C.rowB));
      toCell.font      = xFont({sz:10, bold:isLast, color:isLast?C.blueFg:'000000'});
      toCell.alignment = xAlign('right','middle'); toCell.border=xBorder();

      dataCell(ws2.getCell(dr2,5),p.juz?String(p.juz):'—',even,'center');
      dataCell(ws2.getCell(dr2,6),pageRange(p),even,'center');

      const gc2=ws2.getCell(dr2,7);
      gc2.value=p.grade||'—'; gc2.fill=xFill(p.grade?(GRADE_BG[p.grade]||C.rowA):(even?C.rowA:C.rowB));
      gc2.font=xFont({sz:9,bold:!!p.grade,color:p.grade?(GRADE_FG[p.grade]||'000000'):'666666'});
      gc2.alignment=xAlign('center','middle'); gc2.border=xBorder();

      dataCell(ws2.getCell(dr2,8),p.notes||'—',even,'right');
    });
  });

  return wb;
}


function arabicFilename(base) {
  return `attachment; filename="${encodeURIComponent(base)}.xlsx"; filename*=UTF-8''${encodeURIComponent(base)}.xlsx`;
}
// ── Endpoints التقارير ────────────────────────────────

// Excel — كشف حضور يومي
app.get('/api/reports/daily-attendance/:date', async (req, res) => {
  try {
    const {date}=req.params, {classId, calType}=req.query, db=readDB();
    const wb  = await buildDailySheet(db, date, classId||'', calType||'hijri');
    const cls = classId ? db.classes.find(c=>c.id===classId) : null;
    let name;
    if (calType === 'gregorian') {
      const dp = date.split('-');
      const label = `${+dp[2]}-${GM[+dp[1]]}-${dp[0]}`;
      name = cls ? `حضور-${cls.name}-${label}` : `حضور-يومي-${label}`;
    } else {
      const h = toHijri(date);
      name = cls ? `حضور-${cls.name}-${h.day}-${HM[h.month]}-${h.year}هـ` : `حضور-يومي-${h.day}-${HM[h.month]}-${h.year}هـ`;
    }
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', arabicFilename(name));
    await wb.xlsx.write(res);
  } catch(e) { console.error(e); res.status(500).json({error:e.message}); }
});

// PDF — كشف حضور يومي
app.get('/api/reports/pdf/daily/:date', (req, res) => {
  const { date } = req.params;
  const { classId, calType } = req.query;
  const db   = readDB();
  const att  = db.attendance.filter(a=>a.date===date && (!classId||a.classId===classId));
  const doc  = new PDFDocument({margin:40, size:'A4'});
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition',`attachment; filename="daily_${date}.pdf"`);
  doc.pipe(res);
  doc.fontSize(16).text(db.settings.schoolName||'حضور الحلقات',{align:'center'});
  const dateLabel = calType==='gregorian'
    ? (() => { const dp=date.split('-'); return `${+dp[2]} ${GM[+dp[1]]} ${dp[0]}`; })()
    : formatHijri(date);
  doc.fontSize(11).text(`كشف الحضور اليومي — يوم ${dayNameAr(date)} ${dateLabel}`,{align:'center'});
  doc.moveDown(0.5);
  if (!att.length) { doc.text('لا توجد سجلات لهذا اليوم.'); }
  att.forEach((a,i)=>{
    const s   = db.students.find(x=>x.id===a.studentId);
    const cls = db.classes.find(c=>c.id===a.classId);
    doc.fontSize(10).text(`${i+1}. ${s?.name||'—'}   |   ${cls?.name||'—'}   |   ${STATUS_AR[a.status]||a.status}   |   ${a.notes||''}`);
  });
  doc.end();
});

// Excel — سجل المعلمين اليومي
app.get('/api/reports/teacher-log/:date', async (req, res) => {
  try {
    const {date}=req.params, db=readDB();
    const wb  = await buildTeacherDailySheet(db, date);
    const h   = toHijri(date);
    const name = `سجل-المعلمين-${h.day}-${HM[h.month]}-${h.year}هـ`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', arabicFilename(name));
    await wb.xlsx.write(res);
  } catch(e) { console.error(e); res.status(500).json({error:e.message}); }
});

// Excel — كشف شهري للطلاب (هجري)
app.get('/api/reports/monthly/hijri/:year/:month', async (req, res) => {
  try {
    const {year,month}=req.params, {classId}=req.query, db=readDB();
    const wb  = await buildMonthlySheet(db, year, month, classId||'');
    const cls = classId ? db.classes.find(c=>c.id===classId) : null;
    const name = cls ? `حضور-شهري-${cls.name}-${HM[+month]}-${year}هـ` : `حضور-شهري-${HM[+month]}-${year}هـ`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', arabicFilename(name));
    await wb.xlsx.write(res);
  } catch(e) { console.error(e); res.status(500).json({error:e.message}); }
});

// Excel — ساعات المعلمين الشهرية
app.get('/api/reports/teacher-monthly/hijri/:year/:month', async (req, res) => {
  try {
    const {year,month}=req.params, db=readDB();
    const wb  = await buildTeacherMonthlySheet(db, year, month);
    const name = `ساعات-المعلمين-${HM[+month]}-${year}هـ`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', arabicFilename(name));
    await wb.xlsx.write(res);
  } catch(e) { console.error(e); res.status(500).json({error:e.message}); }
});

// Excel — Gregorian monthly report for students
app.get('/api/reports/monthly/gregorian/:year/:month', async (req, res) => {
  try {
    const {year, month} = req.params, {classId} = req.query, db = readDB();
    // reuse buildMonthlySheet but pass gregorian dates
    const wb  = await buildMonthlySheetGregorian(db, +year, +month, classId||'');
    const cls = classId ? db.classes.find(c=>c.id===classId) : null;
    const name = cls ? `حضور-شهري-${GM[+month]}-${year}م-${cls.name}` : `حضور-شهري-${GM[+month]}-${year}م`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', arabicFilename(name));
    await wb.xlsx.write(res);
  } catch(e) { console.error(e); res.status(500).json({error:e.message}); }
});

// Excel — Gregorian monthly teacher report
app.get('/api/reports/teacher-monthly/gregorian/:year/:month', async (req, res) => {
  try {
    const {year, month} = req.params, db = readDB();
    const wb  = await buildTeacherMonthlySheetGregorian(db, +year, +month);
    const name = `ساعات-المعلمين-${GM[+month]}-${year}م`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', arabicFilename(name));
    await wb.xlsx.write(res);
  } catch(e) { console.error(e); res.status(500).json({error:e.message}); }
});

// Print — Gregorian monthly attendance
app.get('/api/print/monthly-attendance/gregorian/:year/:month', (req, res) => {
  try {
    const {year, month} = req.params, {classId} = req.query, db = readDB();
    const school = db.settings.schoolName || 'حضور الحلقات';
    const gy = +year, gm = +month;
    const cls = classId ? db.classes.find(c=>c.id===classId) : null;
    const subtitle = `كشف الحضور الشهري — ${GM[gm]} ${gy}م${cls?' — '+cls.name:''}`;
    const dates = getAllGregorianMonthDates(gy, gm);
    const holSet = new Set((db.holidays||[]).map(h=>h.date));
    const schoolDays = dates.filter(d=>new Date(d+'T00:00:00').getDay()!==5 && !holSet.has(d));
    const students = db.students.filter(s=>!classId||s.classId===classId);
    const rows = students.map((s,i)=>{
      const sCls = db.classes.find(c=>c.id===s.classId);
      const hist = db.attendance.filter(a=>a.studentId===s.id&&inGregorianMonth(a.date,gy,gm));
      const present=hist.filter(h=>h.status==='Present').length;
      const absent=hist.filter(h=>h.status==='Absent').length;
      const late=hist.filter(h=>h.status==='Late').length;
      const excused=hist.filter(h=>h.status==='Excused').length;
      const rate=schoolDays.length?Math.round((present+excused)/schoolDays.length*100):0;
      const rc=rate>=90?'g':rate>=75?'a':'r';
      return `<tr><td style="text-align:center;color:#94a3b8">${i+1}</td><td style="font-weight:600">${s.name}</td>${!classId?`<td>${sCls?.name||'—'}</td>`:''}<td style="text-align:center"><span class="badge g">${present}</span></td><td style="text-align:center"><span class="badge r">${absent}</span></td><td style="text-align:center"><span class="badge a">${late}</span></td><td style="text-align:center"><span class="badge b">${excused}</span></td><td style="text-align:center"><span class="badge ${rc}">${rate}%</span></td></tr>`;
    }).join('');
    const totP=students.reduce((a,s)=>a+db.attendance.filter(x=>x.studentId===s.id&&inGregorianMonth(x.date,gy,gm)&&x.status==='Present').length,0);
    const totA=students.reduce((a,s)=>a+db.attendance.filter(x=>x.studentId===s.id&&inGregorianMonth(x.date,gy,gm)&&x.status==='Absent').length,0);
    const stats=`<div class="stat-row"><div class="stat b"><div class="n">${students.length}</div><div class="l">عدد الطلاب</div></div><div class="stat s"><div class="n">${schoolDays.length}</div><div class="l">أيام دراسية</div></div><div class="stat g"><div class="n">${totP}</div><div class="l">إجمالي الحضور</div></div><div class="stat r"><div class="n">${totA}</div><div class="l">إجمالي الغياب</div></div></div>`;
    const classTh=!classId?'<th>الحلقة</th>':'';
    const body=stats+(students.length?`<table><thead><tr><th style="width:32px">م</th><th>اسم الطالب</th>${classTh}<th style="width:55px">حاضر</th><th style="width:55px">غائب</th><th style="width:55px">متأخر</th><th style="width:55px">بعذر</th><th style="width:65px">نسبة</th></tr></thead><tbody>${rows}</tbody></table>`:'<p style="color:#64748b;font-size:13px">لا توجد بيانات.</p>');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(printPage(school, subtitle, body));
  } catch(e) { console.error(e); res.status(500).json({error:e.message}); }
});

// Print — Gregorian monthly teacher
app.get('/api/print/teacher-monthly/gregorian/:year/:month', (req, res) => {
  try {
    const {year, month} = req.params, db = readDB();
    const school = db.settings.schoolName || 'حضور الحلقات';
    const gy = +year, gm = +month;
    const subtitle = `ساعات حضور المعلمين — ${GM[gm]} ${gy}م`;
    const logs = db.teacherLog.filter(l=>inGregorianMonth(l.date,gy,gm));
    const grandMins=logs.filter(l=>l.checkIn).reduce((acc,l)=>acc+calcSessionMins(l.checkIn,l.checkOut),0);
    const totalDays=new Set(logs.map(l=>l.date)).size;
    const teacherBlocks=db.teachers.map(t=>{
      const tLogs=logs.filter(l=>l.teacherId===t.id&&l.checkIn).sort((a,b)=>a.date.localeCompare(b.date));
      const mins=tLogs.reduce((acc,l)=>acc+calcSessionMins(l.checkIn,l.checkOut),0);
      const days=new Set(tLogs.map(l=>l.date)).size;
      const avgMin=days?Math.round(mins/days):0;
      const tRows=tLogs.map(l=>{
        const dur=l.checkOut?minsToStr(calcSessionMins(l.checkIn,l.checkOut)):'جارٍ';
        const dp=l.date.split('-'); const dayLabel=`${+dp[2]}/${+dp[1]}`;
        return `<tr><td>${dayLabel}</td><td>${dayNameAr(l.date).slice(0,3)}</td><td>${l.checkIn}</td><td>${l.checkOut||'—'}</td><td>${dur}</td></tr>`;
      }).join('');
      return `<div class="tcard"><div class="tname">${t.name}</div><div class="tsub">${t.subject||''}</div><div class="tstats">أيام: <b>${days}</b> · ساعات: <b>${Math.floor(mins/60)}</b>h ${mins%60}m · متوسط: <b>${Math.floor(avgMin/60)}h${avgMin%60}m</b></div>${tRows?`<table class="ttable"><thead><tr><th>التاريخ</th><th>اليوم</th><th>دخول</th><th>خروج</th><th>المدة</th></tr></thead><tbody>${tRows}</tbody></table>`:'<p style="color:#94a3b8;font-size:11px">لا توجد سجلات</p>'}</div>`;
    }).join('');
    const stats=`<div class="stat-row"><div class="stat b"><div class="n">${db.teachers.length}</div><div class="l">معلمون</div></div><div class="stat s"><div class="n">${totalDays}</div><div class="l">أيام تسجيل</div></div><div class="stat g"><div class="n">${Math.floor(grandMins/60)}h ${grandMins%60}m</div><div class="l">الإجمالي</div></div></div>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(printPage(school, subtitle, stats+`<div class="t-grid">${teacherBlocks}</div>`));
  } catch(e) { console.error(e); res.status(500).json({error:e.message}); }
});

// PDF — Gregorian monthly teacher (same as print)
app.get('/api/reports/pdf/teacher-monthly/gregorian/:year/:month', (req, res) => {
  try {
    const {year, month} = req.params, db = readDB();
    const school = db.settings.schoolName || 'حضور الحلقات';
    const gy = +year, gm = +month;
    const subtitle = `ساعات حضور المعلمين — ${GM[gm]} ${gy}م`;
    const logs = db.teacherLog.filter(l=>inGregorianMonth(l.date,gy,gm));
    const grandMins=logs.filter(l=>l.checkIn).reduce((acc,l)=>acc+calcSessionMins(l.checkIn,l.checkOut),0);
    const teacherBlocks=db.teachers.map(t=>{
      const tLogs=logs.filter(l=>l.teacherId===t.id&&l.checkIn).sort((a,b)=>a.date.localeCompare(b.date));
      const mins=tLogs.reduce((acc,l)=>acc+calcSessionMins(l.checkIn,l.checkOut),0);
      const days=new Set(tLogs.map(l=>l.date)).size;
      const tRows=tLogs.map(l=>{ const dp=l.date.split('-'); return `<tr><td>${+dp[2]}/${+dp[1]}</td><td>${dayNameAr(l.date).slice(0,3)}</td><td>${l.checkIn}</td><td>${l.checkOut||'—'}</td><td>${l.checkOut?minsToStr(calcSessionMins(l.checkIn,l.checkOut)):'جارٍ'}</td></tr>`; }).join('');
      return `<div class="tcard"><div class="tname">${t.name}</div><div class="tsub">${t.subject||''}</div><div class="tstats">أيام: <b>${days}</b> · ساعات: <b>${Math.floor(mins/60)}</b>h ${mins%60}m</div>${tRows?`<table class="ttable"><thead><tr><th>التاريخ</th><th>اليوم</th><th>دخول</th><th>خروج</th><th>المدة</th></tr></thead><tbody>${tRows}</tbody></table>`:'<p>لا سجلات</p>'}</div>`;
    }).join('');
    const stats=`<div class="stat-row"><div class="stat b"><div class="n">${db.teachers.length}</div><div class="l">معلمون</div></div><div class="stat g"><div class="n">${Math.floor(grandMins/60)}h ${grandMins%60}m</div><div class="l">الإجمالي</div></div></div>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(printPage(school, subtitle, stats+`<div class="t-grid">${teacherBlocks}</div>`));
  } catch(e) { console.error(e); res.status(500).json({error:e.message}); }
});

// Excel — تقرير تقدم القرآن لطالب
// Excel — تقرير حضور + إذن خروج لطالب
app.get('/api/reports/attendance/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const db = readDB();
    const s  = db.students.find(x => x.id === studentId);
    if (!s) return res.status(404).json({ error: 'الطالب غير موجود' });
    const cls     = db.classes.find(c => c.id === s.classId);
    const history = db.attendance.filter(a => a.studentId === studentId).sort((a,b) => b.date.localeCompare(a.date));
    const leaves  = db.leaves.filter(l => l.studentId === studentId);
    const exitPerms = leaves.filter(l => l.type === 'Permission');
    const school  = db.settings.schoolName || 'حضور الحلقات';

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('سجل الطالب', { views: [{ rightToLeft: true }] });
    ws.columns = [{ width: 6 }, { width: 22 }, { width: 14 }, { width: 16 }, { width: 28 }];

    const logoEnd = await addLogoImage(wb, ws, 5, db);
    let r = logoEnd + 1;

    titleRow(ws, r,   school, C.navy,  { sz: 13, bold: true, color: C.white }, 5, 34); r++;
    titleRow(ws, r,   `سجل حضور: ${s.name}${cls ? ' — ' + cls.name : ''}`, C.slate, { sz: 11, bold: true, color: C.white }, 5, 28); r++;

    // Stats summary
    const total     = history.length;
    const present   = history.filter(h => h.status === 'Present').length;
    const absent    = history.filter(h => h.status === 'Absent').length;
    const late      = history.filter(h => h.status === 'Late').length;
    const excused   = history.filter(h => h.status === 'Excused').length;
    const exitCount = exitPerms.length;

    ws.getRow(r).height = 24;
    ws.mergeCells(r, 1, r, 5);
    const summaryText = `حاضر: ${present}  |  غائب: ${absent}  |  متأخر: ${late}  |  بعذر: ${excused}  |  إذن خروج: ${exitCount}  |  نسبة: ${total ? Math.round((present+excused)/total*100) : 0}%`;
    sc(ws.getCell(r, 1), summaryText, C.totalBg, { sz: 10, bold: true, color: C.headFg }, 'center'); r++;

    // Header row
    ws.getRow(r).height = 26;
    ['م', 'التاريخ الهجري', 'اليوم', 'الحالة', 'ملاحظات'].forEach((h, i) =>
      sc(ws.getCell(r, i + 1), h, C.headBg, { sz: 10, bold: true, color: C.headFg }, 'center', true));
    r++;

    history.forEach((a, idx) => {
      const even = r % 2 === 0;
      ws.getRow(r).height = 22;
      dataCell(ws.getCell(r, 1), idx + 1, even, 'center');
      dataCell(ws.getCell(r, 2), formatHijri(a.date), even, 'right');
      dataCell(ws.getCell(r, 3), dayNameAr(a.date), even, 'center');
      const sc2 = ws.getCell(r, 4);
      sc2.value = STATUS_AR[a.status] || a.status;
      sc2.fill  = xFill(STATUS_BG[a.status] || C.rowA);
      sc2.font  = xFont({ sz: 10, bold: true, color: STATUS_FG[a.status] || '000000' });
      sc2.alignment = xAlign('center'); sc2.border = xBorder();
      // Annotate if exit permission was given on same date
      const exitOnDay = exitPerms.find(l => l.date === a.date);
      const notesText = exitOnDay
        ? `📋 إذن خروج${exitOnDay.reason ? ': ' + exitOnDay.reason : ''}${a.notes ? ' | ' + a.notes : ''}`
        : (a.notes || '');
      dataCell(ws.getCell(r, 5), notesText, even, 'right');
      r++;
    });

    // Exit permits section
    if (exitPerms.length) {
      r++; ws.getRow(r).height = 6; r++;
      ws.mergeCells(r, 1, r, 5);
      titleRow(ws, r, `إذن خروج (${exitPerms.length})`, C.navy, { sz: 11, bold: true, color: C.white }, 5, 28); r++;
      ws.getRow(r).height = 26;
      ['م', 'التاريخ الهجري', 'اليوم', 'وقت الإذن', 'ملاحظات'].forEach((h, i) =>
        sc(ws.getCell(r, i + 1), h, C.headBg, { sz: 10, bold: true, color: C.headFg }, 'center', true));
      r++;
      exitPerms.forEach((l, idx) => {
        const even = r % 2 === 0;
        ws.getRow(r).height = 22;
        dataCell(ws.getCell(r, 1), idx + 1, even, 'center');
        dataCell(ws.getCell(r, 2), formatHijri(l.date), even, 'right');
        dataCell(ws.getCell(r, 3), dayNameAr(l.date), even, 'center');
        dataCell(ws.getCell(r, 4), l.time || '—', even, 'center');
        dataCell(ws.getCell(r, 5), l.reason || '—', even, 'right');
        r++;
      });
    }

    const name = `سجل-حضور-${s.name}`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', arabicFilename(name));
    await wb.xlsx.write(res);
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/quran/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const db  = readDB();
    const s   = db.students.find(x => x.id === studentId);
    if (!s) return res.status(404).json({ error: 'الطالب غير موجود' });
    const wb  = await buildStudentQuranSheet(db, studentId);
    const name = `تقدم-القرآن-${s.name}`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', arabicFilename(name));
    await wb.xlsx.write(res);
  } catch(e) { console.error(e); res.status(500).json({error:e.message}); }
});

// Excel — تقرير تقدم القرآن لحلقة كاملة
app.get('/api/reports/quran/class/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    const db  = readDB();
    const cls = db.classes.find(c => c.id === classId);
    if (!cls) return res.status(404).json({ error: 'الحلقة غير موجودة' });
    const wb  = await buildClassQuranSheet(db, classId);
    const name = `تقدم-القرآن-${cls.name}`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', arabicFilename(name));
    await wb.xlsx.write(res);
  } catch(e) { console.error(e); res.status(500).json({error:e.message}); }
});

// PDF — ملخص شهري للمعلمين (هجري)
app.get('/api/reports/pdf/teacher-monthly/hijri/:year/:month', (req, res) => {
  const { year, month } = req.params;
  const db   = readDB();
  const logs = db.teacherLog.filter(l=>inHijriMonth(l.date,+year,+month));
  const doc  = new PDFDocument({margin:40});
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition',`attachment; filename="teacher_monthly_${year}_${month}.pdf"`);
  doc.pipe(res);
  doc.fontSize(16).text(db.settings.schoolName||'حضور الحلقات',{align:'center'});
  doc.fontSize(11).text(`تقرير حضور المعلمين — ${HM[+month]||month} ${year}هـ`,{align:'center'});
  doc.moveDown();
  let grandTotal = 0;
  db.teachers.forEach(t => {
    const tLogs = logs.filter(l=>l.teacherId===t.id);
    const mins  = tLogs.reduce((acc,l) => {
      return acc+calcSessionMins(l.checkIn, l.checkOut);
    },0);
    grandTotal += mins;
    doc.fontSize(10).text(`${t.name} — حضر: ${tLogs.filter(l=>l.checkIn).length} يوم | ${minsToStr(mins)}`);
  });
  if (!db.teachers.length) doc.text('لا توجد بيانات للمعلمين.');
  doc.moveDown().fontSize(11).text(`الإجمالي الكلي: ${minsToStr(grandTotal)}`, {underline:true});
  doc.end();
});

// ════════════════════════════════════════════════════════
//  طباعة تقدم القرآن — HTML
// ════════════════════════════════════════════════════════

app.get('/api/print/quran/student/:studentId', (req, res) => {
  const db = readDB();
  try {
    const html = _buildQuranReportHTML(db, req.params.studentId);
    res.setHeader('Content-Type','text/html;charset=utf-8');
    res.send(html);
  } catch(e) {
    res.status(404).send(e.message);
  }
});

app.get('/api/print/quran/class/:classId', (req, res) => {
  const { classId } = req.params;
  const db     = readDB();
  const cls    = db.classes.find(c => c.id === classId);
  if (!cls) return res.status(404).send('الحلقة غير موجودة');
  const school   = db.settings.schoolName || 'حضور الحلقات';
  const students = db.students.filter(s => s.classId === classId);
  const allProg  = db.quranProgress || [];

  const TYPE_AR = { memorization:'حفظ جديد', revision:'مراجعة', recitation:'تلاوة وتجويد' };
  const GRADE_STYLE = {
    'ممتاز':  'background:#dcfce7;color:#166534',
    'جيد جداً':'background:#dbeafe;color:#1e40af',
    'جيد':    'background:#fef3c7;color:#92400e',
    'مقبول':  'background:#f3f4f6;color:#374151',
    'ضعيف':   'background:#fee2e2;color:#991b1b',
  };

  function posFrom(p) { return p ? ([p.surahFromName, p.ayahFrom?`آية ${p.ayahFrom}`:''].filter(Boolean).join(' ')||'—') : '—'; }
  function posTo(p)   { return p ? ([(p.surahToName||p.surahFromName), p.ayahTo?`آية ${p.ayahTo}`:p.ayahFrom?`آية ${p.ayahFrom}`:''].filter(Boolean).join(' ')||'—') : '—'; }

  const rows = students.map((s, i) => {
    const sEntries = allProg.filter(p=>p.studentId===s.id).sort((a,b)=>a.date.localeCompare(b.date));
    const first  = sEntries[0] || null;
    const latest = sEntries[sEntries.length-1] || null;
    const mem = sEntries.filter(e=>e.type==='memorization').length;
    const rev = sEntries.filter(e=>e.type==='revision').length;
    const rec = sEntries.filter(e=>e.type==='recitation').length;
    const grade = latest?.grade || '';
    const gradeStyle = grade ? (GRADE_STYLE[grade]||'') : 'color:#888';
    const bg = i%2===0?'#f8fafc':'#fff';
    const journey = (first&&latest&&posFrom(first)!==posTo(latest)) ? `${posFrom(first)} ← ${posTo(latest)}` : (first?posFrom(first):'—');
    return `<tr style="background:${bg}">
      <td style="text-align:center">${i+1}</td>
      <td>${s.name}</td>
      <td>${posFrom(first)}</td>
      <td>${posTo(latest)}</td>
      <td style="font-size:11px;color:#64748b">${journey}</td>
      <td style="text-align:center">${sEntries.length||'—'}</td>
      <td style="text-align:center;background:#f0fdf4;color:#166534;font-weight:700">${mem||'—'}</td>
      <td style="text-align:center;background:#eff6ff;color:#1e40af;font-weight:700">${rev||'—'}</td>
      <td style="text-align:center;background:#fffbeb;color:#92400e;font-weight:700">${rec||'—'}</td>
      <td style="text-align:center"><span class="badge" style="${gradeStyle}">${grade||'—'}</span></td>
    </tr>`;
  }).join('');

  const hijriNow = new Date().toLocaleDateString('ar-SA',{calendar:'islamic',year:'numeric',month:'long',day:'numeric'});
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<title>تقدم القرآن — ${cls.name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}
body{background:#fff;color:#111;padding:16px 20px;max-width:1100px;margin:auto}
.ph{border-bottom:3px solid #1D4ED8;padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end}
.ph-school{font-size:18px;font-weight:800;color:#1D4ED8}.ph-sub{font-size:13px;color:#374151;margin-top:3px}.ph-date{font-size:11px;color:#94a3b8;text-align:left}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#1D4ED8;color:#fff;padding:7px 8px;text-align:right;font-weight:700}
td{padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;vertical-align:middle}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700}
.footer{font-size:10px;color:#94a3b8;text-align:center;margin-top:14px;border-top:1px solid #e2e8f0;padding-top:8px}
@page{size:A4 landscape;margin:10mm}@media print{body{padding:0}.no-print{display:none}}
</style></head><body>
<div class="ph">
  <div><div class="ph-school">${school}</div>
  <div class="ph-sub">تقرير تقدم القرآن — حلقة: ${cls.name} (${students.length} طالب)</div></div>
  <div class="ph-date">${hijriNow}</div>
</div>
<button class="no-print" onclick="window.print()" style="margin-bottom:12px;padding:7px 18px;background:#1D4ED8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 طباعة</button>
<table>
  <thead><tr><th>م</th><th>اسم الطالب</th><th>بداية الرحلة</th><th>آخر موقع</th><th>المسيرة</th><th>الجلسات</th><th>حفظ</th><th>مراجعة</th><th>تلاوة</th><th>آخر تقييم</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="10" style="text-align:center;padding:20px;color:#888">لا توجد بيانات</td></tr>'}</tbody>
</table>
<div class="footer">تاريخ الطباعة: ${hijriNow} — ${school} — حلقة: ${cls.name}</div>
</body></html>`;
  res.setHeader('Content-Type','text/html;charset=utf-8');
  res.send(html);
});

// ════════════════════════════════════════════════════════
//  HTML Print Routes — /api/print/*
// ════════════════════════════════════════════════════════

const PRINT_CSS = `
*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}
body{background:#fff;color:#111;padding:16px 20px;max-width:960px;margin:auto}
.ph{border-bottom:3px solid #1D4ED8;padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end}
.ph-school{font-size:18px;font-weight:800;color:#1D4ED8}
.ph-sub{font-size:13px;color:#374151;margin-top:3px}
.ph-date{font-size:11px;color:#94a3b8;text-align:left}
.stat-row{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.stat{flex:1;min-width:80px;text-align:center;border-radius:8px;padding:8px 4px}
.stat .n{font-size:18px;font-weight:800}.stat .l{font-size:10px;color:#64748b;margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px}
th{background:#1D4ED8;color:#fff;padding:7px 8px;text-align:right;font-weight:700}
td{padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;vertical-align:middle}
tr:nth-child(even) td{background:#f8fafc}
.badge{display:inline-block;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap}
.g{background:#dcfce7;color:#166534}.r{background:#fee2e2;color:#991b1b}
.a{background:#fef3c7;color:#92400e}.b{background:#dbeafe;color:#1e40af}
.s{background:#f3f4f6;color:#374151}.p{background:#faf5ff;color:#6d28d9}
.section-hdr{font-size:13px;font-weight:700;color:#1D4ED8;margin:18px 0 7px;border-right:3px solid #1D4ED8;padding-right:8px;page-break-after:avoid}
.footer{font-size:10px;color:#94a3b8;text-align:center;margin-top:14px;border-top:1px solid #e2e8f0;padding-top:8px}
@page{size:A4 portrait;margin:12mm}
@media print{body{padding:0}}
`;

function printPage(school, subtitle, body) {
  const hijriNow = new Date().toLocaleDateString('ar-SA',{calendar:'islamic',year:'numeric',month:'long',day:'numeric'});
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head>
<meta charset="UTF-8"><title>${subtitle} — ${school}</title>
<style>${PRINT_CSS}</style></head><body>
<div class="ph">
  <div><div class="ph-school">${school}</div><div class="ph-sub">${subtitle}</div></div>
  <div class="ph-date">${hijriNow}</div>
</div>
${body}
<div class="footer">تاريخ الطباعة: ${hijriNow} — ${school}</div>
</body></html>`;
}

// ── كشف الحضور اليومي (طلاب) ──────────────────────────
app.get('/api/print/daily-attendance/:date', (req, res) => {
  const { date } = req.params;
  const { classId, calType } = req.query;
  const db     = readDB();
  const school = db.settings.schoolName || 'حضور الحلقات';
  const att    = db.attendance.filter(a => a.date === date && (!classId || a.classId === classId));
  const cls    = classId ? db.classes.find(c => c.id === classId) : null;
  const dateLabel = calType==='gregorian'
    ? (() => { const dp=date.split('-'); return `${+dp[2]} ${GM[+dp[1]]} ${dp[0]}`; })()
    : formatHijri(date);
  const subtitle = `كشف الحضور اليومي — ${dayNameAr(date)} ${dateLabel}${cls ? ' — ' + cls.name : ''}`;
  const CL = { Present:'g', Absent:'r', Late:'a', Excused:'b', Holiday:'s' };
  const AR = { Present:'حاضر', Absent:'غائب', Late:'متأخر', Excused:'بعذر', Holiday:'إجازة' };
  const present = att.filter(a=>a.status==='Present').length;
  const absent  = att.filter(a=>a.status==='Absent').length;
  const late    = att.filter(a=>a.status==='Late').length;
  const excused = att.filter(a=>a.status==='Excused').length;

  const rows = att.map((a, i) => {
    const s    = db.students.find(x => x.id === a.studentId);
    const sCls = db.classes.find(c => c.id === a.classId);
    const perm = (db.leaves||[]).find(l => l.studentId===a.studentId && l.date===date && l.type==='Permission');
    return `<tr>
      <td style="text-align:center;color:#94a3b8">${i+1}</td>
      <td style="font-weight:600">${s?.name||'—'}</td>
      <td>${sCls?.name||'—'}</td>
      <td style="text-align:center"><span class="badge ${CL[a.status]||'s'}">${AR[a.status]||a.status}</span></td>
      <td style="text-align:center">${perm?.time ? `<span class="badge s">🚪 ${perm.time}</span>` : '—'}</td>
      <td style="color:#64748b">${a.notes||''}</td>
    </tr>`;
  }).join('');

  const stats = `<div class="stat-row">
    <div class="stat g"><div class="n">${present}</div><div class="l">حاضر</div></div>
    <div class="stat r"><div class="n">${absent}</div><div class="l">غائب</div></div>
    <div class="stat a"><div class="n">${late}</div><div class="l">متأخر</div></div>
    <div class="stat b"><div class="n">${excused}</div><div class="l">بعذر</div></div>
    <div class="stat s"><div class="n">${att.length}</div><div class="l">الإجمالي</div></div>
  </div>`;

  const body = stats + (att.length
    ? `<table><thead><tr>
        <th style="width:32px">م</th><th>اسم الطالب</th><th>الحلقة</th>
        <th style="width:75px">الحالة</th><th style="width:95px">إذن الانصراف</th><th>ملاحظات</th>
      </tr></thead><tbody>${rows}</tbody></table>`
    : '<p style="color:#64748b;font-size:13px">لا توجد سجلات لهذا اليوم.</p>');

  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.send(printPage(school, subtitle, body));
});

// ── سجل حضور المعلمين اليومي ──────────────────────────
app.get('/api/print/teacher-log/:date', (req, res) => {
  const { date } = req.params;
  const db     = readDB();
  const school = db.settings.schoolName || 'حضور الحلقات';
  const logs   = db.teacherLog.filter(l => l.date === date);
  const subtitle = `سجل حضور المعلمين — ${dayNameAr(date)} ${formatHijri(date)}`;
  const totalMins = logs.reduce((acc,l)=>acc+(l.checkOut?calcSessionMins(l.checkIn,l.checkOut):0),0);

  const rows = db.teachers.map((t, i) => {
    const log  = logs.find(l => l.teacherId === t.id);
    const mins = log?.checkOut ? calcSessionMins(log.checkIn, log.checkOut) : 0;
    const dur  = mins ? minsToStr(mins) : (log?.checkIn ? 'جارٍ' : '—');
    const cls  = log?.checkOut ? 'g' : log?.checkIn ? 'a' : 'r';
    const lbl  = log?.checkOut ? 'اكتمل' : log?.checkIn ? 'حاضر' : 'غائب';
    return `<tr>
      <td style="text-align:center;color:#94a3b8">${i+1}</td>
      <td style="font-weight:600">${t.name}</td>
      <td>${t.subject||'—'}</td>
      <td style="text-align:center;font-weight:700;color:#1D4ED8">${log?.checkIn||'—'}</td>
      <td style="text-align:center;font-weight:700;color:#1D4ED8">${log?.checkOut||'—'}</td>
      <td style="text-align:center;font-weight:700">${dur}</td>
      <td style="text-align:center"><span class="badge ${cls}">${lbl}</span></td>
    </tr>`;
  }).join('');

  const stats = `<div class="stat-row">
    <div class="stat b"><div class="n">${db.teachers.length}</div><div class="l">إجمالي المعلمين</div></div>
    <div class="stat g"><div class="n">${logs.filter(l=>l.checkOut).length}</div><div class="l">انصرفوا</div></div>
    <div class="stat a"><div class="n">${logs.filter(l=>l.checkIn&&!l.checkOut).length}</div><div class="l">لا يزالون</div></div>
    <div class="stat r"><div class="n">${db.teachers.length-logs.filter(l=>l.checkIn).length}</div><div class="l">غائبون</div></div>
    <div class="stat p"><div class="n">${minsToStr(totalMins)||'—'}</div><div class="l">إجمالي الساعات</div></div>
  </div>`;

  const body = stats + `<table><thead><tr>
    <th style="width:32px">م</th><th>اسم المعلم</th><th>التخصص</th>
    <th style="width:80px">⏰ وقت الحضور</th><th style="width:80px">🚪 وقت الانصراف</th>
    <th style="width:70px">المدة</th><th style="width:75px">الحالة</th>
  </tr></thead><tbody>${rows}</tbody></table>`;

  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.send(printPage(school, subtitle, body));
});

// ── كشف الحضور الشهري (طلاب) ──────────────────────────
app.get('/api/print/monthly-attendance/:year/:month', (req, res) => {
  const { year, month } = req.params;
  const { classId } = req.query;
  const db     = readDB();
  const school = db.settings.schoolName || 'حضور الحلقات';
  const hy = +year, hm = +month;
  const cls = classId ? db.classes.find(c => c.id === classId) : null;
  const subtitle = `كشف الحضور الشهري — ${HM[hm]} ${hy}هـ${cls ? ' — ' + cls.name : ''}`;
  const dates    = getAllHijriMonthDates(hy, hm);
  const holSet   = new Set((db.holidays||[]).map(h => h.date));
  const schoolDays = dates.filter(d => new Date(d+'T00:00:00').getDay() !== 5 && !holSet.has(d));
  const students = db.students.filter(s => !classId || s.classId === classId);

  const rows = students.map((s, i) => {
    const sCls   = db.classes.find(c => c.id === s.classId);
    const hist   = db.attendance.filter(a => a.studentId===s.id && inHijriMonth(a.date,hy,hm));
    const present = hist.filter(h=>h.status==='Present').length;
    const absent  = hist.filter(h=>h.status==='Absent').length;
    const late    = hist.filter(h=>h.status==='Late').length;
    const excused = hist.filter(h=>h.status==='Excused').length;
    const rate    = schoolDays.length ? Math.round((present+excused)/schoolDays.length*100) : 0;
    const rc      = rate>=90?'g':rate>=75?'a':'r';
    return `<tr>
      <td style="text-align:center;color:#94a3b8">${i+1}</td>
      <td style="font-weight:600">${s.name}</td>
      ${!classId?`<td>${sCls?.name||'—'}</td>`:''}
      <td style="text-align:center"><span class="badge g">${present}</span></td>
      <td style="text-align:center"><span class="badge r">${absent}</span></td>
      <td style="text-align:center"><span class="badge a">${late}</span></td>
      <td style="text-align:center"><span class="badge b">${excused}</span></td>
      <td style="text-align:center"><span class="badge ${rc}">${rate}%</span></td>
    </tr>`;
  }).join('');

  const totP = students.reduce((a,s)=>a+db.attendance.filter(x=>x.studentId===s.id&&inHijriMonth(x.date,hy,hm)&&x.status==='Present').length,0);
  const totA = students.reduce((a,s)=>a+db.attendance.filter(x=>x.studentId===s.id&&inHijriMonth(x.date,hy,hm)&&x.status==='Absent').length,0);

  const stats = `<div class="stat-row">
    <div class="stat b"><div class="n">${students.length}</div><div class="l">عدد الطلاب</div></div>
    <div class="stat s"><div class="n">${schoolDays.length}</div><div class="l">أيام دراسية</div></div>
    <div class="stat g"><div class="n">${totP}</div><div class="l">إجمالي الحضور</div></div>
    <div class="stat r"><div class="n">${totA}</div><div class="l">إجمالي الغياب</div></div>
  </div>`;

  const classTh = !classId ? '<th>الحلقة</th>' : '';
  const body = stats + (students.length
    ? `<table><thead><tr>
        <th style="width:32px">م</th><th>اسم الطالب</th>${classTh}
        <th style="width:55px">حاضر</th><th style="width:55px">غائب</th>
        <th style="width:55px">متأخر</th><th style="width:55px">بعذر</th>
        <th style="width:65px">نسبة</th>
      </tr></thead><tbody>${rows}</tbody></table>`
    : '<p style="color:#64748b;font-size:13px">لا توجد بيانات.</p>');

  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.send(printPage(school, subtitle, body));
});

// ── ساعات المعلمين الشهرية ────────────────────────────
app.get('/api/print/teacher-monthly/:year/:month', (req, res) => {
  const { year, month } = req.params;
  const db     = readDB();
  const school = db.settings.schoolName || 'حضور الحلقات';
  const hy = +year, hm = +month;
  const subtitle = `ساعات حضور المعلمين — ${HM[hm]} ${hy}هـ`;
  const logs = db.teacherLog.filter(l => inHijriMonth(l.date, hy, hm));

  const grandMins = logs.filter(l=>l.checkIn).reduce((acc,l)=>acc+calcSessionMins(l.checkIn,l.checkOut),0);
  const totalDays = new Set(logs.map(l=>l.date)).size;

  // One compact block per teacher — displayed in a 2-column grid
  const teacherBlocks = db.teachers.map(t => {
    const tLogs  = logs.filter(l => l.teacherId===t.id && l.checkIn).sort((a,b)=>a.date.localeCompare(b.date));
    const mins   = tLogs.reduce((acc,l)=>acc+calcSessionMins(l.checkIn,l.checkOut),0);
    const days   = new Set(tLogs.map(l=>l.date)).size;
    const avgMin = days ? Math.round(mins/days) : 0;

    const rows = tLogs.map(l => {
      const dur = l.checkOut ? minsToStr(calcSessionMins(l.checkIn,l.checkOut)) : 'جارٍ';
      const hd  = toHijri(l.date);
      return `<tr>
        <td>${hd.day}/${hd.month}</td>
        <td>${dayNameAr(l.date).slice(0,3)}</td>
        <td>${l.checkIn}</td>
        <td>${l.checkOut||'—'}</td>
        <td style="font-weight:700">${dur}</td>
      </tr>`;
    }).join('');

    const noData = `<p style="font-size:10px;color:#94a3b8;padding:4px 0;text-align:center">لا توجد سجلات</p>`;

    return `<div class="tb">
      <div class="tb-head">
        <span class="tb-name">${t.name}${t.subject ? ' <span class="tb-sub">'+t.subject+'</span>' : ''}</span>
        <span class="tb-stats">${days} يوم · ${minsToStr(mins)||'—'} · متوسط ${minsToStr(avgMin)||'—'}</span>
      </div>
      ${tLogs.length ? `<table class="tb-table"><thead><tr>
        <th>التاريخ</th><th>اليوم</th><th>⏰</th><th>🚪</th><th>المدة</th>
      </tr></thead><tbody>${rows}</tbody></table>` : noData}
    </div>`;
  }).join('');

  const stats = `<div class="stat-row">
    <div class="stat b"><div class="n">${db.teachers.length}</div><div class="l">عدد المعلمين</div></div>
    <div class="stat s"><div class="n">${totalDays}</div><div class="l">أيام التسجيل</div></div>
    <div class="stat p"><div class="n">${minsToStr(grandMins)||'—'}</div><div class="l">إجمالي الساعات</div></div>
  </div>`;

  const extraCss = `
    .tb-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px}
    .tb{border:1px solid #d1d5db;border-radius:6px;padding:7px 8px;break-inside:avoid}
    .tb-head{display:flex;justify-content:space-between;align-items:baseline;
             border-bottom:1.5px solid #1D4ED8;padding-bottom:4px;margin-bottom:5px;flex-wrap:wrap;gap:4px}
    .tb-name{font-size:12px;font-weight:800;color:#1E3A5F}
    .tb-sub{font-size:10px;font-weight:400;color:#64748b}
    .tb-stats{font-size:10px;color:#6d28d9;font-weight:600;white-space:nowrap}
    .tb-table{width:100%;border-collapse:collapse;font-size:10.5px}
    .tb-table th{background:#3B5280;color:#fff;padding:3px 5px;text-align:center;font-weight:600}
    .tb-table td{padding:3px 5px;border-bottom:1px solid #f1f5f9;text-align:center}
    .tb-table tr:nth-child(even) td{background:#f8fafc}
  `;

  const hijriNow = new Date().toLocaleDateString('ar-SA',{calendar:'islamic',year:'numeric',month:'long',day:'numeric'});
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head>
<meta charset="UTF-8"><title>${subtitle} — ${school}</title>
<style>${PRINT_CSS}${extraCss}</style></head><body>
<div class="ph">
  <div><div class="ph-school">${school}</div><div class="ph-sub">${subtitle}</div></div>
  <div class="ph-date">${hijriNow}</div>
</div>
${stats}
<div class="tb-grid">${teacherBlocks}</div>
<div class="footer">تاريخ الطباعة: ${hijriNow} — ${school}</div>
</body></html>`;

  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.send(html);
});

// ── قائمة الطلاب ──────────────────────────────────────
app.get('/api/print/students-list', (req, res) => {
  const { classId } = req.query;
  const db     = readDB();
  const school = db.settings.schoolName || 'حضور الحلقات';
  const cls    = classId ? db.classes.find(c => c.id === classId) : null;
  const subtitle = `قائمة الطلاب${cls ? ' — ' + cls.name : ' — جميع الحلقات'}`;

  const students = db.students.filter(s => !classId || s.classId === classId)
    .sort((a,b) => {
      const ca = db.classes.find(c=>c.id===a.classId)?.name||'';
      const cb = db.classes.find(c=>c.id===b.classId)?.name||'';
      return ca.localeCompare(cb,'ar') || a.name.localeCompare(b.name,'ar');
    });

  const allClasses = classId ? (cls?[cls]:[])
    : [...new Set(students.map(s=>s.classId))].map(id=>db.classes.find(c=>c.id===id)).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,'ar'));

  const makeRows = (list, showClass) => list.map((s, i) => {
    const sCls   = db.classes.find(c => c.id === s.classId);
    const hist   = db.attendance.filter(a => a.studentId === s.id);
    const present = hist.filter(h=>h.status==='Present').length;
    const absent  = hist.filter(h=>h.status==='Absent').length;
    const late    = hist.filter(h=>h.status==='Late').length;
    const excused = hist.filter(h=>h.status==='Excused').length;
    const rate    = hist.length ? Math.round((present+excused)/hist.length*100) : null;
    const rc      = rate===null?'s':rate>=90?'g':rate>=75?'a':'r';
    return `<tr>
      <td style="text-align:center;color:#94a3b8">${i+1}</td>
      <td style="font-weight:600">${s.name}</td>
      ${showClass?`<td>${sCls?.name||'—'}</td>`:''}
      <td>${s.studentId||'—'}</td>
      <td>${s.parentPhone||'—'}</td>
      <td style="text-align:center"><span class="badge g">${present}</span></td>
      <td style="text-align:center"><span class="badge r">${absent}</span></td>
      <td style="text-align:center"><span class="badge a">${late}</span></td>
      <td style="text-align:center"><span class="badge b">${excused}</span></td>
      <td style="text-align:center"><span class="badge ${rc}">${rate!==null?rate+'%':'—'}</span></td>
    </tr>`;
  }).join('');

  const makeTable = (list, showClass) => {
    const classTh = showClass ? '<th>الحلقة</th>' : '';
    return `<table><thead><tr>
      <th style="width:32px">م</th><th>اسم الطالب</th>${classTh}
      <th style="width:75px">رقم الطالب</th><th style="width:110px">ولي الأمر</th>
      <th style="width:50px">حاضر</th><th style="width:50px">غائب</th>
      <th style="width:50px">متأخر</th><th style="width:50px">بعذر</th>
      <th style="width:60px">نسبة</th>
    </tr></thead><tbody>${makeRows(list, showClass)}</tbody></table>`;
  };

  let body = `<div class="stat-row">
    <div class="stat b"><div class="n">${students.length}</div><div class="l">إجمالي الطلاب</div></div>
    <div class="stat s"><div class="n">${allClasses.length||1}</div><div class="l">الحلقات</div></div>
  </div>`;

  if (!classId && allClasses.length) {
    allClasses.forEach(c => {
      const cs = students.filter(s => s.classId === c.id);
      if (!cs.length) return;
      body += `<div class="section-hdr">🏫 ${c.name} — ${cs.length} طالب</div>` + makeTable(cs, false);
    });
    const noClass = students.filter(s => !s.classId);
    if (noClass.length) body += `<div class="section-hdr">بدون حلقة</div>` + makeTable(noClass, false);
  } else {
    body += makeTable(students, false);
  }

  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.send(printPage(school, subtitle, body));
});

// ── قائمة المعلمين ────────────────────────────────────
app.get('/api/print/teachers-list', (req, res) => {
  const db     = readDB();
  const school = db.settings.schoolName || 'حضور الحلقات';
  const today  = new Date().toISOString().split('T')[0];
  const todayH = toHijri(today);
  const subtitle = 'قائمة المعلمين';

  const rows = db.teachers.map((t, i) => {
    const allLogs   = db.teacherLog.filter(l => l.teacherId===t.id && l.checkIn);
    const monthLogs = allLogs.filter(l => inHijriMonth(l.date, todayH.year, todayH.month));
    const totalMins = allLogs.reduce((acc,l)=>acc+calcSessionMins(l.checkIn,l.checkOut),0);
    const monthMins = monthLogs.reduce((acc,l)=>acc+calcSessionMins(l.checkIn,l.checkOut),0);
    const days      = new Set(allLogs.map(l=>l.date)).size;
    const todayLog  = db.teacherLog.find(l => l.teacherId===t.id && l.date===today && l.checkIn);
    const sc        = todayLog ? (todayLog.checkOut?'g':'a') : 'r';
    const st        = todayLog ? (todayLog.checkOut?`اكتمل ${todayLog.checkOut}`:`حاضر ${todayLog.checkIn}`) : 'غائب';
    return `<tr>
      <td style="text-align:center;color:#94a3b8">${i+1}</td>
      <td style="font-weight:600">${t.name}</td>
      <td>${t.subject||'—'}</td>
      <td>${t.phone||'—'}</td>
      <td style="text-align:center"><span class="badge b">${days}</span></td>
      <td style="text-align:center;font-weight:700">${minsToStr(monthMins)||'—'}</td>
      <td style="text-align:center">${minsToStr(totalMins)||'—'}</td>
      <td style="text-align:center"><span class="badge ${sc}">${st}</span></td>
    </tr>`;
  }).join('');

  const grandMins = db.teachers.reduce((acc,t)=>acc+db.teacherLog.filter(l=>l.teacherId===t.id&&l.checkIn).reduce((a,l)=>a+calcSessionMins(l.checkIn,l.checkOut),0),0);
  const stats = `<div class="stat-row">
    <div class="stat b"><div class="n">${db.teachers.length}</div><div class="l">إجمالي المعلمين</div></div>
    <div class="stat g"><div class="n">${db.teacherLog.filter(l=>l.date===today&&l.checkIn&&!l.checkOut).length}</div><div class="l">حاضرون الآن</div></div>
    <div class="stat p"><div class="n">${minsToStr(grandMins)||'—'}</div><div class="l">إجمالي الساعات الكلي</div></div>
  </div>`;

  const body = stats + (db.teachers.length
    ? `<table><thead><tr>
        <th style="width:32px">م</th><th>اسم المعلم</th><th>التخصص</th>
        <th style="width:100px">الهاتف</th><th style="width:70px">أيام الحضور</th>
        <th style="width:85px">هذا الشهر</th><th style="width:85px">الإجمالي</th>
        <th style="width:115px">حالة اليوم</th>
      </tr></thead><tbody>${rows}</tbody></table>`
    : '<p style="color:#64748b;font-size:13px">لا يوجد معلمون.</p>');

  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.send(printPage(school, subtitle, body));
});

// ── Teacher log API endpoint with hours (للعرض في التطبيق)
app.get('/api/teacher-log/today-summary', (_, res) => {
  const db   = readDB();
  const date = new Date().toISOString().split('T')[0];
  const logs = db.teacherLog.filter(l=>l.date===date);
  const summary = logs.map(l => {
    const t = db.teachers.find(x=>x.id===l.teacherId);
    const mins = l.checkOut ? calcSessionMins(l.checkIn, l.checkOut) : null;
    return { name:t?.name||'—', checkIn:l.checkIn, checkOut:l.checkOut, duration:minsToStr(mins||0), mins };
  });
  const totalMins = summary.reduce((a,s)=>a+(s.mins||0),0);
  res.json({ logs:summary, totalDuration:minsToStr(totalMins), count:summary.length });
});

// ════════════════════════════════════════════════════════
//  14. مزامنة / نسخ احتياطي
// ════════════════════════════════════════════════════════
app.get('/api/sync/export', (_, res) => {
  const db = readDB();
  const filename = `backup_${nowDate()}_${nowTime().replace(':','-')}.json`;
  res.setHeader('Content-Type','application/json');
  res.setHeader('Content-Disposition',`attachment; filename="${filename}"`);
  res.json({...db, exportedAt: new Date().toISOString(), version:3});
});

// دمج بيانات من bundle في قاعدة البيانات
function _mergeBundle(bundle) {
  const db = readDB();
  let merged = 0;
  function mergeArr(arr1, arr2, key) {
    const map = {}; arr1.forEach(x => map[x[key]] = true);
    arr2.forEach(x => { if (x[key] && !map[x[key]]) { arr1.push(x); merged++; } });
  }
  mergeArr(db.students,      bundle.students||[],      'id');
  mergeArr(db.classes,       bundle.classes||[],       'id');
  mergeArr(db.teachers,      bundle.teachers||[],      'id');
  mergeArr(db.teacherLog,    bundle.teacherLog||[],    'id');
  mergeArr(db.attendance,    bundle.attendance||[],    'id');
  mergeArr(db.leaves,        bundle.leaves||[],        'id');
  mergeArr(db.holidays,      bundle.holidays||[],      'date');
  mergeArr(db.quranProgress, bundle.quranProgress||[], 'id');
  if (Array.isArray(bundle.notices))           mergeArr(db.notices||[],           bundle.notices,           'id');
  if (Array.isArray(bundle.calendarEvents))    mergeArr(db.calendarEvents||[],    bundle.calendarEvents,    'id');
  if (Array.isArray(bundle.admissionRequests)) mergeArr(db.admissionRequests||[], bundle.admissionRequests, 'id');
  if (Array.isArray(bundle.accounts))          mergeArr(db.accounts,              bundle.accounts,          'id');
  // Merge settings (keep existing, only fill missing keys)
  if (bundle.settings && typeof bundle.settings === 'object') {
    Object.keys(bundle.settings).forEach(k => {
      if (db.settings[k] === undefined || db.settings[k] === null || db.settings[k] === '') {
        db.settings[k] = bundle.settings[k];
      }
    });
  }
  writeDB(db);
  return merged;
}

// استيراد عبر JSON body (الطريقة القديمة)
app.post('/api/sync/import', (req, res) => {
  try {
    const merged = _mergeBundle(req.body);
    res.json({ ok: true, merged });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// استيراد ملف backup.json عبر رفع ملف
app.post('/api/sync/import-file', upload.single('file'), (req, res) => {
  if (!req.file) return res.json({ ok: false, error: 'لم يتم استلام الملف' });
  try {
    let content;
    // support both disk (path) and memory (buffer) multer modes
    if (req.file.buffer) {
      content = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    } else {
      const fs2 = require('fs');
      content = fs2.readFileSync(req.file.path, 'utf8').replace(/^\uFEFF/, '');
      try { fs2.unlinkSync(req.file.path); } catch(_) {}
    }
    const bundle = JSON.parse(content);
    if (typeof bundle !== 'object' || Array.isArray(bundle)) {
      return res.json({ ok: false, error: 'ملف غير صالح — يجب أن يكون ملف JSON للنسخة الاحتياطية' });
    }
    const merged = _mergeBundle(bundle);
    res.json({ ok: true, merged });
  } catch(e) {
    res.json({ ok: false, error: 'خطأ في قراءة الملف: ' + e.message });
  }
});

// استعادة كاملة — يستبدل قاعدة البيانات بالكامل (لا دمج)
app.post('/api/backup/restore', upload.single('file'), (req, res) => {
  if (!req.file) return res.json({ ok: false, error: 'لم يتم استلام الملف' });
  try {
    let content;
    if (req.file.buffer) {
      content = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    } else {
      content = fs.readFileSync(req.file.path, 'utf8').replace(/^\uFEFF/, '');
      try { fs.unlinkSync(req.file.path); } catch(_) {}
    }
    const bundle = JSON.parse(content);
    if (typeof bundle !== 'object' || Array.isArray(bundle)) {
      return res.json({ ok: false, error: 'ملف غير صالح' });
    }
    // Remove metadata fields before restoring
    const { exportedAt, version, ...data } = bundle;
    // Merge with defaults to ensure all keys exist
    const restored = { ...JSON.parse(JSON.stringify(DEFAULT_DB)), ...data };
    writeDB(restored);
    res.json({ ok: true });
  } catch(e) {
    res.json({ ok: false, error: 'خطأ في قراءة الملف: ' + e.message });
  }
});

// استيراد ملف CSV من Supabase (عمودان: key, value)
app.post('/api/backup/restore-csv', upload.single('file'), (req, res) => {
  if (!req.file) return res.json({ ok: false, error: 'لم يتم استلام الملف' });
  try {
    let content;
    if (req.file.buffer) {
      content = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    } else {
      content = fs.readFileSync(req.file.path, 'utf8').replace(/^\uFEFF/, '');
      try { fs.unlinkSync(req.file.path); } catch(_) {}
    }
    // Parse CSV — handles quoted fields that may contain commas
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return res.json({ ok: false, error: 'الملف فارغ' });

    // Detect header row and find key/value column indices
    function parseCsvLine(line) {
      const cols = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQ && line[i+1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (ch === ',' && !inQ) {
          cols.push(cur); cur = '';
        } else {
          cur += ch;
        }
      }
      cols.push(cur);
      return cols;
    }

    const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
    const keyIdx = header.indexOf('key');
    const valIdx = header.indexOf('value');
    if (keyIdx === -1 || valIdx === -1) {
      return res.json({ ok: false, error: 'لم يتم العثور على عمودَي key و value في الملف' });
    }

    const bundle = {};
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const key  = (cols[keyIdx] || '').trim();
      const val  = (cols[valIdx] || '').trim();
      if (!key) continue;
      try { bundle[key] = JSON.parse(val); } catch(_) { bundle[key] = val; }
    }

    if (!Object.keys(bundle).length) {
      return res.json({ ok: false, error: 'لم يتم قراءة أي بيانات من الملف' });
    }

    const restored = { ...JSON.parse(JSON.stringify(DEFAULT_DB)), ...bundle };
    writeDB(restored);
    res.json({ ok: true, keys: Object.keys(bundle).length });
  } catch(e) {
    res.json({ ok: false, error: 'خطأ في قراءة الملف: ' + e.message });
  }
});

// ════════════════════════════════════════════════════════
//  إرسال نسخة احتياطية إلى Telegram
// ════════════════════════════════════════════════════════
app.post('/api/backup/telegram', async (req, res) => {
  const db = readDB();
  const botToken = db.settings.telegramBotToken;
  const chatId   = db.settings.telegramChatId;

  if (!botToken || !chatId) {
    return res.json({ ok: false, error: 'أدخل Telegram Bot Token و Chat ID في الإعدادات أولاً' });
  }

  try {
    const backupData = JSON.stringify({ ...db, exportedAt: new Date().toISOString(), version: 3 });
    const date       = new Date().toISOString().split('T')[0];
    const filename   = `backup_${date}.json`;

    // Build multipart/form-data manually to send file to Telegram
    const boundary = '----TelegramBoundary' + Math.random().toString(36).slice(2);
    const fileHeader =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="document"; filename="${filename}"\r\n` +
      `Content-Type: application/json\r\n\r\n`;
    const chatPart =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`;
    const captionPart =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="caption"\r\n\r\n📦 نسخة احتياطية — ${date}\r\n`;
    const body = Buffer.concat([
      Buffer.from(chatPart),
      Buffer.from(captionPart),
      Buffer.from(fileHeader),
      Buffer.from(backupData, 'utf8'),
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    await new Promise((resolve, reject) => {
      const opts = {
        hostname: 'api.telegram.org',
        path: `/bot${botToken}/sendDocument`,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      };
      const request = https.request(opts, (response) => {
        let data = '';
        response.on('data', c => data += c);
        response.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.ok) resolve(parsed);
            else reject(new Error(parsed.description || 'Telegram API error'));
          } catch (e) {
            reject(new Error('استجابة غير متوقعة من Telegram'));
          }
        });
      });
      request.on('error', reject);
      request.write(body);
      request.end();
    });

    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// Selective data reset — handles ALL keys the frontend can send
app.post('/api/settings/reset', (req, res) => {
  const {
    attendance, teacherLog, calendar, waLog, quran, everything,
    holidays, students, teachers, classes, notices, waGroups, waDismissed, accounts
  } = req.body;
  const cleared = [];

  saveDB(db => {
    if (everything) {
      const savedSettings = { ...db.settings };
      const savedAccounts = [...(db.accounts || [])];
      Object.assign(db, JSON.parse(JSON.stringify(DEFAULT_DB)));
      db.settings = savedSettings;
      db.accounts = savedAccounts; // always preserve accounts on full reset
      cleared.push('everything');
      return;
    }
    if (attendance) {
      db.attendance  = [];
      db.leaves      = [];
      db.waDismissed = [];
      db.waLog       = (db.waLog || []).filter(l => l.type !== 'absence' && l.type !== 'bulk');
      cleared.push('attendance');
    }
    if (teacherLog) {
      db.teacherLog = [];
      cleared.push('teacherLog');
    }
    if (calendar) {
      db.calendarEvents = [];
      db.holidays = (db.holidays || []).filter(h => !h.id || !h.id.includes('_h_'));
      cleared.push('calendar');
    }
    if (holidays) {
      db.holidays = [];
      cleared.push('holidays');
    }
    if (waLog) {
      db.waLog = [];
      cleared.push('waLog');
    }
    if (quran) {
      db.quranProgress = [];
      cleared.push('quran');
    }
    if (students) {
      db.students = [];
      db.attendance = [];
      db.leaves = [];
      db.quranProgress = [];
      cleared.push('students');
    }
    if (teachers) {
      db.teachers   = [];
      db.teacherLog = [];
      cleared.push('teachers');
    }
    if (classes) {
      db.classes = [];
      cleared.push('classes');
    }
    if (notices) {
      db.notices = [];
      cleared.push('notices');
    }
    if (waGroups) {
      db.waGroups = [];
      cleared.push('waGroups');
    }
    if (waDismissed) {
      db.waDismissed = [];
      cleared.push('waDismissed');
    }
    if (accounts) {
      // Reset to only keep the default admin — never leave zero accounts
      db.accounts = JSON.parse(JSON.stringify(DEFAULT_DB.accounts));
      cleared.push('accounts');
    }
  });

  res.json({ ok: true, cleared });
});


// ════════════════════════════════════════════════════════
//  15. ملفات المُشغِّل
// ════════════════════════════════════════════════════════
app.get('/api/launcher-status', (_, res) => {
  res.json({
    vbsExists: fs.existsSync(path.join(ROOT_DIR,'launch.vbs')),
    jsExists:  fs.existsSync(path.join(ROOT_DIR,'launcher.js')),
    exeBuilt:  fs.existsSync(path.join(ROOT_DIR,'حضور-الحلقات.exe')) || fs.existsSync(path.join(ROOT_DIR,'attendance.exe')),
    networkIP: getLocalIP(),
    port: PORT
  });
});

app.get('/api/download/launcher-vbs', (_, res) => {
  const ip  = getLocalIP();
  const vbs = `Set sh = CreateObject("WScript.Shell")\nDim p\np = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)\nsh.Run "cmd /c cd /d """ & p & """ && node server.js", 0, False\nWScript.Sleep 2500\nsh.Run "http://${ip}:${PORT}"`;
  res.setHeader('Content-Type','text/plain'); res.setHeader('Content-Disposition','attachment; filename="launch.vbs"'); res.send(vbs);
});

app.get('/api/download/launcher-js', (_, res) => {
  const js = `// launcher.js\nconst {spawn}=require('child_process'),{exec}=require('child_process');\nconst s=spawn('node',['server.js'],{cwd:__dirname,detached:true,stdio:'ignore'});\ns.unref();\nsetTimeout(()=>exec('start http://localhost:${PORT}'),2500);`;
  res.setHeader('Content-Type','text/plain'); res.setHeader('Content-Disposition','attachment; filename="launcher.js"'); res.send(js);
});

app.get('/api/download/build-bat', (_, res) => {
  const bat = `@echo off\nnpm install -g pkg\npkg server.js --target node18-win-x64 --output "حضور-الحلقات.exe"\necho تم! الملف جاهز.\npause`;
  res.setHeader('Content-Type','text/plain'); res.setHeader('Content-Disposition','attachment; filename="build-exe.bat"'); res.send(bat);
});


// ════════════════════════════════════════════════════════
//  معالج أخطاء Multer
// ════════════════════════════════════════════════════════
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ ok:false, error:'حجم الملف كبير جداً (الحد الأقصى 10 ميجابايت)' });
  if (err) return res.status(500).json({ ok:false, error: err.message || 'خطأ في الخادم' });
  next();
});

// ════════════════════════════════════════════════════════
//  Fallback: index.html
// ════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════
//  التقويم — Calendar Events
// ════════════════════════════════════════════════════════

// ── Calendar Excel Export ─────────────────────────────────────────────
app.get('/api/calendar/export', async (req, res) => {
  const year = +req.query.year || toHijri(new Date().toISOString().split('T')[0]).year;
  const db   = readDB();
  const evs  = (db.calendarEvents || []).filter(e => {
    const h = toHijri(e.date);
    return h.year === year;
  });
  const holSet = new Set((db.holidays||[]).map(h=>h.date));
  const TYPE_COLOR = { event:'2563EB', holiday:'DC2626', offday:'D97706', message:'7C3AED', reminder:'0D9488' };
  const TYPE_AR    = { event:'حدث', holiday:'إجازة رسمية', offday:'يوم إجازة', message:'رسالة مجدولة', reminder:'تذكير' };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'حضور الحلقات'; wb.created = new Date();

  for (let hm = 1; hm <= 12; hm++) {
    // Build dates for this Hijri month
    const dates = [];
    for (let hd = 1; hd <= 30; hd++) {
      const iso = fromHijri(year, hm, hd);
      const back = toHijri(iso);
      if (back.year !== year || back.month !== hm) break;
      dates.push(iso);
    }
    if (!dates.length) continue;

    const ws = wb.addWorksheet(HM[hm], { views:[{rightToLeft:true}], pageSetup:{orientation:'landscape'} });

    // Title
    ws.mergeCells('A1:I1');
    const t = ws.getCell('A1');
    t.value = `${HM[hm]} ${year}هـ`;
    t.font = xFont({sz:14,bold:true,color:'FFFFFF'}); t.fill = xFill('1D4ED8');
    t.alignment = xAlign('center','middle'); ws.getRow(1).height = 30;

    // Stats row
    ws.mergeCells('A2:I2');
    const schoolDays = dates.filter(d=>new Date(d+'T00:00:00').getDay()!==5&&!holSet.has(d)).length;
    const offDays    = dates.length - schoolDays;
    const monthEvs   = evs.filter(e => { const h=toHijri(e.date); return h.month===hm; });
    const s = ws.getCell('A2');
    s.value = `أيام الشهر: ${dates.length}  |  أيام دراسية: ${schoolDays}  |  أيام إجازة: ${offDays}  |  أحداث: ${monthEvs.length}`;
    s.font = xFont({sz:10,bold:false,color:'374151'}); s.fill = xFill('F3F4F6');
    s.alignment = xAlign('center','middle'); ws.getRow(2).height = 20;

    // Day-of-week header row
    const DOW_AR = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    const COL_W  = [18,9,9,9,9,9,9,9,9];
    COL_W.forEach((w,i) => ws.getColumn(i+1).width = w);
    ws.getRow(3).height = 22;
    const HEADERS = ['اليوم / الحدث','أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];
    HEADERS.forEach((h,i) => {
      const c = ws.getCell(3, i+1);
      c.value = h; c.fill = xFill('1D4ED8'); c.font = xFont({sz:9,bold:true,color:'FFFFFF'});
      c.alignment = xAlign('center','middle'); c.border = xBorder();
    });

    // Build week rows
    const firstDow = new Date(dates[0]+'T00:00:00').getDay(); // 0=Sun
    const weeks = [];
    let week = new Array(7).fill(null);
    dates.forEach(iso => {
      const dow = new Date(iso+'T00:00:00').getDay();
      week[dow] = iso;
      if (dow === 6 || iso === dates[dates.length-1]) { weeks.push(week); week = new Array(7).fill(null); }
    });

    let dr = 4;
    weeks.forEach(wk => {
      ws.getRow(dr).height = 28;
      // Row label: Hijri day range
      const filled = wk.filter(Boolean);
      const label  = filled.length
        ? toHijri(filled[0]).day + (filled.length>1 ? '–'+toHijri(filled[filled.length-1]).day : '')
        : '';
      const lc = ws.getCell(dr,1);
      lc.value=label; lc.fill=xFill('F9FAFB'); lc.font=xFont({sz:9,bold:true});
      lc.alignment=xAlign('center','middle'); lc.border=xBorder();

      wk.forEach((iso,col) => {
        const cell = ws.getCell(dr, col+2);
        if (!iso) { cell.fill=xFill('F4F4F4'); cell.border=xBorder(); return; }
        const d     = new Date(iso+'T00:00:00');
        const isFri = d.getDay()===5, isHol=holSet.has(iso);
        const dayEvs= evs.filter(e => e.date===iso || (e.endDate&&iso>=e.date&&iso<=e.endDate));
        const gDay  = d.getDate()+'/'+String(d.getMonth()+1).padStart(2,'0');
        const hDay  = toHijri(iso).day;

        if (isFri||isHol) {
          cell.fill = xFill(isFri?'FFFBEB':'FEF2F2');
          cell.font = xFont({sz:8,color:isFri?'92400E':'991B1B'});
        } else if (dayEvs.length) {
          const ev1 = dayEvs[0];
          cell.fill = xFill( (TYPE_COLOR[ev1.type]||'2563EB').replace('#','')+'22' );
          cell.font = xFont({sz:8,color:TYPE_COLOR[ev1.type]||'2563EB'});
        } else {
          cell.fill = xFill('FFFFFF'); cell.font = xFont({sz:8});
        }
        const label = [hDay+'  ('+gDay+')']
          .concat(isFri?['جمعة']:isHol?['إجازة']:[], dayEvs.slice(0,2).map(e=>e.title))
          .join('\n');
        cell.value = label;
        cell.alignment = xAlign('center','middle',true);
        cell.border = xBorder();
      });
      dr++;
    });

    // Events table for this month
    if (monthEvs.length) {
      dr++;
      ws.mergeCells(dr,1,dr,9);
      const eh = ws.getCell(dr,1);
      eh.value='الأحداث والملاحظات'; eh.fill=xFill('1E3A5F');
      eh.font=xFont({sz:10,bold:true,color:'FFFFFF'}); eh.alignment=xAlign('center','middle');
      ws.getRow(dr).height=20; dr++;

      const EH=['التاريخ الهجري','التاريخ الميلادي','النوع','العنوان','الوقت','ملاحظات'];
      EH.forEach((h,i)=>{
        const c=ws.getCell(dr,i+1); c.value=h;
        c.fill=xFill('3B82F6'); c.font=xFont({sz:9,bold:true,color:'FFFFFF'});
        c.alignment=xAlign('center','middle'); c.border=xBorder();
      });
      ws.getRow(dr).height=18; dr++;
      const EW=[14,14,14,24,10,30];
      EW.forEach((w,i)=>{ if(i<6) ws.getColumn(i+1).width=Math.max(ws.getColumn(i+1).width||0,w); });

      monthEvs.sort((a,b)=>a.date.localeCompare(b.date)).forEach((ev,ei)=>{
        const even=ei%2===0;
        const hd=toHijri(ev.date), gd=new Date(ev.date+'T00:00:00');
        const gStr=gd.getDate()+'/'+(gd.getMonth()+1)+'/'+gd.getFullYear();
        const color=TYPE_COLOR[ev.type]||'2563EB';
        [
          `${hd.day} ${HM[hd.month]} ${hd.year}هـ`,
          gStr,
          TYPE_AR[ev.type]||ev.type,
          ev.title,
          ev.time||'—',
          ev.note||''
        ].forEach((v,ci)=>{
          const c=ws.getCell(dr,ci+1); c.value=v;
          c.fill=xFill(even?'EFF6FF':'DBEAFE');
          c.font=xFont({sz:9,color:ci===2?color:'000000',bold:ci===3});
          c.alignment=xAlign(ci===3||ci===5?'right':'center','middle',ci===5);
          c.border=xBorder();
        });
        ws.getRow(dr).height=20; dr++;
      });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const filename = encodeURIComponent(`تقويم-${year}هـ.xlsx`);
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${filename}`);
  res.send(buf);
});

app.get('/api/calendar', (req, res) => {
  const { month, year, calType } = req.query; // year/month filter; calType: hijri|gregorian
  const db = readDB();
  let events = db.calendarEvents || [];
  if (year && month) {
    if (calType === 'gregorian') {
      events = events.filter(e => {
        const parts = e.date.split('-');
        return +parts[0] == +year && +parts[1] == +month;
      });
    } else {
      events = events.filter(e => {
        const h = toHijri(e.date);
        return h.year == +year && h.month == +month;
      });
    }
  }
  // Also inject holidays and auto-Fridays for the requested month as read-only events
  const enriched = [...events];
  res.json(enriched);
});

app.post('/api/calendar', async (req, res) => {
  const body   = req.body;
  const createdAt = new Date().toISOString();
  const ids = [];
  const newEvents = []; // collect message-type events to schedule on Fonnte

  saveDB(db => {
    if (!db.calendarEvents) db.calendarEvents = [];

    // Helper: sync holidays for an event
    const syncHol = ev => {
      if (ev.type !== 'holiday' && ev.type !== 'offday') return;
      const hType = ev.type === 'holiday' ? 'Holiday' : 'OffDay';
      const start = new Date(ev.date), end = ev.endDate ? new Date(ev.endDate) : new Date(ev.date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
        const iso = d.toISOString().split('T')[0];
        db.holidays = db.holidays.filter(h => h.date !== iso);
        db.holidays.push({ id: ev.id+'_h_'+iso, date: iso, type: hType, reason: ev.title });
      }
    };

    // Specific dates: create one event per hand-picked date
    if (body.type === 'message' && Array.isArray(body.specificDates) && body.specificDates.length > 0) {
      const groupId = newId();
      body.specificDates.forEach(iso => {
        const id  = newId();
        const ev  = { ...body, id, date: iso, endDate: iso, dailyRepeat: false, specificDates: null, groupId, createdAt, fonnteScheduled: [] };
        db.calendarEvents.push(ev);
        ids.push(id);
        if (ev.waTargets?.length && ev.waMessage) newEvents.push(ev);
      });
    // Daily message expansion: if message + endDate + dailyRepeat=true, create one event per day
    } else if (body.type === 'message' && body.endDate && body.endDate !== body.date && body.dailyRepeat) {
      const groupId = newId(); // shared group id so they can all be deleted together
      const start = new Date(body.date), end = new Date(body.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
        const iso = d.toISOString().split('T')[0];
        const id  = newId();
        const ev  = { ...body, id, date: iso, endDate: iso, dailyRepeat: false, groupId, createdAt, fonnteScheduled: [] };
        db.calendarEvents.push(ev);
        ids.push(id);
        if (ev.waTargets?.length && ev.waMessage) newEvents.push(ev);
      }
    } else {
      const id = newId();
      const ev = { id, ...body, createdAt, fonnteScheduled: [] };
      db.calendarEvents.push(ev);
      syncHol(ev);
      ids.push(id);
      if (ev.type === 'message' && ev.waTargets?.length && ev.waMessage) newEvents.push(ev);
    }
  });

  // Schedule each message event on Fonnte immediately (server-independent delivery)
  const scheduleResults = []; // [{eventId, ok, count, errors}]
  if (newEvents.length) {
    const db = readDB();
    const token      = db.settings?.whatsappApiKey;
    const schoolName = db.settings?.schoolName || '';

    if (token) {
      for (const ev of newEvents) {
        try {
          const scheduled = await scheduleEventOnFonnte(token, ev, schoolName);
          const ok = scheduled.length > 0;
          scheduleResults.push({ eventId: ev.id, date: ev.date, ok, count: scheduled.length });
          if (scheduled.length) {
            saveDB(db2 => {
              const stored = db2.calendarEvents.find(e => e.id === ev.id);
              if (stored) stored.fonnteScheduled = scheduled;
            });
          }
        } catch(e) {
          console.error('[fonnte-schedule] error for event', ev.id, e.message);
          scheduleResults.push({ eventId: ev.id, date: ev.date, ok: false, error: e.message });
        }
      }
    } else {
      console.warn('[fonnte-schedule] Fonnte token not set — messages saved but NOT scheduled on Fonnte');
      scheduleResults.push({ ok: false, error: 'Fonnte token not configured' });
    }
  }

  res.json({ ok: true, ids, scheduleResults });
});

app.put('/api/calendar/:id', async (req, res) => {
  const db0   = readDB();
  const token = db0.settings?.whatsappApiKey;
  const old   = (db0.calendarEvents || []).find(e => e.id === req.params.id);

  // Cancel previously scheduled Fonnte messages for this event if any
  if (token && old?.fonnteScheduled?.length) {
    for (const entry of old.fonnteScheduled) {
      try { await fonnteDeleteMessage(token, entry.fonnteId); } catch(e) { /* ignore */ }
    }
  }

  let updatedEv;
  saveDB(db => {
    if (!db.calendarEvents) db.calendarEvents = [];
    const idx = db.calendarEvents.findIndex(e => e.id === req.params.id);
    if (idx >= 0) {
      db.calendarEvents[idx] = { ...db.calendarEvents[idx], ...req.body, fonnteScheduled: [] };
      updatedEv = db.calendarEvents[idx];
    }
    // Sync holidays if type changed
    if (updatedEv && (updatedEv.type === 'holiday' || updatedEv.type === 'offday')) {
      db.holidays = db.holidays.filter(h => !h.id.startsWith(req.params.id + '_h'));
      db.holidays.push({ id: updatedEv.id + '_h', date: updatedEv.date, type: updatedEv.type === 'holiday' ? 'Holiday' : 'OffDay', reason: updatedEv.title });
    }
  });

  // Reschedule on Fonnte if this is a message event with targets
  let scheduleResult = null;
  if (token && updatedEv?.type === 'message' && updatedEv?.waTargets?.length && updatedEv?.waMessage) {
    try {
      const db2 = readDB();
      const schoolName = db2.settings?.schoolName || '';
      const scheduled = await scheduleEventOnFonnte(token, updatedEv, schoolName);
      if (scheduled.length) {
        saveDB(db3 => {
          const ev = (db3.calendarEvents || []).find(e => e.id === req.params.id);
          if (ev) ev.fonnteScheduled = scheduled;
        });
        scheduleResult = { ok: true, count: scheduled.length };
      } else {
        scheduleResult = { ok: false, error: 'Fonnte did not return IDs' };
      }
    } catch(e) {
      scheduleResult = { ok: false, error: e.message };
    }
  }

  res.json({ ok: true, scheduleResult });
});

app.delete('/api/calendar/:id', async (req, res) => {
  const { all } = req.query; // ?all=1 deletes entire group
  const db = readDB();
  const token = db.settings?.whatsappApiKey;

  if (!db.calendarEvents) db.calendarEvents = [];
  const ev = db.calendarEvents.find(e => e.id === req.params.id);

  // Collect all events to delete (single or whole group)
  let toDelete = [];
  if (all && ev?.groupId) {
    toDelete = db.calendarEvents.filter(e => e.groupId === ev.groupId);
  } else if (ev) {
    toDelete = [ev];
  }

  // Cancel on Fonnte first (fire and forget — don't block UI on Fonnte errors)
  if (token && toDelete.length) {
    for (const delEv of toDelete) {
      const scheduled = delEv.fonnteScheduled || [];
      console.log(`[fonnte-delete] event "${delEv.title}" has ${scheduled.length} scheduled IDs:`, JSON.stringify(scheduled));
      if (!scheduled.length) {
        console.warn(`[fonnte-delete] No fonnteScheduled IDs found for event "${delEv.title}" — cannot cancel on Fonnte`);
      }
      for (const entry of scheduled) {
        try {
          console.log(`[fonnte-delete] attempting to cancel fonnteId=${entry.fonnteId}`);
          const r = await fonnteDeleteMessage(token, entry.fonnteId);
          console.log(`[fonnte-delete] response:`, JSON.stringify(r));
          console.log(`[fonnte-delete] ID ${entry.fonnteId}: ${r.status ? '✅ حُذف' : '⚠️ ' + (r.reason||r.error||'unknown')}`);
        } catch(e) {
          console.warn(`[fonnte-delete] error for ${entry.fonnteId}:`, e.message);
        }
      }
    }
  }

  // Now remove from DB
  saveDB(db2 => {
    if (!db2.calendarEvents) db2.calendarEvents = [];
    if (all && ev?.groupId) {
      const groupEvs = db2.calendarEvents.filter(e => e.groupId === ev.groupId);
      groupEvs.forEach(ge => {
        db2.holidays = db2.holidays.filter(h => !h.id.startsWith(ge.id+'_h'));
      });
      db2.calendarEvents = db2.calendarEvents.filter(e => e.groupId !== ev.groupId);
    } else {
      db2.calendarEvents = db2.calendarEvents.filter(e => e.id !== req.params.id);
      if (ev && (ev.type === 'holiday' || ev.type === 'offday')) {
        db2.holidays = db2.holidays.filter(h => !h.id.startsWith(req.params.id + '_h'));
      }
    }
  });

  res.json({ ok: true });
});

app.get('*', (_, res) => {
  const fromApp  = path.join(APP_DIR, 'index.html');
  const fromRoot = path.join(ROOT_DIR, 'index.html');
  if (fs.existsSync(fromApp))  return res.sendFile(fromApp);
  if (fs.existsSync(fromRoot)) return res.sendFile(fromRoot);
  res.status(404).send('index.html not found');
});


// ════════════════════════════════════════════════════════
//  تشغيل الخادم
// ════════════════════════════════════════════════════════
// ── Local fallback scheduler: checks every 60s for due message events ──
// Catches events whose Fonnte scheduling failed or had no token at save time.
const _localSchedulerSent = new Set(); // prevent double-sending in same process
setInterval(async () => {
  try {
    const db    = readDB();
    const token = db.settings?.whatsappApiKey;
    if (!token) return;
    const nowMs = Date.now();
    const events = (db.calendarEvents || []).filter(ev => {
      if (ev.type !== 'message') return false;
      if (!ev.waTargets?.length || !ev.waMessage) return false;
      if (_localSchedulerSent.has(ev.id)) return false;
      // Already successfully scheduled on Fonnte — skip
      if (ev.fonnteScheduled?.length) return false;
      const timeStr = (ev.time && /^\d{1,2}:\d{2}$/.test(ev.time)) ? ev.time : '09:00';
      const sendAt  = new Date(`${ev.date}T${timeStr}:00+03:00`).getTime();
      // Due = within last 5 min or up to 1 min in future (local delivery window)
      return sendAt <= nowMs + 60000 && sendAt >= nowMs - 300000;
    });
    for (const ev of events) {
      _localSchedulerSent.add(ev.id); // mark immediately to prevent retry loop
      console.log(`[local-scheduler] delivering "${ev.title}" on ${ev.date} NOW (Fonnte scheduling was skipped)`);
      try {
        const schoolName = db.settings?.schoolName || '';
        const scheduled  = await scheduleEventOnFonnte(token, ev, schoolName);
        if (scheduled.length) {
          saveDB(db2 => {
            const stored = (db2.calendarEvents || []).find(e => e.id === ev.id);
            if (stored) stored.fonnteScheduled = scheduled;
          });
          console.log(`[local-scheduler] ✅ sent ${scheduled.length} messages for "${ev.title}"`);
        }
      } catch(e) {
        console.error(`[local-scheduler] error for "${ev.title}":`, e.message);
        _localSchedulerSent.delete(ev.id); // allow retry next tick
      }
    }
  } catch(e) {
    console.error('[local-scheduler] tick error:', e.message);
  }
}, 60 * 1000); // every 60 seconds

process.on('uncaughtException',     e => console.error('[CRASH] uncaughtException:', e));
process.on('unhandledRejection', (r,p) => console.error('[CRASH] unhandledRejection:', r));

// ── بدء التشغيل: تحميل Supabase أولاً ثم فتح المنفذ ─────────
_initCache()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      const ip = getLocalIP();
      console.log(`\n╔══════════════════════════════════════════╗`);
      console.log(`║  ✅حلقات مجمع الخير — جاهز للعمل            ║`);
      console.log(`║  http://localhost:${PORT}                    ║`);
      console.log(`║  📱 شبكة محلية: http://${ip}:${PORT}  ║`);
      console.log(`╚══════════════════════════════════════════╝\n`);
    });
  })
  .catch(e => {
    console.error('[FATAL] فشل الاتصال بـ Supabase — تحقق من SUPABASE_URL و SUPABASE_KEY:', e.message);
    process.exit(1);
  });
