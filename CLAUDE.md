# CLAUDE.md

## 1. TỔNG QUAN DỰ ÁN

Xây dựng một **Web App quản lý bãi xe hàng hóa xuất nhập khẩu**, phục vụ việc quản lý xe **Nhập Khẩu** và **Xuất Khẩu** ra/vào bãi.

Hệ thống sử dụng:

* **Google Apps Script** làm Backend / Server-side.
* **Google Sheets** làm Database.
* **HTML5 + CSS3 + JavaScript** làm Frontend.
* Có thể sử dụng **Bootstrap** cho giao diện responsive.
* Có thể sử dụng **SweetAlert2** cho thông báo.
* Có thể sử dụng **DataTables** cho các bảng dữ liệu.
* Có thể sử dụng thư viện QR Code để tạo và đọc mã QR.
* Google Drive dùng để lưu file Excel import và các tài liệu nếu cần.

Mục tiêu là xây dựng một hệ thống:

* Đơn giản.
* Hiện đại.
* Chuyên nghiệp.
* Dễ sử dụng.
* Tốc độ thao tác nhanh.
* Phù hợp với nhân viên làm việc tại cổng.
* Hạn chế tối đa thao tác sai.
* Có phân quyền rõ ràng.
* Có lịch sử thao tác.
* Có thể mở rộng trong tương lai.

---

# 2. NGUYÊN TẮC THIẾT KẾ

## 2.1. Không xây dựng hệ thống quá phức tạp

Đây không phải là hệ thống quản lý cảng biển tổng thể.

Phạm vi hiện tại chỉ tập trung vào:

1. Quản lý xe Nhập Khẩu.
2. Quản lý xe Xuất Khẩu.
3. Import danh sách xe từ Excel.
4. Quản lý Gate In.
5. Quản lý xe đang ở bãi.
6. Duyệt xe chờ xuất bãi.
7. Quản lý Gate Out.
8. Tự động tính thời gian lưu bãi.
9. Tự động tính phí.
10. Báo cáo và đối soát.

Không tự ý phát triển thêm các module lớn như:

* Quản lý kho.
* Quản lý container đầy đủ.
* Quản lý tàu.
* Quản lý booking.
* Quản lý vận tải.
* Quản lý hải quan chuyên sâu.

Các chức năng trên chỉ được bổ sung khi có yêu cầu mới.

---

# 3. QUY TRÌNH NGHIỆP VỤ TỔNG THỂ

## 3.1. Quy trình chính

```text
NHÀ XE
   |
   | Cung cấp file Excel
   v
NHÂN VIÊN BÃI
   |
   | Import Excel
   v
HỆ THỐNG
   |
   | Kiểm tra dữ liệu
   v
GOOGLE SHEETS
   |
   +-------------------------+
   |                         |
   v                         v
XE NHẬP KHẨU             XE XUẤT KHẨU
   |                         |
   +------------+------------+
                |
                v
             GATE IN
                |
                v
        Kiểm tra thông tin
                |
                v
          Duyệt cho vào
                |
                v
           In phiếu xe
                |
                v
             IN_YARD
                |
                v
       Nhân viên GetIn/GetOut
                |
                v
        Duyệt xe chờ ra
                |
                v
         READY_TO_EXIT
                |
                v
       Cổng ra gọi xe bằng loa
                |
                v
            GATE OUT
                |
                v
       Kiểm tra phiếu / QR
                |
                v
          Duyệt cho ra
                |
                v
            COMPLETED
                |
                v
       Tính thời gian lưu bãi
                |
                v
            Tính phí
```

---

# 4. PHÂN BIỆT XE NHẬP KHẨU VÀ XE XUẤT KHẨU

Hệ thống phải quản lý hai loại nghiệp vụ:

```text
IMPORT = XE NHẬP KHẨU

EXPORT = XE XUẤT KHẨU
```

Không tạo hai database riêng biệt.

Sử dụng chung bảng dữ liệu và phân biệt bằng trường:

```text
CargoDirection
```

Giá trị:

```text
IMPORT
EXPORT
```

Trên giao diện có thể hiển thị thành hai khu vực:

```text
XE NHẬP KHẨU
XE XUẤT KHẨU
```

hoặc sử dụng bộ lọc:

```text
[ TẤT CẢ ] [ NHẬP KHẨU ] [ XUẤT KHẨU ]
```

---

# 5. TRẠNG THÁI XE

Hệ thống phải sử dụng State Machine rõ ràng.

## 5.1. Các trạng thái

```text
REGISTERED
WAITING_GATE_IN
IN_YARD
READY_TO_EXIT
COMPLETED
CANCELLED
```

## 5.2. Ý nghĩa

### REGISTERED

Xe đã được import từ Excel nhưng chưa đến cổng.

### WAITING_GATE_IN

Xe đang trong danh sách chờ Gate In.

### IN_YARD

Xe đã được Gate In thành công và đang ở trong bãi.

### READY_TO_EXIT

Nhân viên GetIn/GetOut đã duyệt xe đủ điều kiện xuất bãi.

### COMPLETED

Xe đã Gate Out thành công.

### CANCELLED

Đăng ký bị hủy.

---

# 6. QUY TRÌNH IMPORT EXCEL

Nhà xe cung cấp file Excel theo mẫu quy định.

Nhân viên bãi upload file lên hệ thống.

Không import trực tiếp vào database ngay.

Phải thực hiện:

```text
Upload Excel
      ↓
Read Excel
      ↓
Validate
      ↓
Preview
      ↓
User Confirm
      ↓
Import Database
```

---

# 7. MẪU EXCEL

File Excel tối thiểu gồm:

| Trường           | Mô tả         |
| ---------------- | ------------- |
| VehicleType      | Loại xe       |
| LicensePlate     | Biển số xe    |
| ContainerNo      | Số container  |
| Weight           | Trọng lượng   |
| Company          | Nhà xe        |
| DriverName       | Tên tài xế    |
| DriverPhone      | Số điện thoại |
| RegistrationDate | Ngày đăng ký  |
| Note             | Ghi chú       |

## 7.1. VehicleType

Cho phép:

```text
CONTAINER
TRUCK
```

## 7.2. CargoDirection

Cho phép:

```text
IMPORT
EXPORT
```

---

# 8. KIỂM TRA DỮ LIỆU KHI IMPORT

Hệ thống phải kiểm tra:

* File đúng định dạng.
* Đúng tên cột.
* Không thiếu cột bắt buộc.
* Biển số xe không rỗng.
* Không trùng biển số trong cùng Batch.
* Không trùng container trong cùng Batch.
* Trọng lượng phải là số.
* Loại xe hợp lệ.
* Loại nghiệp vụ hợp lệ.
* Ngày đăng ký hợp lệ.

Nếu có lỗi:

```text
IMPORT FAILED
```

và hiển thị rõ:

```text
Dòng 15:
Biển số xe bị trùng.

Dòng 22:
Trọng lượng không hợp lệ.

Dòng 31:
Thiếu số container.
```

Không được import một phần dữ liệu nếu người dùng chưa xác nhận.

---

# 9. IMPORT BATCH

Mỗi lần import phải tạo một Batch.

Ví dụ:

```text
BatchID:
IMP-20261007-0001
```

Lưu:

```text
BatchID
FileName
Company
ImportTime
ImportBy
TotalRows
SuccessRows
ErrorRows
Status
```

Mục đích:

* Truy xuất nguồn dữ liệu.
* Biết file nào đã import.
* Biết ai import.
* Biết thời gian import.
* Hỗ trợ đối soát.

---

# 10. GATE IN

## 10.1. Mục tiêu

Nhân viên cổng vào chỉ cần:

1. Nhập biển số hoặc quét QR nếu có.
2. Tìm xe.
3. Kiểm tra thông tin.
4. Duyệt xe.
5. In phiếu.

---

# 11. GIAO DIỆN GATE IN

Thiết kế tối giản.

Ví dụ:

```text
+------------------------------------------------+
|                  GATE IN                       |
+------------------------------------------------+
|                                                |
|  BIỂN SỐ XE                                    |
|  [ 51C-12345                         ] [TÌM]   |
|                                                |
+------------------------------------------------+

THÔNG TIN XE

Biển số       : 51C-12345
Loại xe       : CONTAINER
Nhập/Xuất     : NHẬP KHẨU
Container     : MSCU1234567
Trọng lượng   : -
Nhà xe        : ABC LOGISTICS
Tài xế        : Nguyễn Văn A

             [ DUYỆT CHO VÀO ]
```

Không cho nhân viên Gate In tùy ý sửa thông tin đăng ký.

---

# 12. XỬ LÝ KHI GATE IN

Khi bấm:

```text
DUYỆT CHO VÀO
```

hệ thống:

```text
Status = IN_YARD
GateInTime = Current Timestamp
GateInBy = Current User
```

Đồng thời:

* Tạo số phiếu.
* Tạo QR Code.
* Lưu lịch sử.
* In phiếu.

---

# 13. SỐ PHIẾU

Format:

```text
BAI-YYYYMMDD-XXXXXX
```

Ví dụ:

```text
BAI-20261007-000125
```

Số phiếu phải duy nhất.

Không được trùng.

---

# 14. PHIẾU VÀO BÃI

Phiếu phải có:

```text
TÊN ĐƠN VỊ / BÃI XE

PHIẾU VÀO BÃI

Số phiếu:
BAI-20261007-000125

Biển số:
51C-12345

Loại xe:
CONTAINER

Loại nghiệp vụ:
NHẬP KHẨU

Container:
MSCU1234567

Nhà xe:
ABC LOGISTICS

Tài xế:
Nguyễn Văn A

Giờ vào:
07/10/2026 08:35:21

QR CODE

Vui lòng giữ phiếu để làm thủ tục ra bãi.
```

---

# 15. QUẢN LÝ XE TRONG BÃI

Màn hình này dành cho nhân viên GetIn/GetOut.

Hiển thị:

* Biển số.
* Container.
* Loại xe.
* Nhập/Xuất.
* Giờ vào.
* Thời gian đã ở bãi.
* Trạng thái.
* Nút duyệt chờ ra.

Ví dụ:

```text
51C-12345
MSCU1234567
08:35
ĐANG Ở BÃI

[ DUYỆT CHỜ RA ]
```

---

# 16. DUYỆT CHỜ RA

Khi nhân viên GetIn/GetOut bấm:

```text
DUYỆT CHỜ RA
```

hệ thống:

```text
Status = READY_TO_EXIT

ReadyToExitTime = Current Timestamp

ReadyToExitBy = Current User
```

Xe sẽ xuất hiện trong danh sách:

```text
XE ĐƯỢC PHÉP RA
```

tại Gate Out.

---

# 17. GATE OUT

Nhân viên cổng ra xem danh sách:

```text
XE ĐƯỢC PHÉP RA

51C-12345
MSCU1234567
08:35
READY_TO_EXIT
```

Nhân viên gọi loa thông báo cho tài xế.

Khi xe đến cổng:

1. Tài xế xuất trình phiếu.
2. Nhân viên quét QR hoặc nhập số phiếu.
3. Hệ thống hiển thị thông tin.
4. Nhân viên đối chiếu biển số thực tế.
5. Bấm Gate Out.

---

# 18. KIỂM TRA GATE OUT

Không được cho Gate Out nếu:

```text
Status != READY_TO_EXIT
```

Không được cho Gate Out nếu:

* Phiếu không tồn tại.
* QR không hợp lệ.
* Biển số không khớp.
* Phiếu đã sử dụng.
* Xe đã Gate Out.
* Xe chưa Gate In.

Thông báo phải rõ ràng.

Ví dụ:

```text
❌ XE CHƯA ĐƯỢC DUYỆT CHỜ RA
```

hoặc:

```text
❌ BIỂN SỐ XE KHÔNG KHỚP
```

---

# 19. GATE OUT THÀNH CÔNG

Khi bấm:

```text
DUYỆT CHO XE RA
```

hệ thống:

```text
Status = COMPLETED

GateOutTime = Current Timestamp

GateOutBy = Current User
```

Sau đó tự động:

```text
Calculate Duration
Calculate Charge Days
Calculate Fee
```

---

# 20. TÍNH THỜI GIAN LƯU BÃI

Hệ thống lưu chính xác:

```text
GateInTime
GateOutTime
```

Ví dụ:

```text
Gate In:
07/10/2026 08:35:21

Gate Out:
07/10/2026 16:40:10
```

Thời gian lưu:

```text
8 giờ 04 phút 49 giây
```

---

# 21. QUY TẮC TÍNH NGÀY

Phí được tính theo block 24 giờ.

Công thức:

```text
ChargeDays = CEILING(TotalHours / 24)
```

Tuy nhiên:

```text
Thời gian <= 24 giờ
=> 1 ngày
```

```text
24 giờ < thời gian <= 48 giờ
=> 2 ngày
```

```text
48 giờ < thời gian <= 72 giờ
=> 3 ngày
```

Luôn tối thiểu:

```text
1 ngày
```

---

# 22. BẢNG GIÁ

Tạo Sheet:

```text
PRICE_CONFIG
```

Dữ liệu mặc định:

| Loại xe   | Điều kiện | Giá/ngày |
| --------- | --------- | -------: |
| CONTAINER | Tất cả    |   100000 |
| TRUCK     | <= 7 tấn  |    70000 |
| TRUCK     | > 7 tấn   |   100000 |

Giá không được hard-code trực tiếp trong nhiều file code.

Phải lấy từ:

```text
PRICE_CONFIG
```

để Admin có thể thay đổi trong tương lai.

---

# 23. TÍNH PHÍ

## Container

```text
ChargeDays × 100000
```

Ví dụ:

```text
2 ngày × 100000
= 200000 VNĐ
```

## Xe tải <= 7 tấn

```text
ChargeDays × 70000
```

## Xe tải > 7 tấn

```text
ChargeDays × 100000
```

---

# 24. DATABASE GOOGLE SHEETS

Tạo một Google Spreadsheet làm Database.

Không để tất cả dữ liệu trong một Sheet.

Tối thiểu gồm:

```text
USERS
VEHICLE_REGISTER
IMPORT_BATCH
GATE_IN
YARD
GATE_OUT
FEES
PRICE_CONFIG
AUDIT_LOG
SETTINGS
```

---

# 25. SHEET USERS

Các cột:

```text
UserID
Email
FullName
Role
Status
CreatedAt
UpdatedAt
```

Không lưu password nếu sử dụng Google Account authentication.

---

# 26. SHEET VEHICLE_REGISTER

Các cột:

```text
VehicleID
BatchID
CargoDirection
VehicleType
LicensePlate
ContainerNo
Weight
Company
DriverName
DriverPhone
RegistrationDate
Status
Note
CreatedAt
CreatedBy
UpdatedAt
UpdatedBy
```

---

# 27. SHEET IMPORT_BATCH

Các cột:

```text
BatchID
FileName
Company
ImportTime
ImportBy
TotalRows
SuccessRows
ErrorRows
Status
Note
```

---

# 28. SHEET GATE_IN

Các cột:

```text
GateInID
VehicleID
TicketNo
GateInTime
GateInBy
Status
PrintedAt
```

---

# 29. SHEET YARD

Các cột:

```text
YardID
VehicleID
GateInID
InYardTime
ReadyToExitTime
ReadyToExitBy
Status
```

---

# 30. SHEET GATE_OUT

Các cột:

```text
GateOutID
VehicleID
TicketNo
GateOutTime
GateOutBy
Status
```

---

# 31. SHEET FEES

Các cột:

```text
FeeID
VehicleID
CargoDirection
VehicleType
Weight
GateInTime
GateOutTime
TotalHours
TotalMinutes
ChargeDays
UnitPrice
TotalAmount
CalculatedAt
```

---

# 32. SHEET PRICE_CONFIG

Các cột:

```text
PriceID
VehicleType
MinWeight
MaxWeight
PricePerDay
EffectiveDate
Status
```

---

# 33. SHEET AUDIT_LOG

Mọi thao tác quan trọng phải được ghi log.

Các cột:

```text
LogID
Timestamp
UserID
UserEmail
Action
Entity
EntityID
OldStatus
NewStatus
Description
```

Các action cần log:

```text
IMPORT
GATE_IN
PRINT_TICKET
READY_TO_EXIT
GATE_OUT
CANCEL
UPDATE
DELETE
LOGIN
```

Không được xóa Audit Log thông qua giao diện thông thường.

---

# 34. PHÂN QUYỀN

## ADMIN

Toàn quyền:

* Dashboard.
* Import.
* Quản lý xe.
* Gate In.
* Yard.
* Gate Out.
* Giá.
* User.
* Báo cáo.
* Audit Log.

## BAI

* Import Excel.
* Xem danh sách xe.
* Xem Batch.

Không được Gate In/Gate Out nếu không được cấp quyền.

## GATE_IN

* Tìm xe.
* Gate In.
* In phiếu.

Không được sửa dữ liệu đăng ký.

## YARD

* Xem xe trong bãi.
* Duyệt Ready To Exit.

## GATE_OUT

* Xem xe Ready To Exit.
* Quét phiếu.
* Gate Out.

---

# 35. DASHBOARD

Dashboard phải đơn giản, trực quan.

Các KPI chính:

```text
XE NHẬP KHẨU HÔM NAY
XE XUẤT KHẨU HÔM NAY
ĐANG TRONG BÃI
CHỜ RA
ĐÃ RA
QUÁ 24 GIỜ
DOANH THU HÔM NAY
```

Có bộ lọc:

```text
Hôm nay
Hôm qua
7 ngày
30 ngày
Khoảng thời gian
```

Có thể hiển thị biểu đồ:

* Số xe theo ngày.
* Nhập khẩu / Xuất khẩu.
* Xe đang trong bãi.
* Doanh thu.

Không làm dashboard quá nhiều biểu đồ.

Ưu tiên KPI và thông tin vận hành.

---

# 36. BÁO CÁO

Tối thiểu:

## Báo cáo xe trong bãi

* Biển số.
* Container.
* Loại xe.
* Nhập/Xuất.
* Giờ vào.
* Thời gian đã lưu.
* Trạng thái.

## Báo cáo xe đã ra

* Biển số.
* Giờ vào.
* Giờ ra.
* Thời gian.
* Số ngày tính phí.
* Đơn giá.
* Thành tiền.

## Báo cáo doanh thu

Theo:

* Ngày.
* Loại xe.
* Nhập/Xuất.
* Nhà xe.

---

# 37. TÌM KIẾM

Cho phép tìm nhanh theo:

```text
Biển số xe
Số container
Số phiếu
Nhà xe
Tài xế
BatchID
```

Ô tìm kiếm phải hỗ trợ tìm gần đúng ở mức hợp lý.

Ví dụ:

```text
51C12345
```

và:

```text
51C-12345
```

có thể được chuẩn hóa để tìm cùng một xe.

---

# 38. CHUẨN HÓA BIỂN SỐ

Khi tìm kiếm hoặc kiểm tra biển số, có thể normalize:

```text
51C-12345
51C 12345
51C12345
```

thành một giá trị chuẩn để so sánh.

Nhưng phải giữ:

```text
LicensePlateOriginal
```

nếu cần truy xuất dữ liệu gốc.

---

# 39. GIAO DIỆN WEB APP

Thiết kế theo phong cách:

**Simple + Modern + Professional**

Không sử dụng giao diện quá nhiều màu.

Ưu tiên:

* Nền sáng.
* Typography rõ ràng.
* Khoảng trắng hợp lý.
* Card KPI.
* Bảng dữ liệu sạch.
* Button rõ ràng.
* Icon vừa phải.
* Responsive.
* Font dễ đọc.
* Các nút thao tác quan trọng có kích thước lớn.

---

# 40. LAYOUT

Desktop:

```text
┌───────────────────────────────────────────────┐
│ LOGO        QUẢN LÝ BÃI XE       USER ▼      │
├──────────────┬────────────────────────────────┤
│              │                                │
│ Dashboard    │                                │
│              │                                │
│ Nhập khẩu    │          CONTENT               │
│ Xuất khẩu    │                                │
│ Gate In      │                                │
│ Trong bãi    │                                │
│ Gate Out     │                                │
│ Báo cáo      │                                │
│              │                                │
│ Cài đặt      │                                │
└──────────────┴────────────────────────────────┘
```

Sidebar có thể thu gọn.

---

# 41. MOBILE / TABLET

Web App phải responsive.

Đặc biệt:

* Gate In.
* Gate Out.
* Yard.

cần sử dụng tốt trên màn hình tablet.

Các nút:

```text
TÌM XE
DUYỆT CHO VÀO
DUYỆT CHỜ RA
DUYỆT CHO RA
```

phải đủ lớn để nhân viên thao tác nhanh.

---

# 42. MÀU TRẠNG THÁI

Dùng màu nhất quán:

```text
REGISTERED       → trung tính
IN_YARD          → xanh
READY_TO_EXIT    → cam
COMPLETED        → xanh lá
CANCELLED        → đỏ
ERROR            → đỏ
```

Không lạm dụng màu.

---

# 43. UX CHO NHÂN VIÊN CỔNG

Đây là yêu cầu quan trọng.

Nhân viên cổng thường thao tác nhanh, có xe chờ phía sau.

Do đó:

* Không bắt nhập nhiều thông tin.
* Không mở nhiều popup không cần thiết.
* Tìm xe nhanh.
* Thông tin quan trọng hiển thị ngay.
* Nút duyệt rõ ràng.
* Có xác nhận trước các thao tác quan trọng.
* Thông báo lỗi dễ hiểu.
* Có âm thanh/thông báo trực quan nếu phù hợp.

Ví dụ khi Gate In thành công:

```text
✓ XE ĐÃ ĐƯỢC DUYỆT VÀO BÃI

Số phiếu:
BAI-20261007-000125

[ IN PHIẾU ]
```

---

# 44. QUY TẮC AN TOÀN DỮ LIỆU

Không cho phép:

* Gate Out xe chưa Gate In.
* Gate Out xe chưa Ready To Exit.
* Gate In xe đã Gate In.
* Gate Out xe đã Completed.
* Tạo số phiếu trùng.
* Tính phí khi chưa có Gate Out.
* Sửa thời gian Gate In/Gate Out tùy tiện.
* Sửa giá lịch sử làm ảnh hưởng dữ liệu đã hoàn thành.
* Xóa dữ liệu giao dịch đã hoàn thành.

Nếu cần chỉnh sửa dữ liệu đã hoàn thành:

```text
Adjustment
+
Reason
+
User
+
Timestamp
+
Audit Log
```

---

# 45. NGUYÊN TẮC GOOGLE SHEETS

Google Sheets được xem là Database.

Không cho người dùng nghiệp vụ truy cập trực tiếp vào Google Sheet để chỉnh sửa dữ liệu.

Mọi thao tác phải thực hiện thông qua Web App.

Chỉ Admin/Developer được quyền quản lý Spreadsheet trực tiếp.

---

# 46. HIỆU NĂNG GOOGLE APPS SCRIPT

Không đọc từng dòng bằng nhiều lần gọi:

```javascript
getRange(...).getValue()
```

trong vòng lặp.

Ưu tiên:

```javascript
getValues()
```

đọc một lần.

Xử lý dữ liệu trong JavaScript.

Sau đó:

```javascript
setValues()
```

một lần.

Hạn chế tối đa số lần gọi Spreadsheet API.

---

# 47. LOCK KHI THAO TÁC GATE IN / GATE OUT

Do có thể có nhiều nhân viên cùng thao tác, phải sử dụng:

```javascript
LockService
```

đối với các thao tác quan trọng:

* Tạo số phiếu.
* Gate In.
* Ready To Exit.
* Gate Out.
* Tính phí.

Mục tiêu tránh:

```text
2 nhân viên cùng Gate Out một xe
```

hoặc:

```text
2 phiếu có cùng TicketNo
```

---

# 48. TIMEZONE

Hệ thống sử dụng:

```text
Asia/Ho_Chi_Minh
```

Không dùng timezone mặc định của server nếu có thể tránh.

Tất cả timestamp phải thống nhất.

Format hiển thị:

```text
dd/MM/yyyy HH:mm:ss
```

---

# 49. ERROR HANDLING

Backend phải trả về response thống nhất.

Ví dụ:

```javascript
{
  success: true,
  message: "Gate In thành công",
  data: {}
}
```

Khi lỗi:

```javascript
{
  success: false,
  message: "Xe chưa được đăng ký",
  code: "VEHICLE_NOT_FOUND"
}
```

Frontend không được tự suy đoán lỗi.

---

# 50. CẤU TRÚC CODE

Đề xuất:

```text
BAI_XE_WEB_APP/

├── Code.gs
├── Config.gs
├── Auth.gs
├── Utils.gs
├── ImportService.gs
├── VehicleService.gs
├── GateInService.gs
├── YardService.gs
├── GateOutService.gs
├── FeeService.gs
├── ReportService.gs
├── AuditService.gs
│
├── Index.html
├── Login.html
├── Dashboard.html
├── Import.html
├── GateIn.html
├── Yard.html
├── GateOut.html
├── Reports.html
├── Settings.html
│
├── Styles.html
├── Scripts.html
└── Components.html
```

Không viết toàn bộ hệ thống trong một file `Code.gs`.

---

# 51. NGUYÊN TẮC CODE

Code phải:

* Dễ đọc.
* Có comment ở những đoạn nghiệp vụ quan trọng.
* Không hard-code giá.
* Không hard-code Sheet ID nếu có thể cấu hình.
* Không hard-code Role.
* Không lặp code.
* Tách Business Logic khỏi UI.
* Tách Database Access khỏi Business Logic.
* Có validation ở Backend.
* Frontend validation chỉ mang tính hỗ trợ UX.

Backend luôn là nơi kiểm tra cuối cùng.

---

# 52. CẤU TRÚC SERVICE

Ví dụ:

```text
ImportService
    importExcel()
    validateImport()
    previewImport()
    commitImport()

VehicleService
    findVehicle()
    getVehicleById()
    getVehicles()

GateInService
    checkGateInEligibility()
    gateIn()
    printTicket()

YardService
    getVehiclesInYard()
    readyToExit()

GateOutService
    checkGateOutEligibility()
    gateOut()

FeeService
    calculateDuration()
    calculateChargeDays()
    calculateFee()

AuditService
    writeLog()
```

---

# 53. KHÔNG ĐỂ FRONTEND QUYẾT ĐỊNH TRẠNG THÁI

Ví dụ không được gửi:

```javascript
status: "COMPLETED"
```

và backend tin ngay.

Backend phải tự kiểm tra:

```text
Current Status
      ↓
Eligibility
      ↓
Allowed Transition
      ↓
Update Status
```

Ví dụ:

```text
IN_YARD
   ↓
READY_TO_EXIT
```

được phép.

Nhưng:

```text
REGISTERED
   ↓
COMPLETED
```

không được phép.

---

# 54. AUDIT

Mọi nghiệp vụ quan trọng phải ghi:

```text
Ai?
Lúc nào?
Làm gì?
Đối tượng nào?
Trạng thái trước?
Trạng thái sau?
```

Ví dụ:

```text
07/10/2026 15:30:22

User:
gateout01

Action:
GATE_OUT

Vehicle:
51C-12345

OldStatus:
READY_TO_EXIT

NewStatus:
COMPLETED
```

---

# 55. MỞ RỘNG TRONG TƯƠNG LAI

Thiết kế hiện tại phải để dành khả năng mở rộng:

```text
QR Code
Barcode
Camera
OCR biển số
Máy in
Máy đọc QR
API
Mobile App
Thông báo
Loa gọi xe
```

Nhưng **không triển khai các chức năng này trong MVP nếu chưa được yêu cầu**.

---

# 56. MỤC TIÊU MVP

Version đầu tiên phải hoàn thành được toàn bộ vòng đời:

```text
Excel
  ↓
Import
  ↓
Đăng ký xe
  ↓
Gate In
  ↓
In phiếu
  ↓
Xe trong bãi
  ↓
Ready To Exit
  ↓
Gate Out
  ↓
Tính thời gian
  ↓
Tính phí
  ↓
Báo cáo
```

Nếu toàn bộ luồng trên chạy ổn định thì MVP được xem là hoàn thành.

---

# 57. CHECKLIST NGHIỆM THU

## Import

* [ ] Import Excel thành công.
* [ ] Validate file.
* [ ] Phát hiện dữ liệu trùng.
* [ ] Preview trước khi import.
* [ ] Tạo Batch.
* [ ] Ghi Audit Log.

## Gate In

* [ ] Tìm được xe.
* [ ] Kiểm tra trạng thái.
* [ ] Gate In thành công.
* [ ] Tạo Ticket.
* [ ] In phiếu.
* [ ] Tạo QR.
* [ ] Ghi Audit Log.

## Yard

* [ ] Hiển thị xe đang ở bãi.
* [ ] Tính thời gian đang lưu.
* [ ] Ready To Exit.
* [ ] Ghi người duyệt.

## Gate Out

* [ ] Tìm bằng Ticket.
* [ ] Tìm bằng QR.
* [ ] Kiểm tra biển số.
* [ ] Kiểm tra trạng thái.
* [ ] Gate Out.
* [ ] Tính thời gian.
* [ ] Tính số ngày.
* [ ] Tính phí.
* [ ] Ghi Audit Log.

## Báo cáo

* [ ] Xe nhập khẩu.
* [ ] Xe xuất khẩu.
* [ ] Xe trong bãi.
* [ ] Xe đã ra.
* [ ] Doanh thu.
* [ ] Lọc theo ngày.
* [ ] Lọc theo nhà xe.
* [ ] Lọc theo loại xe.

---

# 58. YÊU CẦU QUAN TRỌNG CHO CLAUDE CODE

Khi phát triển dự án:

1. Đọc toàn bộ `CLAUDE.md` trước khi code.
2. Không tự ý thay đổi nghiệp vụ.
3. Không tự ý thêm module ngoài phạm vi.
4. Không tự ý thay đổi tên Sheet/Column đã thống nhất.
5. Không hard-code nghiệp vụ nếu có thể đưa vào Config.
6. Ưu tiên code đơn giản và dễ bảo trì.
7. Backend phải validate tất cả nghiệp vụ quan trọng.
8. Không tin dữ liệu từ frontend.
9. Luôn ghi Audit Log cho giao dịch.
10. Không xóa dữ liệu giao dịch đã hoàn thành.
11. Sử dụng `LockService` cho các transaction quan trọng.
12. Tối ưu số lần đọc/ghi Google Sheets.
13. Giao diện phải responsive.
14. Giao diện phải đơn giản, hiện đại, chuyên nghiệp.
15. Các màn hình Gate In/Gate Out phải tối ưu cho thao tác nhanh.
16. Khi phát hiện lỗi nghiệp vụ, phải báo lỗi rõ ràng bằng tiếng Việt.
17. Không triển khai chức năng mới nếu chưa được yêu cầu.
18. Trước khi thay đổi database structure, phải kiểm tra toàn bộ code đang sử dụng cấu trúc đó.
19. Khi hoàn thành mỗi module, phải kiểm tra luồng nghiệp vụ end-to-end.
20. Ưu tiên tính ổn định và chính xác dữ liệu hơn hiệu ứng giao diện.

---

# 59. PHONG CÁCH GIAO DIỆN

Thiết kế theo tinh thần:

> **Simple – Modern – Professional – Fast**

Không thiết kế giao diện giống một hệ thống ERP cũ.

Không sử dụng quá nhiều:

* Gradient.
* Animation.
* Popup.
* Màu sắc.
* Icon trang trí.
* Card không cần thiết.

Ưu tiên:

* Typography rõ.
* Layout sạch.
* Khoảng trắng tốt.
* Button lớn ở màn hình Gate.
* Bảng dữ liệu dễ đọc.
* Trạng thái rõ ràng.
* Thao tác tối thiểu.

Đặc biệt:

### Gate In

Nhân viên phải có thể hoàn thành một lượt xe trong vài thao tác.

### Gate Out

Nhân viên phải có thể:

```text
Quét phiếu
    ↓
Kiểm tra
    ↓
Duyệt
```

mà không phải qua nhiều màn hình.

---

# 60. KẾT LUẬN

Đây là một Web App quản lý **vòng đời xe ra/vào bãi**, không phải hệ thống quản lý cảng tổng thể.

Trọng tâm của hệ thống là:

```text
IMPORT EXCEL
      ↓
VEHICLE REGISTRATION
      ↓
GATE IN
      ↓
TICKET
      ↓
IN YARD
      ↓
READY TO EXIT
      ↓
GATE OUT
      ↓
DURATION
      ↓
FEE
      ↓
REPORT
```

Ba nguyên tắc quan trọng nhất:

### 1. Không cho xe sai vào bãi.

### 2. Không cho xe chưa được duyệt ra khỏi bãi.

### 3. Mọi giao dịch phải truy được ai đã thực hiện và thực hiện lúc nào.

### 4. Sử dụng tốt trên mọi thiết bị (máy tính pc, laptop, mobiphone  )
Hệ thống phải được xây dựng theo hướng **đơn giản cho nhân viên vận hành nhưng chặt chẽ ở tầng nghiệp vụ và dữ liệu**.
