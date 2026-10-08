// bundle_deployment.js
const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const deployDir = path.join(baseDir, 'deploy');

if (!fs.existsSync(deployDir)) {
  fs.mkdirSync(deployDir, { recursive: true });
}

// 1. Combine Backend .gs files in proper order
const gsFiles = [
  'Config.gs',
  'Utils.gs',
  'AuditService.gs',
  'DatabaseService.gs',
  'Auth.gs',
  'FeeService.gs',
  'ImportService.gs',
  'VehicleService.gs',
  'GateInService.gs',
  'YardService.gs',
  'GateOutService.gs',
  'ReportService.gs'
];

let combinedBackend = `/**
 * DTK LOGISTICS - QUẢN LÝ BÃI XE HÀNG HÓA XUẤT NHẬP KHẨU
 * Backend Server-side cho Google Apps Script
 * Kết nối Google Spreadsheet ID: 1wZicF5pXnYOY8crfQo0nQISpD8n3XnnCUrg54TKN6MQ
 * Tự động tạo 10 Sheet & xử lý giao dịch đồng thời với LockService
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(CONFIG.APP_NAME || 'Quản Lý Bãi Xe Xuất Nhập Khẩu')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

`;

gsFiles.forEach(file => {
  const content = fs.readFileSync(path.join(baseDir, file), 'utf8');
  combinedBackend += `\n/* ==========================================================================\n   MODULE: ${file}\n   ========================================================================== */\n\n` + content + '\n';
});

// Append API dispatchers from Code.gs (excluding doGet/include already defined at top)
const codeGs = fs.readFileSync(path.join(baseDir, 'Code.gs'), 'utf8');
const codeGsApis = codeGs.replace(/function doGet[\s\S]*?function include[\s\S]*?\}\n/, '');
combinedBackend += `\n/* ==========================================================================\n   API DISPATCHERS (google.script.run Endpoints)\n   ========================================================================== */\n\n` + codeGsApis;

fs.writeFileSync(path.join(deployDir, 'Code.gs'), combinedBackend, 'utf8');
console.log('Successfully created deploy/Code.gs');

// 2. Prepare deploy/Index.html from standalone_preview.html
const previewHtml = fs.readFileSync(path.join(baseDir, 'standalone_preview.html'), 'utf8');
fs.writeFileSync(path.join(deployDir, 'Index.html'), previewHtml, 'utf8');
console.log('Successfully created deploy/Index.html');

// 3. Copy appsscript.json
fs.copyFileSync(path.join(baseDir, 'appsscript.json'), path.join(deployDir, 'appsscript.json'));
console.log('Successfully copied deploy/appsscript.json');
