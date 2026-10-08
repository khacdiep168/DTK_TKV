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
