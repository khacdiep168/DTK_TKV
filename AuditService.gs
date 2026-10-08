/**
 * AuditService.gs
 * Ghi nhận lịch sử thao tác hệ thống (Audit Log) theo DATABASE.md Section 28, 29, 33, 49
 * Đảm bảo mọi giao dịch truy vết được: Ai? Lúc nào? Làm gì? Đối tượng nào? Trạng thái trước/sau?
 */

var AuditService = (function() {

  /**
   * Ghi log thao tác vào Sheet AUDIT_LOG
   * @param {string} action - Hành động (LOGIN, IMPORT, GATE_IN, READY_TO_EXIT, GATE_OUT, ...)
   * @param {string} entity - Loại đối tượng (VEHICLE, BATCH, USER, CONFIG, ...)
   * @param {string} entityId - Mã định danh đối tượng
   * @param {string} oldStatus - Trạng thái cũ (nếu có)
   * @param {string} newStatus - Trạng thái mới (nếu có)
   * @param {string} description - Mô tả chi tiết hành động
   * @param {Object} [userInfo] - Thông tin người dùng (nếu có, không thì lấy từ AuthService)
   */
  function writeLog(action, entity, entityId, oldStatus, newStatus, description, userInfo) {
    try {
      const currentUser = userInfo || (typeof AuthService !== 'undefined' ? AuthService.getCurrentUser() : { id: 'SYSTEM', email: 'system@internal' });
      const now = new Date();
      const logRecord = {
        LogID: generateId('LOG'),
        Timestamp: formatDateTime(now),
        UserID: currentUser.id || currentUser.UserID || 'SYSTEM',
        UserEmail: currentUser.email || currentUser.Email || 'system@internal',
        Action: action || 'UNKNOWN',
        Entity: entity || 'SYSTEM',
        EntityID: entityId || '',
        OldStatus: oldStatus || '',
        NewStatus: newStatus || '',
        Description: description || ''
      };

      if (typeof DatabaseService !== 'undefined') {
        DatabaseService.insertRow(SHEETS.AUDIT_LOG, logRecord);
      }
      return logRecord;
    } catch (err) {
      console.error('Lỗi khi ghi Audit Log:', err);
      // Không để lỗi audit log làm sập transaction nghiệp vụ
      return null;
    }
  }

  /**
   * Lấy danh sách Audit Log (hỗ trợ phân trang và lọc)
   */
  function getLogs(limit, actionFilter, entityFilter) {
    if (typeof DatabaseService === 'undefined') return [];
    const allLogs = DatabaseService.readAll(SHEETS.AUDIT_LOG) || [];
    let filtered = allLogs;
    if (actionFilter) {
      filtered = filtered.filter(l => l.Action === actionFilter);
    }
    if (entityFilter) {
      filtered = filtered.filter(l => l.Entity === entityFilter);
    }
    // Sắp xếp mới nhất lên đầu
    filtered.sort((a, b) => {
      const ta = parseDateTime(a.Timestamp) || 0;
      const tb = parseDateTime(b.Timestamp) || 0;
      return tb - ta;
    });

    const max = limit || 100;
    return filtered.slice(0, max);
  }

  return {
    writeLog: writeLog,
    getLogs: getLogs
  };

})();
