/**
 * Utils.gs
 * Các hàm tiện ích hỗ trợ: chuẩn hóa biển số, sinh ID, ngày tháng, Lock, phản hồi chuẩn
 */

/**
 * Chuẩn hóa biển số xe theo DATABASE.md Section 11 & CLAUDE.md Section 38
 * Loại bỏ khoảng trắng, dấu gạch nối, dấu chấm, chuyển chữ hoa
 * Ví dụ: "51c-123.45" -> "51C12345"
 */
function normalizeLicensePlate(plate) {
  if (!plate) return '';
  return String(plate)
    .trim()
    .toUpperCase()
    .replace(/[\s\-\.]/g, '');
}

/**
 * Chuẩn hóa số container (chữ hoa, bỏ khoảng trắng)
 */
function normalizeContainerNo(containerNo) {
  if (!containerNo) return '';
  return String(containerNo)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/**
 * Format ngày giờ theo múi giờ Asia/Ho_Chi_Minh: dd/MM/yyyy HH:mm:ss
 */
function formatDateTime(date) {
  if (!date) return '';
  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return Utilities.formatDate(d, CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
}

/**
 * Format chỉ ngày: dd/MM/yyyy
 */
function formatDate(date) {
  if (!date) return '';
  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return Utilities.formatDate(d, CONFIG.TIMEZONE, 'dd/MM/yyyy');
}

/**
 * Lấy đối tượng Date theo timezone hiện tại
 */
function getCurrentDateTime() {
  return new Date();
}

/**
 * Parse chuỗi ngày dạng dd/MM/yyyy hoặc ISO sang Date
 */
function parseDateTime(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  
  if (typeof dateStr === 'string' && dateStr.indexOf('/') > -1) {
    const parts = dateStr.trim().split(' ');
    const dateParts = parts[0].split('/');
    if (dateParts.length === 3) {
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const year = parseInt(dateParts[2], 10);
      let hours = 0, minutes = 0, seconds = 0;
      if (parts[1]) {
        const timeParts = parts[1].split(':');
        hours = parseInt(timeParts[0] || 0, 10);
        minutes = parseInt(timeParts[1] || 0, 10);
        seconds = parseInt(timeParts[2] || 0, 10);
      }
      return new Date(year, month, day, hours, minutes, seconds);
    }
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Sinh ID theo PREFIX + timestamp + random theo DATABASE.md Section 3.2
 * Ví dụ: VH-20261008-000125
 */
function generateId(prefix) {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyyMMdd');
  const randNum = Math.floor(100000 + Math.random() * 900000);
  return prefix + '-' + dateStr + '-' + randNum;
}

/**
 * Sinh Số vé Gate In theo chuẩn: BAI-YYYYMMDD-XXXXXX theo DATABASE.md Section 13
 */
function generateTicketNumber() {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyyMMdd');
  const randNum = Math.floor(100000 + Math.random() * 900000);
  return (CONFIG.TICKET_PREFIX || 'BAI') + '-' + dateStr + '-' + randNum;
}

/**
 * Sinh Batch ID: IMP-YYYYMMDD-XXXX
 */
function generateBatchId() {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyyMMdd');
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return 'IMP-' + dateStr + '-' + randNum;
}

/**
 * Chuẩn hóa phản hồi thành công
 */
function responseSuccess(message, data) {
  return {
    success: true,
    message: message || 'Thao tác thành công',
    data: data || null
  };
}

/**
 * Chuẩn hóa phản hồi lỗi theo DATABASE.md Section 53
 */
function responseError(message, code, data) {
  return {
    success: false,
    message: message || 'Có lỗi xảy ra',
    code: code || 'SYSTEM_ERROR',
    data: data || null
  };
}

/**
 * Tính thời gian lưu bãi (duration) giữa GateInTime và GateOutTime
 * Trả về: { totalMinutes, totalHours, formattedText }
 */
function calculateDurationDetails(inTime, outTime) {
  const dIn = (inTime instanceof Date) ? inTime : parseDateTime(inTime);
  const dOut = (outTime instanceof Date) ? outTime : parseDateTime(outTime);
  
  if (!dIn || !dOut) {
    return { totalMinutes: 0, totalHours: 0, formattedText: '0 giờ 0 phút' };
  }
  
  const diffMs = Math.max(0, dOut.getTime() - dIn.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const totalMinutes = Math.floor(diffSec / 60);
  const totalHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
  
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;
  
  let formattedText = '';
  if (days > 0) formattedText += days + ' ngày ';
  if (hours > 0 || days > 0) formattedText += hours + ' giờ ';
  formattedText += minutes + ' phút ' + seconds + ' giây';
  
  return {
    totalMinutes: totalMinutes,
    totalHours: totalHours,
    days: days,
    hours: hours,
    minutes: minutes,
    seconds: seconds,
    formattedText: formattedText.trim()
  };
}

/**
 * Tính số ngày tính phí (ChargeDays) theo DATABASE.md Section 24
 * ChargeDays = CEILING(TotalHours / 24), tối thiểu 1 ngày
 */
function calculateChargeDays(totalHours) {
  if (totalHours <= 0) return 1;
  const days = Math.ceil(totalHours / 24);
  return Math.max(1, days);
}

/**
 * Format số tiền VND
 */
function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '0 VNĐ';
  return Number(amount).toLocaleString('vi-VN') + ' VNĐ';
}
