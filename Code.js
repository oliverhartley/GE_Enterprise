function logHeaders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var range = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  var headers = range.getValues()[0];
  Logger.log("Headers: " + JSON.stringify(headers));
}
