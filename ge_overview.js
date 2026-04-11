var ALLOWED_COUNTRIES = [
  "Argentina", "Bolivia", "Brazil", "Brasil", "Chile", "Colombia", "Ecuador", 
  "Guyana", "Mexico", "Paraguay", "Peru", "Suriname", "Uruguay", "Venezuela"
];

function createOverview() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Target the specific sheet by name
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
  var geIdx = headers.indexOf("Aparently is GE");
  if (geIdx === -1) geIdx = headers.indexOf("Aparently is");
  
  if (countryIdx === -1 || revenueIdx === -1 || partnerIdx === -1 || geIdx === -1) {
    Logger.log("Required headers not found.");
    return;
  }
  
  var summary = {};
  var mcoSummary = createEmptySummary();
  
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
    if (ALLOWED_COUNTRIES.indexOf(country) === -1) continue;
    
    var revenue = parseRevenue(revenueStr);
    
    // Map Brasil to Brazil for grouping
    var mappedCountry = country;
    if (country === "Brasil") mappedCountry = "Brazil";
    
    if (!summary[mappedCountry]) {
      summary[mappedCountry] = createEmptySummary();
    }
    
    var isNoPartner = !partner || partner.toString().trim() === "" || partner.toString().trim() === "No Partner";
    
    // Update individual country summary
    updateSummary(summary[mappedCountry], revenue, isNoPartner, partner);
    
    // Update MCO summary if not Brazil or Mexico
    if (mappedCountry !== "Brazil" && mappedCountry !== "Mexico") {
      updateSummary(mcoSummary, revenue, isNoPartner, partner);
    }
  }
  
  // Prepare output data
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
  
  // 1. Brazil
  var br = summary["Brazil"] || createEmptySummary();
  output.push(buildOutputRow("Brazil", br));
  
  // 2. Mexico
  var mx = summary["Mexico"] || createEmptySummary();
  output.push(buildOutputRow("Mexico", mx));
  
  // Spacer Row between Mexico and MCO
  output.push(["", "", "", "", "", "", "", ""]);
  
  // 3. MCO
  output.push(buildOutputRow("MCO", mcoSummary));
  
  // 4. Individual MCO countries (sorted)
  var mcoCountries = Object.keys(summary).filter(function(c) {
    return c !== "Brazil" && c !== "Mexico";
  }).sort();
  
  for (var i = 0; i < mcoCountries.length; i++) {
    var c = mcoCountries[i];
    output.push(buildOutputRow(c, summary[c]));
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
            .setFontColor("#1a73e8");
  overviewSheet.setRowHeight(1, 40);
  
  // 2. Insert Checkboxes in Column A
  overviewSheet.getRange(startRow + 1, 1, output.length - 1, 1).insertCheckboxes();
  
  // Remove checkbox from spacer row (Row 8)
  overviewSheet.getRange(startRow + 3, 1).clearDataValidations().setValue("");
  
  // 3. Header Formatting (Row 5)
  var headerRange = overviewSheet.getRange(startRow, 1, 1, output[0].length);
  headerRange.setBackground("#1a73e8")
             .setFontColor("#ffffff")
             .setFontWeight("bold")
             .setHorizontalAlignment("center")
             .setVerticalAlignment("middle");
  overviewSheet.setRowHeight(startRow, 30);
  
  // 4. Data Formatting
  var dataRange = overviewSheet.getRange(startRow + 1, 1, output.length - 1, output[0].length);
  dataRange.setFontSize(10)
           .setVerticalAlignment("middle");
  
  // 5. Column Specific Formatting
  overviewSheet.getRange(startRow + 1, 1, output.length - 1, 1).setHorizontalAlignment("center");
  overviewSheet.getRange(startRow + 1, 2, output.length - 1, 1).setHorizontalAlignment("left");
  overviewSheet.getRange(startRow + 1, 3, output.length - 1, 2).setNumberFormat("0").setHorizontalAlignment("center");
  overviewSheet.getRange(startRow + 1, 5, output.length - 1, 4).setNumberFormat("$#,##0").setHorizontalAlignment("right");
  
  // 6. Alternating Rows (Zebra Striping)
  for (var i = startRow + 1; i < startRow + output.length; i++) {
    if (i === startRow + 3) {
      overviewSheet.getRange(i, 1, 1, output[0].length).setBackground("#ffffff");
      continue;
    }
    if ((i - startRow) % 2 === 0) {
      overviewSheet.getRange(i, 1, 1, output[0].length).setBackground("#e0e0e0");
    } else {
      overviewSheet.getRange(i, 1, 1, output[0].length).setBackground("#ffffff");
    }
  }
  
  // Set row heights
  overviewSheet.setRowHeight(startRow + 3, 10);
  
  // Highlight MCO row for visual separation
  var mcoRowIdx = startRow + 4;
  overviewSheet.getRange(mcoRowIdx, 1, 1, output[0].length).setFontWeight("bold").setBackground("#d1e7dd");
  
  // 7. Borders
  overviewSheet.getRange(startRow, 1, output.length, output[0].length)
               .setBorder(true, true, true, true, true, true, "#e0e0e0", SpreadsheetApp.BorderStyle.SOLID);
  
  overviewSheet.getRange(startRow + 3, 1, 1, output[0].length).setBorder(false, false, false, false, false, false);
  
  // 8. Auto-resize columns
  overviewSheet.autoResizeColumns(1, output[0].length);
  
  for (var i = startRow + 1; i < startRow + output.length; i++) {
    if (i !== startRow + 3) {
      overviewSheet.setRowHeight(i, 20);
    }
  }
}

function createEmptySummary() {
  return {
    count: 0,
    partners: {},
    totalRevWithPartner: 0,
    countWithPartner: 0,
    totalRevNoPartner: 0,
    countNoPartner: 0
  };
}

function updateSummary(obj, revenue, isNoPartner, partner) {
  obj.count++;
  if (isNoPartner) {
    obj.totalRevNoPartner += revenue;
    obj.countNoPartner++;
  } else {
    obj.partners[partner] = true;
    obj.totalRevWithPartner += revenue;
    obj.countWithPartner++;
  }
}

function buildOutputRow(name, s) {
  var partnerCount = Object.keys(s.partners).length;
  var avgWithPartner = s.countWithPartner > 0 ? s.totalRevWithPartner / s.countWithPartner : 0;
  var avgNoPartner = s.countNoPartner > 0 ? s.totalRevNoPartner / s.countNoPartner : 0;
  
  return [
    false, // Checkbox
    name,
    s.count,
    partnerCount,
    s.totalRevWithPartner,
    avgWithPartner,
    s.totalRevNoPartner,
    avgNoPartner
  ];
}

function parseRevenue(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  var cleanStr = str.toString().replace("USD ", "").replace(/,/g, "").trim();
  var val = parseFloat(cleanStr);
  return isNaN(val) ? 0 : val;
}

// ---- Checkbox Navigation Feature ----
function handleEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  var sheetName = sheet.getName();
  
  if (sheetName === "GE_Overview") {
    var val = range.getValue();
    if (range.getColumn() === 1 && range.getRow() >= 6 && val === true) {
      var country = sheet.getRange(range.getRow(), 2).getValue();
      if (country) {
        showDrillDown(country);
      }
      range.setValue(false); // Reset checkbox
    }
  }
}

function showDrillDown(country) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
  
  var progressIdx = headers.indexOf("Workload Progress");
  var accNameIdx = headers.indexOf("Account: Account Name");
  var accOwnerIdx = headers.indexOf("Account: Account Owner");
  var ceOwnerIdx = headers.indexOf("Primary CE Technical Owner");
  
  if (countryIdx === -1 || revenueIdx === -1 || partnerIdx === -1 || geIdx === -1 || workloadIdx === -1) {
    SpreadsheetApp.getUi().alert("Required headers not found.");
    return;
  }
  
  var rows = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowCountry = row[countryIdx];
    var isGE = row[geIdx];
    
    var isAllowed = ALLOWED_COUNTRIES.indexOf(rowCountry) !== -1;
    var match = false;
    
    if (country === "MCO") {
      match = isAllowed && rowCountry !== "Brazil" && rowCountry !== "Brasil" && rowCountry !== "Mexico";
    } else {
      match = (rowCountry === country || (country === "Brazil" && rowCountry === "Brasil"));
    }
    
    if (match && isGE && isGE.toString().trim() !== "") {
      var partner = row[partnerIdx] || "No Partner";
      var workload = row[workloadIdx] || "N/A";
      var revenue = parseRevenue(row[revenueIdx]);
      
      var progress = progressIdx !== -1 ? row[progressIdx] : "N/A";
      var accName = accNameIdx !== -1 ? row[accNameIdx] : "N/A";
      var accOwner = accOwnerIdx !== -1 ? row[accOwnerIdx] : "N/A";
      var ceOwner = ceOwnerIdx !== -1 ? row[ceOwnerIdx] : "N/A";
      
      rows.push([partner, accName, workload, progress, revenue, accOwner, ceOwner]);
    }
  }
  
  if (rows.length === 0) {
    SpreadsheetApp.getUi().alert("No workloads found for " + country);
    return;
  }
  
  // Default sort by Partner (No Partner at end)
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
  
  var sheetName = "DrillDown_" + country;
  var drillSheet = ss.getSheetByName(sheetName);
  
  if (drillSheet) {
    ss.deleteSheet(drillSheet);
  }
  drillSheet = ss.insertSheet(sheetName);
  
  // Write data starting at Row 1
  var dataRange = drillSheet.getRange(1, 1, output.length, output[0].length);
  dataRange.setValues(output);
  
  // Try to use native Tables feature via Sheets API v4
  var tableCreated = false;
  try {
    var sheetId = drillSheet.getSheetId();
    var tableName = sheetName.replace(/[^a-zA-Z0-9]/g, "_");
    
    var resource = {
      requests: [
        {
          addTable: {
            table: {
              name: tableName,
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: output.length,
                startColumnIndex: 0,
                endColumnIndex: output[0].length
              }
            }
          }
        }
      ]
    };
    
    Sheets.Spreadsheets.batchUpdate(resource, ss.getId());
    tableCreated = true;
    Logger.log("Native table created via Sheets API for " + country + " with name " + tableName);
  } catch (e) {
    // RESTORE ALERT TO DEBUG!
    SpreadsheetApp.getUi().alert("Sheets API Error for " + country + ": " + e.message);
    Logger.log("Sheets API failed to create table, falling back to simulation: " + e.message);
  }
  
  // Apply Banding Theme based on country to change color!
  if (tableCreated) {
    try {
      var theme = getBandingThemeForCountry(country);
      
      var bandings = dataRange.getBandings();
      for (var i = 0; i < bandings.length; i++) {
        bandings[i].remove();
      }
      
      dataRange.applyRowBanding(theme);
      Logger.log("Applied banding theme for " + country);
    } catch (bandingError) {
      Logger.log("Failed to apply banding theme: " + bandingError.message);
    }
  }
  
  // Fallback to simulation if native table failed
  if (!tableCreated) {
    var headerColor = getColorForCountry(country);
    
    var headerRange = drillSheet.getRange(1, 1, 1, output[0].length);
    headerRange.setBackground(headerColor)
               .setFontColor("#ffffff")
               .setFontWeight("bold")
               .setHorizontalAlignment("center");
               
    // Alternating rows
    for (var i = 2; i <= output.length; i++) {
      if (i % 2 === 0) {
        drillSheet.getRange(i, 1, 1, output[0].length).setBackground("#f9f9f9");
      } else {
        drillSheet.getRange(i, 1, 1, output[0].length).setBackground("#ffffff");
      }
    }
    
    // Add filter
    drillSheet.getRange(1, 1, output.length, output[0].length).createFilter();
  }
  
  // Common formatting (currency, width, wrap)
  drillSheet.getRange(2, 5, output.length - 1, 1)
            .setNumberFormat("$#,##0")
            .setHorizontalAlignment("right");
            
  for (var col = 1; col <= output[0].length; col++) {
    drillSheet.setColumnWidth(col, 200);
  }
  
  drillSheet.getRange(1, 1, output.length, output[0].length).setWrap(true);
  
  ss.setActiveSheet(drillSheet);
}

function getBandingThemeForCountry(country) {
  var themes = [
    SpreadsheetApp.BandingTheme.LIGHT_GREEN,
    SpreadsheetApp.BandingTheme.LIGHT_BLUE,
    SpreadsheetApp.BandingTheme.INDIGO,
    SpreadsheetApp.BandingTheme.ORANGE,
    SpreadsheetApp.BandingTheme.PINK,
    SpreadsheetApp.BandingTheme.TEAL
  ];
  
  var hash = 0;
  for (var i = 0; i < country.length; i++) {
    hash = country.charCodeAt(i) + ((hash << 5) - hash);
  }
  var index = Math.abs(hash) % themes.length;
  return themes[index];
}

function getColorForCountry(country) {
  var colors = [
    "#34a853", // Green
    "#1a73e8", // Blue
    "#ea4335", // Red
    "#fbbc04", // Yellow
    "#673ab7", // Purple
    "#e91e63", // Pink
    "#00bcd4", // Cyan
    "#ff9800"  // Orange
  ];
  
  var hash = 0;
  for (var i = 0; i < country.length; i++) {
    hash = country.charCodeAt(i) + ((hash << 5) - hash);
  }
  var index = Math.abs(hash) % colors.length;
  return colors[index];
}

function onOpen() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var overview = ss.getSheetByName("GE_Overview");
  if (overview) {
    ss.setActiveSheet(overview);
  }
}

function hideDrillDownSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var name = sheet.getName();
    
    if (name.indexOf("DrillDown_") === 0) {
      sheet.hideSheet();
    }
  }
}

function createDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'hideDrillDownSheets') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  ScriptApp.newTrigger('hideDrillDownSheets')
      .timeBased()
      .everyDays(1)
      .atHour(1)
      .create();
      
  Logger.log("Trigger created for hideDrillDownSheets at 1 AM daily.");
}
