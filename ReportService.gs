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

    if (filterOptions.cargoDirection && filterOptions.cargoDirection !== 'ALL') {
      list = list.filter(r => r.cargoDirection === filterOptions.cargoDirection);
    }
    if (filterOptions.vehicleType && filterOptions.vehicleType !== 'ALL') {
      list = list.filter(r => r.vehicleType === filterOptions.vehicleType);
    }
    if (filterOptions.company) {
      const c = filterOptions.company.toLowerCase();
      list = list.filter(r => r.company.toLowerCase().indexOf(c) !== -1);
    }

    // Sắp xếp theo ngày ra bãi mới nhất
    list.sort((a, b) => {
      const da = parseDateTime(a.gateOutTime) || 0;
      const db = parseDateTime(b.gateOutTime) || 0;
      return db - da;
    });

    return list;
  }

  return {
    getDashboardKPIs: getDashboardKPIs,
    getCompletedReport: getCompletedReport
  };

})();
