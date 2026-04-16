function doGet(e) {
  var workload = e.parameter.workload;
  var status = e.parameter.status;
  
  if (!workload || !status) {
    return HtmlService.createHtmlOutput("<b>Error:</b> Missing workload or status parameters.");
  }
  
  try {
    updateStatus(workload, status);
    return HtmlService.createHtmlOutput("<b>Success:</b> Status for workload '<b>" + workload + "</b>' updated to '<b>" + status + "</b>'.");
  } catch (err) {
    return HtmlService.createHtmlOutput("<b>Error:</b> Failed to update status: " + err.message);
  }
}

function sendTestStatusEmail() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("DrillDown_Mexico");
  if (!sheet) {
    Logger.log("Sheet DrillDown_Mexico not found.");
    return;
  }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0]; // Assuming headers are in Row 1 now
  
  var partnerCol = headers.indexOf("Partner");
  var accNameCol = headers.indexOf("Account Name");
  var workloadCol = headers.indexOf("Workload Name");
  var statusCol = headers.indexOf("Status");
  var accOwnerCol = headers.indexOf("Account Owner");
  
  if (workloadCol === -1 || accOwnerCol === -1) {
    Logger.log("Required headers not found in DrillDown_Mexico.");
    return;
  }
  
  var targetOwner = "Manuel Rivas";
  var targetEmail = "oliverhartley@google.com"; // User's email for testing
  
  var htmlBody = "<h3>Please update the status of your workloads:</h3>";
  htmlBody += "<table border='1' style='border-collapse: collapse; width: 100%;'>";
  htmlBody += "<tr><th>Partner</th><th>Account Name</th><th>Workload Name</th><th>Current Status</th><th>Update Status</th></tr>";
  
  var webAppUrl = "";
  try {
    webAppUrl = ScriptApp.getService().getUrl();
  } catch (e) {
    Logger.log("Could not get Web App URL: " + e.message);
  }
  
  if (!webAppUrl || webAppUrl === "") {
    webAppUrl = "https://script.google.com/a/macros/google.com/s/AKfycbyLJkqDhU_2zkyoNjxPABmimCFgir1TRxAl9_8C4JCGJF_lKkva6zPu2Rng-x__vdiC/exec"; // Placeholder
    Logger.log("Using placeholder Web App URL. Please replace it in the code after deployment.");
  }
  
  var found = false;
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var owner = row[accOwnerCol];
    
    if (owner === targetOwner) {
      found = true;
      var partner = partnerCol !== -1 ? row[partnerCol] : "";
      var accName = accNameCol !== -1 ? row[accNameCol] : "";
      var workload = row[workloadCol];
      var currentStatus = statusCol !== -1 ? row[statusCol] : "";
      
      htmlBody += "<tr>";
      htmlBody += "<td>" + partner + "</td>";
      htmlBody += "<td>" + accName + "</td>";
      htmlBody += "<td>" + workload + "</td>";
      htmlBody += "<td>" + currentStatus + "</td>";
      htmlBody += "<td>";
      
      var statuses = ['On Track', 'Delayed by Customer', 'Delayed by Partner', 'Delayed by Google'];
      for (var j = 0; j < statuses.length; j++) {
        var s = statuses[j];
        var url = webAppUrl + "?workload=" + encodeURIComponent(workload) + "&status=" + encodeURIComponent(s);
        htmlBody += "<a href='" + url + "' style='display:inline-block; margin:2px; padding:5px; background-color:#e0e0e0; text-decoration:none; color:black; border-radius:3px;'>" + s + "</a> ";
      }
      
      htmlBody += "</td>";
      htmlBody += "</tr>";
    }
  }
  
  htmlBody += "</table>";
  
  if (!found) {
    Logger.log("No workloads found for " + targetOwner);
    return;
  }
  
  MailApp.sendEmail({
    to: targetEmail,
    subject: "ACTION REQUIRED: Workload Status Update - Mexico",
    htmlBody: htmlBody
  });
  
  Logger.log("Test email sent to " + targetEmail);
}
