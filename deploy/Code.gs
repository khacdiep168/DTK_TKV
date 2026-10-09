/**
 * DTK LOGISTICS - QUẢN LÝ BÃI XE HÀNG HÓA XUẤT NHẬP KHẨU
 * Backend Server-side cho Google Apps Script
 * Kết nối Google Spreadsheet ID: 1wZicF5pXnYOY8crfQo0nQISpD8n3XnnCUrg54TKN6MQ
 * Tự động tạo 10 Sheet & xử lý giao dịch đồng thời với LockService
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(CONFIG.APP_NAME || 'Quản Lý Bãi Xe Xuất Nhập Khẩu')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


/* ==========================================================================
   MODULE: Config.gs
   ========================================================================== */

/**
 * Config.gs
 * Định nghĩa hằng số hệ thống, tên Sheet, Enum trạng thái và cấu hình mặc định
 * Tuân thủ theo CLAUDE.md và DATABASE.md
 */

const CONFIG = {
  TIMEZONE: 'Asia/Ho_Chi_Minh',
  TICKET_PREFIX: 'BAI',
  DEFAULT_TRUCK_WEIGHT_THRESHOLD_KG: 7000,
  APP_NAME: 'DTK LOGISTICS',
  APP_SUBTITLE: 'QUẢN LÝ BÃI XE XUẤT NHẬP KHẨU',
  APP_LOGO: 'Logo/logo.png',
  VERSION: '1.1.0',
  LOCK_TIMEOUT_MS: 15000,
  SPREADSHEET_ID: '1wZicF5pXnYOY8crfQo0nQISpD8n3XnnCUrg54TKN6MQ'
};

// 10 Bảng chuẩn theo DATABASE.md Section 2 & 52
const SHEETS = {
  USERS: 'USERS',
  VEHICLE_REGISTER: 'VEHICLE_REGISTER',
  IMPORT_BATCH: 'IMPORT_BATCH',
  GATE_IN: 'GATE_IN',
  YARD: 'YARD',
  GATE_OUT: 'GATE_OUT',
  FEES: 'FEES',
  PRICE_CONFIG: 'PRICE_CONFIG',
  AUDIT_LOG: 'AUDIT_LOG',
  SETTINGS: 'SETTINGS'
};

// Trạng thái phương tiện theo DATABASE.md Section 9
const VEHICLE_STATUS = {
  REGISTERED: 'REGISTERED',
  WAITING_GATE_IN: 'WAITING_GATE_IN',
  IN_YARD: 'IN_YARD',
  READY_TO_EXIT: 'READY_TO_EXIT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

// Loại nghiệp vụ theo DATABASE.md Section 7
const CARGO_DIRECTION = {
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT'
};

// Loại phương tiện theo DATABASE.md Section 8
const VEHICLE_TYPE = {
  CONTAINER: 'CONTAINER',
  TRUCK: 'TRUCK'
};

// Phân quyền theo yêu cầu
const ROLES = {
  ADMIN: 'ADMIN',
  BAI: 'BAI',
  GATE_IN: 'GATE_IN',
  YARD: 'YARD',
  GATE_OUT: 'GATE_OUT'
};

// Danh sách các view/chức năng mà từng Role được phép truy cập
const ROLE_PERMISSIONS = {
  ADMIN: ['dashboard', 'gatein', 'yard', 'gateout', 'import', 'reports', 'settings'],
  GATE_IN: ['dashboard', 'gatein', 'import', 'reports'], // Cổng vào được import excel & cổng vào
  YARD: ['dashboard', 'yard'],                           // Get In thực hiện chức năng getin / bãi
  GATE_OUT: ['dashboard', 'gateout', 'reports'],         // Cổng ra thực hiện cổng ra & xem báo cáo
  BAI: ['dashboard', 'import', 'reports']
};

// Trạng thái Batch Import theo DATABASE.md Section 5
const BATCH_STATUS = {
  PREVIEW: 'PREVIEW',
  IMPORTED: 'IMPORTED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

// Trạng thái Gate In / Gate Out theo DATABASE.md Section 12 & 17
const OPERATION_STATUS = {
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

// Hành động Audit Log theo DATABASE.md Section 29
const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  IMPORT: 'IMPORT',
  GATE_IN: 'GATE_IN',
  PRINT_TICKET: 'PRINT_TICKET',
  READY_TO_EXIT: 'READY_TO_EXIT',
  GATE_OUT: 'GATE_OUT',
  CANCEL: 'CANCEL',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE'
};

// Cấu trúc tiêu đề cột (Columns Headers) cho từng Sheet chuẩn xác 100%
const SHEET_HEADERS = {
  USERS: ['UserID', 'Email', 'FullName', 'Role', 'Status', 'CreatedAt', 'UpdatedAt', 'Password'],
  IMPORT_BATCH: ['BatchID', 'FileName', 'Company', 'ImportTime', 'ImportBy', 'TotalRows', 'SuccessRows', 'ErrorRows', 'Status', 'Note'],
  VEHICLE_REGISTER: ['VehicleID', 'BatchID', 'CargoDirection', 'VehicleType', 'LicensePlate', 'ContainerNo', 'WeightKg', 'Company', 'DriverName', 'DriverPhone', 'RegistrationDate', 'Status', 'Note', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy'],
  GATE_IN: ['GateInID', 'VehicleID', 'TicketNo', 'GateInTime', 'GateInBy', 'Status', 'PrintedAt'],
  YARD: ['YardID', 'VehicleID', 'GateInID', 'InYardTime', 'ReadyToExitTime', 'ReadyToExitBy', 'Status'],
  GATE_OUT: ['GateOutID', 'VehicleID', 'TicketNo', 'GateOutTime', 'GateOutBy', 'Status'],
  FEES: ['FeeID', 'VehicleID', 'CargoDirection', 'VehicleType', 'WeightKg', 'GateInTime', 'GateOutTime', 'TotalHours', 'TotalMinutes', 'ChargeDays', 'UnitPrice', 'TotalAmount', 'CalculatedAt'],
  PRICE_CONFIG: ['PriceID', 'VehicleType', 'MinWeightKg', 'MaxWeightKg', 'PricePerDay', 'EffectiveDate', 'Status'],
  AUDIT_LOG: ['LogID', 'Timestamp', 'UserID', 'UserEmail', 'Action', 'Entity', 'EntityID', 'OldStatus', 'NewStatus', 'Description'],
  SETTINGS: ['SettingKey', 'SettingValue', 'Description', 'UpdatedAt', 'UpdatedBy']
};


/* ==========================================================================
   MODULE: Utils.gs
   ========================================================================== */

/**
 * Utils.gs
 * Các hàm tiện ích hỗ trợ: chuẩn hóa biển số, sinh ID, ngày tháng, Lock, phản hồi chuẩn
 */

/**
 * Chuẩn hóa biển số xe theo DATABASE.md Section 11 & CLAUDE.md Section 38
 * Loại bỏ khoảng trắng, dấu gạch nối, dấu chấm, chuyển chữ hoa
 * Ví dụ: "51c-123.45" -> "51C12345"
 */
function normalizeLicensePlate(plate) {
  if (!plate) return '';
  return String(plate)
    .trim()
    .toUpperCase()
    .replace(/[\s\-\.]/g, '');
}

/**
 * Chuẩn hóa số container (chữ hoa, bỏ khoảng trắng)
 */
function normalizeContainerNo(containerNo) {
  if (!containerNo) return '';
  return String(containerNo)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/**
 * Format ngày giờ theo múi giờ Asia/Ho_Chi_Minh: dd/MM/yyyy HH:mm:ss
 */
function formatDateTime(date) {
  if (!date) return '';
  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return Utilities.formatDate(d, CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
}

/**
 * Format chỉ ngày: dd/MM/yyyy
 */
function formatDate(date) {
  if (!date) return '';
  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return Utilities.formatDate(d, CONFIG.TIMEZONE, 'dd/MM/yyyy');
}

/**
 * Lấy đối tượng Date theo timezone hiện tại
 */
function getCurrentDateTime() {
  return new Date();
}

/**
 * Parse chuỗi ngày dạng dd/MM/yyyy hoặc ISO sang Date
 */
function parseDateTime(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  
  if (typeof dateStr === 'string' && dateStr.indexOf('/') > -1) {
    const parts = dateStr.trim().split(' ');
    const dateParts = parts[0].split('/');
    if (dateParts.length === 3) {
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const year = parseInt(dateParts[2], 10);
      let hours = 0, minutes = 0, seconds = 0;
      if (parts[1]) {
        const timeParts = parts[1].split(':');
        hours = parseInt(timeParts[0] || 0, 10);
        minutes = parseInt(timeParts[1] || 0, 10);
        seconds = parseInt(timeParts[2] || 0, 10);
      }
      return new Date(year, month, day, hours, minutes, seconds);
    }
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Sinh ID theo PREFIX + timestamp + random theo DATABASE.md Section 3.2
 * Ví dụ: VH-20261008-000125
 */
function generateId(prefix) {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyyMMdd');
  const randNum = Math.floor(100000 + Math.random() * 900000);
  return prefix + '-' + dateStr + '-' + randNum;
}

/**
 * Sinh Số vé Gate In theo chuẩn: BAI-YYYYMMDD-XXXXXX theo DATABASE.md Section 13
 */
function generateTicketNumber() {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyyMMdd');
  const randNum = Math.floor(100000 + Math.random() * 900000);
  return (CONFIG.TICKET_PREFIX || 'BAI') + '-' + dateStr + '-' + randNum;
}

/**
 * Sinh Batch ID: IMP-YYYYMMDD-XXXX
 */
function generateBatchId() {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyyMMdd');
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return 'IMP-' + dateStr + '-' + randNum;
}

/**
 * Chuẩn hóa phản hồi thành công
 */
function responseSuccess(message, data) {
  return {
    success: true,
    message: message || 'Thao tác thành công',
    data: data || null
  };
}

/**
 * Chuẩn hóa phản hồi lỗi theo DATABASE.md Section 53
 */
function responseError(message, code, data) {
  return {
    success: false,
    message: message || 'Có lỗi xảy ra',
    code: code || 'SYSTEM_ERROR',
    data: data || null
  };
}

/**
 * Tính thời gian lưu bãi (duration) giữa GateInTime và GateOutTime
 * Trả về: { totalMinutes, totalHours, formattedText }
 */
function calculateDurationDetails(inTime, outTime) {
  const dIn = (inTime instanceof Date) ? inTime : parseDateTime(inTime);
  const dOut = (outTime instanceof Date) ? outTime : parseDateTime(outTime);
  
  if (!dIn || !dOut) {
    return { totalMinutes: 0, totalHours: 0, formattedText: '0 giờ 0 phút' };
  }
  
  const diffMs = Math.max(0, dOut.getTime() - dIn.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const totalMinutes = Math.floor(diffSec / 60);
  const totalHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
  
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;
  
  let formattedText = '';
  if (days > 0) formattedText += days + ' ngày ';
  if (hours > 0 || days > 0) formattedText += hours + ' giờ ';
  formattedText += minutes + ' phút ' + seconds + ' giây';
  
  return {
    totalMinutes: totalMinutes,
    totalHours: totalHours,
    days: days,
    hours: hours,
    minutes: minutes,
    seconds: seconds,
    formattedText: formattedText.trim()
  };
}

/**
 * Tính số ngày tính phí (ChargeDays) theo DATABASE.md Section 24
 * ChargeDays = CEILING(TotalHours / 24), tối thiểu 1 ngày
 */
function calculateChargeDays(totalHours) {
  if (totalHours <= 0) return 1;
  const days = Math.ceil(totalHours / 24);
  return Math.max(1, days);
}

/**
 * Format số tiền VND
 */
function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '0 VNĐ';
  return Number(amount).toLocaleString('vi-VN') + ' VNĐ';
}


/* ==========================================================================
   MODULE: AuditService.gs
   ========================================================================== */

/**
 * AuditService.gs
 * Ghi nhận lịch sử thao tác hệ thống (Audit Log) theo DATABASE.md Section 28, 29, 33, 49
 * Đảm bảo mọi giao dịch truy vết được: Ai? Lúc nào? Làm gì? Đối tượng nào? Trạng thái trước/sau?
 */

var AuditService = (function() {

  /**
   * Ghi log thao tác vào Sheet AUDIT_LOG
   * @param {string} action - Hành động (LOGIN, IMPORT, GATE_IN, READY_TO_EXIT, GATE_OUT, ...)
   * @param {string} entity - Loại đối tượng (VEHICLE, BATCH, USER, CONFIG, ...)
   * @param {string} entityId - Mã định danh đối tượng
   * @param {string} oldStatus - Trạng thái cũ (nếu có)
   * @param {string} newStatus - Trạng thái mới (nếu có)
   * @param {string} description - Mô tả chi tiết hành động
   * @param {Object} [userInfo] - Thông tin người dùng (nếu có, không thì lấy từ AuthService)
   */
  function writeLog(action, entity, entityId, oldStatus, newStatus, description, userInfo) {
    try {
      const currentUser = userInfo || (typeof AuthService !== 'undefined' ? AuthService.getCurrentUser() : { id: 'SYSTEM', email: 'system@internal' });
      const now = new Date();
      const logRecord = {
        LogID: generateId('LOG'),
        Timestamp: formatDateTime(now),
        UserID: currentUser.id || currentUser.UserID || 'SYSTEM',
        UserEmail: currentUser.email || currentUser.Email || 'system@internal',
        Action: action || 'UNKNOWN',
        Entity: entity || 'SYSTEM',
        EntityID: entityId || '',
        OldStatus: oldStatus || '',
        NewStatus: newStatus || '',
        Description: description || ''
      };

      if (typeof DatabaseService !== 'undefined') {
        DatabaseService.insertRow(SHEETS.AUDIT_LOG, logRecord);
      }
      return logRecord;
    } catch (err) {
      console.error('Lỗi khi ghi Audit Log:', err);
      // Không để lỗi audit log làm sập transaction nghiệp vụ
      return null;
    }
  }

  /**
   * Lấy danh sách Audit Log (hỗ trợ phân trang và lọc)
   */
  function getLogs(limit, actionFilter, entityFilter) {
    if (typeof DatabaseService === 'undefined') return [];
    const allLogs = DatabaseService.readAll(SHEETS.AUDIT_LOG) || [];
    let filtered = allLogs;
    if (actionFilter) {
      filtered = filtered.filter(l => l.Action === actionFilter);
    }
    if (entityFilter) {
      filtered = filtered.filter(l => l.Entity === entityFilter);
    }
    // Sắp xếp mới nhất lên đầu
    filtered.sort((a, b) => {
      const ta = parseDateTime(a.Timestamp) || 0;
      const tb = parseDateTime(b.Timestamp) || 0;
      return tb - ta;
    });

    const max = limit || 100;
    return filtered.slice(0, max);
  }

  return {
    writeLog: writeLog,
    getLogs: getLogs
  };

})();


/* ==========================================================================
   MODULE: DatabaseService.gs
   ========================================================================== */

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
   * Tìm một dòng dữ liệu theo trường khóa
   * @param {string} sheetName - Tên sheet
   * @param {string} keyField - Tên cột khóa (ví dụ: SettingKey, UserID, ...)
   * @param {*} keyValue - Giá trị cần tìm
   * @returns {Object|null}
   */
  function findRow(sheetName, keyField, keyValue) {
    const all = readAll(sheetName);
    const searchVal = String(keyValue).trim();
    return all.find(r => String(r[keyField]).trim() === searchVal) || null;
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
          { SettingKey: 'COMPANY_NAME', SettingValue: 'DTK LOGISTICS', Description: 'Tên thương hiệu đơn vị', UpdatedAt: nowStr, UpdatedBy: 'SYSTEM' },
          { SettingKey: 'APP_SUBTITLE', SettingValue: 'QUẢN LÝ BÃI XE XUẤT NHẬP KHẨU', Description: 'Tiêu đề phụ hệ thống', UpdatedAt: nowStr, UpdatedBy: 'SYSTEM' },
          { SettingKey: 'APP_LOGO', SettingValue: 'Logo/logo.png', Description: 'Đường dẫn hoặc Data URL ảnh logo', UpdatedAt: nowStr, UpdatedBy: 'SYSTEM' },
          { SettingKey: 'TRUCK_WEIGHT_THRESHOLD_KG', SettingValue: '7000', Description: 'Ngưỡng khối lượng xe tải phân bậc phí (kg)', UpdatedAt: nowStr, UpdatedBy: 'SYSTEM' },
          { SettingKey: 'TICKET_FOOTER_NOTE', SettingValue: 'Vui lòng giữ phiếu để làm thủ tục ra bãi.', Description: 'Ghi chú chân phiếu', UpdatedAt: nowStr, UpdatedBy: 'SYSTEM' }
        ];
        insertRows(SHEETS.SETTINGS, defaultSettings);
      }

      // 3. Khởi tạo tài khoản người dùng mặc định (USERS)
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
            UpdatedAt: nowStr,
            Password: 'admin' // Mật khẩu mặc định: admin
          },
          {
            UserID: 'USR-GATEIN-001',
            Email: 'gatein@dtk.local',
            FullName: 'Nhân Viên Cổng Vào',
            Role: ROLES.GATE_IN,
            Status: 'ACTIVE',
            CreatedAt: nowStr,
            UpdatedAt: nowStr,
            Password: '123' // Mật khẩu mặc định: 123
          },
          {
            UserID: 'USR-YARD-001',
            Email: 'yard@dtk.local',
            FullName: 'Nhân Viên Bãi GetIn/GetOut',
            Role: ROLES.YARD,
            Status: 'ACTIVE',
            CreatedAt: nowStr,
            UpdatedAt: nowStr,
            Password: '123'
          },
          {
            UserID: 'USR-GATEOUT-001',
            Email: 'gateout@dtk.local',
            FullName: 'Nhân Viên Cổng Ra',
            Role: ROLES.GATE_OUT,
            Status: 'ACTIVE',
            CreatedAt: nowStr,
            UpdatedAt: nowStr,
            Password: '123'
          },
          {
            UserID: 'USR-BAI-001',
            Email: 'bai@dtk.local',
            FullName: 'Nhân Viên Khai Báo Bãi',
            Role: ROLES.BAI,
            Status: 'ACTIVE',
            CreatedAt: nowStr,
            UpdatedAt: nowStr,
            Password: '123'
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
    findRow: findRow,
    withLock: withLock,
    initializeDatabase: initializeDatabase
  };

})();


/* ==========================================================================
   MODULE: Auth.gs
   ========================================================================== */

/**
 * Auth.gs
 * Quản lý người dùng, phân quyền Role theo CLAUDE.md Section 34 & DATABASE.md Section 4, 54
 * Các Role: ADMIN, BAI, GATE_IN, YARD, GATE_OUT
 */

var AuthService = (function() {

  /**
   * Đăng nhập hệ thống bằng Email/UserID và Password
   */
  function login(identifier, password) {
    if (!identifier) {
      return responseError('Vui lòng nhập tài khoản hoặc email.', 'INVALID_DATA');
    }

    const allUsers = DatabaseService.readAll(SHEETS.USERS);
    const searchKey = String(identifier).trim().toLowerCase();
    
    const user = allUsers.find(u => 
      String(u.Email || '').toLowerCase() === searchKey || 
      String(u.UserID || '').toLowerCase() === searchKey
    );

    if (!user) {
      return responseError('Tài khoản không tồn tại trong hệ thống.', 'USER_NOT_FOUND');
    }

    if (user.Status === 'INACTIVE') {
      return responseError('Tài khoản này đã bị vô hiệu hóa. Vui lòng liên hệ Admin.', 'ACCOUNT_DISABLED');
    }

    // Kiểm tra mật khẩu (nếu trong DB chưa có password thì mật khẩu mặc định là 123 hoặc admin nếu role là ADMIN)
    const expectedPassword = user.Password ? String(user.Password) : (user.Role === ROLES.ADMIN ? 'admin' : '123');
    if (password !== undefined && String(password) !== expectedPassword) {
      return responseError('Mật khẩu không chính xác.', 'WRONG_PASSWORD');
    }

    const permissions = ROLE_PERMISSIONS[user.Role] || [];

    const sessionUser = {
      id: user.UserID,
      email: user.Email,
      name: user.FullName,
      role: user.Role,
      status: user.Status,
      permissions: permissions,
      isLoggedIn: true
    };

    AuditService.writeLog(
      AUDIT_ACTIONS.UPDATE, 
      'USER', 
      user.UserID, 
      '', 
      'LOGGED_IN', 
      'Người dùng đăng nhập thành công: ' + user.FullName + ' (' + user.Role + ')',
      sessionUser
    );

    return responseSuccess('Đăng nhập thành công', sessionUser);
  }

  /**
   * Lấy thông tin người dùng hiện tại đang đăng nhập.
   * Ưu tiên lấy từ Session Google Apps Script, kết hợp bảng USERS.
   */
  function getCurrentUser() {
    let email = '';
    try {
      email = Session.getActiveUser().getEmail();
    } catch (e) {}

    // Lấy danh sách users từ database
    let allUsers = [];
    try {
      allUsers = DatabaseService.readAll(SHEETS.USERS);
    } catch (e) {
      // Khi database chưa được init
    }

    if (email) {
      const found = allUsers.find(u => String(u.Email).toLowerCase() === email.toLowerCase());
      if (found) {
        if (found.Status === 'INACTIVE') {
          return {
            id: found.UserID,
            email: found.Email,
            name: found.FullName,
            role: 'INACTIVE',
            status: 'INACTIVE',
            permissions: [],
            isLoggedIn: false,
            message: 'Tài khoản của bạn đã bị vô hiệu hóa.'
          };
        }
        return {
          id: found.UserID,
          email: found.Email,
          name: found.FullName,
          role: found.Role,
          status: found.Status,
          permissions: ROLE_PERMISSIONS[found.Role] || [],
          isLoggedIn: true
        };
      }
    }

    // Nếu chạy chế độ nội bộ hoặc chưa gán email, lấy tài khoản ADMIN đầu tiên
    if (allUsers.length > 0) {
      const admin = allUsers.find(u => u.Role === ROLES.ADMIN) || allUsers[0];
      return {
        id: admin.UserID,
        email: admin.Email,
        name: admin.FullName,
        role: admin.Role,
        status: admin.Status,
        permissions: ROLE_PERMISSIONS[admin.Role] || [],
        isLoggedIn: true
      };
    }

    // Mặc định fallback khi khởi chạy lần đầu
    return {
      id: 'USR-ADMIN-001',
      email: email || 'admin@dtk.local',
      name: 'Quản Trị Viên',
      role: ROLES.ADMIN,
      status: 'ACTIVE',
      permissions: ROLE_PERMISSIONS[ROLES.ADMIN] || [],
      isLoggedIn: true
    };
  }

  /**
   * Kiểm tra quyền truy cập của người dùng theo Role
   * @param {Array<string>|string} allowedRoles - Danh sách role được phép
   */
  function requireRole(allowedRoles) {
    const user = getCurrentUser();
    if (!user || !user.isLoggedIn || user.status !== 'ACTIVE') {
      throw new Error('Bạn chưa đăng nhập hoặc tài khoản đã bị khóa.');
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    // ADMIN luôn có toàn quyền theo CLAUDE.md Section 34
    if (user.role === ROLES.ADMIN || roles.indexOf(user.role) !== -1) {
      return user;
    }

    throw new Error('Bạn không có quyền thực hiện thao tác này. Quyền yêu cầu: ' + roles.join(', '));
  }

  /**
   * Kiểm tra xem một role có được phép truy cập view/tính năng không
   */
  function hasPermission(role, viewId) {
    if (role === ROLES.ADMIN) return true;
    const allowedViews = ROLE_PERMISSIONS[role] || [];
    return allowedViews.indexOf(viewId) !== -1;
  }

  /**
   * Lấy danh sách tất cả người dùng (Dành cho Admin)
   */
  function getAllUsers() {
    requireRole([ROLES.ADMIN]);
    const users = DatabaseService.readAll(SHEETS.USERS);
    // Ẩn mật khẩu khi trả về danh sách
    return users.map(u => ({
      UserID: u.UserID,
      Email: u.Email,
      FullName: u.FullName,
      Role: u.Role,
      Status: u.Status,
      CreatedAt: u.CreatedAt,
      UpdatedAt: u.UpdatedAt,
      HasPassword: Boolean(u.Password)
    }));
  }

  /**
   * Thêm hoặc cập nhật người dùng (Dành cho Admin)
   */
  function saveUser(userData) {
    requireRole([ROLES.ADMIN]);
    if (!userData || !userData.Email || !userData.FullName || !userData.Role) {
      return responseError('Vui lòng điền đầy đủ Email, Họ tên và Quyền hạn.', 'INVALID_DATA');
    }

    const allUsers = DatabaseService.readAll(SHEETS.USERS);
    const existing = allUsers.find(u => String(u.Email).toLowerCase() === String(userData.Email).toLowerCase());

    const nowStr = formatDateTime(new Date());
    const currentUser = getCurrentUser();

    if (userData.UserID || existing) {
      const targetId = userData.UserID || existing.UserID;
      const updatePayload = {
        FullName: userData.FullName,
        Role: userData.Role,
        Status: userData.Status || 'ACTIVE',
        UpdatedAt: nowStr
      };
      if (userData.Password && String(userData.Password).trim()) {
        updatePayload.Password = String(userData.Password).trim();
      }
      DatabaseService.updateRow(SHEETS.USERS, 'UserID', targetId, updatePayload);
      AuditService.writeLog(AUDIT_ACTIONS.UPDATE, 'USER', targetId, '', '', 'Cập nhật tài khoản: ' + userData.Email, currentUser);
      return responseSuccess('Cập nhật tài khoản thành công.');
    } else {
      const newUserId = generateId('USR');
      const newUser = {
        UserID: newUserId,
        Email: String(userData.Email).trim().toLowerCase(),
        FullName: userData.FullName,
        Role: userData.Role,
        Status: userData.Status || 'ACTIVE',
        CreatedAt: nowStr,
        UpdatedAt: nowStr,
        Password: userData.Password ? String(userData.Password).trim() : '123'
      };
      DatabaseService.insertRow(SHEETS.USERS, newUser);
      AuditService.writeLog(AUDIT_ACTIONS.UPDATE, 'USER', newUserId, '', '', 'Tạo mới tài khoản: ' + userData.Email, currentUser);
      return responseSuccess('Tạo tài khoản mới thành công.');
    }
  }

  /**
   * Bật/tắt trạng thái người dùng
   */
  function toggleUserStatus(userId) {
    requireRole([ROLES.ADMIN]);
    const allUsers = DatabaseService.readAll(SHEETS.USERS);
    const user = allUsers.find(u => u.UserID === userId);
    if (!user) {
      return responseError('Không tìm thấy người dùng.', 'NOT_FOUND');
    }

    const newStatus = user.Status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    DatabaseService.updateRow(SHEETS.USERS, 'UserID', userId, {
      Status: newStatus,
      UpdatedAt: formatDateTime(new Date())
    });

    AuditService.writeLog(AUDIT_ACTIONS.UPDATE, 'USER', userId, user.Status, newStatus, 'Chuyển trạng thái người dùng thành ' + newStatus);
    return responseSuccess('Cập nhật trạng thái thành ' + newStatus);
  }

  return {
    login: login,
    getCurrentUser: getCurrentUser,
    requireRole: requireRole,
    hasPermission: hasPermission,
    getAllUsers: getAllUsers,
    saveUser: saveUser,
    toggleUserStatus: toggleUserStatus
  };

})();


/* ==========================================================================
   MODULE: FeeService.gs
   ========================================================================== */

/**
 * FeeService.gs
 * Tính thời gian lưu bãi và tự động tính phí dựa trên PRICE_CONFIG
 * Tuân thủ theo CLAUDE.md Section 20-23 & DATABASE.md Section 20-27, 45, 46, 51
 */

var FeeService = (function() {

  /**
   * Lấy cấu hình giá phù hợp nhất từ bảng PRICE_CONFIG theo DATABASE.md Section 46
   * @param {string} vehicleType - CONTAINER hoặc TRUCK
   * @param {number} weightKg - Khối lượng kg (nếu là xe tải)
   * @param {Date|string} effectiveAt - Thời điểm tính (GateOutTime)
   */
  function getPriceConfig(vehicleType, weightKg, effectiveAt) {
    const prices = DatabaseService.readAll(SHEETS.PRICE_CONFIG) || [];
    const checkDate = (effectiveAt instanceof Date) ? effectiveAt : (parseDateTime(effectiveAt) || new Date());
    
    // Lọc các bản ghi ACTIVE và cùng loại xe
    const candidates = prices.filter(p => {
      if (p.Status !== 'ACTIVE') return false;
      if (p.VehicleType !== vehicleType) return false;
      
      const effDate = parseDateTime(p.EffectiveDate);
      if (effDate && effDate.getTime() > checkDate.getTime()) {
        return false; // Chưa có hiệu lực tại thời điểm này
      }

      // Nếu là TRUCK, kiểm tra điều kiện tải trọng
      if (vehicleType === VEHICLE_TYPE.TRUCK) {
        const w = Number(weightKg) || 0;
        const minW = (p.MinWeightKg !== '' && p.MinWeightKg !== null) ? Number(p.MinWeightKg) : null;
        const maxW = (p.MaxWeightKg !== '' && p.MaxWeightKg !== null) ? Number(p.MaxWeightKg) : null;

        if (minW !== null && w < minW) return false;
        if (maxW !== null && w > maxW) return false;
      }

      return true;
    });

    if (candidates.length === 0) {
      // Fallback theo chuẩn DATABASE.md Section 26 nếu cấu hình trống
      if (vehicleType === VEHICLE_TYPE.CONTAINER) {
        return { PricePerDay: 100000, PriceID: 'FALLBACK-CONTAINER' };
      } else {
        const w = Number(weightKg) || 0;
        return {
          PricePerDay: (w <= (CONFIG.DEFAULT_TRUCK_WEIGHT_THRESHOLD_KG || 7000)) ? 70000 : 100000,
          PriceID: 'FALLBACK-TRUCK'
        };
      }
    }

    // Chọn bản ghi có EffectiveDate mới nhất
    candidates.sort((a, b) => {
      const da = parseDateTime(a.EffectiveDate) || 0;
      const db = parseDateTime(b.EffectiveDate) || 0;
      return db - da;
    });

    return candidates[0];
  }

  /**
   * Tính toán toàn bộ thông tin chi phí lưu bãi cho phương tiện
   * @param {Object} vehicle - Thông tin phương tiện từ VEHICLE_REGISTER
   * @param {Date|string} gateInTime - Thời điểm vào bãi
   * @param {Date|string} gateOutTime - Thời điểm ra bãi
   * @returns {Object} Chi tiết tính phí
   */
  function calculateFee(vehicle, gateInTime, gateOutTime) {
    const duration = calculateDurationDetails(gateInTime, gateOutTime);
    const chargeDays = calculateChargeDays(duration.totalHours);

    const priceConfig = getPriceConfig(vehicle.VehicleType, vehicle.WeightKg, gateOutTime);
    if (!priceConfig || !priceConfig.PricePerDay) {
      throw new Error('Không tìm thấy bảng giá áp dụng cho xe ' + vehicle.VehicleType + ' (Trọng lượng: ' + vehicle.WeightKg + ' kg).');
    }

    const unitPrice = Number(priceConfig.PricePerDay);
    const totalAmount = chargeDays * unitPrice;

    return {
      duration: duration,
      chargeDays: chargeDays,
      unitPrice: unitPrice,
      totalAmount: totalAmount,
      priceId: priceConfig.PriceID || '',
      formattedDuration: duration.formattedText,
      formattedUnitPrice: formatCurrency(unitPrice),
      formattedTotalAmount: formatCurrency(totalAmount)
    };
  }

  /**
   * Lưu bản ghi tính phí vào Sheet FEES
   */
  function recordFee(vehicle, gateInTime, gateOutTime, feeDetails) {
    const feeRecord = {
      FeeID: generateId('FEE'),
      VehicleID: vehicle.VehicleID,
      CargoDirection: vehicle.CargoDirection,
      VehicleType: vehicle.VehicleType,
      WeightKg: vehicle.WeightKg || '',
      GateInTime: formatDateTime(gateInTime),
      GateOutTime: formatDateTime(gateOutTime),
      TotalHours: feeDetails.duration.totalHours,
      TotalMinutes: feeDetails.duration.totalMinutes,
      ChargeDays: feeDetails.chargeDays,
      UnitPrice: feeDetails.unitPrice,
      TotalAmount: feeDetails.totalAmount,
      CalculatedAt: formatDateTime(new Date())
    };

    DatabaseService.insertRow(SHEETS.FEES, feeRecord);
    return feeRecord;
  }

  /**
   * Lấy danh sách bảng giá cấu hình hiện tại (dành cho Admin)
   */
  function getAllPriceConfigs() {
    return DatabaseService.readAll(SHEETS.PRICE_CONFIG);
  }

  /**
   * Cập nhật hoặc thêm mới bảng giá
   */
  function savePriceConfig(data) {
    AuthService.requireRole([ROLES.ADMIN]);
    if (!data.VehicleType || !data.PricePerDay) {
      return responseError('Thiếu loại xe hoặc đơn giá.', 'INVALID_DATA');
    }

    if (data.PriceID) {
      DatabaseService.updateRow(SHEETS.PRICE_CONFIG, 'PriceID', data.PriceID, {
        VehicleType: data.VehicleType,
        MinWeightKg: data.MinWeightKg !== undefined ? data.MinWeightKg : '',
        MaxWeightKg: data.MaxWeightKg !== undefined ? data.MaxWeightKg : '',
        PricePerDay: Number(data.PricePerDay),
        EffectiveDate: data.EffectiveDate ? formatDateTime(data.EffectiveDate) : formatDateTime(new Date()),
        Status: data.Status || 'ACTIVE'
      });
      AuditService.writeLog(AUDIT_ACTIONS.UPDATE, 'PRICE_CONFIG', data.PriceID, '', '', 'Cập nhật bảng giá cho ' + data.VehicleType);
      return responseSuccess('Cập nhật bảng giá thành công.');
    } else {
      const newId = generateId('PRC');
      DatabaseService.insertRow(SHEETS.PRICE_CONFIG, {
        PriceID: newId,
        VehicleType: data.VehicleType,
        MinWeightKg: data.MinWeightKg !== undefined ? data.MinWeightKg : '',
        MaxWeightKg: data.MaxWeightKg !== undefined ? data.MaxWeightKg : '',
        PricePerDay: Number(data.PricePerDay),
        EffectiveDate: data.EffectiveDate ? formatDateTime(data.EffectiveDate) : formatDateTime(new Date()),
        Status: data.Status || 'ACTIVE'
      });
      AuditService.writeLog(AUDIT_ACTIONS.UPDATE, 'PRICE_CONFIG', newId, '', '', 'Tạo bảng giá mới cho ' + data.VehicleType);
      return responseSuccess('Tạo cấu hình giá mới thành công.');
    }
  }

  return {
    getPriceConfig: getPriceConfig,
    calculateFee: calculateFee,
    recordFee: recordFee,
    getAllPriceConfigs: getAllPriceConfigs,
    savePriceConfig: savePriceConfig
  };

})();


/* ==========================================================================
   MODULE: ImportService.gs
   ========================================================================== */

/**
 * ImportService.gs
 * Quy trình Import danh sách xe từ Excel: Validate -> Preview -> Commit Batch
 * Tuân thủ theo CLAUDE.md Section 6-9 & DATABASE.md Section 5, 33-36
 */

var ImportService = (function() {

  /**
   * Kiểm tra và kiểm định (Validate) dữ liệu import trước khi ghi vào Database
   * @param {Array<Object>} rawRows - Danh sách dòng đọc từ file Excel
   * @param {string} fileName - Tên file tải lên
   * @param {string} company - Đơn vị vận tải / Nhà xe
   */
  function validateAndPreview(rawRows, fileName, company) {
    AuthService.requireRole([ROLES.ADMIN, ROLES.BAI]);

    if (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0) {
      return responseError('File không có dữ liệu hoặc định dạng không hợp lệ.', 'EMPTY_DATA');
    }

    const errors = [];
    const validRows = [];
    const seenPlates = new Set();
    const seenContainers = new Set();

    const currentUser = AuthService.getCurrentUser();
    const batchId = generateBatchId();
    const nowStr = formatDateTime(new Date());

    rawRows.forEach((row, index) => {
      const rowNum = index + 2; // Dòng 1 là Header trong file Excel
      const rowErrors = [];

      // 1. Biển số xe
      const rawPlate = row.LicensePlate || row['Biển số xe'] || row['BienSo'] || '';
      const normPlate = normalizeLicensePlate(rawPlate);
      if (!normPlate) {
        rowErrors.push({ column: 'LicensePlate', value: rawPlate, message: 'Biển số xe không được để trống.' });
      } else {
        if (seenPlates.has(normPlate)) {
          rowErrors.push({ column: 'LicensePlate', value: rawPlate, message: 'Biển số xe bị trùng trong cùng đợt import (Batch).' });
        } else {
          seenPlates.add(normPlate);
        }
      }

      // 2. Chiều nghiệp vụ (CargoDirection: IMPORT / EXPORT)
      let dir = String(row.CargoDirection || row['Chiều'] || row['Loại nghiệp vụ'] || '').trim().toUpperCase();
      if (dir === 'NHẬP KHẨU' || dir === 'NHAP KHAU' || dir === 'NHẬP' || dir === 'NHAP') dir = CARGO_DIRECTION.IMPORT;
      if (dir === 'XUẤT KHẨU' || dir === 'XUAT KHAU' || dir === 'XUẤT' || dir === 'XUAT') dir = CARGO_DIRECTION.EXPORT;
      if (dir !== CARGO_DIRECTION.IMPORT && dir !== CARGO_DIRECTION.EXPORT) {
        rowErrors.push({ column: 'CargoDirection', value: row.CargoDirection, message: 'Loại nghiệp vụ không hợp lệ. Chỉ chấp nhận IMPORT (Nhập khẩu) hoặc EXPORT (Xuất khẩu).' });
      }

      // 3. Loại phương tiện (VehicleType: CONTAINER / TRUCK)
      let vType = String(row.VehicleType || row['Loại xe'] || row['LoaiXe'] || '').trim().toUpperCase();
      if (vType === 'XE TẢI' || vType === 'XE TAI' || vType === 'TAI') vType = VEHICLE_TYPE.TRUCK;
      if (vType === 'CONT' || vType === 'CONTAINER') vType = VEHICLE_TYPE.CONTAINER;
      if (vType !== VEHICLE_TYPE.CONTAINER && vType !== VEHICLE_TYPE.TRUCK) {
        rowErrors.push({ column: 'VehicleType', value: row.VehicleType, message: 'Loại xe không hợp lệ. Chỉ chấp nhận CONTAINER hoặc TRUCK.' });
      }

      // 4. Số Container (Nếu là CONTAINER thì nên có và không trùng)
      const rawContainer = row.ContainerNo || row['Số container'] || row['SoContainer'] || '';
      const normContainer = normalizeContainerNo(rawContainer);
      if (vType === VEHICLE_TYPE.CONTAINER && !normContainer) {
        rowErrors.push({ column: 'ContainerNo', value: rawContainer, message: 'Xe Container cần có số Container.' });
      }
      if (normContainer) {
        if (seenContainers.has(normContainer)) {
          rowErrors.push({ column: 'ContainerNo', value: rawContainer, message: 'Số container bị trùng trong cùng đợt import.' });
        } else {
          seenContainers.add(normContainer);
        }
      }

      // 5. Trọng lượng kg (Nếu có thì phải là số >= 0)
      let weight = row.WeightKg || row.Weight || row['Trọng lượng'] || row['TrongLuong'] || '';
      let weightKg = null;
      if (weight !== '' && weight !== null && weight !== undefined) {
        weightKg = Number(String(weight).replace(/,/g, ''));
        if (isNaN(weightKg) || weightKg < 0) {
          rowErrors.push({ column: 'WeightKg', value: weight, message: 'Trọng lượng phải là số hợp lệ.' });
        }
      }

      // 6. Đơn vị vận tải (Company)
      const comp = String(row.Company || row['Nhà xe'] || row['DonVi'] || company || '').trim();
      if (!comp) {
        rowErrors.push({ column: 'Company', value: '', message: 'Thiếu tên Đơn vị vận tải / Nhà xe.' });
      }

      // 7. Ngày đăng ký
      const regDateRaw = row.RegistrationDate || row['Ngày đăng ký'] || row['NgayDangKy'] || '';
      let regDate = regDateRaw ? parseDateTime(regDateRaw) : new Date();
      if (regDateRaw && !regDate) {
        rowErrors.push({ column: 'RegistrationDate', value: regDateRaw, message: 'Định dạng ngày đăng ký không hợp lệ.' });
      }

      if (rowErrors.length > 0) {
        rowErrors.forEach(err => {
          errors.push({
            row: rowNum,
            column: err.column,
            value: err.value,
            message: err.message
          });
        });
      } else {
        validRows.push({
          VehicleID: generateId('VH'),
          BatchID: batchId,
          CargoDirection: dir,
          VehicleType: vType,
          LicensePlate: normPlate,
          ContainerNo: normContainer,
          WeightKg: weightKg !== null ? weightKg : '',
          Company: comp,
          DriverName: String(row.DriverName || row['Tài xế'] || row['TaiXe'] || '').trim(),
          DriverPhone: String(row.DriverPhone || row['Số điện thoại'] || row['SoDienThoai'] || '').trim(),
          RegistrationDate: formatDateTime(regDate || new Date()),
          Status: VEHICLE_STATUS.REGISTERED,
          Note: String(row.Note || row['Ghi chú'] || '').trim(),
          CreatedAt: nowStr,
          CreatedBy: currentUser.email,
          UpdatedAt: nowStr,
          UpdatedBy: currentUser.email
        });
      }
    });

    const isSuccess = errors.length === 0;

    return {
      success: isSuccess,
      batchId: batchId,
      fileName: fileName || 'Import.xlsx',
      company: company || '',
      totalRows: rawRows.length,
      validRowsCount: validRows.length,
      errorRowsCount: errors.length,
      errors: errors,
      previewData: validRows.slice(0, 10), // Trả về 10 dòng đầu để xem trước
      validRows: isSuccess ? validRows : [] // Chỉ lưu khi không có lỗi
    };
  }

  /**
   * Lưu đợt import đã được người dùng xác nhận vào Google Sheets
   * Áp dụng Transaction-like với LockService theo DATABASE.md Section 37
   */
  function commitImport(batchData) {
    const currentUser = AuthService.requireRole([ROLES.ADMIN, ROLES.BAI]);

    if (!batchData || !batchData.batchId || !batchData.validRows || batchData.validRows.length === 0) {
      return responseError('Không có dữ liệu hợp lệ để commit vào Database.', 'NO_VALID_DATA');
    }

    return DatabaseService.withLock(function() {
      const nowStr = formatDateTime(new Date());

      // 1. Tạo bản ghi IMPORT_BATCH
      const batchRecord = {
        BatchID: batchData.batchId,
        FileName: batchData.fileName || 'Import.xlsx',
        Company: batchData.company || '',
        ImportTime: nowStr,
        ImportBy: currentUser.email,
        TotalRows: batchData.totalRows,
        SuccessRows: batchData.validRows.length,
        ErrorRows: 0,
        Status: BATCH_STATUS.IMPORTED,
        Note: 'Import thành công ' + batchData.validRows.length + ' phương tiện'
      };
      DatabaseService.insertRow(SHEETS.IMPORT_BATCH, batchRecord);

      // 2. Thêm toàn bộ danh sách xe vào VEHICLE_REGISTER
      DatabaseService.insertRows(SHEETS.VEHICLE_REGISTER, batchData.validRows);

      // 3. Ghi Audit Log
      AuditService.writeLog(
        AUDIT_ACTIONS.IMPORT,
        'BATCH',
        batchData.batchId,
        '',
        BATCH_STATUS.IMPORTED,
        'Import thành công đợt ' + batchData.batchId + ' gồm ' + batchData.validRows.length + ' xe.',
        currentUser
      );

      return responseSuccess('Import thành công ' + batchData.validRows.length + ' phương tiện vào hệ thống.', {
        batchId: batchData.batchId,
        count: batchData.validRows.length
      });
    });
  }

  /**
   * Lấy lịch sử các đợt Import
   */
  function getImportBatches() {
    return DatabaseService.readAll(SHEETS.IMPORT_BATCH);
  }

  return {
    validateAndPreview: validateAndPreview,
    commitImport: commitImport,
    getImportBatches: getImportBatches
  };

})();


/* ==========================================================================
   MODULE: VehicleService.gs
   ========================================================================== */

/**
 * VehicleService.gs
 * Tra cứu, tìm kiếm và quản lý phương tiện đăng ký (VEHICLE_REGISTER)
 * Hỗ trợ tìm gần đúng theo biển số, container, số vé, nhà xe
 */

var VehicleService = (function() {

  /**
   * Tìm kiếm phương tiện theo biển số hoặc số container (chuẩn hóa biển số trước khi so khớp)
   * @param {string} keyword - Biển số hoặc container hoặc mã phiếu
   */
  function findVehicleByKeyword(keyword) {
    if (!keyword) return [];
    const normKey = normalizeLicensePlate(keyword);
    const rawKey = String(keyword).trim().toLowerCase();

    const allVehicles = DatabaseService.readAll(SHEETS.VEHICLE_REGISTER) || [];
    
    return allVehicles.filter(v => {
      const vPlateNorm = normalizeLicensePlate(v.LicensePlate);
      const vContainerNorm = normalizeContainerNo(v.ContainerNo);
      const vPlateRaw = String(v.LicensePlate || '').toLowerCase();
      const vCompany = String(v.Company || '').toLowerCase();
      const vDriver = String(v.DriverName || '').toLowerCase();

      return (
        vPlateNorm === normKey ||
        vPlateNorm.indexOf(normKey) !== -1 ||
        vContainerNorm === normKey ||
        vPlateRaw.indexOf(rawKey) !== -1 ||
        vCompany.indexOf(rawKey) !== -1 ||
        vDriver.indexOf(rawKey) !== -1 ||
        String(v.VehicleID).toLowerCase().indexOf(rawKey) !== -1
      );
    });
  }

  /**
   * Lấy chi tiết phương tiện theo VehicleID
   */
  function getVehicleById(vehicleId) {
    if (!vehicleId) return null;
    const all = DatabaseService.readAll(SHEETS.VEHICLE_REGISTER) || [];
    return all.find(v => v.VehicleID === vehicleId) || null;
  }

  /**
   * Lấy danh sách phương tiện theo các bộ lọc
   */
  function getVehicles(filters) {
    filters = filters || {};
    let list = DatabaseService.readAll(SHEETS.VEHICLE_REGISTER) || [];

    if (filters.cargoDirection && filters.cargoDirection !== 'ALL') {
      list = list.filter(v => v.CargoDirection === filters.cargoDirection);
    }
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter(v => v.Status === filters.status);
    }
    if (filters.vehicleType && filters.vehicleType !== 'ALL') {
      list = list.filter(v => v.VehicleType === filters.vehicleType);
    }
    if (filters.keyword) {
      const normKey = normalizeLicensePlate(filters.keyword);
      const rawKey = String(filters.keyword).trim().toLowerCase();
      list = list.filter(v => {
        const pNorm = normalizeLicensePlate(v.LicensePlate);
        const cNorm = normalizeContainerNo(v.ContainerNo);
        return (
          pNorm.indexOf(normKey) !== -1 ||
          cNorm.indexOf(normKey) !== -1 ||
          String(v.Company || '').toLowerCase().indexOf(rawKey) !== -1 ||
          String(v.DriverName || '').toLowerCase().indexOf(rawKey) !== -1
        );
      });
    }

    // Sắp xếp mới nhất lên trước
    list.sort((a, b) => {
      const da = parseDateTime(a.CreatedAt) || 0;
      const db = parseDateTime(b.CreatedAt) || 0;
      return db - da;
    });

    return list;
  }

  /**
   * Hủy đăng ký phương tiện (Chỉ khi chưa vào bãi)
   */
  function cancelRegistration(vehicleId, reason) {
    const user = AuthService.requireRole([ROLES.ADMIN, ROLES.BAI]);
    const vehicle = getVehicleById(vehicleId);
    if (!vehicle) {
      return responseError('Không tìm thấy xe.', 'NOT_FOUND');
    }

    if (vehicle.Status !== VEHICLE_STATUS.REGISTERED && vehicle.Status !== VEHICLE_STATUS.WAITING_GATE_IN) {
      return responseError('Không thể hủy xe đã vào bãi hoặc đã hoàn tất.', 'INVALID_STATE');
    }

    const oldStatus = vehicle.Status;
    const newStatus = VEHICLE_STATUS.CANCELLED;
    const nowStr = formatDateTime(new Date());

    DatabaseService.updateRow(SHEETS.VEHICLE_REGISTER, 'VehicleID', vehicleId, {
      Status: newStatus,
      Note: (vehicle.Note ? vehicle.Note + ' | ' : '') + 'Hủy: ' + (reason || 'Người dùng yêu cầu'),
      UpdatedAt: nowStr,
      UpdatedBy: user.email
    });

    AuditService.writeLog(
      AUDIT_ACTIONS.CANCEL,
      'VEHICLE',
      vehicleId,
      oldStatus,
      newStatus,
      'Hủy đăng ký xe ' + vehicle.LicensePlate + ': ' + (reason || 'Không có lý do'),
      user
    );

    return responseSuccess('Đã hủy đăng ký phương tiện thành công.');
  }

  return {
    findVehicleByKeyword: findVehicleByKeyword,
    getVehicleById: getVehicleById,
    getVehicles: getVehicles,
    cancelRegistration: cancelRegistration
  };

})();


/* ==========================================================================
   MODULE: GateInService.gs
   ========================================================================== */

/**
 * GateInService.gs
 * Nghiệp vụ Cổng Vào (Gate In) theo CLAUDE.md Section 10-14 & DATABASE.md Section 12-14
 * Thao tác nhanh, tạo số vé duy nhất BAI-YYYYMMDD-XXXXXX, ghi GATE_IN, YARD và in phiếu QR
 */

var GateInService = (function() {

  /**
   * Tra cứu thông tin xe chờ Gate In theo biển số xe
   */
  function searchVehicleForGateIn(plateInput) {
    AuthService.requireRole([ROLES.ADMIN, ROLES.GATE_IN]);
    if (!plateInput) return responseError('Vui lòng nhập biển số xe.', 'EMPTY_INPUT');

    const norm = normalizeLicensePlate(plateInput);
    const all = DatabaseService.readAll(SHEETS.VEHICLE_REGISTER) || [];
    
    // Tìm các xe có biển số khớp và ở trạng thái hợp lệ
    const candidates = all.filter(v => normalizeLicensePlate(v.LicensePlate) === norm);

    if (candidates.length === 0) {
      return responseError('Không tìm thấy thông tin đăng ký cho biển số: ' + plateInput, 'VEHICLE_NOT_FOUND');
    }

    // Ưu tiên xe đang ở REGISTERED hoặc WAITING_GATE_IN
    const pending = candidates.find(v => v.Status === VEHICLE_STATUS.REGISTERED || v.Status === VEHICLE_STATUS.WAITING_GATE_IN);
    if (!pending) {
      const latest = candidates[candidates.length - 1];
      let msg = 'Xe đang ở trạng thái: ' + latest.Status + '.';
      if (latest.Status === VEHICLE_STATUS.IN_YARD) msg = 'Xe đã vào bãi trước đó và đang ở trong bãi.';
      if (latest.Status === VEHICLE_STATUS.READY_TO_EXIT) msg = 'Xe đang chờ xuất bãi tại cổng ra.';
      if (latest.Status === VEHICLE_STATUS.COMPLETED) msg = 'Lượt xe này đã hoàn tất xuất bãi.';
      if (latest.Status === VEHICLE_STATUS.CANCELLED) msg = 'Đăng ký xe này đã bị hủy.';
      return responseError(msg, 'INVALID_STATE', latest);
    }

    return responseSuccess('Tìm thấy thông tin phương tiện.', pending);
  }

  /**
   * Duyệt cho xe vào bãi (Gate In)
   * Sử dụng LockService chống trùng lặp theo DATABASE.md Section 38, 47
   */
  function approveGateIn(vehicleId, note) {
    const currentUser = AuthService.requireRole([ROLES.ADMIN, ROLES.GATE_IN]);

    if (!vehicleId) return responseError('Thiếu mã phương tiện.', 'INVALID_DATA');

    return DatabaseService.withLock(function() {
      // 1. Kiểm tra lại trạng thái xe trong database
      const allVehicles = DatabaseService.readAll(SHEETS.VEHICLE_REGISTER) || [];
      const vehicle = allVehicles.find(v => v.VehicleID === vehicleId);

      if (!vehicle) {
        return responseError('Không tìm thấy phương tiện.', 'NOT_FOUND');
      }

      if (vehicle.Status !== VEHICLE_STATUS.REGISTERED && vehicle.Status !== VEHICLE_STATUS.WAITING_GATE_IN) {
        return responseError('Xe không đủ điều kiện vào bãi. Trạng thái hiện tại: ' + vehicle.Status, 'INVALID_STATE');
      }

      // 2. Kiểm tra xe đã có bản ghi GATE_IN chưa
      const allGateIns = DatabaseService.readAll(SHEETS.GATE_IN) || [];
      const existingActiveGateIn = allGateIns.find(gi => gi.VehicleID === vehicleId && gi.Status === OPERATION_STATUS.COMPLETED);
      if (existingActiveGateIn) {
        return responseError('Phương tiện này đã được Gate In trước đó với vé: ' + existingActiveGateIn.TicketNo, 'ALREADY_GATED_IN');
      }

      const now = new Date();
      const nowStr = formatDateTime(now);
      const gateInId = generateId('GI');
      const yardId = generateId('YD');
      const ticketNo = generateTicketNumber();

      // 3. Ghi bản ghi GATE_IN
      const gateInRecord = {
        GateInID: gateInId,
        VehicleID: vehicle.VehicleID,
        TicketNo: ticketNo,
        GateInTime: nowStr,
        GateInBy: currentUser.email,
        Status: OPERATION_STATUS.COMPLETED,
        PrintedAt: nowStr
      };
      DatabaseService.insertRow(SHEETS.GATE_IN, gateInRecord);

      // 4. Ghi bản ghi YARD (Theo dõi trong bãi)
      const yardRecord = {
        YardID: yardId,
        VehicleID: vehicle.VehicleID,
        GateInID: gateInId,
        InYardTime: nowStr,
        ReadyToExitTime: '',
        ReadyToExitBy: '',
        Status: VEHICLE_STATUS.IN_YARD
      };
      DatabaseService.insertRow(SHEETS.YARD, yardRecord);

      // 5. Cập nhật VEHICLE_REGISTER sang IN_YARD
      DatabaseService.updateRow(SHEETS.VEHICLE_REGISTER, 'VehicleID', vehicle.VehicleID, {
        Status: VEHICLE_STATUS.IN_YARD,
        UpdatedAt: nowStr,
        UpdatedBy: currentUser.email
      });

      // 6. Ghi Audit Log
      AuditService.writeLog(
        AUDIT_ACTIONS.GATE_IN,
        'VEHICLE',
        vehicle.VehicleID,
        vehicle.Status,
        VEHICLE_STATUS.IN_YARD,
        'Xe ' + vehicle.LicensePlate + ' vào bãi thành công. Số vé: ' + ticketNo,
        currentUser
      );

      // 7. Tạo dữ liệu in phiếu vào bãi theo CLAUDE.md Section 14
      const ticketData = {
        ticketNo: ticketNo,
        licensePlate: vehicle.LicensePlate,
        vehicleType: vehicle.VehicleType,
        cargoDirection: vehicle.CargoDirection,
        containerNo: vehicle.ContainerNo || '—',
        weightKg: vehicle.WeightKg ? (vehicle.WeightKg + ' kg') : '—',
        company: vehicle.Company,
        driverName: vehicle.DriverName || '—',
        driverPhone: vehicle.DriverPhone || '—',
        gateInTime: nowStr,
        gateInBy: currentUser.name || currentUser.email,
        qrPayload: ticketNo // Dữ liệu mã hóa cho mã QR
      };

      return responseSuccess('Duyệt xe vào bãi thành công!', {
        ticket: ticketData,
        vehicle: vehicle
      });
    });
  }

  /**
   * Lấy lại thông tin phiếu để in lại (nếu cần)
   */
  function getTicketForReprint(ticketNo) {
    if (!ticketNo) return responseError('Thiếu số vé.', 'INVALID_DATA');
    const allGateIns = DatabaseService.readAll(SHEETS.GATE_IN) || [];
    const gateIn = allGateIns.find(g => g.TicketNo === ticketNo);
    if (!gateIn) return responseError('Không tìm thấy vé: ' + ticketNo, 'NOT_FOUND');

    const vehicle = VehicleService.getVehicleById(gateIn.VehicleID);
    if (!vehicle) return responseError('Không tìm thấy xe của vé này.', 'NOT_FOUND');

    return responseSuccess('Thông tin vé', {
      ticketNo: gateIn.TicketNo,
      licensePlate: vehicle.LicensePlate,
      vehicleType: vehicle.VehicleType,
      cargoDirection: vehicle.CargoDirection,
      containerNo: vehicle.ContainerNo || '—',
      weightKg: vehicle.WeightKg ? (vehicle.WeightKg + ' kg') : '—',
      company: vehicle.Company,
      driverName: vehicle.DriverName || '—',
      driverPhone: vehicle.DriverPhone || '—',
      gateInTime: gateIn.GateInTime,
      gateInBy: gateIn.GateInBy,
      qrPayload: gateIn.TicketNo
    });
  }

  return {
    searchVehicleForGateIn: searchVehicleForGateIn,
    approveGateIn: approveGateIn,
    getTicketForReprint: getTicketForReprint
  };

})();


/* ==========================================================================
   MODULE: YardService.gs
   ========================================================================== */

/**
 * YardService.gs
 * Quản lý phương tiện đang lưu tại bãi (YARD)
 * Tính thời gian lưu bãi thực tế, cảnh báo quá 24h và duyệt "Sẵn sàng xuất bãi" (READY_TO_EXIT)
 * Tuân thủ theo CLAUDE.md Section 15-16 & DATABASE.md Section 15-16, 42-43
 */

var YardService = (function() {

  /**
   * Lấy danh sách tất cả phương tiện đang trong bãi (IN_YARD và READY_TO_EXIT)
   * Kèm thời gian đã ở bãi tính đến hiện tại
   */
  function getVehiclesInYard() {
    AuthService.requireRole([ROLES.ADMIN, ROLES.YARD, ROLES.GATE_IN, ROLES.GATE_OUT, ROLES.BAI]);

    const yardList = DatabaseService.readAll(SHEETS.YARD) || [];
    const activeYards = yardList.filter(y => y.Status === VEHICLE_STATUS.IN_YARD || y.Status === VEHICLE_STATUS.READY_TO_EXIT);
    
    if (activeYards.length === 0) return [];

    const allVehicles = DatabaseService.readAll(SHEETS.VEHICLE_REGISTER) || [];
    const vehicleMap = new Map();
    allVehicles.forEach(v => vehicleMap.set(v.VehicleID, v));

    const allGateIns = DatabaseService.readAll(SHEETS.GATE_IN) || [];
    const gateInMap = new Map();
    allGateIns.forEach(gi => gateInMap.set(gi.GateInID, gi));

    const now = new Date();

    const results = activeYards.map(yard => {
      const vehicle = vehicleMap.get(yard.VehicleID) || {};
      const gateIn = gateInMap.get(yard.GateInID) || {};

      const inTime = parseDateTime(yard.InYardTime) || now;
      const duration = calculateDurationDetails(inTime, now);
      const isOver24h = duration.totalHours > 24;

      return {
        yardId: yard.YardID,
        vehicleId: yard.VehicleID,
        gateInId: yard.GateInID,
        ticketNo: gateIn.TicketNo || '—',
        licensePlate: vehicle.LicensePlate || '—',
        vehicleType: vehicle.VehicleType || '—',
        cargoDirection: vehicle.CargoDirection || '—',
        containerNo: vehicle.ContainerNo || '—',
        weightKg: vehicle.WeightKg || '',
        company: vehicle.Company || '—',
        driverName: vehicle.DriverName || '—',
        driverPhone: vehicle.DriverPhone || '—',
        inYardTime: yard.InYardTime,
        readyToExitTime: yard.ReadyToExitTime || '',
        readyToExitBy: yard.ReadyToExitBy || '',
        status: yard.Status,
        durationFormatted: duration.formattedText,
        totalHours: duration.totalHours,
        isOver24h: isOver24h
      };
    });

    // Sắp xếp: xe vào lâu nhất lên đầu (hoặc xe chờ ra lên đầu)
    results.sort((a, b) => b.totalHours - a.totalHours);

    return results;
  }

  /**
   * Duyệt xe chờ xuất bãi (READY_TO_EXIT) bởi nhân viên GetIn/GetOut
   */
  function approveReadyToExit(vehicleId) {
    const currentUser = AuthService.requireRole([ROLES.ADMIN, ROLES.YARD]);

    if (!vehicleId) return responseError('Thiếu mã phương tiện.', 'INVALID_DATA');

    return DatabaseService.withLock(function() {
      const yardList = DatabaseService.readAll(SHEETS.YARD) || [];
      const yardItem = yardList.find(y => y.VehicleID === vehicleId && y.Status === VEHICLE_STATUS.IN_YARD);

      if (!yardItem) {
        return responseError('Không tìm thấy xe đang ở trạng thái IN_YARD trong bãi.', 'NOT_IN_YARD');
      }

      const vehicle = VehicleService.getVehicleById(vehicleId);
      if (!vehicle) {
        return responseError('Không tìm thấy thông tin xe.', 'NOT_FOUND');
      }

      const nowStr = formatDateTime(new Date());

      // 1. Cập nhật bảng YARD
      DatabaseService.updateRow(SHEETS.YARD, 'YardID', yardItem.YardID, {
        Status: VEHICLE_STATUS.READY_TO_EXIT,
        ReadyToExitTime: nowStr,
        ReadyToExitBy: currentUser.email
      });

      // 2. Cập nhật VEHICLE_REGISTER
      DatabaseService.updateRow(SHEETS.VEHICLE_REGISTER, 'VehicleID', vehicleId, {
        Status: VEHICLE_STATUS.READY_TO_EXIT,
        UpdatedAt: nowStr,
        UpdatedBy: currentUser.email
      });

      // 3. Ghi Audit Log
      AuditService.writeLog(
        AUDIT_ACTIONS.READY_TO_EXIT,
        'VEHICLE',
        vehicleId,
        VEHICLE_STATUS.IN_YARD,
        VEHICLE_STATUS.READY_TO_EXIT,
        'Nhân viên GetIn/GetOut đã duyệt xe ' + vehicle.LicensePlate + ' đủ điều kiện xuất bãi.',
        currentUser
      );

      return responseSuccess('Duyệt xe chờ xuất bãi thành công! Xe đã xuất hiện tại danh sách Cổng Ra.', {
        vehicleId: vehicleId,
        licensePlate: vehicle.LicensePlate,
        status: VEHICLE_STATUS.READY_TO_EXIT,
        readyToExitTime: nowStr
      });
    });
  }

  return {
    getVehiclesInYard: getVehiclesInYard,
    approveReadyToExit: approveReadyToExit
  };

})();


/* ==========================================================================
   MODULE: GateOutService.gs
   ========================================================================== */

/**
 * GateOutService.gs
 * Nghiệp vụ Cổng Ra (Gate Out) theo CLAUDE.md Section 17-23 & DATABASE.md Section 17-27, 44-46
 * Kiểm tra nghiêm ngặt: Ticket hợp lệ, khớp biển số, trạng thái phải là READY_TO_EXIT
 * Tự động tính thời gian, tính số ngày, tính phí theo bảng giá và ghi nhận hoàn tất giao dịch
 */

var GateOutService = (function() {

  /**
   * Lấy danh sách xe đã được duyệt chờ xuất bãi (READY_TO_EXIT) để cổng ra kiểm tra / gọi loa
   */
  function getReadyToExitVehicles() {
    AuthService.requireRole([ROLES.ADMIN, ROLES.GATE_OUT, ROLES.YARD]);

    const yardList = DatabaseService.readAll(SHEETS.YARD) || [];
    const readyYards = yardList.filter(y => y.Status === VEHICLE_STATUS.READY_TO_EXIT);
    if (readyYards.length === 0) return [];

    const allVehicles = DatabaseService.readAll(SHEETS.VEHICLE_REGISTER) || [];
    const vehicleMap = new Map();
    allVehicles.forEach(v => vehicleMap.set(v.VehicleID, v));

    const allGateIns = DatabaseService.readAll(SHEETS.GATE_IN) || [];
    const gateInMap = new Map();
    allGateIns.forEach(gi => gateInMap.set(gi.GateInID, gi));

    const now = new Date();

    return readyYards.map(yard => {
      const vehicle = vehicleMap.get(yard.VehicleID) || {};
      const gateIn = gateInMap.get(yard.GateInID) || {};
      const inTime = parseDateTime(yard.InYardTime) || now;
      const duration = calculateDurationDetails(inTime, now);

      return {
        yardId: yard.YardID,
        vehicleId: yard.VehicleID,
        gateInId: yard.GateInID,
        ticketNo: gateIn.TicketNo || '—',
        licensePlate: vehicle.LicensePlate || '—',
        vehicleType: vehicle.VehicleType || '—',
        cargoDirection: vehicle.CargoDirection || '—',
        containerNo: vehicle.ContainerNo || '—',
        company: vehicle.Company || '—',
        driverName: vehicle.DriverName || '—',
        driverPhone: vehicle.DriverPhone || '—',
        inYardTime: yard.InYardTime,
        readyToExitTime: yard.ReadyToExitTime || '',
        readyToExitBy: yard.ReadyToExitBy || '',
        durationFormatted: duration.formattedText,
        totalHours: duration.totalHours
      };
    });
  }

  /**
   * Tra cứu và kiểm tra xe khi tài xế xuất trình vé hoặc quét QR
   * Dự toán thời gian lưu bãi và mức phí tạm tính
   * @param {string} searchKey - Số vé (BAI-...) hoặc Biển số xe
   */
  function inspectTicketForGateOut(searchKey) {
    AuthService.requireRole([ROLES.ADMIN, ROLES.GATE_OUT]);

    if (!searchKey) return responseError('Vui lòng quét mã QR hoặc nhập số vé / biển số.', 'EMPTY_INPUT');

    const rawKey = String(searchKey).trim();
    const normKey = normalizeLicensePlate(rawKey);

    const allGateIns = DatabaseService.readAll(SHEETS.GATE_IN) || [];
    const allVehicles = DatabaseService.readAll(SHEETS.VEHICLE_REGISTER) || [];
    const allYards = DatabaseService.readAll(SHEETS.YARD) || [];

    // Tìm gateIn theo TicketNo hoặc theo biển số
    let targetGateIn = allGateIns.find(gi => String(gi.TicketNo).trim().toUpperCase() === rawKey.toUpperCase());
    let targetVehicle = null;

    if (!targetGateIn) {
      // Tìm theo biển số
      targetVehicle = allVehicles.find(v => normalizeLicensePlate(v.LicensePlate) === normKey);
      if (targetVehicle) {
        targetGateIn = allGateIns.slice().reverse().find(gi => gi.VehicleID === targetVehicle.VehicleID && gi.Status === OPERATION_STATUS.COMPLETED);
      }
    } else {
      targetVehicle = allVehicles.find(v => v.VehicleID === targetGateIn.VehicleID);
    }

    if (!targetGateIn || !targetVehicle) {
      return responseError('Không tìm thấy thông tin vé hoặc phương tiện tương ứng.', 'TICKET_NOT_FOUND');
    }

    // Kiểm tra trạng thái xe
    if (targetVehicle.Status === VEHICLE_STATUS.COMPLETED) {
      return responseError('Vé này đã được hoàn tất thủ tục xuất bãi trước đó.', 'ALREADY_COMPLETED');
    }

    if (targetVehicle.Status === VEHICLE_STATUS.REGISTERED || targetVehicle.Status === VEHICLE_STATUS.WAITING_GATE_IN) {
      return responseError('Xe này chưa hoàn tất thủ tục vào bãi (Chưa Gate In).', 'NOT_GATED_IN');
    }

    if (targetVehicle.Status === VEHICLE_STATUS.IN_YARD) {
      return responseError('❌ XE CHƯA ĐƯỢC DUYỆT CHỜ RA. Vui lòng liên hệ nhân viên bãi GetIn/GetOut kiểm tra trước.', 'NOT_READY_TO_EXIT');
    }

    if (targetVehicle.Status !== VEHICLE_STATUS.READY_TO_EXIT) {
      return responseError('Trạng thái xe không hợp lệ để xuất bãi: ' + targetVehicle.Status, 'INVALID_STATE');
    }

    // Dự toán chi phí xuất bãi tại thời điểm hiện tại
    const now = new Date();
    const gateInTime = parseDateTime(targetGateIn.GateInTime) || now;
    const feeCalculation = FeeService.calculateFee(targetVehicle, gateInTime, now);

    return responseSuccess('Thông tin xe hợp lệ, đủ điều kiện xuất bãi.', {
      vehicle: targetVehicle,
      gateIn: targetGateIn,
      previewFee: feeCalculation,
      inspectTime: formatDateTime(now)
    });
  }

  /**
   * Duyệt cho xe xuất bãi (GATE OUT)
   * Sử dụng LockService, cập nhật GATE_OUT, YARD, VEHICLE_REGISTER, FEES, AUDIT_LOG
   * @param {string} ticketNo - Số vé xác thực
   * @param {string} actualLicensePlate - Biển số xe thực tế nhân viên đối chiếu tại cổng
   */
  function approveGateOut(ticketNo, actualLicensePlate) {
    const currentUser = AuthService.requireRole([ROLES.ADMIN, ROLES.GATE_OUT]);

    if (!ticketNo) return responseError('Thiếu số vé.', 'INVALID_DATA');

    return DatabaseService.withLock(function() {
      // 1. Tìm thông tin Gate In
      const allGateIns = DatabaseService.readAll(SHEETS.GATE_IN) || [];
      const gateIn = allGateIns.find(gi => String(gi.TicketNo).trim().toUpperCase() === String(ticketNo).trim().toUpperCase());

      if (!gateIn) {
        return responseError('Số vé không tồn tại trong hệ thống.', 'INVALID_TICKET');
      }

      // 2. Tìm xe tương ứng
      const allVehicles = DatabaseService.readAll(SHEETS.VEHICLE_REGISTER) || [];
      const vehicle = allVehicles.find(v => v.VehicleID === gateIn.VehicleID);

      if (!vehicle) {
        return responseError('Không tìm thấy thông tin phương tiện liên kết với vé.', 'VEHICLE_NOT_FOUND');
      }

      // 3. Đối chiếu biển số xe thực tế theo CLAUDE.md Section 18
      if (actualLicensePlate) {
        const normActual = normalizeLicensePlate(actualLicensePlate);
        const normReg = normalizeLicensePlate(vehicle.LicensePlate);
        if (normActual !== normReg) {
          return responseError('❌ BIỂN SỐ XE KHÔNG KHỚP! Biển số trên vé: ' + vehicle.LicensePlate + ', Thực tế: ' + actualLicensePlate, 'PLATE_MISMATCH');
        }
      }

      // 4. Kiểm tra điều kiện bắt buộc: Status phải là READY_TO_EXIT
      if (vehicle.Status !== VEHICLE_STATUS.READY_TO_EXIT) {
        if (vehicle.Status === VEHICLE_STATUS.IN_YARD) {
          return responseError('❌ XE CHƯA ĐƯỢC DUYỆT CHỜ RA. Chưa đủ điều kiện xuất bãi.', 'NOT_READY_TO_EXIT');
        }
        if (vehicle.Status === VEHICLE_STATUS.COMPLETED) {
          return responseError('Xe đã được cho ra bãi trước đó.', 'ALREADY_COMPLETED');
        }
        return responseError('Trạng thái phương tiện không hợp lệ: ' + vehicle.Status, 'INVALID_STATE');
      }

      const now = new Date();
      const nowStr = formatDateTime(now);
      const gateOutId = generateId('GO');
      const gateInTime = parseDateTime(gateIn.GateInTime) || now;

      // 5. Tự động tính thời gian và phí lưu bãi
      const feeCalculation = FeeService.calculateFee(vehicle, gateInTime, now);

      // 6. Ghi bản ghi GATE_OUT
      const gateOutRecord = {
        GateOutID: gateOutId,
        VehicleID: vehicle.VehicleID,
        TicketNo: ticketNo,
        GateOutTime: nowStr,
        GateOutBy: currentUser.email,
        Status: OPERATION_STATUS.COMPLETED
      };
      DatabaseService.insertRow(SHEETS.GATE_OUT, gateOutRecord);

      // 7. Ghi bản ghi FEES
      const feeRecord = FeeService.recordFee(vehicle, gateInTime, now, feeCalculation);

      // 8. Cập nhật YARD sang COMPLETED
      const allYards = DatabaseService.readAll(SHEETS.YARD) || [];
      const yardItem = allYards.find(y => y.VehicleID === vehicle.VehicleID && y.Status === VEHICLE_STATUS.READY_TO_EXIT);
      if (yardItem) {
        DatabaseService.updateRow(SHEETS.YARD, 'YardID', yardItem.YardID, {
          Status: VEHICLE_STATUS.COMPLETED
        });
      }

      // 9. Cập nhật VEHICLE_REGISTER sang COMPLETED
      DatabaseService.updateRow(SHEETS.VEHICLE_REGISTER, 'VehicleID', vehicle.VehicleID, {
        Status: VEHICLE_STATUS.COMPLETED,
        UpdatedAt: nowStr,
        UpdatedBy: currentUser.email
      });

      // 10. Ghi Audit Log
      AuditService.writeLog(
        AUDIT_ACTIONS.GATE_OUT,
        'VEHICLE',
        vehicle.VehicleID,
        VEHICLE_STATUS.READY_TO_EXIT,
        VEHICLE_STATUS.COMPLETED,
        'Xe ' + vehicle.LicensePlate + ' Gate Out thành công. Phí: ' + feeCalculation.formattedTotalAmount + ' (' + feeCalculation.chargeDays + ' ngày)',
        currentUser
      );

      // 11. Trả về phiếu xuất bãi và biên lai thanh toán
      return responseSuccess('Duyệt cho xe xuất bãi thành công!', {
        gateOutId: gateOutId,
        ticketNo: ticketNo,
        licensePlate: vehicle.LicensePlate,
        cargoDirection: vehicle.CargoDirection,
        vehicleType: vehicle.VehicleType,
        containerNo: vehicle.ContainerNo || '—',
        company: vehicle.Company,
        gateInTime: gateIn.GateInTime,
        gateOutTime: nowStr,
        gateOutBy: currentUser.name || currentUser.email,
        duration: feeCalculation.formattedDuration,
        chargeDays: feeCalculation.chargeDays,
        unitPrice: feeCalculation.unitPrice,
        totalAmount: feeCalculation.totalAmount,
        formattedTotalAmount: feeCalculation.formattedTotalAmount
      });
    });
  }

  return {
    getReadyToExitVehicles: getReadyToExitVehicles,
    inspectTicketForGateOut: inspectTicketForGateOut,
    approveGateOut: approveGateOut
  };

})();


/* ==========================================================================
   MODULE: ReportService.gs
   ========================================================================== */

/**
 * ReportService.gs
 * Tổng hợp số liệu KPI Dashboard và xuất các báo cáo vận hành theo CLAUDE.md Section 35, 36
 */

var ReportService = (function() {

  /**
   * Tính toán các chỉ số KPI vận hành cho Dashboard theo chu kỳ
   * @param {string} period - 'TODAY', 'YESTERDAY', '7DAYS', '30DAYS'
   */
  function getDashboardKPIs(period) {
    period = period || 'TODAY';
    const now = new Date();
    const todayStr = formatDate(now);

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = formatDate(yesterday);

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const allVehicles = DatabaseService.readAll(SHEETS.VEHICLE_REGISTER) || [];
    const allYards = DatabaseService.readAll(SHEETS.YARD) || [];
    const allFees = DatabaseService.readAll(SHEETS.FEES) || [];

    // Lọc thời điểm so sánh
    function isMatchPeriod(dateStr) {
      if (!dateStr) return false;
      const d = parseDateTime(dateStr);
      if (!d) return false;
      const fStr = formatDate(d);
      if (period === 'TODAY') return fStr === todayStr;
      if (period === 'YESTERDAY') return fStr === yesterdayStr;
      if (period === '7DAYS') return d.getTime() >= sevenDaysAgo.getTime();
      if (period === '30DAYS') return d.getTime() >= thirtyDaysAgo.getTime();
      return true;
    }

    // 1. Xe Nhập khẩu trong kỳ
    const importCount = allVehicles.filter(v => v.CargoDirection === CARGO_DIRECTION.IMPORT && isMatchPeriod(v.CreatedAt || v.RegistrationDate)).length;

    // 2. Xe Xuất khẩu trong kỳ
    const exportCount = allVehicles.filter(v => v.CargoDirection === CARGO_DIRECTION.EXPORT && isMatchPeriod(v.CreatedAt || v.RegistrationDate)).length;

    // 3. Đang trong bãi (Status = IN_YARD)
    const inYardCount = allYards.filter(y => y.Status === VEHICLE_STATUS.IN_YARD).length;

    // 4. Chờ ra (Status = READY_TO_EXIT)
    const readyToExitCount = allYards.filter(y => y.Status === VEHICLE_STATUS.READY_TO_EXIT).length;

    // 5. Đã ra trong kỳ (Status = COMPLETED)
    const completedCount = allFees.filter(f => isMatchPeriod(f.GateOutTime || f.CalculatedAt)).length;

    // 6. Xe lưu bãi quá 24 giờ
    let over24hCount = 0;
    allYards.forEach(y => {
      if (y.Status === VEHICLE_STATUS.IN_YARD || y.Status === VEHICLE_STATUS.READY_TO_EXIT) {
        const inTime = parseDateTime(y.InYardTime);
        if (inTime) {
          const hours = (now.getTime() - inTime.getTime()) / (1000 * 60 * 60);
          if (hours > 24) over24hCount++;
        }
      }
    });

    // 7. Doanh thu trong kỳ
    let revenue = 0;
    allFees.forEach(f => {
      if (isMatchPeriod(f.GateOutTime || f.CalculatedAt)) {
        revenue += Number(f.TotalAmount || 0);
      }
    });

    // 8. Thống kê theo ngày trong 7 ngày gần nhất cho biểu đồ
    const last7DaysData = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dStr = formatDate(day);
      const imp = allVehicles.filter(v => v.CargoDirection === CARGO_DIRECTION.IMPORT && formatDate(parseDateTime(v.CreatedAt)) === dStr).length;
      const exp = allVehicles.filter(v => v.CargoDirection === CARGO_DIRECTION.EXPORT && formatDate(parseDateTime(v.CreatedAt)) === dStr).length;
      const rev = allFees.filter(f => formatDate(parseDateTime(f.CalculatedAt)) === dStr).reduce((sum, item) => sum + Number(item.TotalAmount || 0), 0);

      last7DaysData.push({
        date: Utilities.formatDate(day, CONFIG.TIMEZONE, 'dd/MM'),
        importCount: imp,
        exportCount: exp,
        revenue: rev
      });
    }

    return {
      period: period,
      importCount: importCount,
      exportCount: exportCount,
      inYardCount: inYardCount,
      readyToExitCount: readyToExitCount,
      completedCount: completedCount,
      over24hCount: over24hCount,
      revenue: revenue,
      revenueFormatted: formatCurrency(revenue),
      chartData: last7DaysData
    };
  }

  /**
   * Báo cáo danh sách xe đã hoàn tất thủ tục xuất bãi và thu phí
   */
  function getCompletedReport(filterOptions) {
    filterOptions = filterOptions || {};
    const allFees = DatabaseService.readAll(SHEETS.FEES) || [];
    const allVehicles = DatabaseService.readAll(SHEETS.VEHICLE_REGISTER) || [];
    const vMap = new Map();
    allVehicles.forEach(v => vMap.set(v.VehicleID, v));

    let list = allFees.map(fee => {
      const v = vMap.get(fee.VehicleID) || {};
      return {
        feeId: fee.FeeID,
        vehicleId: fee.VehicleID,
        licensePlate: v.LicensePlate || '—',
        cargoDirection: fee.CargoDirection,
        vehicleType: fee.VehicleType,
        containerNo: v.ContainerNo || '—',
        company: v.Company || '—',
        gateInTime: fee.GateInTime,
        gateOutTime: fee.GateOutTime,
        totalHours: fee.TotalHours,
        chargeDays: fee.ChargeDays,
        unitPrice: fee.UnitPrice,
        totalAmount: fee.TotalAmount,
        formattedTotalAmount: formatCurrency(fee.TotalAmount),
        calculatedAt: fee.CalculatedAt
      };
    });

    // Lọc theo Nghiệp Vụ
    if (filterOptions.cargoDirection && filterOptions.cargoDirection !== 'ALL') {
      list = list.filter(r => r.cargoDirection === filterOptions.cargoDirection);
    }

    // Lọc theo Loại Phương Tiện
    if (filterOptions.vehicleType && filterOptions.vehicleType !== 'ALL') {
      list = list.filter(r => r.vehicleType === filterOptions.vehicleType);
    }

    // Lọc theo Nhà Xe / Đơn Vị (giống như Loại Phương Tiện)
    if (filterOptions.company && filterOptions.company !== 'ALL') {
      const targetCompany = String(filterOptions.company).trim().toLowerCase();
      list = list.filter(r => {
        const comp = String(r.company || '').trim().toLowerCase();
        return comp === targetCompany || comp.indexOf(targetCompany) !== -1;
      });
    }

    // Lọc theo Ngày Vào (Từ ngày -> Đến ngày)
    if (filterOptions.gateInFrom) {
      const fromDate = new Date(filterOptions.gateInFrom);
      fromDate.setHours(0, 0, 0, 0);
      list = list.filter(r => {
        const d = parseDateTime(r.gateInTime);
        return d && d >= fromDate;
      });
    }
    if (filterOptions.gateInTo) {
      const toDate = new Date(filterOptions.gateInTo);
      toDate.setHours(23, 59, 59, 999);
      list = list.filter(r => {
        const d = parseDateTime(r.gateInTime);
        return d && d <= toDate;
      });
    }

    // Lọc theo Ngày Ra (Từ ngày -> Đến ngày)
    if (filterOptions.gateOutFrom) {
      const fromDate = new Date(filterOptions.gateOutFrom);
      fromDate.setHours(0, 0, 0, 0);
      list = list.filter(r => {
        const d = parseDateTime(r.gateOutTime);
        return d && d >= fromDate;
      });
    }
    if (filterOptions.gateOutTo) {
      const toDate = new Date(filterOptions.gateOutTo);
      toDate.setHours(23, 59, 59, 999);
      list = list.filter(r => {
        const d = parseDateTime(r.gateOutTime);
        return d && d <= toDate;
      });
    }

    // Lọc theo Từ Khóa (Biển số xe, số container)
    if (filterOptions.keyword && String(filterOptions.keyword).trim()) {
      const kw = String(filterOptions.keyword).trim().toLowerCase().replace(/[\s\-\.]/g, '');
      list = list.filter(r => {
        const plate = String(r.licensePlate || '').toLowerCase().replace(/[\s\-\.]/g, '');
        const cont = String(r.containerNo || '').toLowerCase().replace(/[\s\-\.]/g, '');
        return plate.indexOf(kw) !== -1 || cont.indexOf(kw) !== -1;
      });
    }

    // Sắp xếp theo ngày ra bãi mới nhất
    list.sort((a, b) => {
      const da = parseDateTime(a.gateOutTime) || 0;
      const db = parseDateTime(b.gateOutTime) || 0;
      return db - da;
    });

    return list;
  }

  /**
   * Lấy danh sách tên tất cả các nhà xe / đơn vị vận tải duy nhất trong hệ thống
   */
  function getAllCompanies() {
    const allVehicles = DatabaseService.readAll(SHEETS.VEHICLE_REGISTER) || [];
    const companies = new Set();
    allVehicles.forEach(v => {
      if (v.Company && String(v.Company).trim()) {
        companies.add(String(v.Company).trim());
      }
    });
    return Array.from(companies).sort();
  }

  return {
    getDashboardKPIs: getDashboardKPIs,
    getCompletedReport: getCompletedReport,
    getAllCompanies: getAllCompanies
  };

})();


/* ==========================================================================
   API DISPATCHERS (google.script.run Endpoints)
   ========================================================================== */

/**
 * Code.gs
 * Điểm khởi nhập chính của ứng dụng Google Apps Script Web App
 * Phục vụ HTML Service qua doGet() và định tuyến các hàm API cho client google.script.run
 */

/**
 * Xử lý yêu cầu HTTP GET để phục vụ giao diện Web App
 */

/**
 * API Khởi tạo ban đầu khi mở Web App: Lấy thông tin user, quyền và cấu hình
 */
function apiGetInitialData() {
  try {
    const user = AuthService.getCurrentUser();
    let settingsRows = [];
    try {
      settingsRows = DatabaseService.readAll(SHEETS.SETTINGS);
    } catch (e) {}

    const brandSettings = {
      APP_LOGO: CONFIG.APP_LOGO,
      COMPANY_NAME: CONFIG.COMPANY_NAME,
      APP_SUBTITLE: CONFIG.APP_SUBTITLE,
      TICKET_FOOTER_NOTE: CONFIG.TICKET_FOOTER_NOTE
    };

    settingsRows.forEach(r => {
      if (r.SettingKey && brandSettings.hasOwnProperty(r.SettingKey)) {
        brandSettings[r.SettingKey] = r.SettingValue;
      }
    });

    return responseSuccess('Khởi tạo thành công', {
      user: user,
      settings: brandSettings,
      rolePermissions: ROLE_PERMISSIONS,
      appName: brandSettings.COMPANY_NAME || CONFIG.APP_NAME,
      version: CONFIG.VERSION
    });
  } catch (err) {
    return responseError(err.message, 'INIT_ERROR');
  }
}

/**
 * API Đăng nhập hệ thống
 */
function apiLogin(identifier, password) {
  try {
    return AuthService.login(identifier, password);
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Lấy cấu hình thương hiệu và logo
 */
function apiGetBrandSettings() {
  try {
    const rows = DatabaseService.readAll(SHEETS.SETTINGS);
    const brand = {
      APP_LOGO: CONFIG.APP_LOGO,
      COMPANY_NAME: CONFIG.COMPANY_NAME,
      APP_SUBTITLE: CONFIG.APP_SUBTITLE,
      TICKET_FOOTER_NOTE: CONFIG.TICKET_FOOTER_NOTE
    };
    rows.forEach(r => {
      if (r.SettingKey && brand.hasOwnProperty(r.SettingKey)) {
        brand[r.SettingKey] = r.SettingValue;
      }
    });
    return responseSuccess('Thành công', brand);
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Lưu cấu hình thương hiệu và logo
 */
function apiSaveBrandSettings(brandData) {
  try {
    AuthService.requireRole([ROLES.ADMIN]);
    const nowStr = formatDateTime(new Date());
    const keys = ['APP_LOGO', 'COMPANY_NAME', 'APP_SUBTITLE', 'TICKET_FOOTER_NOTE'];
    
    const existingRows = DatabaseService.readAll(SHEETS.SETTINGS);

    keys.forEach(key => {
      if (brandData && brandData[key] !== undefined) {
        const val = String(brandData[key]);
        const existing = existingRows.find(r => String(r.SettingKey).trim() === key);
        if (existing) {
          DatabaseService.updateRow(SHEETS.SETTINGS, 'SettingKey', key, {
            SettingValue: val,
            UpdatedAt: nowStr
          });
        } else {
          DatabaseService.insertRow(SHEETS.SETTINGS, {
            SettingKey: key,
            SettingValue: val,
            Description: 'Cấu hình thương hiệu',
            UpdatedAt: nowStr
          });
        }
      }
    });

    AuditService.writeLog(AUDIT_ACTIONS.UPDATE, 'SETTINGS', 'BRAND', '', '', 'Cập nhật cấu hình thương hiệu & logo');
    return responseSuccess('Cập nhật cấu hình thương hiệu thành công!');
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Khởi tạo Database (Tạo 10 Sheet, headers, data mặc định)
 */
function apiInitializeDatabase() {
  try {
    return DatabaseService.initializeDatabase();
  } catch (err) {
    return responseError(err.message, 'INIT_DB_ERROR');
  }
}

/**
 * API Lấy dữ liệu KPI Dashboard
 */
function apiGetDashboardKPIs(period) {
  try {
    const data = ReportService.getDashboardKPIs(period);
    return responseSuccess('Thành công', data);
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Kiểm tra & xem trước file Excel tải lên
 */
function apiValidateImport(rows, fileName, company) {
  try {
    return ImportService.validateAndPreview(rows, fileName, company);
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Xác nhận lưu đợt Import vào Database
 */
function apiCommitImport(batchData) {
  try {
    return ImportService.commitImport(batchData);
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Lấy danh sách các đợt Import
 */
function apiGetImportBatches() {
  try {
    return responseSuccess('Thành công', ImportService.getImportBatches());
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Lấy danh sách phương tiện theo bộ lọc
 */
function apiGetVehicles(filters) {
  try {
    return responseSuccess('Thành công', VehicleService.getVehicles(filters));
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Tìm kiếm xe theo từ khóa
 */
function apiFindVehicle(keyword) {
  try {
    return responseSuccess('Thành công', VehicleService.findVehicleByKeyword(keyword));
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Hủy đăng ký phương tiện
 */
function apiCancelVehicle(vehicleId, reason) {
  try {
    return VehicleService.cancelRegistration(vehicleId, reason);
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Tra cứu xe chờ Gate In
 */
function apiSearchGateIn(plate) {
  try {
    return GateInService.searchVehicleForGateIn(plate);
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Duyệt cho xe vào bãi (Gate In)
 */
function apiApproveGateIn(vehicleId, note) {
  try {
    return GateInService.approveGateIn(vehicleId, note);
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Lấy thông tin phiếu để in lại
 */
function apiGetTicketReprint(ticketNo) {
  try {
    return GateInService.getTicketForReprint(ticketNo);
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Lấy danh sách xe đang trong bãi
 */
function apiGetVehiclesInYard() {
  try {
    return responseSuccess('Thành công', YardService.getVehiclesInYard());
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Duyệt xe chờ xuất bãi (READY_TO_EXIT)
 */
function apiApproveReadyToExit(vehicleId) {
  try {
    return YardService.approveReadyToExit(vehicleId);
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Lấy danh sách xe được phép xuất bãi
 */
function apiGetReadyToExitVehicles() {
  try {
    return responseSuccess('Thành công', GateOutService.getReadyToExitVehicles());
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Kiểm tra vé / xe chuẩn bị Gate Out
 */
function apiInspectGateOut(ticketOrPlate) {
  try {
    return GateOutService.inspectTicketForGateOut(ticketOrPlate);
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Duyệt cho xe ra bãi (Gate Out)
 */
function apiApproveGateOut(ticketNo, actualPlate) {
  try {
    return GateOutService.approveGateOut(ticketNo, actualPlate);
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Lấy báo cáo xe đã hoàn tất và thu phí
 */
function apiGetCompletedReport(filters) {
  try {
    return responseSuccess('Thành công', ReportService.getCompletedReport(filters));
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Lấy danh sách Nhà Xe / Đơn Vị vận tải duy nhất trong hệ thống
 */
function apiGetCompanies() {
  try {
    return responseSuccess('Thành công', ReportService.getAllCompanies());
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Lấy cấu hình bảng giá
 */
function apiGetPriceConfigs() {
  try {
    return responseSuccess('Thành công', FeeService.getAllPriceConfigs());
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Lưu cấu hình giá
 */
function apiSavePriceConfig(data) {
  try {
    return FeeService.savePriceConfig(data);
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Lấy danh sách người dùng
 */
function apiGetUsers() {
  try {
    return responseSuccess('Thành công', AuthService.getAllUsers());
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Lưu tài khoản người dùng
 */
function apiSaveUser(userData) {
  try {
    return AuthService.saveUser(userData);
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Bật / tắt trạng thái người dùng
 */
function apiToggleUserStatus(userId) {
  try {
    return AuthService.toggleUserStatus(userId);
  } catch (err) {
    return responseError(err.message);
  }
}

/**
 * API Lấy lịch sử Audit Log
 */
function apiGetAuditLogs(limit, action, entity) {
  try {
    return responseSuccess('Thành công', AuditService.getLogs(limit, action, entity));
  } catch (err) {
    return responseError(err.message);
  }
}
