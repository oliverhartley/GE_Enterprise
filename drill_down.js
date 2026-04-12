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
  
  var output = [];
  if (country === "MCO") {
    output.push([
      "Partner",
      "Country", // Added for MCO only
      "Account Name",
      "Workload Name",
      "Workload Progress",
      "Status",
      "Annual Revenue",
      "Account Owner",
      "Primary CE Owner"
    ]);
  } else {
    output.push([
      "Partner",
      "Account Name",
      "Workload Name",
      "Workload Progress",
      "Status",
      "Annual Revenue",
      "Account Owner",
      "Primary CE Owner"
    ]);
  }
  
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
    SpreadsheetApp.getUi().alert("Sheets API Error for " + country + ": " + e.message);
    Logger.log("Sheets API failed to create table, falling back to simulation: " + e.message);
  }
  
  // Color the header row directly, even for native tables!
  var headerColor = getColorForCountry(country);
  var headerRange = drillSheet.getRange(1, 1, 1, output[0].length);
  headerRange.setBackground(headerColor)
             .setFontColor("#ffffff")
             .setFontWeight("bold")
             .setHorizontalAlignment("center");
  
  // Add dropdown to Status column
  var statusCol = (country === "MCO") ? 6 : 5;
  var statusRange = drillSheet.getRange(2, statusCol, output.length - 1, 1);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['On Track', 'Delayed by Customer', 'Delayed by Partner', 'Delayed by Google'], true)
    .setAllowInvalid(true) // Allow custom text too
    .build();
  statusRange.setDataValidation(rule);
  
  // Add Conditional Formatting to Status column
  var ruleOnTrack = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("On Track")
    .setBackground("#d1e7dd") // Soft green
    .setRanges([statusRange])
    .build();
    
  var ruleDelayed = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains("Delayed")
    .setBackground("#fff3cd") // Soft yellow
    .setRanges([statusRange])
    .build();
    
  var rules = drillSheet.getConditionalFormatRules();
  rules.push(ruleOnTrack, ruleDelayed);
  drillSheet.setConditionalFormatRules(rules);
  
  // Fallback to simulation if native table failed
  if (!tableCreated) {
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
  var revenueCol = (country === "MCO") ? 7 : 6;
  drillSheet.getRange(2, revenueCol, output.length - 1, 1)
            .setNumberFormat("$#,##0")
            .setHorizontalAlignment("right");
            
  for (var col = 1; col <= output[0].length; col++) {
    drillSheet.setColumnWidth(col, 200);
  }
  
  drillSheet.getRange(1, 1, output.length, output[0].length).setWrap(true);
  
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
