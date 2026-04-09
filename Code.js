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

function createOverview() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dataSheet = ss.getSheets()[0]; // Assume data is in the first sheet
  var data = dataSheet.getDataRange().getValues();
  
  var headers = data[0];
  var countryIdx = headers.indexOf("Account: Billing Country");
  var revenueIdx = headers.indexOf("Workload Gross Annual Recurring Revenue (converted)");
  var partnerIdx = headers.indexOf("Partner");
  
  if (countryIdx === -1 || revenueIdx === -1 || partnerIdx === -1) {
    Logger.log("Required headers not found.");
    return;
  }
  
  var summary = {};
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var country = row[countryIdx];
    var revenueStr = row[revenueIdx];
    var partner = row[partnerIdx];
    
    if (!country) continue;
    
    var revenue = parseRevenue(revenueStr);
    
    if (!summary[country]) {
      summary[country] = {
        count: 0,
        partners: {},
        totalRev: 0
      };
    }
    
    summary[country].count++;
    if (partner) {
      summary[country].partners[partner] = true;
    }
    summary[country].totalRev += revenue;
  }
  
  // Prepare output data
  var output = [[
    "Account: Billing Country",
    "Amount of workloads",
    "Amount of partners",
    "Total amount of Gross Anual Recurring",
    "Average of the gross recurring"
  ]];
  
  for (var country in summary) {
    var s = summary[country];
    var partnerCount = Object.keys(s.partners).length;
    var avg = s.count > 0 ? s.totalRev / s.count : 0;
    output.push([
      country,
      s.count,
      partnerCount,
      s.totalRev,
      avg
    ]);
  }
  
  // Create or get sheet
  var overviewSheet = ss.getSheetByName("GE_Overview");
  if (!overviewSheet) {
    overviewSheet = ss.insertSheet("GE_Overview");
  } else {
    overviewSheet.clear();
  }
  
  overviewSheet.getRange(1, 1, output.length, output[0].length).setValues(output);
}

function parseRevenue(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  // Remove "USD ", commas, and spaces
  var cleanStr = str.toString().replace("USD ", "").replace(/,/g, "").trim();
  var val = parseFloat(cleanStr);
  return isNaN(val) ? 0 : val;
}
