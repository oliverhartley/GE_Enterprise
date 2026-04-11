function testCreateTable() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "test_table";
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clear();
    var filter = sheet.getFilter();
    if (filter) filter.remove();
  }
  
  // Add some dummy data
  var data = [
    ["Partner", "Account Name", "Annual Revenue"],
    ["Partner A", "Account 1", 50000],
    ["Partner B", "Account 2", 75000],
    ["Partner C", "Account 3", 120000],
    ["No Partner", "Account 4", 30000]
  ];
  
  var range = sheet.getRange(1, 1, data.length, data[0].length);
  range.setValues(data);
  
  // Try to create table via Sheets API
  var sheetId = sheet.getSheetId();
  var resource = {
    requests: [
      {
        addTable: {
          table: {
            name: "TestTable_" + new Date().getTime(), // Unique name
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
              endRowIndex: data.length,
              startColumnIndex: 0,
              endColumnIndex: data[0].length
            }
          }
        }
      }
    ]
  };
  
  try {
    Sheets.Spreadsheets.batchUpdate(resource, ss.getId());
    SpreadsheetApp.getUi().alert("Success! Table created via Sheets API.");
  } catch (e) {
    SpreadsheetApp.getUi().alert("Error: Failed to create table via Sheets API.\n\n" + e.message);
  }
}
