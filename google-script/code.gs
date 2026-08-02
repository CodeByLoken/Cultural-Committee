function doGet(e) {
  return handleRequest(e, "GET");
}

function doPost(e) {
  return handleRequest(e, "POST");
}

function handleRequest(e, method) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var receiptsSheet = ss.getSheetByName("Receipts") || ss.getActiveSheet();
    var expensesSheet = ss.getSheetByName("Expenses");
    if (!expensesSheet) {
      expensesSheet = ss.insertSheet("Expenses");
      expensesSheet.appendRow(["Timestamp", "Category/Header", "Date", "Summary", "Vendor", "Amount", "CreatedBy"]);
    }

    var payload = {};
    if (e && e.parameter) {
      for (var p in e.parameter) {
        payload[p] = e.parameter[p];
      }
    }
    if (e && e.postData && e.postData.contents) {
      try {
        var postObj = JSON.parse(e.postData.contents);
        for (var key in postObj) {
          payload[key] = postObj[key];
        }
      } catch (err) {}
    }

    var action = payload.action;

    // Action 1: Save Receipt Entry
    if (action === "saveEntry") {
      var lastRow = receiptsSheet.getLastRow();
      var receiptNo = "PGR-" + (1000 + lastRow);
      var todayDate = payload.today || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
      
      receiptsSheet.appendRow([
        new Date(),
        receiptNo,
        payload.name || '',
        payload.whatsapp || '',
        payload.flat || '',
        payload.amount || 0,
        payload.familyCount || 0,
        todayDate,
        payload.paymentMode || 'UPI',
        "", // Image URL placeholder
        "2026",
        payload.collectedBy || ''
      ]);
      
      return ContentService
        .createTextOutput(JSON.stringify({ "status": "success", "receiptNo": receiptNo }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Action 2: Save Image / PDF to Google Drive
    if (action === "saveImage") {
      var folderName = "Purvanchal_Receipts_2026";
      var folders = DriveApp.getFoldersByName(folderName);
      var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
      
      var base64Data = payload.imageBase64 || "";
      if (base64Data.indexOf(",") !== -1) {
        base64Data = base64Data.split(",")[1];
      }
      
      var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), "image/png", payload.receiptNo + "_" + payload.flat + ".png");
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      var imageUrl = file.getUrl();
      
      var data = receiptsSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][1] == payload.receiptNo) {
          receiptsSheet.getRange(i + 1, 10).setValue(imageUrl);
          break;
        }
      }
      
      return ContentService
        .createTextOutput(JSON.stringify({ "status": "success", "imageUrl": imageUrl }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Action 3: Save Expense Record
    if (action === "saveExpense") {
      var expDate = payload.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
      expensesSheet.appendRow([
        new Date(),
        payload.header || 'Common Expense',
        expDate,
        payload.summary || '',
        payload.vendor || '',
        Number(payload.amount) || 0,
        payload.createdBy || ''
      ]);

      return ContentService
        .createTextOutput(JSON.stringify({ "status": "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Action 4: Get Expenses List
    if (action === "getExpenses") {
      var expData = expensesSheet.getDataRange().getValues();
      var expensesList = [];
      for (var x = 1; x < expData.length; x++) {
        var rowX = expData[x];
        if (!rowX || rowX.length === 0 || !rowX[0]) continue;

        var formattedExpDate = rowX[2] ? rowX[2].toString() : '';
        if (rowX[2] && rowX[2] instanceof Date) {
          formattedExpDate = Utilities.formatDate(rowX[2], Session.getScriptTimeZone(), "dd/MM/yyyy");
        }

        expensesList.push({
          header: rowX[1] || 'Common Expense',
          date: formattedExpDate || '-',
          summary: rowX[3] || '',
          vendor: rowX[4] || '',
          amount: Number(rowX[5]) || 0,
          createdBy: rowX[6] || ''
        });
      }

      return ContentService
        .createTextOutput(JSON.stringify({ "status": "success", "expenses": expensesList }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Action 5: Search Flat Number
    var searchFlat = payload.flat ? payload.flat.toString().trim().toLowerCase() : null;
    var data = receiptsSheet.getDataRange().getValues();
    if (searchFlat && !action) {
      var results = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (!row || row.length === 0) continue;

        var flatNo = row[4] ? row[4].toString().trim().toLowerCase() : '';
        if (flatNo.indexOf(searchFlat) !== -1) {
          var formattedDate = row[7] ? row[7].toString() : '';
          if (row[0] && row[0] instanceof Date) {
            formattedDate = Utilities.formatDate(row[0], Session.getScriptTimeZone(), "dd/MM/yyyy");
          }
          
          results.push({
            date: formattedDate || '-',
            receiptNo: row[1] || '-',
            name: row[2] || '',
            whatsapp: row[3] || '',
            flat: row[4] || '',
            amount: row[5] || 0,
            familyCount: row[6] || 0,
            imageUrl: row[9] || '',
            collectedBy: row[11] || ''
          });
        }
      }
      return ContentService
        .createTextOutput(JSON.stringify({ "status": "success", "type": "search", "results": results }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Default: Return Dashboard Stats
    var totalAmount = 0, totalReceipts = 0, totalMembers = 0;
    for (var j = 1; j < data.length; j++) {
      var r = data[j];
      if (r && r[0]) {
        totalReceipts++;
        totalAmount += Number(r[5]) || 0;
        totalMembers += Number(r[6]) || 0;
      }
    }

    var totalExpenses = 0;
    var eData = expensesSheet.getDataRange().getValues();
    for (var y = 1; y < eData.length; y++) {
      if (eData[y] && eData[y][0]) {
        totalExpenses += Number(eData[y][5]) || 0;
      }
    }

    var usersList = [];
    var usersSheet = ss.getSheetByName("Users");
    if (usersSheet) {
      var usersData = usersSheet.getDataRange().getValues();
      for (var k = 1; k < usersData.length; k++) {
        var uName = usersData[k][0] ? usersData[k][0].toString().trim() : '';
        var uPin = usersData[k][1] !== undefined ? usersData[k][1].toString().trim() : '';
        var uRole = usersData[k][2] ? usersData[k][2].toString().trim().toLowerCase() : (uName.toLowerCase().indexOf('admin') !== -1 ? 'admin' : 'user');
        if (uName && uPin) {
          usersList.push({ name: uName, pin: uPin, role: uRole });
        }
      }
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({
        "status": "success",
        "type": "stats",
        "totalAmount": totalAmount,
        "totalReceipts": totalReceipts,
        "totalMembers": totalMembers,
        "totalExpenses": totalExpenses,
        "users": usersList
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
