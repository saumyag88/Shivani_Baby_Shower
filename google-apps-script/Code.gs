/**
 * Google Apps Script for Shivani Baby Shower RSVPs Web App
 *
 * Sheet layout ("RSVPs" tab):
 *   Column A: Timestamp
 *   Column B: Name
 *   Column C: Attending ("yes" or "no")
 *   Column D: Party Size (number of guests)
 *   Column E: Email / Contact
 *   Column F: Dietary Restrictions / Notes
 *
 * "Summary" tab:
 *   A1: "Total guests attending"
 *   B1: =SUMIF(RSVPs!C2:C,"yes",RSVPs!D2:D)
 */

var SHEET_NAME = 'RSVPs';
var SUMMARY_SHEET_NAME = 'Summary';

/**
 * Run this function once from the Apps Script editor (Select "setup" -> Run)
 * to initialize the "RSVPs" and "Summary" tabs and grant necessary permissions.
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Set up the RSVPs tab
  var rsvpSheet = ss.getSheetByName(SHEET_NAME);
  if (!rsvpSheet) {
    // Rename default Sheet1 if it exists and is empty, otherwise insert new sheet
    var defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet && defaultSheet.getLastRow() === 0) {
      defaultSheet.setName(SHEET_NAME);
      rsvpSheet = defaultSheet;
    } else {
      rsvpSheet = ss.insertSheet(SHEET_NAME);
    }
  }

  // Add headers if the sheet is empty
  if (rsvpSheet.getLastRow() === 0) {
    rsvpSheet.appendRow([
      'Timestamp',
      'Name',
      'Attending',
      'Party Size',
      'Email',
      'Message / Dietary Notes'
    ]);
    rsvpSheet.getRange(1, 1, 1, 6).setFontWeight('bold');
    rsvpSheet.setFrozenRows(1);
  }

  // 2. Set up the Summary tab
  var summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
  if (!summarySheet) {
    summarySheet = ss.insertSheet(SUMMARY_SHEET_NAME);
  }
  summarySheet.getRange('A1').setValue('Total guests attending').setFontWeight('bold');
  summarySheet.getRange('B1').setFormula('=SUMIF(RSVPs!C2:C,"yes",RSVPs!D2:D)');

  // Store the spreadsheet ID in Script Properties for reliable access
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
}

/**
 * Handles GET requests (useful for verifying that the Web App URL is live).
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Shivani Baby Shower RSVP endpoint is live.'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handles POST requests from the RSVP website form.
 * Supports both JSON payloads (fetch with text/plain or application/json)
 * and standard URL-encoded / FormData submissions.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var propId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    var ss = propId ? SpreadsheetApp.openById(propId) : SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        'Timestamp',
        'Name',
        'Attending',
        'Party Size',
        'Email',
        'Message / Dietary Notes'
      ]);
    }

    var data = {};

    // Parse incoming payload (supports JSON body or form parameters)
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    var timestamp = new Date();
    var name = (data.name || data.Name || data.fullName || '').toString().trim();
    var rawAttending = (data.attending || data.Attending || data.rsvp || data.status || '').toString().trim().toLowerCase();
    var attending = (rawAttending === 'yes' || rawAttending === 'true' || rawAttending === 'attending' || rawAttending === '1')
      ? 'yes'
      : (rawAttending === 'no' || rawAttending === 'false' || rawAttending === 'declined' || rawAttending === '0' ? 'no' : rawAttending);

    var rawPartySize = data.partySize || data.party_size || data.guests || data.guestCount || data['Party Size'];
    var partySize = parseInt(rawPartySize, 10);
    if (isNaN(partySize)) {
      partySize = attending === 'yes' ? 1 : 0;
    }

    var email = (data.email || data.Email || data.phone || data.contact || '').toString().trim();
    var notes = (data.notes || data.message || data.dietary || data.comments || '').toString().trim();

    // Columns: A = Timestamp, B = Name, C = Attending ("yes"/"no"), D = Party Size, E = Email, F = Notes
    sheet.appendRow([
      timestamp,
      name,
      attending,
      partySize,
      email,
      notes
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({
        result: 'success',
        row: sheet.getLastRow()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        result: 'error',
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}