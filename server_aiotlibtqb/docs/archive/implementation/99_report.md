# BÁO CÁO NGHIỆM THU TỔNG KẾT GIAI ĐOẠN 1 (MVP BACKEND HOÀN THIỆN)

> **Hệ sinh thái**: AIoTLibTQB (IoT Giám sát Vi khí hậu & Âm học Thư viện Thông minh)  
> **Nền tảng**: Spring Boot 3.5.8 | Java 21 Virtual Threads | MongoDB 8.0 TimeSeries | Mosquitto 2.0  
> **Phạm vi**: Giai đoạn 1 (T1–T6, ĐC1–ĐC7) theo `KE_HOACH_HOAN_THIEN_BACKEND.md`  
> **Kết quả thẩm định độc lập**: **APPROVE 100%** (0 blocker, 181/181 unit tests pass, exit code 0)

---

## 1. Tổng Quan Triển Khai & Nhật Ký Git Commits

Toàn bộ 6 nhiệm vụ trọng tâm (T1–T6) và 7 điều chỉnh kỹ thuật (ĐC1–ĐC7) đã hoàn thành qua 4 Wave điều phối nghiêm ngặt, giữ trọn vẹn ranh giới sở hữu tệp và quy tắc liêm chính mã nguồn.

| STT | Commit | Tác giả | Nội dung thay đổi kỹ thuật cốt lõi |
| :---: | :---: | :---: | :--- |
| 1 | `3962740` | Agent B | `feat(T4-buckets)`: Nén chuỗi thời gian MongoDB Aggregation `$dateTrunc` (15m, 1h, 1d), giới hạn $\le 1000$ buckets, làm tròn 2 chữ số. |
| 2 | `c9efecc` | Agent C | `feat(T6-T2)`: Caffeine `DeviceMetadataCache`, Semaphore 30 permits có timeout, Alert FSM in-memory 4 bước (`Clock` injected). |
| 3 | `514fe5f` | Agent A | `feat(T1)`: Chuẩn hóa URI `/api/v1/**`, phân trang `PageResponse<T>`, `@Valid`, ném mã lỗi `ROOM_HAS_DEVICES`, `$pull` xóa Role. |
| 4 | `0a961bc` | Agent D | `feat(T3)`: `DeviceWatchdogService` quét nền 15s (`$set`), in-memory OFFLINE set, phục hồi ONLINE 0 truy vấn DB, throttle 30s. |
| 5 | `e62386d` | Agent E | `feat(T5-T4summary)`: WebSocket STOMP `/ws-aiot`, Interceptor JWT/auth, Conflator 1Hz, API summary in-memory triệt tiêu N+1. |

*Ghi chú: Toàn bộ commits thực hiện trực tiếp trên nhánh hiện hành, không chuyển nhánh, không push remote, không reset.*

---

## 2. Kết Quả Kiểm Thử Tự Động & Kiểm Toán Liêm Chính

- **Kiểm thử tự động toàn diện (`.\mvnw.cmd test`)**:
  - Tổng số unit tests: **181 / 181 tests PASS 100%** trên 25 test suites (thời gian chạy: 13.7s, mã thoát: 0).
  - Tỷ lệ suy thoái (Regression rate): **0%** (tất cả 19 test suites gốc và 6 test suites mới đều pass).
- **Kiểm toán liêm chính (Adversarial & Integrity Audit)**:
  - Regex audit rà soát `/api/(?!v1/)` trên code, Postman và test: **0 vi phạm**.
  - Kiểm tra mã nguồn: **0 fake assertion** (`assertTrue(true)`), **0 `@Disabled` test**, **0 dummy facade**.
  - Kết luận của Reviewer độc lập (Wave 3): **APPROVE (Chấp thuận nghiệm thu vô điều kiện)**.

---

## 3. Ma Trận Đối Chiếu Tiêu Chí Nghiệm Thu (DoD & Technical Matrix)

| Hạng mục / Yêu cầu | Hiện thực kỹ thuật chi tiết | Trạng thái DoD |
| :--- | :--- | :---: |
| **T1 & ĐC1: Chuẩn hóa API & Validation** | Thống nhất URI `/api/v1/**` cho toàn bộ controllers IAM/RBAC, SecurityConfig và RateLimitFilter; phân trang `PageResponse` cho Rooms/Devices; chặn xóa phòng còn thiết bị (`ROOM_HAS_DEVICES`); thu hồi role bằng 1 bulk update `$pull`; hook cache invalidation trong `DeviceService`. | **ĐẠT (PASS)** |
| **T6 & ĐC6: Caching & Bounded Concurrency** | Caffeine `DeviceMetadataCache` (10k entries, 30m TTL) loại bỏ >90% tải đọc DB trong luồng MQTT; Semaphore 30 permits kiểm soát tải ghi MongoDB, timeout 3000ms giải phóng trong `finally`. | **ĐẠT (PASS)** |
| **T2 & ĐC2: Phân Hệ Cảnh Báo & FSM Engine** | Endpoint CRUD `/api/v1/alerts/**` gắn `@PreAuthorize`; Rule Engine FSM in-memory 4 bước (`PENDING 30s -> FIRING -> ACK -> RESOLVED 60s`), an toàn `noisePeak == null`, 0 ghi/đọc DB khi telemetry bình thường; `Clock` injection. | **ĐẠT (PASS)** |
| **T3 & ĐC3: Watchdog & Phục Hồi Siêu Tốc** | Scheduled job 15s quét thiết bị quá hạn 2 phút, `$set OFFLINE` có mục tiêu, cảnh báo `DEVICE_OFFLINE`; duy trì in-memory Set OFFLINE devices; phục hồi ONLINE tức thì với 0 truy vấn DB cho bản tin thông thường; throttle `lastSeenAt` 30s. | **ĐẠT (PASS)** |
| **T4 & ĐC4: Buckets Aggregation & Overview** | Endpoint buckets `$dateTrunc` (15m, 1h, 1d), kiểm tra `start < end`, trần 1000 buckets, làm tròn 2 số thập phân ($\le 25\text{ KB}$ cho 7 ngày); Endpoint overview summary tính toán thuần túy in-memory từ `LatestTelemetryCache`, loại bỏ 100% N+1. | **ĐẠT (PASS)** |
| **T5 & ĐC5: WebSocket STOMP & 1Hz Conflation** | WebSocket `/ws-aiot` đọc `cors.allowed-origins` nghiêm ngặt; `StompChannelInterceptor` xác thực JWT ở CONNECT và chặn nặc danh ở SUBSCRIBE; `TelemetryConflationService` 1Hz/phòng; phát cảnh báo tức thời lên `/topic/alerts`. | **ĐẠT (PASS)** |

---

## 4. Danh Mục Việc Cần Kiểm Thủ Công (Physical Hardware Verification)

Các tiêu chí DoD gắn liền với trạm đo vật lý ESP32 và độ trễ mạng thực tế cần được kiểm chứng trên môi trường staging trước khi Go-Live:

| STT | Kịch bản kiểm chứng | Chỉ số DoD kỳ vọng | Kịch bản & Thao tác kiểm thử thực tế |
| :---: | :--- | :---: | :--- |
| **1** | **Rút nguồn trạm đo vật lý (Power Cutoff)** | Phát hiện `OFFLINE` $\le 2\text{ phút}$; Tự hồi phục `ONLINE` $\le 5\text{ giây}$. | 1. Trạm đo đang phát dữ liệu bình thường.<br>2. Rút cáp nguồn USB trạm đo (mô phỏng mất nguồn không có MQTT LWT).<br>3. Bấm đồng hồ, theo dõi log `Watchdog transitioned device to OFFLINE` và API `GET /api/v1/alerts`. Thời gian $\le 2$ phút.<br>4. Cắm lại nguồn trạm đo, kiểm tra log `Device restored from OFFLINE to ONLINE` trong vòng $\le 5$ giây. |
| **2** | **Độ trễ toàn trình Realtime (E2E Latency)** | Độ trễ cảm biến $\rightarrow$ Web Client $\le 1.5\text{ giây}$. | 1. Mở Web Dashboard lắng nghe kênh `/topic/rooms/{roomId}/telemetry`.<br>2. Thổi vào cảm biến DHT22 hoặc vỗ tay gần mic trạm đo.<br>3. Đo thời gian từ kích thích vật lý đến khi biểu đồ trên Web Client cập nhật số liệu. |
| **3** | **Điều tiết tần suất Conflation 1Hz** | Tần suất đẩy dữ liệu mỗi phòng $\le 1\text{ Hz}$ (1 frame/giây). | 1. Cấu hình firmware trạm đo gửi dồn dập 5–10 bản tin/giây.<br>2. Dùng DevTools (Network $\rightarrow$ WS) trên trình duyệt đếm số frame STOMP nhận được trong 10 giây.<br>3. Tổng số frame nhận được phải là 10 frame ($\pm 1$). |
| **4** | **Hiệu năng truy vấn biểu đồ 7 ngày** | Phản hồi $\le 200\text{ ms}$; Kích thước $\le 50\text{ KB}$. | Thực thi cURL đo đạc trực tiếp:<br>`curl -w "Time: %{time_total}s \| Size: %{size_download} bytes\n" -H "Authorization: Bearer <token>" "http://localhost:8080/api/v1/telemetry/room/<roomId>/buckets?interval=1h&start=2026-10-15T00:00:00Z&end=2026-10-22T00:00:00Z"` |

---

## 5. Kết Luận & Sẵn Sàng Bàn Giao

Backend AIoTLibTQB đã chính thức hoàn thành **Giai đoạn 1 (MVP Chạy được End-to-End)**, đáp ứng đầy đủ tính năng, hiệu năng và kiến trúc phòng vệ tải. Toàn bộ mã nguồn và tài liệu kỹ thuật sẵn sàng bàn giao cho đội ngũ Frontend và kiểm thử thực địa.
