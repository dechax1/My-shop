/**
 * CoolPro HVAC — lead receiver (Google Apps Script, bound to your Google Sheet)
 *
 * What it does
 *   POST from the website  →  validate  →  append a row to the "Leads" sheet
 *                                        →  (optional) push a LINE OA message to you
 *                                        →  (optional) send you an email
 *
 * Setup: see SETUP.md (section 3). In short:
 *   1. Open your Google Sheet → Extensions → Apps Script → paste this file.
 *   2. Run `setup` once (creates the "Leads" and "Products" tabs, asks for permission).
 *   3. Project Settings → Script properties (all optional):
 *        LINE_CHANNEL_TOKEN  Messaging API channel access token (long-lived)
 *        LINE_TO             Your LINE user ID (Uxxxxxxxx…) or a group ID
 *        NOTIFY_EMAIL        Email address that receives a copy of each lead
 *   4. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone → copy the /exec URL
 *      into assets/config.js → leadEndpoint.
 *
 * Secrets stay in Script properties on Google's side. They never appear in the website code.
 */

const LEADS_SHEET = 'Leads';
const PRODUCTS_SHEET = 'Products';
const LEAD_HEADERS = [
  'Ref', 'Received', 'Type', 'Name', 'Phone', 'LINE/Email', 'Items', 'Units',
  'Subtotal', 'Discount', 'VAT', 'Grand total', 'Project', 'Area m²', 'Building', 'Est. TR',
  'Note', 'Price source', 'Page', 'Status',
];
const PRODUCT_HEADERS = ['id', 'type', 'name', 'tag', 'desc', 'feats', 'model', 'btu', 'price', 'seer', 'active'];
const MAX_BODY = 20000;          // bytes
const RATE_LIMIT_SECONDS = 60;   // one submission per phone number per minute

/** Health check: open the /exec URL in a browser and you should see {"ok":true,...} */
function doGet() {
  return json_({ ok: true, service: 'coolpro-leads', time: new Date().toISOString() });
}

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    if (!raw || raw.length > MAX_BODY) return json_({ ok: false, error: 'bad-request' });

    const d = JSON.parse(raw);
    if (d.website) return json_({ ok: true, ref: '-' });                 // honeypot → silently drop
    if (d.type !== 'quote' && d.type !== 'project') return json_({ ok: false, error: 'bad-type' });

    const phone = String(d.phone || '').replace(/[^\d]/g, '').replace(/^66/, '0');
    if (!/^(0[689]\d{8}|0[2-7]\d{7})$/.test(phone)) return json_({ ok: false, error: 'bad-phone' });
    const name = clip_(d.name, 80);
    if (!name) return json_({ ok: false, error: 'missing-name' });

    // simple rate limit per phone number
    const cache = CacheService.getScriptCache();
    if (cache.get('rl_' + phone)) return json_({ ok: false, error: 'too-many-requests' });
    cache.put('rl_' + phone, '1', RATE_LIMIT_SECONDS);

    const items = Array.isArray(d.items) ? d.items.slice(0, 50) : [];
    const itemsText = items.map(function (i, n) {
      return (n + 1) + '. ' + clip_(i.name, 60) + (i.model ? ' (' + clip_(i.model, 40) + ')' : '') +
        ' ' + num_(i.btu) + ' BTU × ' + num_(i.qty) + ' @ ' + num_(i.price);
    }).join('\n');
    const t = d.totals || {};
    const p = d.project || {};
    const ref = makeRef_(d.type);

    const row = [
      ref, new Date(), d.type, name, "'" + phone, clip_(d.contact, 100), itemsText, num_(t.units),
      num_(t.subtotal), num_(t.discount), num_(t.vat), num_(t.grand),
      clip_(p.company, 120), num_(p.areaM2), clip_(p.buildingType, 20), num_(p.estTR),
      clip_(d.note, 300), clip_(d.priceSource, 10), clip_(d.page, 200), 'New',
    ].map(safeCell_);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      sheet_(LEADS_SHEET, LEAD_HEADERS).appendRow(row);
    } finally {
      lock.releaseLock();
    }

    const msg = formatMessage_(ref, d.type, name, phone, d.contact, itemsText, t, p, d.note);
    notifyLine_(msg);
    notifyEmail_('[CoolPro] ' + (d.type === 'quote' ? 'ขอใบเสนอราคา' : 'งานโครงการ') + ' ' + ref, msg);

    return json_({ ok: true, ref: ref });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server-error' });
  }
}

/** Run once from the editor. Creates tabs with headers and triggers the permission prompt. */
function setup() {
  sheet_(LEADS_SHEET, LEAD_HEADERS);
  const ps = sheet_(PRODUCTS_SHEET, PRODUCT_HEADERS);
  ps.getRange('A1:K1').setNote('One row = one model at one capacity. Rows with the same id become one product card. feats: separate with |  · active: TRUE/FALSE');
  Logger.log('Setup done. Sheets: %s, %s', LEADS_SHEET, PRODUCTS_SHEET);
}

/** Run from the editor to test the whole pipeline (row + LINE + email) without the website. */
function testLead() {
  const res = doPost({ postData: { contents: JSON.stringify({
    type: 'quote', name: 'ทดสอบ ระบบ', phone: '0800000000', contact: 'line: test',
    items: [{ name: 'Wind-Free Elite', model: 'TEST-MODEL', btu: 12000, price: 26900, qty: 2 }],
    totals: { units: 2, subtotal: 53800, discount: 0, vat: 3766, grand: 57566 },
    note: 'test from editor', priceSource: 'test', page: 'editor',
  }) } });
  Logger.log(res.getContent());
}

// ---------------------------------------------------------------- helpers

function formatMessage_(ref, type, name, phone, contact, itemsText, t, p, note) {
  const lines = [
    (type === 'quote' ? '🧾 ขอใบเสนอราคาใหม่' : '🏢 ลูกค้างานโครงการใหม่') + '  ' + ref,
    'ชื่อ: ' + name,
    'โทร: ' + phone,
  ];
  if (contact) lines.push('ติดต่อ: ' + clip_(contact, 100));
  if (type === 'quote') {
    lines.push('', itemsText, '', 'รวมสุทธิ: ฿' + Number(t.grand || 0).toLocaleString('en-US') + ' (' + (t.units || 0) + ' ชุด)');
  } else {
    lines.push('โครงการ: ' + clip_(p.company, 120),
      'พื้นที่: ' + num_(p.areaM2) + ' ตร.ม. · ' + clip_(p.buildingType, 20) + ' · ~' + num_(p.estTR) + ' TR');
  }
  if (note) lines.push('หมายเหตุ: ' + clip_(note, 300));
  return lines.join('\n').slice(0, 4900);
}

function notifyLine_(text) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('LINE_CHANNEL_TOKEN');
  const to = props.getProperty('LINE_TO');
  if (!token || !to) return;
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ to: to, messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) console.warn('LINE push failed: ' + res.getResponseCode() + ' ' + res.getContentText());
}

function notifyEmail_(subject, body) {
  const to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (to) MailApp.sendEmail(to, subject, body);
}

function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1428A0').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function makeRef_(type) {
  const tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
  const stamp = Utilities.formatDate(new Date(), tz, 'yyMMdd-HHmmss');
  const rnd = Math.floor(Math.random() * 90 + 10);
  return (type === 'quote' ? 'Q' : 'P') + stamp + rnd;
}

/** Prevent spreadsheet formula injection (=, +, -, @ at the start of user text). */
function safeCell_(v) {
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) && v.charAt(0) !== "'") return "'" + v;
  return v;
}

function clip_(v, n) { return String(v == null ? '' : v).trim().slice(0, n); }
function num_(v) { const x = Number(v); return isFinite(x) ? x : ''; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
