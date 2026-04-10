function createOverview() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dataSheet = ss.getSheets()[0]; // Assume data is in the first sheet
  var data = dataSheet.getDataRange().getValues();
  
  var headers = data[0];
  var countryIdx = headers.indexOf("Account: Billing Country");
  var revenueIdx = headers.indexOf("Workload Gross Annual Recurring Revenue (converted)");
  var partnerIdx = headers.indexOf("Partner");
  var geIdx = headers.indexOf("Aparently is GE");
  
  if (countryIdx === -1 || revenueIdx === -1 || partnerIdx === -1 || geIdx === -1) {
    Logger.log("Required headers not found.");
    return;
  }
  
  var summary = {};
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var country = row[countryIdx];
    var revenueStr = row[revenueIdx];
    var partner = row[partnerIdx];
    var isGE = row[geIdx];
    
    if (!country) continue;
    
    // Filter: Only count rows where 'Aparently is GE' is not empty
    if (!isGE || isGE.toString().trim() === "") continue;
    
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
  
  // Write data
  overviewSheet.getRange(1, 1, output.length, output[0].length).setValues(output);
  
  // ---- Formatting ----
  
  // 1. Header Formatting
  var headerRange = overviewSheet.getRange(1, 1, 1, output[0].length);
  headerRange.setBackground("#1a73e8") // Google Blue
             .setFontColor("#ffffff")
             .setFontWeight("bold")
             .setHorizontalAlignment("center")
             .setVerticalAlignment("middle");
  overviewSheet.setRowHeight(1, 30);
  
  // 2. Data Formatting
  var dataRange = overviewSheet.getRange(2, 1, output.length - 1, output[0].length);
  dataRange.setFontSize(10)
           .setVerticalAlignment("middle");
  
  // 3. Column Specific Formatting
  // Column A: Country
  overviewSheet.getRange(2, 1, output.length - 1, 1).setHorizontalAlignment("left");
  
  // Column B & C: Counts
  overviewSheet.getRange(2, 2, output.length - 1, 2).setHorizontalAlignment("center");
  
  // Column D & E: Currency
  overviewSheet.getRange(2, 4, output.length - 1, 2)
               .setNumberFormat("$#,##0")
               .setHorizontalAlignment("right");
  
  // 4. Alternating Rows (Zebra Striping)
  for (var i = 2; i <= output.length; i++) {
    if (i % 2 === 0) {
      overviewSheet.getRange(i, 1, 1, output[0].length).setBackground("#f8f9fa");
    } else {
      overviewSheet.getRange(i, 1, 1, output[0].length).setBackground("#ffffff");
    }
  }
  
  // 5. Borders
  overviewSheet.getRange(1, 1, output.length, output[0].length)
               .setBorder(true, true, true, true, true, true, "#e0e0e0", SpreadsheetApp.BorderStyle.SOLID);
  
  // 6. Auto-resize columns
  overviewSheet.autoResizeColumns(1, output[0].length);
  
  // Set row heights for data
  for (var i = 2; i <= output.length; i++) {
    overviewSheet.setRowHeight(i, 20);
  }
}

function parseRevenue(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  // Remove "USD ", commas, and spaces
  var cleanStr = str.toString().replace("USD ", "").replace(/,/g, "").trim();
  var val = parseFloat(cleanStr);
  return isNaN(val) ? 0 : val;
}
