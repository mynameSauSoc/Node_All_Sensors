# TỪ ĐIỂN THUẬT NGỮ, TỪ VIẾT TẮT & ĐƠN VỊ ĐO LƯỜNG (AIoTLibTQB)

> **Dự án**: AIoTLibTQB — Hệ thống Giám sát Vi khí hậu & Âm học Thông minh Thư viện Tạ Quang Bửu  
> **Tài liệu**: `docs/12-glossary.md`  
> **Phiên bản**: 2.0 (Chuẩn hóa toàn diện mã nguồn & quy chuẩn đo lường quốc tế)

---

## 1. MỤC TIÊU

Tài liệu này xác lập hệ quy chiếu ngôn ngữ và chuẩn mực đo lường kỹ thuật thống nhất cho toàn bộ hệ sinh thái **AIoTLibTQB**, phục vụ các mục tiêu cốt lõi:
1. Định nghĩa chuẩn xác các **Thuật ngữ Chuyên ngành (Domain Terms)** trong lĩnh vực vi khí hậu, âm học công trình, công nghệ IoT và kiến trúc phần mềm phân tán, loại bỏ các diễn giải mơ hồ giữa các bộ phận kỹ thuật.
2. Tra cứu đầy đủ danh mục **Từ viết tắt Kỹ thuật (Technical Abbreviations & Acronyms)** xuất hiện trong mã nguồn, tài liệu thiết kế và tiêu chuẩn quốc tế.
3. Chuẩn hóa **Bảng Đơn vị Đo lường Vật lý & Dải Đo Cảm biến (Measurement Units & Sensor Ranges)**, xác lập cơ sở dữ liệu dải đo phục vụ quy trình làm sạch dữ liệu và kích hoạt cảnh báo FSM.
4. Quy định các **Chuẩn Định dạng Dữ liệu (Data Format Conventions)** về thời gian, hệ tọa độ 2D và giao thức tuần tự hóa.

---

## 2. ĐỐI TƯỢNG ĐỌC

- **Toàn thể thành viên dự án AIoTLibTQB**: Lập trình viên Backend, Lập trình viên Frontend, Kỹ sư IoT/Nhúng, Kỹ sư Kiểm thử QA, Kỹ sư Vận hành DevOps.
- **Thành viên mới tiếp cận dự án**: Tra cứu nhanh các thuật ngữ lạ, khái niệm toán học và tiêu chuẩn môi trường khi đọc mã nguồn hoặc tài liệu.
- **Chuyên gia Nghiệp vụ, Cán bộ Thư viện & Nhà Nghiên cứu**: Hiểu rõ ý nghĩa khoa học của các đại lượng đo lường vật lý và xếp hạng tiện nghi.

---

## 3. NỘI DUNG CHI TIẾT

### 3.1. Bảng Tra cứu Thuật ngữ Chuyên ngành (Domain Glossary)

Bảng dưới đây tổng hợp các thuật ngữ kỹ thuật chuyên sâu được sử dụng xuyên suốt trong mã nguồn và tài liệu của dự án:

| Thuật ngữ | Khái niệm & Bản chất Kỹ thuật | Cơ chế Hoạt động & Ý nghĩa trong AIoTLibTQB | Tọa độ Dẫn chiếu Mã nguồn |
| :--- | :--- | :--- | :--- |
| **Vi khí hậu (Microclimate)** | Khí hậu cục bộ trong một không gian kín nhỏ (phòng học, kho sách) khác biệt với khí hậu vĩ mô ngoài trời. | Bao gồm 3 thông số chính: Nhiệt độ ($^\circ\text{C}$), Độ ẩm tương đối (% RH) và Cường độ ánh sáng (Lux), tác động trực tiếp đến sự bảo tồn giấy và tiện nghi con người. | `document/EnvironmentMetrics.java:1-25`, `01-overview.md` |
| **Âm học Thư viện (Library Acoustics)** | Mức độ năng lượng âm thanh và sự phân bố tiếng ồn trong không gian học tập. | Đo lường bằng 2 chỉ số: Mức âm tương đương liên tục ($L_{eq}$ - `noiseAvg`) và Mức âm thanh đỉnh tức thời ($L_{peak}$ - `noisePeak`). | `document/AcousticMetrics.java:1-20`, `ComfortScoreService.java:187-220` |
| **Library Comfort Score (LCS)** | Chỉ số định lượng chất lượng không gian thư viện theo thang điểm từ $0$ đến $100$. | Đánh giá tổng hợp 4 thành phần: Âm thanh, Bụi mịn, Nhiệt ẩm và Ánh sáng. Điểm số được ánh xạ sang 5 hạng: `Platinum`, `Gold`, `Silver`, `Bronze`, `Poor`. | `service/ComfortScoreService.java:84-157` |
| **Nguyên lý Thùng gỗ Liebig (Liebig's Law of the Minimum)** | Định luật sinh học: *"Sức chứa của thùng gỗ bị quyết định bởi thanh gỗ ngắn nhất, chứ không phải thanh gỗ dài nhất"*. | Trong môi trường thư viện, nếu có một thông số suy thoái nghiêm trọng (ví dụ tiếng ồn 85 dBA = 0 điểm), toàn bộ điểm LCS bị kéo sập xuống tối đa 30%, không cho phép các yếu tố tốt bù trừ cho yếu tố hỏng. | `service/ComfortScoreService.java:140-145` |
| **Non-linear Gating (Hệ số Chặn Phi tuyến)** | Kỹ thuật toán học nhân điểm trung bình gia quyền với tỷ lệ giữa thanh gỗ ngắn nhất và điểm trung bình. | Công thức: $\text{LCS} = S_{weighted} \times (0.30 + 0.70 \times \frac{S_{min}}{S_{weighted}})$. Giúp phản ánh trung thực hiện tượng sụp đổ tiện nghi môi trường. | `service/ComfortScoreService.java:141-144` |
| **Dynamic Re-weighting (Tái Phân bổ Trọng số Động)** | Thuật toán chuẩn hóa lại trọng số khi một hoặc nhiều cảm biến bị thiếu hoặc hỏng hóc. | Nếu phòng chưa lắp cảm biến bụi mịn, hệ thống tự động chia đều tỷ lệ trọng số còn lại cho 3 yếu tố kia sao cho tổng trọng số khả dụng luôn bằng $1.0$ ($100\%$). | `service/ComfortScoreService.java:112-135` |
| **TimeSeries Collection** | Cấu trúc bảng CSDL chuyên dụng trong MongoDB 8.0 tối ưu lưu trữ chuỗi thời gian. | Gom nhóm các phép đo theo thời gian vào các khối dữ liệu nén (buckets), hỗ trợ tham số tự động xóa sau 90 ngày (`expireAfter = "7776000s"`). | `document/TelemetryRecord.java:16-22` |
| **Bucket (Khối Dữ liệu Nén)** | Đơn vị lưu trữ vật lý của MongoDB TimeSeries gom các bản ghi có chung metadata trong một khung thời gian. | Giúp giảm dung lượng lưu trữ trên đĩa tới $80\%$ và tăng tốc độ quét dữ liệu theo trục thời gian hàng chục lần. | `TelemetryRecord.java:18`, `TelemetryService.java:146-183` |
| **Downsampling (Tổng hợp Giảm mẫu)** | Kỹ thuật giảm độ phân giải dữ liệu lịch sử từ từng giây thành từng khối 15 phút, 1 giờ, 1 ngày. | Sử dụng toán tử `$dateTrunc` trong MongoDB Aggregation Pipeline để tính Min, Max, Avg, SampleCount của từng khung, giảm tải truyền tải mạng cho Frontend. | `service/TelemetryService.java:146-183` |
| **Forward-fill (Bù Trôi Dữ liệu)** | Kỹ thuật điền bù số liệu đo hợp lệ gần nhất vào vị trí dữ liệu bị thiếu hoặc nhiễu. | Áp dụng trong cửa sổ trượt tối đa 30 giây (`FORWARD_FILL_WINDOW`) lưu trong Caffeine Cache. Nếu quá 30s không có dữ liệu, chuyển sang giá trị null (hỏng cảm biến). | `service/TelemetrySanitizerService.java:41-58` |
| **Peak Protection (Bảo vệ Xung Âm Đỉnh)** | Quy tắc ngoại lệ bắt buộc trong làm sạch dữ liệu: Không áp dụng forward-fill cho `noisePeak`. | Tiếng ồn đỉnh là xung âm thanh ngẫu nhiên tức thời; việc điền bù sẽ làm méo mó bản chất âm học và kích hoạt cảnh báo sai lệch kéo dài. | `service/TelemetrySanitizerService.java:94-106` |
| **Clamping (Kẹp Ngưỡng Chuẩn Hóa)** | Ràng buộc giá trị số học hoặc thời gian nằm nghiêm ngặt trong một khoảng cho phép $[Min, Max]$. | Dùng để kẹp dải đo vật lý và kẹp mốc thời gian thiết bị về thời gian thực của máy chủ backend khi pin RTC của node bị hết hoặc chạy sai giờ. | `service/MqttMessageDispatcherService.java:308-333` |
| **Carrier Thread Pinning (Ghim Luồng Nền Tảng)** | Hiện tượng luồng ảo Virtual Thread giữ chặt luồng thật của OS khi gặp khối mã `synchronized`. | AIoTLibTQB cấm tuyệt đối dùng `synchronized`, thay bằng `ConcurrentHashMap`, `Semaphore` và Caffeine Cache để tối đa hóa hiệu năng Virtual Threads. | `configuration/MqttConfig.java:42-44`, `10-conventions.md` |
| **Virtual Threads (Luồng Ảo - Project Loom)** | Luồng siêu nhẹ do JVM Java 21 quản lý trực tiếp thay vì phụ thuộc 1:1 vào luồng hệ điều hành. | Giảm chi phí bộ nhớ từ ~1MB xuống vài KB mỗi luồng, cho phép tạo hàng trăm nghìn luồng xử lý I/O đồng thời. Trong AIoTLibTQB, kênh Inbound MQTT được cấu hình `newVirtualThreadPerTaskExecutor()` để tiếp nhận dữ liệu telemetry đa luồng cực nhanh. | `configuration/MqttConfig.java:42-44`, `10-conventions.md § 3.1` |
| **Fair Semaphore (Hạn Ngạch Công Bằng)** | Cơ chế khóa đếm đa luồng phục vụ các yêu cầu theo thứ tự hàng đợi FIFO nghiêm ngặt. | Sử dụng `Semaphore(30, true)` giới hạn tối đa 30 luồng ghi đồng thời vào MongoDB, hạn chờ 3 giây (`tryAcquire(3000ms)`), bảo vệ CSDL chống sập khi có bão tin. | `service/MqttMessageDispatcherService.java:80, 270-301` |
| **FSM (Finite State Machine - Máy Trạng Thái)** | Mô hình quản lý vòng đời cảnh báo gồm 4 trạng thái hữu hạn. | `PENDING` (chờ 30s lọc nhiễu) $\to$ `FIRING` (kích hoạt báo động) $\to$ `ACKNOWLEDGED` (thủ thư đã nhận việc) $\to$ `RESOLVED` (khắc phục xong kèm trễ trễ Hysteresis). | `service/AlertRuleEngine.java:107-250` |
| **Hysteresis (Độ Trễ Trễ Đóng Cảnh Báo)** | Cơ chế trì hoãn việc đóng cảnh báo ngay khi thông số vừa hạ xuống dưới ngưỡng. | Hệ thống duy trì độ trễ trễ 60 giây ổn định liên tục trước khi chuyển sang `RESOLVED`, ngăn chặn hiện tượng báo động chớp tắt liên tục (*Flapping*). | `service/AlertRuleEngine.java:210-245` |
| **Conflation Throttling (Gom Tin Điều Tiết)** | Bộ đệm làm trễ gom nhiều bản tin trong 1 giây thành 1 bản tin duy nhất gửi tới client. | Áp dụng tại `TelemetryConflationService.java` nhả tin WebSocket STOMP tối đa 1Hz/phòng, bảo vệ trình duyệt người dùng không bị nghẽn CPU khi nhiều trạm cùng phát. | `service/TelemetryConflationService.java:1-80` |
| **Gaussian RBF (Radial Basis Function)** | Hàm cơ sở xuyên tâm phân phối Gauss sử dụng trong toán học nội suy trường vô hướng. | Tính toán mật độ lan tỏa nhiệt độ, độ ẩm và tiếng ồn từ tọa độ trạm cảm biến ra các vùng không gian xung quanh để vẽ Heatmap 2D liên tục trên Canvas. | `frontend/src/features/floorplan/heatmapMath.ts:40-95` |
| **IDW (Inverse Distance Weighting)** | Phương pháp nội suy nghịch đảo khoảng cách không gian đa trạm đo. | Các điểm trên Canvas càng gần trạm đo thì nhận giá trị càng tương đồng với trạm đó, mức ảnh hưởng giảm dần theo nghịch đảo lũy thừa khoảng cách $1/d^p$ ($p=2.0$). | `frontend/src/lib/floorplan/idw.ts:1-40`, `FloorplanCanvas.tsx` |
| **Single-Flight Request / Refresh Queue** | Cơ chế hàng đợi đơn lượt xử lý làm mới phiên làm việc JWT trong Frontend. | Khi hàng loạt API đồng thời nhận lỗi HTTP 401, chỉ có đúng 1 request refresh token duy nhất được gửi lên máy chủ; các request khác xếp hàng chờ và dùng chung token mới, ngăn chặn vi phạm RTR. | `frontend/src/features/auth/store.ts`, `10-conventions.md § 3.9` |
| **RTR (Refresh Token Rotation - Xoay Vòng Refresh Token)** | Cơ chế an ninh cấp phát token: mỗi lần refresh, Refresh Token cũ bị thu hồi ngay và thay thế bằng token mới toanh. | Token cũ đưa vào MongoDB TTL Blacklist (`invalidated_tokens`). Nếu kẻ gian dùng lại token cũ đã bị xoay vòng, hệ thống lập tức phát hiện và vô hiệu hóa toàn bộ chuỗi phiên. | `service/AuthenticationService.java:125-162`, `06-security-rbac.md` |
| **Last Will and Testament (LWT)** | Tính năng di chúc của giao thức MQTT do Broker lưu giữ khi thiết bị kết nối. | Nếu trạm đo bị ngắt kết nối đột ngột (mất điện, đứt cáp), Mosquitto tự động phát bản tin di chúc `{"status":"offline","reason":"lwt"}` vào topic status để báo tử. | `tools/iot-simulator/src/index.js:139-168`, `09-firmware-iot.md` |
| **Anti-Spoofing (Chống Giả Mạo Định Danh)** | Cơ chế an ninh xác thực tính nhất quán giữa đường dẫn kênh truyền và nội dung gói tin. | So sánh `hardware_id` trong JSON payload với `{hardwareId}` trên đường dẫn MQTT topic. Nếu có sai khác, bản tin lập tức bị drop và ghi log cảnh báo an ninh. | `service/MqttMessageDispatcherService.java:187-191` |

---

### 3.2. Danh mục Từ viết tắt Kỹ thuật (Technical Abbreviations)

| Từ viết tắt | Tên tiếng Anh Đầy đủ | Diễn giải Ý nghĩa Nghiệp vụ / Kỹ thuật |
| :--- | :--- | :--- |
| **AIoT** | Artificial Intelligence of Things | Trí tuệ nhân tạo kết hợp Internet vạn vật: thu thập dữ liệu cảm biến và ứng dụng thuật toán thông minh đánh giá môi trường. |
| **ACL** | Access Control List | Danh sách kiểm soát quyền truy cập: cấu hình phân quyền đọc/ghi trên các topic của MQTT Broker Mosquitto (`acl.conf`). |
| **ANSI** | American National Standards Institute | Viện Tiêu chuẩn Quốc gia Hoa Kỳ (chuẩn âm học ANSI S12.60). |
| **API** | Application Programming Interface | Giao diện lập trình ứng dụng (chuẩn RESTful bọc `ApiResponse<T>`). |
| **ASA** | Acoustical Society of America | Hiệp hội Âm học Hoa Kỳ (tiêu chuẩn âm học trường học và phòng học). |
| **ASHRAE** | American Society of Heating, Refrigerating and Air-Conditioning Engineers | Hiệp hội Kỹ sư Nhiệt lạnh Hoa Kỳ (tiêu chuẩn tiện nghi nhiệt ASHRAE 55). |
| **BMS** | Building Management System | Hệ thống quản trị tòa nhà thông minh điều khiển cơ điện (HVAC, thang máy, điện chiếu sáng). |
| **CORS** | Cross-Origin Resource Sharing | Cơ chế an ninh trình duyệt cho phép tài nguyên Web từ domain khác gọi API backend. |
| **DTO** | Data Transfer Object | Đối tượng vận chuyển dữ liệu giữa các tầng dịch vụ và client (Request/Response). |
| **FIFO** | First In, First Out | Nguyên lý hàng đợi vào trước - ra trước (áp dụng trong Fair Semaphore). |
| **FSM** | Finite State Machine | Máy trạng thái hữu hạn quản lý vòng đời cảnh báo vi khí hậu (`AlertRuleEngine`). |
| **HMAC** | Hash-based Message Authentication Code | Mã xác thực thông điệp dựa trên hàm băm mật mã (thuật toán ký token `HS512`). |
| **HVAC** | Heating, Ventilation, and Air Conditioning | Hệ thống sưởi, thông gió và điều hòa không khí của tòa nhà thư viện. |
| **IDW** | Inverse Distance Weighting | Thuật toán nội suy nghịch đảo khoảng cách vẽ bản đồ nhiệt 2D. |
| **ILS** | Integrated Library System | Hệ thống phần mềm quản trị thư viện tích hợp quản lý mượn trả sách và bạn đọc. |
| **ISO** | International Organization for Standardization | Tổ chức Tiêu chuẩn hóa Quốc tế (tiêu chuẩn kho sách lưu trữ ISO 11799). |
| **JTI** | JWT ID (Unique Token Identifier) | Mã định danh UUID duy nhất của JWT token, dùng làm khóa đưa vào danh sách đen `invalidated_tokens`. |
| **JWT** | JSON Web Token | Chuẩn mở (RFC 7519) định nghĩa phương thức truyền thông tin xác thực an toàn dưới dạng đối tượng JSON. |
| **LCS** | Library Comfort Score | Điểm số Tiện nghi Thư viện theo thang điểm $0 - 100$ dựa trên nguyên lý thùng gỗ Liebig. |
| **LWT** | Last Will and Testament | Bản tin di chúc trong giao thức MQTT được phát tự động khi client mất kết nối đột ngột. |
| **MDC** | Mapped Diagnostic Context | Ngữ cảnh chẩn đoán ánh xạ luồng log (SLF4J/Logback) lưu trữ `traceId` và `userId`. |
| **MEMS** | Micro-Electro-Mechanical Systems | Hệ thống vi cơ điện tử tích hợp trên chip (cảm biến âm thanh INMP441, gia tốc, con quay). |
| **MQTT** | Message Queuing Telemetry Transport | Giao thức truyền thông tin nhắn publish/subscribe siêu nhẹ tối ưu cho thiết bị IoT. |
| **NTP** | Network Time Protocol | Giao thức đồng bộ xung nhịp thời gian mạng Internet qua UDP port 123. |
| **PPD** | Predicted Percentage of Dissatisfied | Tỷ lệ phần trăm dự báo số người không hài lòng về môi trường nhiệt (ASHRAE 55). |
| **PMV** | Predicted Mean Vote | Giá trị đánh giá trung bình dự báo về cảm giác nhiệt của con người theo thang 7 bậc (ASHRAE 55). |
| **QoS** | Quality of Service | Cấp độ đảm bảo dịch vụ phân phối tin nhắn MQTT (Hệ thống dùng QoS 1 - At Least Once). |
| **RBF** | Radial Basis Function | Hàm cơ sở xuyên tâm dùng trong giải thuật nội suy trường nhiệt Heatmap 2D. |
| **RBAC** | Role-Based Access Control | Mô hình kiểm soát truy cập phân quyền dựa trên vai trò người dùng (7 vai trò). |
| **RTC** | Real-Time Clock | Đồng hồ thời gian thực tích hợp phần cứng duy trì giờ khi mất nguồn chính. |
| **RSSI** | Received Signal Strength Indicator | Chỉ số cường độ tín hiệu sóng không dây nhận được (đơn vị dBm). |
| **RTR** | Refresh Token Rotation | Cơ chế xoay vòng Refresh Token: cấp mới và hủy token cũ ngay sau mỗi lần làm mới phiên. |
| **SRE** | Site Reliability Engineering | Kỹ thuật đảm bảo độ tin cậy và sẵn sàng vận hành của hệ thống hạ tầng phần mềm. |
| **STOMP** | Simple Text Oriented Messaging Protocol | Giao thức định hướng văn bản chạy trên WebSocket phục vụ đẩy dữ liệu thời gian thực tới trình duyệt. |
| **TTL** | Time To Live | Thời gian tồn tại của bản ghi dữ liệu trước khi bị CSDL tự động xóa (MongoDB TTL Index). |
| **UUID** | Universally Unique Identifier | Chuỗi định danh 128-bit duy nhất trên toàn cầu (RFC 4122). |
| **VOC** | Volatile Organic Compounds | Hợp chất hữu cơ dễ bay hơi trong không khí (mùi sơn, dung môi, keo dán sách). |
| **VT** | Virtual Threads | Luồng ảo siêu nhẹ trong Java 21 (Project Loom) phục vụ xử lý I/O đồng thời cao. |
| **WHO** | World Health Organization | Tổ chức Y tế Thế giới (tiêu chuẩn chất lượng không khí bụi mịn PM2.5). |

---

### 3.3. Bảng Quy chuẩn Đơn vị Đo lường Vật lý & Dải Đo Cảm biến

Hệ thống thiết lập bộ lọc dải đo vật lý nghiêm ngặt tại `TelemetrySanitizerService.java:24-35`. Mọi giá trị nằm ngoài dải `[Min, Max]` đều bị coi là dữ liệu nhiễu hoặc hỏng cảm biến:

| Ký hiệu Thông số | Đại lượng Vật lý | Đơn vị Đo lường | Ký hiệu Đơn vị | Dải Đo Hợp lệ [Min, Max] | Cơ chế Lọc & Xử lý Dữ liệu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`noiseAvg`** ($L_{eq}$) | Mức áp suất âm thanh tương đương liên tục | Decibel đo theo trọng số A | **dBA** | **[30.0, 110.0]** | Vượt dải bị loại bỏ; áp dụng forward-fill trong 30s. Mức nền phòng yên tĩnh kẹp dưới ở 30.0 dBA. |
| **`noisePeak`** ($L_{peak}$) | Mức áp suất âm thanh đỉnh tức thời | Decibel đo theo trọng số A | **dBA** | **[30.0, 130.0]** | Vượt dải bị loại bỏ. **Tuyệt đối không áp dụng forward-fill** để bảo vệ tính đột biến của xung âm. |
| **`pm1_0`** | Nồng độ hạt bụi siêu mịn đường kính $\le 1.0\,\mu\text{m}$ | Microgam trên mét khối | **$\mu\text{g/m}^3$** | **[0.0, 1000.0]** | Vượt dải bị loại bỏ; áp dụng forward-fill trong 30s. Cảm biến laser quang học SPS30. |
| **`pm2_5`** | Nồng độ hạt bụi mịn hô hấp đường kính $\le 2.5\,\mu\text{m}$ | Microgam trên mét khối | **$\mu\text{g/m}^3$** | **[0.0, 1000.0]** | Thông số trọng tâm theo chuẩn WHO. Vượt dải bị loại bỏ; áp dụng forward-fill trong 30s. |
| **`pm4_0`** | Nồng độ hạt bụi lắng đường kính $\le 4.0\,\mu\text{m}$ | Microgam trên mét khối | **$\mu\text{g/m}^3$** | **[0.0, 1000.0]** | Vượt dải bị loại bỏ; áp dụng forward-fill trong 30s. |
| **`pm10`** | Nồng độ hạt bụi thô đường kính $\le 10.0\,\mu\text{m}$ | Microgam trên mét khối | **$\mu\text{g/m}^3$** | **[0.0, 1000.0]** | Vượt dải bị loại bỏ; áp dụng forward-fill trong 30s. |
| **`temperature`** | Nhiệt độ không khí môi trường | Độ Celsius | **$^\circ\text{C}$** | **[0.0, 60.0]** | Không dùng độ F hoặc Kelvin. Vượt dải bị loại bỏ; áp dụng forward-fill trong 30s. |
| **`humidity`** | Độ ẩm tương đối của không khí | Phần trăm độ ẩm tương đối | **% RH** | **[0.0, 100.0]** | Thang đo 0 đến 100, không dùng tỷ lệ 0.0 - 1.0. Vượt dải bị loại bỏ; áp dụng forward-fill trong 30s. |
| **`lux`** | Cường độ chiếu sáng môi trường | Lux (Lumen trên mét vuông) | **Lux** | **[0.0, 65535.0]** | Dải đo 16-bit cảm biến BH1750. Giá trị âm hoặc vượt 65535 (tràn thanh ghi) bị loại bỏ; forward-fill 30s. |
| **`wifiRssi`** | Cường độ tín hiệu sóng Wi-Fi | Decibel-miliwatt | **dBm** | **[-100, 0]** | Số nguyên âm. Giá trị gần 0 sóng càng mạnh. Thường nằm trong khoảng [-85, -35] dBm. |
| **`overall` (LCS)** | Điểm Tiện nghi Thư viện Tổng hợp | Điểm số tiện nghi | **Điểm (pts)**| **[0.0, 100.0]** | Điểm số tính toán từ động cơ Liebig Non-linear Gating, làm tròn 1 chữ số thập phân. |

---

### 3.4. Bảng Quy chuẩn Định dạng Dữ liệu (Data Format Conventions)

1. **Chuẩn Định dạng Thời gian (Timestamp Standards)**:
   - **Tầng CSDL & Backend**: Định dạng chuẩn thời gian quốc tế **UTC ISO 8601** (`YYYY-MM-DDTHH:mm:ss.sssZ`), ví dụ: `2026-10-30T15:30:00.000Z`.
   - **Gói tin IoT Telemetry (JSON)**: Chấp nhận cả 2 định dạng:
     - Epoch Milliseconds (13 chữ số, $\ge 10^{11}$): `1728543600000`.
     - Epoch Seconds (10 chữ số): `1728543600`.
     - Bộ lọc `MqttMessageDispatcherService.java:308-333` tự động chuẩn hóa về kiểu `Instant` trong Java.
2. **Quy ước Tuần tự hóa JSON (Naming Conventions)**:
   - **REST API Payload**: Bắt buộc sử dụng chuẩn **`camelCase`** cho các trường dữ liệu JSON trao đổi giữa Frontend và Backend (ví dụ: `hardwareId`, `deviceId`, `comfortScore`, `noiseAvg`).
   - **IoT MQTT Payload**: Khuyến nghị chuẩn **`snake_case`** thân thiện với vi điều khiển C/C++ (ví dụ: `hardware_id`, `noise_avg`, `wifi_rssi`). Backend hỗ trợ tự động cả 2 định dạng qua annotation `@JsonAlias` trong lớp `TelemetryPayload.java`.
3. **Hệ Tọa độ Không gian 2D Mặt bằng (2D Spatial Coordinates)**:
   - Hệ trục tọa độ Đề-các 2D tương đối: Gốc tọa độ $(0, 0)$ nằm ở **Góc trên cùng bên trái** của bản vẽ mặt bằng thư viện.
   - Trục hoành $X$: Hướng từ trái sang phải, giá trị thực tế biểu diễn theo đơn vị điểm ảnh tương đối (pixels) hoặc tỷ lệ chuẩn hóa $[0.0, 100.0\%]$.
   - Trục tung $Y$: Hướng từ trên xuống dưới, giá trị thực tế biểu diễn theo pixel hoặc tỷ lệ chuẩn hóa.
   - Đa giác phòng (`boundaryPolygon`): Biểu diễn bằng danh sách các đỉnh `List<Point2D>` khép kín theo chiều kim đồng hồ hoặc ngược chiều kim đồng hồ, đỉnh cuối cùng nối liền với đỉnh đầu tiên (`Room.java:39`).

---

## 4. ĐỌC TIẾP

Để liên kết các thuật ngữ và quy chuẩn trên vào các tài liệu triển khai cụ thể:
- **Xem bảng mục lục & lộ trình nghiên cứu**: Quay lại [`00-README.md`](./00-README.md).
- **Xem bối cảnh bài toán & tiêu chuẩn ISO/ASHRAE/WHO**: Xem [`01-overview.md`](./01-overview.md).
- **Xem kiến trúc hệ thống & sơ đồ luồng dữ liệu E2E**: Xem [`02-architecture.md`](./02-architecture.md).
- **Xem quy trình làm sạch & bù trôi forward-fill trong Ingestion**: Xem [`03-ingestion-pipeline.md`](./03-ingestion-pipeline.md).
- **Xem công thức toán học tính điểm LCS & ví dụ số liệu**: Xem [`04-lcs-algorithm.md`](./04-lcs-algorithm.md).
- **Xem chi tiết các bảng CSDL TimeSeries và Document**: Xem [`05-data-model.md`](./05-data-model.md).
- **Xem quy ước lập trình bắt buộc Đúng/Sai**: Xem [`10-conventions.md`](./10-conventions.md).
