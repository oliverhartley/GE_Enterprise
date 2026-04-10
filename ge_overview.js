function createOverview() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Updated sheet name to "Gemini Workload DB"
  var dataSheet = ss.getSheetByName("Gemini Workload DB");
  if (!dataSheet) {
    dataSheet = ss.getSheets()[0]; // Fallback to first sheet if name not found
    Logger.log("Sheet 'Gemini Workload DB' not found, using first sheet.");
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
  
  // List of allowed countries (South America + Mexico)
  var allowedCountries = [
    "Argentina", "Bolivia", "Brazil", "Brasil", "Chile", "Colombia", "Ecuador", 
    "Guyana", "Mexico", "Paraguay", "Peru", "Suriname", "Uruguay", "Venezuela"
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
    
    // Filter 2: Only count allowed countries
    if (allowedCountries.indexOf(country) === -1) continue;
    
    var revenue = parseRevenue(revenueStr);
    
    if (!summary[country]) {
      summary[country] = {
        count: 0,
        partners: {},
        totalRevWithPartner: 0,
        countWithPartner: 0,
        totalRevNoPartner: 0,
        countNoPartner: 0
      };
    }
    
    summary[country].count++;
    
    var isNoPartner = !partner || partner.toString().trim() === "" || partner.toString().trim() === "No Partner";
    
    if (!isNoPartner) {
      summary[country].partners[partner] = true;
      summary[country].totalRevWithPartner += revenue;
      summary[country].countWithPartner++;
    } else {
      summary[country].totalRevNoPartner += revenue;
      summary[country].countNoPartner++;
    }
  }
  
  // Prepare output data with more readable headers
  var output = [[
    "Drill Down",
    "Country",
    "Total Workloads",
    "Total Partners",
    "Total Revenue (With Partner)",
    "Avg Revenue (With Partner)",
    "Total Revenue (No Partner)",
    "Avg Revenue (No Partner)"
  ]];
  
  // SORT BY COUNTRY
  var sortedCountries = Object.keys(summary).sort();
  
  for (var i = 0; i < sortedCountries.length; i++) {
    var country = sortedCountries[i];
    var s = summary[country];
    var partnerCount = Object.keys(s.partners).length;
    
    var avgWithPartner = s.countWithPartner > 0 ? s.totalRevWithPartner / s.countWithPartner : 0;
    var avgNoPartner = s.countNoPartner > 0 ? s.totalRevNoPartner / s.countNoPartner : 0;
    
    output.push([
      false, // Checkbox placeholder
      country,
      s.count, // Total workloads
      partnerCount,
      s.totalRevWithPartner,
      avgWithPartner,
      s.totalRevNoPartner,
      avgNoPartner
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
  
  // 1. Add Title in Row 1
  var titleRange = overviewSheet.getRange(1, 1, 1, output[0].length);
  titleRange.merge();
  titleRange.setValue("GE LATAM Performance Dashboard")
            .setFontSize(18)
            .setFontWeight("bold")
            .setHorizontalAlignment("center")
            .setVerticalAlignment("middle")
            .setFontColor("#1a73e8"); // Google Blue
  overviewSheet.setRowHeight(1, 40);
  
  // 2. Insert Checkboxes in Column A
  overviewSheet.getRange(startRow + 1, 1, output.length - 1, 1).insertCheckboxes();
  
  // 3. Header Formatting (Row 5)
  var headerRange = overviewSheet.getRange(startRow, 1, 1, output[0].length);
  headerRange.setBackground("#1a73e8") // Google Blue
             .setFontColor("#ffffff")
             .setFontWeight("bold")
             .setHorizontalAlignment("center")
             .setVerticalAlignment("middle");
  overviewSheet.setRowHeight(startRow, 30);
  
  // 4. Data Formatting (Rows 6 and below)
  var dataRange = overviewSheet.getRange(startRow + 1, 1, output.length - 1, output[0].length);
  dataRange.setFontSize(10)
           .setVerticalAlignment("middle");
  
  // 5. Column Specific Formatting
  // Column A: Checkbox
  overviewSheet.getRange(startRow + 1, 1, output.length - 1, 1).setHorizontalAlignment("center");
  // Column B: Country
  overviewSheet.getRange(startRow + 1, 2, output.length - 1, 1).setHorizontalAlignment("left");
  
  // Column C & D: Counts (Forcing normal number format with "0")
  overviewSheet.getRange(startRow + 1, 3, output.length - 1, 2)
               .setNumberFormat("0")
               .setHorizontalAlignment("center");
               
  // Columns E, F, G, H: Currency (4 columns starting at Col 5)
  overviewSheet.getRange(startRow + 1, 5, output.length - 1, 4)
               .setNumberFormat("$#,##0")
               .setHorizontalAlignment("right");
  
  // 6. Alternating Rows (Zebra Striping) - Darker grey for better contrast
  for (var i = startRow + 1; i < startRow + output.length; i++) {
    if ((i - startRow) % 2 === 0) {
      overviewSheet.getRange(i, 1, 1, output[0].length).setBackground("#e0e0e0");
    } else {
      overviewSheet.getRange(i, 1, 1, output[0].length).setBackground("#ffffff");
    }
  }
  
  // 7. Borders
  overviewSheet.getRange(startRow, 1, output.length, output[0].length)
               .setBorder(true, true, true, true, true, true, "#e0e0e0", SpreadsheetApp.BorderStyle.SOLID);
  
  // 8. Auto-resize columns
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

// ---- Checkbox Navigation Feature ----

/**
 * Automatically triggers when a cell is edited.
 */
function onEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  var sheetName = sheet.getName();
  var val = range.getValue();
  
  // Case 1: In GE_Overview, checking the drill down box in Column A
  if (sheetName === "GE_Overview") {
    if (range.getColumn() === 1 && range.getRow() >= 6 && val === true) {
      var country = sheet.getRange(range.getRow(), 2).getValue(); // Country is in Col 2
      if (country) {
        showDrillDown(country);
      }
      range.setValue(false); // Reset checkbox to unchecked
    }
  }
  
  // Case 2: In a DrillDown sheet, checking the back box in Cell A1
  if (sheetName.indexOf("DrillDown_") === 0) {
    if (range.getColumn() === 1 && range.getRow() === 1 && val === true) {
      goBackToOverview(sheet);
      range.setValue(false); // Reset checkbox to unchecked
    }
  }
}

/**
 * Generates a detailed sheet for the selected country.
 */
function showDrillDown(country) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Updated sheet name to "Gemini Workload DB"
  var dataSheet = ss.getSheetByName("Gemini Workload DB");
  if (!dataSheet) dataSheet = ss.getSheets()[0];
  
  var data = dataSheet.getDataRange().getValues();
  var headers = data[0];
  
  var countryIdx = headers.indexOf("Account: Billing Country");
  var revenueIdx = headers.indexOf("Workload Gross Annual Recurring Revenue (converted)");
  var partnerIdx = headers.indexOf("Partner");
  var geIdx = headers.indexOf("Aparently is GE");
  if (geIdx === -1) geIdx = headers.indexOf("Aparently is");
  var workloadIdx = headers.indexOf("Workload: Workload Name");
  
  // New Requested Indices
  var progressIdx = headers.indexOf("Workload Progress");
  var accNameIdx = headers.indexOf("Account: Account Name");
  var accOwnerIdx = headers.indexOf("Account: Account Owner");
  var ceOwnerIdx = headers.indexOf("Primary CE Technical Owner");
  
  if (countryIdx === -1 || revenueIdx === -1 || partnerIdx === -1 || geIdx === -1 || workloadIdx === -1) {
    SpreadsheetApp.getUi().alert("Required headers not found in data sheet.");
    return;
  }
  
  var rows = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowCountry = row[countryIdx];
    var isGE = row[geIdx];
    
    if (rowCountry === country && isGE && isGE.toString().trim() !== "") {
      var partner = row[partnerIdx] || "No Partner";
      var workload = row[workloadIdx] || "N/A";
      var revenue = parseRevenue(row[revenueIdx]);
      
      // Fallbacks for new fields
      var progress = progressIdx !== -1 ? row[progressIdx] : "N/A";
      var accName = accNameIdx !== -1 ? row[accNameIdx] : "N/A";
      var accOwner = accOwnerIdx !== -1 ? row[accOwnerIdx] : "N/A";
      var ceOwner = ceOwnerIdx !== -1 ? row[ceOwnerIdx] : "N/A";
      
      // NEW ORDER: Partner, Account Name, Workload Name, Workload Progress, Annual Revenue, Account Owner, Primary CE Owner
      rows.push([partner, accName, workload, progress, revenue, accOwner, ceOwner]);
    }
  }
  
  if (rows.length === 0) {
    SpreadsheetApp.getUi().alert("No workloads found for " + country + " with the current filters.");
    return;
  }
  
  // SORT BY PARTNER NAME (Column 1 in output), putting "No Partner" at the end
  rows.sort(function(a, b) {
    var nameA = a[0].toString();
    var nameB = b[0].toString();
    
    if (nameA === "No Partner" && nameB !== "No Partner") return 1;
    if (nameA !== "No Partner" && nameB === "No Partner") return -1;
    
    var lowerA = nameA.toLowerCase();
    var lowerB = nameB.toLowerCase();
    if (lowerA < lowerB) return -1;
    if (lowerA > lowerB) return 1;
    return 0;
  });
  
  // Headers in requested order
  var output = [[
    "Partner",
    "Account Name",
    "Workload Name",
    "Workload Progress",
    "Annual Revenue",
    "Account Owner",
    "Primary CE Owner"
  ]];
  
  output = output.concat(rows);
  
  // Create or get sheet
  var sheetName = "DrillDown_" + country;
  var drillSheet = ss.getSheetByName(sheetName);
  if (!drillSheet) {
    drillSheet = ss.insertSheet(sheetName);
  } else {
    drillSheet.showSheet(); // Unhide if hidden
    
    // Remove existing filter if any to prevent errors
    var existingFilter = drillSheet.getFilter();
    if (existingFilter) {
      existingFilter.remove();
    }
    
    drillSheet.clear();
  }
  
  // Set Back button (Checkbox in A1, Text in B1)
  drillSheet.getRange(1, 1).insertCheckboxes();
  drillSheet.getRange(1, 2).setValue("<- Check box to go back to GE_Overview")
             .setFontColor("#1a73e8")
             .setFontWeight("bold");
  
  // Write data starting at Row 3
  var startRow = 3;
  drillSheet.getRange(startRow, 1, output.length, output[0].length).setValues(output);
  
  // Formatting
  var headerRange = drillSheet.getRange(startRow, 1, 1, output[0].length);
  headerRange.setBackground("#34a853") // Google Green for drill down
             .setFontColor("#ffffff")
             .setFontWeight("bold")
             .setHorizontalAlignment("center");
             
  // Currency format for the 5th column (Annual Revenue)
  drillSheet.getRange(startRow + 1, 5, output.length - 1, 1)
            .setNumberFormat("$#,##0")
            .setHorizontalAlignment("right");
            
  // Set Column Width to 200 for all columns
  for (var col = 1; col <= output[0].length; col++) {
    drillSheet.setColumnWidth(col, 200);
  }
  
  // Enable Wrap for all data and headers
  drillSheet.getRange(startRow, 1, output.length, output[0].length).setWrap(true);
  
  // Alternating Rows (Zebra Striping) - Darker grey for better contrast
  for (var i = startRow + 1; i < startRow + output.length; i++) {
    if ((i - startRow) % 2 === 0) {
      drillSheet.getRange(i, 1, 1, output[0].length).setBackground("#e0e0e0");
    } else {
      drillSheet.getRange(i, 1, 1, output[0].length).setBackground("#ffffff");
    }
  }
  
  // Add Filter in Row 3
  drillSheet.getRange(startRow, 1, output.length, output[0].length).createFilter();
  
  // Switch to the new sheet
  ss.setActiveSheet(drillSheet);
}

/**
 * Automatically triggers when the spreadsheet is opened.
 * Makes sure GE_Overview is the active sheet.
 */
function onOpen() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var overview = ss.getSheetByName("GE_Overview");
  if (overview) {
    ss.setActiveSheet(overview);
  }
}

/**
 * Function to be called by a time-driven trigger to hide drill-down sheets.
 */
function hideDrillDownSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var name = sheet.getName();
    
    // Hide any sheet that starts with "DrillDown_"
    if (name.indexOf("DrillDown_") === 0) {
      sheet.hideSheet();
    }
  }
}

/**
 * Helper function to create the daily trigger at 1 AM.
 * Run this function ONCE from the editor to set it up.
 */
function createDailyTrigger() {
  // Delete existing triggers for this function to avoid duplicates
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'hideDrillDownSheets') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Create new trigger for 1 AM daily
  ScriptApp.newTrigger('hideDrillDownSheets')
      .timeBased()
      .everyDays(1)
      .atHour(1)
      .create();
      
  Logger.log("Trigger created for hideDrillDownSheets at 1 AM daily.");
}
