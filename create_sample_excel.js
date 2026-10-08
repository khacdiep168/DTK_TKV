// create_sample_excel.js
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const sampleVehicles = [
  {
    'VehicleType': 'CONTAINER',
    'CargoDirection': 'IMPORT',
    'LicensePlate': '51C-123.45',
    'ContainerNo': 'MSCU1234567',
    'WeightKg': 28500,
    'Company': 'ABC LOGISTICS',
    'DriverName': 'Nguyễn Văn An',
    'DriverPhone': '0903123456',
    'RegistrationDate': '08/10/2026',
    'Note': 'Hàng linh kiện điện tử nhập khẩu cảng Cát Lái'
  },
  {
    'VehicleType': 'CONTAINER',
    'CargoDirection': 'EXPORT',
    'LicensePlate': '50H-987.65',
    'ContainerNo': 'TEMU9988776',
    'WeightKg': 30200,
    'Company': 'TÂN CẢNG LOGISTICS',
    'DriverName': 'Trần Văn Bình',
    'DriverPhone': '0918765432',
    'RegistrationDate': '08/10/2026',
    'Note': 'Container hàng may mặc xuất khẩu đi Mỹ'
  },
  {
    'VehicleType': 'TRUCK',
    'CargoDirection': 'EXPORT',
    'LicensePlate': '29C-678.90',
    'ContainerNo': '',
    'WeightKg': 6500,
    'Company': 'VẬN TẢI THÀNH PHÁT',
    'DriverName': 'Lê Hoàng Cường',
    'DriverPhone': '0988654321',
    'RegistrationDate': '08/10/2026',
    'Note': 'Xe tải 6.5 tấn chở nông sản xuất khẩu'
  },
  {
    'VehicleType': 'TRUCK',
    'CargoDirection': 'IMPORT',
    'LicensePlate': '60C-888.99',
    'ContainerNo': '',
    'WeightKg': 12500,
    'Company': 'ĐỒNG NAI TRANS',
    'DriverName': 'Phạm Quốc Dũng',
    'DriverPhone': '0977112233',
    'RegistrationDate': '08/10/2026',
    'Note': 'Xe tải nặng 12.5 tấn nhận hàng sắt thép'
  },
  {
    'VehicleType': 'CONTAINER',
    'CargoDirection': 'IMPORT',
    'LicensePlate': '15C-345.67',
    'ContainerNo': 'ONEU5544332',
    'WeightKg': 26000,
    'Company': 'HẢI PHÒNG MARITIME',
    'DriverName': 'Vũ Đức Em',
    'DriverPhone': '0933445566',
    'RegistrationDate': '08/10/2026',
    'Note': 'Cont đông lạnh nhập khẩu'
  },
  {
    'VehicleType': 'TRUCK',
    'CargoDirection': 'IMPORT',
    'LicensePlate': '61C-456.78',
    'ContainerNo': '',
    'WeightKg': 5200,
    'Company': 'BÌNH DƯƠNG EXPRESS',
    'DriverName': 'Đỗ Hùng Giang',
    'DriverPhone': '0966778899',
    'RegistrationDate': '08/10/2026',
    'Note': 'Xe tải nhẹ 5.2 tấn chở bao bì carton'
  },
  {
    'VehicleType': 'CONTAINER',
    'CargoDirection': 'EXPORT',
    'LicensePlate': '51D-789.01',
    'ContainerNo': 'CMAU8877665',
    'WeightKg': 31000,
    'Company': 'SAI GON SHIPLOG',
    'DriverName': 'Bùi Văn Hùng',
    'DriverPhone': '0944556677',
    'RegistrationDate': '08/10/2026',
    'Note': 'Cont hạt điều xuất khẩu châu Âu'
  },
  {
    'VehicleType': 'TRUCK',
    'CargoDirection': 'EXPORT',
    'LicensePlate': '72C-234.56',
    'ContainerNo': '',
    'WeightKg': 15000,
    'Company': 'VŨNG TÀU TRANSPORT',
    'DriverName': 'Ngô Đình Khôi',
    'DriverPhone': '0922334455',
    'RegistrationDate': '08/10/2026',
    'Note': 'Xe tải 3 chân 15 tấn xuất hàng vật tư'
  }
];

// Tạo Worksheet
const ws = XLSX.utils.json_to_sheet(sampleVehicles, {
  header: [
    'VehicleType',
    'CargoDirection',
    'LicensePlate',
    'ContainerNo',
    'WeightKg',
    'Company',
    'DriverName',
    'DriverPhone',
    'RegistrationDate',
    'Note'
  ]
});

// Định dạng độ rộng cột (Column Widths)
ws['!cols'] = [
  { wch: 15 }, // VehicleType
  { wch: 16 }, // CargoDirection
  { wch: 16 }, // LicensePlate
  { wch: 16 }, // ContainerNo
  { wch: 14 }, // WeightKg
  { wch: 25 }, // Company
  { wch: 20 }, // DriverName
  { wch: 15 }, // DriverPhone
  { wch: 18 }, // RegistrationDate
  { wch: 38 }  // Note
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'DanhSachXeDangKy');

// 1. Xuất file .xlsx
const xlsxPath = path.join(__dirname, 'Mau_Dang_Ky_Xe_Import.xlsx');
XLSX.writeFile(wb, xlsxPath);
console.log('Đã tạo thành công file Excel:', xlsxPath);

// 2. Xuất thêm file .csv
const csvPath = path.join(__dirname, 'Mau_Dang_Ky_Xe_Import.csv');
const csvContent = XLSX.utils.sheet_to_csv(ws);
fs.writeFileSync(csvPath, '\uFEFF' + csvContent, 'utf8'); // UTF-8 BOM cho Excel tiếng Việt
console.log('Đã tạo thành công file CSV:', csvPath);
