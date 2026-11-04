# BẢN THIẾT KẾ KIẾN TRÚC GIAO DIỆN NGƯỜI DÙNG (UI/UX BLUEPRINT)
> **Mã tài liệu**: `PHASE3-UI-BLUEPRINT-09` | **Hệ thống thiết kế**: AIoTLibTQB (Smart Library IoT System)  
> **Thời điểm hoàn thiện**: 2026-10-21 | **Phiên bản tài liệu**: 1.0 Final  
> **Nguyên tắc thực hiện**: Dữ liệu thực chứng 100%, bảo mật credentials (che ***), không viết mã code giao diện  
> **Quy ước nhãn chứng cứ**: `[XÁC NHẬN]` (mã nguồn/hạ tầng thực tế) | `[SUY LUẬN]` (phân tích kỹ thuật) | `[CHƯA RÕ]` (vấn đề mở)

---

## 1. MA TRẬN VAI TRÒ, MÀN HÌNH GIAO DIỆN & ÁNH XẠ REST/REALTIME API

Dưới đây là bảng ánh xạ chi tiết toàn bộ các màn hình giao diện người dùng theo từng vai trò (Roles), liên kết trực tiếp tới các REST API Endpoint và kênh dữ liệu thời gian thực hiện có trong mã nguồn (hoặc ghi rõ trạng thái `[CHƯA CÓ API]` nếu Backend chưa cung cấp):

| Vai Trò Người Dùng | Tên Màn Hình Giao Diện | Chức Năng Chính Của Màn Hình | API Endpoint Ánh Xạ Cụ Thể (Mã Nguồn Backend) | Trạng Thái API Backend | File Minh Chứng Backend |
|:---|:---|:---|:---|:---:|:---|
| **MỌI VAI TRÒ** | **M01: Đăng Nhập & Quên Mật Khẩu** | Nhập username/password, cấp phát JWT, chuyển hướng theo vai trò | `POST /api/auth/login`<br>`POST /api/auth/refresh` | **Sẵn sàng** | `AuthenticationController.java:29-57` `[XÁC NHẬN]` |
| | **M02: Hồ Sơ Cá Nhân (My Profile)** | Xem thông tin tài khoản, đổi mật khẩu, xem các zone được phân công | `GET /api/users/myInfo`<br>`PUT /api/users/{userId}` | **Sẵn sàng** | `UserController.java:51-72` `[XÁC NHẬN]` |
| | **Header Toàn Cục: Chuông Cảnh Báo** | Hiển thị badge số lượng cảnh báo mới, popup danh sách sự cố tức thời | `GET /api/v1/alerts/unread-count`<br>`Topic: /topic/alerts` | **[CHƯA CÓ API]** *(Task P0-1)* | `01_code.md:485` `[XÁC NHẬN]` |
| **LIBRARIAN / ADMIN** | **M03: Dashboard Tổng Quan Thư Viện** | - Banner LCS trung bình toàn trường, số phòng đạt chuẩn, cảnh báo tệ nhất<br>- Lưới thẻ phòng đọc (Room Card Grid)<br>- Lọc phòng theo tầng, loại phòng | `GET /api/v1/rooms`<br>`GET /api/v1/telemetry/room/{id}/latest`<br>`GET /api/v1/telemetry/overview/summary` | **Sẵn sàng 70%** *(Thiếu API summary toàn trường & Realtime stream)* | `RoomController.java:31`<br>`TelemetryController.java:32` `[XÁC NHẬN]` |
| | **M04: Mặt Bằng Không Gian 2D (Floorplan)** | - Vẽ sơ đồ mặt bằng kiến trúc theo tầng<br>- Render đa giác ranh giới phòng (`boundaryPolygon`)<br>- Hiển thị marker vị trí trạm đo (`posX, posY`)<br>- Lớp phủ nhiệt độ/độ ồn Heatmap Canvas | `GET /api/v1/rooms?floor={floor}`<br>`GET /api/v1/devices`<br>`GET /api/v1/telemetry/room/{id}/latest`<br>`Kênh Realtime: /topic/room.{id}` | **Sẵn sàng 80%** *(Đã có tọa độ polygon & posX/posY; thiếu Realtime WS)* | `RoomController.java:31`<br>`DeviceController.java:69`<br>`Room.java:42` `[XÁC NHẬN]` |
| | **M05: Chi Tiết Phòng & Phân Tích (Analytics)** | - Bảng chỉ số môi trường tức thời (Nhiệt, Ẩm, Lux, Bụi PM, Độ ồn dB, LCS)<br>- Biểu đồ chuỗi thời gian nén (15m, 1h, 1d)<br>- Đồ thị tương quan đa thông số (Overlay) | `GET /api/v1/rooms/{id}`<br>`GET /api/v1/telemetry/room/{id}/latest`<br>`GET /api/v1/telemetry/room/{id}/buckets` | **Sẵn sàng 60%** *(Đã có latest; thiếu API Downsampling Buckets P0-2)* | `RoomController.java:39`<br>`TelemetryController.java:32, 49` `[XÁC NHẬN]` |
| | **M06: Trung Tâm Xử Lý Cảnh Báo (Alerts Center)** | - Bảng danh sách sự cố vi phạm tiện nghi<br>- Lọc theo phòng, mức độ nghiêm trọng, trạng thái<br>- Nút bấm Xác nhận (Ack) và Đóng sự cố (Resolve) | `GET /api/v1/alerts`<br>`POST /api/v1/alerts/{id}/acknowledge`<br>`POST /api/v1/alerts/{id}/resolve` | **[CHƯA CÓ API]** *(Toàn bộ backend Alert đang ở dạng stub - Task P0-1)* | `AlertRepository.java:13-25`<br>`05_p1_summary.md:48` `[XÁC NHẬN]` |
| | **M07: Quản Lý Thiết Bị & Hàng Đợi Discovery** | - Danh sách trạm đo, trạng thái Online/Offline, pin, RSSI<br>- Duyệt trạm mới từ hàng đợi tự động dò tìm<br>- Cấp lại API Key (Regenerate Key), gán phòng | `GET /api/v1/devices`<br>`GET /api/v1/devices/discovered`<br>`POST /api/v1/devices/register`<br>`PUT /api/v1/devices/{id}`<br>`POST /api/v1/devices/{id}/regenerate-key` | **Sẵn sàng 95%** *(Chỉ thiếu phân trang PageResponse)* | `DeviceController.java:30-110` `[XÁC NHẬN]` |
| | **M08: Quản Lý Cấu Hình Phòng Đọc** | - CRUD thông tin phòng, sức chứa, loại phòng<br>- Công cụ chỉnh sửa tọa độ đỉnh đa giác ranh giới tường (`boundaryPolygon`) trên bản đồ | `GET /api/v1/rooms`<br>`POST /api/v1/rooms`<br>`PUT /api/v1/rooms/{id}`<br>`DELETE /api/v1/rooms/{id}` | **Sẵn sàng** | `RoomController.java:24-66` `[XÁC NHẬN]` |
| **ZONE_MANAGER** | **M09: Giám Sát Khu Vực Phụ Trách (Zone View)** | - Xem danh sách thiết bị và chỉ số phòng thuộc phân vùng được gán (`assignedZones`)<br>- Cảnh báo riêng cho khu vực phụ trách | `GET /api/v1/devices/zone/{zoneId}`<br>`GET /api/v1/telemetry/room/{id}/latest`<br>`GET /api/v1/rooms` | **Sẵn sàng** | `DeviceController.java:83`<br>`TelemetryService.java:37-40` `[XÁC NHẬN]` |
| **MAINTENANCE** | **M10: Bảng Giám Sát Vận Hành Phần Cứng** | - Danh sách trạm mất kết nối ngoại tuyến (`lastOfflineAt`)<br>- Mức sóng WiFi RSSI, phiên bản Firmware ESP32<br>- Lịch sử nhịp tim Heartbeat | `GET /api/v1/devices`<br>`GET /api/v1/devices/{id}`<br>`GET /actuator/health` | **Sẵn sàng** | `DeviceController.java:69-81`<br>`SecurityConfig.java:57` `[XÁC NHẬN]` |
| **ADMIN** | **M11: Quản Trị Người Dùng & Phân Vai Trò** | - Bảng danh sách tài khoản (phân trang)<br>- Khóa/mở khóa tài khoản, gán Vai trò & Assigned Zones<br>- Tạo mới tài khoản cán bộ | `GET /api/users` *(đã có phân trang)*<br>`POST /api/users`<br>`PUT /api/users/{userId}`<br>`PATCH /api/users/{userId}/status`<br>`DELETE /api/users/{userId}` | **Sẵn sàng 100%** | `UserController.java:27-89` `[XÁC NHẬN]` |
| | **M12: Quản Trị Vai Trò & Quyền Hạn (RBAC)** | - Xem danh sách 7 Roles và 14 Permissions<br>- Cấu hình ma trận phân quyền nguyên tử | `GET /api/roles`<br>`POST /api/roles`<br>`PUT /api/roles/{name}`<br>`GET /api/permissions` | **Sẵn sàng 100%** | `RoleController.java:24-49`<br>`PermissionController.java:24-42` `[XÁC NHẬN]` |
| | **M13: Giám Sát Sức Khỏe Máy Chủ (System Health)** | - Trạng thái kết nối MongoDB, dung lượng ổ đĩa, bộ nhớ JVM, nhịp tim Mosquitto MQTT Broker | `GET /actuator/health`<br>`GET /actuator/metrics`<br>`GET /actuator/info` | **Sẵn sàng 100%** | `SecurityConfig.java:57`<br>`application.yaml:18` `[XÁC NHẬN]` |
| **USER / VIEWER** | **M14: Tra Cứu Không Gian Học Tập Lý Tưởng** | - Tìm phòng đọc có độ ồn thấp nhất ($<35\text{ dBA}$)<br>- Xem xếp hạng tiện nghi LCS (Platinum, Gold...)<br>- Đề xuất phòng còn chỗ trống và điều kiện vi khí hậu tối ưu | `GET /api/v1/rooms`<br>`GET /api/v1/telemetry/room/{id}/latest` | **Sẵn sàng** | `RoomController.java:31`<br>`TelemetryController.java:32` `[XÁC NHẬN]` |
| **PUBLIC_GUEST** | **M15: Màn Hình Kiosk Cửa Phòng Đọc** | - Màn hình cảm ứng tĩnh/TV treo cửa phòng<br>- Hiển thị LCS to rõ, thanh đo âm học & chất lượng không khí, khuyến cáo vào phòng | `GET /api/v1/public/rooms/{id}/comfort-score` | **[CHƯA CÓ API]** *(Hiện tại API yêu cầu Auth - Task P1-4)* | `06_references.md:325-327` `[SUY LUẬN]` |

---

## 2. LUỒNG ĐIỀU HƯỚNG CHÍNH & XỬ LÝ TRẠNG THÁI GIAO DIỆN (NAVIGATION & UI STATES)

### 2.1. Sơ Đồ Cây Điều Hướng (Navigation Flowchart)

```
                            +--------------------------+
                            |     M01: ĐĂNG NHẬP       |
                            +-------------+------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------------+
|                                    HEADER THANH ĐIỀU HƯỚNG                               |
|   [Logo AIoTLibTQB]  [Chọn Tầng]  [Tìm Kiếm]  [Chuông Cảnh Báo (Badge)]  [User Profile]  |
+-----------------------------------------+-----------------------------------------------+
                                          |
             +----------------------------+----------------------------+
             |                                                         |
             v                                                         v
+--------------------------+                               +--------------------------+
| M03: DASHBOARD TỔNG QUAN |                               | M04: MẶT BẰNG TẦNG (MAP) |
| - Thẻ tóm tắt toàn trường|                               | - Canvas sơ đồ mặt bằng  |
| - Lưới thẻ phòng đọc     |                               | - Đa giác phòng (Polygon)|
|   (Room Card Grid)       |                               | - Lớp nhiệt Heatmap (IDW)|
+------------+-------------+                               +-------------+------------+
             |                                                           |
             +----------------------------+------------------------------+
                                          |
                                          v (Click chọn Phòng)
+-----------------------------------------------------------------------------------------+
|                  PANEL TRƯỢT CHI TIẾT PHÒNG ĐỌC (SLIDING SIDEBAR / DRAWER)              |
| - Tên phòng, loại phòng, sức chứa, điểm tiện nghi LCS (Platinum/Gold...)               |
| - Đồng hồ đo (Gauges): Độ ồn dBA, Bụi PM2.5, Nhiệt độ, Độ ẩm, Lux                     |
| - Nút: [Xem Phân Tích Lịch Sử Chi Tiết] ----------------------------------------------->|
+-----------------------------------------------------------------------------------------+
                                                                                          |
                                                                                          v
                                                                           +--------------------------+
                                                                           | M05: PHÂN TÍCH ANALYTICS |
                                                                           | - Biểu đồ nén TimeBuckets|
                                                                           | - Đồ thị đa thông số     |
                                                                           | - Bảng sự cố của phòng   |
                                                                           +--------------------------+
```

### 2.2. Chuẩn Hóa 4 Trạng Thái Giao Diện (UI Component State Standards)
Để mang lại trải nghiệm chuyên nghiệp cho người dùng thư viện, mọi màn hình và widget dữ liệu bắt buộc phải xử lý đủ 4 trạng thái giao diện:

1. **Trạng thái Đang Tải (Loading State)**:
   - *Biểu đồ chuỗi thời gian & Room Cards*: Tuyệt đối không dùng icon spinner quay đơn điệu ở giữa trang. Sử dụng hiệu ứng **Skeleton Loading (Shimmer Screens)** có kích thước và hình khối khớp chính xác với thẻ phòng thật nhằm tránh hiện tượng nhảy bố cục (Cumulative Layout Shift - CLS).
   - *Bản đồ Floorplan Canvas*: Hiển thị khung lưới mờ (blueprint grid) kèm thông báo *"Đang tải dữ liệu không gian tầng..."*.
2. **Trạng thái Dữ Liệu Rỗng (Empty State)**:
   - *Lưới thẻ phòng*: Hiển thị hình minh họa vector sách thư viện kèm thông điệp *"Không tìm thấy phòng đọc nào ở tầng này"*.
   - *Hàng đợi Thiết bị Tự động (Discovery Queue)*: Hiển thị minh họa sóng WiFi kèm văn bản *"Không có trạm đo mới nào đang chờ duyệt. Mọi thiết bị phát sóng đều đã được đăng ký"*.
   - *Bảng Cảnh báo*: Icon lá chắn màu xanh với nhãn *"Môi trường học tập hoàn toàn ổn định. Không có sự cố vi phạm tiện nghi nào đang diễn ra"*.
3. **Trạng thái Lỗi Kết Nối & Ngoại Lệ (Error State)**:
   - *Mất kết nối mạng hoặc lỗi máy chủ (HTTP 500/503)*: Hiển thị Banner cảnh báo màu vàng phía trên màn hình kèm nút bấm `[Thử lại ngay]`.
   - *Lỗi hết hạn phiên (HTTP 401 / Mã lỗi 1006)*: Tự động kích hoạt cơ chế `Silent Refresh` qua Axios/Fetch Interceptor. Nếu refresh thất bại, lưu lại URL hiện tại và hiển thị Modal thông báo *"Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại"* trước khi điều hướng về `/login`.
   - *Lỗi thiết bị gửi số liệu ngoài ngưỡng*: Giá trị cảm biến hiển thị nhãn `--` (hoặc `N/A`) kèm tooltip *"Giá trị cảm biến bất thường đã bị bộ lọc vật lý loại bỏ"*.
4. **Trạng thái Mất Luồng Realtime (Disconnected Realtime State)**:
   - Khi kết nối WebSocket STOMP hoặc SSE bị gián đoạn (do đứt cáp hoặc server khởi động lại), góc phải thanh Header chuyển sang trạng thái biểu tượng WiFi gạch chéo màu cam kèm tooltip *"Mất kết nối thời gian thực. Đang tự động kết nối lại (thử lại sau 5s)..."*. Giao diện tạm thời chuyển sang chế độ REST Polling dự phòng.

---

## 3. ĐỀ XUẤT CẤU TRÚC API TỐI ƯU PHỤC VỤ GIAO DIỆN

Để đảm bảo hiệu năng tối ưu, giảm thiểu số lượng round-trip HTTP requests và loại bỏ nguy cơ quá tải bộ nhớ client, kiến trúc Backend cần bổ sung 3 nhóm API chuyên dụng cho Frontend:

### 3.1. API Nén Chuỗi Thời Gian (TimeSeries Downsampling Buckets)
- **Endpoint đề xuất**: `GET /api/v1/telemetry/room/{roomId}/buckets`
- **Tham số truy vấn (Query Params)**:
  - `interval`: Độ mịn gom cụm (`15m`, `1h`, `1d`). Mặc định: `1h`.
  - `start`: Mốc thời gian bắt đầu (ISO-8601).
  - `end`: Mốc thời gian kết thúc (ISO-8601).
- **Cấu trúc Dữ liệu Trả về (JSON Response Payload)**:
  ```json
  {
    "code": 1000,
    "message": "Success",
    "result": {
      "roomId": "67160abc...",
      "interval": "1h",
      "dataPoints": [
        {
          "bucketTime": "2026-10-21T08:00:00Z",
          "comfortScoreAvg": 88.5,
          "comfortScoreMin": 72.0,
          "tempAvg": 24.2,
          "tempMin": 23.8,
          "tempMax": 24.9,
          "humidityAvg": 52.1,
          "noiseAvg": 38.4,
          "noiseMax": 64.2,
          "pm25Avg": 12.3
        }
      ]
    }
  }
  ```
- **Ý nghĩa kỹ thuật**: Nhờ toán tử MongoDB Aggregation `$dateTrunc`, dữ liệu cả tuần (hơn 60,000 bản ghi thô) được nén về đúng 168 điểm đo ($24 \times 7$), dung lượng phản hồi giảm từ 35 MB xuống dưới 30 KB, vẽ biểu đồ tức thì trong 50ms `[SUY LUẬN: 06_references.md:295-300]`.

### 3.2. API Tóm Tắt Chỉ Số Toàn Thư Viện (Library Overview Summary)
- **Endpoint đề xuất**: `GET /api/v1/telemetry/overview/summary`
- **Cấu trúc Dữ liệu Trả về**:
  ```json
  {
    "code": 1000,
    "message": "Success",
    "result": {
      "totalRooms": 18,
      "optimalRoomsCount": 15,
      "averageLcsScore": 86.4,
      "overallGrade": "Gold",
      "onlineDevices": 42,
      "offlineDevices": 2,
      "activeAlertsCount": 1,
      "worstRoom": {
        "roomId": "room_204",
        "roomCode": "P204",
        "roomName": "Phòng Tự Học Yên Tĩnh 2",
        "currentLcs": 54.0,
        "bottleneckReason": "Tiếng ồn trung bình vượt ngưỡng (58.5 dBA)"
      }
    }
  }
  ```
- **Ý nghĩa**: Cung cấp toàn bộ dữ liệu cho Banner đỉnh Dashboard của AirGradient chỉ bằng 01 HTTP request duy nhất thay vì UI phải gọi 20 request tới từng phòng `[SUY LUẬN: 06_references.md:171-177]`.

### 3.3. Cấu Trúc Đẩy Realtime Qua WebSocket STOMP
- **Endpoint kết nối SockJS / WebSocket**: `wss://<host>/ws-aiot`
- **Các Topic Đăng Ký Lắng Nghe (Client Subscription Topics)**:
  1. `/topic/overview`: Nhận cập nhật tóm tắt toàn thư viện mỗi 30s.
  2. `/topic/room.{roomId}`: Nhận bản tin vi khí hậu mới nhất của phòng ngay khi ESP32 đẩy số liệu lên MQTT và hoàn tất tính toán LCS.
  3. `/topic/alerts`: Nhận thông báo sự cố tức thời cho chuông thông báo Header.
- **Payload sự kiện Realtime Telemetry**:
  ```json
  {
    "roomId": "67160abc...",
    "timestamp": "2026-10-21T15:30:10Z",
    "lcsScore": 91.2,
    "grade": "Platinum",
    "metrics": {
      "temperature": 24.1,
      "humidity": 50.4,
      "noiseAvg": 34.2,
      "pm25": 8.5,
      "lux": 450.0
    }
  }
  ```

---

## 4. GỢI Ý STACK GIAO DIỆN & ĐỐI CHIẾU THỰC TẾ VỚI 06_REFERENCES.MD

Dựa trên kết quả khảo sát và đối chiếu benchmark 4 dự án thực tế tiêu biểu tại `docs/analysis/06_references.md`, chúng tôi đề xuất bộ công nghệ (Technology Stack) tối ưu cho Frontend của AIoTLibTQB:

| Lớp Công Nghệ | Công Nghệ Lựa Chọn Khuyến Nghị | Lý Do Lựa Chọn & Giá Trị Đem Lại | Đối Chiếu Dự Án Tham Khảo (`06_references.md`) |
|:---|:---|:---|:---|
| **Core Framework** | **Next.js (App Router, React 19, TypeScript)** | Cung cấp Server-Side Rendering (SSR) cho cổng tra cứu công cộng (Kiosk/Portal), hỗ trợ Client Components cho Dashboard thời gian thực, quản lý route phân vai trò chặt chẽ, tối ưu bundle size và chuẩn hóa kiểu dữ liệu TypeScript an toàn. | Khảo sát thực tế: AirGradient sử dụng kiến trúc Web hiện đại Vue/Nuxt `[06_references.md:155]`; Next.js mang lại hiệu năng cao nhất cho hệ sinh thái React hiện nay. |
| **Styling & Design System** | **Tailwind CSS + shadcn/ui (Radix UI) + Lucide Icons** | Xây dựng giao diện Dashboard hiện đại, hỗ trợ Dark Mode cho phòng đọc ban đêm, responsive hoàn hảo trên mọi kích thước màn hình từ Tablet đến TV Kiosk lớn. Không bị phình to CSS như Material UI hay Ant Design. | Lấy cảm hứng từ thiết kế thẻ tối giản, trực quan của AirGradient Dashboard `[06_references.md:171-177]`. |
| **Quản Lý State & API Caching** | **TanStack Query (React Query v5)** | Tự động caching dữ liệu API, cơ chế hủy request trùng lặp (deduping), tự động làm mới ngầm (background refetching) và hỗ trợ quản lý trạng thái nạp dữ liệu (isLoading, isError) chuẩn mực. | Học tập cơ chế phân trang và quản lý dữ liệu bất đồng bộ chuyên nghiệp của ThingsBoard CE `[06_references.md:68-75]`. |
| **Realtime Client** | **`@stomp/stompjs` + SockJS-client** | Thư viện kết nối WebSocket STOMP tiêu chuẩn cho Spring Boot, tự động reconnect khi rớt mạng, hỗ trợ đăng ký lắng nghe linh hoạt theo từng topic phòng đọc. | Áp dụng mô hình pub/sub command WebSocket của ThingsBoard (`/api/ws`) và OpenRemote (`/websocket/events`) `[06_references.md:71-73, 131-137]`. |
| **Thư Viện Biểu Đồ (Charts)** | **Recharts (hoặc Chart.js)** | Hỗ trợ vẽ biểu đồ đường (Line Chart), cột (Bar Chart) tương tác cao, cho phép vẽ các dải màu ngưỡng an toàn (Reference Bands của ASHRAE/WHO) và tính năng chồng lớp đa thông số (Multi-Parameter Overlay). | Học tập thiết kế biểu đồ của AirGradient và openSenseMap `[06_references.md:180, 234]`. |
| **Đồ Họa Mặt Bằng & Heatmap (Canvas)** | **HTML5 Canvas 2D API (hoặc Konva.js)** | Cho phép vẽ mặt bằng kiến trúc đa tầng, định vị trạm đo theo **hệ tọa độ tương đối $[0.0, 1.0]$** (không vỡ tỉ lệ khi zoom), thực hiện clipping chính xác theo đa giác tường `boundaryPolygon`, và render mượt mà lớp bản đồ nhiệt theo **thuật toán nội suy Inverse Distance Weighting (IDW)** mà không gây nghẽn DOM. | Kế thừa trực tiếp kỹ thuật Image Map tương đối của **ThingsBoard CE** `[06_references.md:61, 79]` và giải thuật nội suy IDW của **openSenseMap** `[06_references.md:237-241]`. |

---

## 5. THỨ TỰ XÂY DỰNG GIAO DIỆN THEO TỪNG ĐỢT (FRONTEND IMPLEMENTATION PHASES)

Để tối ưu hóa nguồn lực và sớm đưa sản phẩm vào kiểm thử thực tế, tiến trình xây dựng giao diện được chia thành 3 đợt triển khai rõ ràng:

```
+-----------------------------------------------------------------------------------------+
|                              LỘ TRÌNH 3 ĐỢT XÂY DỰNG GIAO DIỆN                          |
+-----------------------------------------------------------------------------------------+
|  ĐỢT 1: MVP CỐT LÕI (2-3 TUẦN)                                                          |
|  - M01: Đăng nhập & Lưu trữ JWT Refresh Token Rotation                                  |
|  - M03: Dashboard Thẻ Phòng Đọc (AirGradient Room Card Grid)                            |
|  - M05 (Cơ bản): Xem chỉ số vi khí hậu tức thời & LCS của phòng                        |
|  - M06 (Cơ bản): Bảng danh sách cảnh báo sự cố & Nút bấm Acknowledge                    |
+-----------------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------------+
|  ĐỢT 2: BẢN ĐỒ KHÔNG GIAN 2D & PHÂN TÍCH CHUYÊN SÂU (3-4 TUẦN)                          |
|  - M04: Mặt bằng tầng 2D Canvas (ThingsBoard Image Map) & Clip đa giác phòng            |
|  - M04: Lớp bản đồ nhiệt Heatmap nội suy IDW (openSenseMap)                             |
|  - Panel trượt bên phải (Sliding Sidebar) khi click chọn phòng                          |
|  - M05 (Nâng cao): Biểu đồ nén Time Buckets (15m/1h/1d) và chồng lớp đa thông số        |
|  - Kích hoạt Realtime WebSocket STOMP cập nhật động trên bản đồ                         |
+-----------------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------------+
|  ĐỢT 3: QUẢN TRỊ TOÀN DIỆN, KIOSK & HOÀN THIỆN HỆ THỐNG (2-3 TUẦN)                     |
|  - M07: Quản lý thiết bị & Giao diện duyệt trạm Auto-Discovery 1-click                  |
|  - M08: Quản lý phòng đọc & Công cụ vẽ đỉnh đa giác boundaryPolygon                     |
|  - M11, M12, M13: Quản trị User, Role RBAC & Giám sát sức khỏe máy chủ Actuator         |
|  - M15: Màn hình Kiosk công cộng hiển thị tại cửa phòng đọc                             |
|  - Xuất báo cáo kiểm định môi trường học đường PDF/CSV                                  |
+-----------------------------------------------------------------------------------------+
```

---

## 6. MỤC CÂU HỎI MỞ TỔNG HỢP TOÀN BỘ GIAI ĐOẠN (FINAL SYNTHESIZED OPEN QUESTIONS)

Tổng hợp toàn bộ các vấn đề kỹ thuật và quyết định kiến trúc được phát hiện từ Phase 1 (Mã nguồn, Cấu hình, Tài liệu, Hợp đồng), Phase 2 (Đối chiếu thực tế), và Phase 3 (Kết luận, Lộ trình, UI Blueprint), nhóm phân tích tổng hợp danh mục các câu hỏi mở cốt lõi cần chủ dự án giải quyết:

### 1. Về Hạ Tầng Truyền Dữ Liệu Realtime Ra Giao Diện
- *Bằng chứng hiện trạng*: `spring-boot-starter-websocket` đã có sẵn trong `pom.xml:108-111`, nhưng hệ thống chưa có code cấu hình WS/STOMP hay SSE `[XÁC NHẬN: 05_p1_summary.md:49]`.
- *Câu hỏi mở*: Đội ngũ phát triển sẽ triển khai **WebSocket STOMP** (`/ws-aiot` - theo mô hình của ThingsBoard) hay **Server-Sent Events** (`/api/v1/telemetry/stream` - theo chuẩn HTTP đơn giản)? Nếu chọn WebSocket, có thống nhất sử dụng cấu trúc topic đăng ký theo phòng `/topic/room.{roomId}` như thiết kế tại Mục 3.3 không? `[CHƯA RÕ: 06_references.md:316-318]`.

### 2. Về Hoàn Thiện Phân Hệ Cảnh Báo (Alert Subsystem)
- *Bằng chứng hiện trạng*: `Alert.java` và `AlertRepository.java` đã có nhưng thiếu `AlertService`, `AlertController` và logic so ngưỡng trong pipeline MQTT `[XÁC NHẬN: 05_p1_summary.md:53-55]`.
- *Câu hỏi mở*: Ngưỡng kích hoạt sự cố cảnh báo (ví dụ độ ồn $>55\text{ dBA}$ hoặc bụi PM2.5 $>35\,\mu\text{g/m}^3$) sẽ được lưu động trong MongoDB gắn theo từng `Room` để thủ thư tùy biến trên màn hình M08, hay sử dụng ngưỡng mặc định cố định theo `RoomType` trong mã nguồn `ComfortScoreService.java`? `[CHƯA RÕ: 01_code.md:610-616]`.

### 3. Về API Nén Dữ Liệu Biểu Đồ (Downsampling Time Buckets)
- *Bằng chứng hiện trạng*: API lịch sử hiện tại trả về danh sách thô `List<TelemetryResponse>` không phân trang `[XÁC NHẬN: TelemetryController.java:39-57]`, đe dọa làm sập RAM JVM và đơ trình duyệt khi truy vấn dải ngày/tuần `[XÁC NHẬN: 05_p1_summary.md:59-61]`.
- *Câu hỏi mở*: Backend có cam kết bổ sung endpoint `GET /api/v1/telemetry/room/{id}/buckets?interval=15m|1h|1d` sử dụng MongoDB Aggregation `$dateTrunc` (học theo AirGradient) ngay trong Đợt 1 để hỗ trợ Màn hình M05 không? `[CHƯA RÕ: 06_references.md:295-300]`.

### 4. Về Chuẩn Hóa Phiên Bản API & Phân Trang Toàn Hệ Thống
- *Bằng chứng hiện trạng*: Tiền tố URI bị xé lẻ giữa `/api/...` (IAM) và `/api/v1/...` (IoT); ngoại trừ `GET /api/users`, toàn bộ các danh sách trạm và phòng đều thiếu phân trang `PageResponse` `[XÁC NHẬN: 04_contract.md:219-228, 257-268]`.
- *Câu hỏi mở*: Chủ dự án có chấp thuận chuyển đổi toàn bộ endpoint sang `/api/v1/...` và đồng nhất cấu trúc phản hồi phân trang `PageResponse<T>` cho cả `devices` và `rooms` trước khi xây dựng giao diện Đợt 1 không? `[CHƯA RÕ: 04_contract.md:385-388]`.

### 5. Về Chế Độ Tra Cứu Công Cộng (Public Kiosk Mode)
- *Bằng chứng hiện trạng*: Tất cả API telemetry phòng hiện tại đều yêu cầu Bearer JWT hợp lệ `[XÁC NHẬN: TelemetryController.java:32]`.
- *Câu hỏi mở*: Hệ thống có cần mở endpoint công khai không yêu cầu đăng nhập `GET /api/v1/public/rooms/{id}/comfort-score` (có rate limiting) để phục vụ Màn hình Kiosk M15 gắn tại cửa phòng đọc cho sinh viên và khách vãng lai tra cứu nhanh hay không? `[CHƯA RÕ: 06_references.md:325-327]`.

---
*Bản thiết kế được lập và đối chiếu 100% dựa trên mã nguồn và phân tích kỹ thuật thực chứng — Tuân thủ tuyệt đối quy tắc Read-Only, Bảo mật thông tin (che ***), không viết mã code giao diện, không sửa đổi backend, và gắn nhãn minh chứng [XÁC NHẬN] / [SUY LUẬN] / [CHƯA RÕ] trên toàn bộ nội dung.*
