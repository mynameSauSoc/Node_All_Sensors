# BÁO CÁO KIỂM TOÁN ĐỐI CHIẾU TOÀN DIỆN BACKEND ↔ FRONTEND (GAP AUDIT)
**Dự án:** Hệ thống Giám sát Vi khí hậu & Âm học Thư viện Tạ Quang Bửu (`AIoTLibTQB`)  
**Tài liệu:** `docs/frontend/01_gap_report.md`  
**Đơn vị thực hiện:** Worker 2 (Backend <-> Frontend Gap Auditor)  
**Ngày lập:** 2026-10-23  
**Quy chuẩn thẩm định:** 100% nhận định kỹ thuật có gắn nhãn `[XÁC NHẬN]`, `[SUY LUẬN]`, `[CHƯA RÕ]` và đường dẫn tập tin, số dòng cụ thể.

---

## 1. Ma trận Khớp nối Toàn diện (Mapping Matrix)

Ma trận đối chiếu mọi endpoint backend được khai báo trong 8 `@RestController` (`src/main/java/com/example/AIoTLibTQB/controller/**`) và tệp Postman Collection (`AIoTLibTQB_Postman_Collection.json`), đối chiếu với mã nguồn Frontend (`frontend/src/**`).

### Bảng chú giải phân loại:
- **Trạng thái FE:**
  - `ĐÃ TÍCH HỢP`: Frontend có hàm gọi API trong `src/features/*/api.ts` và có UI Screen / Query hook đang sử dụng.
  - `CLIENT CÓ - UI CHƯA DÙNG`: Frontend đã viết hàm trong `src/features/*/api.ts` nhưng chưa có trang UI nào gọi.
  - `CHƯA TÍCH HỢP`: Endpoint backend tồn tại nhưng Frontend không gọi (dành cho IoT thiết bị, Gateway, hoặc chưa làm).
- **Mã màn hình:** `M01` đến `M15` theo danh mục kiến trúc UI (`docs/implementation/99_frontend_report.md:25-42`).

---

### Phân hệ 1.1: Xác thực & Phiên làm việc (`auth`)

| STT | Phương thức | URI Endpoint Backend | Nguồn Postman / Controller | Frontend có gọi? | Hàm Frontend & Tệp mã nguồn | Màn hình (M01-M15) | Quyền / Vai trò yêu cầu | Mức ưu tiên | Nhãn bằng chứng |
| :---: | :---: | :--- | :--- | :---: | :--- | :---: | :--- | :---: | :---: |
| 1 | `POST` | `/api/v1/auth/login` | Postman #1.1<br>`AuthenticationController.java:30` | **ĐÃ TÍCH HỢP** | `authApi.login`<br>`frontend/src/features/auth/api.ts:11` | **M01** (`/login`) | `Public` (`permitAll`) | **P0** | `[XÁC NHẬN]` |
| 2 | `POST` | `/api/v1/auth/refresh` | Postman #1.2, #1.3<br>`AuthenticationController.java:52` | **ĐÃ TÍCH HỢP** | `performRefresh`<br>`frontend/src/lib/http/client.ts:71` | **Core** (Toàn ứng dụng khi gặp `401`) | `Public` (`permitAll`) | **P0** | `[XÁC NHẬN]` |
| 3 | `POST` | `/api/v1/auth/introspect` | Postman #1.4<br>`AuthenticationController.java:37` | **CHƯA TÍCH HỢP** | *Không gọi* (FE giải mã JWT cục bộ qua `decodeJwtScope`) | *Không gắn UI* | `Public` (`permitAll`) | **P2** | `[XÁC NHẬN]` |
| 4 | `POST` | `/api/v1/auth/logout` | Postman #1.5<br>`AuthenticationController.java:45` | **ĐÃ TÍCH HỢP** | `authApi.logout`<br>`frontend/src/features/auth/api.ts:21` | **M15** (`/profile`) | `Authenticated` | **P1** | `[XÁC NHẬN]` |

---

### Phân hệ 1.2: Quản trị Người dùng, Vai trò & Quyền hạn (`users / roles / permissions`)

| STT | Phương thức | URI Endpoint Backend | Nguồn Postman / Controller | Frontend có gọi? | Hàm Frontend & Tệp mã nguồn | Màn hình (M01-M15) | Quyền / Vai trò yêu cầu | Mức ưu tiên | Nhãn bằng chứng |
| :---: | :---: | :--- | :--- | :---: | :--- | :---: | :--- | :---: | :---: |
| 5 | `POST` | `/api/v1/users` | Postman #2.1<br>`UserController.java:27` | **ĐÃ TÍCH HỢP** | `authApi.register` & `iamApi.createUser`<br>`frontend/src/features/iam/api.ts:26` | **M01** (Đăng ký) & **M13** (`/admin/users`) | `Public` (đăng ký) / `ADMIN` (gán role, zone) | **P0** | `[XÁC NHẬN]` |
| 6 | `GET` | `/api/v1/users/myInfo` | Postman #2.2<br>`UserController.java:51` | **ĐÃ TÍCH HỢP** | `authApi.getMyInfo`<br>`frontend/src/features/auth/api.ts:24` | **M01**, **M15**, `AppShell` (mọi trang) | `Authenticated` | **P0** | `[XÁC NHẬN]` |
| 7 | `GET` | `/api/v1/users` | Postman #2.3<br>`UserController.java:34` | **ĐÃ TÍCH HỢP** | `iamApi.listUsers`<br>`frontend/src/features/iam/api.ts:15` | **M13** (`/admin/users`) | `hasAuthority('ADMIN')` | **P1** | `[XÁC NHẬN]` |
| 8 | `GET` | `/api/v1/users/{userId}` | Postman #2.4<br>`UserController.java:58` | **ĐÃ TÍCH HỢP** | `iamApi.getUserById`<br>`frontend/src/features/iam/api.ts:24` | **M13** (`/admin/users`) | `hasAuthority('ADMIN')` hoặc chính chủ | **P1** | `[XÁC NHẬN]` |
| 9 | `PUT` | `/api/v1/users/{userId}` | Postman #2.5<br>`UserController.java:65` | **ĐÃ TÍCH HỢP** | `iamApi.updateUser`<br>`frontend/src/features/iam/api.ts:29` | **M13** (Admin sửa) & **M15** (Tự đổi pass/info) | `hasAuthority('ADMIN')` hoặc chính chủ | **P0** | `[XÁC NHẬN]` |
| 10 | `PATCH` | `/api/v1/users/{userId}/status` | Postman #2.6<br>`UserController.java:74` | **ĐÃ TÍCH HỢP** | `iamApi.toggleUserStatus`<br>`frontend/src/features/iam/api.ts:32` | **M13** (`/admin/users`) | `hasAuthority('ADMIN')` | **P1** | `[XÁC NHẬN]` |
| 11 | `DELETE` | `/api/v1/users/{userId}` | Postman #2.7<br>`UserController.java:83` | **ĐÃ TÍCH HỢP** | `iamApi.deleteUser`<br>`frontend/src/features/iam/api.ts:35` | **M13** (`/admin/users`) | `hasAuthority('ADMIN')` | **P1** | `[XÁC NHẬN]` |
| 12 | `GET` | `/api/v1/roles` | Postman #3.1, #3.6<br>`RoleController.java:32` | **ĐÃ TÍCH HỢP** | `iamApi.listRoles`<br>`frontend/src/features/iam/api.ts:37` | **M13** (Dropdown gán vai trò), **M14** (`/admin/roles`) | `hasAuthority('ADMIN')` | **P1** | `[XÁC NHẬN]` |
| 13 | `POST` | `/api/v1/roles` | Postman #3.5<br>`RoleController.java:25` | **ĐÃ TÍCH HỢP** | `iamApi.createRole`<br>`frontend/src/features/iam/api.ts:39` | **M14** (`/admin/roles`) | `hasAuthority('ADMIN')` | **P1** | `[XÁC NHẬN]` |
| 14 | `PUT` | `/api/v1/roles/{name}` | Postman #3.7<br>`RoleController.java:39` | **ĐÃ TÍCH HỢP** | `iamApi.updateRole`<br>`frontend/src/features/iam/api.ts:42` | **M14** (`/admin/roles`) | `hasAuthority('ADMIN')` | **P1** | `[XÁC NHẬN]` |
| 15 | `DELETE` | `/api/v1/roles/{name}` | Postman #3.9<br>`RoleController.java:46` | **ĐÃ TÍCH HỢP** | `iamApi.deleteRole`<br>`frontend/src/features/iam/api.ts:45` | **M14** (`/admin/roles`) | `hasAuthority('ADMIN')` | **P1** | `[XÁC NHẬN]` |
| 16 | `GET` | `/api/v1/permissions` | Postman #3.2, #3.4<br>`PermissionController.java:32` | **ĐÃ TÍCH HỢP** | `iamApi.listPermissions`<br>`frontend/src/features/iam/api.ts:48` | **M14** (`/admin/roles` - Ma trận quyền) | `hasAuthority('ADMIN')` | **P1** | `[XÁC NHẬN]` |
| 17 | `POST` | `/api/v1/permissions` | Postman #3.3<br>`PermissionController.java:25` | **ĐÃ TÍCH HỢP** | `iamApi.createPermission`<br>`frontend/src/features/iam/api.ts:50` | **M14** (`/admin/roles`) | `hasAuthority('ADMIN')` | **P1** | `[XÁC NHẬN]` |
| 18 | `DELETE` | `/api/v1/permissions/{name}` | Postman #3.8, #3.10<br>`PermissionController.java:39` | **ĐÃ TÍCH HỢP** | `iamApi.deletePermission`<br>`frontend/src/features/iam/api.ts:53` | **M14** (`/admin/roles`) | `hasAuthority('ADMIN')` | **P1** | `[XÁC NHẬN]` |

---

### Phân hệ 1.3: Quản lý Không gian & Phòng đọc (`rooms`)

| STT | Phương thức | URI Endpoint Backend | Nguồn Postman / Controller | Frontend có gọi? | Hàm Frontend & Tệp mã nguồn | Màn hình (M01-M15) | Quyền / Vai trò yêu cầu | Mức ưu tiên | Nhãn bằng chứng |
| :---: | :---: | :--- | :--- | :---: | :--- | :---: | :--- | :---: | :---: |
| 19 | `POST` | `/api/v1/rooms` | Postman #5.1<br>`RoomController.java:27` | **ĐÃ TÍCH HỢP** | `roomsApi.create`<br>`frontend/src/features/rooms/api.ts:27` | **M08** (`/admin/rooms`) | `Authenticated` (`canManageRooms`) | **P1** | `[XÁC NHẬN]` |
| 20 | `GET` | `/api/v1/rooms` | Postman #5.2, #5.3<br>`RoomController.java:34` | **ĐÃ TÍCH HỢP** | `roomsApi.list`<br>`frontend/src/features/rooms/api.ts:10` | **M02**, **M03**, **M04**, **M06**, **M07**, **M08**, **M10**, **M11**, **M12** | `Authenticated` | **P0** | `[XÁC NHẬN]` |
| 21 | `GET` | `/api/v1/rooms/{id}` | Postman #5.4<br>`RoomController.java:45` | **ĐÃ TÍCH HỢP** | `roomsApi.getById`<br>`frontend/src/features/rooms/api.ts:22` | **M05** (`/rooms/[id]`), **M09** (`/admin/rooms/[id]/polygon`) | `Authenticated` | **P0** | `[XÁC NHẬN]` |
| 22 | `GET` | `/api/v1/rooms/code/{code}` | Postman #5.5<br>`RoomController.java:52` | **CLIENT CÓ - UI CHƯA DÙNG** | `roomsApi.getByCode`<br>`frontend/src/features/rooms/api.ts:24` | *Không gắn UI* | `Authenticated` | **P2** | `[XÁC NHẬN]` |
| 23 | `PUT` | `/api/v1/rooms/{id}` | Postman #5.6<br>`RoomController.java:59` | **ĐÃ TÍCH HỢP** | `roomsApi.update`<br>`frontend/src/features/rooms/api.ts:30` | **M08** (Sửa phòng) & **M09** (Lưu tọa độ đa giác tường) | `Authenticated` (`canManageRooms`) | **P0** | `[XÁC NHẬN]` |
| 24 | `DELETE` | `/api/v1/rooms/{id}` | Postman #5.7<br>`RoomController.java:68` | **ĐÃ TÍCH HỢP** | `roomsApi.remove`<br>`frontend/src/features/rooms/api.ts:33` | **M08** (`/admin/rooms`) | `Authenticated` (`canManageRooms`) | **P1** | `[XÁC NHẬN]` |

---

### Phân hệ 1.4: Quản lý Thiết bị & Tự động Phát hiện (`devices / discovery`)

| STT | Phương thức | URI Endpoint Backend | Nguồn Postman / Controller | Frontend có gọi? | Hàm Frontend & Tệp mã nguồn | Màn hình (M01-M15) | Quyền / Vai trò yêu cầu | Mức ưu tiên | Nhãn bằng chứng |
| :---: | :---: | :--- | :--- | :---: | :--- | :---: | :--- | :---: | :---: |
| 25 | `POST` | `/api/v1/devices/register` hoặc `/api/v1/devices` | Postman #4.1<br>`DeviceController.java:42` | **ĐÃ TÍCH HỢP** | `devicesApi.register`<br>`frontend/src/features/devices/api.ts:40` | **M10** (`/admin/devices`) & **M11** (Discovery cấp phát) | `Authenticated` (`canManageDevices`) | **P0** | `[XÁC NHẬN]` |
| 26 | `POST` | `/api/v1/devices/authenticate` | Postman #4.2<br>`DeviceController.java:65` | **CHƯA TÍCH HỢP** | *Không gọi* (Dành riêng cho firmware IoT ESP32 / IoT Simulator) | *Không gắn UI* | `Public` (`permitAll`) | **P0** (IoT Ingestion) | `[XÁC NHẬN]` |
| 27 | `POST` | `/api/v1/devices/{id}/heartbeat` | Postman #4.3<br>`DeviceController.java:59` | **CHƯA TÍCH HỢP** | *Không gọi* (Dành cho mạch IoT ping trạng thái kết nối) | *Không gắn UI* | `Authenticated` | **P2** (IoT Heartbeat) | `[XÁC NHẬN]` |
| 28 | `GET` | `/api/v1/devices` | Postman #4.4<br>`DeviceController.java:73` | **ĐÃ TÍCH HỢP** | `devicesApi.list`<br>`frontend/src/features/devices/api.ts:12` | **M04** (Tọa độ trạm đo Heatmap), **M09** (Polygon editor), **M10** (`/admin/devices`) | `Authenticated` | **P0** | `[XÁC NHẬN]` |
| 29 | `GET` | `/api/v1/devices/{id}` | Postman #4.5<br>`DeviceController.java:85` | **ĐÃ TÍCH HỢP** | `devicesApi.getById`<br>`frontend/src/features/devices/api.ts:30` | **M12** (`/admin/devices/[id]`) | `Authenticated` | **P1** | `[XÁC NHẬN]` |
| 30 | `GET` | `/api/v1/devices/zone/{zoneId}` | Postman #4.6<br>`DeviceController.java:92` | **CLIENT CÓ - UI CHƯA DÙNG** | `devicesApi.listByZone`<br>`frontend/src/features/devices/api.ts:32` | *Không gắn UI* (UI dùng `devicesApi.list({ zoneId })`) | `Authenticated` | **P2** | `[XÁC NHẬN]` |
| 31 | `PUT` | `/api/v1/devices/{id}` | Postman #4.7<br>`DeviceController.java:50` | **ĐÃ TÍCH HỢP** | `devicesApi.update`<br>`frontend/src/features/devices/api.ts:43` | **M09** (Lưu tọa độ kéo thả `posX`, `posY`), **M12** (Sửa metadata) | `Authenticated` (`canManageDevices`) | **P0** | `[XÁC NHẬN]` |
| 32 | `POST` | `/api/v1/devices/{id}/regenerate-key` | Postman #4.8<br>`DeviceController.java:99` | **ĐÃ TÍCH HỢP** | `devicesApi.regenerateKey`<br>`frontend/src/features/devices/api.ts:46` | **M12** (`/admin/devices/[id]` - Cấp lại `rawApiKey` 1 lần) | `Authenticated` (`canManageDevices`) | **P1** | `[XÁC NHẬN]` |
| 33 | `PATCH` | `/api/v1/devices/{id}/status` | Postman #4.9<br>`DeviceController.java:106` | **ĐÃ TÍCH HỢP** | `devicesApi.toggleStatus`<br>`frontend/src/features/devices/api.ts:51` | **M10** & **M12** (Bật/tắt trạng thái hoạt động) | `Authenticated` (`canManageDevices`) | **P1** | `[XÁC NHẬN]` |
| 34 | `DELETE` | `/api/v1/devices/{id}` | Postman #4.10<br>`DeviceController.java:115` | **ĐÃ TÍCH HỢP** | `devicesApi.remove`<br>`frontend/src/features/devices/api.ts:56` | **M10** & **M12** (Xóa thiết bị) | `Authenticated` (`canManageDevices`) | **P1** | `[XÁC NHẬN]` |
| 35 | `GET` | `/api/v1/devices/discovered` | Postman #4.11<br>`DeviceController.java:34` | **ĐÃ TÍCH HỢP** | `devicesApi.listDiscovered`<br>`frontend/src/features/devices/api.ts:37` | **M11** (`/admin/devices/discovery`) | `hasAnyAuthority('ADMIN', 'LIBRARIAN')` | **P0** | `[XÁC NHẬN]` |

---

### Phân hệ 1.5: Dữ liệu Cảm biến Chuỗi Thời gian (`telemetry`)

| STT | Phương thức | URI Endpoint Backend | Nguồn Postman / Controller | Frontend có gọi? | Hàm Frontend & Tệp mã nguồn | Màn hình (M01-M15) | Quyền / Vai trò yêu cầu | Mức ưu tiên | Nhãn bằng chứng |
| :---: | :---: | :--- | :--- | :---: | :--- | :---: | :--- | :---: | :---: |
| 36 | `GET` | `/api/v1/telemetry/overview/summary` | `TelemetryController.java:86` *(Mới ở Wave 2)* | **ĐÃ TÍCH HỢP** | `telemetryApi.getOverviewSummary`<br>`frontend/src/features/telemetry/api.ts:10` | **M02** (TV Kiosk), **M03** (Dashboard) | `hasAnyAuthority('ADMIN', 'LIBRARIAN', ...)` | **P0** | `[XÁC NHẬN]` |
| 37 | `GET` | `/api/v1/telemetry/room/{roomId}/latest` | Postman #6.2<br>`TelemetryController.java:48` | **ĐÃ TÍCH HỢP** | `telemetryApi.getRoomLatest`<br>`frontend/src/features/telemetry/api.ts:13` | **M02**, **M03**, **M04**, **M05** (Poll dự phòng khi đứt STOMP) | `hasAnyAuthority('ADMIN', 'LIBRARIAN', ...)` | **P0** | `[XÁC NHẬN]` |
| 38 | `GET` | `/api/v1/telemetry/device/{deviceId}/latest` | Postman #6.1<br>`TelemetryController.java:41` | **CLIENT CÓ - UI CHƯA DÙNG** | `telemetryApi.getDeviceLatest`<br>`frontend/src/features/telemetry/api.ts:18` | *Không gắn UI* (UI phòng đọc ưu tiên `getRoomLatest`) | `hasAnyAuthority('ADMIN', 'LIBRARIAN', ...)` | **P2** | `[XÁC NHẬN]` |
| 39 | `GET` | `/api/v1/telemetry/room/{roomId}/buckets` | `TelemetryController.java:75` *(Mới ở Wave 1)* | **ĐÃ TÍCH HỢP** | `telemetryApi.getRoomBuckets`<br>`frontend/src/features/telemetry/api.ts:23` | **M05** (`/rooms/[id]` - Biểu đồ nén Min-Max-Avg) | `hasAnyAuthority('ADMIN', 'LIBRARIAN', ...)` | **P0** | `[XÁC NHẬN]` |
| 40 | `GET` | `/api/v1/telemetry/room/{roomId}` | Postman #6.4<br>`TelemetryController.java:65` | **ĐÃ TÍCH HỢP** | `telemetryApi.getRoomRawHistory`<br>`frontend/src/features/telemetry/api.ts:39` | **M07** (`/telemetry-explorer` - Tra cứu thô theo phòng) | `hasAnyAuthority('ADMIN', 'LIBRARIAN', ...)` | **P1** | `[XÁC NHẬN]` |
| 41 | `GET` | `/api/v1/telemetry/device/{deviceId}` | Postman #6.3<br>`TelemetryController.java:55` | **ĐÃ TÍCH HỢP** | `telemetryApi.getDeviceRawHistory`<br>`frontend/src/features/telemetry/api.ts:49` | **M07** (`/telemetry-explorer` - Tra cứu thô theo thiết bị) | `hasAnyAuthority('ADMIN', 'LIBRARIAN', ...)` | **P1** | `[XÁC NHẬN]` |

---

### Phân hệ 1.6: Trung tâm Cảnh báo & FSM (`alerts`)

| STT | Phương thức | URI Endpoint Backend | Nguồn Postman / Controller | Frontend có gọi? | Hàm Frontend & Tệp mã nguồn | Màn hình (M01-M15) | Quyền / Vai trò yêu cầu | Mức ưu tiên | Nhãn bằng chứng |
| :---: | :---: | :--- | :--- | :---: | :--- | :---: | :--- | :---: | :---: |
| 42 | `GET` | `/api/v1/alerts` | `AlertController.java:28` *(Mới ở Wave 1)* | **ĐÃ TÍCH HỢP** | `alertsApi.list`<br>`frontend/src/features/alerts/api.ts:18` | **M06** (`/alerts` - Danh sách cảnh báo FSM) | `hasAuthority('VIEW_ALERTS')` | **P0** | `[XÁC NHẬN]` |
| 43 | `GET` | `/api/v1/alerts/unread-count` | `AlertController.java:47` *(Mới ở Wave 1)* | **ĐÃ TÍCH HỢP** | `alertsApi.getUnreadCount`<br>`frontend/src/features/alerts/api.ts:30` | **M06** & `AppShell` (Badge số đỏ trên chuông header) | `hasAuthority('VIEW_ALERTS')` | **P0** | `[XÁC NHẬN]` |
| 44 | `POST`/`PATCH` | `/api/v1/alerts/{id}/acknowledge` | `AlertController.java:55` *(Mới ở Wave 1)* | **ĐÃ TÍCH HỢP** | `alertsApi.acknowledge`<br>`frontend/src/features/alerts/api.ts:32` | **M06** (`/alerts` - Thao tác Tiếp nhận) | `hasAuthority('ACKNOWLEDGE_ALERT')` | **P0** | `[XÁC NHẬN]` |
| 45 | `POST`/`PATCH` | `/api/v1/alerts/{id}/resolve` | `AlertController.java:64` *(Mới ở Wave 1)* | **ĐÃ TÍCH HỢP** | `alertsApi.resolve`<br>`frontend/src/features/alerts/api.ts:35` | **M06** (`/alerts` - Thao tác Đóng sự cố) | `hasAuthority('MANAGE_ALERT_CONFIG')` | **P0** | `[XÁC NHẬN]` |

---

### Phân hệ 1.7: Hạ tầng Kiểm thử & Giám sát Hệ thống (`actuator`)

| STT | Phương thức | URI Endpoint Backend | Nguồn Postman / Controller | Frontend có gọi? | Hàm Frontend & Tệp mã nguồn | Màn hình (M01-M15) | Quyền / Vai trò yêu cầu | Mức ưu tiên | Nhãn bằng chứng |
| :---: | :---: | :--- | :--- | :---: | :--- | :---: | :--- | :---: | :---: |
| 46 | `GET` | `/actuator/health` | Postman #7.1, #7.2<br>`SecurityConfig.java:57` | **CHƯA TÍCH HỢP** | *Không gọi* (Dành cho DevOps / Container Healthcheck / Postman) | *Không gắn UI* | `Public` (`permitAll`) | **P2** | `[XÁC NHẬN]` |
| 47 | `GET` | `/actuator/info` | Postman #7.3<br>`SecurityConfig.java:57` | **CHƯA TÍCH HỢP** | *Không gọi* (Dành cho DevOps / Postman) | *Không gắn UI* | `Public` (`permitAll`) | **P2** | `[XÁC NHẬN]` |

---

## 2. Đối chiếu NGƯỢC (Reverse Gap Audit)

Kiểm tra toàn bộ các yêu cầu HTTP xuất phát từ Frontend sang Backend nhằm phát hiện:
1. Có lời gọi nào trỏ vào URL không tồn tại trong backend không?
2. Có lời gọi nào còn dùng tiền tố cũ `/api/` (thay vì `/api/v1/`) không?
3. Có endpoint "chết" (Dead code trong API client) không?

### 2.1. Rà soát tiền tố URL (`/api/` vs `/api/v1/`)
- `[XÁC NHẬN]` (`frontend/src/config/env.ts:2-4`):
  Biến môi trường được cấu hình chuẩn mực:
  ```ts
  export const ENV = {
    API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1',
    WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws-aiot',
  } as const;
  ```
- `[XÁC NHẬN]` (`frontend/src/lib/http/client.ts:95-97`):
  Hàm `createHttpClient` chuẩn hóa đường dẫn tương đối bằng cách nối trực tiếp với `${ENV.API_BASE_URL}`:
  ```ts
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${ENV.API_BASE_URL}${normalizedPath}`;
  ```
- `[XÁC NHẬN]` (Quét `grep` chuỗi `/api/` trên toàn bộ thư mục `frontend/src/**`):
  Xác nhận **0 trường hợp** lập trình viên viết cứng `/api/` hoặc tự nhân đôi `/api/v1/api/v1/` trong các hàm gọi `httpClient.get/post/put/patch/delete`. Toàn bộ 6 tệp API feature (`auth`, `iam`, `rooms`, `devices`, `telemetry`, `alerts`) đều truyền đường dẫn tương đối (`/auth/login`, `/rooms`, `/devices`...).

### 2.2. Rà soát endpoint không tồn tại (Non-existent Endpoints)
- `[XÁC NHẬN]`: Không có bất kỳ lời gọi API nào từ Frontend hướng tới một endpoint không tồn tại trong Backend. Mọi HTTP request đều có ánh xạ 1-1 chính xác với các phương thức `@RequestMapping` trong 8 controller của Spring Boot.

### 2.3. Rà soát API Dead Code (Khai báo trong Frontend nhưng không có UI sử dụng)
Phát hiện **3 hàm API client** được khai báo hoàn chỉnh trong `frontend/src/features/**/api.ts` nhưng không được bất kỳ query hook (`useQuery`/`useMutation`) hay trang giao diện nào kích hoạt:
1. `roomsApi.getByCode: (code: string) => httpClient.get<RoomResponse>(/rooms/code/${encodeURIComponent(code)})` (`frontend/src/features/rooms/api.ts:24-25`).  
   *Nguyên nhân:* Màn hình chi tiết phòng M05 và mặt bằng M09 đều dùng `roomId` (ObjectId của MongoDB) thay vì tra cứu theo mã `roomCode`.
2. `devicesApi.listByZone: (zoneId: string) => httpClient.get<DeviceResponse[]>(/devices/zone/${encodeURIComponent(zoneId)})` (`frontend/src/features/devices/api.ts:32-35`).  
   *Nguyên nhân:* Trang M10 lọc thiết bị theo phân vùng bằng API chuẩn phân trang `devicesApi.list({ zoneId })` (`/api/v1/devices?zoneId=...`) nên endpoint trả danh sách mảng phẳng này bị dư thừa trên Web.
3. `telemetryApi.getDeviceLatest: (deviceId: string) => httpClient.get<TelemetryResponse | null>(/telemetry/device/${encodeURIComponent(deviceId)}/latest)` (`frontend/src/features/telemetry/api.ts:18-21`).  
   *Nguyên nhân:* Các trang M02, M03, M04, M05 tổ chức hiển thị theo đơn vị Phòng đọc (`getRoomLatest`), trong khi trang M12 (Chi tiết thiết bị) chỉ quản lý thông tin phần cứng và cấp khóa API Key, chưa tích hợp widget xem số liệu cảm biến hiện thời của riêng thiết bị đó.

---

## 3. Kênh Thời gian thực (Realtime WebSocket STOMP)

### 3.1. Điểm kết nối & Cấu hình STOMP
- `[XÁC NHẬN]` (`frontend/src/config/env.ts:4`, `frontend/src/lib/realtime/stomp-client.ts:70-74`):
  Frontend kết nối tới máy chủ qua URL `ws://localhost:8080/ws-aiot` (hoặc biến môi trường `NEXT_PUBLIC_WS_URL`).
- `[XÁC NHẬN]` (`frontend/src/lib/realtime/stomp-client.ts:43-223`):
  Lớp `AiotStompManager` được thiết kế dưới dạng **Singleton** (`stompManager`).
  - Chu kỳ kết nối lại: `reconnectDelay = 5000ms`.
  - Heartbeat: `heartbeatIncoming = 10000ms`, `heartbeatOutgoing = 10000ms`.
  - Bảo mật kết nối: Frame `CONNECT` tự động đính kèm `Authorization: Bearer <accessToken>` thông qua callback `beforeConnect: () => { ... }` (`stomp-client.ts:75-82`).
  - Bảo mật log: `onStompError` chỉ in thông điệp lỗi ngắn gọn, tuyệt đối không in header thô chứa token JWT (`stomp-client.ts:90-97`).

### 3.2. Danh mục Topic Đăng ký (Topic Subscriptions)
Frontend đăng ký nhận dữ liệu từ **2 topic STOMP** do backend phát ra:

| Tên Topic | Điều kiện & Quyền hạn | Vòng đời đăng ký (Lifecycle) | Mục đích nghiệp vụ | Tệp mã nguồn xử lý |
| :--- | :--- | :--- | :--- | :--- |
| `/topic/alerts` | Người dùng đã đăng nhập và có quyền `VIEW_ALERTS`<br>(`capabilities.canViewAlerts === true`) | Duy trì xuyên suốt phiên đăng nhập khi người dùng ở bất kỳ màn hình nào trong `AppShell`. | Nhận tức thời biến cố cảnh báo FSM (`PENDING`/`FIRING`/`ACKNOWLEDGED`/`RESOLVED`); cập nhật danh sách cảnh báo trong TanStack Query và bắn popup Toast đỏ khi có trạng thái `FIRING`. | `frontend/src/lib/realtime/stomp-client.ts:183-200`<br>`frontend/src/lib/realtime/use-room-stream.ts:50-74` |
| `/topic/rooms/{roomId}/telemetry` | Người dùng đã xác thực, đang truy cập vào màn hình chi tiết hoặc bản đồ phòng đó. | Đăng ký động theo từng `roomId`. Khi người dùng chuyển sang phòng khác hoặc rời trang, hook `useRoomTelemetryStream` tự động gọi hàm cleanup `unsubscribe()`. | Cập nhật số liệu vi khí hậu & âm học thời gian thực (tần suất conflation tối đa 1Hz từ backend); làm mới biểu đồ và mặt bằng mà không cần tải lại trang. | `frontend/src/lib/realtime/stomp-client.ts:202-219`<br>`frontend/src/lib/realtime/use-room-stream.ts:28-45` |

### 3.3. Cơ chế Xử lý Mất kết nối & Chuyển đổi Dự phòng (Failover Handling)
- `[XÁC NHẬN]` (`frontend/src/components/layout/AppShell.tsx:357-367`):
  Khi STOMP bị ngắt kết nối (`stompConnected === false`), header của `AppShell` lập tức hiển thị huy hiệu cảnh báo màu hổ phách:  
  `[WifiOff] Đang kết nối lại realtime…` kèm thuộc tính trợ năng `role="status"` và `aria-live="polite"`.
- `[XÁC NHẬN]` (`frontend/src/features/telemetry/queries.ts:31-40`):
  Cơ chế **Polling thông minh**: Hook `useRoomLatestTelemetryQuery` kiểm tra trạng thái STOMP.
  - Khi STOMP đang kết nối (`stompConnected === true`): `refetchInterval = false` (tắt hoàn toàn HTTP polling, tiết kiệm băng thông và tải DB).
  - Khi STOMP bị đứt (`stompConnected === false`): Tự động chuyển sang chế độ fallback polling HTTP `GET /api/v1/telemetry/room/{roomId}/latest` với chu kỳ **15 giây/lần**.
- `[XÁC NHẬN]` (`frontend/src/lib/realtime/stomp-client.ts:172-181`):
  Khi STOMP kết nối lại thành công (`onConnect`), hàm `resubscribeAll()` tự động phục hồi lại toàn bộ danh sách phòng và kênh cảnh báo mà các component đang lắng nghe mà không cần người dùng F5 tải lại trang.
- `[XÁC NHẬN]` (`frontend/src/lib/realtime/stomp-client.ts:8-21`):
  Hàm `mergeRealtimeTelemetry` có cơ chế bảo vệ **chống nhảy lùi thời gian** (`Time backward jump`): Nếu bản tin STOMP nhận được có timestamp cũ hơn bản tin hiện có trong state, bản tin đó sẽ bị hủy bỏ an toàn.

---

## 4. Xử lý Lỗi & Cơ chế Quản lý Phiên (Error Handling & Session Lifecycle)

### 4.1. Ma trận Ánh xạ 33 Mã lỗi Backend (`ErrorCode`) sang Tiếng Việt
Toàn bộ 33 mã lỗi trong enum `ErrorCode.java` của Backend được ánh xạ 100% sang tiếng Việt tại `frontend/src/messages/vi.ts:1-39`:

| Nhóm mã | Mã số (`code`) | Tên Enum Backend (`ErrorCode.java`) | Thông báo Tiếng Việt hiển thị cho Người dùng (`ERROR_MESSAGES_VI`) |
| :--- | :---: | :--- | :--- |
| **Chung** | `1000` | *(Mặc định thành công)* | Thành công |
| | `9999` | `UNCATEGORIZED_EXCEPTION` | Đã xảy ra lỗi hệ thống nội bộ. Vui lòng thử lại sau. |
| **Xác thực & Người dùng** | `1001` | `USER_EXISTED` | Tên đăng nhập đã tồn tại trong hệ thống. |
| | `1002` | `USERNAME_INVALID` | Tên đăng nhập phải có ít nhất 6 ký tự. |
| | `1003` | `PASSWORD_INVALID` | Mật khẩu phải có ít nhất 8 ký tự. |
| | `1004` | `INVALID_MESSAGE_KEY` | Dữ liệu đầu vào không hợp lệ. |
| | `1005` | `USER_DID_NOT_EXIST` | Không tìm thấy tài khoản người dùng. |
| | `1006` | `UNAUTHENTICATED` | Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại. |
| | `1007` | `UNAUTHORIZED` | Bạn không có quyền thực hiện thao tác này. |
| | `1008` | `USER_INACTIVE` | Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ Quản trị viên. |
| | `1009` | `USERNAME_REQUIRED` | Vui lòng nhập tên đăng nhập. |
| | `1010` | `PASSWORD_REQUIRED` | Vui lòng nhập mật khẩu. |
| **Vai trò & Quyền hạn** | `2001` | `ROLE_EXISTED` | Vai trò (Role) này đã tồn tại. |
| | `2002` | `ROLE_NOT_EXISTED` | Vai trò (Role) không tồn tại. |
| | `2003` | `PERMISSION_EXISTED` | Quyền hạn (Permission) này đã tồn tại. |
| | `2004` | `PERMISSION_NOT_EXISTED` | Quyền hạn (Permission) không tồn tại. |
| | `2005` | `PERMISSION_IN_USE` | Không thể xóa quyền hạn đang được gán cho một hoặc nhiều vai trò. Vui lòng gỡ khỏi vai trò trước. |
| **Thiết bị & Tải** | `3001` | `DEVICE_NOT_EXISTED` | Không tìm thấy thiết bị cảm biến. |
| | `3002` | `DEVICE_INACTIVE` | Thiết bị đang bị vô hiệu hóa. |
| | `3003` | `INVALID_API_KEY` | Khóa API Key của thiết bị không hợp lệ. |
| | `3004` | `DEVICE_NAME_REQUIRED` | Tên thiết bị là bắt buộc. |
| | `3005` | `HARDWARE_ID_REQUIRED` | Mã phần cứng (Hardware ID) là bắt buộc. |
| | `3006` | `ZONE_ID_REQUIRED` | Mã phân vùng (Zone ID) là bắt buộc. |
| | `3007` | `DEVICE_TYPE_REQUIRED` | Loại thiết bị (Device Type) là bắt buộc. |
| | `3008` | `API_KEY_REQUIRED` | Khóa API Key là bắt buộc. |
| | `4029` | `TOO_MANY_REQUESTS` | Quá nhiều yêu cầu trong thời gian ngắn. Vui lòng đợi trước khi thử lại. |
| | `4031` | `ZONE_ACCESS_DENIED` | Bạn không có quyền truy cập dữ liệu ngoài phân vùng (Zone) được giao. |
| **Phòng đọc** | `5001` | `ROOM_EXISTED` | Mã phòng đọc đã tồn tại. |
| | `5002` | `ROOM_NOT_EXISTED` | Không tìm thấy phòng đọc. |
| | `5003` | `ROOM_CODE_REQUIRED` | Mã phòng đọc là bắt buộc. |
| | `5004` | `ROOM_NAME_REQUIRED` | Tên phòng đọc là bắt buộc. |
| | `5005` | `FLOOR_REQUIRED` | Số tầng là bắt buộc. |
| | `5006` | `ROOM_HAS_DEVICES` | Không thể xóa phòng đang có thiết bị cảm biến gắn kèm. Vui lòng chuyển hoặc gỡ thiết bị trước. |
| **Cảnh báo** | `6001` | `ALERT_NOT_EXISTED` | Không tìm thấy bản ghi cảnh báo. |
| **Chuỗi Thời gian** | `7001` | `INVALID_TIME_RANGE` | Khoảng thời gian không hợp lệ: Thời điểm bắt đầu phải nhỏ hơn thời điểm kết thúc. |
| | `7002` | `TOO_MANY_BUCKETS` | Khoảng thời gian vượt quá giới hạn 1000 điểm dữ liệu. Vui lòng thu hẹp khoảng ngày hoặc tăng độ mịn (1h / 1d). |
| | `7003` | `INVALID_INTERVAL` | Độ mịn biểu đồ không hợp lệ (chỉ hỗ trợ 15m, 1h, 1d). |

- `[XÁC NHẬN]` (`frontend/src/lib/http/error-mapper.ts:25-36`):
  Hàm `getFriendlyErrorMessage` tự động tra cứu mã lỗi `code` từ backend envelope. Nếu `code` bị khuyết, hàm sẽ fallback theo HTTP Status code (`429` -> `4029`, `401` -> `1006`, `403` -> `1007`).

### 4.2. Xử lý Hết hạn Token & Hàng đợi Single-Flight Refresh Queue
- `[XÁC NHẬN]` (`frontend/src/lib/http/refresh-queue.ts:9-26`):
  Lớp `SingleFlightRefreshCoordinator` triển khai chuẩn `FE-AUTH-03`.
  ```ts
  public async executeRefresh(refreshFn: RefreshHandler): Promise<AuthenticationResponse> {
    if (!this.inFlightPromise) {
      this.inFlightPromise = refreshFn().finally(() => {
        this.inFlightPromise = null;
      });
    }
    return this.inFlightPromise;
  }
  ```
- **Kịch bản xử lý đồng thời (`Concurrent 401 Storm`):**
  1. Khi người dùng tải trang (ví dụ `/dashboard`), có 4–5 request đồng thời gửi lên backend khi access token vừa hết hạn.
  2. Toàn bộ 5 request đều nhận phản hồi HTTP `401 Unauthorized` (`code: 1006`).
  3. `client.ts:126-136` chặn đứng 5 request này; chỉ có **duy nhất 1 request đầu tiên** kích hoạt hàm `performRefresh()` gọi `POST /api/v1/auth/refresh`. 4 request còn lại được xếp hàng chờ chung trên cùng một `Promise` (`this.inFlightPromise`).
  4. Sau khi `POST /api/v1/auth/refresh` thành công nhận cặp token mới, `tokenAccessor.setTokens` cập nhật lại access token và refresh token mới trong RAM + SessionStorage.
  5. Cả 5 request ban đầu tự động thực thi lại (`_isRetry: true`) với access token mới mà không hề ném lỗi ra giao diện, người dùng không hề bị gián đoạn thao tác.
  6. Nếu refresh thất bại (Refresh token đã hết hạn hoặc bị thu hồi): `tokenAccessor.clearSession()` được kích hoạt, xóa sạch token, đóng STOMP, gửi tín hiệu `BroadcastChannel('aiot_auth_channel')` để đồng bộ đăng xuất trên mọi tab đang mở, và chuyển hướng người dùng về màn hình đăng nhập `M01` (`/login`).

### 4.3. Xử lý Giới hạn Tần suất Rate Limiting (`HTTP 429`)
- `[XÁC NHẬN]` (`frontend/src/lib/http/client.ts:117-120` & `frontend/src/app/login/page.tsx:84-106`):
  Khi client gửi request quá ngưỡng cấu hình của `RateLimitFilter` (backend), phản hồi trả về HTTP `429 Too Many Requests` kèm mã `4029` và header `Retry-After: <số giây>`.
  - Client bóc tách `retryAfterSeconds` từ response header.
  - Trên màn hình M01 (`/login`), nút submit bị vô hiệu hóa (`disabled`) lập tức và giao diện hiển thị đồng hồ đếm ngược động: *"Quá nhiều yêu cầu. Vui lòng đợi {countdown}s trước khi thử lại"*. Hệ thống chặn người dùng bấm liên tục, bảo vệ máy chủ không bị quá tải.

---

## 5. Hiện trạng Phân trang Chuẩn `PageResponse<T>` 0-based

### 5.1. Cấu trúc Đối tượng Phân trang
- `[XÁC NHẬN]` (`src/main/java/com/example/AIoTLibTQB/dto/response/PageResponse.java:13-26`):
  Backend định nghĩa:
  ```java
  public class PageResponse<T> {
      List<T> content;
      int page;           // 0-based
      int size;
      long totalElements;
      int totalPages;
      boolean last;
  }
  ```
- `[XÁC NHẬN]` (`frontend/src/types/api.ts:12-19`):
  Frontend định nghĩa TypeScript Interface khớp 100% với DTO của Backend.

### 5.2. Danh sách Màn hình Đã Áp dụng Phân trang Chuẩn
Toàn bộ các bảng danh sách dữ liệu động có nguy cơ phình to đều đã sử dụng component chuẩn `PaginationBar` (`frontend/src/components/ui/primitives.tsx:213-255`) hoạt động trên chỉ số **0-based**:

1. **M06 — Trung tâm Cảnh báo (`/alerts`)** (`frontend/src/app/(protected)/alerts/page.tsx:65, 96, 505-510`):
   - Quản lý `const [page, setPage] = useState<number>(0)`.
   - Gọi API: `alertsApi.list({ page, size: 10, ... })`.
   - Hiển thị: `{totalElements} bản ghi · Trang {page + 1} / {totalPages}`. Nút "Trước" bị khóa khi `page <= 0`, nút "Sau" bị khóa khi `page + 1 >= totalPages`.
2. **M08 — Quản trị Không gian & Phòng đọc (`/admin/rooms`)** (`frontend/src/app/(protected)/admin/rooms/page.tsx:64, 435-440`):
   - Quản lý `const [page, setPage] = useState<number>(0)`.
   - Gọi API: `roomsApi.list({ page, size: 10, floor })`.
3. **M10 — Quản trị Danh sách Thiết bị (`/admin/devices`)** (`frontend/src/app/(protected)/admin/devices/page.tsx:82, 457-462`):
   - Quản lý `const [page, setPage] = useState<number>(0)`.
   - Gọi API: `devicesApi.list({ page, size: 10, zoneId, roomId })`.
4. **M13 — Quản trị Người dùng (`/admin/users`)** (`frontend/src/app/(protected)/admin/users/page.tsx:63, 404-409`):
   - Quản lý `const [page, setPage] = useState<number>(0)`.
   - Gọi API: `iamApi.listUsers({ page, size: 10 })`.

### 5.3. Các Màn hình Không Dùng Phân trang Server & Rà soát Hợp lý
- **M02 (Kiosk) & M03 (Dashboard):** Gọi `useRoomsQuery({ page: 0, size: 50 })` để nạp toàn bộ danh sách phòng thư viện (thư viện Tạ Quang Bửu có khoảng 10–20 phòng đọc). Thiết kế này hợp lý vì màn hình Kiosk và Dashboard cần hiển thị ma trận toàn cảnh.
- **M04 (Bản đồ tầng):** Gọi `useRoomsQuery({ page: 0, size: 100 })` và `useDevicesQuery({ page: 0, size: 200 })` để vẽ đồng loạt toàn bộ các đa giác phòng và cảm biến trên Canvas. Hợp lý vì thuật toán nội suy IDW và Canvas clipping cần tọa độ đầy đủ trong tầng.
- **M07 (Tra cứu cảm biến thô):** Trả về mảng phẳng `List<TelemetryResponse>` lọc theo khoảng thời gian `start` và `end` ($\le 24\text{h}$). Client hiển thị bảng cuộn và có nút Xuất CSV.
- **M11 (Discovery):** API `GET /api/v1/devices/discovered` trả về mảng `List<DiscoveredDeviceResponse>` chưa phân trang (hàng đợi thiết bị mới thường chỉ có 1–5 thiết bị đang cắm điện chờ duyệt).
- **M14 (Roles & Permissions):** Backend trả về danh sách toàn bộ roles và permissions (`List<RoleResponse>`, `List<PermissionResponse>`) để dựng bảng ma trận checkbox 2 chiều.

---

## 6. Rà soát Tĩnh Điều hướng & Bảo toàn Dữ liệu Form (Navigation Audit)

### 6.1. Rà soát Màn hình "Ngõ cụt" (Dead-End Screens)
Kiểm tra khả năng thoát và quay lại của toàn bộ các route trong hệ thống:

| Mã MH | Tuyến đường (Route) | Hiện trạng Thanh điều hướng / Breadcrumbs | Đánh giá Ngõ cụt | Nhãn bằng chứng |
| :---: | :--- | :--- | :---: | :---: |
| **M01** | `/login` | Public page. Khi đăng nhập thành công tự động chuyển hướng về `/dashboard` hoặc `returnUrl`. | **Không** | `[XÁC NHẬN]` |
| **M02** | `/kiosk` | **KHÔNG có Sidebar, KHÔNG có Header, KHÔNG có nút Back/Thoát**. Toàn bộ màn hình hiển thị nền tối fullscreen dành cho TV Kiosk. | ⚠️ **CÓ (Dead-end đối với người dùng quản trị)** | `[XÁC NHẬN]` (`frontend/src/app/kiosk/page.tsx:202-234`) |
| **M03** | `/dashboard` | Sidebar `AppShell` hiển thị đầy đủ menu và profile. | **Không** | `[XÁC NHẬN]` |
| **M04** | `/floorplan` | Sidebar `AppShell`. Bấm vào phòng đọc mở Drawer có nút *"Xem chi tiết phòng"* dẫn tới M05. | **Không** | `[XÁC NHẬN]` |
| **M05** | `/rooms/[id]` | Có Breadcrumb: `Tổng quan` -> `Chi tiết phòng đọc` (`rooms/[id]/page.tsx:154-160`) và nút *"Bản đồ tầng"* (`rooms/[id]/page.tsx:184-187`). | **Không** | `[XÁC NHẬN]` |
| **M06** | `/alerts` | Sidebar `AppShell`. | **Không** | `[XÁC NHẬN]` |
| **M07** | `/telemetry-explorer` | Sidebar `AppShell`. | **Không** | `[XÁC NHẬN]` |
| **M08** | `/admin/rooms` | Sidebar `AppShell`. Mỗi dòng phòng đọc có nút *"Vẽ đa giác mặt bằng"* chuyển hướng tới M09. | **Không** | `[XÁC NHẬN]` |
| **M09** | `/admin/rooms/[id]/polygon` | Có Breadcrumb đầy đủ 3 cấp: `Bản đồ không gian` -> `Quản lý phòng` -> `Mặt bằng: {room.name}` (`polygon/page.tsx:357-367`). | **Không** | `[XÁC NHẬN]` |
| **M10** | `/admin/devices` | Sidebar `AppShell`. Có liên kết nhanh sang M11 (Discovery) và bấm vào dòng thiết bị chuyển sang M12. | **Không** | `[XÁC NHẬN]` |
| **M11** | `/admin/devices/discovery` | Có Breadcrumb: `Quản lý thiết bị` -> `Phát hiện thiết bị mới` (`discovery/page.tsx:188-193`). | **Không** | `[XÁC NHẬN]` |
| **M12** | `/admin/devices/[id]` | Có Breadcrumb: `Quản lý thiết bị` -> `{device.name}` (`devices/[id]/page.tsx:279-285`) và nút *"← Quay lại danh sách thiết bị"* khi có lỗi (`devices/[id]/page.tsx:260-262`). | **Không** | `[XÁC NHẬN]` |
| **M13** | `/admin/users` | Sidebar `AppShell`. | **Không** | `[XÁC NHẬN]` |
| **M14** | `/admin/roles` | Sidebar `AppShell`. | **Không** | `[XÁC NHẬN]` |
| **M15** | `/profile` | Sidebar `AppShell`. Có nút "Đăng xuất an toàn". | **Không** | `[XÁC NHẬN]` |

**Chi tiết điểm nghẽn M02 (`/kiosk`):**
Khi cán bộ thư viện đang ở trong trang quản trị bấm vào mục *"Màn hình Kiosk"* trên sidebar menu (`AppShell.tsx:180`), Next.js điều hướng sang `/kiosk`. Do tuyến `/kiosk` nằm ngoài layout `(protected)`, giao diện chuyển sang chế độ Standalone TV không có thanh menu hay nút bấm nào để quay trở lại `/dashboard`. Người dùng buộc phải dùng nút Back của trình duyệt hoặc gõ lại URL.  
👉 *Khuyến nghị:* Thêm nút nhỏ "Thoát Kiosk" ở góc trên bên phải (chỉ hiện khi hover hoặc có cờ phân quyền).

---

### 6.2. Rà soát Thất thoát Dữ liệu Form khi Chuyển trang (Form State Loss)
Phát hiện 3 rủi ro mất dữ liệu thao tác khi người dùng chuyển trang hoặc đóng mở modal:

1. **Trình biên tập đa giác mặt bằng M09 (`/admin/rooms/[id]/polygon`)** `[XÁC NHẬN]`:
   - Các đỉnh đa giác (`vertices`) và vị trí kéo thả thiết bị (`deviceDrafts`) được lưu trong bộ nhớ React cục bộ (`useState`).
   - Nếu quản trị viên đang chấm 5–7 đỉnh đa giác hoặc dịch chuyển vị trí trạm cảm biến nhưng vô tình bấm vào Breadcrumb (`Bản đồ không gian`, `Quản lý phòng`) hoặc liên kết trên sidebar, trang sẽ chuyển ngay lập tức mà **KHÔNG CÓ bất kỳ hộp thoại xác nhận nào** (`beforeunload` hoặc `router leave guard`). Toàn bộ công sức vẽ tọa độ mặt bằng sẽ bị hủy hoàn toàn.
2. **Hộp thoại tạo/sửa trên các trang quản trị (M08, M10, M11, M13, M14)** `[XÁC NHẬN]`:
   - Các trang này sử dụng `ModalDialog` với cơ chế bấm ra ngoài backdrop là đóng modal (`onClose`).
   - Khi đang nhập dữ liệu dài (ví dụ ở M13 nhập username, mật khẩu, email, phân vùng phụ trách), nếu người dùng vô tình bấm chuột trượt ra vùng đen ngoài modal, modal bị đóng và toàn bộ dữ liệu đang gõ dở bị reset về rỗng.
3. **Trang tra cứu dữ liệu cảm biến thô M07 (`/telemetry-explorer`)** `[XÁC NHẬN]`:
   - Trạng thái bộ lọc (`mode = room/device`, `targetId`, ngày giờ `startLocal`, `endLocal`) không được đồng bộ lên URL Search Parameters (`useSearchParams`).
   - Khi người dùng đang lọc xem dữ liệu 24h của một thiết bị cụ thể, nếu chuyển sang tab khác (ví dụ sang M10 kiểm tra hardwareId) rồi quay lại M07, form bộ lọc bị reset hoàn toàn về mặc định (chế độ phòng đọc, ngày giờ hiện tại), buộc người dùng phải chọn lại từ đầu.

---

## 7. Phân tích Chuyên sâu Phân hệ "Đổi Mật khẩu" (Password Change Deep-Dive)

Phân tích toàn diện luồng nghiệp vụ đổi mật khẩu từ Backend đến Frontend, đối chiếu giữa yêu cầu bảo mật hệ thống và hiện trạng mã nguồn thực tế.

### 7.1. Hiện trạng Endpoint Backend
- `[XÁC NHẬN]` (`src/main/java/com/example/AIoTLibTQB/controller/AuthenticationController.java`, `UserController.java`):
  **Backend HOÀN TOÀN KHÔNG CÓ endpoint chuyên biệt cho việc đổi mật khẩu** (ví dụ: không có `POST /api/v1/auth/change-password` hay `PUT /api/v1/users/change-password`).
- `[XÁC NHẬN]` (`src/main/java/com/example/AIoTLibTQB/dto/request/UserUpdateRequest.java:16`):
  DTO cập nhật thông tin người dùng `UserUpdateRequest` chứa trường:
  ```java
  String password;
  ```
- `[XÁC NHẬN]` (`src/main/java/com/example/AIoTLibTQB/service/UserService.java:95-125`):
  Logic đổi mật khẩu được "ký sinh" chung bên trong hàm `update(UserUpdateRequest request, String id)`:
  ```java
  public UserResponse update(UserUpdateRequest request, String id) {
      User user = userRepository.findById(id)...;
      var auth = SecurityContextHolder.getContext().getAuthentication();
      boolean isAdmin = auth != null && auth.getAuthorities().stream()
              .anyMatch(a -> "ADMIN".equals(a.getAuthority()) || "ROLE_ADMIN".equals(a.getAuthority()));
      boolean isSelf = auth != null && user.getUsername() != null && user.getUsername().equals(auth.getName());

      if (!isAdmin && !isSelf) {
          throw new AppException(ErrorCode.UNAUTHORIZED);
      }

      userMapper.updateUser(user, request);

      if (request.getPassword() != null && !request.getPassword().isBlank()) {
          user.setPassword(passwordEncoder.encode(request.getPassword()));
      }
      ...
      return userMapper.toUserResponse(userRepository.save(user));
  }
  ```

---

### 7.2. Hiện trạng Thực thi tại Frontend
- `[XÁC NHẬN]` (`frontend/src/app/(protected)/profile/page.tsx:52-89, 332-348`):
  Trên màn hình Hồ sơ cá nhân **M15** (`/profile`):
  - Form cập nhật đặt chung: Email, Số điện thoại và Mật khẩu mới trong cùng một thẻ `<form>`.
  - Ô nhập mật khẩu mới:
    ```tsx
    <label htmlFor="profile-password">
      Mật khẩu mới (tối thiểu 8 ký tự, để trống nếu không đổi)
    </label>
    <input
      id="profile-password"
      type="password"
      autoComplete="new-password"
      value={newPassword}
      onChange={(e) => setNewPassword(e.target.value)}
      placeholder="••••••••"
    />
    ```
  - Khi submit, hàm `handleUpdateProfile` gọi `updateUserMutation.mutate({ id: profile.id, body: { phone, email, password: newPassword ? newPassword : undefined } })`.
  - Sau khi lưu thành công: `setUser(updated); setNewPassword(''); void myInfoQuery.refetch(); pushToast(...)`.
- `[XÁC NHẬN]` (`frontend/src/app/(protected)/admin/users/page.tsx:150-180`):
  Trên màn hình Quản trị Người dùng **M13** (`/admin/users`):
  - Khi quản trị viên bấm sửa thông tin một người dùng, modal sửa người dùng cũng chứa trường `editPassword`. Khi nhập mật khẩu và bấm lưu, cùng một hàm `updateUserMutation` được gọi, ghi đè trực tiếp mật khẩu của người dùng đó.

---

### 7.3. Tổng hợp Các Khiếm khuyết & Lỗ hổng Bảo mật Trọng yếu

| STT | Vấn đề / Khiếm khuyết | Tầng phát sinh | Mô tả chi tiết & Mức độ rủi ro | Mức độ nghiêm trọng |
| :---: | :--- | :---: | :--- | :---: |
| 1 | **Thiếu trường Mật khẩu cũ (`oldPassword`)** | **Backend & Frontend** | Người dùng tự đổi mật khẩu tại M15 không cần cung cấp mật khẩu cũ. Bất kỳ ai tiếp cận máy tính khi người dùng quên khóa màn hình (hoặc session bị tấn công CSRF/XSS) đều có thể đổi mật khẩu mới trong 5 giây mà không gặp bất kỳ rào cản xác minh nào. | 🚨 **Rất nghiêm trọng (Critical)** |
| 2 | **Thiếu trường Xác nhận mật khẩu mới (`confirmPassword`)** | **Frontend** | Giao diện chỉ có 1 ô nhập `newPassword`. Người dùng gõ nhầm 1 ký tự sẽ bị đổi sang mật khẩu sai và bị khóa ngoài tài khoản ngay lập tức mà không có cơ chế tự khôi phục (vì hệ thống chưa có luồng Quên mật khẩu qua Email OTP). | ⚠️ **Nghiêm trọng (High)** |
| 3 | **Không thu hồi phiên làm việc (Session Revocation / Token Invalidation)** | **Backend & Frontend** | Sau khi đổi mật khẩu thành công: Token JWT cũ trên thiết bị hiện tại và trên các thiết bị khác (nếu có kẻ gian đăng nhập trước đó) **vẫn tiếp tục có hiệu lực 100%** cho đến khi hết hạn (hơn 1 giờ). Hệ thống không hề đưa access token cũ vào Blacklist và không thu hồi refresh token. | 🚨 **Rất nghiêm trọng (Critical)** |
| 4 | **Trộn lẫn luồng cập nhật thông tin cá nhân với đổi thông tin xác thực** | **Kiến trúc API** | Mật khẩu là dữ liệu nhạy cảm cấp cao nhưng bị gộp chung vào DTO `UserUpdateRequest` bên cạnh `phone`, `email`. Một request sửa số điện thoại nếu vô tình gửi kèm trường `password` rác có thể làm hỏng tài khoản. | ⚠️ **Trung bình (Medium)** |
| 5 | **Admin reset mật khẩu không có cơ chế Mật khẩu tạm thời** | **Nghiệp vụ IAM** | Khi Admin đặt lại mật khẩu cho nhân viên ở M13, Admin phải tự nghĩ một mật khẩu mới và gõ trực tiếp. Hệ thống không có cờ `mustChangePasswordOnNextLogin` (bắt buộc đổi mật khẩu ở lần đăng nhập đầu), dẫn đến nguy cơ Admin biết và dùng mật khẩu của người dùng. | ⚠️ **Trung bình (Medium)** |
| 6 | **Thiếu Rate Limit chuyên biệt cho thao tác đổi mật khẩu** | **Bảo mật API** | Không có giới hạn số lần thử mật khẩu cũ hoặc số lần đổi mật khẩu trong 1 giờ. Kẻ tấn công có thể brute-force liên tục nếu không bị chặn ở tầng ngoài. | ⚠️ **Trung bình (Medium)** |

---

## 8. Mục "Câu hỏi Mở & Đề xuất Cải tiến"

Dưới đây là các vấn đề cần Kiến trúc sư Trưởng (Lead) và Khách hàng/Người dùng chốt phương án trước khi triển khai các giai đoạn tiếp theo:

### 8.1. Đề xuất Kiến trúc cho Phân hệ Đổi Mật khẩu (Ưu tiên P0)
1. **Xây dựng endpoint chuyên biệt cho Người dùng tự đổi mật khẩu:**
   - Tạo mới `POST /api/v1/auth/change-password`
   - Request Body:
     ```json
     {
       "oldPassword": "string (bắt buộc)",
       "newPassword": "string (tối thiểu 8 ký tự, có chữ và số)",
       "confirmPassword": "string (phải trùng khớp newPassword)"
     }
     ```
   - Xử lý Backend:
     - So khớp `passwordEncoder.matches(oldPassword, user.getPassword())`. Nếu sai, trả mã lỗi `1003` hoặc mã lỗi mới `PASSWORD_INCORRECT`.
     - Mã hóa và lưu `newPassword`.
     - **Thu hồi toàn bộ phiên:** Đưa access token hiện tại vào Blacklist (`InvalidatedTokenRepository`), xóa bỏ mọi refresh token của user, buộc người dùng đăng nhập lại với mật khẩu mới.
2. **Xây dựng endpoint chuyên biệt cho Quản trị viên đặt lại mật khẩu (Admin Reset):**
   - Tạo mới `POST /api/v1/users/{id}/reset-password`.
   - Sinh mật khẩu ngẫu nhiên tạm thời (Secure Random 10 ký tự), trả về hiển thị 1 lần cho Admin bàn giao cho người dùng.
   - Thêm cờ `mustChangePassword: true` trong Document `User` để ép buộc chuyển hướng tới trang đổi mật khẩu ngay sau lần đăng nhập đầu tiên.

### 8.2. Đề xuất Dọn dẹp & Tối ưu Giao diện Frontend (Ưu tiên P1)
1. **Xử lý ngõ cụt tại Màn hình Kiosk M02 (`/kiosk`):**
   - Bổ sung nút bấm nhỏ gọn *"Thoát Kiosk về Dashboard"* ở góc trên bên phải (chỉ hiển thị khi rê chuột hoặc chạm vào màn hình) giúp nhân viên vận hành dễ dàng quay lại bảng điều khiển trung tâm.
2. **Bảo vệ chống mất dữ liệu khi rời trang tại Trình biên tập Mặt bằng M09:**
   - Bổ sung hook cảnh báo `useBeforeUnload` và chặn chuyển route nếu `vertices` hoặc `deviceDrafts` có sự thay đổi chưa lưu (`dirty state`).
3. **Đồng bộ bộ lọc của M07 (`/telemetry-explorer`) lên URL Search Params:**
   - Lưu trữ `?mode=room&targetId=...&start=...&end=...` trên thanh địa chỉ để khi người dùng reload trang hoặc chuyển tab rồi bấm Back, trạng thái truy vấn dữ liệu được khôi phục nguyên vẹn.
4. **Dọn dẹp các hàm Dead Code trong API Client:**
   - Tích hợp `telemetryApi.getDeviceLatest` vào trang Chi tiết thiết bị M12 để quản trị viên có thể xem ngay giá trị nhiệt độ/độ ẩm/bụi mịn tức thời của thiết bị đó mà không cần tra cứu phòng đọc.
   - Loại bỏ hoặc tái sử dụng `roomsApi.getByCode` và `devicesApi.listByZone`.

### 8.3. Đề xuất Hoàn thiện Kiểm soát Truy cập Phân vùng (Multi-Zone STOMP Security)
- Hiện tại, tầng HTTP `UserController` đã lưu mảng `assignedZones` của người dùng, nhưng kênh WebSocket STOMP (`WebSocketConfig.java`, `ChannelInterceptor`) mới chỉ kiểm tra frame `CONNECT` và `SUBSCRIBE` có token hợp lệ hay không, **chưa kiểm tra xem `roomId` được subscribe có thuộc phân vùng `assignedZones` của người dùng hay không**.
- *Đề xuất:* Nếu hệ thống yêu cầu bảo mật đa phân vùng nghiêm ngặt giữa các thủ thư quản lý tầng khác nhau, cần bổ sung logic tra cứu `room.zoneId` trong `ChannelInterceptor.preSend` khi nhận frame `SUBSCRIBE` tới `/topic/rooms/{roomId}/telemetry`.

---
*Báo cáo được khởi tạo tự động và kiểm toán độc lập bởi Teamwork Subagent Worker 2.*
