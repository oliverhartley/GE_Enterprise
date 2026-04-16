function doGet(e) {
  var workload = e.parameter.workload;
  var status = e.parameter.status;
  
  if (!workload || !status) {
    var errorHtml = '<!DOCTYPE html><html><head><link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet"></head>' +
                    '<body class="bg-gray-100 flex items-center justify-center h-screen">' +
                    '<div class="bg-white p-8 rounded-lg shadow-md text-center max-w-sm">' +
                    '<div class="text-red-500 text-5xl mb-4">⚠️</div>' +
                    '<h1 class="text-xl font-bold mb-2">Missing Parameters</h1>' +
                    '<p class="text-gray-600">Workload or status parameters are missing.</p>' +
                    '</div></body></html>';
    return HtmlService.createHtmlOutput(errorHtml);
  }
  
  try {
    updateStatus(workload, status);
    
    var successHtml = '<!DOCTYPE html><html><head><link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet"></head>' +
                      '<body class="bg-gray-100 flex items-center justify-center h-screen">' +
                      '<div class="bg-white p-8 rounded-lg shadow-md text-center max-w-md">' +
                      '<div class="text-green-500 text-5xl mb-4">✅</div>' +
                      '<h1 class="text-2xl font-bold mb-2 text-green-600">Update Successful!</h1>' +
                      '<p class="text-gray-700 mb-4">The status for workload <span class="font-semibold">"' + workload + '"</span> has been updated to <span class="font-semibold text-blue-600">"' + status + '"</span>.</p>' +
                      '<p class="text-sm text-gray-500">You can close this tab now.</p>' +
                      '</div></body></html>';
    return HtmlService.createHtmlOutput(successHtml);
  } catch (err) {
    var failHtml = '<!DOCTYPE html><html><head><link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet"></head>' +
                   '<body class="bg-gray-100 flex items-center justify-center h-screen">' +
                   '<div class="bg-white p-8 rounded-lg shadow-md text-center max-w-sm">' +
                   '<div class="text-red-500 text-5xl mb-4">❌</div>' +
                   '<h1 class="text-xl font-bold mb-2 text-red-600">Update Failed</h1>' +
                   '<p class="text-gray-600">' + err.message + '</p>' +
                   '</div></body></html>';
    return HtmlService.createHtmlOutput(failHtml);
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
  
  var htmlBody = "<p style='font-family: Arial, sans-serif; font-size: 14px; color: #374151; margin-bottom: 12px;'>In order to help you push the partner to advance in their GE Workloads, please click on the <strong>Update status</strong>...</p>";
  htmlBody += "<p style='font-family: Arial, sans-serif; font-size: 14px; color: #374151; margin-bottom: 12px;'>If the current status is empty is because i don't have that data and the next time it will be there.</p>";
  htmlBody += "<p style='font-family: Arial, sans-serif; font-size: 14px; color: #374151; margin-bottom: 12px;'>This is \"like\" a web app, but its not... i need you to actualy <strong>CLICK</strong> in the corresponding Update status, You will feel nothing happend.... but it will update my follow up with the partner :)</p>";
  htmlBody += "<p style='font-family: Arial, sans-serif; font-size: 14px; color: #374151; margin-bottom: 16px;'>If nothing need to be updated, do nothing :)</p>";
  htmlBody += "<table style='border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; border: 1px solid #E5E7EB;'>";
  htmlBody += "<tr style='background-color: #F3F4F6; color: #1F2937; text-align: left;'>";
  htmlBody += "<th style='padding: 12px; border: 1px solid #E5E7EB;'>Partner</th>";
  htmlBody += "<th style='padding: 12px; border: 1px solid #E5E7EB;'>Account Name</th>";
  htmlBody += "<th style='padding: 12px; border: 1px solid #E5E7EB;'>Workload Name</th>";
  htmlBody += "<th style='padding: 12px; border: 1px solid #E5E7EB;'>Current Status</th>";
  htmlBody += "<th style='padding: 12px; border: 1px solid #E5E7EB;'>Update Status</th>";
  htmlBody += "</tr>";
  
  var webAppUrl = "https://script.google.com/a/macros/google.com/s/AKfycbyLJkqDhU_2zkyoNjxPABmimCFgir1TRxAl9_8C4JCGJF_lKkva6zPu2Rng-x__vdiC/exec";
  
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
      
      htmlBody += "<tr style='color: #4B5563;'>";
      htmlBody += "<td style='padding: 12px; border: 1px solid #E5E7EB;'>" + partner + "</td>";
      htmlBody += "<td style='padding: 12px; border: 1px solid #E5E7EB;'>" + accName + "</td>";
      htmlBody += "<td style='padding: 12px; border: 1px solid #E5E7EB;'>" + workload + "</td>";
      var statusColor = "#FFFFFF"; // Default white
      var statusTextColor = "#374151"; // Default text color
      
      if (currentStatus === 'On Track') {
        statusColor = "#D1FAE5"; // Light green
        statusTextColor = "#065F46"; // Dark green text
      } else if (currentStatus === 'Delayed by Customer') {
        statusColor = "#FEE2E2"; // Light red
        statusTextColor = "#991B1B"; // Dark red text
      } else if (currentStatus === 'Delayed by Partner') {
        statusColor = "#FEF3C7"; // Light yellow
        statusTextColor = "#92400E"; // Dark yellow/brown text
      } else if (currentStatus === 'Delayed by Google') {
        statusColor = "#DBEAFE"; // Light blue
        statusTextColor = "#1E3A8A"; // Dark blue text
      }
      
      htmlBody += "<td style='padding: 12px; border: 1px solid #E5E7EB; background-color: " + statusColor + "; color: " + statusTextColor + "; font-weight: bold;'>" + currentStatus + "</td>";
      htmlBody += "<td style='padding: 12px; border: 1px solid #E5E7EB;'>";
      
      var statuses = [
        { name: 'On Track', color: '#10B981', textColor: '#FFFFFF' },
        { name: 'Delayed by Customer', color: '#EF4444', textColor: '#FFFFFF' },
        { name: 'Delayed by Partner', color: '#F59E0B', textColor: '#FFFFFF' },
        { name: 'Delayed by Google', color: '#3B82F6', textColor: '#FFFFFF' }
      ];
      
      for (var j = 0; j < statuses.length; j++) {
        var s = statuses[j];
        var url = webAppUrl + "?workload=" + encodeURIComponent(workload) + "&status=" + encodeURIComponent(s.name);
        htmlBody += "<a href='" + url + "' style='display:inline-block; margin:2px; padding:6px 10px; background-color:" + s.color + "; text-decoration:none; color:" + s.textColor + "; border-radius:4px; font-size:12px; font-weight:bold;'>" + s.name + "</a> ";
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
