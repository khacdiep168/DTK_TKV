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
