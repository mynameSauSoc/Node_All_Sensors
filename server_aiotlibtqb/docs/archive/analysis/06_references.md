# BÁO CÁO ĐỐI CHIẾU DỰ ÁN THAM KHẢO THỰC TẾ & BENCHMARK CÙNG DOMAIN
> **Mã tài liệu**: `PHASE2-REFERENCES-06` | **Hệ thống đối chiếu**: AIoTLibTQB (Smart Library IoT)  
> **Thời điểm lập**: 2026-10-21 | **Nguyên tắc**: Dữ liệu thực chứng 100%, bảo mật credentials (che ***)  
> **Quy ước nhãn chứng cứ**: `[XÁC NHẬN]` (minh chứng trực tiếp từ repo/docs/live demo) | `[SUY LUẬN]` (phân tích đối sánh kiến trúc) | `[CHƯA RÕ]` (vấn đề mở)

---

## 1. Danh Sách Các Dự Án Tham Khảo Thực Tế (Selected Reference Projects)

Để giải quyết bài toán của **AIoTLibTQB** (Hệ thống IoT giám sát vi khí hậu & âm học thư viện thông minh, tính điểm tiện nghi LCS, trực quan hóa mặt bằng floorplan canvas, quản trị thiết bị ESP32-S3 qua MQTT, CSDL MongoDB TimeSeries), chúng tôi đã khảo sát và chọn lọc **4 dự án thực tế tiêu biểu** trong cùng domain và domain gần nhất. Cả 4 dự án đều là mã nguồn mở, đang được bảo trì tích cực, có mã nguồn công khai, tài liệu API chi tiết và demo/dashboard trực quan:

| TT | Tên Dự Án | Đường Dẫn Repository & Tài Liệu | Lý Do Lựa Chọn & Sự Tương Đồng Domain | Độ Tin Cậy Nguồn & Giấy Phép |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **ThingsBoard Community Edition (CE)** | - Repo: [github.com/thingsboard/thingsboard](https://github.com/thingsboard/thingsboard)<br>- Docs: [thingsboard.io/docs](https://thingsboard.io/docs/)<br>- Demo: [demo.thingsboard.io](https://demo.thingsboard.io/) | Chuẩn mực công nghiệp cho IoT Platform nguồn mở viết trên nền Java/Spring Boot. Tương đồng về Ingestion MQTT, Rule Engine, mô hình vòng đời cảnh báo (Alarm Lifecycle 4 trạng thái), widget mặt bằng không gian (Image Map Floorplan theo tọa độ tương đối $[0.0, 1.0]$), WebSocket streaming và phân trang REST API. `[XÁC NHẬN: github.com/thingsboard/thingsboard]` | **Cực cao**: >18.5k stars, >6.5k forks, duy trì liên tục bởi ThingsBoard Inc. và cộng đồng toàn cầu, Apache-2.0 License. `[XÁC NHẬN]` |
| **2** | **OpenRemote** | - Repo: [github.com/openremote/openremote](https://github.com/openremote/openremote)<br>- Core: [github.com/openremote/core](https://github.com/openremote/core)<br>- Docs: [openremote.io/docs](https://openremote.io/docs/) | Nền tảng IoT mã nguồn mở chuyên sâu cho Smart Campus & Smart Building trên nền Java. Sở hữu mô hình phân cấp không gian phân tầng (*Campus $\rightarrow$ Building $\rightarrow$ Floor $\rightarrow$ Room $\rightarrow$ Device*) tương thích hoàn hảo với thực thể `Room` và ranh giới tường `boundaryPolygon` của AIoTLibTQB; hỗ trợ indoor map đa tầng, rule engine, cảnh báo đa kênh (Email, FCM Push, UI Log) và WebSocket API. `[XÁC NHẬN: openremote.io/docs]` | **Rất cao**: Phát triển bởi OpenRemote B.V., giấy phép AGPL-3.0, triển khai thực tế tại sân bay Schiphol và các đại học lớn tại châu Âu, commit tích cực 2024–2026. `[XÁC NHẬN]` |
| **3** | **AirGradient (Open Air / Indoor ONE)** | - Hardware/Firmware: [github.com/Open-Air-Foundation/firmware-one-openair](https://github.com/Open-Air-Foundation/firmware-one-openair)<br>- Map/Backend: [github.com/airgradienthq/airgradient-map](https://github.com/airgradienthq/airgradient-map)<br>- Docs & API: [airgradient.com/documentation](https://www.airgradient.com/documentation/) | Domain **TRÙNG KHỚP NHẤT**: Giám sát vi khí hậu và chất lượng không khí trong phòng học, thư viện và trường học. Trạm đo dùng vi điều khiển ESP32 đo CO2, bụi mịn PM, nhiệt ẩm, TVOC, ồn. Động cơ chấm điểm GO IAQS (0–10) áp dụng nguyên lý Bottleneck của thông số tệ nhất tương tự 100% nguyên lý Liebig Bottleneck trong `ComfortScoreService` của AIoTLibTQB. Dashboard trực quan gom nhóm theo Room/Place và API phân cụm Time Buckets (15m, 1h, 1d). `[XÁC NHẬN: openair.foundation]` | **Rất cao**: Dự án phi lợi nhuận (Open Air Foundation), hợp tác khoa học với Liên Hợp Quốc (UNEP) và các trường đại học quốc tế, Apache-2.0 / MIT License. `[XÁC NHẬN]` |
| **4** | **openSenseMap & senseBox** | - Frontend: [github.com/sensebox/openSenseMap](https://github.com/sensebox/openSenseMap)<br>- Backend API: [github.com/sensebox/openSenseMap-API](https://github.com/sensebox/openSenseMap-API)<br>- Live Portal: [opensensemap.org](https://opensensemap.org/)<br>- Docs: [docs.opensensemap.org](https://docs.opensensemap.org/) | Dự án quan trắc môi trường mở (nhiệt ẩm, bụi PM, tiếng ồn dB) do Đại học Münster khởi xướng cho giáo dục và nghiên cứu. Kiến trúc backend sử dụng **MongoDB với index GeoJSON `2dsphere`** (tương đồng hạ tầng MongoDB của AIoTLibTQB). Cung cấp giải thuật nội suy bản đồ nhiệt liên tục (Inverse Distance Weighting - IDW Heatmap Interpolation), REST API mở chuỗi thời gian, và giao diện sliding sidebar phân tích biểu đồ. `[XÁC NHẬN: opensensemap.org]` | **Cực cao**: Tài trợ bởi Bộ Giáo dục & Nghiên cứu Đức (BMBF) và ĐH Münster từ 2014 đến nay, hàng triệu bản ghi telemetry, hàng nghìn trạm đo thực tế, GPL-2.0. `[XÁC NHẬN]` |

---

## 2. Bảng Đối Chiếu Tổng Hợp 5 Trục (Comprehensive 5-Axis Benchmark Matrix)

| Trục Đối Chiếu | 1. ThingsBoard CE | 2. OpenRemote | 3. AirGradient | 4. openSenseMap | Dự Án Hiện Tại (AIoTLibTQB) & Khoảng Cách (Gap) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Trục 1: Nhóm chức năng cốt lõi & Vai trò người dùng** | - Phân cấp RBAC 3 tầng: `SYS_ADMIN`, `TENANT_ADMIN`, `CUSTOMER_USER` `[XÁC NHẬN]`.<br>- Modules: Device/Asset Management, Telemetry Ingestion, Rule Chain Flow, Alarm Lifecycle, Dashboard Editor. | - Multi-tenant qua Keycloak Realms. Vai trò: `Administrator`, `User`, `Restricted User` `[XÁC NHẬN]`.<br>- Modules: Spatial Asset Tree, Protocol Agents, Flow/When-Then Rules, Insights, Geofencing. | - Vai trò: `Account Owner`, `Admin`, `Member/Viewer` (cấu hình quyền xem/xuất CSV) `[XÁC NHẬN]`.<br>- Modules: Place/Room Monitoring, GO IAQS Score Engine, Scheduled Reports, Sensor Calibration. | - Vai trò: `Registered User` (sở hữu trạm senseBox), `Public Anonymous` (xem dữ liệu mở) `[XÁC NHẬN]`.<br>- Modules: senseBox Registration, Sensor Data Ingestion, Public Map, CSV Export, Spatial Query. | **AIoTLibTQB**: Đã có 7 Roles, 14 Quyền nguyên tử `[XÁC NHẬN: ApplicationInitConfig.java]`.<br> *Gap*: Thiếu vai trò khách công cộng vãng lai (Public Kiosk View cho bạn đọc thư viện xem màn hình LCD). |
| **Trục 2: Bố cục giao diện & Luồng điều hướng** | - **Sidebar**: Dashboards, Devices, Assets, Alarms, Rule Chains, Settings.<br>- **Header**: Tenant selector, Search, Notifications Bell (badge đếm đỏ), Fullscreen, Profile.<br>- **Flow**: Click Asset/Floorplan $\rightarrow$ Modal/Drawer hiển thị Telemetry & Alarms liên kết `[XÁC NHẬN]`. | - **Header**: Realm selector, User profile, Notification log.<br>- **Views**: Map View (chính), Asset Hierarchy Tree (bên trái), Rules Editor, Insights Dashboards.<br>- **Flow**: Duyệt cây Campus $\rightarrow$ Building $\rightarrow$ Floor $\rightarrow$ mở Map hiển thị marker `[XÁC NHẬN]`. | - **Nav Header**: Dashboard, Analytics, Places/Rooms, Settings, Alerts.<br>- **Main Screen**: Thẻ tóm tắt toàn trường (AQI / IAQ Score, trạm tệ nhất) $\rightarrow$ Lưới Card các phòng (Room Grid) $\rightarrow$ Chi tiết biểu đồ phòng `[XÁC NHẬN]`. | - **Fullscreen Map View** (Leaflet/MapLibre) với thanh công cụ lọc phenomenon (Nhiệt, Ẩm, PM, Ồn).<br>- **Sliding Sidebar**: Trượt ra từ bên trái khi click trạm đo, hiển thị thông tin trạm và biểu đồ chuỗi thời gian `[XÁC NHẬN]`. | **AIoTLibTQB**: Chưa có frontend. Bố cục đề xuất: Kết hợp Sidebar của ThingsBoard + Room Grid của AirGradient + Canvas Floorplan của OpenRemote/ThingsBoard `[SUY LUẬN]`. |
| **Trục 3: Hiển thị dữ liệu & Cơ chế Cảnh báo** | - **Widgets**: Timeseries chart (Flot/Chart.js), Digital/Analog Gauges, Cards, Image Map (tọa độ $0.0-1.0$).<br>- **Alarms**: 4 trạng thái (`ACTIVE_UNACK`, `ACTIVE_ACK`, `CLEARED_UNACK`, `CLEARED_ACK`), 5 mức Severity (`CRITICAL` $\rightarrow$ `INDETERMINATE`). Bảng Alarm với nút Ack/Clear `[XÁC NHẬN]`. | - **Widgets**: Asset Cards, Map markers đổi màu theo ngưỡng, Insights charts.<br>- **Alarms**: Đánh giá ngưỡng qua When-Then Rules. Phát cảnh báo qua: UI Log, Email (SMTP), Push Notifications (FCM di động), Âm thanh còi `[XÁC NHẬN]`. | - **Widgets**: Thang điểm GO IAQS (0-10, phân cấp Xanh/Cam/Đỏ), Gauge kim, Biểu đồ đa thông số chồng lớp (Overlay PM + CO2 + Temp).<br>- **Alarms**: Ngưỡng vi phạm PM2.5, CO2, thông báo trạm mất sóng >30 phút, gửi Email/Webhook `[XÁC NHẬN]`. | - **Widgets**: Điểm đo thời gian thực trên bản đồ, Biểu đồ lịch sử ngày/tuần, Lớp bản đồ nhiệt liên tục (IDW Heatmap Interpolation layer).<br>- **Alarms**: Không tập trung vào cảnh báo trực tiếp (chỉ hiển thị trạng thái trạm active/inactive) `[XÁC NHẬN]`. | **AIoTLibTQB**: Đã có thuật toán LCS (0-100) và Document `Alert` `[XÁC NHẬN: ComfortScoreService.java, Alert.java]`.<br> *Gap*: **Hoàn toàn thiếu AlertService/Controller**, thiếu bảng Alarm trên UI, thiếu cơ chế thông báo (Email/WebSocket). |
| **Trục 4: Cách API phục vụ giao diện (REST/Realtime/Auth)** | - **Auth**: Bearer JWT (`X-Authorization`), Refresh Token.<br>- **Phân trang**: Chuẩn `PageData<T>` (`pageSize`, `page`, `sortProperty`, `sortOrder`, `textSearch`).<br>- **Realtime**: WebSocket `/api/ws` hỗ trợ pub/sub commands (`tsSubCmds`, `alarmSubCmds`) `[XÁC NHẬN]`. | - **Auth**: OAuth2 / OpenID Connect Bearer qua Keycloak.<br>- **REST**: `GET /api/{realm}/asset/{id}`.<br>- **Realtime**: WebSocket `wss://.../websocket/events` với cú pháp `SUBSCRIBE: {"eventType": "attribute"}` `[XÁC NHẬN]`. | - **Auth**: API Token / Session Cookie.<br>- **REST**: API theo mốc gom nhóm (Time Buckets: `/measures/past`, `/measures/buckets/{bucketSize}`). Hỗ trợ downsampling 15m/1h/1d.<br>- **Realtime**: REST Polling ngắn hạn hoặc MQTT cục bộ `[XÁC NHẬN]`. | - **Auth**: Bearer JWT cho quản trị trạm.<br>- **REST**: `GET /boxes?bbox=...&phenomenon=...`, `GET /boxes/{id}/sensors/{id}/measurements`. Không dùng cursor pagination mà lọc theo BBox & Time range.<br>- **Realtime**: WebSockets hoặc REST Polling `[XÁC NHẬN]`. | **AIoTLibTQB**: Đã có JWT + Rate limit `[XÁC NHẬN: SecurityConfig.java]`.<br> *Gap*: Bất nhất phân trang; Controller trả về TimeSeries thô không nén; `spring-boot-starter-websocket` là dead dependency (chưa kích hoạt STOMP/WS) `[XÁC NHẬN: 05_p1_summary.md]`. |
| **Trục 5: Điểm đáng học & Điểm KHÔNG NÊN học** | - **Đáng học**: Widget Image Map dùng tọa độ tương đối ($0.0-1.0$) cho floorplan; Vòng đời cảnh báo 4 trạng thái; WebSocket command subscription.<br>- **KHÔNG NÊN học**: Akka Actor Rule Engine quá phức tạp; CSDL lai PostgreSQL + Cassandra cồng kềnh `[SUY LUẬN]`. | - **Đáng học**: Cấu trúc phân cấp tài sản (*Campus $\rightarrow$ Floor $\rightarrow$ Room $\rightarrow$ Device*); Đa kênh cảnh báo (Email + UI Bell).<br>- **KHÔNG NÊN học**: Tích hợp quá nhiều giao thức qua Apache Camel (BACnet, KNX, Modbus...) gây phình to hệ thống `[SUY LUẬN]`. | - **Đáng học**: Thiết kế Dashboard tối ưu cho trường học/thư viện (Room Grid cards); Phân giải Time Buckets (15m/1h) chống tràn RAM; Chuẩn hóa ngưỡng WHO/ASHRAE.<br>- **KHÔNG NÊN học**: Phụ thuộc Serverless Cloud; thiếu Floorplan 2D canvas clipping `[SUY LUẬN]`. | - **Đáng học**: Kỹ thuật nội suy không gian Inverse Distance Weighting (IDW) vẽ Heatmap trên canvas; GeoJSON index MongoDB `2dsphere`.<br>- **KHÔNG NÊN học**: Thiếu cơ chế phân trang chuẩn trên danh sách cảm biến; thiếu hệ thống cảnh báo vận hành `[SUY LUẬN]`. | **Định hướng AIoTLibTQB**: Học hỏi cách thiết kế Room Card của AirGradient + Canvas Floorplan Image Map của ThingsBoard + Thuật toán IDW của openSenseMap + Vòng đời Alert của ThingsBoard `[SUY LUẬN]`. |

---

## 3. Phân Tích Chuyên Sâu Từng Dự Án Tham Khảo theo 5 Trục

### 3.1. Dự Án 1: ThingsBoard Community Edition (CE)
* **Website**: [https://thingsboard.io](https://thingsboard.io) `[XÁC NHẬN]`
* **GitHub Repository**: [https://github.com/thingsboard/thingsboard](https://github.com/thingsboard/thingsboard) (Java / Spring Boot, Angular UI) `[XÁC NHẬN]`
* **Tài liệu API & Demo**: [https://thingsboard.io/docs/reference/rest-api/](https://thingsboard.io/docs/reference/rest-api/) | [https://demo.thingsboard.io/](https://demo.thingsboard.io/) `[XÁC NHẬN]`

#### Trục 1: Nhóm chức năng cốt lõi và vai trò người dùng
- **Phân quyền người dùng (User Roles)**: Cung cấp 3 cấp thẩm quyền cố định `[XÁC NHẬN: thingsboard.io/docs/user-guide/rbac/]`:
  1. `SYS_ADMIN` (System Administrator): Quản trị toàn bộ hạ tầng, cấu hình máy chủ thư điện tử (Mail Server), giám sát logs toàn hệ thống, tạo và quản lý các Đơn vị thuê (Tenants).
  2. `TENANT_ADMIN` (Tenant Administrator): Quản lý thiết bị (Devices), nhóm tài sản (Assets), thiết kế bảng điều khiển (Dashboards), tạo chuỗi quy tắc (Rule Chains), quản lý cảnh báo (Alarms) và phân quyền cho Khách hàng (Customers).
  3. `CUSTOMER_USER` (End-user / Viewer): Người dùng cuối thuộc một tổ chức/phòng ban, chỉ có quyền xem hoặc thao tác trên các Dashboard và Thiết bị được cấp phát trực tiếp.
- **Nhóm chức năng cốt lõi**:
  - *Device Management*: Quản lý vòng đời trạm đo, Device Profiles (chứa quy tắc tính toán và ngưỡng cảnh báo mặc định), thông tin kết nối (Credentials: Access Token, MQTT Basic Auth, X.509 Certificate).
  - *Asset Management*: Gom nhóm thực thể theo mô hình vật lý/không gian (Tòa nhà, Phòng đọc, Khu vực kỹ thuật).
  - *Data Ingestion & Rule Engine*: Tiếp nhận MQTT/HTTP/CoAP; xử lý dữ liệu qua chuỗi Rule Chain (dựa trên Akka Actor Model) để lọc, tính toán trường phái sinh và kích hoạt báo động.
  - *Alarm Lifecycle*: Khởi tạo, leo thang (Escalate), xác nhận (Acknowledge) và xóa/giải quyết (Clear) cảnh báo.

#### Trục 2: Bố cục giao diện & Luồng điều hướng (UI Layout & Navigation)
- **Thanh điều hướng Sidebar (Trái)**: Cố định gồm các mục: *Home*, *Rule Chains*, *Customers*, *Asset Groups*, *Device Groups*, *Device Profiles*, *Dashboards*, *Alarms*, *Audit Logs*, *Settings* `[XÁC NHẬN: demo.thingsboard.io]`.
- **Thanh tiêu đề Header (Trên)**: Chứa bộ chọn Tenant/Customer, thanh tìm kiếm toàn cục, chuông thông báo (Notification Center có badge đếm số lượng chưa đọc), nút chuyển chế độ Toàn màn hình (Fullscreen) và Avatar cấu hình tài khoản cá nhân.
- **Bảng điều khiển Dashboard**: Thiết kế dạng lưới kéo thả (Grid Layout) linh hoạt gồm nhiều trạng thái (Dashboard States) tạo thành luồng điều hướng mượt mà:
  - *Luồng điều hướng mẫu*: `Màn hình Tổng quan Mặt bằng Tầng` $\rightarrow$ Click vào marker một Trạm đo hoặc Đa giác Phòng đọc $\rightarrow$ Kích hoạt `Action: Navigate to State` $\rightarrow$ Mở `Chi tiết Trạm đo / Phòng` với các biểu đồ chuỗi thời gian và bảng sự cố của riêng thực thể đó `[XÁC NHẬN: thingsboard.io/docs/user-guide/dashboards/]`.

#### Trục 3: Cách hiển thị dữ liệu & Cơ chế Cảnh báo/Thông báo
- **Hiển thị dữ liệu đa dạng**:
  - *Digital & Radial Gauges*: Hiển thị tức thời chỉ số nhiệt độ, độ ẩm, độ ồn (dB) kèm dải màu ngưỡng an toàn (Xanh - Vàng - Đỏ).
  - *Timeseries Charts*: Biểu đồ đường (Line Chart) và cột (Bar Chart) hỗ trợ bật/tắt chuỗi dữ liệu, zoom dải thời gian linh hoạt (1h, 6h, 1d, 7d, tùy chọn).
  - *Widget Image Map (Mặt bằng Tầng/Floorplan)*: Sử dụng ảnh nền sơ đồ mặt bằng kiến trúc (PNG/SVG). Các trạm đo được định vị theo **hệ tọa độ tương đối từ $0.0$ đến $1.0$** ($xPos, yPos$). Hỗ trợ vẽ đa giác (Polygon) ranh giới phòng, đổi màu sắc đa giác theo điểm tiện nghi hoặc trạng thái cảnh báo `[XÁC NHẬN: thingsboard.io/docs/user-guide/ui/widget-library/#image-map]`.
- **Cơ chế Cảnh báo (Alarm System)**:
  - *Vòng đời 4 trạng thái*: `ACTIVE_UNACK` (Đang bị sự cố, chưa ai nhận) $\rightarrow$ `ACTIVE_ACK` (Đang bị sự cố, quản trị viên đã bấm nhận xử lý) $\rightarrow$ `CLEARED_UNACK` (Thông số đã về mức an toàn, nhưng chưa ai bấm xác nhận) $\rightarrow$ `CLEARED_ACK` (Sự cố đã kết thúc và đã được xác nhận đóng) `[XÁC NHẬN: thingsboard.io/docs/user-guide/alarms/]`.
  - *5 cấp độ nghiêm trọng (Severity)*: `CRITICAL` (Đỏ), `MAJOR` (Cam), `MINOR` (Vàng), `WARNING` (Xanh lơ), `INDETERMINATE` (Xám). Tự động nâng cấp mức độ nghiêm trọng nếu sự cố kéo dài mà không tạo thêm bản ghi trùng lặp.
  - *Thông báo trên UI*: Bảng Alarms Table tích hợp trực tiếp 2 nút thao tác nhanh `Acknowledge` và `Clear`; Chuông thông báo header bắn popup toast khi có sự cố mới.

#### Trục 4: Cách API phục vụ giao diện (REST / Realtime / Auth)
- **Chuẩn hóa Phân trang & Lọc (Pagination)**:
  - Tất cả các endpoint danh sách (Devices, Assets, Alarms, Users) đều bắt buộc sử dụng đối tượng phân trang chuẩn `PageData<T>` với các query parameters: `pageSize` (kích thước trang), `page` (chỉ số trang từ 0), `sortProperty` (trường sắp xếp), `sortOrder` (`ASC`/`DESC`), `textSearch` (tìm kiếm từ khóa).
  - Lọc sự cố theo thời gian (`startTime`, `endTime`), trạng thái (`status`), mức nghiêm trọng (`severity`), và loại lỗi (`type`).
- **Giao thức đẩy Realtime (WebSocket API)**:
  - Endpoint duy nhất: `wss://<host>/api/ws` (hoặc `/api/ws/plugins/telemetry`).
  - Cơ chế Pub/Sub qua lệnh JSON: Frontend gửi lệnh đăng ký lắng nghe `tsSubCmds` (cho Telemetry thời gian thực) hoặc `alarmSubCmds` (cho Cảnh báo mới) kèm theo `entityType` (`DEVICE`, `ASSET`) và `entityId` `[XÁC NHẬN: thingsboard.io/docs/user-guide/telemetry/#websocket-api]`. Backend tự động đẩy bản tin mới khi có telemetry hoặc alarm mà không cần client phải HTTP polling.
- **Cơ chế Xác thực (Auth)**:
  - Header: `X-Authorization: Bearer <jwt-token>` (hoặc query param `token` khi bắt tay WebSocket). Refresh token cấp qua `/api/auth/token`.

#### Trục 5: Điểm ĐÁNG HỌC và KHÔNG NÊN HỌC cho AIoTLibTQB
- **Điểm ĐÁNG HỌC**:
  1. *Hệ tọa độ tương đối Image Map*: Mô hình $x, y \in [0.0, 1.0]$ của ThingsBoard giúp hiển thị marker trạm đo và đa giác phòng trên canvas mặt bằng responsive hoàn hảo trên mọi kích thước màn hình mà không sợ vỡ tỷ lệ.
  2. *Mô hình vòng đời Alarm 4 trạng thái*: Cần áp dụng ngay cấu trúc `ACTIVE_UNACK`, `ACTIVE_ACK`, `CLEARED_UNACK`, `CLEARED_ACK` vào thực thể `Alert.java` của AIoTLibTQB để phục vụ quy trình vận hành thư viện thực tế.
  3. *WebSocket Data Subscription Protocol*: Thiết kế WebSocket cho phép subscribe theo `roomId` hoặc `deviceId` thay vì broadcast toàn bộ dữ liệu.
- **Điểm KHÔNG NÊN HỌC (Over-engineering)**:
  1. *Rule Engine Actor Model (Akka)*: Quá phức tạp và ngốn RAM đối với dự án quy mô vừa và nhỏ; AIoTLibTQB chỉ cần viết Rule Service bằng Java logic thuần hoặc SpEL.
  2. *Kiến trúc CSDL lai (PostgreSQL + Cassandra)*: Cassandra chỉ cần thiết khi tiếp nhận >50,000 bản tin/giây. AIoTLibTQB sử dụng MongoDB 8.0 Native TimeSeries là hoàn toàn đủ tải và tinh gọn hơn rất nhiều `[SUY LUẬN]`.

---

### 3.2. Dự Án 2: OpenRemote
* **Website**: [https://openremote.io](https://openremote.io) `[XÁC NHẬN]`
* **GitHub Repositories**: [https://github.com/openremote/openremote](https://github.com/openremote/openremote) | [https://github.com/openremote/core](https://github.com/openremote/core) (Java, Web Components) `[XÁC NHẬN]`
* **Tài liệu Kỹ thuật**: [https://openremote.io/docs/](https://openremote.io/docs/) `[XÁC NHẬN]`

#### Trục 1: Nhóm chức năng cốt lõi và vai trò người dùng
- **Phân quyền & Multi-tenancy**:
  - Dựa trên nền tảng **Keycloak OpenID Connect**: Phân chia không gian quản trị theo các Vùng độc lập (*Realms*).
  - Vai trò người dùng: `Administrator` (toàn quyền cấu hình realm, user, asset type), `User` (vận hành, xem dữ liệu, chỉnh sửa kịch bản), `Restricted User` (chỉ xem một số nhánh tài sản chỉ định) `[XÁC NHẬN: openremote.io/docs/user-guide/realms-and-users/]`.
- **Nhóm chức năng cốt lõi**:
  - *Mô hình Tài sản Không gian Phân tầng (Hierarchical Spatial Asset Model)*: Cho phép xây dựng cây thực thể phản ánh chính xác cấu trúc thực tế: `Campus` $\rightarrow$ `Building` $\rightarrow$ `Floor` $\rightarrow$ `Room` $\rightarrow$ `Sensor / Actuator`.
  - *Protocol Agents*: Tích hợp linh hoạt đa giao thức (MQTT Agent, HTTP Agent, LoRaWAN Agent, BACnet...).
  - *Rule Engine (When-Then & Groovy Scripts)*: Tạo kịch bản tự động hóa (Ví dụ: "Khi độ ồn phòng đọc > 65dB trong 3 phút liên tục $\rightarrow$ Bật cảnh báo & gửi thông báo").
  - *Insights Dashboard Builder*: Tự dựng giao diện theo dõi số liệu cho ban quản lý tòa nhà.

#### Trục 2: Bố cục giao diện & Luồng điều hướng (UI Layout & Navigation)
- **Cấu trúc màn hình chính (Manager UI)**:
  - Thiết kế hiện đại với **Map View làm trung tâm** hiển thị toàn màn hình (sử dụng OpenStreetMap hoặc Vector Tiles) `[XÁC NHẬN: openremote.io/docs/user-guide/manager-ui/]`.
  - Phía bên trái là thanh điều hướng dạng Tab:
    1. *Map*: Bản đồ địa lý / mặt bằng không gian.
    2. *Assets*: Cây phân cấp đối tượng không gian và danh mục cảm biến.
    3. *Rules*: Trình quản lý kịch bản tự động hóa và ngưỡng cảnh báo.
    4. *Insights*: Các biểu đồ tổng hợp và báo cáo vận hành.
- **Luồng điều hướng cây không gian (Spatial Navigation Flow)**:
  - Người dùng bấm chọn Tầng 2 trong cây thư mục $\rightarrow$ Bản đồ tự động chuyển lớp (layer switch) hiển thị mặt bằng tầng 2 $\rightarrow$ Bấm chọn Phòng đọc 201 $\rightarrow$ Panel bên phải trượt ra (Drawer/Sidebar) hiển thị danh sách toàn bộ cảm biến môi trường gắn trong phòng đó kèm biểu đồ tức thời.

#### Trục 3: Cách hiển thị dữ liệu & Cơ chế Cảnh báo/Thông báo
- **Hiển thị dữ liệu không gian (Spatial Data Rendering)**:
  - Bản đồ tầng hiển thị vị trí các thiết bị với icon trạng thái (Online màu xanh, Offline màu xám, Báo động màu đỏ nhấp nháy).
  - Hỗ trợ hiển thị các thuộc tính động (Live Attributes) trực tiếp trên nhãn marker (ví dụ: hiển thị số đo nhiệt độ $24.5^\circ\text{C}$ ngay trên icon trạm đo).
  - Tích hợp biểu đồ lịch sử ngắn hạn dạng sparkline ngay trong thẻ tóm tắt tài sản.
- **Cơ chế Cảnh báo Đa kênh (Multi-channel Alerting)**:
  - Khi một giá trị thuộc tính vượt ngưỡng, hệ thống kích hoạt `Rule Alert` và phân phối thông báo qua 3 kênh chính `[XÁC NHẬN: openremote.io/docs/user-guide/rules-and-automation/]`:
    1. *In-app Notifications*: Lưu vào bảng nhật ký sự cố trong Manager UI kèm chuông thông báo.
    2. *Email Alert*: Gửi email qua máy chủ SMTP tích hợp với nội dung vi phạm chi tiết.
    3. *Mobile Push*: Bắn thông báo đẩy về ứng dụng di động thông qua Firebase Cloud Messaging (FCM).

#### Trục 4: Cách API phục vụ giao diện (REST / Realtime / Auth)
- **Chuẩn giao tiếp REST API**:
  - Thiết kế API trực quan theo mô hình hướng tài nguyên:
    - Lấy thông tin tài sản: `GET /api/{realm}/asset/{assetId}`
    - Cập nhật giá trị thuộc tính: `PUT /api/{realm}/asset/{assetId}/attribute/{attributeName}`
    - Truy vấn chuỗi thời gian lịch sử: `POST /api/{realm}/asset/datapoints` kèm bộ lọc thời gian và phương thức tổng hợp (`fromTimestamp`, `toTimestamp`, `aggregationType: AVG/MAX/MIN`) `[XÁC NHẬN: openremote.io/docs/developer-guide/rest-apis/]`.
- **WebSocket Streaming thời gian thực**:
  - Kết nối qua URL: `wss://<host>/websocket/events?Realm={realm}&Authorization=Bearer%20{token}`.
  - Client gửi gói tin đăng ký dạng text:
    ```json
    SUBSCRIBE: {"eventType": "attribute", "filter": {"ref": {"id": "<asset-id>", "name": "<attribute-name>"}}}
    ```
  - Máy chủ phản hồi luồng sự kiện `SharedEvent` mỗi khi có thay đổi dữ liệu từ thiết bị IoT.
- **Bảo mật & Cấp quyền**:
  - Tích hợp sâu Keycloak OAuth2 / OpenID Connect với JSON Web Tokens (JWT).

#### Trục 5: Điểm ĐÁNG HỌC và KHÔNG NÊN HỌC cho AIoTLibTQB
- **Điểm ĐÁNG HỌC**:
  1. *Mô hình Không gian Phân tầng (Spatial Hierarchy)*: Rất đáng áp dụng cho AIoTLibTQB. Hiện tại AIoTLibTQB đã có `Room` và `Floor`, cần hoàn thiện mối quan hệ phân tầng rõ ràng từ Thư viện $\rightarrow$ Tầng (`floor`) $\rightarrow$ Phòng (`Room`) $\rightarrow$ Trạm đo (`Device`) để phục vụ luồng điều hướng của giao diện người dùng.
  2. *Cảnh báo đa kênh*: Cơ chế bắn thông báo Email và Web Notification khi xảy ra vi phạm tiện nghi nghiêm trọng là tính năng thiết yếu mà thủ thư/quản lý cần có.
- **Điểm KHÔNG NÊN HỌC (Over-engineering)**:
  1. *Kiến trúc đa giao thức cồng kềnh với Apache Camel*: OpenRemote phải hỗ trợ hàng chục giao thức công nghiệp (KNX, BACnet, Modbus, SNMP...), trong khi AIoTLibTQB chỉ cần chuyên biệt hóa một đường MQTT cho trạm ESP32.
  2. *Sự phụ thuộc nặng nề vào Keycloak độc lập*: Cài đặt thêm một container Keycloak ngốn 1–2 GB RAM; AIoTLibTQB đã có phân hệ IAM Spring Security JWT nội bộ cực kỳ gọn nhẹ và hiệu quả `[SUY LUẬN]`.

---

### 3.3. Dự Án 3: AirGradient (Open Air / Indoor ONE)
* **Website**: [https://www.airgradient.com](https://www.airgradient.com) `[XÁC NHẬN]`
* **GitHub Repositories**:
  - Firmware trạm đo: [github.com/Open-Air-Foundation/firmware-one-openair](https://github.com/Open-Air-Foundation/firmware-one-openair) (C++ / Arduino ESP32) `[XÁC NHẬN]`
  - Bản đồ & Backend: [github.com/airgradienthq/airgradient-map](https://github.com/airgradienthq/airgradient-map) (NestJS / Nuxt.js) `[XÁC NHẬN]`
* **Tài liệu API**: [https://api.airgradient.com/public/docs/api/v1/](https://api.airgradient.com/public/docs/api/v1/) `[XÁC NHẬN]`
* **Tài liệu Người dùng & Hướng dẫn**: [https://www.airgradient.com/documentation/](https://www.airgradient.com/documentation/) `[XÁC NHẬN]`

#### Trục 1: Nhóm chức năng cốt lõi và vai trò người dùng
- **Đối tượng & Vai trò người dùng (Chuyên biệt cho Trường học & Tổ chức)**:
  - `Account Owner`: Chủ tài khoản trường học/tổ chức, quản lý gói dịch vụ và toàn bộ hạ tầng trạm đo.
  - `Admin`: Ban giám hiệu, quản lý cơ sở vật chất; toàn quyền cấu hình địa điểm (Places), phòng (Rooms), ngưỡng cảnh báo và lịch trình hoạt động.
  - `Member / Viewer`: Giáo viên, học sinh, phụ huynh hoặc bạn đọc; chỉ có quyền xem trạng thái môi trường phòng học/phòng đọc, xem biểu đồ và tải báo cáo nếu được cấp quyền `[XÁC NHẬN: airgradient.com/documentation/dashboard/]`.
- **Nhóm chức năng cốt lõi**:
  - *Quản lý Không gian học đường*: Cấu hình theo mô hình `Account` $\rightarrow$ `Place` (Trường/Tòa nhà) $\rightarrow$ `Location Group` (Tầng/Khối) $\rightarrow$ `Room / Location` (Phòng cụ thể) $\rightarrow$ `Monitor` (Trạm đo).
  - *Chấm điểm Tiện nghi Môi trường GO IAQS (Global Open Indoor Air Quality Standards)*: Quy đổi các nồng độ CO2, PM2.5, PM10, TVOC, Nhiệt độ và Độ ẩm thành thang điểm trực quan từ 10 (Tối ưu) đến 0 (Rất kém) `[XÁC NHẬN: airgradient.com/documentation/iaqs/]`.
  - *Lịch trình Hoạt động (Operating Schedules)*: Tự động tách biệt giờ phòng đọc mở cửa với ban đêm/ngày nghỉ để tính toán báo cáo chính xác.
  - *Cảnh báo Mất sóng & Vượt ngưỡng*: Tự động phát hiện trạm ngắt kết nối quá 30 phút.

#### Trục 2: Bố cục giao diện & Luồng điều hướng (UI Layout & Navigation)
- **Bố cục Dashboard chuẩn (Classroom/Library-Centric Layout)** `[XÁC NHẬN: app.airgradient.com]`:
  - **Banner Tổng quan đỉnh trang**: Hiển thị Điểm số tiện nghi trung bình toàn cơ sở (ví dụ: *“Overall Quality: GOOD (8.8/10)”*) kèm cảnh báo trạm có chất lượng xấu nhất cần can thiệp ngay (ví dụ: *“Worst Room: Room 204 - Elevated CO2”*).
  - **Lưới Thẻ Phòng (Room Card Grid)**: Mỗi phòng đọc được đại diện bằng một thẻ (Card) trực quan gồm:
    - Tên phòng & Nhãn tầng.
    - Điểm chất lượng môi trường kèm dải màu (Xanh lá = Tốt, Cam = Trung bình, Đỏ = Kém).
    - Các thông số then chốt hiển thị to rõ: CO2 (ppm), PM2.5 ($\mu\text{g/m}^3$), Nhiệt độ ($^\circ\text{C}$), Độ ẩm (%).
    - Icon quạt/cửa sổ gợi ý hành động khi vượt ngưỡng (ví dụ: Icon mở cửa thông gió khi CO2 cao).
- **Luồng điều hướng chi tiết**:
  - Click vào thẻ phòng $\rightarrow$ Chuyển sang màn hình `Analytics Page` của phòng đó.
  - Người dùng có thể chọn dải ngày, bật tính năng `Multi-Parameter Overlay` để vẽ đè đường biểu diễn độ ồn, bụi PM và nhiệt độ trên cùng một trục thời gian nhằm phân tích mối tương quan.

#### Trục 3: Cách hiển thị dữ liệu & Cơ chế Cảnh báo/Thông báo
- **Hiển thị dữ liệu trực quan**:
  - Áp dụng các dải màu chuẩn hóa quốc tế (WHO, EPA, ASHRAE 62.1): Xanh dương / Xanh lá (A/Good), Cam (B/Moderate), Đỏ (Z/Unhealthy).
  - Biểu đồ chuỗi thời gian có vẽ sẵn các dải phân cách ngưỡng an toàn (Target Guideline Bands) giúp người xem không cần kiến thức kỹ thuật vẫn biết phòng đọc có đạt chuẩn hay không.
- **Cơ chế Cảnh báo (Alerts Engine)**:
  - Cảnh báo ngưỡng vi phạm: Cho phép cấu hình ngưỡng vi phạm riêng theo từng loại phòng (ví dụ: Phòng đọc sách yêu cầu CO2 < 800 ppm, kho lưu trữ sách yêu cầu độ ẩm < 60%).
  - Cảnh báo trạm ngoại tuyến: Tự động gửi thông báo khi trạm đo không gửi số liệu quá 30 phút.
  - Kênh phân phối: Email định kỳ hoặc tức thời cho quản lý cơ sở vật chất; Webhook bắn sang hệ thống tòa nhà hoặc Discord/Slack.

#### Trục 4: Cách API phục vụ giao diện (REST / Realtime / Auth)
- **Thiết kế API Nén Chuỗi Thời Gian (Time Buckets & Aggregation)** `[XÁC NHẬN: api.airgradient.com/public/docs/api/v1/]`:
  - Đây là thiết kế **quan trọng nhất đáng học hỏi**: AirGradient không trả về dữ liệu thô hàng chục nghìn điểm mà chia thành các endpoint chuyên dụng:
    - `GET /public/api/v1/locations/{id}/measures/raw`: Chỉ lấy danh sách số liệu thô mới nhất (mặc định giới hạn 200 bản ghi gần nhất).
    - `GET /public/api/v1/locations/{id}/measures/past`: Lấy dữ liệu lịch sử đã được **nén sẵn theo Time Buckets** (5 phút, 15 phút, hoặc 1 giờ) với các giá trị `$avg`, `$min`, `$max`.
    - `GET /public/api/v1/locations/{ids}/measures/buckets/{bucketSize}`: Lấy dữ liệu tổng hợp đồng thời của nhiều phòng để vẽ biểu đồ so sánh.
- **Xác thực & Bảo mật**:
  - Sử dụng Token xác thực dạng Bearer cấp phát từ Dashboard; hỗ trợ cả Local Server API trực tiếp từ vi điều khiển ESP32 qua mạng LAN (`GET http://airgradient_<serial>.local/measures/current`).

#### Trục 5: Điểm ĐÁNG HỌC và KHÔNG NÊN HỌC cho AIoTLibTQB
- **Điểm ĐÁNG HỌC (Giá trị ứng dụng cao nhất cho AIoTLibTQB)**:
  1. *Triết lý Liebig Bottleneck đồng điệu*: Thuật toán tính điểm tiện nghi LCS của AIoTLibTQB trong `ComfortScoreService.java` hoàn toàn tương đồng với GO IAQS của AirGradient (lấy chỉ số vi phạm nặng nhất làm nút thắt cổ chai). Giao diện AIoTLibTQB nên học hỏi cách hiển thị điểm số $0-100$ kèm nhãn phân hạng (Platinum, Gold, Silver, Bronze, Poor) rõ ràng như AirGradient.
  2. *API Time Buckets Downsampling*: AIoTLibTQB hiện đang bị lỗi trả về `List<TelemetryResponse>` thô không nén gây nguy cơ OOM RAM `[XÁC NHẬN: 05_p1_summary.md:59-61]`. Cần áp dụng ngay mô hình API `measures/past?bucket=15m|1h` của AirGradient bằng MongoDB Aggregation Pipeline (`$dateTrunc`).
  3. *Giao diện Lưới thẻ Phòng (Room Card Grid)*: Bố cục trực quan nhất cho thư viện, giúp thủ thư nhìn lướt qua là biết ngay phòng nào đang bị ồn hoặc bí khí.
- **Điểm KHÔNG NÊN HỌC**:
  1. *Thiếu giao diện mặt bằng kiến trúc 2D*: AirGradient chỉ có dạng card và bản đồ địa lý ngoài trời, không hỗ trợ dựng sơ đồ mặt bằng kiến trúc đa giác phòng (`boundaryPolygon`) như thư viện yêu cầu.

---

### 3.4. Dự Án 4: openSenseMap & senseBox
* **Website**: [https://opensensemap.org](https://opensensemap.org) `[XÁC NHẬN]`
* **GitHub Repositories**:
  - Frontend: [github.com/sensebox/openSenseMap](https://github.com/sensebox/openSenseMap) (Angular / TypeScript, Leaflet) `[XÁC NHẬN]`
  - Backend API: [github.com/sensebox/openSenseMap-API](https://github.com/sensebox/openSenseMap-API) (Node.js, Express, MongoDB) `[XÁC NHẬN]`
* **Tài liệu API**: [https://docs.opensensemap.org](https://docs.opensensemap.org) `[XÁC NHẬN]`

#### Trục 1: Nhóm chức năng cốt lõi và vai trò người dùng
- **Vai trò người dùng (Citizen Science & Open Data Model)**:
  - `Registered User`: Người sở hữu trạm đo senseBox; có quyền đăng ký trạm mới, khai báo danh mục cảm biến, cấu hình vị trí địa lý và nhận mã bí mật để đẩy số liệu.
  - `Public Anonymous User`: Bạn đọc hoặc công chúng; có toàn quyền xem bản đồ thời gian thực, tra cứu lịch sử, xuất dữ liệu CSV/JSON mà không cần đăng nhập `[XÁC NHẬN: opensensemap.org]`.
- **Nhóm chức năng cốt lõi**:
  - *Quản lý trạm đo senseBox*: Khai báo phần cứng, danh mục hiện tượng đo lường (*phenomena*: Nhiệt độ, Độ ẩm, Bụi mịn PM2.5/PM10, Cường độ ánh sáng Lux, Độ ồn dB).
  - *Spatial Telemetry Ingestion*: Tiếp nhận dữ liệu chuỗi thời gian gắn liền với tọa độ không gian GeoJSON vào CSDL MongoDB.
  - *Open Data Portal*: Cung cấp API mở để cộng đồng và các nhà khoa học tải về nghiên cứu môi trường.

#### Trục 2: Bố cục giao diện & Luồng điều hướng (UI Layout & Navigation)
- **Giao diện Toàn cảnh Bản đồ (Map-First UI)** `[XÁC NHẬN: opensensemap.org]`:
  - Toàn bộ màn hình chính là bản đồ tương tác (Leaflet/MapLibre) với các marker trạm đo được tô màu động theo thông số đang chọn (Nhiệt độ, Bụi PM2.5, Độ ồn...).
  - Thanh công cụ phía trên cho phép lọc nhanh hiện tượng đo (*Phenomenon Filter*).
- **Thanh trượt chi tiết (Sliding Sidebar)**:
  - Khi click vào bất kỳ trạm đo nào trên bản đồ, một thanh trượt mượt mà (Sliding Sidebar) từ cạnh trái mở ra, hiển thị:
    - Tên trạm, hình ảnh thực tế, mô tả vị trí.
    - Danh sách các cảm biến đang hoạt động kèm giá trị đo mới nhất.
    - Biểu đồ đường (Line Chart) biểu diễn biến thiên của thông số đó trong 24 giờ qua.

#### Trục 3: Cách hiển thị dữ liệu & Cơ chế Cảnh báo/Thông báo
- **Thuật toán Nội suy Bản đồ Nhiệt Không gian (IDW Heatmap Interpolation)** `[XÁC NHẬN: docs.opensensemap.org]`:
  - Đây là tính năng **đặc biệt giá trị cho AIoTLibTQB**: Thay vì chỉ hiển thị các điểm đo rời rạc, openSenseMap áp dụng giải thuật **Nội suy Trọng số Nghịch đảo Khoảng cách (Inverse Distance Weighting - IDW)**.
  - Thuật toán tính toán gradient giá trị tại mọi điểm trên mặt phẳng dựa vào các điểm trạm đo xung quanh theo công thức:
    $$u(x) = \frac{\sum_{i=1}^n w_i(x) \cdot u_i}{\sum_{i=1}^n w_i(x)}, \quad \text{với } w_i(x) = \frac{1}{d(x, x_i)^p}$$
  - Nhờ đó, hệ thống render được một lớp bản đồ nhiệt (Heatmap Raster/Canvas) mượt mà, trực quan hóa vùng nào trong không gian đang bị quá nhiệt, ô nhiễm bụi hoặc tiếng ồn cao.
- **Cơ chế Cảnh báo**:
  - Không xây dựng phân hệ cảnh báo chuyên sâu cho vận hành sự cố (chỉ hiển thị cờ trạm đo còn hoạt động hay mất sóng dựa trên tem thời gian của bản tin cuối).

#### Trục 4: Cách API phục vụ giao diện (REST / Realtime / Auth)
- **Kiến trúc CSDL MongoDB & Không gian Địa lý (Geospatial MongoDB)** `[XÁC NHẬN: github.com/sensebox/openSenseMap-API]`:
  - Backend lưu trữ trạm đo và cảm biến trong MongoDB với định dạng GeoJSON `Point` (`coordinates: [longitude, latitude]`) và đánh chỉ mục không gian `2dsphere`:
    ```javascript
    db.boxes.createIndex({ "loc": "2dsphere" })
    ```
  - API hỗ trợ truy vấn theo khung hình chữ nhật hiển thị trên màn hình (Bounding Box):
    - `GET /boxes?bbox=minLon,minLat,maxLon,maxLat&phenomenon=temperature`
    - Nhờ đó, frontend di chuyển đến đâu thì chỉ tải các điểm đo nằm trong khung nhìn trình duyệt đến đó, tránh tải dư thừa dữ liệu.
- **Truy vấn Lịch sử Cảm biến**:
  - `GET /boxes/:boxId/data/:sensorId?from-date=...&to-date=...&format=json`
  - Hỗ trợ xuất dữ liệu ra nhiều định dạng (`format=json` hoặc `format=csv`).
- **Xác thực**:
  - Sử dụng JWT Bearer cho các tác vụ quản trị trạm đo; các API truy vấn bản đồ là công khai hoàn toàn.

#### Trục 5: Điểm ĐÁNG HỌC và KHÔNG NÊN HỌC cho AIoTLibTQB
- **Điểm ĐÁNG HỌC**:
  1. *Giải thuật IDW Interpolation cho Heatmap Thư viện*: Trong tài liệu thiết kế của AIoTLibTQB có yêu cầu vẽ bản đồ nhiệt không gian phòng đọc (`05_p1_summary.md:77`). Thuật toán IDW từ openSenseMap là giải pháp chuẩn xác nhất để tính toán nội suy nhiệt độ, độ ẩm và độ ồn giữa các trạm ESP32-S3 trong cùng một phòng đọc.
  2. *Thiết kế Sliding Sidebar*: Giữ nguyên mặt bằng thư viện ở màn hình chính và dùng thanh trượt trượt ra khi click vào một phòng đọc giúp trải nghiệm người dùng liền mạch, không bị tải lại trang.
  3. *Tối ưu truy vấn MongoDB*: Tận dụng khả năng lập chỉ mục của MongoDB cho việc lọc theo vùng không gian.
- **Điểm KHÔNG NÊN HỌC**:
  1. *Thiếu phân trang (No Cursor Pagination)*: openSenseMap tải danh sách trạm thô theo BBox; khi số lượng trạm quá lớn có thể làm nặng trình duyệt.
  2. *Thiếu phân hệ quản lý sự cố/cảnh báo*: Không có cơ chế Acknowledge/Resolve cảnh báo.

---

## 4. Tổng Hợp Đề Xuất Cải Tiến Kiến Trúc & Giao Diện cho AIoTLibTQB

Từ kết quả phân tích đối chiếu 4 dự án thực tế hàng đầu thế giới trong cùng và gần domain, chúng tôi đề xuất các giải pháp kỹ thuật cụ thể nhằm lấp đầy các khoảng trống (Gaps) đã phát hiện trong Phase 1:

### 4.1. Cải tiến Kiến trúc Realtime & Đẩy dữ liệu Chủ động
* **Vấn đề hiện tại**: `spring-boot-starter-websocket` trong `pom.xml:108-111` là dead dependency (chưa có cấu hình `@EnableWebSocketMessageBroker`), hệ thống buộc UI phải dùng REST Polling định kỳ gây trễ và lãng phí tài nguyên `[XÁC NHẬN: 05_p1_summary.md:49, 56-58]`.
* **Giải pháp học hỏi ThingsBoard & OpenRemote**:
  - Triển khai cấu hình WebSocket STOMP tại endpoint `/ws-aiot` hoặc Server-Sent Events (SSE) tại `/api/v1/telemetry/stream`.
  - Cho phép Client gửi lệnh đăng ký lắng nghe (Subscribe) theo từng phòng cụ thể (ví dụ topic: `/topic/room.{roomId}.telemetry`) hoặc lắng nghe cảnh báo chung (`/topic/alerts`).
  - Trong luồng tiếp nhận `MqttMessageDispatcherService.java`, sau khi lưu CSDL và tính điểm LCS xong, tự động bắn bản tin qua `SimpMessagingTemplate` đến các client đang theo dõi phòng đó `[SUY LUẬN]`.

### 4.2. Thiết kế Bố cục Giao diện Web (UI/UX Blueprint cho Frontend)
Dựa trên sự kết hợp những điểm mạnh nhất từ 4 dự án tham khảo:
1. **Trang Chủ Dashboard (Học hỏi AirGradient)**:
   - Banner tổng quan thư viện: Điểm tiện nghi trung bình toàn tòa nhà (LCS 0–100), tổng số phòng đạt chuẩn, highlight cảnh báo phòng đọc có vi phạm tiếng ồn hoặc bí khí nặng nhất.
   - Lưới thẻ phòng đọc (Room Card Grid): Mỗi phòng là một Card hiển thị nhãn phân hạng LCS (Platinum, Gold, Silver, Bronze, Poor), các giá trị tức thời (Nhiệt, Ẩm, PM2.5, Độ ồn dB) và icon gợi ý vận hành.
2. **Màn hình Mặt Bằng 2D Không Gian (Học hỏi ThingsBoard & openSenseMap)**:
   - Bản đồ kiến trúc mặt bằng tầng (Floorplan Canvas): Hiển thị mặt bằng theo tầng (`floor`), vẽ đường bao ranh giới phòng từ danh sách tọa độ đỉnh đa giác `boundaryPolygon` trong `Room.java`.
   - Hệ tọa độ tương đối $[0.0, 1.0]$: Chuẩn hóa tọa độ thiết bị `posX, posY` từ $[0.0, 1.0]$ để tương thích hoàn toàn với mọi độ phân giải màn hình.
   - Lớp bản đồ nhiệt (IDW Heatmap Canvas): Áp dụng giải thuật Inverse Distance Weighting từ openSenseMap để nội suy và render lớp màu nhiệt độ/độ ồn mượt mà trên canvas, giới hạn clipping chính xác bên trong đa giác phòng.
3. **Thanh trượt Chi Tiết Phòng (Sliding Sidebar - Học hỏi openSenseMap & OpenRemote)**:
   - Khi thủ thư click vào một phòng đọc trên mặt bằng, một Sidebar trượt ra từ bên phải hiển thị danh sách trạm đo, trạng thái online/offline, và biểu đồ chuỗi thời gian 24h qua mà không làm mất ngữ cảnh mặt bằng đang xem.

### 4.3. Chuẩn hóa API TimeSeries Downsampling & Phân trang
* **Vấn đề hiện tại**: Endpoint `GET /api/v1/telemetry/device/{id}` và `.../room/{id}` trả về danh sách thô `List<TelemetryResponse>` không phân trang và không hạ mẫu, đe dọa làm tràn RAM JVM và treo trình duyệt khi xem dải ngày rộng `[XÁC NHẬN: 05_p1_summary.md:59-61]`.
* **Giải pháp học hỏi AirGradient**:
  - Xây dựng endpoint hạ mẫu chuỗi thời gian nén theo mốc:
    - `GET /api/v1/telemetry/room/{id}/buckets?interval=15m|1h|1d&start=...&end=...`
  - Tận dụng sức mạnh của MongoDB Aggregation Pipeline với toán tử `$dateTrunc` để tính toán `$avg`, `$min`, `$max` cho từng cửa sổ thời gian trực tiếp tại tầng CSDL, chỉ trả về tối đa vài chục đến vài trăm điểm đo cho client vẽ biểu đồ.
  - Chuẩn hóa phân trang chuẩn `PageResponse<T>` (`page`, `size`, `sort`) đồng nhất trên mọi danh mục `devices`, `rooms`, và `alerts`.

### 4.4. Hoàn thiện Phân hệ Cảnh báo (Alert Subsystem)
* **Vấn đề hiện tại**: `Alert.java` và `AlertRepository.java` đã có nhưng bị "mồ côi" vì thiếu `AlertService`, `AlertController` và thiếu kiểm tra ngưỡng trong pipeline MQTT `[XÁC NHẬN: 05_p1_summary.md:48, 53-55]`.
* **Giải pháp học hỏi ThingsBoard**:
  - Hoàn thiện thực thể `Alert` với vòng đời 4 trạng thái: `ACTIVE_UNACK`, `ACTIVE_ACK`, `CLEARED_UNACK`, `CLEARED_ACK` và 4 cấp độ nghiêm trọng `CRITICAL`, `WARNING`, `INFO`, `RESOLVED`.
  - Bổ sung `AlertThresholdRuleChecker` vào `MqttMessageDispatcherService`: Tự động so sánh số liệu đo được (độ ồn, bụi mịn, nhiệt độ) với ngưỡng thiết lập của phòng. Nếu vượt ngưỡng $\rightarrow$ Tự động sinh `Alert` với trạng thái `ACTIVE_UNACK` và bắn thông báo tức thời qua WebSocket STOMP tới chuông thông báo Header của UI.
  - Cung cấp đủ 3 REST API vận hành sự cố:
    1. `GET /api/v1/alerts/unread-count`: Đếm sự cố chưa xác nhận để hiển thị badge đỏ trên icon chuông.
    2. `GET /api/v1/alerts`: Truy vấn danh sách sự cố (phân trang, lọc theo phòng, trạng thái, mức độ nghiêm trọng).
    3. `POST /api/v1/alerts/{id}/acknowledge`: Quản trị viên/thủ thư bấm xác nhận tiếp nhận xử lý sự cố.

---

## 5. Danh Mục Câu Hỏi Mở & Kiến Nghị Cho Kế Hoạch Tiếp Theo (Open Questions)

1. **Lựa chọn Công nghệ Realtime cho Giao diện**:
   - *Căn cứ đối chiếu*: ThingsBoard và OpenRemote đều dùng WebSockets cho luồng dữ liệu 2 chiều.
   - *Câu hỏi*: Giao diện thư viện sau này nên triển khai **WebSocket STOMP** (`/ws-aiot`) hay **Server-Sent Events (SSE)** (`/api/v1/telemetry/stream`)? SSE triển khai đơn giản hơn và tự động reconnect qua HTTP thông thường, trong khi WebSocket STOMP linh hoạt hơn cho các lệnh subscribe đa kênh `[CHƯA RÕ: 06_references.md:Trục 4]`.
2. **Cơ chế Lưu trữ và Quản trị Ngưỡng Cảnh báo (Threshold Configuration)**:
   - *Căn cứ đối chiếu*: AirGradient cấu hình ngưỡng theo từng địa điểm/phòng, còn ThingsBoard cấu hình theo Device Profile.
   - *Câu hỏi*: Ngưỡng cảnh báo vi khí hậu và độ ồn của AIoTLibTQB nên được lưu động trong MongoDB gắn theo từng `Room` (để thủ thư tùy chỉnh cho phòng đọc yên tĩnh vs phòng thảo luận nhóm), hay cấu hình cố định trong mã nguồn theo `RoomType`? `[CHƯA RÕ: 01_code.md:610-616]`.
3. **Thư viện Giao diện Khuyến nghị cho Đội Frontend**:
   - *Căn cứ đối chiếu*: Dựa trên yêu cầu canvas mặt bằng 2D, biểu đồ chuỗi thời gian đa thông số và lưới thẻ phòng đọc.
   - *Đề xuất*: Stack phù hợp nhất là **Next.js (App Router) + Tailwind CSS + Lucide Icons + Recharts / Chart.js** và **HTML5 Canvas / Konva.js** cho việc vẽ mặt bằng đa giác phòng và nội suy nhiệt IDW `[SUY LUẬN]`.
4. **Phân quyền Xem Công Cộng (Public Kiosk Mode)**:
   - *Căn cứ đối chiếu*: openSenseMap cho phép công chúng xem bản đồ không cần đăng nhập; AirGradient hỗ trợ màn hình chia sẻ công cộng cho học sinh/giáo viên.
   - *Câu hỏi*: AIoTLibTQB có cần mở thêm một endpoint công cộng không yêu cầu Bearer JWT (`GET /api/v1/public/rooms/{id}/comfort-score`) để gắn vào các màn hình TV/Tablet hiển thị ở cửa phòng đọc cho sinh viên và bạn đọc tra cứu trước khi vào phòng không? `[CHƯA RÕ: 06_references.md:Trục 1]`.

---
*Báo cáo được hoàn thành bởi Lead Agent & Đội ngũ Nghiên cứu Tham chiếu Thực tế — Tuân thủ nguyên tắc Read-only, Bảo mật thông tin tuyệt đối (che ***), đối chiếu 100% từ tài liệu và repository thực tế có kiểm chứng.*
