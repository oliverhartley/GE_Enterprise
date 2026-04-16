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
  
  // Read preserved statuses from central store
  var preservedStatus = getStatusMap();
  
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
      
      // Use status from central store
      var status = preservedStatus[workload] || "";
      
      // For MCO, add Country between Partner and Account Name
      if (country === "MCO") {
        rows.push([partner, rowCountry, accName, workload, progress, status, revenue, accOwner, ceOwner]);
      } else {
        rows.push([partner, accName, workload, progress, status, revenue, accOwner, ceOwner]);
      }
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
  
  // 1. Aggregate Partner Data
  var partnerCounts = {};
  for (var i = 0; i < rows.length; i++) {
    var p = rows[i][0]; // Partner is always the first element
    partnerCounts[p] = (partnerCounts[p] || 0) + 1;
  }
  
  // 2. Prepare New Table Data (Partner Summary)
  var partnerSummaryOutput = [];
  partnerSummaryOutput.push(["Partner", "# Workloads"]); // Header row
  
  var partners = Object.keys(partnerCounts).sort(function(a, b) {
    if (a === "No Partner" && b !== "No Partner") return 1;
    if (a !== "No Partner" && b === "No Partner") return -1;
    
    var countA = partnerCounts[a];
    var countB = partnerCounts[b];
    
    if (countA !== countB) {
      return countB - countA; // Descending order of count
    }
    
    var lowerA = a.toLowerCase();
    var lowerB = b.toLowerCase();
    if (lowerA < lowerB) return -1;
    if (lowerA > lowerB) return 1;
    return 0;
  });
  for (var i = 0; i < partners.length; i++) {
    partnerSummaryOutput.push([partners[i], partnerCounts[partners[i]]]);
  }
  
  // 3. Prepare Main Table Data with Title Row
  var output = [];
  var mainTableHeaders = [];
  if (country === "MCO") {
    mainTableHeaders = [
      "Partner",
      "Country",
      "Account Name",
      "Workload Name",
      "Workload Progress",
      "Status",
      "Annual Revenue",
      "Account Owner",
      "Primary CE Owner"
    ];
  } else {
    mainTableHeaders = [
      "Partner",
      "Account Name",
      "Workload Name",
      "Workload Progress",
      "Status",
      "Annual Revenue",
      "Account Owner",
      "Primary CE Owner"
    ];
  }
  
  // Add Header Row
  output.push(mainTableHeaders);
  
  // Add Data Rows
  output = output.concat(rows);
  
  var sheetName = "DrillDown_" + country;
  var drillSheet = ss.getSheetByName(sheetName);
  
  if (drillSheet) {
    ss.deleteSheet(drillSheet);
  }
  drillSheet = ss.insertSheet(sheetName);
  
  // Write data starting at Row 1
  // Write partner summary table in Column A
  var partnerRange = drillSheet.getRange(1, 1, partnerSummaryOutput.length, partnerSummaryOutput[0].length);
  partnerRange.setValues(partnerSummaryOutput);
  
  // Write main table in Column D
  var dataRange = drillSheet.getRange(1, 4, output.length, output[0].length);
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
                startRowIndex: 0, // Start at headers (Row 1)
                endRowIndex: output.length,
                startColumnIndex: 3, // Column D
                endColumnIndex: 3 + output[0].length
              }
            }
          }
        },
        {
          addTable: {
            table: {
              name: tableName + "_summary",
              range: {
                sheetId: sheetId,
                startRowIndex: 0, // Start at headers (Row 1)
                endRowIndex: partnerSummaryOutput.length,
                startColumnIndex: 0, // Column A
                endColumnIndex: partnerSummaryOutput[0].length // 2 columns
              }
            }
          }
        }
      ]
    };
    
    Sheets.Spreadsheets.batchUpdate(resource, ss.getId());
    tableCreated = true;
    Logger.log("Native tables created via Sheets API for " + country);
  } catch (e) {
    SpreadsheetApp.getUi().alert("Sheets API Error for " + country + ": " + e.message);
    Logger.log("Sheets API failed to create table, falling back to simulation: " + e.message);
  }
  
  // Color the header rows and titles
  var headerColor = getColorForCountry(country);
  
  // Summary Table Formatting
  var sumHeaderRange = drillSheet.getRange(1, 1, 1, partnerSummaryOutput[0].length);
  sumHeaderRange.setBackground(headerColor)
                .setFontColor("#ffffff")
                .setFontWeight("bold")
                .setHorizontalAlignment("center");
                
  // Main Table Formatting
  var mainHeaderRange = drillSheet.getRange(1, 4, 1, output[0].length);
  mainHeaderRange.setBackground(headerColor)
                 .setFontColor("#ffffff")
                 .setFontWeight("bold")
                 .setHorizontalAlignment("center");
  
  // Add dropdown to Status column (Main Table)
  var statusCol = (country === "MCO") ? 6 : 5;
  var statusRange = drillSheet.getRange(2, statusCol + 3, output.length - 1, 1); // Data starts at row 2, Col D is offset 3
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['On Track', 'Delayed by Customer', 'Delayed by Partner', 'Delayed by Google'], true)
    .setAllowInvalid(true)
    .build();
  statusRange.setDataValidation(rule);
  
  // Add Conditional Formatting to Status column
  var ruleOnTrack = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("On Track")
    .setBackground("#d1e7dd")
    .setRanges([statusRange])
    .build();
    
  var ruleDelayed = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains("Delayed")
    .setBackground("#fff3cd")
    .setRanges([statusRange])
    .build();
    
  var rules = drillSheet.getConditionalFormatRules();
  rules.push(ruleOnTrack, ruleDelayed);
  drillSheet.setConditionalFormatRules(rules);
  
  // Fallback to simulation if native table failed
  if (!tableCreated) {
    // Alternating rows for Main Table
    for (var i = 2; i <= output.length; i++) {
      var r = drillSheet.getRange(i, 4, 1, output[0].length);
      if (i % 2 === 0) {
        r.setBackground("#f9f9f9");
      } else {
        r.setBackground("#ffffff");
      }
    }
    
    // Alternating rows for Summary Table
    for (var i = 2; i <= partnerSummaryOutput.length; i++) {
      var r = drillSheet.getRange(i, 1, 1, partnerSummaryOutput[0].length);
      if (i % 2 === 0) {
        r.setBackground("#f9f9f9");
      } else {
        r.setBackground("#ffffff");
      }
    }
    
    // Add filters (Manual if native failed)
    drillSheet.getRange(1, 1, partnerSummaryOutput.length, partnerSummaryOutput[0].length).createFilter();
    drillSheet.getRange(1, 4, output.length, output[0].length).createFilter();
  }
  
  // Common formatting (currency, width, wrap)
  var revenueCol = (country === "MCO") ? 7 : 6;
  drillSheet.getRange(2, revenueCol + 3, output.length - 1, 1)
            .setNumberFormat("$#,##0")
            .setHorizontalAlignment("right");
            
  // Set widths
  for (var col = 1; col <= 3 + output[0].length; col++) {
    if (col === 3) {
      drillSheet.setColumnWidth(col, 50); // Spacer column
    } else {
      drillSheet.setColumnWidth(col, 150);
    }
  }
  
  drillSheet.getRange(1, 1, Math.max(output.length, partnerSummaryOutput.length), 3 + output[0].length).setWrap(true);
  
  ss.setActiveSheet(drillSheet);
}

function getStatusMap() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var statusSheet = ss.getSheetByName("Workload_Statuses");
  if (!statusSheet) {
    statusSheet = ss.insertSheet("Workload_Statuses");
    statusSheet.appendRow(["Workload Name", "Status"]);
    statusSheet.getRange(1, 1, 1, 2).setFontWeight("bold");
    return {};
  }
  
  var data = statusSheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var workload = data[i][0];
    var status = data[i][1];
    if (workload) {
      map[workload] = status;
    }
  }
  return map;
}

function updateStatus(workloadName, status) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var statusSheet = ss.getSheetByName("Workload_Statuses");
  if (!statusSheet) {
    statusSheet = ss.insertSheet("Workload_Statuses");
    statusSheet.appendRow(["Workload Name", "Status"]);
    statusSheet.getRange(1, 1, 1, 2).setFontWeight("bold");
  }
  
  var data = statusSheet.getDataRange().getValues();
  var found = false;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === workloadName) {
      statusSheet.getRange(i + 1, 2).setValue(status);
      found = true;
      break;
    }
  }
  
  if (!found) {
    statusSheet.appendRow([workloadName, status]);
  }
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
