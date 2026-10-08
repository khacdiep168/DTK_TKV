/**
 * Config.gs
 * Định nghĩa hằng số hệ thống, tên Sheet, Enum trạng thái và cấu hình mặc định
 * Tuân thủ theo CLAUDE.md và DATABASE.md
 */

const CONFIG = {
  TIMEZONE: 'Asia/Ho_Chi_Minh',
  TICKET_PREFIX: 'BAI',
  DEFAULT_TRUCK_WEIGHT_THRESHOLD_KG: 7000,
  APP_NAME: 'QUẢN LÝ BÃI XE XUẤT NHẬP KHẨU',
  VERSION: '1.0.0',
  LOCK_TIMEOUT_MS: 15000, // 15 seconds wait for LockService
  SPREADSHEET_ID: '1wZicF5pXnYOY8crfQo0nQISpD8n3XnnCUrg54TKN6MQ' // ID Google Sheet đích
};

// 10 Bảng chuẩn theo DATABASE.md Section 2 & 52
const SHEETS = {
  USERS: 'USERS',
  VEHICLE_REGISTER: 'VEHICLE_REGISTER',
  IMPORT_BATCH: 'IMPORT_BATCH',
  GATE_IN: 'GATE_IN',
  YARD: 'YARD',
  GATE_OUT: 'GATE_OUT',
  FEES: 'FEES',
  PRICE_CONFIG: 'PRICE_CONFIG',
  AUDIT_LOG: 'AUDIT_LOG',
  SETTINGS: 'SETTINGS'
};

// Trạng thái phương tiện theo DATABASE.md Section 9
const VEHICLE_STATUS = {
  REGISTERED: 'REGISTERED',
  WAITING_GATE_IN: 'WAITING_GATE_IN',
  IN_YARD: 'IN_YARD',
  READY_TO_EXIT: 'READY_TO_EXIT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

// Loại nghiệp vụ theo DATABASE.md Section 7
const CARGO_DIRECTION = {
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT'
};

// Loại phương tiện theo DATABASE.md Section 8
const VEHICLE_TYPE = {
  CONTAINER: 'CONTAINER',
  TRUCK: 'TRUCK'
};

// Phân quyền theo DATABASE.md Section 4 & CLAUDE.md Section 34
const ROLES = {
  ADMIN: 'ADMIN',
  BAI: 'BAI',
  GATE_IN: 'GATE_IN',
  YARD: 'YARD',
  GATE_OUT: 'GATE_OUT'
};

// Trạng thái Batch Import theo DATABASE.md Section 5
const BATCH_STATUS = {
  PREVIEW: 'PREVIEW',
  IMPORTED: 'IMPORTED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

// Trạng thái Gate In / Gate Out theo DATABASE.md Section 12 & 17
const OPERATION_STATUS = {
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

// Hành động Audit Log theo DATABASE.md Section 29
const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  IMPORT: 'IMPORT',
  GATE_IN: 'GATE_IN',
  PRINT_TICKET: 'PRINT_TICKET',
  READY_TO_EXIT: 'READY_TO_EXIT',
  GATE_OUT: 'GATE_OUT',
  CANCEL: 'CANCEL',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE'
};

// Cấu trúc tiêu đề cột (Columns Headers) cho từng Sheet chuẩn xác 100%
const SHEET_HEADERS = {
  USERS: ['UserID', 'Email', 'FullName', 'Role', 'Status', 'CreatedAt', 'UpdatedAt'],
  IMPORT_BATCH: ['BatchID', 'FileName', 'Company', 'ImportTime', 'ImportBy', 'TotalRows', 'SuccessRows', 'ErrorRows', 'Status', 'Note'],
  VEHICLE_REGISTER: ['VehicleID', 'BatchID', 'CargoDirection', 'VehicleType', 'LicensePlate', 'ContainerNo', 'WeightKg', 'Company', 'DriverName', 'DriverPhone', 'RegistrationDate', 'Status', 'Note', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy'],
  GATE_IN: ['GateInID', 'VehicleID', 'TicketNo', 'GateInTime', 'GateInBy', 'Status', 'PrintedAt'],
  YARD: ['YardID', 'VehicleID', 'GateInID', 'InYardTime', 'ReadyToExitTime', 'ReadyToExitBy', 'Status'],
  GATE_OUT: ['GateOutID', 'VehicleID', 'TicketNo', 'GateOutTime', 'GateOutBy', 'Status'],
  FEES: ['FeeID', 'VehicleID', 'CargoDirection', 'VehicleType', 'WeightKg', 'GateInTime', 'GateOutTime', 'TotalHours', 'TotalMinutes', 'ChargeDays', 'UnitPrice', 'TotalAmount', 'CalculatedAt'],
  PRICE_CONFIG: ['PriceID', 'VehicleType', 'MinWeightKg', 'MaxWeightKg', 'PricePerDay', 'EffectiveDate', 'Status'],
  AUDIT_LOG: ['LogID', 'Timestamp', 'UserID', 'UserEmail', 'Action', 'Entity', 'EntityID', 'OldStatus', 'NewStatus', 'Description'],
  SETTINGS: ['SettingKey', 'SettingValue', 'Description', 'UpdatedAt', 'UpdatedBy']
};
