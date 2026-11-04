# BÁO CÁO PHÂN TÍCH KỸ THUẬT: CẤU HÌNH & HẠ TẦNG HỆ THỐNG (AIoTLibTQB)

> **Mã tài liệu:** `docs/analysis/02_config.md`  
> **Nhiệm vụ:** Requirement R2 — Technical Analysis Phase 1  
> **Phạm vi phân tích:** `pom.xml`, cấu hình ứng dụng (`application.yaml`), cơ sở dữ liệu & TimeSeries (MongoDB 8.0), ảo hóa hạ tầng (Docker Compose, CI/CD) và tích hợp ngoại vi (Mosquitto MQTT Broker, Caffeine Caching, Bucket4j Rate Limiting, Third-party APIs).  
> **Nguyên tắc bảo mật:** Toàn bộ thông tin bí mật, khóa bí mật, mật khẩu mặc định đều được che dấu bằng ký hiệu `***`.  
> **Quy ước nhãn minh chứng:**  
> - `[XÁC NHẬN]`: Thông tin đã được kiểm chứng trực tiếp từ mã nguồn, tệp cấu hình hoặc tệp hạ tầng thực tế trong kho mã.  
> - `[SUY LUẬN]`: Nhận định kỹ thuật được suy luận logic dựa trên các căn cứ cấu hình và mã nguồn hiện hữu.  
> - `[CHƯA RÕ]`: Điểm chưa đủ bằng chứng thực tế trong mã nguồn, có sự sai lệch giữa tài liệu và code, hoặc tính năng đang dở dang.  

---

## 1. PHÂN TÍCH `pom.xml` VÀ QUẢN TRỊ PHỤ THUỘC (DEPENDENCY MANAGEMENT)

### 1.1. Thông tin Dự án và Phiên bản Nền tảng
- **Spring Boot Parent:** `org.springframework.boot:spring-boot-starter-parent:3.5.8` `[XÁC NHẬN: pom.xml:8-13]`.
- **Mã định danh dự án:** `groupId: com.example`, `artifactId: AIoTLibTQB`, `version: 0.0.1-SNAPSHOT` `[XÁC NHẬN: pom.xml:15-17]`.
- **Mô tả dự án:** *"Identity Service — Authentication & Authorization with MongoDB"* `[XÁC NHẬN: pom.xml:19]`.  
  *Ghi chú kiến trúc:* Mô tả này phản ánh dự án ban đầu được khởi tạo từ một dịch vụ định danh và xác thực (Identity Service), sau đó được mở rộng cấu trúc để đảm nhiệm toàn bộ nền tảng thu thập dữ liệu IoT và tính toán tiện nghi môi trường `[SUY LUẬN]`.
- **Phiên bản Java & Trình biên dịch:**
  - Java Version: **Java 21** (`<java.version>21</java.version>`) `[XÁC NHẬN: pom.xml:22]`. Cho phép tận dụng các tính năng hiện đại của Java 21, đặc biệt là **Virtual Threads** (Project Loom) `[XÁC NHẬN: MqttConfig.java:43]`.
  - Plugin biên dịch: `maven-compiler-plugin:3.11.0` cấu hình source/target mức Java 21 `[XÁC NHẬN: pom.xml:26, 136-141]`.
  - Tích hợp Annotation Processor: Kết hợp song song giữa `lombok:1.18.38`, `mapstruct:1.5.5.Final`, và bộ nối cầu `lombok-mapstruct-binding:0.2.0` `[XÁC NHẬN: pom.xml:23-25, 142-158]`. Cấu hình trình biên dịch thiết lập `defaultComponentModel = "spring"` để MapStruct tự động sinh các Spring `@Component` Mapper `[XÁC NHẬN: pom.xml:161]`.

---

### 1.2. Giải mã Toàn bộ Dependencies theo Mục đích Kiến trúc

Bảng dưới đây giải mã toàn diện toàn bộ 16 dependencies được khai báo trong `pom.xml` `[XÁC NHẬN: pom.xml:31-117]`:

| STT | Dependency (GroupId : ArtifactId) | Phiên bản (Version) | Phân loại Kiến trúc | Mục đích Kỹ thuật & Hiện trạng Sử dụng |
| :---: | :--- | :---: | :--- | :--- |
| 1 | `org.springframework.boot:spring-boot-starter-web` | Kế thừa từ Parent (3.5.8) | Web / REST Core | Cung cấp Spring MVC, nhúng máy chủ web Apache Tomcat, và thư viện Jackson JSON Processor để phục vụ hệ thống REST API `[XÁC NHẬN: pom.xml:31-34]`. |
| 2 | `org.springframework.boot:spring-boot-starter-validation` | Kế thừa từ Parent (3.5.8) | DTO Validation | Tích hợp Hibernate Validator thực hiện kiểm tra ràng buộc dữ liệu đầu vào trên DTO (`@NotNull`, `@Size`, `@Pattern`) `[XÁC NHẬN: pom.xml:36-39]`. |
| 3 | `org.springframework.security:spring-security-crypto` | Kế thừa từ Parent (3.5.8) | Mật mã học (Cryptography) | Cung cấp thuật toán `BCryptPasswordEncoder` (độ mạnh 10) để băm mật khẩu người dùng và khóa thiết bị IoT (`apiKeyHash`) một chiều `[XÁC NHẬN: pom.xml:41-44, SecurityConfig.java:86-88]`. |
| 4 | `com.nimbusds:nimbus-jose-jwt` | `10.0.2` | Bảo mật JWT | Sinh, ký số (thuật toán HMAC-SHA512), mã hóa và phân tích cú pháp chuỗi JSON Web Token (Access Token và Refresh Token) `[XÁC NHẬN: pom.xml:47-50, CustomJwtDecoder.java:23-26, AuthenticationService.java:18-20]`. |
| 5 | `org.springframework.boot:spring-boot-starter-data-mongodb` | Kế thừa từ Parent (3.5.8) | Truy cập Dữ liệu (Data Access) | Cung cấp Spring Data MongoDB, `MongoTemplate`, cơ chế ánh xạ Document, quản lý chỉ mục và tích hợp native **MongoDB TimeSeries Collections** `[XÁC NHẬN: pom.xml:53-55, TelemetryRecord.java:9-21]`. |
| 6 | `org.springframework.boot:spring-boot-starter-oauth2-resource-server` | Kế thừa từ Parent (3.5.8) | Bảo mật API (Resource Server) | Đóng vai trò bảo vệ tài nguyên API thông qua xác thực Bearer JWT token tự động kết hợp với `CustomJwtDecoder` `[XÁC NHẬN: pom.xml:58-60, SecurityConfig.java:63-68]`. |
| 7 | `org.springframework.boot:spring-boot-starter-actuator` | Kế thừa từ Parent (3.5.8) | Giám sát (Observability) | Mở các endpoint giám sát sức khỏe (`/actuator/health`), thông tin phần mềm (`/actuator/info`) và số liệu tài nguyên (`/actuator/metrics`) `[XÁC NHẬN: pom.xml:63-65, application.yaml:14-22]`. |
| 8 | `org.projectlombok:lombok` | `1.18.38` (Scope: provided) | Năng suất Lập trình | Tự động sinh mã phương thức getter/setter, builder, constructor và logger `@Slf4j` trong quá trình biên dịch `[XÁC NHẬN: pom.xml:68-72]`. |
| 9 | `org.mapstruct:mapstruct` | `1.5.5.Final` | Ánh xạ Dữ liệu (Mapping) | Tự động sinh mã nguồn chuyển đổi hiệu năng cao giữa Entity/Document và DTO compile-time `[XÁC NHẬN: pom.xml:75-78]`. |
| 10 | `com.bucket4j:bucket4j-core` | `8.10.1` | Giới hạn Tần suất (Rate Limiting) | Hiện thực thuật toán Token Bucket trong RAM nhằm chống tấn công vét cạn (brute-force) và từ chối dịch vụ (DoS) tại các endpoint xác thực nhạy cảm `[XÁC NHẬN: pom.xml:81-84, RateLimitFilter.java:8-10]`. |
| 11 | `com.github.ben-manes.caffeine:caffeine` | Kế thừa từ Parent (3.5.8) | Bộ đệm RAM (In-memory Caching) | Thư viện bộ nhớ đệm hiệu năng cao dựa trên thuật toán Window TinyLFU. Được ứng dụng trực tiếp tại 4 dịch vụ/bộ lọc trong hệ thống `[XÁC NHẬN: pom.xml:87-89]`. |
| 12 | `org.springframework.boot:spring-boot-starter-integration` | Kế thừa từ Parent (3.5.8) | Tích hợp Hệ thống (EIP) | Cung cấp nền tảng xử lý thông điệp hướng kênh (Message Channels, Adapters, Dispatchers) theo chuẩn Enterprise Integration Patterns `[XÁC NHẬN: pom.xml:92-94]`. |
| 13 | `org.springframework.integration:spring-integration-mqtt` | Kế thừa từ Parent (3.5.8) | Tiếp nhận IoT (MQTT Ingestion) | Cung cấp Message Producer Adapter (`MqttPahoMessageDrivenChannelAdapter`) để hứng luồng tin nhắn từ MQTT Broker đưa vào kênh ứng dụng nội bộ `[XÁC NHẬN: pom.xml:96-99, MqttConfig.java:13, 47-60]`. |
| 14 | `org.eclipse.paho:org.eclipse.paho.client.mqttv3` | `1.2.5` | MQTT Client Library | Client MQTT kết nối ở mức giao thức mạng TCP tới Mosquitto Broker theo chuẩn MQTT 3.1 / 3.1.1 `[XÁC NHẬN: pom.xml:102-105, MqttConfig.java:6, 27-39]`. |
| 15 | `org.springframework.boot:spring-boot-starter-websocket` | Kế thừa từ Parent (3.5.8) | Truyền phát Thời gian thực (Realtime) | Được khai báo nhằm phục vụ luồng đẩy dữ liệu realtime lên Web Dashboard `[XÁC NHẬN: pom.xml:108-111]`. Tuy nhiên mã nguồn Java hiện tại hoàn toàn chưa có cấu hình hay handler nào kích hoạt `[XÁC NHẬN: grep search; CHƯA RÕ: tính năng chưa hoàn thiện]`. |
| 16 | `org.springframework.boot:spring-boot-starter-test` | Kế thừa từ Parent (Scope: test) | Kiểm thử (Testing) | Cung cấp JUnit Jupiter (JUnit 5), Mockito, AssertJ và Spring Test Framework `[XÁC NHẬN: pom.xml:113-116]`. |

---

### 1.3. Phân tích Chi tiết 4 Nhóm Thư viện Trọng yếu

#### A. Thư viện IoT (Internet of Things)
- **Các thành phần:** `spring-boot-starter-integration`, `spring-integration-mqtt`, `org.eclipse.paho.client.mqttv3:1.2.5` `[XÁC NHẬN: pom.xml:92-105]`.
- **Cơ chế hoạt động:**
  - `DefaultMqttPahoClientFactory` thiết lập kết nối có xác thực (username/password), cấu hình `cleanSession = true`, tự động kết nối lại `automaticReconnect = true`, `keepAliveInterval = 30s`, và `connectionTimeout = 10s` `[XÁC NHẬN: MqttConfig.java:27-39]`.
  - `MqttPahoMessageDrivenChannelAdapter` lắng nghe đồng thời 2 topic: `devices/+/telemetry` và `devices/+/status` với mức chất lượng dịch vụ `QoS = 1` `[XÁC NHẬN: MqttConfig.java:47-60]`.
  - Kênh truyền tin `mqttInboundChannel` gắn kết với `ExecutorSubscribableChannel(Executors.newVirtualThreadPerTaskExecutor())` `[XÁC NHẬN: MqttConfig.java:42-44]`, đảm bảo mỗi thông điệp IoT được xử lý độc lập trên một Virtual Thread nhẹ, không gây chặn hay nghẽn Inbound Thread Pool khi hàng loạt trạm gửi tin cùng lúc `[SUY LUẬN]`.

#### B. Thư viện Chuỗi Thời Gian (TimeSeries)
- **Thư viện chuyên biệt ngoài:** Không có thư viện chuyên dụng ngoài (như InfluxDB Client hay TimescaleDB JDBC) trong `pom.xml` `[XÁC NHẬN: pom.xml:1-170]`.
- **Giải pháp tích hợp:** Dự án sử dụng trực tiếp **Native TimeSeries Collection** được hỗ trợ nguyên bản trong **Spring Data MongoDB 3.3+ / 4.x+** kết hợp với **MongoDB 8.0** `[XÁC NHẬN: pom.xml:53-56, docker-compose.yml:5]`.
- **Ánh xạ thực thể:** Thực thể `TelemetryRecord.java` sử dụng annotation `@TimeSeries(collection = "telemetry_records", timeField = "timestamp", metaField = "metadata", granularity = Granularity.SECONDS)` `[XÁC NHẬN: TelemetryRecord.java:16-21]`.
- **Tối ưu hóa truy vấn:** Khai báo chỉ mục phức hợp `@CompoundIndexes` gồm `{'metadata.deviceId': 1, 'timestamp': -1}` và `{'metadata.roomId': 1, 'timestamp': -1}` `[XÁC NHẬN: TelemetryRecord.java:22-25]` cùng chỉ mục vòng đời `@Indexed(expireAfterSeconds = 7776000)` (90 ngày) `[XÁC NHẬN: TelemetryRecord.java:33, 38]`.

#### C. Thư viện Bộ đệm (Caching)
- **Thư viện nền:** `com.github.ben-manes.caffeine:caffeine` `[XÁC NHẬN: pom.xml:87-89]`.
- **Mô hình triển khai:** Không khai báo `spring-boot-starter-cache` và không dùng cơ chế trừu tượng `@Cacheable` của Spring Framework `[XÁC NHẬN: pom.xml]`. Thay vào đó, Caffeine được khởi tạo trực tiếp qua Java API với các chính sách kiểm soát bộ nhớ cục bộ tường minh tại 4 vị trí then chốt:
  1. `RateLimitFilter.java:39-42`: Quản lý 10,000 buckets theo IP/Path (`expireAfterAccess = 10m`).
  2. `TelemetrySanitizerService.java:41-44`: Quản lý 50,000 entries số đo cảm biến phục vụ cơ chế bù lấp dữ liệu (`expireAfterAccess = 10m`).
  3. `MqttMessageDispatcherService.java:51-54`: Quản lý 10,000 mốc cập nhật sống còn của thiết bị (`expireAfterWrite = 30s`).
  4. `ComfortScoreService.java:40-43`: Quản lý 1,000 phân loại phòng `RoomType` (`expireAfterWrite = 10m`).

#### D. Thư viện Khả năng Chịu lỗi & Độ bền vững (Resilience)
- **Thư viện chuyên biệt ngoài:** Không có `resilience4j-spring-boot3` hay `spring-retry` trong `pom.xml` `[XÁC NHẬN: pom.xml]`.
- **Giải pháp kiến trúc nội tại thay thế:**
  - *Cô lập luồng bằng Virtual Threads:* Java 21 `VirtualThreadPerTaskExecutor` giải phóng giới hạn pool cố định, ngăn chặn hiện tượng kiệt quệ tài nguyên luồng khi có đột biến lưu lượng (Burst Ingestion) `[XÁC NHẬN: MqttConfig.java:43]`.
  - *Cách ly lỗi xử lý cục bộ:* Toàn bộ pipeline trong `MqttMessageDispatcherService.java` được bao bọc trong các khối `try - catch` độc lập `[XÁC NHẬN: dòng 90-93, 136-138, 211-213]`. Một gói tin hỏng định dạng hoặc lỗi DB sẽ chỉ ghi log cảnh báo và giải phóng Virtual Thread đó, tuyệt đối không làm dừng vòng lặp nhận tin của Inbound Adapter `[SUY LUẬN]`.
  - *Chống khuếch đại ghi (Write Amplification Throttling):* `lastSeenThrottleCache` (30 giây) giới hạn việc cập nhật `lastSeenAt` vào CSDL `[XÁC NHẬN: MqttMessageDispatcherService.java:166-175]`.
  - *Lọc bản ghi rỗng (Empty Record Filtering):* Phương thức `isEmptyMetrics()` chủ động loại bỏ các bản tin không có số liệu hợp lệ trước khi ghi vào CSDL `[XÁC NHẬN: MqttMessageDispatcherService.java:181-185, 243-250]`.
  - *Chống quá tải API xác thực:* `RateLimitFilter` từ chối ngay lập tức (HTTP 429) các yêu cầu vượt ngưỡng `[XÁC NHẬN: RateLimitFilter.java:72-91]`.

---

## 2. PHÂN TÍCH CẤU HÌNH ỨNG DỤNG (`application.yaml`)

### 2.1. Cấu trúc Tệp Cấu hình và Hồ sơ Môi trường (Profiles)
- **Tệp cấu hình duy nhất:** `src/main/resources/application.yaml` (tổng cộng 45 dòng) `[XÁC NHẬN: application.yaml:1-45]`.
- **Khảo sát tệp bổ sung:**
  - Trong toàn bộ cây thư mục không tồn tại bất kỳ tệp `.properties` nào `[XÁC NHẬN: tìm kiếm *.properties]`.
  - Không có các tệp profile riêng rẽ như `application-dev.yaml`, `application-prod.yaml`, hay `application-test.yaml` `[XÁC NHẬN: tìm kiếm *.yaml]`.
- **Cơ chế phân tách môi trường:**
  - Ứng dụng hiện vận hành dựa trên cơ chế nạp giá trị mặc định (Fallback defaults) và ghi đè qua biến môi trường của hệ thống theo nguyên tắc **12-Factor App** `[XÁC NHẬN: application.yaml:1-44]`.
  - **Quy tắc Fail-Fast Production (BR-IAM-12):** Lớp `ApplicationInitConfig.java` kiểm tra profile đang kích hoạt thông qua `environment.getActiveProfiles()` `[XÁC NHẬN: ApplicationInitConfig.java:210-219]`. Nếu phát hiện profile `"prod"` hoặc `"production"` mà biến `INITIAL_ADMIN_PASSWORD` bị bỏ trống, ứng dụng sẽ ném ngoại lệ `IllegalStateException` và **hủy quá trình khởi động ngay lập tức** nhằm triệt tiêu nguy cơ chạy ứng dụng trên môi trường thực tế với tài khoản quản trị mặc định hoặc mật khẩu ngẫu nhiên không được kiểm soát `[XÁC NHẬN: ApplicationInitConfig.java:218-219]`.

---

### 2.2. Ma trận Toàn bộ Biến Môi trường & Thiết lập Hạ tầng

> [!CAUTION]
> **Tuân thủ Tuyệt đối Quy tắc Bảo mật Thông tin:** Toàn bộ các giá trị mật khẩu, khóa ký số và chuỗi xác thực nhạy cảm trong bảng bên dưới đã được che dấu bằng ký hiệu `***`.

| Nhóm Cấu hình | Khóa Cấu hình Spring (`application.yaml`) | Biến Môi trường Tương ứng | Giá trị Mặc định (Local/Dev) | Mức độ Nhạy cảm | Ý nghĩa Kỹ thuật & Hạ tầng |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Ứng dụng** | `spring.application.name` | N/A | `AIoTLibTQB` | Thấp | Tên định danh của ứng dụng Spring Boot `[XÁC NHẬN: application.yaml:3]`. |
| **Cơ sở dữ liệu**| `spring.data.mongodb.uri` | `MONGO_URI` | `mongodb://root:***@localhost:27017/aiot_identity_db?authSource=admin` | **Rất cao** | Chuỗi URI kết nối CSDL MongoDB 8.0 kèm thông tin xác thực quyền root `[XÁC NHẬN: application.yaml:7]`. |
| **Cơ sở dữ liệu**| `spring.data.mongodb.auto-index-creation` | N/A | `true` | Trung bình | Cho phép Spring Data tự động tạo chỉ mục và TimeSeries collections khi khởi động `[XÁC NHẬN: application.yaml:8]`. |
| **Máy chủ Web** | `server.address` | N/A | `0.0.0.0` | Thấp | Lắng nghe trên mọi giao diện mạng của host/container `[XÁC NHẬN: application.yaml:11]`. |
| **Máy chủ Web** | `server.port` | N/A | `8080` | Thấp | Cổng HTTP tiếp nhận các yêu cầu REST API `[XÁC NHẬN: application.yaml:12]`. |
| **Giám sát** | `management.endpoints.web.exposure.include` | N/A | `health,info,metrics` | Thấp | Danh sách các module Actuator được mở qua giao thức HTTP `[XÁC NHẬN: application.yaml:18]`. |
| **Giám sát** | `management.endpoint.health.show-details` | N/A | `when_authorized` | Trung bình | Chỉ hiển thị chi tiết trạng thái CSDL/Disk khi người gọi đã được xác thực `[XÁC NHẬN: application.yaml:21]`. |
| **Bảo mật JWT** | `jwt.secret-key` | `JWT_SECRET` | `***` *(Chuỗi HMAC 64 ký tự mẫu dev)* | **Tuyệt mật** | Khóa đối xứng dùng cho thuật toán ký HMAC-SHA512 `[XÁC NHẬN: application.yaml:24, CustomJwtDecoder.java:23]`. |
| **Bảo mật JWT** | `jwt.expiration-hours` | `JWT_EXPIRATION_HOURS` | `1` | Trung bình | Thời gian có hiệu lực của Access Token (1 giờ) `[XÁC NHẬN: application.yaml:25]`. |
| **Bảo mật JWT** | `jwt.refreshable-hours`| `JWT_REFRESHABLE_HOURS`| `24` | Trung bình | Cửa sổ tối đa cho phép làm mới phiên làm việc qua Refresh Token (24 giờ) `[XÁC NHẬN: application.yaml:26]`. |
| **Bảo mật JWT** | `jwt.issuer` | `JWT_ISSUER` | `AIoTLibTQB.com` | Thấp | Định danh đơn vị phát hành token (Claim `iss`) `[XÁC NHẬN: application.yaml:27]`. |
| **Chia sẻ CORS**| `cors.allowed-origins` | `CORS_ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:8081` | Trung bình | Danh sách nguồn gốc (Origins) được phép gọi API (Web Dashboard, Mongo Express) `[XÁC NHẬN: application.yaml:30, SecurityConfig.java:93]`. |
| **MQTT Broker** | `mqtt.broker-url` | `MQTT_BROKER_URL` | `tcp://localhost:1883` | Trung bình | Địa chỉ TCP máy chủ Mosquitto Broker trung gian `[XÁC NHẬN: application.yaml:33, MqttProperties.java:15]`. |
| **MQTT Broker** | `mqtt.client-id` | `MQTT_CLIENT_ID` | `aiot_backend_consumer` | Thấp | Mã Client ID của backend khi đăng ký phiên vào Mosquitto `[XÁC NHẬN: application.yaml:34, MqttProperties.java:16]`. |
| **MQTT Broker** | `mqtt.username` | `MQTT_USERNAME` | `aiot_backend` | Cao | Tên tài khoản dịch vụ backend đăng nhập Broker `[XÁC NHẬN: application.yaml:35, MqttProperties.java:17]`. |
| **MQTT Broker** | `mqtt.password` | `MQTT_PASSWORD` | `***` | **Cao** | Mật khẩu xác thực của tài khoản `aiot_backend` `[XÁC NHẬN: application.yaml:36, MqttProperties.java:18]`. |
| **MQTT Broker** | `mqtt.default-telemetry-topic` | `MQTT_TELEMETRY_TOPIC` | `devices/+/telemetry` | Thấp | Topic đăng ký tiếp nhận dữ liệu cảm biến (Wildcard cấp đơn) `[XÁC NHẬN: application.yaml:37]`. |
| **MQTT Broker** | `mqtt.default-status-topic` | `MQTT_STATUS_TOPIC` | `devices/+/status` | Thấp | Topic tiếp nhận bản tin trạng thái sống còn và di chúc LWT `[XÁC NHẬN: application.yaml:38]`. |
| **Khởi tạo Hệ thống** | `app.security.initial-admin-password` | `INITIAL_ADMIN_PASSWORD`| `***` *(Rỗng mặc định)* | **Tuyệt mật** | Mật khẩu khởi tạo cho tài khoản `admin`. Nếu rỗng trong môi trường dev sẽ sinh ngẫu nhiên 16 ký tự `[XÁC NHẬN: application.yaml:42, ApplicationInitConfig.java:190-236]`. |

---

### 2.3. Cấu hình CORS và An ninh Mạng
- **Chi tiết cấu hình trong `SecurityConfig.java:91-101` `[XÁC NHẬN]`:**
  - Danh sách Origin cho phép: Nạp trực tiếp từ thuộc tính `cors.allowed-origins` (`http://localhost:3000`, `http://localhost:8081`).
  - Danh sách Method cho phép: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`.
  - Danh sách Header cho phép: `Authorization`, `Content-Type`.
  - Cho phép thông tin xác thực (`allowCredentials`): `true` (Hỗ trợ trình duyệt gửi kèm cookie / authorization header khi gọi API).
  - Ánh xạ đường dẫn: Áp dụng cho toàn bộ endpoints `/**`.

---

## 3. KHẢO SÁT CƠ SỞ DỮ LIỆU & HẠ TẦNG ẢO HÓA (DATABASE & INFRASTRUCTURE)

### 3.1. Danh mục và Cấu trúc 8 MongoDB Collections

Dự án sử dụng cơ sở dữ liệu **MongoDB 8.0** (`aiot_identity_db`). Toàn bộ 8 collections trong hệ thống được khảo sát chi tiết như sau `[XÁC NHẬN: document/*.java]`:

```mermaid
classDiagram
    class User {
        +String id (PK)
        +String username (Unique)
        +String password (BCrypt)
        +boolean isActive
        +Set~Role~ roles
        +Set~String~ assignedZones
    }
    class Role {
        +String name (PK)
        +String description
        +Set~Permission~ permissions
    }
    class Permission {
        +String name (PK)
        +String description
    }
    class Device {
        +String id (PK)
        +String hardwareId (Unique)
        +String apiKeyHash
        +String roomId (FK)
        +Instant lastSeenAt
        +String connectionState
    }
    class Room {
        +String id (PK)
        +String code (Unique)
        +Integer floor
        +List~Point2D~ boundaryPolygon
        +RoomType type
    }
    class TelemetryRecord {
        <<TimeSeries>>
        +Instant timestamp (timeField, TTL 90d)
        +TelemetryMetadata metadata (metaField)
        +AcousticMetrics acoustics
        +AirQualityMetrics airQuality
        +EnvironmentMetrics environment
        +ComfortScoreRecord comfortScore
    }
    class Alert {
        +String id (PK)
        +String deviceId (Indexed)
        +String roomId (Indexed)
        +AlertType type
        +AlertStatus status
        +Double currentValue
        +Double threshold
    }
    class InvalidatedToken {
        +String id (PK, JTI)
        +Date expiryTime (TTL expireAfter=0s)
    }

    User *-- Role
    Role *-- Permission
    Room "1" <-- "N" Device : roomId
    Device "1" <-- "N" TelemetryRecord : metadata.deviceId
    Room "1" <-- "N" TelemetryRecord : metadata.roomId
    Device "1" <-- "N" Alert : deviceId
    Room "1" <-- "N" Alert : roomId
```

#### Chi tiết cấu hình từng Collection:
1. **`telemetry_records` (Native TimeSeries Collection)** `[XÁC NHẬN: TelemetryRecord.java:15-52]`:
   - Phân loại: **MongoDB Native TimeSeries Collection** (ra mắt từ MongoDB 5.0, tối ưu hóa lưu trữ dạng nén cột và bucket thời gian).
   - Tham số cấu hình `@TimeSeries`:
     - `collection`: `"telemetry_records"`
     - `timeField`: `"timestamp"` (Kiểu `java.time.Instant`)
     - `metaField`: `"metadata"` (Kiểu `TelemetryMetadata` gồm `deviceId`, `hardwareId`, `roomId`)
     - `granularity`: `Granularity.SECONDS` (Phù hợp với tần suất gửi bản tin cảm biến từ 5 đến 30 giây/lần).
   - Các chỉ mục bổ trợ `@CompoundIndexes`:
     - `@CompoundIndex(name = "telemetry_device_time_idx", def = "{'metadata.deviceId': 1, 'timestamp': -1}")`: Tối ưu hóa truy vấn lịch sử theo trạm đo `[XÁC NHẬN: dòng 23]`.
     - `@CompoundIndex(name = "telemetry_room_time_idx", def = "{'metadata.roomId': 1, 'timestamp': -1}")`: Tối ưu hóa truy vấn dữ liệu vi khí hậu theo phòng đọc `[XÁC NHẬN: dòng 24]`.
   - Cơ chế thu hồi dữ liệu quá hạn (TTL Data Retention):
     - `@Indexed(expireAfterSeconds = 7776000)` gắn trên trường `timestamp` `[XÁC NHẬN: dòng 38]`.
     - Thời gian lưu trữ: Đúng **90 ngày** (`90 * 24 * 3600 = 7,776,000` giây) theo quy định lưu trữ dữ liệu lịch sử quan trắc.
2. **`devices` (Collection thường)** `[XÁC NHẬN: Device.java:13-59]`:
   - Chỉ mục duy nhất: `@Indexed(unique = true)` trên trường `hardwareId` (Địa chỉ MAC hoặc chuỗi định danh chip vật lý).
   - Theo dõi kiểm toán (Auditing): `@CreatedDate Instant createdAt` và `@LastModifiedDate Instant updatedAt`.
   - Lưu trữ trạng thái hoạt động: `apiKeyHash` (mật khẩu xác thực băm BCrypt), `connectionState` (`ONLINE`/`OFFLINE`), `lastSeenAt`, `lastOfflineAt`, tọa độ bố trí phẳng `posX`, `posY` $\in [0.0, 1.0]$.
3. **`rooms` (Collection thường)** `[XÁC NHẬN: Room.java:15-50]`:
   - Chỉ mục duy nhất: `@Indexed(unique = true)` trên mã phòng `code` (ví dụ: `ROOM_101`).
   - Quản lý không gian: Tầng lầu `floor`, sức chứa `capacity`, phân loại phòng `type` (`STUDY_ROOM`, `MEETING_ROOM`, `SILENT_ZONE`, `CORRIDOR`), điểm tiện nghi mục tiêu `targetComfortScore`, và danh sách tọa độ ranh giới `boundaryPolygon` (`List<Point2D>`).
4. **`alerts` (Collection thường)** `[XÁC NHẬN: Alert.java:14-52]`:
   - Chỉ mục tìm kiếm: `@Indexed` đơn trên `deviceId` và `@Indexed` đơn trên `roomId`.
   - Dữ liệu sự cố: Phân loại cảnh báo `type` (`AlertType`), trạng thái vòng đời `status` (`AlertStatus`), giá trị thực đo `currentValue`, ngưỡng cài đặt `threshold`, dấu thời gian `startedAt`, `acknowledgedAt`, `resolvedAt`, và tài khoản xử lý `acknowledgedBy`.
5. **`users` (Collection thường)** `[XÁC NHẬN: User.java:15-48]`:
   - Chỉ mục duy nhất: `@Indexed(unique = true)` trên tên đăng nhập `username`.
   - Nhúng dữ liệu (Embedded Structure): Nhúng trực tiếp mảng các đối tượng vai trò `Set<Role> roles` và danh sách vùng quản lý `Set<String> assignedZones`.
6. **`roles` (Collection thường)** `[XÁC NHẬN: Role.java:11-27]`:
   - Khóa chính: `@Id String name` (Tên vai trò in hoa: `ADMIN`, `LIBRARIAN`, `ZONE_MANAGER`, `MAINTENANCE`, `VIEWER`, `USER`, `DEVICE`).
   - Nhúng dữ liệu: `Set<Permission> permissions`.
7. **`permissions` (Collection thường)** `[XÁC NHẬN: Permission.java:8-21]`:
   - Khóa chính: `@Id String name` (Tên quyền nguyên tử: `READ_SENSOR_DATA`, `WRITE_SENSOR_DATA`, `MANAGE_DEVICES`,...).
8. **`invalidated_tokens` (Collection thường)** `[XÁC NHẬN: InvalidatedToken.java:11-25]`:
   - Khóa chính: `@Id String id` (Chuỗi UUID biểu diễn JWT ID - claim `jti` của token bị thu hồi).
   - Chỉ mục TTL tự động xóa: `@Indexed(expireAfter = "0s") Date expiryTime`. MongoDB sẽ tự động giải phóng bản ghi ngay khi thời điểm hết hạn của token trôi qua.

---

### 3.2. Cơ chế Khởi tạo, Di chuyển Dữ liệu (Migration & Seeding)
- **Công cụ Migration Schema:**
  - Không sử dụng các công cụ quản lý phiên bản CSDL như Mongock, Liquibase MongoDB, hay Flyway `[XÁC NHẬN: pom.xml]`.
  - Cấu hình kiến tạo chỉ mục: Phụ thuộc vào thuộc tính `spring.data.mongodb.auto-index-creation: true` trong `application.yaml:8` `[XÁC NHẬN]`. Khi ứng dụng Spring Boot khởi chạy, Spring Data sẽ quét toàn bộ các annotation `@Indexed`, `@CompoundIndexes`, và `@TimeSeries` để phát lệnh khởi tạo chỉ mục tương ứng lên cụm MongoDB.
- **Cơ chế Khởi tạo Dữ liệu Hạt giống (Data Seeding):**
  - Thực hiện thông qua bean `ApplicationRunner applicationRunner()` tại `ApplicationInitConfig.java:37-240` `[XÁC NHẬN]`.
  - **14 Permissions chuẩn hóa:** Tự động tạo nếu chưa tồn tại (`READ_SENSOR_DATA`, `READ_SENSOR_DETAIL`, `WRITE_SENSOR_DATA`, `VIEW_ALERTS`, `ACKNOWLEDGE_ALERT`, `MANAGE_ALERT_CONFIG`, `MANAGE_DEVICES`, `VIEW_DEVICE_STATUS`, `MANAGE_ZONES`, `VIEW_ZONE_SUMMARY`, `GENERATE_REPORT`, `VIEW_ANALYTICS`, `MANAGE_USERS`, `MANAGE_ROLES`) `[XÁC NHẬN: dòng 42-88]`.
  - **7 Roles chuẩn hóa:** Đồng bộ và cập nhật quyền hạn tương ứng cho từng vai trò (`ADMIN`, `LIBRARIAN`, `ZONE_MANAGER`, `MAINTENANCE`, `VIEWER`, `USER`, `DEVICE`) `[XÁC NHẬN: dòng 101-177]`.
  - **Tài khoản quản trị `admin`:**
    - Nếu đã tồn tại: Đồng bộ lại quyền hạn tối cao của vai trò `ADMIN` `[XÁC NHẬN: dòng 182-188]`.
    - Nếu chưa tồn tại: Nạp mật khẩu từ biến môi trường `INITIAL_ADMIN_PASSWORD` hoặc thuộc tính `app.security.initial-admin-password`. Nếu profile là `prod` mà không có mật khẩu, ứng dụng lập tức ném lỗi dừng hoạt động `[XÁC NHẬN: dòng 210-219]`. Nếu ở môi trường dev/local, hàm `generateSecurePassword(16)` sẽ tự động sinh mật khẩu ngẫu nhiên 16 ký tự an toàn và in ra màn hình cảnh báo `[XÁC NHẬN: dòng 221-236]`.
- **Dọn dẹp Token thu hồi phụ trợ:**
  - Tiến trình nền `@Scheduled(cron = "0 0 2 * * ?")` chạy vào lúc 02:00 AM hàng ngày gọi `invalidatedTokenRepository.deleteByExpiryTimeBefore(new Date())` `[XÁC NHẬN: AuthenticationService.java:238-242]` nhằm đảm bảo dọn sạch các bản ghi rác nếu tiến trình nền TTL nội tại của MongoDB bị trễ do quá tải `[SUY LUẬN]`.

---

### 3.3. Hạ tầng Ảo hóa Container (`docker-compose.yml`)

Toàn bộ hạ tầng phụ trợ được định nghĩa trong `docker-compose.yml` (71 dòng) `[XÁC NHẬN: docker-compose.yml:1-71]`:

```mermaid
flowchart LR
    subgraph HostNetwork["Docker Network: aiot_network (Bridge)"]
        Mongo["aiot_mongodb\nImage: mongo:8.0\nPort: 27017:27017\nVolume: aiot_mongo_data\nHealthcheck: mongosh ping"]
        Express["aiot_mongo_express\nImage: mongo-express:1.0.2\nPort: 8081:8081\nDepends on: mongodb (healthy)"]
        Mosq["aiot_mosquitto\nImage: eclipse-mosquitto:2.0\nPort: 1883:1883\nVolumes: config, data, log"]
    end

    App["AIoTLibTQB Spring Boot (Host OS)\nPort: 8080"] -->|TCP 27017| Mongo
    App -->|TCP 1883| Mosq
    Express -.->|Tra cứu Web UI| Mongo
```

#### Phân tích chi tiết 3 dịch vụ Container:
1. **Dịch vụ `mongodb` (`aiot_mongodb`)** `[XÁC NHẬN: docker-compose.yml:4-24]`:
   - Image: `mongo:8.0`.
   - Cổng mạng: Ánh xạ cổng host `27017:27017`.
   - Biến môi trường: `MONGO_INITDB_ROOT_USERNAME: root`, `MONGO_INITDB_ROOT_PASSWORD: ***`, `MONGO_INITDB_DATABASE: aiot_identity_db`.
   - Lưu trữ bền vững: Ánh xạ volume định danh `aiot_mongo_data` vào `/data/db`.
   - Kiểm tra sức khỏe (Healthcheck):
     - Lệnh kiểm tra: `["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]`.
     - Tần suất: `interval: 10s`, `timeout: 5s`, `retries: 5`, `start_period: 10s`. Đảm bảo báo hiệu chính xác khi MongoDB đã sẵn sàng chấp nhận kết nối mạng.
2. **Dịch vụ `mongo-express` (`aiot_mongo_express`)** `[XÁC NHẬN: docker-compose.yml:25-42]`:
   - Image: `mongo-express:1.0.2`.
   - Cổng mạng: Ánh xạ cổng host `8081:8081` cung cấp giao diện Web UI trực quan cho đội ngũ phát triển/vận hành.
   - Cơ chế phụ thuộc: `depends_on: mongodb: condition: service_healthy`. Chỉ khởi động sau khi dịch vụ MongoDB vượt qua bài kiểm tra ping.
   - Xác thực: Xác thực kết nối DB bằng quyền root `root:***` và bảo vệ Web UI bằng xác thực Basic Auth `admin:***`.
3. **Dịch vụ `mosquitto` (`aiot_mosquitto`)** `[XÁC NHẬN: docker-compose.yml:43-57]`:
   - Image: `eclipse-mosquitto:2.0`.
   - Cổng mạng: Ánh xạ cổng TCP `1883:1883`. Cổng WebSocket (9001) **chưa được ánh xạ** `[XÁC NHẬN: docker-compose.yml:47-48]`.
   - Ánh xạ cấu hình (Read-only Volumes):
     - `./mosquitto/config/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro`
     - `./mosquitto/config/password.txt:/mosquitto/config/password.txt:ro`
     - `./mosquitto/config/acl.conf:/mosquitto/config/acl.conf:ro`
   - Lưu trữ bền vững: Gắn `aiot_mosquitto_data` vào `/mosquitto/data` và `aiot_mosquitto_log` vào `/mosquitto/log`.
4. **Mạng và Volumes:**
   - Mạng ảo: `aiot_network` (driver `bridge`) `[XÁC NHẬN: docker-compose.yml:67-70]`.
   - Volumes định danh: `aiot_mongo_data`, `aiot_mosquitto_data`, `aiot_mosquitto_log` `[XÁC NHẬN: docker-compose.yml:58-65]`.

#### Đánh giá Khuyết thiếu Hạ tầng Trọng yếu:
- **Chưa container hóa Ứng dụng Backend:** Ứng dụng Spring Boot `AIoTLibTQB` hoàn toàn không có định nghĩa dịch vụ trong `docker-compose.yml` `[XÁC NHẬN]`.
- **Không có `Dockerfile`:** Trong toàn bộ thư mục dự án không tồn tại tệp `Dockerfile` để đóng gói bản phát hành JAR thành Docker image `[XÁC NHẬN: tìm kiếm *docker*]`.

---

### 3.4. Khảo sát CI/CD Pipelines
- **Hiện trạng:** Rà soát toàn bộ cây thư mục gốc và các thư mục ẩn không tìm thấy bất kỳ cấu hình CI/CD nào:
  - Không có thư mục `.github/workflows/` (GitHub Actions) `[XÁC NHẬN]`.
  - Không có tệp `.gitlab-ci.yml` (GitLab CI) `[XÁC NHẬN]`.
  - Không có tệp `Jenkinsfile` (Jenkins Pipeline) `[XÁC NHẬN]`.
  - Không có cấu hình Azure DevOps hay CircleCI `[XÁC NHẬN]`.
- **Kết luận:** Dự án hiện tại đang ở trạng thái **chưa thiết lập quy trình tự động hóa CI/CD** (Build, Test, Image Packaging, Scan, Deploy) `[XÁC NHẬN]`.

---

## 4. TÍCH HỢP NGOẠI VI (EXTERNAL INTEGRATIONS)

### 4.1. Máy Chủ Tiếp Vận Tin Nhắn Mosquitto MQTT Broker

Cấu hình máy chủ Mosquitto Broker tại thư mục `mosquitto/config/` bao gồm 3 tệp độc lập `[XÁC NHẬN: mosquitto/config/*]`:

#### A. Tệp cấu hình máy chủ `mosquitto/config/mosquitto.conf` (15 dòng) `[XÁC NHẬN]`
- Lắng nghe mạng: `listener 1883 0.0.0.0` (Lắng nghe toàn bộ giao diện mạng trên cổng chuẩn 1883).
- Lưu trữ bền vững (Persistence): `persistence true`, ghi dữ liệu hàng đợi vào `/mosquitto/data/`.
- Cấu hình ghi log: `log_dest stdout`, hiển thị các mức `error`, `warning`, `notice`, `information`.
- Chính sách an ninh mạng:
  - `allow_anonymous false`: Cấm tuyệt đối các kết nối nặc danh không có thông tin định danh `[XÁC NHẬN: dòng 14]`.
  - `password_file /mosquitto/config/password.txt`: Tệp mật khẩu tài khoản.
  - `acl_file /mosquitto/config/acl.conf`: Tệp quy tắc phân quyền truy cập kênh truyền.

#### B. Phân quyền kênh truyền `mosquitto/config/acl.conf` (14 dòng) `[XÁC NHẬN]`
- **Tài khoản dịch vụ Backend (`aiot_backend`):** `topic readwrite #` (Toàn quyền đọc và ghi trên toàn bộ không gian topic).
- **Tài khoản quản trị (`admin`):** `topic readwrite #` (Toàn quyền quản trị, kiểm thử và theo dõi).
- **Phân quyền động cho Trạm cảm biến IoT (`%u`):**
  - `pattern write devices/%u/#`: Trạm chỉ được quyền xuất bản (PUBLISH) dữ liệu vào các topic con thuộc mã trạm của chính nó (ví dụ: `devices/ESP32_ROOM_101/telemetry`, `devices/ESP32_ROOM_101/status`).
  - `pattern read devices/%u/command`: Trạm chỉ được phép đăng ký nhận (SUBSCRIBE) các bản tin lệnh điều khiển gửi riêng cho nó.
  - *Ý nghĩa an ninh:* Ngăn chặn triệt để nguy cơ trạm cảm biến bị xâm nhập nghe lén dữ liệu của phòng khác hoặc phát tán thông điệp giả mạo danh tính trạm khác vào hệ thống `[SUY LUẬN]`.

#### C. Tệp mật khẩu `mosquitto/config/password.txt` (4 dòng) `[XÁC NHẬN]`
Tệp lưu trữ thông tin xác thực sử dụng thuật toán mã hóa mật khẩu chuẩn của Mosquitto **SHA512-PBKDF2** (tiền tố định danh `$7$`):
1. `aiot_backend:$7$101$...***` (Tài khoản dịch vụ cho Spring Boot Backend kết nối).
2. `ESP32_ROOM_101:$7$101$...***` (Tài khoản mẫu cho trạm phần cứng phòng đọc 101).
3. `admin:$7$101$...***` (Tài khoản quản trị viên máy chủ MQTT).

---

### 4.2. Bộ Đệm Bộ Nhớ Cục Bộ (In-memory Caching - Caffeine)

Dự án áp dụng bộ đệm Caffeine tại **4 vị trí nghiệp vụ trọng yếu** nhằm bảo vệ cơ sở dữ liệu và nâng cao năng lực thông lượng `[XÁC NHẬN]`:

| Vị trí Mã nguồn (Class:Line) | Tên Biến Cache | Cấu hình Dung lượng & Hạn sống | Kiểu Dữ liệu Entry | Mục đích Nghiệp vụ & Kỹ thuật |
| :--- | :--- | :--- | :--- | :--- |
| `RateLimitFilter.java:39-42` | `ipBuckets` | `expireAfterAccess(10m)`<br>`maximumSize(10,000)` | `Key: String (ip:path)`<br>`Value: Bucket` | Lưu trạng thái Token Bucket theo từng địa chỉ IP máy khách và đường dẫn API, tự động dọn dẹp sau 10 phút không có truy cập `[XÁC NHẬN]`. |
| `TelemetrySanitizerService.java:41-44` | `fieldCache` | `expireAfterAccess(10m)`<br>`maximumSize(50,000)` | `Key: String (deviceId:field)`<br>`Value: TimestampedValue` | Lưu số đo cảm biến hợp lệ gần nhất trong cửa sổ 30 giây (`FORWARD_FILL_WINDOW`) để thực hiện bù lấp (forward-fill) các chỉ số bị mất nhịp đo tạm thời (ngoại trừ `noisePeak`) `[XÁC NHẬN: dòng 36-44]`. |
| `MqttMessageDispatcherService.java:51-54` | `lastSeenThrottleCache` | `expireAfterWrite(30s)`<br>`maximumSize(10,000)` | `Key: String (hardwareId)`<br>`Value: Instant` | Chống khuếch đại ghi (Write Amplification): Chỉ thực hiện cập nhật `lastSeenAt` và `connectionState = ONLINE` xuống collection `devices` nếu đã trôi qua hơn 30 giây kể từ lần ghi trước `[XÁC NHẬN: dòng 48-54, 166-175]`. |
| `ComfortScoreService.java:40-43` | `roomTypeCache` | `expireAfterWrite(10m)`<br>`maximumSize(1,000)` | `Key: String (roomId)`<br>`Value: RoomType` | Tra cứu phân loại phòng (`RoomType`) từ bộ đệm RAM để áp dụng trọng số tính điểm tiện nghi thư viện (LCS), tránh truy vấn lặp lại vào MongoDB trong quá trình ingestion dữ liệu tần suất cao `[XÁC NHẬN: dòng 40-55]`. |

> [!WARNING]
> **Điểm lệch chuẩn bộ đệm tại `DiscoveredDeviceService`:**  
> Khác với 4 vị trí trên, lớp `DiscoveredDeviceService.java:25` hiện đang sử dụng `Map<String, DiscoveredEntry> cache = new ConcurrentHashMap<>()` không giới hạn kích thước (Unbounded Map) `[XÁC NHẬN: DiscoveredDeviceService.java:25]`. Cơ chế hết hạn chỉ được kích hoạt thụ động khi người dùng gọi API `getDiscoveredDevices()` `[XÁC NHẬN: dòng 51-52]`. Nếu mạng xuất hiện tấn công broadcast liên tục với hàng chục nghìn `hardwareId` ngẫu nhiên, cấu trúc này có nguy cơ gây cạn kiệt bộ nhớ JVM Heap (Memory Leak / OutOfMemoryError) `[SUY LUẬN]`.

---

### 4.3. Giới Hạn Tần Suất Truy Cập (Rate Limiting - Bucket4j)

Cơ chế Rate Limiting được thiết lập chặt chẽ thông qua bộ lọc chuyên trách `RateLimitFilter.java` `[XÁC NHẬN: RateLimitFilter.java:1-116]`:
- **Vị trí trong chuỗi lọc an ninh:** Kế thừa `OncePerRequestFilter`, được đăng ký trước `UsernamePasswordAuthenticationFilter` trong `SecurityConfig.java:69` `[XÁC NHẬN]`.
- **Endpoints chịu sự kiểm soát:** Chỉ áp dụng cho các yêu cầu HTTP `POST` gửi tới 2 endpoint xác thực nhạy cảm `[XÁC NHẬN: dòng 34-37, 64-66]`:
  1. `POST /api/auth/login` (Đăng nhập tài khoản người dùng).
  2. `POST /api/v1/devices/authenticate` (Xác thực thiết bị IoT cấp JWT token).
- **Thuật toán và Băng thông Cấu hình:**
  - Khởi tạo Token Bucket: `Bandwidth.builder().capacity(10).refillGreedy(10, Duration.ofMinutes(1)).build()` `[XÁC NHẬN: dòng 47-51]`.
  - Dung lượng: Tối đa **10 token** trong bucket.
  - Tốc độ nạp: Nạp tham lam (Greedy Refill) **10 token mỗi 1 phút** (trung bình 1 token mỗi 6 giây).
- **Cơ chế Nhận diện IP Khách (Chống giả mạo IP Spoofing):**
  - Hàm `getClientIP(HttpServletRequest request)` chỉ tin cậy và đọc địa chỉ IP từ header `X-Forwarded-For` khi địa chỉ kết nối trực tiếp `remoteAddr` thuộc dải mạng proxy tin cậy (hàm `isTrustedProxy`) `[XÁC NHẬN: dòng 97-114]`.
  - Dải IP tin cậy: `127.0.0.1`, `0:0:0:0:0:0:0:1`, `10.*.*.*`, `192.168.*.*`, và `172.16.*.* - 172.31.*.*`.
- **Hành vi Xử lý Vi phạm Ngưỡng (HTTP 429):**
  - Khi bucket cạn token (`!probe.isConsumed()`), yêu cầu bị chặn lại ngay lập tức mà không chuyển tiếp vào bộ lọc bảo mật hoặc Controller `[XÁC NHẬN: dòng 73-91]`.
  - Thiết lập HTTP Status: `429 Too Many Requests`.
  - Header phản hồi: Bổ sung header `Retry-After: <số_giây_chờ_nạp>`.
  - Thân phản hồi JSON chuẩn hóa: Trả về đối tượng `ApiResponse` chứa mã lỗi và thông điệp từ `ErrorCode.TOO_MANY_REQUESTS` `[XÁC NHẬN: dòng 84-89]`.

---

### 4.4. Tích hợp API Bên Thứ Ba (Third-party APIs)

- **Khảo sát mã nguồn thực tế:**
  - Không có bất kỳ HTTP Client nào (không có bean `RestTemplate`, `WebClient`, `HttpClient`, hay `@FeignClient`) được khai báo hoặc cấu hình trong toàn bộ mã nguồn `src/main/java` `[XÁC NHẬN: grep search toàn bộ package]`.
  - Không có cấu hình dịch vụ gửi email (không có `spring-boot-starter-mail` hay cấu hình SMTP) `[XÁC NHẬN: pom.xml, application.yaml]`.
  - Không có cấu hình cổng SMS (SMS Gateway) hay dịch vụ đẩy thông báo di động qua đám mây (FCM, OneSignal) `[XÁC NHẬN: application.yaml]`.
- **Đối chiếu với Tài liệu Đặc tả Nghiệp vụ:**
  - Trong tài liệu đặc tả kiến trúc `IOT_SYSTEM_SPECIFICATION.md:153` và `docs/business/30_TICH_HOP_VA_TIEN_TRINH_NEN.md:167-169`, hệ thống đề xuất tích hợp với **Telegram Bot API** để gửi tin nhắn thông báo khẩn cấp (kèm mã phòng và giá trị đo vượt ngưỡng độ ồn/bụi mịn) đến điện thoại của lực lượng bảo vệ và thủ thư. Tuy nhiên, tính năng này **chưa hề được hiện thực trong mã nguồn** `[SUY LUẬN: tính năng chờ phát triển ở Phase 2]`.
- **Hiện trạng Thư viện WebSocket:**
  - Phụ thuộc `spring-boot-starter-websocket` đã được đưa vào `pom.xml:108-111` `[XÁC NHẬN]`.
  - Tuy nhiên, trong mã nguồn hoàn toàn chưa có lớp cấu hình WebSocket Message Broker (`@EnableWebSocketMessageBroker`), tệp đăng ký endpoint STOMP (`/ws-aiot`), hay bộ điều khiển tin nhắn `@MessageMapping` `[XÁC NHẬN: grep search; CHƯA RÕ: tính năng chưa được kích hoạt]`.

---

## 5. MỤC RIÊNG: CÂU HỎI MỞ (OPEN QUESTIONS)

Dưới đây là danh mục các câu hỏi mở và điểm khuyết thiếu kỹ thuật cần thống nhất với Tech Lead / Product Owner trước khi bước vào các giai đoạn phát triển tiếp theo:

### Câu hỏi 1: Đóng gói và Triển khai Container Ứng dụng Backend (Dockerfile)
- **Hiện trạng:** Tệp `docker-compose.yml` chỉ định nghĩa 3 container phụ trợ (`aiot_mongodb`, `aiot_mongo_express`, `aiot_mosquitto`). Dự án hiện chưa có tệp `Dockerfile` và chưa đưa backend Spring Boot vào điều phối chung `[XÁC NHẬN: docker-compose.yml:1-71]`.
- **Câu hỏi:** Đội ngũ DevOps dự kiến triển khai ứng dụng Backend trực tiếp dưới dạng tệp JAR trên máy chủ (systemd service) hay cần bổ sung tệp `Dockerfile` đa tầng (Multi-stage build trên Eclipse Temurin JDK 21 Alpine) và cấu hình service `aiot_backend` vào `docker-compose.yml`?

### Câu hỏi 2: Chiến lược Xây dựng Đường ống CI/CD Tự động hóa
- **Hiện trạng:** Toàn bộ kho mã nguồn chưa có bất kỳ tệp cấu hình pipeline nào (`.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`) `[XÁC NHẬN]`.
- **Câu hỏi:** Dự án sẽ ưu tiên thiết lập nền tảng CI/CD nào (GitHub Actions hay GitLab CI)? Pipeline giai đoạn đầu có yêu cầu tích hợp các bước: (1) Kiểm tra biên dịch `./mvnw clean test-compile`, (2) Chạy kiểm thử tự động `./mvnw test`, (3) Quét chất lượng mã nguồn qua SonarQube, và (4) Tự động build Docker Image đẩy lên Container Registry (Docker Hub / GHCR)?

### Câu hỏi 3: Kiểm soát An toàn Khởi tạo Native TimeSeries Collection trên Môi trường Production
- **Hiện trạng:** Collection `telemetry_records` phụ thuộc hoàn toàn vào cơ chế tự động của Spring Data thông qua cấu hình `spring.data.mongodb.auto-index-creation: true` và `@TimeSeries` `[XÁC NHẬN: application.yaml:8, TelemetryRecord.java:16-21]`.
- **Rủi ro kỹ thuật:** Theo tài liệu MongoDB, nếu trên database đã vô tình tồn tại một collection thông thường cùng tên `telemetry_records`, MongoDB sẽ không thể tự động chuyển đổi nó thành TimeSeries collection mà sẽ báo lỗi runtime khi insert. Ngoài ra, các thuộc tính của TimeSeries collection (như `granularity`, `timeField`) là bất biến sau khi tạo `[SUY LUẬN]`.
- **Câu hỏi:** Có nên bổ sung một bean `CommandLineRunner` hoặc migration script chủ động kiểm tra trạng thái collection tại thời điểm khởi động hệ thống (nếu chưa có thì phát lệnh `db.createCollection("telemetry_records", { timeseries: { timeField: "timestamp", metaField: "metadata", granularity: "seconds" } })`) thay vì chỉ phụ thuộc vào `auto-index-creation`?

### Câu hỏi 4: Chia tách Hồ sơ Cấu hình Môi trường (Multi-profile Configuration)
- **Hiện trạng:** Dự án chỉ sử dụng duy nhất một tệp `application.yaml`, chưa có các tệp phân tách môi trường (`application-dev.yaml`, `application-prod.yaml`, `application-test.yaml`) `[XÁC NHẬN]`.
- **Câu hỏi:** Đội ngũ phát triển có cần tái cấu trúc cấu hình thành mô hình đa profile để phân tách rõ ràng cấu hình CORS, log level, URL Broker nội bộ/ngoại vi, và các tham số kiểm thử không?

### Câu hỏi 5: Cơ chế Fail-Fast cho Khóa Bí mật (Secrets) trên Môi trường Production
- **Hiện trạng:** Lớp `ApplicationInitConfig.java:210-219` đã có cơ chế Fail-Fast xuất sắc ngăn chặn chạy profile `prod` nếu thiếu `INITIAL_ADMIN_PASSWORD` `[XÁC NHẬN]`. Tuy nhiên, các khóa bí mật cốt tử khác gồm `JWT_SECRET`, `MONGO_URI`, và `MQTT_PASSWORD` vẫn có giá trị mặc định (fallback defaults) trong `application.yaml` `[XÁC NHẬN: application.yaml:7, 24, 36]`. Nếu người vận hành quên khai báo biến môi trường trên production, hệ thống sẽ chạy với secret mặc định mà không đưa ra cảnh báo lỗi `[SUY LUẬN]`.
- **Câu hỏi:** Có cần bổ sung kiểm tra bắt buộc tương tự trong `ApplicationInitConfig.java` để từ chối khởi động trên môi trường `prod` nếu `JWT_SECRET` hoặc mật khẩu kết nối CSDL trùng khớp với giá trị mặc định của môi trường phát triển?

### Câu hỏi 6: Chuẩn hóa Bộ nhớ Đệm Thiết bị Chưa Đăng ký (`DiscoveredDeviceService`)
- **Hiện trạng:** `DiscoveredDeviceService.java:25` đang lưu trữ danh sách thiết bị phát hiện mới bằng `ConcurrentHashMap` vô hạn kích thước `[XÁC NHẬN]`.
- **Câu hỏi:** Có nên chuẩn hóa lớp này sang sử dụng Caffeine Cache có cấu hình `maximumSize(1,000)` và `expireAfterAccess(Duration.ofMinutes(10))` tương tự như `TelemetrySanitizerService` và `ComfortScoreService` để ngăn ngừa nguy cơ cạn kiệt bộ nhớ RAM khi có tấn công phát tán MAC giả mạo?

### Câu hỏi 7: Lựa chọn Kiến trúc Đẩy Dữ liệu Thời Gian Thực cho Giao diện Frontend
- **Hiện trạng:** Thư viện `spring-boot-starter-websocket` đã có sẵn trong `pom.xml:108-111` nhưng chưa được cấu hình `[XÁC NHẬN]`. Mosquitto Broker trong `docker-compose.yml:47-48` hiện chỉ mở cổng TCP 1883, chưa mở cổng WebSocket 9001 `[XÁC NHẬN]`.
- **Câu hỏi:** Định hướng kết nối dữ liệu realtime cho Web Dashboard Frontend trong Phase 2 sẽ theo mô hình nào:
  - *Mô hình A (Spring WebSocket STOMP):* Backend mở endpoint WebSocket `/ws-aiot` tại cổng HTTP 8080, nhận tin từ MQTT rồi chủ động lọc/throttle trước khi đẩy lên Frontend qua STOMP topic?
  - *Mô hình B (Direct MQTT over WebSocket):* Mosquitto Broker mở thêm cổng WebSocket 9001, Frontend kết nối trực tiếp vào Mosquitto bằng MQTT.js để subscribe các topic `devices/+/telemetry`?
