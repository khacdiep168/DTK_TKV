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
