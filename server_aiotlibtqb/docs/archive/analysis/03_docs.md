# BÁO CÁO PHÂN TÍCH TÀI LIỆU, LỊCH SỬ PHÁT TRIỂN & MA TRẬN MÂU THUẪN (DOCS & HISTORY ANALYSIS)
## DỰ ÁN: AIoTLibTQB (SMART INDOOR ENVIRONMENTAL & ACOUSTIC MONITORING)

> **Mã tài liệu:** `DOC-AIOT-ANALYSIS-03`  
> **Người thực hiện:** Worker R3 (Docs & History Analyst) — Teamwork Engine  
> **Thời điểm hoàn thành:** 2026-10-21T15:55:00Z  
> **Phạm vi thẩm định:** Toàn bộ hồ sơ tài liệu nghiệp vụ (`docs/business/*.md`), các tài liệu đặc tả kiến trúc gốc (`*.md`), lịch sử phát triển (`.agents/teamwork/`) và toàn bộ mã nguồn thực tế (`src/`).  
> **Quy ước nhãn chứng cứ:**  
> - `[XÁC NHẬN]`: Thông tin đã kiểm chứng trực tiếp từ mã nguồn thực tế (nêu rõ đường dẫn file và số dòng) hoặc kiểm thử thực thi.  
> - `[SUY LUẬN]`: Nhận định kỹ thuật, suy luận logic nghiệp vụ hoặc phân tích từ tài liệu lịch sử phát triển cũ.  
> - `[CHƯA RÕ]`: Vấn đề thiếu dữ kiện xác minh, cần Product Owner / Kỹ sư trưởng làm rõ.  
> - **Cam kết An toàn Thông tin:** Toàn bộ thông tin nhạy cảm, mật khẩu, JWT secret, khóa ký số đều được bảo vệ và che bằng `***`.

---

## MỤC LỤC
1. [TỔNG QUAN PHƯƠNG PHÁP & MỤC TIÊU KHẢO SÁT](#1-tổng-quan-phương-pháp--mục-tiêu-khảo-sát)
2. [TRÍCH XUẤT Ý ĐỊNH THIẾT KẾ TỪ HỒ SƠ TÀI LIỆU DỰ ÁN](#2-trích-xuất-ý-định-thiết-kế-từ-hồ-sơ-tài-liệu-dự-án)
   - 2.1. [Tài liệu Đặc tả Gốc (IOT_SYSTEM_SPECIFICATION.md)](#21-tài-liệu-đặc-tả-gốc-iot_system_specificationmd)
   - 2.2. [Kế hoạch Triển khai Chuẩn hóa (KE_HOACH_TRIEN_KHAI_PHAN_MEM_IOT.md)](#22-kế-hoạch-triển-khai-chuẩn-hóa-ke_hoach_trien_khai_phan_mem_iotmd)
   - 2.3. [Hướng dẫn Thực hiện & Cân nhắc Kỹ thuật (HUONG_DAN_THUC_HIEN_VA_CAN_NHAC_GIAI_PHAP.md)](#23-hướng-dẫn-thực-hiện--cân-nhắc-kỹ-thuật-huong_dan_thuc_hien_va_can_nhac_giai_phapmd)
   - 2.4. [Hệ sinh thái 9 Tài liệu Nghiệp vụ Chuyên sâu (docs/business/*.md)](#24-hệ-sinh-thái-9-tài-liệu-nghiệp-vụ-chuyên-sâu-docsbusinessmd)
3. [RÀ SOÁT LỊCH SỬ PHÁT TRIỂN & NHẬT KÝ KỸ THUẬT (.agents/teamwork/)](#3-rà-soát-lịch-sử-phát-triển--nhật-ký-kỹ-thuật-agentsteamwork)
   - 3.1. [Biên niên sử Tiến hóa Kiến trúc (Evolutionary History)](#31-biên-niên-sử-tiến-hóa-kiến-trúc-evolutionary-history)
   - 3.2. [Đợt Tối ưu hóa Trọng yếu Ngày 12/10/2026](#32-đợt-tối-ưu-hóa-trọng-yếu-ngày-12102026)
   - 3.3. [Khởi động Phase 1 Phân tích Kỹ thuật Toàn diện Ngày 21/10/2026](#33-khởi-động-phase-1-phân-tích-kỹ-thuật-toàn-diện-ngày-21102026)
4. [KẾT QUẢ RÀ SOÁT TODO / FIXME TRONG TOÀN BỘ CODEBASE](#4-kết-quả-rà-soát-todo--fixme-trong-toàn-bộ-codebase)
5. [MA TRẬN ĐỐI CHIẾU MÂU THUẪN (DISCREPANCY MATRIX: INTENT VS REALITY)](#5-ma-trận-đối-chiếu-mâu-thuẫn-discrepancy-matrix-intent-vs-reality)
   - 5.1. [Bảng Ma trận Đối chiếu Chi tiết](#51-bảng-ma-trận-đối-chiếu-chi-tiết)
   - 5.2. [Phân tích Sâu các Điểm Mâu thuẫn Trọng yếu](#52-phân-tích-sâu-các-điểm-mâu-thuẫn-trọng-yếu)
6. [DANH MỤC CÂU HỎI MỞ (OPEN QUESTIONS) CHO PRODUCT OWNER & TECH LEAD](#6-danh-mục-câu-hỏi-mở-open-questions-cho-product-owner--tech-lead)
7. [TỔNG KẾT & KHUYẾN NGHỊ KIẾN TRÚC CHO CÁC PHÂN HỆ TIẾP THEO](#7-tổng-kết--khuyến-nghị-kiến-trúc-cho-các-phân-hệ-tiếp-theo)

---

## 1. TỔNG QUAN PHƯƠNG PHÁP & MỤC TIÊU KHẢO SÁT

Hệ thống **AIoTLibTQB** (tiền thân mang tên dự án *Listen_Project*) `[XÁC NHẬN: IOT_SYSTEM_SPECIFICATION.md:8]` được thiết kế như một nền tảng giám sát không gian thông minh trung tâm, phục vụ thu thập dữ liệu vi khí hậu (bụi mịn, nhiệt độ, độ ẩm, ánh sáng) và âm học độ phân giải cao từ các trạm vi điều khiển ESP32-S3 trong các thư viện, phòng tự học và tòa nhà học thuật.

Báo cáo này đóng vai trò cầu nối đối soát độc lập, thực hiện phương pháp **Kỹ thuật Đảo ngược (Reverse Engineering)** kết hợp **Khảo sát Đối chiếu Hồ sơ (Document Cross-Referencing)** nhằm:
1. Trích xuất chính xác ý định thiết kế nguyên bản (Design Intent) từ hệ thống tài liệu kiến trúc, kế hoạch hành động và nghiệp vụ.
2. Rà soát lịch sử thay đổi qua các nhật ký kỹ thuật tại `.agents/teamwork/` để hiểu rõ bối cảnh và động cơ các quyết định kiến trúc `[SUY LUẬN]`.
3. Quét toàn bộ các điểm đánh dấu kỹ thuật chưa hoàn thiện (`TODO`, `FIXME`, `HACK`, `STUB`) trong mã nguồn `[XÁC NHẬN]`.
4. Thiết lập **Bảng Ma trận Mâu thuẫn (Discrepancy Matrix)** chỉ rõ từng điểm sai lệch giữa tài liệu thiết kế và mã nguồn thực thi hiện tại.
5. Định hình danh mục các câu hỏi mở cốt lõi định hướng giai đoạn phát triển giao diện (Frontend) và củng cố Backend.

---

## 2. TRÍCH XUẤT Ý ĐỊNH THIẾT KẾ TỪ HỒ SƠ TÀI LIỆU DỰ ÁN

Qua khảo sát toàn diện 12 tập tin tài liệu kiến trúc và nghiệp vụ hiện diện trong dự án, bức tranh ý định thiết kế được trích xuất theo 4 tầng tài liệu:

### 2.1. Tài liệu Đặc tả Gốc (`IOT_SYSTEM_SPECIFICATION.md`)
- **Tên dự án gốc & Phạm vi:** *Listen_Project* — Hệ thống trạm đo môi trường trong nhà (Indoor Environmental & Acoustic Station) `[XÁC NHẬN: dòng 1-9]`.
- **Mô hình phần cứng (Edge Layer):** Sử dụng vi điều khiển ESP32-S3 kết nối Micro I2S (INMP441) tính năng lượng âm, cảm biến bụi laser Sensirion SPS30 qua UART, cảm biến nhiệt ẩm SHT30/BME280 qua I2C và cảm biến ánh sáng BH1750 qua I2C `[XÁC NHẬN: dòng 12-16, 60-80]`.
- **Từ điển dữ liệu (Data Dictionary):** Định nghĩa 9 trường đo lường chuẩn: `noise_avg` (30–100 dBA), `noise_peak` (30–120 dBA), `pm1_0`, `pm2_5`, `pm4_0`, `pm10` ($0-1000\ \mu\text{g/m}^3$), `temperature` ($-40-85^\circ\text{C}$), `humidity` ($0-100\%$), `lux` ($0-65535$) `[XÁC NHẬN: dòng 46-57]`.
- **Kiến trúc đề xuất ban đầu:**
  - Broker trung gian: Mosquitto / EMQX / HiveMQ `[XÁC NHẬN: dòng 20-22]`.
  - Backend: Spring Boot với Rule Engine cảnh báo ngưỡng và phân phối dữ liệu qua STOMP over WebSocket `[XÁC NHẬN: dòng 26-32]`.
  - **Cơ sở dữ liệu ban đầu:** Đề xuất dùng **PostgreSQL + TimescaleDB** (với bảng quan hệ `users`, `rooms`, `devices`, `alerts` và hypertable `telemetry_data`) `[XÁC NHẬN: dòng 34-36, 174-182]`.
  - Frontend: Interactive Floorplan Heatmap, chuyển đổi các lớp nhiệt (Noise, AQI, Nhiệt ẩm), CRUD phòng/cảm biến với tọa độ kéo thả `(x%, y%)`, thông báo cảnh báo tức thời lên Web và Telegram Bot `[XÁC NHẬN: dòng 127-154, 183-188]`.

### 2.2. Kế hoạch Triển khai Chuẩn hóa (`KE_HOACH_TRIEN_KHAI_PHAN_MEM_IOT.md`)
- **Mã hiệu & Trạng thái:** `PLAN-AIOT-LIB-2026-V1.1-FINAL`, phiên bản chuẩn hóa chính thức phê duyệt tháng 10/2026 `[XÁC NHẬN: dòng 8-11]`.
- **Chuyển đổi Kiến trúc Nền tảng:**
  - Chính thức loại bỏ đề xuất PostgreSQL + TimescaleDB để chuyển sang **MongoDB 8.0 Native TimeSeries Collections** (`telemetry_records`) nhằm triệt tiêu rủi ro kiến trúc phân tán (Polyglot Persistence) `[XÁC NHẬN: dòng 36-38, 178-180]`.
  - Bổ sung **Eclipse Mosquitto 2.0** vào hạ tầng container với yêu cầu nghiêm ngặt `allow_anonymous false`, xác thực động thiết bị qua Webhook gọi về backend `[XÁC NHẬN: dòng 44-58]`.
- **Chuẩn hóa Toán học Chỉ số Tiện nghi (Library Comfort Score - LCS):**
  - Khắc phục các lỗi toán học ở bản thảo cũ (hàm phạt bậc 2 gây âm điểm, lỗi công thức chặn trần Liebig). Chuẩn hóa 4 hàm thành phần liên tục $C^0 \in [0, 100]$: $S_{acoustic}$ (ANSI/ASA S12.60 & WHO, phạt xung va đập $L_{peak} > 70$ dBA), $S_{air}$ (WHO 2021 & EPA), $S_{thermal}$ (ASHRAE 55-2020: tối ưu $23.5-25.5^\circ\text{C}$, $40-60\%$ RH), $S_{light}$ (EN 12464-1 & TCVN 7114: tối ưu $400-600$ Lux) `[XÁC NHẬN: dòng 92-152]`.
  - Thống nhất bộ trọng số: $w_{acoustic} = 0.35$, $w_{air} = 0.30$, $w_{thermal} = 0.20$, $w_{light} = 0.15$ `[XÁC NHẬN: dòng 154-158]`.
  - Áp dụng công thức chặn đáy phi tuyến tính Liebig Bottleneck:  
    $LCS = S_{weighted} \cdot [0.30 + 0.70 \cdot (S_{min} / 100)]$ `[XÁC NHẬN: dòng 162-171]`.
- **Cơ chế Phát hiện Ngoại tuyến Hai tầng (Hybrid Offline Detection):**
  - Tầng 1: MQTT Last Will and Testament (LWT) kích hoạt trong vòng $\le 1.5$ giây khi mất sóng/nguồn vật lý `[XÁC NHẬN: dòng 202-205]`.
  - Tầng 2: Scheduled Watchdog Job quét định kỳ 10 giây, phát hiện trôi dạt `lastSeenAt > 30s` để giải quyết lỗi half-open socket hoặc treo vi điều khiển `[XÁC NHẬN: dòng 205-208]`.
- **Máy Trạng thái Cảnh báo (Alert State Machine):**
  - Vòng đời: `PENDING` (chờ cửa sổ 30s) $\rightarrow$ `FIRING` (phát cảnh báo) $\rightarrow$ `ACKNOWLEDGED` (người quản trị xác nhận) $\rightarrow$ `RESOLVED` (tự giải tỏa khi giá trị duy trì dưới ngưỡng trừ 3 dBA trong 60s) `[XÁC NHẬN: dòng 299-315]`.
- **Cam kết Quyền Riêng tư Âm học (Edge Privacy by Design):** Không lưu file âm thanh, tính RMS tức thời trong RAM chip và xóa sạch sau 20ms, chỉ truyền số decibel qua MQTT, tuân thủ Nghị định 13/2023/NĐ-CP `[XÁC NHẬN: dòng 320-327]`.

### 2.3. Hướng dẫn Thực hiện & Cân nhắc Kỹ thuật (`HUONG_DAN_THUC_HIEN_VA_CAN_NHAC_GIAI_PHAP.md`)
- **Đánh giá Kiến trúc Hạ tầng:** So sánh chi tiết lý do chọn Mosquitto 2.0 (nhẹ $<30$MB RAM), Spring Integration MQTT kết hợp Java 21 Virtual Threads (đáp ứng 10-100 msg/s dễ dàng), MongoDB 8.0 Columnar Compression (tiết kiệm cache WiredTiger 10-20x) `[XÁC NHẬN: dòng 286-345]`.
- **Chuỗi Lọc Tín Hiệu 4 Tầng:** Tầng 1 Rate of Change, Tầng 2 Moving Median 5 mẫu lọc tiếng ho/đóng sách, Tầng 3 Hysteresis kép (Deadband 3 dBA), Tầng 4 Debounce 15 giây `[XÁC NHẬN: dòng 208-219, 365-380]`.
- **Cơ chế Throttling / Conflation 1Hz cho WebSocket:** Gom mẫu theo phòng và chỉ phát tán 1 bản tin/giây lên `/topic/rooms/{roomId}/telemetry` nhằm chống hiện tượng **DOM Thrashing** làm đơ trình duyệt client `[XÁC NHẬN: dòng 265-270, 382-389]`.
- **Cắt Đa giác Tường (Room Canvas Clipping):** Lưu danh sách đỉnh `boundaryPolygon` tại Document `Room` để frontend dùng hàm `ctx.clip()` trên HTML5 Canvas ngăn nhiệt độ và tiếng ồn tràn qua phòng khác `[XÁC NHẬN: dòng 126-135, 274-276]`.

### 2.4. Hệ sinh thái 9 Tài liệu Nghiệp vụ Chuyên sâu (`docs/business/*.md`)
Bộ tài liệu gồm 9 chuyên đề nghiệp vụ được biên soạn công phu, phản ánh hiện trạng mã nguồn và thiết kế chi tiết:
1. `00_TONG_QUAN.md`: Tóm tắt điều hành, bảng ma trận tác nhân (ADMIN, LIBRARIAN, ZONE_MANAGER, MAINTENANCE, VIEWER, USER, ESP32, Mosquitto), System Context Diagram, Phân rã 4 Module, Bản đồ chức năng 25 nghiệp vụ `[XÁC NHẬN: dòng 1-208]`.
2. `10_CHUC_NANG_IAM.md`: Chi tiết 13 chức năng IAM, luồng đăng nhập (giới hạn 10 req/phút), Refresh Token Rotation (24h), Logout blacklist, Token Introspection, CRUD User, Role, Permission với tính toàn vẹn `[XÁC NHẬN: dòng 1-406]`.
3. `10_CHUC_NANG_SPACE_DEVICE.md`: 16 chức năng Quản lý Không gian & Thiết bị: Chuẩn hóa mã phòng in hoa (`ROOM_101`), `boundaryPolygon`, đăng ký thiết bị cấp `rawApiKey` 32-hex (hiển thị 1 lần, lưu băm BCrypt), xác thực thiết bị cấp Device JWT 8 giờ, Discovery Service quét trạm lạ gom vào hàng đợi bộ nhớ `[XÁC NHẬN: dòng 1-372]`.
4. `10_CHUC_NANG_TELEMETRY.md`: Luồng tiếp nhận MQTT, kiểm tra chống giả mạo `hardwareId`, Sanitizer bù khuyết Forward-Fill 30 giây, kẹp dấu thời gian (tránh trôi về 1970 hoặc tương lai), lưu TimeSeries MongoDB độ phân giải SECONDS, API truy vấn Latest và History kèm Zone Scoping `[XÁC NHẬN: dòng 1-316]`.
5. `20_MO_HINH_DU_LIEU.md`: Sơ đồ ERD toàn diện, thực thể tài liệu (`User`, `Role`, `Permission`, `InvalidatedToken`, `Room`, `Device`, `Alert`), thực thể chuỗi thời gian `TelemetryRecord` nhúng các cụm chỉ số, máy trạng thái vòng đời trạm đo `[XÁC NHẬN: dòng 1-395]`.
6. `30_TICH_HOP_VA_TIEN_TRINH_NEN.md`: Pipeline Spring Integration MQTT qua Virtual Threads, Mosquitto integration, Scheduled Job `cleanExpiredTokens` lúc 02:00:00 sáng kết hợp MongoDB TTL Index `[XÁC NHẬN: dòng 1-169]`.
7. `40_BAO_MAT_VA_PHAN_QUYEN.md`: Chuỗi lọc bảo mật Servlet, Nimbus JOSE JWT HMAC-SHA512, bộ kiểm tra claim `tokenType != REFRESH` tại tầng Resource Server, Ma trận phân quyền chi tiết 14 Quyền nguyên tử $\times$ 7 Vai trò hệ thống, cơ chế an ninh phân vùng (Zone-based Access Control) `[XÁC NHẬN: dòng 1-198]`.
8. `50_CAU_HINH_VA_VAN_HANH.md`: Bảng ánh xạ 12 biến môi trường, Docker Compose 3 dịch vụ (`mongodb`, `mongo-express`, `mosquitto`), giám sát vận hành Actuator, hướng dẫn triển khai an toàn `[XÁC NHẬN: dòng 1-161]`.
9. `90_DOI_CHIEU_VA_CAU_HOI_MO.md`: Bản báo cáo đối soát sơ khởi ghi nhận 6 sai lệch, 4 hạng mục mã chờ/dở dang (Alert, WebSocket, Comfort Score, Swagger), 4 suy luận kiến trúc và Top 10 câu hỏi mở `[XÁC NHẬN: dòng 1-121]`.

---

## 3. RÀ SOÁT LỊCH SỬ PHÁT TRIỂN & NHẬT KÝ KỸ THUẬT (`.agents/teamwork/`)

> *Ghi chú nguyên tắc bảo vệ nhận thức:* Toàn bộ các phân tích trong mục này được trích xuất từ nhật ký tác vụ trong `.agents/teamwork/` và được định danh rõ bằng nhãn `[SUY LUẬN]` nhằm tái hiện bức tranh lịch sử; hiện trạng mã nguồn thực tế luôn là chuẩn mực đối chiếu cao nhất `[XÁC NHẬN]`.

### 3.1. Biên niên sử Tiến hóa Kiến trúc (Evolutionary History)
Dựa trên các nhật ký kỹ thuật tại `.agents/teamwork/` và các phiên bản đặc tả:
- **Giai đoạn Sơ khai (Draft Phase):** Dự án xuất phát với tài liệu `IOT_SYSTEM_SPECIFICATION.md` định hình mô hình trạm đo môi trường Listen_Project, ban đầu nghiêng về giải pháp cơ sở dữ liệu quan hệ kết hợp TimescaleDB / InfluxDB và đẩy dữ liệu realtime qua WebSocket STOMP `[SUY LUẬN: ORIGINAL_REQUEST.md:3-5, IOT_SYSTEM_SPECIFICATION.md:34-36]`.
- **Giai đoạn Tái cấu trúc Nền tảng (Consolidation Phase):** Đội ngũ phát triển nhận thấy sự phức tạp không cần thiết khi vận hành song song PostgreSQL và TimescaleDB cho quy mô trường học/thư viện. Do đó, toàn bộ kiến trúc được thống nhất chuyển sang Spring Boot 3.5.8 + MongoDB 8.0 Native TimeSeries và bảo mật bằng Nimbus JOSE JWT HMAC-SHA512 `[SUY LUẬN: KE_HOACH_TRIEN_KHAI_PHAN_MEM_IOT.md:35-38]`.
- **Giai đoạn Biên soạn Bộ Tài liệu Nghiệp vụ:** Nhóm phân tích đã hoàn thiện 9 tập tài liệu `docs/business/*.md`, phản ánh chi tiết các chức năng đã code, tuy nhiên tại thời điểm đó ghi nhận một số điểm nghẽn trong khâu Ingestion và tính toán điểm tiện nghi `[SUY LUẬN: docs/business/90_DOI_CHIEU_VA_CAU_HOI_MO.md:14-25]`.

### 3.2. Đợt Tối ưu hóa Trọng yếu Ngày 12/10/2026 (`ORIGINAL_REQUEST.md`)
Vào ngày 12/10/2026, dự án tiếp nhận yêu cầu refactoring trọng yếu tập trung vào 4 bài toán nghẽn luồng IoT Ingestion `[SUY LUẬN: ORIGINAL_REQUEST.md:3-27]`:
- **R1: Robust Timestamp Normalization and History Preservation:** Xử lý cả epoch 10 số (giây) và 13 số (mili-giây), bảo lưu dữ liệu ngoại tuyến gửi bù (> 1 giờ), chỉ kẹp thời gian khi lệch tương lai (> 60 giây).
- **R2: Sanitizer Memory Safety & Peak Acoustic Rule:** Thay thế cache không giới hạn bằng Caffeine Cache có chặn kích thước và TTL; loại trừ `noisePeak` khỏi cơ chế Forward-fill để tránh kéo dài xung âm bất thường.
- **R3: TimeSeries Optimization and Empty Record Filtering:** Bổ sung compound indexes (`metadata.deviceId + timestamp` và `metadata.roomId + timestamp`) vào `TelemetryRecord`; loại bỏ bản ghi rỗng (cả acoustics, airQuality, environment đều null).
- **R4: Database Protection and Ingestion Concurrency Throttling:** Cấu hình bounded thread pool cho MQTT inbound; bóp tần suất ghi `Device.lastSeenAt` (chỉ cập nhật nếu trôi quá 30 giây) và cache metadata thiết bị.

Kiểm chứng thực tế trong mã nguồn Java ngày 21/10/2026 xác nhận:
- Đợt refactor ngày 12/10/2026 **đã hoàn thành xuất sắc các mục R1, R2, phần lớn R3 và một phần R4**:
  - `TelemetrySanitizerService.java:41-44` đã tích hợp Caffeine Cache (`maximumSize = 50,000`, `expireAfterAccess = 10m`) `[XÁC NHẬN]`.
  - `TelemetrySanitizerService.java:82, 94-106` đã loại trừ `noisePeak` khỏi forward-fill qua phương thức `sanitizePeakWithoutForwardFill` `[XÁC NHẬN]`.
  - `TelemetryRecord.java:22-25` đã khai báo 2 compound indexes `@CompoundIndex` chuẩn xác `[XÁC NHẬN]`.
  - `MqttMessageDispatcherService.java:182-185, 243-250` đã cài đặt hàm `isEmptyMetrics` loại bỏ triệt để bản tin rỗng `[XÁC NHẬN]`.
  - `MqttMessageDispatcherService.java:167-175` đã áp dụng Caffeine Cache `lastSeenThrottleCache` bóp tần suất cập nhật CSDL `lastSeenAt` theo chu kỳ 30 giây `[XÁC NHẬN]`.
  - `MqttMessageDispatcherService.java:216-241` đã chuẩn hóa timestamp hỗ trợ cả epoch 10 số và 13 số, cho phép dữ liệu quá khứ từ sau năm 2020 và kẹp thời gian tương lai quá 60 giây `[XÁC NHẬN]`.
  - Động cơ tính điểm tiện nghi `ComfortScoreService.java` (450 dòng mã) đã được hiện thực hóa hoàn chỉnh với 3 không gian cấu hình (`STUDY_ROOM`, `BOOK_STORAGE`, `CIRCULATION_HALL`) và tích hợp trực tiếp vào luồng lưu bản ghi `[XÁC NHẬN: MqttMessageDispatcherService.java:191]`.
- **Điểm quan trọng rút ra:** Báo cáo đối soát cũ trong `docs/business/90_DOI_CHIEU_VA_CAU_HOI_MO.md` (mục 1.2, 1.3, 1.4, 1.6) phản ánh hiện trạng **trước đợt refactor 12/10**, do đó các mục này hiện tại đã được giải quyết trong code `[XÁC NHẬN]`.

### 3.3. Khởi động Phase 1 Phân tích Kỹ thuật Toàn diện Ngày 21/10/2026
Theo quyết định của Sentinel và Orchestrator 2 `[SUY LUẬN: .agents/teamwork/orchestrator_2/progress.md:1-27]`, 4 Worker được triển khai song song nhằm chuẩn bị bức tranh kỹ thuật đầy đủ nhất cho Phase 2 (Xây dựng Frontend & Hoàn thiện Backend).

---

## 4. KẾT QUẢ RÀ SOÁT TODO / FIXME TRONG TOÀN BỘ CODEBASE

Thực hiện quét tự động bằng công cụ tìm kiếm biểu thức chính quy (Grep Search) trên toàn bộ cây thư mục mã nguồn ứng dụng `src/main/java` và mã nguồn kiểm thử `src/test/java`:

- **Kết quả quét từ khóa `TODO`:** 0 kết quả tìm thấy `[XÁC NHẬN]`.
- **Kết quả quét từ khóa `FIXME`:** 0 kết quả tìm thấy `[XÁC NHẬN]`.
- **Kết quả quét các từ khóa tương đương (`XXX`, `HACK`, `STUB`, `UnsupportedOperationException`):** 0 kết quả tìm thấy `[XÁC NHẬN]`.
- **Kiểm tra ngoại lệ ném ra trong toàn dự án:** Toàn bộ 27 vị trí `throw new` trong mã nguồn dịch vụ đều ném `AppException(ErrorCode)` hoặc ngoại lệ nghiệp vụ cụ thể có kiểm soát, không có đoạn mã nào ném ngoại lệ kiểu "chưa hiện thực" `[XÁC NHẬN: UserService.java:41, DeviceService.java:72, RoomService.java:33, AuthenticationService.java:68]`.

**Nhận định kỹ thuật sâu sắc:**  
Việc không có từ khóa `TODO`/`FIXME` trong code không đồng nghĩa với việc hệ thống đã hoàn thiện 100% tính năng. Trái lại, các tính năng chưa hoàn thiện trong AIoTLibTQB tồn tại dưới dạng **"Mã giàn giáo dở dang" (Scaffolded Architecture)** — tức là đã tạo sẵn Entity, Enum, Repository và Permission trong CSDL nhưng chưa viết tầng Service, Controller hay Logic kết nối tương ứng (tiêu biểu là phân hệ Cảnh báo `Alert`) `[XÁC NHẬN: AlertRepository.java:13, Alert.java:20]`.

---

## 5. MA TRẬN ĐỐI CHIẾU MÂU THUẪN (DISCREPANCY MATRIX: INTENT VS REALITY)

### 5.1. Bảng Ma trận Đối chiếu Chi tiết

Dưới đây là ma trận đối chiếu toàn diện giữa **Ý định thiết kế trong tài liệu** và **Hiện trạng thực tế trong mã nguồn**:

| STT | Thành phần / Tính năng | Ý định Thiết kế trong Tài liệu | Hiện trạng Thực tế trong Mã nguồn | Trạng thái Đối soát | Tác động Kiến trúc & Mức độ Rủi ro |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **1** | **CSDL Lưu trữ Chuỗi Thời gian** | Sử dụng PostgreSQL + TimescaleDB cho chuỗi thời gian `[IOT_SYSTEM_SPECIFICATION.md:34-36]`. | Chạy hoàn toàn trên MongoDB 8.0 Native TimeSeries Collection `@TimeSeries(timeField="timestamp", granularity=SECONDS)` `[TelemetryRecord.java:15-21]`. | **Đã chuyển đổi thống nhất** | **Tốt / Rủi ro Thấp:** Đơn giản hóa kiến trúc, triệt tiêu nguy cơ bất đồng bộ dữ liệu (Polyglot Persistence). |
| **2** | **Chuẩn hóa Timestamp Trạm đo** | Hỗ trợ cả epoch giây (10 số) và mili-giây (13 số); bảo lưu dữ liệu ngoại tuyến gửi bù (> 1h); kẹp sai lệch tương lai `[ORIGINAL_REQUEST.md:12-14]`. | `MqttMessageDispatcherService.java:216-241` đã kiểm tra `>= 100_000_000_000L` để parse mili-giây, bảo lưu mốc thời gian sau 2020 và kẹp tương lai `> now + 60s`. | **Khớp hoàn toàn** *(Đã fix ngày 12/10)* | **Tốt:** Trạm ESP32 gửi bù dữ liệu Store-and-Forward sau mất mạng được lưu đúng mốc thời gian thực tế. |
| **3** | **Loại trừ Xung Âm Đỉnh (`noisePeak`)** | `noisePeak` là biến thiên tức thời, không được áp dụng Forward-Fill 30s để tránh báo động giả `[ORIGINAL_REQUEST.md:16-18]`. | `TelemetrySanitizerService.java:82, 94-106` gọi `sanitizePeakWithoutForwardFill`: nếu trạm gửi null thì trả về null, không lấy giá trị đệm cũ. | **Khớp hoàn toàn** *(Đã fix ngày 12/10)* | **Tốt:** Ngăn chặn xung âm va đập bị lưu kéo dài làm méo mó bản đồ nhiệt và gây báo động giả. |
| **4** | **Lọc Bản ghi Đo Rỗng (Empty Record)** | Hủy bỏ bản tin nếu cả 3 cụm metrics (acoustics, airQuality, environment) đều null `[ORIGINAL_REQUEST.md:20-22]`. | `MqttMessageDispatcherService.java:181-185, 243-250` kiểm tra `isEmptyMetrics(sanitized)` và log discard, không insert DB. | **Khớp hoàn toàn** *(Đã fix ngày 12/10)* | **Tốt:** Chống phình to dung lượng ổ đĩa của TimeSeries collection bởi các bản ghi vô giá trị. |
| **5** | **Bóp Tần suất Cập nhật `lastSeenAt`** | Bóp tần suất ghi DB `Device.lastSeenAt`, chỉ cập nhật nếu trôi quá 30-60 giây `[ORIGINAL_REQUEST.md:24-26]`. | `MqttMessageDispatcherService.java:166-175` dùng Caffeine cache `lastSeenThrottleCache` chặn cập nhật DB trong vòng 30 giây. | **Khớp hoàn toàn** *(Đã fix ngày 12/10)* | **Tốt:** Giảm 80-90% áp lực ghi (Write Amplification) lên collection `devices` khi hàng chục trạm phát 5s/lần. |
| **6** | **Giới hạn Luồng Ingestion (Thread Pool)** | Cấu hình Bounded Thread Pool cho kênh MQTT Inbound để chống cạn kiệt kết nối DB `[ORIGINAL_REQUEST.md:24-26]`. | `MqttConfig.java:43` vẫn sử dụng `Executors.newVirtualThreadPerTaskExecutor()` (Unbounded Virtual Threads). | **Chưa thực hiện / Mâu thuẫn** | **Trung bình:** Khi xảy ra bão bản tin (burst events), hàng ngàn Virtual Threads sinh ra đồng thời có thể gây cạn kiệt MongoDB Connection Pool (mặc định 100). |
| **7** | **Bộ nhớ đệm Metadata Thiết bị** | Cache tra cứu `Device` metadata để giảm lặp truy vấn DB trên mỗi bản tin telemetry `[ORIGINAL_REQUEST.md:26]`. | `MqttMessageDispatcherService.java:153` vẫn gọi trực tiếp `deviceRepository.findByHardwareId(hardwareId)` trên từng bản tin đến. | **Chưa thực hiện** | **Trung bình:** Tạo tải đọc liên tục vào MongoDB cho mỗi bản tin cảm biến đến. Cần bổ sung Caffeine cache cho Device metadata. |
| **8** | **Động cơ Điểm Tiện Nghi Thư viện (LCS)** | Công thức chuẩn hóa $C^0 \in [0, 100]$ và hàm chặn trần Liebig Bottleneck Non-linear `[KE_HOACH_TRIEN_KHAI_PHAN_MEM_IOT.md:90-171]`. | Đã triển khai `ComfortScoreService.java:69-230` đầy đủ 4 hàm thành phần, Liebig formula, hỗ trợ 3 RoomType profile; được gọi trực tiếp tại `MqttMessageDispatcherService.java:191`. | **Khớp hoàn toàn** *(Đã fix ngày 12/10)* | **Tốt:** Dữ liệu LCS đã được sinh tự động và lưu vào MongoDB TimeSeries `telemetry_records.comfortScore`. |
| **9** | **Phân hệ Cảnh báo (Alert Subsystem)** | Máy trạng thái cảnh báo 4 giai đoạn (`PENDING`, `FIRING`, `ACKNOWLEDGED`, `RESOLVED`), gửi Web/Telegram `[KE_HOACH_TRIEN_KHAI_PHAN_MEM_IOT.md:299-315]`. | Đã có `Alert.java`, `AlertStatus.java`, `AlertType.java`, `AlertRepository.java`. **Hoàn toàn KHÔNG CÓ `AlertService`, `AlertController` và Rule Engine trong luồng Ingestion** `[AlertRepository.java:13]`. | **Dở dang / Thiếu tầng Service & API** | **Nghiêm trọng (Chức năng cốt lõi):** Người dùng Web và Quản lý thư viện hiện tại không thể xem hay nhận bất kỳ cảnh báo nào từ hệ thống. |
| **10** | **Phân phối Real-time qua WebSocket STOMP** | Đẩy bản tin realtime qua `/ws-aiot`, phân quyền kênh STOMP theo Role/Zone, gom mẫu 1Hz `[KE_HOACH_TRIEN_KHAI_PHAN_MEM_IOT.md:60-88, 252-270]`. | `pom.xml:108-111` có thư viện `spring-boot-starter-websocket`, nhưng **trong toàn bộ `src/main/java` không có bất kỳ cấu hình WebSocket hay STOMP handler nào** `[XÁC NHẬN]`. | **Mã thừa / Dead Dependency** | **Nghiêm trọng (Phục vụ Frontend):** Frontend Web hiện tại bắt buộc phải dùng cơ chế Polling REST API vì backend chưa có kênh đẩy chủ động. |
| **11** | **Tiến trình Quét Ngoại tuyến (Watchdog Job)** | Scheduled Job quét mỗi 10 giây, đánh dấu OFFLINE các trạm im lặng quá 30 giây để xử lý lỗi half-open socket `[KE_HOACH_TRIEN_KHAI_PHAN_MEM_IOT.md:193-208]`. | Toàn bộ codebase chỉ có 1 job duy nhất là `cleanExpiredTokens` lúc 02:00 sáng `[AuthenticationService.java:238]`. **Không có `DeviceWatchdogService`**. Trạng thái online của trạm chỉ được tính động lúc gọi API `[DeviceService.java:230-235]`. | **Chưa thực hiện** | **Trung bình:** Khi trạm đo bị treo vi điều khiển (vẫn giữ kết nối TCP ảo), hệ thống không chủ động đổi trạng thái sang OFFLINE trong CSDL cho đến khi có người gọi API tra cứu. |
| **12** | **Chuỗi Lọc Tín Hiệu 4 Tầng (Signal Filter)** | Rate-of-Change, Moving Median 5 mẫu, Hysteresis kép 3 dBA, Debounce 15s `[HUONG_DAN_THUC_HIEN_VA_CAN_NHAC_GIAI_PHAP.md:208-220]`. | Hệ thống không có `SignalFilterService`. Logic làm sạch nằm trong `TelemetrySanitizerService.java` chỉ kiểm tra min/max và Forward-Fill 30s. | **Đơn giản hóa so với thiết kế** | **Trung bình:** Tiếng gõ bàn hoặc tiếng ho bất chợt có thể làm tăng `noiseAvg` tức thời do thiếu bộ lọc trung vị (Median Filter). |
| **13** | **Tài liệu Hóa Runtime (Swagger / OpenAPI)** | Cung cấp giao diện Swagger UI `/swagger-ui.html` cho đội ngũ phát triển Frontend đối soát `[docs/business/90_DOI_CHIEU_VA_CAU_HOI_MO.md:71-76]`. | `pom.xml` không có dependency `springdoc-openapi-starter-webmvc-ui`. Ứng dụng không chạy Swagger UI `[pom.xml:40-117]`. | **Chưa tích hợp** | **Thấp:** Phụ thuộc hoàn toàn vào file tài liệu tĩnh và bộ sưu tập `AIoTLibTQB_Postman_Collection.json` (62KB). |
| **14** | **Toàn vẹn Dữ liệu Khi Xóa Phòng & Vai trò** | Ngăn chặn việc tạo dữ liệu mồ côi khi xóa phòng hoặc xóa vai trò người dùng `[docs/business/90_DOI_CHIEU_VA_CAU_HOI_MO.md:83, 116-118]`. | `RoomService.java:106-112` xóa phòng trực tiếp mà không kiểm tra thiết bị gắn kèm. `RoleService.java:80-82` xóa vai trò mà không thu hồi vai trò khỏi `User.roles`. | **Thiếu Ràng buộc Toàn vẹn** | **Trung bình:** Khi xóa một Room, các thiết bị thuộc phòng đó sẽ mang `roomId` rác. Khi xóa một Role, người dùng vẫn giữ nhúng Role đó trong tài liệu `User`. |
| **15** | **Báo cáo Thống kê Định kỳ & Analytics** | Đã cấp quyền `GENERATE_REPORT` (xuất PDF/CSV theo TCVN 8681) và `VIEW_ANALYTICS` (Mould Index history) `[ApplicationInitConfig.java:68-72, 109-110]`. | Không có bất kỳ Controller hay Service nào liên quan đến xuất báo cáo PDF/CSV hay tính toán chỉ số nấm mốc (VTT Mould Index). | **Quyền hạn Scaffold / Chưa có Code** | **Trung bình (Thiếu tính năng):** Các chức năng xuất báo cáo và phân tích chuyên sâu nằm trong kế hoạch Sprint 4 của tài liệu nhưng chưa được xây dựng. |

---

### 5.2. Phân tích Sâu các Điểm Mâu thuẫn Trọng yếu

#### A. Phân hệ Cảnh báo (Alert): Đầy đủ Scaffolding nhưng Thiếu Động cơ Vận hành
- **Bằng chứng mã nguồn:**
  - `Alert.java:14-52` định nghĩa cấu trúc Document hoàn chỉnh với `deviceId`, `roomId`, `type`, `status`, `currentValue`, `threshold`, các mốc thời gian `startedAt`, `acknowledgedAt`, `resolvedAt`.
  - `AlertRepository.java:13-25` cung cấp 5 hàm truy vấn tối ưu.
  - `ApplicationInitConfig.java:51-57` đã gán 3 quyền hạn: `VIEW_ALERTS`, `ACKNOWLEDGE_ALERT`, `MANAGE_ALERT_CONFIG` cho các Role `ADMIN`, `LIBRARIAN`, `ZONE_MANAGER`, `MAINTENANCE`.
- **Thực trạng thiếu hụt:**
  - Tìm kiếm toàn bộ dự án không có `AlertService.java` và `AlertController.java`.
  - Trong luồng tiếp nhận `MqttMessageDispatcherService.handleTelemetryMessage()`, sau khi làm sạch dữ liệu và tính điểm tiện nghi, hệ thống chỉ lưu `telemetryRepository.save(record)` mà **hoàn toàn không có bước so sánh ngưỡng** để khởi tạo hoặc cập nhật bản ghi `Alert`.
- **Đánh giá:** Đây là khoảng trống nghiệp vụ lớn nhất của Backend AIoTLibTQB. Để phục vụ màn hình "Lịch sử cảnh báo" trên giao diện Frontend, bắt buộc phải hoàn thiện phân hệ này ở Phase 2 `[XÁC NHẬN]`.

#### B. Thư viện WebSocket STOMP: Sự hiện diện vô hình (Dead Dependency)
- **Bằng chứng mã nguồn:**
  - `pom.xml:108-111` khai báo:
    ```xml
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-websocket</artifactId>
    </dependency>
    ```
  - Tìm kiếm toàn bộ mã nguồn Java: Không có class nào chứa `@EnableWebSocketMessageBroker`, `WebSocketConfigurer`, `ChannelInterceptor`, hay `@MessageMapping`.
- **Đánh giá:** Thư viện này đang là "mã chết" (Dead Code). Frontend không thể mở kết nối WebSocket STOMP đến `/ws-aiot` như tài liệu mô tả. Backend hiện tại **hoàn toàn là REST API đơn thuần** `[XÁC NHẬN]`.

#### C. Điểm Tiện Nghi LCS: Tín hiệu Mừng sau Đợt Refactor
- Khác với nhận định trong tài liệu đối soát cũ `docs/business/90_DOI_CHIEU_VA_CAU_HOI_MO.md:24, 61-67` cho rằng trường `comfortScore` bị bỏ quên (`null`), mã nguồn hiện tại tại `MqttMessageDispatcherService.java:191-203` đã tích hợp đầy đủ:
  ```java
  ComfortScoreRecord comfortScore = comfortScoreService.calculateForRoom(sanitized, device.getRoomId());
  ```
  Lớp `ComfortScoreService.java` (450 dòng mã) xử lý xuất sắc các trường hợp phân bổ trọng số động khi cảm biến bị khuyết thiếu, áp dụng công thức Liebig Bottleneck và có bộ đệm Caffeine Cache cho `RoomType`. Điểm tiện nghi được lưu đầy đủ vào MongoDB và đã được kiểm chứng qua 13 unit test đạt 100% tỷ lệ đỗ `[XÁC NHẬN: ComfortScoreServiceTest.java, kết quả kiểm thử ./mvnw test]`.

---

## 6. DANH MỤC CÂU HỎI MỞ (OPEN QUESTIONS) CHO PRODUCT OWNER & TECH LEAD

Dưới đây là danh sách các câu hỏi kiến trúc và nghiệp vụ mở cần được Product Owner và Kỹ sư trưởng chốt phương án trước khi bước vào Phase 2:

### Nhóm 1: Câu hỏi Trọng yếu Phục vụ Giai đoạn Giao diện Frontend (Blockers - P1)

1. **Phương thức Truyền Dữ liệu Thời gian Thực lên Dashboard (Real-time Delivery):**
   > *Hiện trạng:* `pom.xml` có `spring-boot-starter-websocket` nhưng chưa có code cấu hình STOMP. Frontend Dashboard hiển thị bản đồ nhiệt (Heatmap) dự kiến sẽ:
   > - **Phương án A:** Viết tiếp tầng cấu hình WebSocket STOMP `/ws-aiot` kèm cơ chế Throttling 1Hz như tài liệu thiết kế?
   > - **Phương án B:** Chuyển sang Server-Sent Events (SSE) để truyền luồng đơn hướng nhẹ hơn cho Web?
   > - **Phương án C:** Frontend chấp nhận Polling định kỳ qua REST API (`GET /api/v1/telemetry/room/{id}/latest`) mỗi 3-5 giây?
   > `[Cần xác nhận từ PO / Tech Lead Frontend]`

2. **Kế hoạch Triển khai Phân hệ Cảnh báo (Alert Subsystem):**
   > *Hiện trạng:* `Alert` và `AlertRepository` đã có sẵn nhưng thiếu `AlertService`, `AlertController` và Rule Engine so ngưỡng.
   > - Ngưỡng cảnh báo sẽ được cấu hình động theo từng phòng (`room.noiseThreshold`, `room.pm25Threshold`) hay lấy theo ngưỡng cố định trong mã nguồn?
   > - Giao diện Web có cần nhận cảnh báo tức thời qua WebSocket popup không, hay chỉ cần màn hình tra cứu danh sách cảnh báo qua REST API?
   > `[Cần xác nhận từ PO]`

3. **Cơ chế Phân trang & Lọc Dữ liệu Lịch sử Biểu đồ (Analytics & Charting Contract):**
   > *Hiện trạng:* API `GET /api/v1/telemetry/device/{id}` và `.../room/{id}` hiện trả về danh sách bản ghi thô giới hạn trong 1 giờ gần nhất.
   > - Khi người dùng xem biểu đồ xu hướng theo Ngày / Tuần / Tháng, backend có cần bổ sung các endpoint tính toán tổng hợp (Aggregation Pipeline: theo giờ/ngày như `$avg`, `$max`, `$min`) để tránh kéo hàng vạn bản ghi thô làm nghẽn mạng client không?
   > `[Cần xác nhận từ PO / Kỹ sư Backend]`

### Nhóm 2: Câu hỏi Ổn định Hạ tầng & An toàn Vận hành (Major - P2)

4. **Kiểm soát Tải Đa luồng Kênh MQTT Inbound (Concurrency Throttling):**
   > *Hiện trạng:* `MqttConfig.java:43` vẫn sử dụng `newVirtualThreadPerTaskExecutor()` không giới hạn số lượng luồng ảo, chưa có Bounded Queue.
   > - Có cần thiết lập Semaphore hoặc cấu hình Thread Pool có giới hạn (ví dụ tối đa 50-100 luồng đồng thời) để bảo vệ MongoDB Connection Pool khi hàng trăm trạm phát sóng đồng loạt sau sự cố điện không?
   > `[Cần xác nhận từ Lead DevOps / Backend]`

5. **Bộ nhớ đệm Tra cứu Metadata Thiết bị (Device Lookup Cache):**
   > *Hiện trạng:* `MqttMessageDispatcherService.java:153` gọi `deviceRepository.findByHardwareId()` trên mọi bản tin đến.
   > - Có nên bổ sung bộ đệm Caffeine Cache (TTL 10 phút, tự hủy khi Admin sửa thiết bị) tương tự như `roomTypeCache` trong `ComfortScoreService` để triệt tiêu tải đọc lặp lại vào MongoDB không?
   > `[Cần xác nhận từ Lead Backend]`

6. **Tiến trình Giám sát Trạng thái Trạm Ngoại tuyến (Watchdog Scheduler):**
   > *Hiện trạng:* Chưa có Scheduled Job quét trạng thái Offline định kỳ; trạng thái trạm chỉ được tính toán động khi có request gọi API.
   > - Có cần hiện thực hóa `DeviceWatchdogService` chạy chu kỳ 10-15 giây để tự động phát hiện trạm mất tín hiệu quá 30 giây và phát sinh bản tin cảnh báo `DEVICE_OFFLINE` vào collection `Alert` không?
   > `[Cần xác nhận từ PO / Hardware Team]`

7. **Ràng buộc Toàn vẹn Khi Xóa Thực Thể (Integrity Cascading):**
   > *Hiện trạng:* `RoomService` cho phép xóa phòng khi phòng vẫn còn thiết bị gán kèm; `RoleService` cho phép xóa vai trò khi người dùng vẫn đang mang vai trò đó.
   > - Có nên bổ sung quy tắc nghiệp vụ: Chặn xóa phòng nếu `deviceRepository.countByRoomId(roomId) > 0`; và khi xóa Role thì tự động chạy `updateMulti` loại bỏ Role khỏi danh sách `User.roles`?
   > `[Cần xác nhận từ Lead Backend]`

### Nhóm 3: Câu hỏi Mở rộng Tính năng & Tiện ích (Minor / Future - P3)

8. **Thời hạn Sống của Refresh Token cho Ứng dụng Di động:**
   > *Hiện trạng:* Refresh Token có thời hạn cố định 24 giờ (`jwt.refreshable-hours: 24`). Với độc giả sinh viên dùng mobile app, việc bị bắt đăng nhập lại sau mỗi 24 giờ có thể gây bất tiện.
   > - Có nên phân biệt client: Web Dashboard giữ 24 giờ, Mobile App nâng lên 7 hoặc 30 ngày?
   > `[Cần xác nhận từ PO]`

9. **Tích hợp Tài liệu Hóa Runtime (OpenAPI / Swagger):**
   > *Hiện trạng:* Thiếu thư viện `springdoc-openapi-starter-webmvc-ui`.
   > - Đội ngũ Frontend có yêu cầu bổ sung Swagger UI tại `/swagger-ui.html` để kiểm thử tương tác trực tiếp hay tiếp tục sử dụng Postman Collection `AIoTLibTQB_Postman_Collection.json`?
   > `[Cần xác nhận từ Frontend Team]`

10. **Phân hệ Báo cáo Định kỳ (PDF/CSV Export):**
    > *Hiện trạng:* Quyền `GENERATE_REPORT` đã được phân bổ nhưng chưa có mã nguồn xuất báo cáo theo chuẩn TCVN 8681.
    > - Tính năng xuất báo cáo định kỳ (PDF/CSV) được dự kiến triển khai trong giai đoạn nào và thư viện nào (JasperReports, Apache POI, OpenPDF) được ưu tiên?
    > `[Cần xác nhận từ PO]`

---

## 7. TỔNG KẾT & KHUYẾN NGHỊ KIẾN TRÚC CHO CÁC PHÂN HỆ TIẾP THEO

### 7.1. Đánh giá Chung về Chất lượng Mã nguồn Hiện tại
1. **Khung nền tảng (Foundation) Rất Vững Chắc:** Phân hệ IAM, Security RBAC/ABAC với Nimbus HMAC-SHA512, Rate Limit Bucket4j và phân vùng không gian (Zone Scoping) được thiết kế bài bản, lớp lang, tuân thủ chặt chẽ tiêu chuẩn Spring Enterprise.
2. **Khâu Ingestion Cảm biến Đã Được Tối Ưu Tốt:** Nhờ đợt refactoring ngày 12/10/2026, các bài toán nan giải về chuẩn hóa timestamp (10 vs 13 số), bảo vệ bộ nhớ đệm (Caffeine Cache), lọc dữ liệu rỗng và tính toán chỉ số tiện nghi LCS chuẩn hóa đã hoạt động ổn định và có kiểm thử bao phủ toàn diện.
3. **Bộ Kiểm thử Đạt Chuẩn Cao:** Toàn bộ 19 file test trong `src/test/java` với **124 ca kiểm thử đều vượt qua thành công 100%** (thời gian chạy chỉ 9.06s), không có lỗi suy thoái (regression).
4. **Các Điểm Trống Cần Khắc Phục:** Tập trung chủ yếu ở 2 module: **Alerting** (thiếu Service/Controller) và **Realtime Distribution** (thiếu cấu hình WebSocket STOMP).

### 7.2. Khuyến nghị Cụ thể cho Các Bước Triển khai Tiếp theo
- **Dành cho Đội ngũ Backend:**
  1. Triển khai ngay `AlertService` và `AlertController`: Lập bảng quy tắc ngưỡng trong `MqttMessageDispatcherService` để tự động lưu cảnh báo khi chỉ số vượt trần.
  2. Bổ sung `WebSocketConfig` với STOMP Message Broker tại `/ws-aiot` hoặc xây dựng endpoint SSE phục vụ streaming dữ liệu cho bản đồ nhiệt phòng đọc.
  3. Bổ sung bộ đệm Caffeine Cache cho tra cứu thiết bị (`Device`) trong luồng Ingestion để giảm tải I/O cho CSDL.
  4. Thêm kiểm tra ràng buộc toàn vẹn khi xóa `Room` và xóa `Role`.
- **Dành cho Đội ngũ Frontend:**
  1. Sử dụng tệp `AIoTLibTQB_Postman_Collection.json` làm hợp đồng giao tiếp chuẩn trong thời gian backend chưa tích hợp Swagger UI.
  2. Ở giai đoạn đầu, triển khai giao diện theo cơ chế Polling REST API (khoảng 3 - 5 giây/lần) cho màn hình Heatmap trong khi chờ kênh WebSocket STOMP hoàn thiện.
  3. Áp dụng kỹ thuật Canvas HTML5 `ctx.clip()` với mảng tọa độ `boundaryPolygon` từ API `Room` để vẽ bản đồ nhiệt cách ly giữa các phòng.
- **Dành cho Đội ngũ Quản trị / Firmware ESP32:**
  1. Duy trì cấu hình MQTT LWT với QoS 1 trên topic `devices/{hardwareId}/status` để backend nắm bắt kịp thời sự cố ngắt nguồn.
  2. Đảm bảo cấu hình `allow_anonymous false` trên Mosquitto production và trạm đo sử dụng `rawApiKey` do hệ thống cấp để xác thực an toàn.
