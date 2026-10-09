// build_preview.js
const fs = require('fs');
const path = require('path');

const baseDir = __dirname;

const styles = fs.readFileSync(path.join(baseDir, 'Styles.html'), 'utf8');
const dashboard = fs.readFileSync(path.join(baseDir, 'Dashboard.html'), 'utf8');
const gatein = fs.readFileSync(path.join(baseDir, 'GateIn.html'), 'utf8');
const yard = fs.readFileSync(path.join(baseDir, 'Yard.html'), 'utf8');
const gateout = fs.readFileSync(path.join(baseDir, 'GateOut.html'), 'utf8');
const imports = fs.readFileSync(path.join(baseDir, 'Import.html'), 'utf8');
const reports = fs.readFileSync(path.join(baseDir, 'Reports.html'), 'utf8');
const settings = fs.readFileSync(path.join(baseDir, 'Settings.html'), 'utf8');
const components = fs.readFileSync(path.join(baseDir, 'Components.html'), 'utf8');
const scripts = fs.readFileSync(path.join(baseDir, 'Scripts.html'), 'utf8');

// Build standalone HTML
const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Quản Lý Bãi Xe Hàng Hóa Xuất Nhập Khẩu - DTK LOGISTICS</title>

  <!-- Google Fonts: Inter -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

  <!-- Bootstrap 5.3 CSS & Icons -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">

  <!-- SweetAlert2 CSS -->
  <link href="https://cdn.jsdelivr.net/npm/sweetalert2@11.10.5/dist/sweetalert2.min.css" rel="stylesheet">

  ${styles}
</head>
<body>

  <div class="app-wrapper">
    <div class="sidebar-backdrop" id="sidebar-backdrop" onclick="toggleSidebar(false)"></div>

    <aside class="app-sidebar" id="sidebar">
      <div class="sidebar-header">
        <img src="Logo/logo.png" onerror="this.src='https://api.iconify.design/bi:truck-front-fill.svg?color=%232563eb'" class="sidebar-logo" alt="Logo">
        <div class="sidebar-brand">
          DTK LOGISTICS
          <small>QUẢN LÝ BÃI XE XUẤT NHẬP KHẨU</small>
        </div>
      </div>

      <ul class="sidebar-nav">
        <li class="nav-section-title">Tổng quan</li>
        <li class="nav-item">
          <a class="nav-link active" id="nav-dashboard" onclick="navigateTo('dashboard')">
            <i class="bi bi-grid-1x2"></i>
            <span>Dashboard</span>
          </a>
        </li>

        <li class="nav-section-title">Quy trình cổng & bãi</li>
        <li class="nav-item">
          <a class="nav-link" id="nav-gatein" onclick="navigateTo('gatein')">
            <i class="bi bi-box-arrow-in-right text-primary"></i>
            <span>Cổng Vào (Gate In)</span>
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link" id="nav-yard" onclick="navigateTo('yard')">
            <i class="bi bi-building text-warning"></i>
            <span>Trong Bãi (Yard)</span>
            <span class="nav-badge" id="sidebar-yard-count">0</span>
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link" id="nav-gateout" onclick="navigateTo('gateout')">
            <i class="bi bi-box-arrow-right text-success"></i>
            <span>Cổng Ra (Gate Out)</span>
          </a>
        </li>

        <li class="nav-section-title">Dữ liệu & Báo cáo</li>
        <li class="nav-item">
          <a class="nav-link" id="nav-import" onclick="navigateTo('import')">
            <i class="bi bi-file-earmark-arrow-up"></i>
            <span>Import Excel</span>
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link" id="nav-reports" onclick="navigateTo('reports')">
            <i class="bi bi-file-earmark-bar-graph"></i>
            <span>Báo Cáo & Đối Soát</span>
          </a>
        </li>

        <li class="nav-section-title">Hệ thống</li>
        <li class="nav-item">
          <a class="nav-link" id="nav-settings" onclick="navigateTo('settings')">
            <i class="bi bi-sliders"></i>
            <span>Cấu Hình & Bảng Giá</span>
          </a>
        </li>
      </ul>
    </aside>

    <main class="app-main">
      <header class="app-header">
        <div class="header-left">
          <button class="menu-toggle-btn" type="button" onclick="toggleSidebar()">
            <i class="bi bi-list"></i>
          </button>
          <span class="page-title d-none d-sm-inline">Hệ Thống Quản Lý Bãi Xe</span>
        </div>

        <div class="header-right d-flex align-items-center gap-2">
          <div class="user-profile-badge">
            <div class="user-avatar" id="user-avatar-initial">A</div>
            <div class="d-none d-md-block text-start">
              <div class="fw-bold lh-1" id="user-display-name">Quản Trị Viên</div>
              <small class="text-muted" id="user-role-tag">ADMIN</small>
            </div>
          </div>
          <button class="btn btn-outline-danger btn-sm px-2 py-1 ms-1 fw-semibold" title="Đăng Xuất Khỏi Hệ Thống" onclick="doLogout()">
            <i class="bi bi-box-arrow-right"></i> <span class="d-none d-sm-inline">Đăng Xuất</span>
          </button>
        </div>
      </header>

      <div class="app-content">
        ${dashboard}
        ${gatein}
        ${yard}
        ${gateout}
        ${imports}
        ${reports}
        ${settings}
      </div>
    </main>
  </div>

  ${components}

  <!-- CDN JS Dependencies -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11.10.5/dist/sweetalert2.all.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/davidshimjs-qrcodejs@0.0.2/qrcode.min.js"></script>

  ${scripts}
</body>
</html>
`;

fs.writeFileSync(path.join(baseDir, 'standalone_preview.html'), html, 'utf8');
console.log('Successfully generated standalone_preview.html');
