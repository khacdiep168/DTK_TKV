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
