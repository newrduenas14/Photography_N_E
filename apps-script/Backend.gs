/**
 * Photography by Norma & Eduardo - Google Apps Script Backend
 *
 * NOTE: This backend uses Google Sheet column-header mapping dynamically
 * and does NOT rely on hardcoded column numbers.
 */

var APP_TIMEZONE = 'America/Chicago';

var SHEET_NAMES = {
  RESERVATIONS: 'RESERVATIONS',
  PACKAGES: 'PACKAGES',
  CONFIG: 'CONFIG',
  DISTANCE_FEES: 'DISTANCE_FEES',
  BLOCKED_TIMES: 'BLOCKED_TIMES',
  PAYMENTS: 'PAYMENTS',
  CLIENTS: 'CLIENTS',
  PROMOS: 'PROMOS',
  PENDING_CHECKOUTS: 'PENDING_CHECKOUTS',
  STRIPE_EVENTS: 'STRIPE_EVENTS',
  USERS: 'USERS',
  ACTIVITY_LOG: 'ACTIVITY_LOG'
};

function getSpreadsheet_() {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('Missing SPREADSHEET_ID in Script Properties.');
  return SpreadsheetApp.openById(spreadsheetId);
}

function getSheet_(sheetName) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Missing sheet: ' + sheetName);
  return sheet;
}

function getHeaderMap_(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) throw new Error('Sheet has no headers: ' + sheet.getName());
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var map = {};
  headers.forEach(function (h, i) { map[String(h).trim()] = i; });
  return { headers: headers, map: map };
}

function getRowsAsObjects_(sheetName) {
  var sheet = getSheet_(sheetName);
  var meta = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var data = sheet.getRange(2, 1, lastRow - 1, meta.headers.length).getValues();
  return data.map(function (row, idx) {
    var obj = { __rowNum: idx + 2 };
    meta.headers.forEach(function (h, c) { obj[h] = row[c]; });
    return obj;
  });
}

function appendObjectRow_(sheetName, obj) {
  var sheet = getSheet_(sheetName);
  var meta = getHeaderMap_(sheet);
  var row = meta.headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  sheet.appendRow(row);
}

function updateRowByRowNum_(sheetName, rowNum, objPatch) {
  var sheet = getSheet_(sheetName);
  var meta = getHeaderMap_(sheet);
  var range = sheet.getRange(rowNum, 1, 1, meta.headers.length);
  var row = range.getValues()[0];
  Object.keys(objPatch).forEach(function (k) {
    if (meta.map[k] !== undefined) row[meta.map[k]] = objPatch[k];
  });
  range.setValues([row]);
}

function normalizeActive_(value) {
  return String(value || '').toLowerCase() === 'active';
}
function asBoolYesNo_(value) {
  return String(value || '').toLowerCase() === 'yes';
}
function toNumber_(v) { return Number(v || 0); }
function nowIso_() { return Utilities.formatDate(new Date(), APP_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss"); }
function formatDate_(d) { return Utilities.formatDate(new Date(d), APP_TIMEZONE, 'yyyy-MM-dd'); }

function timeToMinutes_(hhmm) {
  var p = String(hhmm).split(':');
  return Number(p[0]) * 60 + Number(p[1]);
}
function minutesToTime_(m) {
  var h = Math.floor(m / 60), mm = m % 60;
  return Utilities.formatString('%02d:%02d', h, mm);
}
function hashPassword_(password) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
}
function generateId_(prefix, withDate) {
  var rand = Math.floor(1000 + Math.random() * 9000);
  if (withDate) return prefix + '-' + Utilities.formatDate(new Date(), APP_TIMEZONE, 'yyyyMMdd') + '-' + rand;
  return prefix + '-' + Math.floor(100000 + Math.random() * 900000);
}

function getConfigMap_() {
  var rows = getRowsAsObjects_(SHEET_NAMES.CONFIG).filter(function (r) { return normalizeActive_(r['Active']); });
  var out = {};
  rows.forEach(function (r) { out[String(r['Setting Key'])] = r['Setting Value']; });
  return out;
}

function getPackageById_(packageId) {
  var row = getRowsAsObjects_(SHEET_NAMES.PACKAGES).find(function (r) { return String(r['Package ID']) === String(packageId) && normalizeActive_(r['Active']); });
  if (!row) throw new Error('Package not found or inactive: ' + packageId);
  return row;
}

function getDistanceByArea_(areaCode) {
  var row = getRowsAsObjects_(SHEET_NAMES.DISTANCE_FEES).find(function (r) { return String(r['Area Code']) === String(areaCode) && normalizeActive_(r['Active']); });
  return row || null;
}

function overlaps_(newStart, newEnd, existingStart, existingEnd) {
  return newStart < existingEnd && newEnd > existingStart;
}

function getPackages() {
  var rows = getRowsAsObjects_(SHEET_NAMES.PACKAGES)
    .filter(function (r) { return normalizeActive_(r['Active']); })
    .sort(function (a, b) { return toNumber_(a['Display Order']) - toNumber_(b['Display Order']); });
  return rows.map(function (r) {
    return {
      packageId: r['Package ID'], packageName: r['Package Name'], category: r['Category'], description: r['Description'],
      basePrice: toNumber_(r['Base Price']), durationMinutes: toNumber_(r['Duration Minutes']), editedPhotos: toNumber_(r['Edited Photos']),
      allowStudio: asBoolYesNo_(r['Allow Studio']), allowLocation: asBoolYesNo_(r['Allow Location']),
      requiresManualReview: asBoolYesNo_(r['Requires Manual Review']), imageFilename: r['Image Filename']
    };
  });
}

function getConfig() { return getConfigMap_(); }

function getDistanceFees() {
  return getRowsAsObjects_(SHEET_NAMES.DISTANCE_FEES)
    .filter(function (r) { return normalizeActive_(r['Active']); })
    .map(function (r) {
      return {
        areaCode: r['Area Code'], areaName: r['Area Name'], extraFee: toNumber_(r['Extra Fee']),
        requiresManualReview: asBoolYesNo_(r['Requires Manual Review'])
      };
    });
}

function getPromos() {
  return getRowsAsObjects_(SHEET_NAMES.PROMOS).filter(function (r) { return normalizeActive_(r['Active']); });
}

function getAvailableTimes(params) {
  var config = getConfigMap_();
  var date = String(params.date);
  var packageRow = getPackageById_(params.packageId);
  var duration = toNumber_(packageRow['Duration Minutes']);
  var buffer = String(params.sessionType).toLowerCase() === 'location' ? toNumber_(config.location_buffer_minutes) : toNumber_(config.studio_buffer_minutes);
  var startM = timeToMinutes_(config.start_time || '08:00');
  var endM = timeToMinutes_(config.end_time || '20:00');
  var step = toNumber_(config.slot_interval_minutes || 30);
  var d = new Date(date + 'T00:00:00');
  if (d.getDay() === 0 && !asBoolYesNo_(config.allow_sunday_bookings)) return [];
  var today = formatDate_(new Date());
  if (date < today) return [];

  var reservations = getRowsAsObjects_(SHEET_NAMES.RESERVATIONS).filter(function (r) {
    return String(r['Session Date']) === date && String(r['Reservation Status']).toLowerCase() === 'confirmed';
  });
  var blocks = getRowsAsObjects_(SHEET_NAMES.BLOCKED_TIMES).filter(function (b) {
    return normalizeActive_(b['Active']) && String(b['Date']) === date;
  });
  if (blocks.some(function (b) { return String(b['Block Type']).toLowerCase() === 'full day'; })) return [];

  var slots = [];
  for (var s = startM; s < endM; s += step) {
    var sessionEnd = s + duration;
    if (sessionEnd > endM) continue;
    var slotBufferEnd = sessionEnd + buffer;

    var blockedByRes = reservations.some(function (r) {
      return overlaps_(s, slotBufferEnd, timeToMinutes_(r['Start Time']), timeToMinutes_(r['Buffer End Time']));
    });
    var blockedByBlock = blocks.some(function (b) {
      if (String(b['Block Type']).toLowerCase() === 'full day') return true;
      return overlaps_(s, slotBufferEnd, timeToMinutes_(b['Start Time']), timeToMinutes_(b['End Time']));
    });
    if (!blockedByRes && !blockedByBlock) slots.push(minutesToTime_(s));
  }
  return slots;
}

function getAvailableDates(params) {
  var year = Number(params.year), month = Number(params.month);
  var days = new Date(year, month, 0).getDate();
  var result = [];
  for (var d = 1; d <= days; d++) {
    var ds = Utilities.formatString('%04d-%02d-%02d', year, month, d);
    var times = getAvailableTimes({ date: ds, packageId: params.packageId, sessionType: params.sessionType, areaCode: params.areaCode });
    result.push({ date: ds, available: times.length > 0 });
  }
  return result;
}

function calculatePrice(params) {
  var config = getConfigMap_();
  var pkg = getPackageById_(params.packageId);
  var base = toNumber_(pkg['Base Price']);
  var extra = 0, area = null, manualReviewRequired = asBoolYesNo_(pkg['Requires Manual Review']);
  if (String(params.sessionType).toLowerCase() === 'location') {
    area = getDistanceByArea_(params.areaCode);
    if (!area) throw new Error('Area Code not found in DISTANCE_FEES: ' + params.areaCode);
    extra = toNumber_(area['Extra Fee']);
    if (asBoolYesNo_(area['Requires Manual Review'])) manualReviewRequired = true;
  }

  var promoId = '', promoCode = params.promoCode || '', discount = 0;
  if (promoCode) {
    var promos = getRowsAsObjects_(SHEET_NAMES.PROMOS);
    var now = formatDate_(new Date());
    var p = promos.find(function (x) {
      return normalizeActive_(x['Active']) && String(x['Promo Code']).toLowerCase() === String(promoCode).toLowerCase() &&
        (!x['Start Date'] || String(x['Start Date']) <= now) && (!x['End Date'] || String(x['End Date']) >= now);
    });
    if (p) {
      promoId = p['Promo ID'];
      if (String(p['Discount Type']).toLowerCase() === 'percent') discount = (base + extra) * (toNumber_(p['Discount Value']) / 100);
      else discount = toNumber_(p['Discount Value']);
    }
  }
  var total = Math.max(0, base + extra - discount);
  var deposit = total * toNumber_(config.deposit_percent || 0.5);
  var amountDueNow = String(params.paymentOption).toLowerCase() === 'deposit' ? deposit : total;
  var balanceDue = total - amountDueNow;
  return {
    packageId: pkg['Package ID'], packageName: pkg['Package Name'], basePrice: base, extraFee: extra, promoId: promoId,
    promoCode: promoCode, discountAmount: discount, totalPrice: total, depositRequired: deposit,
    amountDueNow: amountDueNow, balanceDue: balanceDue, manualReviewRequired: manualReviewRequired
  };
}
