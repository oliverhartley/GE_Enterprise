function logHeaders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var range = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  var headers = range.getValues()[0];
  Logger.log("Headers: " + JSON.stringify(headers));
}

function logFirst50Rows() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var range = sheet.getRange(1, 1, 50, sheet.getLastColumn());
  var values = range.getValues();
  Logger.log("DATA_START:" + JSON.stringify(values) + ":DATA_END");
}
