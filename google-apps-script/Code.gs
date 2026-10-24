/** Paste into a Sheet-bound Apps Script project. Run setup() once before deploying. */
const SHEET_NAME = 'RSVPs';
const HEADERS = ['Timestamp', 'Guest / family name', 'Attending', 'Number attending',
  'Guest names', 'Dietary needs', 'Message', 'Request ID'];

function setup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Open Apps Script from Extensions > Apps Script in your Google Sheet.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheet.getId());
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  assertHeaders_(sheet);
  sheet.setFrozenRows(1);
  sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sheet.getRange('B:C').setNumberFormat('@');
  sheet.getRange('E:H').setNumberFormat('@');
}

function doGet() {
  // Never expose responses, names, a guest list, or aggregate counts.
  return json_({ok: true, service: 'Shivani RSVP', message: 'Endpoint is reachable. Submit a test RSVP to verify storage.'});
}

function doPost(e) {
  let lock;
  let requestId = '';
  try {
    const input = e && e.parameter;
    if (!input || !e.postData || e.postData.length > 24000) throw new Error('INVALID_INPUT');
    requestId = String(input.requestId || '');
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId)) throw new Error('INVALID_INPUT');
    const data = validate_(input);
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!spreadsheetId) throw new Error('NOT_CONFIGURED');
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new Error('BUSY');
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('NOT_CONFIGURED');
    assertHeaders_(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const found = sheet.getRange(2, 8, lastRow - 1, 1).createTextFinder(requestId)
        .matchEntireCell(true).matchCase(false).useRegularExpression(false).findNext();
      if (found) return json_({ok: true, requestId, duplicate: true});
    }
    sheet.appendRow([new Date(), safeCell_(data.familyName), data.attending, data.count,
      safeCell_(data.guestNames), safeCell_(data.dietaryNeeds), safeCell_(data.message), requestId]);
    SpreadsheetApp.flush();
    return json_({ok: true, requestId});
  } catch (error) {
    // Never echo guest data, exceptions, sheet IDs, or internal errors into the public response.
    return json_({ok: false, requestId: /^[a-f0-9-]{36}$/i.test(requestId) ? requestId : '',
      code: error.message === 'INVALID_INPUT' ? 'INVALID_INPUT' : 'TRY_AGAIN'});
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function assertHeaders_(sheet) {
  const actual = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (HEADERS.some((header, index) => actual[index] !== header)) throw new Error('SCHEMA_MISMATCH');
}

function validate_(input) {
  function text(key, max, required) {
    const value = String(input[key] || '').trim();
    if ((required && !value) || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error('INVALID_INPUT');
    return value;
  }
  if (String(input.website || '').trim()) throw new Error('INVALID_INPUT');
  const familyName = text('familyName', 120, true);
  if (!['yes', 'no'].includes(input.attending)) throw new Error('INVALID_INPUT');
  const yes = input.attending === 'yes';
  const count = yes ? Number(input.count) : 0;
  if (yes && (!Number.isInteger(count) || count < 1 || count > 10)) throw new Error('INVALID_INPUT');
  return {familyName, attending: input.attending, count,
    guestNames: yes ? text('guestNames', 500) : '',
    dietaryNeeds: yes ? text('dietaryNeeds', 500) : '', message: text('message', 1500)};
}

function safeCell_(value) {
  // Treat formulas as literal text, including whitespace-prefixed spreadsheet expressions.
  return /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
