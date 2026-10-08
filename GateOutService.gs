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
