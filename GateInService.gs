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
    
    // Tìm các xe có biển số khớp
    const candidates = all.filter(v => normalizeLicensePlate(v.LicensePlate) === norm);

    if (candidates.length === 0) {
      return responseError('Không tìm thấy thông tin đăng ký cho biển số: ' + plateInput, 'VEHICLE_NOT_FOUND');
    }

    // 1. CHẶN TUYỆT ĐỐI: Kiểm tra xem xe này có đang ở trong bãi không?
    const inYardVehicle = candidates.find(v => 
      v.Status === VEHICLE_STATUS.IN_YARD || 
      v.Status === VEHICLE_STATUS.READY_TO_EXIT
    );

    if (inYardVehicle) {
      const allGateIns = DatabaseService.readAll(SHEETS.GATE_IN) || [];
      const activeGateIn = allGateIns.slice().reverse().find(gi => 
        gi.VehicleID === inYardVehicle.VehicleID && 
        gi.Status === OPERATION_STATUS.COMPLETED
      );
      const ticketInfo = activeGateIn ? `<br><b>Số vé:</b> ${activeGateIn.TicketNo} - <b>Giờ vào:</b> ${activeGateIn.GateInTime}` : '';
      const statusText = inYardVehicle.Status === VEHICLE_STATUS.IN_YARD ? 'ĐANG Ở TRONG BÃI' : 'ĐANG CHỜ XUẤT BÃI TẠI CỔNG RA';

      return responseError(
        `⛔ <b>XE CHƯA RA KHỎI BÃI!</b><br>Xe mang biển số <b>${inYardVehicle.LicensePlate}</b> hiện <b>${statusText}</b>.${ticketInfo}<br><br>👉 <i>Xe bắt buộc phải hoàn tất thủ tục xuất bãi tại Cổng Ra trước khi được phép vào lại bãi!</i>`,
        'ALREADY_IN_YARD',
        inYardVehicle
      );
    }

    // 2. KHI XE ĐÃ RA KHỎI BÃI (HOẶC CHƯA VÀO BAO GIỜ): Kiểm tra lượt đăng ký mới
    const pending = candidates.slice().reverse().find(v => 
      v.Status === VEHICLE_STATUS.REGISTERED || 
      v.Status === VEHICLE_STATUS.WAITING_GATE_IN
    );

    if (!pending) {
      const completedCandidate = candidates.slice().reverse().find(v => v.Status === VEHICLE_STATUS.COMPLETED);
      let exitInfo = '';
      if (completedCandidate) {
        exitInfo = `<br>Lượt xe gần nhất đã hoàn tất xuất bãi lúc: <b>${completedCandidate.UpdatedAt || '—'}</b>.`;
      }

      return responseError(
        `Xe mang biển số <b>${plateInput}</b> hiện không có lượt đăng ký mới nào đang chờ vào bãi.${exitInfo}<br><br>👉 <i>Vui lòng Import file Excel hoặc tạo đăng ký mới cho xe trước khi cho vào bãi!</i>`,
        'NO_NEW_REGISTRATION'
      );
    }

    return responseSuccess('Tìm thấy thông tin phương tiện hợp lệ.', pending);
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

      // 2. Chặn nghiêm ngặt: Kiểm tra biển số xe này CÓ BẤT KỲ XE NÀO ĐANG Ở TRONG BÃI KHÔNG?
      const targetNorm = normalizeLicensePlate(vehicle.LicensePlate);
      const duplicateInYard = allVehicles.find(v => 
        normalizeLicensePlate(v.LicensePlate) === targetNorm && 
        (v.Status === VEHICLE_STATUS.IN_YARD || v.Status === VEHICLE_STATUS.READY_TO_EXIT)
      );
      if (duplicateInYard) {
        return responseError(
          `⛔ XE CHƯA RA KHỎI BÃI! Xe mang biển số [${vehicle.LicensePlate}] hiện đang ở trong bãi. Không thể duyệt vào bãi nhiều lần khi chưa xuất bãi!`,
          'ALREADY_IN_YARD'
        );
      }

      // 3. Kiểm tra xe này đã có bản ghi GATE_IN chưa
      const allGateIns = DatabaseService.readAll(SHEETS.GATE_IN) || [];
      const existingActiveGateIn = allGateIns.find(gi => gi.VehicleID === vehicleId && gi.Status === OPERATION_STATUS.COMPLETED);
      if (existingActiveGateIn) {
        return responseError('Lượt xe này đã được Gate In trước đó với vé: ' + existingActiveGateIn.TicketNo, 'ALREADY_GATED_IN');
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
