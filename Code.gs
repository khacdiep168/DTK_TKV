/**
 * Code.gs
 * Điểm khởi nhập chính của ứng dụng Google Apps Script Web App
 * Phục vụ HTML Service qua doGet() và định tuyến các hàm API cho client google.script.run
 */

/**
 * Xử lý yêu cầu HTTP GET để phục vụ giao diện Web App
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle(CONFIG.APP_NAME || 'Quản Lý Bãi Xe Xuất Nhập Khẩu')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Hàm nhúng các phần tử giao diện từ file HTML khác vào Index.html
 * Cách dùng: <?!= include('Styles') ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

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
