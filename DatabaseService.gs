/**
 * DatabaseService.gs
 * Tầng truy xuất dữ liệu Google Sheets Database
 * Tối ưu hiệu năng: Đọc/ghi theo mảng getValues()/setValues(), hỗ trợ LockService
 * Tuân thủ theo DATABASE.md Section 2, 45, 46, 50, 56, 58
 */

var DatabaseService = (function() {

  /**
   * Lấy Spreadsheet làm database.
   * Ưu tiên mở Spreadsheet đang gắn với script (Container-bound), 
   * hoặc mở theo ID cấu hình trong Script Properties (nếu triển khai dạng Standalone Script).
   */
  function getSpreadsheet() {
    try {
      const activeSs = SpreadsheetApp.getActiveSpreadsheet();
      if (activeSs) return activeSs;
    } catch (e) {
      // Standalone script
    }
    const propId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (propId) {
      return SpreadsheetApp.openById(propId);
    }
    if (CONFIG && CONFIG.SPREADSHEET_ID) {
      return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    }
    throw new Error('Chưa thiết lập Spreadsheet. Vui lòng chạy trong Spreadsheet hoặc cấu hình SPREADSHEET_ID trong Script Properties.');
  }

  /**
   * Lấy một Sheet cụ thể theo tên, ném lỗi nếu không tồn tại
   */
  function getSheet(sheetName) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('Không tìm thấy bảng: ' + sheetName + '. Vui lòng khởi tạo database.');
    }
    return sheet;
  }

  /**
   * Đọc tất cả các dòng dữ liệu trong Sheet thành mảng Objects dựa theo Headers ở dòng 1.
   * Tối ưu getValues() 1 lần duy nhất theo CLAUDE.md Section 46.
   * @param {string} sheetName - Tên sheet
   * @returns {Array<Object>} Mảng các object
   */
  function readAll(sheetName) {
    const sheet = getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow <= 1 || lastCol === 0) {
      return [];
    }

    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = data[0].map(h => String(h).trim());
    const results = [];

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      // Kiểm tra dòng trống
      const isEmpty = row.every(cell => cell === '' || cell === null);
      if (isEmpty) continue;

      const obj = { _rowIndex: r + 1 }; // Lưu lại số dòng trong sheet để tiện update
      for (let c = 0; c < headers.length; c++) {
        const header = headers[c];
        if (header) {
          let val = row[c];
          // Chuyển Date sang chuỗi format chuẩn nếu cần
          if (val instanceof Date) {
            val = formatDateTime(val);
          }
          obj[header] = val;
        }
      }
      results.push(obj);
    }
    return results;
  }

  /**
   * Thêm 1 dòng dữ liệu vào Sheet
   * @param {string} sheetName - Tên sheet
   * @param {Object} rowObject - Đối tượng dữ liệu theo đúng các trường header
   */
  function insertRow(sheetName, rowObject) {
    return insertRows(sheetName, [rowObject]);
  }

  /**
   * Thêm hàng loạt dòng dữ liệu vào Sheet với 1 lần gọi setValues()
   * @param {string} sheetName - Tên sheet
   * @param {Array<Object>} rowObjects - Mảng các đối tượng dữ liệu
   */
  function insertRows(sheetName, rowObjects) {
    if (!rowObjects || rowObjects.length === 0) return true;
    const sheet = getSheet(sheetName);
    const headers = SHEET_HEADERS[sheetName];
    if (!headers) {
      throw new Error('Chưa định nghĩa Headers cho bảng ' + sheetName);
    }

    const rowsToAppend = rowObjects.map(obj => {
      return headers.map(header => {
        const val = obj[header];
        return val === undefined || val === null ? '' : val;
      });
    });

    const startRow = sheet.getLastRow() + 1;
    const numRows = rowsToAppend.length;
    const numCols = headers.length;

    sheet.getRange(startRow, 1, numRows, numCols).setValues(rowsToAppend);
    SpreadsheetApp.flush();
    return true;
  }

  /**
   * Cập nhật 1 dòng trong Sheet dựa trên khóa chính (keyField)
   * @param {string} sheetName - Tên sheet
   * @param {string} keyField - Tên cột khóa chính (ví dụ: VehicleID, TicketNo, UserID, ...)
   * @param {*} keyValue - Giá trị khóa chính cần tìm
   * @param {Object} updateObject - Các trường cần cập nhật
   */
  function updateRow(sheetName, keyField, keyValue, updateObject) {
    const sheet = getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow <= 1) return false;

    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = data[0].map(h => String(h).trim());
    const keyColIdx = headers.indexOf(keyField);
    if (keyColIdx === -1) {
      throw new Error('Không tìm thấy cột khóa ' + keyField + ' trong bảng ' + sheetName);
    }

    let targetRowIdx = -1;
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][keyColIdx]).trim() === String(keyValue).trim()) {
        targetRowIdx = r;
        break;
      }
    }

    if (targetRowIdx === -1) {
      return false; // Không tìm thấy dòng
    }

    // Cập nhật các cột tương ứng trong mảng dòng
    for (const key in updateObject) {
      if (key === '_rowIndex') continue;
      const colIdx = headers.indexOf(key);
      if (colIdx !== -1) {
        data[targetRowIdx][colIdx] = updateObject[key];
      }
    }

    // Ghi lại dòng đã update
    sheet.getRange(targetRowIdx + 1, 1, 1, headers.length).setValues([data[targetRowIdx]]);
    SpreadsheetApp.flush();
    return true;
  }

  /**
   * Khối thực thi bảo vệ với LockService theo DATABASE.md Section 38, 58
   */
  function withLock(callback, timeoutMs) {
    const lock = LockService.getScriptLock();
    const timeout = timeoutMs || CONFIG.LOCK_TIMEOUT_MS || 15000;
    const hasLock = lock.tryLock(timeout);
    if (!hasLock) {
      throw new Error('Hệ thống đang bận xử lý giao dịch khác. Vui lòng thử lại sau giây lát.');
    }
    try {
      return callback();
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Khởi tạo Database hoàn chỉnh 10 Sheet theo DATABASE.md Section 2, 50, 51, 60
   * Tạo cấu trúc bảng, Headers, cấu hình giá mặc định, setting và tài khoản Admin ban đầu
   */
  function initializeDatabase() {
    return withLock(function() {
      const ss = getSpreadsheet();
      const existingSheets = ss.getSheets().map(s => s.getName());
      const sheetKeys = Object.keys(SHEETS);

      sheetKeys.forEach(key => {
        const sheetName = SHEETS[key];
        const headers = SHEET_HEADERS[sheetName];
        let sheet = ss.getSheetByName(sheetName);

        if (!sheet) {
          sheet = ss.insertSheet(sheetName);
        }

        // Nếu sheet chưa có header
        if (sheet.getLastRow() === 0 && headers && headers.length > 0) {
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
          sheet.getRange(1, 1, 1, headers.length)
               .setFontWeight('bold')
               .setBackground('#0f172a')
               .setFontColor('#ffffff');
          sheet.setFrozenRows(1);
        }
      });

      // 1. Khởi tạo Bảng giá mặc định (PRICE_CONFIG) nếu chưa có
      const priceSheet = ss.getSheetByName(SHEETS.PRICE_CONFIG);
      if (priceSheet && priceSheet.getLastRow() <= 1) {
        const defaultPrices = [
          {
            PriceID: 'PRICE-CONTAINER-DEFAULT',
            VehicleType: VEHICLE_TYPE.CONTAINER,
            MinWeightKg: '',
            MaxWeightKg: '',
            PricePerDay: 100000,
            EffectiveDate: '01/01/2026 00:00:00',
            Status: 'ACTIVE'
          },
          {
            PriceID: 'PRICE-TRUCK-LE7T-DEFAULT',
            VehicleType: VEHICLE_TYPE.TRUCK,
            MinWeightKg: 0,
            MaxWeightKg: 7000,
            PricePerDay: 70000,
            EffectiveDate: '01/01/2026 00:00:00',
            Status: 'ACTIVE'
          },
          {
            PriceID: 'PRICE-TRUCK-GT7T-DEFAULT',
            VehicleType: VEHICLE_TYPE.TRUCK,
            MinWeightKg: 7000.01,
            MaxWeightKg: '',
            PricePerDay: 100000,
            EffectiveDate: '01/01/2026 00:00:00',
            Status: 'ACTIVE'
          }
        ];
        insertRows(SHEETS.PRICE_CONFIG, defaultPrices);
      }

      // 2. Khởi tạo Cấu hình hệ thống (SETTINGS) nếu chưa có
      const settingsSheet = ss.getSheetByName(SHEETS.SETTINGS);
      if (settingsSheet && settingsSheet.getLastRow() <= 1) {
        const nowStr = formatDateTime(new Date());
        const defaultSettings = [
          { SettingKey: 'TIMEZONE', SettingValue: 'Asia/Ho_Chi_Minh', Description: 'Múi giờ hệ thống', UpdatedAt: nowStr, UpdatedBy: 'SYSTEM' },
          { SettingKey: 'TICKET_PREFIX', SettingValue: 'BAI', Description: 'Tiền tố mã vé Gate In', UpdatedAt: nowStr, UpdatedBy: 'SYSTEM' },
          { SettingKey: 'COMPANY_NAME', SettingValue: 'BÃI XE CẢNG HÀNG HÓA XUẤT NHẬP KHẨU', Description: 'Tên đơn vị quản lý bãi', UpdatedAt: nowStr, UpdatedBy: 'SYSTEM' },
          { SettingKey: 'TRUCK_WEIGHT_THRESHOLD_KG', SettingValue: '7000', Description: 'Ngưỡng khối lượng xe tải phân bậc phí (kg)', UpdatedAt: nowStr, UpdatedBy: 'SYSTEM' },
          { SettingKey: 'TICKET_FOOTER_NOTE', SettingValue: 'Vui lòng giữ phiếu để làm thủ tục ra bãi.', Description: 'Ghi chú chân phiếu', UpdatedAt: nowStr, UpdatedBy: 'SYSTEM' }
        ];
        insertRows(SHEETS.SETTINGS, defaultSettings);
      }

      // 3. Khởi tạo tài khoản ADMIN mặc định (USERS)
      const usersSheet = ss.getSheetByName(SHEETS.USERS);
      if (usersSheet && usersSheet.getLastRow() <= 1) {
        let adminEmail = 'admin@dtk.local';
        try {
          const userEmail = Session.getActiveUser().getEmail();
          if (userEmail) adminEmail = userEmail;
        } catch (e) {}

        const nowStr = formatDateTime(new Date());
        const defaultUsers = [
          {
            UserID: 'USR-ADMIN-001',
            Email: adminEmail,
            FullName: 'Quản Trị Viên Hệ Thống',
            Role: ROLES.ADMIN,
            Status: 'ACTIVE',
            CreatedAt: nowStr,
            UpdatedAt: nowStr
          },
          {
            UserID: 'USR-GATEIN-001',
            Email: 'gatein@dtk.local',
            FullName: 'Nhân Viên Cổng Vào',
            Role: ROLES.GATE_IN,
            Status: 'ACTIVE',
            CreatedAt: nowStr,
            UpdatedAt: nowStr
          },
          {
            UserID: 'USR-YARD-001',
            Email: 'yard@dtk.local',
            FullName: 'Nhân Viên Bãi GetIn/GetOut',
            Role: ROLES.YARD,
            Status: 'ACTIVE',
            CreatedAt: nowStr,
            UpdatedAt: nowStr
          },
          {
            UserID: 'USR-GATEOUT-001',
            Email: 'gateout@dtk.local',
            FullName: 'Nhân Viên Cổng Ra',
            Role: ROLES.GATE_OUT,
            Status: 'ACTIVE',
            CreatedAt: nowStr,
            UpdatedAt: nowStr
          }
        ];
        insertRows(SHEETS.USERS, defaultUsers);
      }

      // Xóa Sheet1 mặc định nếu có và không cần thiết
      const defaultSheet1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
      if (defaultSheet1 && ss.getSheets().length > 1) {
        try { ss.deleteSheet(defaultSheet1); } catch (e) {}
      }

      SpreadsheetApp.flush();
      return responseSuccess('Khởi tạo Database thành công với 10 Sheet và dữ liệu mặc định.');
    });
  }

  return {
    getSpreadsheet: getSpreadsheet,
    getSheet: getSheet,
    readAll: readAll,
    insertRow: insertRow,
    insertRows: insertRows,
    updateRow: updateRow,
    withLock: withLock,
    initializeDatabase: initializeDatabase
  };

})();
