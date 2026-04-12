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

function handleEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  var sheetName = sheet.getName();
  
  // 1. Handle Checkbox in GE_Overview
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
  
  // 2. Handle Status edit in DrillDown sheets
  if (sheetName.indexOf("DrillDown_") === 0) {
    var col = range.getColumn();
    var row = range.getRow();
    
    var isMCOEdit = (sheetName === "DrillDown_MCO");
    var targetStatusCol = isMCOEdit ? 6 : 5;
    var targetWorkNameCol = isMCOEdit ? 4 : 3;
    
    if (col === targetStatusCol && row > 1) {
      var statusVal = range.getValue();
      var workloadName = sheet.getRange(row, targetWorkNameCol).getValue();
      
      if (workloadName) {
        // A. Update central store
        updateStatus(workloadName, statusVal);
        
        // B. Sync to other visible DrillDown sheets without lag
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var sheets = ss.getSheets();
        
        for (var i = 0; i < sheets.length; i++) {
          var s = sheets[i];
          var name = s.getName();
          
          if (name.indexOf("DrillDown_") === 0 && name !== sheetName) {
            var data = s.getDataRange().getValues();
            var isMCOSheet = (name === "DrillDown_MCO");
            var workNameIdx = isMCOSheet ? 3 : 2;
            var statusIdx = isMCOSheet ? 5 : 4;
            
            for (var j = 1; j < data.length; j++) {
              if (data[j][workNameIdx] === workloadName) {
                s.getRange(j + 1, statusIdx + 1).setValue(statusVal);
                break; // Assume workload name is unique per sheet
              }
            }
          }
        }
      }
    }
  }
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
