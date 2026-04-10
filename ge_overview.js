function createOverview() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Target the specific sheet by name as requested
  var dataSheet = ss.getSheetByName("OHL - Workload Report LATAM");
  if (!dataSheet) {
    dataSheet = ss.getSheets()[0]; // Fallback to first sheet if name not found
    Logger.log("Sheet 'OHL - Workload Report LATAM' not found, using first sheet.");
  }
  
  var data = dataSheet.getDataRange().getValues();
  var headers = data[0];
  
  var countryIdx = headers.indexOf("Account: Billing Country");
  var revenueIdx = headers.indexOf("Workload Gross Annual Recurring Revenue (converted)");
  var partnerIdx = headers.indexOf("Partner");
  
  // Try to find the 'Aparently is GE' column, or fallback to 'Aparently is'
  var geIdx = headers.indexOf("Aparently is GE");
  if (geIdx === -1) {
    geIdx = headers.indexOf("Aparently is");
  }
  
  if (countryIdx === -1 || revenueIdx === -1 || partnerIdx === -1 || geIdx === -1) {
    Logger.log("Required headers not found. Found headers: " + JSON.stringify(headers));
    return;
  }
  
  // List of South American countries
  var southAmericanCountries = [
    "Argentina", "Bolivia", "Brazil", "Brasil", "Chile", "Colombia", "Ecuador", 
    "Guyana", "Paraguay", "Peru", "Suriname", "Uruguay", "Venezuela"
  ];
  
  var summary = {};
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var country = row[countryIdx];
    var revenueStr = row[revenueIdx];
    var partner = row[partnerIdx];
    var isGE = row[geIdx];
    
    if (!country) continue;
    
    // Filter 1: Only count rows where 'Aparently is GE' (or 'Aparently is') is not empty
    if (!isGE || isGE.toString().trim() === "") continue;
    
    // Filter 2: Only count South American countries
    if (southAmericanCountries.indexOf(country) === -1) continue;
    
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
  
  // Write data starting at Row 5
  var startRow = 5;
  overviewSheet.getRange(startRow, 1, output.length, output[0].length).setValues(output);
  
  // ---- Formatting ----
  
  // 1. Header Formatting (Row 5)
  var headerRange = overviewSheet.getRange(startRow, 1, 1, output[0].length);
  headerRange.setBackground("#1a73e8") // Google Blue
             .setFontColor("#ffffff")
             .setFontWeight("bold")
             .setHorizontalAlignment("center")
             .setVerticalAlignment("middle");
  overviewSheet.setRowHeight(startRow, 30);
  
  // 2. Data Formatting (Rows 6 and below)
  var dataRange = overviewSheet.getRange(startRow + 1, 1, output.length - 1, output[0].length);
  dataRange.setFontSize(10)
           .setVerticalAlignment("middle");
  
  // 3. Column Specific Formatting
  // Column A: Country
  overviewSheet.getRange(startRow + 1, 1, output.length - 1, 1).setHorizontalAlignment("left");
  
  // Column B & C: Counts
  overviewSheet.getRange(startRow + 1, 2, output.length - 1, 2).setHorizontalAlignment("center");
  
  // Column D & E: Currency
  overviewSheet.getRange(startRow + 1, 4, output.length - 1, 2)
               .setNumberFormat("$#,##0")
               .setHorizontalAlignment("right");
  
  // 4. Alternating Rows (Zebra Striping)
  for (var i = startRow + 1; i < startRow + output.length; i++) {
    if ((i - startRow) % 2 === 0) {
      overviewSheet.getRange(i, 1, 1, output[0].length).setBackground("#f8f9fa");
    } else {
      overviewSheet.getRange(i, 1, 1, output[0].length).setBackground("#ffffff");
    }
  }
  
  // 5. Borders
  overviewSheet.getRange(startRow, 1, output.length, output[0].length)
               .setBorder(true, true, true, true, true, true, "#e0e0e0", SpreadsheetApp.BorderStyle.SOLID);
  
  // 6. Auto-resize columns
  overviewSheet.autoResizeColumns(1, output[0].length);
  
  // Set row heights for data
  for (var i = startRow + 1; i < startRow + output.length; i++) {
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

// ---- Drill Down Feature ----

/**
 * Automatically triggers when a cell is selected.
 */
function onSelectionChange(e) {
  var range = e.range;
  var sheet = range.getSheet();
  
  // Only trigger in GE_Overview sheet
  if (sheet.getName() !== "GE_Overview") return;
  
  // Only trigger if clicking in Column A (Country) and below headers (Row 5 is header, so Row >= 6)
  if (range.getColumn() === 1 && range.getRow() >= 6) {
    var country = range.getValue();
    if (country) {
      showDrillDown(country);
    }
  }
}

/**
 * Generates a detailed sheet for the selected country.
 */
function showDrillDown(country) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dataSheet = ss.getSheetByName("OHL - Workload Report LATAM");
  if (!dataSheet) dataSheet = ss.getSheets()[0];
  
  var data = dataSheet.getDataRange().getValues();
  var headers = data[0];
  
  var countryIdx = headers.indexOf("Account: Billing Country");
  var revenueIdx = headers.indexOf("Workload Gross Annual Recurring Revenue (converted)");
  var partnerIdx = headers.indexOf("Partner");
  var geIdx = headers.indexOf("Aparently is GE");
  if (geIdx === -1) geIdx = headers.indexOf("Aparently is");
  var workloadIdx = headers.indexOf("Workload: Workload Name");
  
  if (countryIdx === -1 || revenueIdx === -1 || partnerIdx === -1 || geIdx === -1 || workloadIdx === -1) {
    SpreadsheetApp.getUi().alert("Required headers not found in data sheet.");
    return;
  }
  
  var output = [[
    "Partner",
    "Workload Name",
    "Gross Annual Recurring Revenue"
  ]];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowCountry = row[countryIdx];
    var isGE = row[geIdx];
    
    if (rowCountry === country && isGE && isGE.toString().trim() !== "") {
      var partner = row[partnerIdx] || "No Partner";
      var workload = row[workloadIdx] || "N/A";
      var revenue = parseRevenue(row[revenueIdx]);
      
      output.push([partner, workload, revenue]);
    }
  }
  
  if (output.length === 1) {
    SpreadsheetApp.getUi().alert("No workloads found for " + country + " with the current filters.");
    return;
  }
  
  // Create or get sheet
  var sheetName = "DrillDown_" + country;
  var drillSheet = ss.getSheetByName(sheetName);
  if (!drillSheet) {
    drillSheet = ss.insertSheet(sheetName);
  } else {
    drillSheet.clear();
  }
  
  // Write data
  drillSheet.getRange(1, 1, output.length, output[0].length).setValues(output);
  
  // Formatting
  var headerRange = drillSheet.getRange(1, 1, 1, output[0].length);
  headerRange.setBackground("#34a853") // Google Green for drill down
             .setFontColor("#ffffff")
             .setFontWeight("bold")
             .setHorizontalAlignment("center");
             
  drillSheet.getRange(2, 3, output.length - 1, 1)
            .setNumberFormat("$#,##0")
            .setHorizontalAlignment("right");
            
  drillSheet.autoResizeColumns(1, output[0].length);
  
  // Switch to the new sheet
  ss.setActiveSheet(drillSheet);
}
