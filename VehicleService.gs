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
