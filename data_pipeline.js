// ---- Data Pipeline Automation ----

function processVectorFile() {
  var srcFolderId = FOLDER_IDS.src;
  var dstFolderId = FOLDER_IDS.dst;
  
  var srcFolder = DriveApp.getFolderById(srcFolderId);
  var dstFolder = DriveApp.getFolderById(dstFolderId);
  
  var files = srcFolder.getFiles();
  var processedCount = 0;
  
  while (files.hasNext()) {
    var file = files.next();
    var mimeType = file.getMimeType();
    var data = [];
    
    if (mimeType === MimeType.GOOGLE_SHEETS) {
      var ss = SpreadsheetApp.open(file);
      var sheet = ss.getSheets()[0];
      data = sheet.getDataRange().getValues();
    } else if (mimeType === MimeType.CSV || file.getName().indexOf(".csv") !== -1) {
      var csvContent = file.getBlob().getDataAsString();
      data = Utilities.parseCsv(csvContent);
    } else {
      Logger.log("Unsupported file type: " + file.getName());
      continue;
    }
    
    if (data.length > 0) {
      // Add calculated columns at the end
      data = addCalculatedColumns(data);
      
      var mainSS = SpreadsheetApp.getActiveSpreadsheet();
      var dbSheet = mainSS.getSheetByName("Gemini Workload DB");
      var oldData = [];
      if (dbSheet) {
        oldData = dbSheet.getDataRange().getValues();
      }
      
      // Track detailed changes before overwriting
      trackChanges(oldData, data);
      
      // Update DB
      if (!dbSheet) {
        dbSheet = mainSS.insertSheet("Gemini Workload DB");
      }
      
      dbSheet.clear();
      dbSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
      
      // Log change summary
      logUpdate(file.getName(), data.length);
      
      // Move and Rename file
      file.moveTo(dstFolder);
      var dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm");
      file.setName("GE_Worloads_" + dateStr);
      
      processedCount++;
    }
  }
  
  if (processedCount > 0) {
    // Regenerate Overview since DB changed
    createOverview();
  }
}

function addCalculatedColumns(data) {
  if (data.length === 0) return data;
  
  var headers = data[0];
  
  var psfInvIdx = headers.indexOf("PSF Investment");
  var workloadIdx = headers.indexOf("Workload: Workload Name");
  var opportunityIdx = headers.indexOf("Opportunity");
  
  if (psfInvIdx === -1 || workloadIdx === -1 || opportunityIdx === -1) {
    Logger.log("Required headers for calculation not found. Skipping calculation.");
    return data;
  }
  
  var newHeaders = [
    "PSF Status",
    "PSF Type",
    "Tiene Gemini Enterprise en ell Workload",
    "Tiene Gemini Enterprise en la Oportunidad?",
    "Aparently is GE"
  ];
  
  var headersToAdd = [];
  for (var i = 0; i < newHeaders.length; i++) {
    if (headers.indexOf(newHeaders[i]) === -1) {
      headersToAdd.push(newHeaders[i]);
    }
  }
  
  if (headersToAdd.length === 0) {
    Logger.log("Calculated columns already exist.");
    return data;
  }
  
  data[0] = headers.concat(headersToAdd);
  
  var geRegex = /Enterprise|\bGE\b/i;
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var psfInv = row[psfInvIdx] || "";
    var workloadName = row[workloadIdx] || "";
    var opportunity = row[opportunityIdx] || "";
    
    // 1. PSF Status
    var psfStatus = "";
    if (psfInv !== "") {
      if (psfInv.indexOf("Approved") !== -1) {
        psfStatus = "Approved";
      } else if (psfInv.indexOf("Canceled") !== -1) {
        psfStatus = "Canceled";
      } else {
        psfStatus = "psf-request";
      }
    }
    
    // 2. PSF Type
    var psfType = "";
    var match = psfInv.match(/TYPE: ([^|]*)/); // Match up to pipe or end
    if (match) {
      psfType = match[1].trim();
    }
    
    // 3. Tiene Gemini Enterprise en ell Workload
    var hasGEInWorkload = geRegex.test(workloadName);
    
    // 4. Tiene Gemini Enterprise en la Oportunidad?
    var hasGEInOpp = geRegex.test(opportunity);
    
    // 5. Aparently is GE
    var isGE = hasGEInWorkload || hasGEInOpp;
    
    var valuesToAdd = [];
    if (headersToAdd.indexOf("PSF Status") !== -1) valuesToAdd.push(psfStatus);
    if (headersToAdd.indexOf("PSF Type") !== -1) valuesToAdd.push(psfType);
    if (headersToAdd.indexOf("Tiene Gemini Enterprise en ell Workload") !== -1) valuesToAdd.push(hasGEInWorkload);
    if (headersToAdd.indexOf("Tiene Gemini Enterprise en la Oportunidad?") !== -1) valuesToAdd.push(hasGEInOpp);
    if (headersToAdd.indexOf("Aparently is GE") !== -1) valuesToAdd.push(isGE ? "Gemini enterprise" : "");
    
    data[i] = row.concat(valuesToAdd);
  }
  
  return data;
}

function trackChanges(oldData, newData) {
  if (oldData.length === 0) return; // Nothing to compare if DB was empty
  
  var oldHeaders = oldData[0];
  var newHeaders = newData[0];
  
  var oldWorkloadIdx = oldHeaders.indexOf("Workload: Workload Name");
  var oldProgressIdx = oldHeaders.indexOf("Workload Progress");
  
  var newWorkloadIdx = newHeaders.indexOf("Workload: Workload Name");
  var newProgressIdx = newHeaders.indexOf("Workload Progress");
  
  if (oldWorkloadIdx === -1 || oldProgressIdx === -1 || newWorkloadIdx === -1 || newProgressIdx === -1) {
    Logger.log("Headers not found for change tracking.");
    return;
  }
  
  var oldMap = {};
  for (var i = 1; i < oldData.length; i++) {
    var name = oldData[i][oldWorkloadIdx];
    var prog = oldData[i][oldProgressIdx];
    if (name) oldMap[name] = prog;
  }
  
  var newMap = {};
  for (var i = 1; i < newData.length; i++) {
    var name = newData[i][newWorkloadIdx];
    var prog = newData[i][newProgressIdx];
    if (name) newMap[name] = prog;
  }
  
  var changes = [];
  var dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  
  // Check for Added and Updated
  for (var name in newMap) {
    var newProg = newMap[name];
    if (!oldMap.hasOwnProperty(name)) {
      changes.push([dateStr, "Added", name, "", newProg]);
    } else {
      var oldProg = oldMap[name];
      if (oldProg !== newProg) {
        changes.push([dateStr, "Progress Changed", name, oldProg, newProg]);
      }
    }
  }
  
  // Check for Removed
  for (var name in oldMap) {
    if (!newMap.hasOwnProperty(name)) {
      changes.push([dateStr, "Removed", name, oldMap[name], ""]);
    }
  }
  
  if (changes.length > 0) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var logSheet = ss.getSheetByName("Detailed_Changes_Log");
    if (!logSheet) {
      logSheet = ss.insertSheet("Detailed_Changes_Log");
      logSheet.appendRow(["Date", "Action", "Workload Name", "Old Progress", "New Progress"]);
      logSheet.getRange(1, 1, 1, 5).setFontWeight("bold");
    }
    
    logSheet.getRange(logSheet.getLastRow() + 1, 1, changes.length, 5).setValues(changes);
    
    // Format the log sheet
    logSheet.getRange(logSheet.getLastRow() - changes.length + 1, 1, changes.length, 5)
            .setVerticalAlignment("middle");
    logSheet.autoResizeColumns(1, 5);
  }
}

function logUpdate(fileName, rowCount) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName("Update_Log");
  if (!logSheet) {
    logSheet = ss.insertSheet("Update_Log");
    logSheet.appendRow(["Date", "File Processed", "Total Rows"]);
    logSheet.getRange(1, 1, 1, 3).setFontWeight("bold");
  }
  
  var dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  logSheet.appendRow([dateStr, fileName, rowCount]);
}

function createVectorTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'processVectorFile') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  ScriptApp.newTrigger('processVectorFile')
      .timeBased()
      .everyHours(12)
      .create();
      
  Logger.log("Trigger created for processVectorFile every 12 hours.");
}
