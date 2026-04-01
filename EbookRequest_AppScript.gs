// ============================================================
//  EBOOK REQUEST — Google Apps Script
//  Spreadsheet : 13hbgb6mQadUxEhgPIywGI3__u_7gs_rLkbyjPb-aZZU
//  Drive Folder: 1ySwDnk5k8bLdnBTpop3aYYlqBXq4nZHI
// ============================================================

const SHEET_ID      = '13hbgb6mQadUxEhgPIywGI3__u_7gs_rLkbyjPb-aZZU';
const FOLDER_ID     = '1ySwDnk5k8bLdnBTpop3aYYlqBXq4nZHI';
const REQUESTS_TAB  = 'Requests';
const PAYMENTS_TAB  = 'Payments';

// ── COLUMN HEADERS ────────────────────────────────────────────────────────────
const REQUEST_HEADERS = [
  'Reference No', 'Submitted At', 'Status',
  'FB Full Name', 'Email', 'Facebook Link',
  'Total Books Requested', 'Preferred Format', 'Accept Any Format',
  'Books Requested', 'Books Count', 'Notes',
  'Books Located Count', 'Admin Notes',
  'Cover Files', 'Payment Confirmed', 'Last Updated'
];

const PAYMENT_HEADERS = [
  'Reference No', 'Submitted At', 'Payment Method', 'Sender Name',
  'Total Paid', 'Message', 'Proof File URL', 'Status'
];

// ── CORS HELPER ───────────────────────────────────────────────────────────────
function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── ENTRY POINT: GET ──────────────────────────────────────────────────────────
function doGet(e) {
  const action = e.parameter.action || '';
  try {
    if (action === 'getAll')    return corsResponse(getAllRequests());
    if (action === 'getByRef')  return corsResponse(getByRef(e.parameter.ref));
    if (action === 'track')     return corsResponse(trackRequest(e.parameter.ref));
    if (action === 'updateStatus') return corsResponse(updateStatus(e.parameter.ref, e.parameter.status));
    if (action === 'updateNote')   return corsResponse(updateNote(e.parameter.ref, e.parameter.note));
    if (action === 'updateLocated') return corsResponse(updateLocated(e.parameter.ref, e.parameter.count));
    return corsResponse({ error: 'Unknown action' });
  } catch (err) {
    return corsResponse({ error: err.message });
  }
}

// ── ENTRY POINT: POST ─────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const params = e.parameter;
    const action = params.action || '';

    if (action === 'submit')         return corsResponse(submitRequest(e));
    if (action === 'confirmPayment') return corsResponse(confirmPayment(e));

    return corsResponse({ error: 'Unknown action' });
  } catch (err) {
    return corsResponse({ error: err.message });
  }
}

// ── SHEET HELPERS ─────────────────────────────────────────────────────────────
function getOrCreateSheet(tabName, headers) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  let   sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#451a03')
      .setFontColor('#fbbf24')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[toCamel(h)] = row[i] !== undefined ? String(row[i]) : ''; });
    return obj;
  });
}

function toCamel(str) {
  return str.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase());
}

function findRowByRef(sheet, ref) {
  const data   = sheet.getDataRange().getValues();
  const headers = data[0];
  const refCol  = headers.indexOf('Reference No');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][refCol]) === String(ref)) return i + 1; // 1-based
  }
  return -1;
}

function getColIndex(sheet, colName) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.indexOf(colName) + 1; // 1-based, 0 if not found
}

// ── SUBMIT NEW REQUEST ────────────────────────────────────────────────────────
function submitRequest(e) {
  const p     = e.parameter;
  const sheet = getOrCreateSheet(REQUESTS_TAB, REQUEST_HEADERS);
  const ref   = p.reference_no || generateRef();
  const now   = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

  // Upload cover images to Drive subfolder
  let coverFileLinks = '';
  try {
    const folder    = DriveApp.getFolderById(FOLDER_ID);
    const subFolder = getOrCreateSubfolder(folder, ref);
    const blobs     = getBlobs(e, 'cover_');
    const links     = blobs.map(b => {
      const f = subFolder.createFile(b);
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return f.getUrl();
    });
    coverFileLinks = links.join(' | ');
  } catch (err) {
    coverFileLinks = 'Upload error: ' + err.message;
  }

  sheet.appendRow([
    ref, now, 'Received',
    p.client_name    || '',
    p.client_email   || '',
    p.client_phone   || '',
    p.total_books_requested || '',
    p.preferred_format      || '',
    p.accept_any_format     || '',
    p.books_requested       || '',
    p.books_count           || '',
    p.notes                 || '',
    '',   // books_located_count
    '',   // admin_notes
    coverFileLinks,
    'No', // payment_confirmed
    now
  ]);

  return { success: true, reference_no: ref, submitted_at: now };
}

// ── CONFIRM PAYMENT ───────────────────────────────────────────────────────────
function confirmPayment(e) {
  const p        = e.parameter;
  const ref      = p.reference_no;
  const now      = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
  const reqSheet = getOrCreateSheet(REQUESTS_TAB, REQUEST_HEADERS);
  const paySheet = getOrCreateSheet(PAYMENTS_TAB, PAYMENT_HEADERS);

  // Upload proof of payment
  let proofUrl = '';
  try {
    const folder    = DriveApp.getFolderById(FOLDER_ID);
    const subFolder = getOrCreateSubfolder(folder, ref);
    const blobs     = getBlobs(e, 'proof_of_payment');
    if (blobs.length > 0) {
      const f = subFolder.createFile(blobs[0]);
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      proofUrl = f.getUrl();
    }
  } catch (err) {
    proofUrl = 'Upload error: ' + err.message;
  }

  // Log payment row
  paySheet.appendRow([
    ref, now,
    p.payment_method || '',
    p.sender_name    || '',
    p.total_paid     || '',
    p.pay_message    || '',
    proofUrl,
    'Payment Submitted'
  ]);

  // Update request status
  const rowNum = findRowByRef(reqSheet, ref);
  if (rowNum > 0) {
    const statusCol  = getColIndex(reqSheet, 'Status');
    const payCol     = getColIndex(reqSheet, 'Payment Confirmed');
    const updatedCol = getColIndex(reqSheet, 'Last Updated');
    if (statusCol)  reqSheet.getRange(rowNum, statusCol).setValue('Payment Submitted');
    if (payCol)     reqSheet.getRange(rowNum, payCol).setValue('Pending Verification');
    if (updatedCol) reqSheet.getRange(rowNum, updatedCol).setValue(now);
  }

  return { success: true, reference_no: ref };
}

// ── GET ALL REQUESTS ──────────────────────────────────────────────────────────
function getAllRequests() {
  const sheet = getOrCreateSheet(REQUESTS_TAB, REQUEST_HEADERS);
  const rows  = sheetToObjects(sheet);
  return { requests: rows };
}

// ── GET BY REFERENCE ──────────────────────────────────────────────────────────
function getByRef(ref) {
  if (!ref) return { found: false };
  const sheet = getOrCreateSheet(REQUESTS_TAB, REQUEST_HEADERS);
  const rows  = sheetToObjects(sheet);
  const row   = rows.find(r => r.referenceNo === ref || r.reference_no === ref);
  if (!row) return { found: false };
  return { found: true, data: row };
}

// ── TRACK REQUEST ─────────────────────────────────────────────────────────────
function trackRequest(ref) {
  if (!ref) return { found: false };
  const result = getByRef(ref);
  if (!result.found) return { found: false };
  const r = result.data;
  return {
    found:       true,
    status:      r.status || 'Received',
    updated_at:  r.lastUpdated || r.submittedAt || '',
    books_requested: r.booksRequested || ''
  };
}

// ── UPDATE STATUS ─────────────────────────────────────────────────────────────
function updateStatus(ref, status) {
  if (!ref || !status) return { success: false, error: 'Missing ref or status' };
  const sheet  = getOrCreateSheet(REQUESTS_TAB, REQUEST_HEADERS);
  const rowNum = findRowByRef(sheet, ref);
  if (rowNum < 0) return { success: false, error: 'Not found' };
  const statusCol  = getColIndex(sheet, 'Status');
  const updatedCol = getColIndex(sheet, 'Last Updated');
  const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
  if (statusCol)  sheet.getRange(rowNum, statusCol).setValue(status);
  if (updatedCol) sheet.getRange(rowNum, updatedCol).setValue(now);
  return { success: true };
}

// ── UPDATE ADMIN NOTE ─────────────────────────────────────────────────────────
function updateNote(ref, note) {
  if (!ref) return { success: false };
  const sheet  = getOrCreateSheet(REQUESTS_TAB, REQUEST_HEADERS);
  const rowNum = findRowByRef(sheet, ref);
  if (rowNum < 0) return { success: false, error: 'Not found' };
  const noteCol    = getColIndex(sheet, 'Admin Notes');
  const updatedCol = getColIndex(sheet, 'Last Updated');
  const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
  if (noteCol)    sheet.getRange(rowNum, noteCol).setValue(note);
  if (updatedCol) sheet.getRange(rowNum, updatedCol).setValue(now);
  return { success: true };
}

// ── UPDATE BOOKS LOCATED COUNT ────────────────────────────────────────────────
function updateLocated(ref, count) {
  if (!ref) return { success: false };
  const sheet  = getOrCreateSheet(REQUESTS_TAB, REQUEST_HEADERS);
  const rowNum = findRowByRef(sheet, ref);
  if (rowNum < 0) return { success: false, error: 'Not found' };
  const locCol     = getColIndex(sheet, 'Books Located Count');
  const updatedCol = getColIndex(sheet, 'Last Updated');
  const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
  if (locCol)     sheet.getRange(rowNum, locCol).setValue(count);
  if (updatedCol) sheet.getRange(rowNum, updatedCol).setValue(now);
  return { success: true };
}

// ── DRIVE HELPERS ─────────────────────────────────────────────────────────────
function getOrCreateSubfolder(parentFolder, name) {
  const iter = parentFolder.getFoldersByName(name);
  return iter.hasNext() ? iter.next() : parentFolder.createFolder(name);
}

function getBlobs(e, prefix) {
  const blobs = [];
  if (!e.postData) return blobs;
  // Apps Script multipart parsing
  try {
    const parts = e.postData.contents;
    // Try named parameter blobs
    for (const key in e.parameters) {
      if (key.startsWith(prefix)) {
        // handled differently in multipart
      }
    }
    // Primary: use named file blobs
    const fileKeys = Object.keys(e.parameters || {}).filter(k => k.startsWith(prefix));
    fileKeys.forEach(k => {
      const val = e.parameters[k];
      if (val && val[0]) blobs.push(Utilities.newBlob(val[0]));
    });
  } catch(_) {}

  // Fallback: try e.parameters directly for file uploads
  try {
    if (e.parameter && e.parameter[prefix]) {
      blobs.push(e.parameter[prefix]);
    }
    // Check numbered variants: cover_0, cover_1, etc.
    let i = 0;
    while (e.parameter && e.parameter[prefix + i]) {
      blobs.push(e.parameter[prefix + i]);
      i++;
    }
  } catch(_) {}

  return blobs;
}

// ── REFERENCE GENERATOR ───────────────────────────────────────────────────────
function generateRef() {
  const now = new Date();
  const yy  = String(now.getFullYear()).slice(-2);
  const mm  = String(now.getMonth() + 1).padStart(2, '0');
  const dd  = String(now.getDate()).padStart(2, '0');
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `EBR-${yy}${mm}${dd}-${rnd}`;
}

// ── TEST FUNCTION (run manually to verify setup) ──────────────────────────────
function testSetup() {
  const ss     = SpreadsheetApp.openById(SHEET_ID);
  const folder = DriveApp.getFolderById(FOLDER_ID);
  Logger.log('✅ Spreadsheet: ' + ss.getName());
  Logger.log('✅ Folder: ' + folder.getName());
  const sheet  = getOrCreateSheet(REQUESTS_TAB, REQUEST_HEADERS);
  Logger.log('✅ Requests sheet rows: ' + sheet.getLastRow());
}
