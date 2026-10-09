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

  /**
   * Đăng ký phương tiện trực tiếp (thủ công qua form, không cần file Excel)
   * @param {Object} data - Dữ liệu đăng ký phương tiện từ Form
   */
  function createVehicleRegistration(data) {
    const user = AuthService.requireRole([ROLES.ADMIN, ROLES.BAI, ROLES.GATE_IN]);
    if (!data) {
      return responseError('Dữ liệu đăng ký không hợp lệ.', 'INVALID_DATA');
    }

    const rawPlate = String(data.LicensePlate || '').trim();
    if (!rawPlate) {
      return responseError('Vui lòng nhập Biển số xe.', 'PLATE_REQUIRED');
    }

    const normPlate = normalizeLicensePlate(rawPlate);
    if (!normPlate || normPlate.length < 4) {
      return responseError('Biển số xe không hợp lệ (tối thiểu 4 ký tự).', 'INVALID_PLATE');
    }

    const company = String(data.Company || '').trim();
    if (!company) {
      return responseError('Vui lòng nhập Đơn vị / Nhà xe.', 'COMPANY_REQUIRED');
    }

    const vehicleType = String(data.VehicleType || 'TRUCK').trim().toUpperCase();
    const cargoDirection = String(data.CargoDirection || 'EXPORT').trim().toUpperCase();
    const containerNo = normalizeContainerNo(data.ContainerNo);

    let weightKg = '';
    if (data.WeightKg !== '' && data.WeightKg !== null && data.WeightKg !== undefined) {
      const parsedWeight = Number(String(data.WeightKg).replace(/,/g, ''));
      if (isNaN(parsedWeight) || parsedWeight < 0) {
        return responseError('Trọng lượng hàng phải là số dương hợp lệ.', 'INVALID_WEIGHT');
      }
      weightKg = parsedWeight;
    }

    // Kiểm tra trạng thái hiện tại của xe
    const allVehicles = DatabaseService.readAll(SHEETS.VEHICLE_REGISTER) || [];
    const inYard = allVehicles.find(v => 
      normalizeLicensePlate(v.LicensePlate) === normPlate && 
      (v.Status === VEHICLE_STATUS.IN_YARD || v.Status === VEHICLE_STATUS.READY_TO_EXIT)
    );

    let noteExtra = '';
    if (inYard) {
      noteExtra = ' [Lưu ý: Xe hiện đang trong bãi, đăng ký trước cho chuyến kế tiếp]';
    }

    const now = new Date();
    const nowStr = formatDateTime(now);
    let regDate = now;
    if (data.RegistrationDate) {
      const parsedRegDate = parseDateTime(data.RegistrationDate);
      if (parsedRegDate) regDate = parsedRegDate;
    }
    const regDateStr = formatDateTime(regDate);

    const vehicleId = generateId('VH');
    const batchId = 'MANUAL-' + Utilities.formatDate(now, 'GMT+7', 'yyyyMMdd');

    const newVehicle = {
      VehicleID: vehicleId,
      BatchID: batchId,
      CargoDirection: cargoDirection,
      VehicleType: vehicleType,
      LicensePlate: normPlate,
      ContainerNo: containerNo,
      WeightKg: weightKg,
      Company: company,
      DriverName: String(data.DriverName || '').trim(),
      DriverPhone: String(data.DriverPhone || '').trim(),
      RegistrationDate: regDateStr,
      Status: VEHICLE_STATUS.REGISTERED,
      Note: (String(data.Note || '').trim() + noteExtra).trim(),
      CreatedAt: nowStr,
      CreatedBy: user.email,
      UpdatedAt: nowStr,
      UpdatedBy: user.email
    };

    DatabaseService.insertRow(SHEETS.VEHICLE_REGISTER, newVehicle);

    AuditService.writeLog(
      AUDIT_ACTIONS.IMPORT,
      'VEHICLE',
      vehicleId,
      '',
      VEHICLE_STATUS.REGISTERED,
      'Đăng ký trực tiếp xe ' + normPlate + ' (' + company + ') qua form',
      user
    );

    const msg = inYard
      ? `Đăng ký xe ${normPlate} thành công! (Lưu ý: Xe hiện đang ở trong bãi, lượt đăng ký mới này sẽ sẵn sàng khi xe hoàn tất xuất bãi).`
      : `Đăng ký xe ${normPlate} thành công! Xe đã sẵn sàng duyệt vào bãi tại Cổng Vào.`;

    return responseSuccess(msg, newVehicle);
  }

  return {
    findVehicleByKeyword: findVehicleByKeyword,
    getVehicleById: getVehicleById,
    getVehicles: getVehicles,
    cancelRegistration: cancelRegistration,
    createVehicleRegistration: createVehicleRegistration
  };

})();
