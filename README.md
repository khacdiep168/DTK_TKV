# HỆ THỐNG QUẢN LÝ BÃI XE HÀNG HÓA XUẤT NHẬP KHẨU (DTK LOGISTICS)

Web App quản lý vòng đời phương tiện ra/vào bãi xe hàng hóa xuất nhập khẩu, tích hợp Backend **Google Apps Script** và Cơ sở dữ liệu **Google Sheets**.

---

## 1. TỔNG QUAN HỆ THỐNG

Ứng dụng đáp ứng chuẩn mực theo đặc tả tại [CLAUDE.md](CLAUDE.md) và [DATABASE.md](DATABASE.md):
- **Phân hệ nghiệp vụ**: Xe Nhập Khẩu (`IMPORT`) & Xe Xuất Khẩu (`EXPORT`).
- **Chu trình trạng thái (State Machine)**:
  `REGISTERED` $\rightarrow$ `WAITING_GATE_IN` $\rightarrow$ `IN_YARD` $\rightarrow$ `READY_TO_EXIT` $\rightarrow$ `COMPLETED` (hoặc `CANCELLED`).
- **An toàn giao dịch**: Sử dụng `LockService` chống race condition, chuẩn hóa biển số `normalizeLicensePlate`, kiểm tra điều kiện nghiêm ngặt ở tầng Backend.
- **Tính phí tự động**: Tính số ngày theo block 24 giờ (`CEILING(TotalHours / 24)`, tối thiểu 1 ngày), tra cứu bảng giá động `PRICE_CONFIG` theo loại xe và tải trọng.
- **Tiện ích vận hành**:
  - In phiếu Gate In (khổ nhiệt 80mm và A4/A5) kèm mã **QR Code**.
  - Tính năng **Gọi loa** (`Web Speech API`) phát thanh gọi xe ra cổng.
  - Import danh sách xe từ file **Excel** (`.xlsx`, `.csv`), kiểm định từng dòng/cột lỗi, xem trước và ghi nhận đợt (`IMPORT_BATCH`).
  - Xuất báo cáo doanh thu và đối soát ra file **Excel**.

---

## 2. CẤU TRÚC THƯ MỤC & TẬP TIN

```text
DTK/
├── CLAUDE.md                 # Bộ nguyên tắc nghiệp vụ & thiết kế hệ thống
├── DATABASE.md               # Đặc tả chi tiết 10 bảng Google Sheets
├── appsscript.json           # Manifest cấu hình Google Apps Script
│
├── Code.gs                   # Router chính, doGet() & API dispatchers
├── Config.gs                 # Hằng số cấu hình, enum trạng thái, tên Sheet & Headers
├── DatabaseService.gs        # Tầng truy xuất Google Sheets, LockService, initializeDatabase()
├── Auth.gs                   # Quản lý tài khoản, phân quyền Role (ADMIN, BAI, GATE_IN, YARD, GATE_OUT)
├── Utils.gs                  # Chuẩn hóa biển số, sinh mã vé BAI-YYYYMMDD-XXXXXX, định dạng ngày/giờ
├── ImportService.gs          # Pipeline kiểm định dữ liệu Excel & commit batch
├── VehicleService.gs         # Tra cứu, tìm kiếm phương tiện đăng ký
├── GateInService.gs          # Nghiệp vụ duyệt cổng vào & in vé QR
├── YardService.gs            # Giám sát xe trong bãi, phát hiện > 24h & duyệt READY_TO_EXIT
├── GateOutService.gs         # Đối chiếu biển số thực tế, tính phí & duyệt cổng ra
├── FeeService.gs             # Tra cứu PRICE_CONFIG & tính toán tiền lưu bãi
├── ReportService.gs          # Tổng hợp KPI Dashboard và các báo cáo vận hành
├── AuditService.gs           # Ghi nhận minh bạch lịch sử giao dịch (AUDIT_LOG)
│
├── Index.html                # Master HTML template cho Google Apps Script Web App
├── Styles.html               # Hệ thống CSS Design System (Responsive & In ấn phiếu)
├── Dashboard.html            # Phân hệ Tổng quan & Biểu đồ KPI
├── GateIn.html               # Phân hệ Cổng Vào (Gate In)
├── Yard.html                 # Phân hệ Trong Bãi (Yard)
├── GateOut.html              # Phân hệ Cổng Ra (Gate Out)
├── Import.html               # Phân hệ Tải & Import file Excel
├── Reports.html              # Phân hệ Báo cáo & Đối soát doanh thu
├── Settings.html             # Phân hệ Cấu hình bảng giá, Người dùng & Khởi tạo DB
├── Components.html           # Các Modal in phiếu, biên lai thanh toán & form nhập
├── Scripts.html              # Bộ điều khiển Client-side SPA
│
├── standalone_preview.html   # Bản HTML đóng gói độc lập để chạy thử trực tiếp trên trình duyệt
└── serve.js                  # Local server Node.js phục vụ chạy thử nghiệm
```

---

## 3. HƯỚNG DẪN TRIỂN KHAI LÊN GOOGLE APPS SCRIPT

### Bước 1: Tạo Google Spreadsheet mới
1. Mở [Google Sheets](https://sheets.new) và tạo 1 bảng tính mới đặt tên (ví dụ: `DTK_Database_BaiXe`).
2. Vào menu **Tiện ích mở rộng (Extensions)** $\rightarrow$ chọn **Apps Script**.

### Bước 2: Nạp các file mã nguồn vào Apps Script
Trong giao diện trình chỉnh sửa Apps Script:
1. Tạo các file tập lệnh (Script files `.gs`) tương ứng:
   - `Config.gs`
   - `Utils.gs`
   - `AuditService.gs`
   - `DatabaseService.gs`
   - `Auth.gs`
   - `FeeService.gs`
   - `ImportService.gs`
   - `VehicleService.gs`
   - `GateInService.gs`
   - `YardService.gs`
   - `GateOutService.gs`
   - `ReportService.gs`
   - `Code.gs`
2. Tạo các file HTML tương ứng (HTML files `.html`):
   - `Styles.html`
   - `Dashboard.html`
   - `GateIn.html`
   - `Yard.html`
   - `GateOut.html`
   - `Import.html`
   - `Reports.html`
   - `Settings.html`
   - `Components.html`
   - `Scripts.html`
   - `Index.html`
3. Cập nhật file `appsscript.json` (bật hiển thị file kê khai trong phần Cài đặt dự án).

### Bước 3: Khởi tạo Cơ sở dữ liệu 10 Sheet
1. Trong Apps Script Editor, chọn hàm `apiInitializeDatabase` và bấm **Chạy (Run)**.
2. Cấp quyền truy cập Spreadsheet cho Script theo hướng dẫn của Google.
3. Google Sheets sẽ tự động tạo đủ 10 bảng chuẩn:
   - `USERS`: Quản lý tài khoản và phân quyền
   - `VEHICLE_REGISTER`: Đăng ký phương tiện
   - `IMPORT_BATCH`: Lịch sử đợt import
   - `GATE_IN`: Dữ liệu xe vào bãi & số vé
   - `YARD`: Giám sát xe lưu bãi & duyệt chờ ra
   - `GATE_OUT`: Dữ liệu xe xuất bãi
   - `FEES`: Bản ghi chi phí lưu bãi
   - `PRICE_CONFIG`: Bảng giá theo ngày và tải trọng
   - `AUDIT_LOG`: Nhật ký kiểm toán toàn hệ thống
   - `SETTINGS`: Cấu hình hệ thống (Timezone, Tiền tố vé...)

### Bước 4: Triển khai Web App
1. Bấm nút **Triển khai (Deploy)** $\rightarrow$ **Tùy chọn triển khai mới (New deployment)**.
2. Chọn loại: **Ứng dụng web (Web app)**.
3. Cấu hình:
   - **Thực thi dưới dạng (Execute as)**: *Tôi (Tài khoản của bạn)*.
   - **Ai có quyền truy cập (Who has access)**: *Bất kỳ ai (Anyone)* hoặc theo miền nội bộ công ty.
4. Bấm **Triển khai (Deploy)** và sao chép đường link Web App URL để nhân viên bắt đầu sử dụng.

---

## 4. CHẠY THỬ NGHIỆM LOCAL (OFFLINE PREVIEW)

Ứng dụng tích hợp sẵn cơ chế **Mock Engine**:
- Khi chạy trong Google Apps Script, hệ thống tự động kết nối qua `google.script.run` tới Google Sheets.
- Khi mở file `standalone_preview.html` trên máy tính hoặc chạy local server:
  ```bash
  node serve.js
  ```
  Truy cập vào: [http://localhost:3000](http://localhost:3000) để trải nghiệm đầy đủ toàn bộ luồng nghiệp vụ trên dữ liệu mẫu offline.
