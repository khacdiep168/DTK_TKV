# DATABASE.md

# DATABASE SPECIFICATION

## Hệ thống Quản lý Bãi xe Nhập khẩu & Xuất khẩu

---

## 1. MỤC ĐÍCH

File này định nghĩa toàn bộ cấu trúc database của hệ thống.

Database sử dụng:

* Google Sheets làm database chính.
* Google Apps Script làm backend/API.
* HTML/CSS/JavaScript làm frontend.

Claude Code phải tuân thủ chính xác cấu trúc, tên Sheet, tên cột, trạng thái và quy tắc nghiệp vụ trong file này.

Không tự ý:

* đổi tên Sheet;
* đổi tên column;
* đổi kiểu dữ liệu;
* thêm trạng thái mới;
* thay đổi quy tắc tính phí;
* thay đổi workflow;

nếu chưa có yêu cầu rõ ràng.

---

# 2. DATABASE ARCHITECTURE

Database gồm các Sheet:

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

Quan hệ tổng quát:

```text
IMPORT_BATCH
     │
     ▼
VEHICLE_REGISTER
     │
     ├──────────────► GATE_IN
     │                   │
     │                   ▼
     │                  YARD
     │                   │
     │                   ▼
     └──────────────► GATE_OUT
                         │
                         ▼
                       FEES
```

`AUDIT_LOG` ghi nhận các thao tác quan trọng trong toàn hệ thống.

`USERS` quản lý tài khoản và quyền.

`SETTINGS` chứa các cấu hình hệ thống.

---

# 3. QUY ƯỚC DỮ LIỆU

## 3.1 DateTime

Tất cả thời gian phải sử dụng timezone:

```text
Asia/Ho_Chi_Minh
```

Format hiển thị:

```text
dd/MM/yyyy HH:mm:ss
```

Ví dụ:

```text
07/10/2026 10:35:22
```

Trong Google Sheets nên lưu dưới dạng DateTime thực, không lưu dạng text nếu không cần thiết.

---

## 3.2 ID

ID phải duy nhất.

Khuyến nghị:

```text
UUID
```

hoặc:

```text
PREFIX + timestamp + random
```

Ví dụ:

```text
VH-20261007-000001
GI-20261007-000001
GO-20261007-000001
FEE-20261007-000001
```

Không sử dụng số dòng của Google Sheets làm ID.

---

## 3.3 Boolean

Sử dụng:

```text
TRUE
FALSE
```

---

## 3.4 Currency

Đơn vị tiền:

```text
VND
```

Không lưu ký hiệu `₫` trong database.

Ví dụ:

```text
100000
```

---

## 3.5 Weight

Khối lượng sử dụng:

```text
kg
```

hoặc nếu dữ liệu Excel đang sử dụng tấn thì phải convert thống nhất trước khi lưu.

Khuyến nghị database sử dụng:

```text
WeightKg
```

Ví dụ:

```text
6500
7500
12000
```

---

# 4. SHEET: USERS

Quản lý người dùng hệ thống.

## Columns

| # | Column    | Type     | Required | Description          |
| - | --------- | -------- | -------- | -------------------- |
| 1 | UserID    | String   | YES      | ID người dùng        |
| 2 | Email     | String   | YES      | Google Account email |
| 3 | FullName  | String   | YES      | Họ tên               |
| 4 | Role      | String   | YES      | Quyền                |
| 5 | Status    | String   | YES      | Trạng thái           |
| 6 | CreatedAt | DateTime | YES      | Ngày tạo             |
| 7 | UpdatedAt | DateTime | NO       | Ngày cập nhật        |

## Role

Chỉ cho phép:

```text
ADMIN
BAI
GATE_IN
YARD
GATE_OUT
```

## Status

```text
ACTIVE
INACTIVE
```

## Rules

Không lưu password trong Google Sheets.

Authentication sử dụng Google Account.

Email phải unique.

---

# 5. SHEET: IMPORT_BATCH

Lưu thông tin mỗi lần import Excel.

## Columns

| #  | Column      | Type     | Required | Description        |
| -- | ----------- | -------- | -------- | ------------------ |
| 1  | BatchID     | String   | YES      | Mã batch           |
| 2  | FileName    | String   | YES      | Tên file Excel     |
| 3  | Company     | String   | NO       | Đơn vị đăng ký     |
| 4  | ImportTime  | DateTime | YES      | Thời gian import   |
| 5  | ImportBy    | String   | YES      | UserID             |
| 6  | TotalRows   | Number   | YES      | Tổng số dòng       |
| 7  | SuccessRows | Number   | YES      | Số dòng thành công |
| 8  | ErrorRows   | Number   | YES      | Số dòng lỗi        |
| 9  | Status      | String   | YES      | Trạng thái         |
| 10 | Note        | String   | NO       | Ghi chú            |

## Batch Status

```text
PREVIEW
IMPORTED
PARTIAL
FAILED
CANCELLED
```

## Quy trình

```text
Upload Excel
      ↓
PREVIEW
      ↓
Validate
      ↓
User Confirm
      ↓
IMPORT
      ↓
IMPORTED
```

Không được import trực tiếp vào database ngay khi upload.

---

# 6. SHEET: VEHICLE_REGISTER

Đây là bảng đăng ký phương tiện.

Mỗi dòng tương ứng một phương tiện/container đăng ký.

## Columns

| #  | Column           | Type     | Required | Description     |
| -- | ---------------- | -------- | -------- | --------------- |
| 1  | VehicleID        | String   | YES      | ID phương tiện  |
| 2  | BatchID          | String   | YES      | Batch import    |
| 3  | CargoDirection   | String   | YES      | IMPORT/EXPORT   |
| 4  | VehicleType      | String   | YES      | CONTAINER/TRUCK |
| 5  | LicensePlate     | String   | YES      | Biển số         |
| 6  | ContainerNo      | String   | NO       | Số container    |
| 7  | WeightKg         | Number   | NO       | Trọng lượng kg  |
| 8  | Company          | String   | YES      | Đơn vị vận tải  |
| 9  | DriverName       | String   | NO       | Tài xế          |
| 10 | DriverPhone      | String   | NO       | SĐT             |
| 11 | RegistrationDate | DateTime | YES      | Ngày đăng ký    |
| 12 | Status           | String   | YES      | Trạng thái      |
| 13 | Note             | String   | NO       | Ghi chú         |
| 14 | CreatedAt        | DateTime | YES      | Ngày tạo        |
| 15 | CreatedBy        | String   | YES      | Người tạo       |
| 16 | UpdatedAt        | DateTime | NO       | Ngày cập nhật   |
| 17 | UpdatedBy        | String   | NO       | Người cập nhật  |

---

# 7. CARGODIRECTION

Chỉ cho phép:

```text
IMPORT
EXPORT
```

Ý nghĩa:

```text
IMPORT = Xe nhập khẩu
EXPORT = Xe xuất khẩu
```

Không sử dụng các giá trị khác.

---

# 8. VEHICLE TYPE

Chỉ cho phép:

```text
CONTAINER
TRUCK
```

## CONTAINER

Xe/container áp dụng giá container.

## TRUCK

Xe tải áp dụng giá theo trọng lượng.

---

# 9. VEHICLE STATUS

Trạng thái chính:

```text
REGISTERED
WAITING_GATE_IN
IN_YARD
READY_TO_EXIT
COMPLETED
CANCELLED
```

## REGISTERED

Đã import đăng ký.

Xe chưa vào bãi.

## WAITING_GATE_IN

Xe đã đến khu vực cổng và đang chờ xử lý.

## IN_YARD

Xe đã được Gate In xác nhận và đang ở trong bãi.

## READY_TO_EXIT

Bộ phận GetIn/GetOut đã xử lý xong và cho phép xe ra.

## COMPLETED

Xe đã Gate Out thành công.

## CANCELLED

Đăng ký bị hủy.

---

# 10. STATE TRANSITION

Chỉ cho phép các chuyển trạng thái sau:

```text
REGISTERED
    ↓
WAITING_GATE_IN
    ↓
IN_YARD
    ↓
READY_TO_EXIT
    ↓
COMPLETED
```

Có thể:

```text
REGISTERED → CANCELLED
WAITING_GATE_IN → CANCELLED
```

Không cho phép:

```text
REGISTERED → IN_YARD
REGISTERED → COMPLETED
IN_YARD → COMPLETED
COMPLETED → IN_YARD
COMPLETED → READY_TO_EXIT
```

Backend phải kiểm tra state transition.

Frontend không được tự ý thay đổi Status.

---

# 11. NORMALIZE LICENSE PLATE

Biển số phải được normalize trước khi tìm kiếm.

Ví dụ:

```text
51C-12345
51C 12345
51C12345
```

được xem là cùng một biển số.

Function đề xuất:

```javascript
normalizeLicensePlate()
```

Quy tắc:

1. Trim khoảng trắng đầu/cuối.
2. Uppercase.
3. Loại bỏ khoảng trắng.
4. Loại bỏ dấu `-` khi so sánh.
5. Không thay đổi giá trị hiển thị gốc nếu cần in chứng từ.

Ví dụ:

```text
51c-12345
```

normalize thành:

```text
51C12345
```

---

# 12. SHEET: GATE_IN

Lưu thông tin xe vào bãi.

## Columns

| # | Column     | Type     | Required | Description   |
| - | ---------- | -------- | -------- | ------------- |
| 1 | GateInID   | String   | YES      | ID Gate In    |
| 2 | VehicleID  | String   | YES      | VehicleID     |
| 3 | TicketNo   | String   | YES      | Số vé         |
| 4 | GateInTime | DateTime | YES      | Thời gian vào |
| 5 | GateInBy   | String   | YES      | Nhân viên     |
| 6 | Status     | String   | YES      | Trạng thái    |
| 7 | PrintedAt  | DateTime | NO       | Thời gian in  |

## Status

```text
COMPLETED
CANCELLED
```

Một VehicleID chỉ được Gate In một lần cho một lượt hoạt động.

---

# 13. TICKET NUMBER

Format:

```text
BAI-YYYYMMDD-XXXXXX
```

Ví dụ:

```text
BAI-20261007-000125
```

TicketNo phải unique.

Khi tạo TicketNo phải sử dụng:

```text
LockService
```

để tránh duplicate khi nhiều nhân viên Gate In cùng thao tác.

---

# 14. TICKET CONTENT

Phiếu Gate In tối thiểu gồm:

```text
TÊN ĐƠN VỊ / BÃI XE

Số vé:
BAI-20261007-000125

Biển số:
51C12345

Loại xe:
CONTAINER

Chiều:
IMPORT

Container:
MSCU1234567

Đơn vị:
ABC LOGISTICS

Tài xế:
NGUYEN VAN A

Thời gian vào:
07/10/2026 10:35:22

QR CODE

Vui lòng giữ phiếu để làm thủ tục ra cổng.
```

---

# 15. SHEET: YARD

Theo dõi xe đang trong bãi.

## Columns

| # | Column          | Type     | Required | Description        |
| - | --------------- | -------- | -------- | ------------------ |
| 1 | YardID          | String   | YES      | ID                 |
| 2 | VehicleID       | String   | YES      | VehicleID          |
| 3 | GateInID        | String   | YES      | GateInID           |
| 4 | InYardTime      | DateTime | YES      | Thời gian vào      |
| 5 | ReadyToExitTime | DateTime | NO       | Thời gian duyệt ra |
| 6 | ReadyToExitBy   | String   | NO       | Người duyệt        |
| 7 | Status          | String   | YES      | Trạng thái         |

## Status

```text
IN_YARD
READY_TO_EXIT
COMPLETED
```

---

# 16. READY TO EXIT

Khi bộ phận GetIn/GetOut xác nhận xe đã xử lý xong:

```text
IN_YARD
    ↓
READY_TO_EXIT
```

Backend phải cập nhật:

```text
ReadyToExitTime
ReadyToExitBy
```

Đồng thời ghi:

```text
AUDIT_LOG
```

---

# 17. SHEET: GATE_OUT

Lưu thông tin xe ra khỏi bãi.

## Columns

| # | Column      | Type     | Required | Description  |
| - | ----------- | -------- | -------- | ------------ |
| 1 | GateOutID   | String   | YES      | ID           |
| 2 | VehicleID   | String   | YES      | VehicleID    |
| 3 | TicketNo    | String   | YES      | Số vé        |
| 4 | GateOutTime | DateTime | YES      | Thời gian ra |
| 5 | GateOutBy   | String   | YES      | Nhân viên    |
| 6 | Status      | String   | YES      | Trạng thái   |

## Status

```text
COMPLETED
CANCELLED
```

---

# 18. GATE OUT VALIDATION

Gate Out chỉ được thực hiện nếu:

```text
Vehicle.Status == READY_TO_EXIT
```

và:

```text
TicketNo hợp lệ
```

và:

```text
LicensePlate khớp
```

và:

```text
Vehicle chưa COMPLETED
```

và:

```text
Vehicle đã Gate In
```

Nếu bất kỳ điều kiện nào không đạt:

```text
Không cho Gate Out.
```

---

# 19. GATE OUT PROCESS

```text
READY_TO_EXIT
      ↓
Gate Out tìm Ticket
      ↓
Hiển thị thông tin xe
      ↓
Kiểm tra biển số thực tế
      ↓
Xác nhận
      ↓
GATE_OUT
      ↓
Status = COMPLETED
      ↓
Tính thời gian
      ↓
Tính phí
      ↓
AUDIT_LOG
```

---

# 20. SHEET: FEES

Lưu kết quả tính phí.

## Columns

| #  | Column         | Type     | Required | Description      |
| -- | -------------- | -------- | -------- | ---------------- |
| 1  | FeeID          | String   | YES      | ID               |
| 2  | VehicleID      | String   | YES      | VehicleID        |
| 3  | CargoDirection | String   | YES      | IMPORT/EXPORT    |
| 4  | VehicleType    | String   | YES      | CONTAINER/TRUCK  |
| 5  | WeightKg       | Number   | NO       | Trọng lượng      |
| 6  | GateInTime     | DateTime | YES      | Thời gian vào    |
| 7  | GateOutTime    | DateTime | YES      | Thời gian ra     |
| 8  | TotalHours     | Number   | YES      | Tổng số giờ      |
| 9  | TotalMinutes   | Number   | YES      | Tổng số phút     |
| 10 | ChargeDays     | Number   | YES      | Số ngày tính phí |
| 11 | UnitPrice      | Number   | YES      | Đơn giá/ngày     |
| 12 | TotalAmount    | Number   | YES      | Thành tiền       |
| 13 | CalculatedAt   | DateTime | YES      | Thời gian tính   |

---

# 21. DURATION CALCULATION

Thời gian lưu bãi:

```text
GateOutTime - GateInTime
```

Không tính:

```text
RegistrationDate
```

Không tính:

```text
ReadyToExitTime
```

Chỉ tính từ:

```text
GateInTime
```

đến:

```text
GateOutTime
```

---

# 22. TOTAL MINUTES

Công thức:

```text
TotalMinutes =
(GateOutTime - GateInTime) tính theo phút
```

---

# 23. TOTAL HOURS

Có thể lưu số giờ dạng decimal.

Ví dụ:

```text
2 giờ 30 phút
```

lưu:

```text
2.5
```

---

# 24. CHARGE DAYS

Số ngày tính phí:

```text
CEILING(TotalHours / 24)
```

Minimum:

```text
1 ngày
```

Ví dụ:

| Thời gian     | ChargeDays |
| ------------- | ---------: |
| 2 giờ         |          1 |
| 12 giờ        |          1 |
| 24 giờ        |          1 |
| 24 giờ 1 phút |          2 |
| 30 giờ        |          2 |
| 48 giờ        |          2 |
| 48 giờ 1 phút |          3 |

---

# 25. SHEET: PRICE_CONFIG

Không hard-code giá trong frontend.

## Columns

| # | Column        | Type     | Required | Description           |
| - | ------------- | -------- | -------- | --------------------- |
| 1 | PriceID       | String   | YES      | ID                    |
| 2 | VehicleType   | String   | YES      | CONTAINER/TRUCK       |
| 3 | MinWeightKg   | Number   | NO       | Trọng lượng tối thiểu |
| 4 | MaxWeightKg   | Number   | NO       | Trọng lượng tối đa    |
| 5 | PricePerDay   | Number   | YES      | Giá/ngày              |
| 6 | EffectiveDate | DateTime | YES      | Ngày hiệu lực         |
| 7 | Status        | String   | YES      | ACTIVE/INACTIVE       |

---

# 26. PRICING RULE

## Container

```text
VehicleType = CONTAINER
Price = 100000 VND / day
```

---

## Truck <= 7 tons

```text
WeightKg <= 7000
Price = 70000 VND / day
```

---

## Truck > 7 tons

```text
WeightKg > 7000
Price = 100000 VND / day
```

Nếu nghiệp vụ thực tế quy định "dưới 7 tấn" theo nghĩa strict `< 7,000 kg`, phải thay đổi rule thành:

```text
WeightKg < 7000
```

Không tự ý suy diễn trong code.

---

# 27. TOTAL AMOUNT

Công thức:

```text
TotalAmount =
ChargeDays × UnitPrice
```

Ví dụ:

```text
GateIn:
07/10/2026 08:00

GateOut:
07/10/2026 20:00

Duration:
12 giờ

ChargeDays:
1

Container:
100000 VND

TotalAmount:
100000 VND
```

Ví dụ 2:

```text
GateIn:
07/10/2026 08:00

GateOut:
08/10/2026 08:01

Duration:
24 giờ 1 phút

ChargeDays:
2

Container:
100000 VND/day

TotalAmount:
200000 VND
```

---

# 28. SHEET: AUDIT_LOG

Ghi lại các thao tác quan trọng.

## Columns

| #  | Column      | Type     | Required | Description    |
| -- | ----------- | -------- | -------- | -------------- |
| 1  | LogID       | String   | YES      | ID             |
| 2  | Timestamp   | DateTime | YES      | Thời gian      |
| 3  | UserID      | String   | YES      | User           |
| 4  | UserEmail   | String   | YES      | Email          |
| 5  | Action      | String   | YES      | Hành động      |
| 6  | Entity      | String   | YES      | Đối tượng      |
| 7  | EntityID    | String   | YES      | ID đối tượng   |
| 8  | OldStatus   | String   | NO       | Trạng thái cũ  |
| 9  | NewStatus   | String   | NO       | Trạng thái mới |
| 10 | Description | String   | NO       | Nội dung       |

---

# 29. AUDIT ACTION

Các action chuẩn:

```text
LOGIN
IMPORT
GATE_IN
PRINT_TICKET
READY_TO_EXIT
GATE_OUT
CANCEL
UPDATE
DELETE
```

Không được xóa Audit Log trong thao tác thông thường.

---

# 30. SHEET: SETTINGS

Lưu cấu hình hệ thống.

## Columns

| # | Column       | Type     | Required | Description    |
| - | ------------ | -------- | -------- | -------------- |
| 1 | SettingKey   | String   | YES      | Key            |
| 2 | SettingValue | String   | YES      | Value          |
| 3 | Description  | String   | NO       | Mô tả          |
| 4 | UpdatedAt    | DateTime | YES      | Ngày cập nhật  |
| 5 | UpdatedBy    | String   | YES      | Người cập nhật |

Ví dụ:

```text
TIMEZONE
Asia/Ho_Chi_Minh
```

```text
TICKET_PREFIX
BAI
```

```text
COMPANY_NAME
Tên đơn vị
```

```text
TRUCK_WEIGHT_THRESHOLD_KG
7000
```

---

# 31. RELATIONSHIPS

## IMPORT_BATCH → VEHICLE_REGISTER

```text
IMPORT_BATCH.BatchID
        ↓
VEHICLE_REGISTER.BatchID
```

Một Batch có nhiều Vehicle.

```text
1 Batch
   ↓
N Vehicles
```

---

## VEHICLE_REGISTER → GATE_IN

```text
VEHICLE_REGISTER.VehicleID
        ↓
GATE_IN.VehicleID
```

Một lượt đăng ký có tối đa một Gate In đang hoạt động.

---

## VEHICLE_REGISTER → YARD

```text
VEHICLE_REGISTER.VehicleID
        ↓
YARD.VehicleID
```

---

## VEHICLE_REGISTER → GATE_OUT

```text
VEHICLE_REGISTER.VehicleID
        ↓
GATE_OUT.VehicleID
```

---

## VEHICLE_REGISTER → FEES

```text
VEHICLE_REGISTER.VehicleID
        ↓
FEES.VehicleID
```

---

# 32. DATA INTEGRITY

Không được có:

```text
GATE_IN.VehicleID
```

không tồn tại trong:

```text
VEHICLE_REGISTER
```

Không được có:

```text
GATE_OUT.VehicleID
```

không tồn tại trong:

```text
VEHICLE_REGISTER
```

Không được có:

```text
FEES.VehicleID
```

không tồn tại trong:

```text
VEHICLE_REGISTER
```

---

# 33. DUPLICATE RULE

## License Plate

Trong cùng một Batch:

```text
LicensePlate phải unique
```

## Container

Nếu ContainerNo được sử dụng:

```text
ContainerNo phải unique trong cùng Batch
```

## Ticket

```text
TicketNo phải globally unique
```

## User

```text
Email phải unique
```

---

# 34. IMPORT VALIDATION

Trước khi commit Excel:

### Required

```text
LicensePlate
VehicleType
CargoDirection
Company
RegistrationDate
```

### Conditional

Nếu:

```text
VehicleType = CONTAINER
```

thì:

```text
ContainerNo
```

nên được kiểm tra.

Nếu:

```text
VehicleType = TRUCK
```

thì:

```text
WeightKg
```

phải hợp lệ nếu pricing phụ thuộc trọng lượng.

---

# 35. EXCEL IMPORT PIPELINE

Không import trực tiếp.

Pipeline bắt buộc:

```text
UPLOAD
   ↓
READ EXCEL
   ↓
MAP COLUMNS
   ↓
NORMALIZE DATA
   ↓
VALIDATE
   ↓
PREVIEW
   ↓
USER CONFIRM
   ↓
COMMIT
   ↓
CREATE VEHICLE_REGISTER
   ↓
CREATE AUDIT_LOG
```

Nếu validation có lỗi:

```text
Không commit database.
```

---

# 36. IMPORT ERROR

Mỗi lỗi phải chỉ rõ:

```text
Row
Column
Value
Error
```

Ví dụ:

```text
Dòng 15
LicensePlate
51C 12345
Biển số bị trùng
```

hoặc:

```text
Dòng 20
WeightKg
ABC
Trọng lượng không hợp lệ
```

---

# 37. TRANSACTION-LIKE BEHAVIOR

Google Sheets không có transaction như SQL Server.

Do đó phải mô phỏng transaction:

```text
Validate toàn bộ
        ↓
Không lỗi
        ↓
LockService
        ↓
Commit batch
        ↓
Release Lock
```

Không được ghi từng dòng ngay trong lúc validation.

---

# 38. CONCURRENCY

Các thao tác sau bắt buộc dùng:

```javascript
LockService.getScriptLock()
```

### Gate In

Để tránh hai nhân viên Gate In cùng xác nhận một xe.

### Gate Out

Để tránh hai nhân viên Gate Out cùng xác nhận một xe.

### Ticket

Để tránh tạo trùng TicketNo.

### Ready To Exit

Để tránh duyệt trùng.

### Fee

Để tránh tạo trùng bản ghi phí.

---

# 39. SEARCH INDEX

Google Sheets không có database index thực sự.

Do đó backend nên:

1. đọc dữ liệu theo batch;
2. tạo Map trong memory;
3. tìm kiếm trên Map;
4. hạn chế `getRange()` nhiều lần.

Ví dụ:

```javascript
const vehicleMap = new Map();
```

Key có thể là:

```text
NormalizedLicensePlate
```

hoặc:

```text
VehicleID
```

---

# 40. SEARCH FIELDS

Hệ thống phải hỗ trợ tìm kiếm:

```text
LicensePlate
ContainerNo
TicketNo
Company
DriverName
BatchID
VehicleID
```

---

# 41. DASHBOARD DATA

Dashboard cần lấy được:

```text
Xe nhập khẩu hôm nay
Xe xuất khẩu hôm nay
Đang trong bãi
Chờ ra
Đã ra
Quá 24 giờ
Doanh thu hôm nay
```

Không tạo Sheet riêng cho Dashboard.

Dashboard lấy dữ liệu từ các bảng nghiệp vụ.

---

# 42. OVER 24 HOURS

Xe được xem là:

```text
OVER_24_HOURS
```

nếu:

```text
CurrentTime - GateInTime > 24 hours
```

Không cần tạo Status riêng.

Đây là trạng thái tính toán.

---

# 43. CURRENT VEHICLES IN YARD

Danh sách xe đang trong bãi gồm:

```text
Status = IN_YARD
```

hoặc:

```text
Status = READY_TO_EXIT
```

Không bao gồm:

```text
COMPLETED
CANCELLED
```

---

# 44. COMPLETED VEHICLES

Xe đã hoàn tất:

```text
Status = COMPLETED
```

và phải có:

```text
GateInTime
GateOutTime
TicketNo
GateOutBy
```

---

# 45. FEE CREATION RULE

Fee chỉ được tạo sau Gate Out thành công.

Flow:

```text
Gate Out
   ↓
Status = COMPLETED
   ↓
Calculate Duration
   ↓
Calculate ChargeDays
   ↓
Get Price Config
   ↓
Calculate TotalAmount
   ↓
Create FEES
```

Nếu không tìm được Price Config:

```text
Không hoàn tất Gate Out nếu nghiệp vụ yêu cầu tính phí bắt buộc.
```

Backend phải trả lỗi rõ ràng.

---

# 46. PRICE CONFIG SELECTION

Khi tính phí:

1. Tìm `VehicleType`.
2. Nếu TRUCK, xét `WeightKg`.
3. Chọn bản ghi `PRICE_CONFIG` có:

   * `Status = ACTIVE`
   * `EffectiveDate <= GateOutTime`
4. Nếu có nhiều bản ghi phù hợp, lấy bản ghi có `EffectiveDate` mới nhất.

Không hard-code:

```javascript
100000
```

hoặc:

```javascript
70000
```

trong service tính phí.

---

# 47. DELETING DATA

Không được xóa:

```text
COMPLETED
```

transaction trong thao tác thông thường.

Nếu cần điều chỉnh:

```text
UPDATE
```

phải có:

```text
User
Timestamp
Reason
Audit Log
```

---

# 48. DATA CORRECTION

Không sửa trực tiếp Google Sheets đối với dữ liệu giao dịch.

Nếu cần sửa:

```text
Frontend
   ↓
Backend validation
   ↓
Update
   ↓
Audit Log
```

Google Sheets chỉ được xem như database backend.

---

# 49. AUDIT EXAMPLE

Ví dụ Gate In:

```text
Action:
GATE_IN

Entity:
VEHICLE

EntityID:
VH-20261007-000125

OldStatus:
WAITING_GATE_IN

NewStatus:
IN_YARD

Description:
Xe 51C12345 Gate In thành công
```

Ví dụ Gate Out:

```text
Action:
GATE_OUT

Entity:
VEHICLE

EntityID:
VH-20261007-000125

OldStatus:
READY_TO_EXIT

NewStatus:
COMPLETED

Description:
Xe 51C12345 Gate Out thành công
```

---

# 50. DATABASE INITIALIZATION

Khi deploy project lần đầu, hệ thống phải có chức năng:

```text
initializeDatabase()
```

Function này:

1. kiểm tra các Sheet;
2. nếu Sheet chưa tồn tại thì tạo;
3. tạo Header đúng chuẩn;
4. tạo dữ liệu cấu hình mặc định;
5. không xóa dữ liệu cũ.

---

# 51. INITIAL PRICE CONFIG

Dữ liệu mặc định:

```text
CONTAINER
MinWeightKg:
blank

MaxWeightKg:
blank

PricePerDay:
100000

Status:
ACTIVE
```

```text
TRUCK
MinWeightKg:
0

MaxWeightKg:
7000

PricePerDay:
70000

Status:
ACTIVE
```

```text
TRUCK
MinWeightKg:
7000.01

MaxWeightKg:
blank

PricePerDay:
100000

Status:
ACTIVE
```

Nếu hệ thống sử dụng đơn vị kg nguyên, backend có thể xử lý rule trực tiếp:

```text
WeightKg <= 7000
WeightKg > 7000
```

---

# 52. DATABASE CONSTANTS

Khuyến nghị tạo file:

```text
Config.gs
```

với các constants:

```javascript
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
```

Status:

```javascript
const VEHICLE_STATUS = {
  REGISTERED: 'REGISTERED',
  WAITING_GATE_IN: 'WAITING_GATE_IN',
  IN_YARD: 'IN_YARD',
  READY_TO_EXIT: 'READY_TO_EXIT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};
```

Direction:

```javascript
const CARGO_DIRECTION = {
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT'
};
```

Vehicle type:

```javascript
const VEHICLE_TYPE = {
  CONTAINER: 'CONTAINER',
  TRUCK: 'TRUCK'
};
```

---

# 53. BACKEND RESPONSE

Tất cả API/service nên trả về format thống nhất.

Success:

```javascript
{
  success: true,
  message: 'Thao tác thành công',
  data: {}
}
```

Error:

```javascript
{
  success: false,
  message: 'Không thể thực hiện thao tác',
  code: 'INVALID_STATE',
  data: null
}
```

Các error code đề xuất:

```text
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
DUPLICATE
INVALID_DATA
INVALID_STATE
INVALID_TICKET
PLATE_MISMATCH
ALREADY_COMPLETED
PRICE_NOT_FOUND
SYSTEM_ERROR
```

---

# 54. SECURITY

Không cho frontend tự truyền:

```text
GateInBy
GateOutBy
ReadyToExitBy
CreatedBy
UpdatedBy
```

Backend phải lấy user hiện tại.

Không tin tưởng:

```text
Status
Price
TotalAmount
ChargeDays
```

từ frontend.

Các giá trị này phải được backend tính/kiểm tra lại.

---

# 55. GOOGLE SHEETS RULES

Không sử dụng Google Sheets như giao diện nhập liệu cho nhân viên.

Nhân viên thao tác thông qua Web App.

Google Sheets chỉ dành cho:

```text
Database
Configuration
Administration
Backup
Audit
```

---

# 56. PERFORMANCE RULES

Không làm:

```javascript
for (...) {
  sheet.getRange(...).getValue();
}
```

với hàng nghìn dòng.

Phải ưu tiên:

```javascript
getValues()
```

một lần.

Xử lý trong JavaScript.

Sau đó:

```javascript
setValues()
```

một lần.

---

# 57. CACHE

Có thể sử dụng:

```javascript
CacheService
```

cho dữ liệu ít thay đổi:

```text
PRICE_CONFIG
SETTINGS
USER PERMISSIONS
```

Không cache dữ liệu giao dịch quan trọng quá lâu.

---

# 58. LOCKING

Ví dụ:

```javascript
const lock = LockService.getScriptLock();

lock.waitLock(10000);

try {
   // critical operation
} finally {
   lock.releaseLock();
}
```

Không giữ lock lâu hơn cần thiết.

---

# 59. TIMEZONE

Apps Script phải sử dụng:

```text
Asia/Ho_Chi_Minh
```

Google Spreadsheet cũng phải đặt timezone tương ứng.

Không dùng timezone mặc định của server.

---

# 60. DATABASE INITIAL DATA

Sau khi `initializeDatabase()` chạy, hệ thống nên có:

### USERS

Một tài khoản ADMIN ban đầu được cấu hình theo email quản trị thực tế.

### PRICE_CONFIG

Các mức giá mặc định.

### SETTINGS

```text
TIMEZONE = Asia/Ho_Chi_Minh
TICKET_PREFIX = BAI
TRUCK_WEIGHT_THRESHOLD_KG = 7000
```

---

# 61. MVP DATABASE

MVP bắt buộc có:

```text
USERS
IMPORT_BATCH
VEHICLE_REGISTER
GATE_IN
YARD
GATE_OUT
FEES
PRICE_CONFIG
AUDIT_LOG
SETTINGS
```

Không thêm database phức tạp nếu chưa có yêu cầu.

---

# 62. FINAL DATABASE FLOW

Toàn bộ dữ liệu phải đi theo flow:

```text
EXCEL
  │
  ▼
IMPORT_BATCH
  │
  ▼
VEHICLE_REGISTER
  │
  ▼
GATE_IN
  │
  ▼
YARD
  │
  ▼
READY_TO_EXIT
  │
  ▼
GATE_OUT
  │
  ├──────────────► COMPLETED
  │
  ▼
FEES
  │
  ▼
AUDIT_LOG
```

---

# 63. CLAUDE CODE IMPLEMENTATION RULE

Claude Code phải triển khai database theo đúng thứ tự:

```text
1. Config.gs
2. DatabaseService.gs
3. initializeDatabase()
4. Users
5. ImportBatch
6. VehicleRegister
7. GateIn
8. Yard
9. GateOut
10. Fee
11. Audit
12. Reports
```

Mỗi Service phải:

* validate input;
* validate quyền;
* validate state;
* sử dụng LockService khi cần;
* ghi Audit Log;
* trả response chuẩn.

---

# 64. IMPORTANT

Không được thiết kế hệ thống như một hệ thống quản lý cảng hoàn chỉnh.

Phạm vi chỉ là:

```text
QUẢN LÝ XE VÀO BÃI
        +
QUẢN LÝ XE TRONG BÃI
        +
QUẢN LÝ XE RA BÃI
        +
TÍNH THỜI GIAN
        +
TÍNH PHÍ
```

Hai luồng nghiệp vụ:

```text
IMPORT = XE NHẬP KHẨU
EXPORT = XE XUẤT KHẨU
```

sử dụng chung database.

Mọi nghiệp vụ phải được kiểm soát bởi backend Google Apps Script.

Frontend chỉ chịu trách nhiệm:

```text
Display
Input
Search
Confirm
Print
```

Backend chịu trách nhiệm:

```text
Authentication
Authorization
Validation
State Transition
Database
Pricing
Audit
Concurrency
```

---

# END OF DATABASE.md
