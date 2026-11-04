# HỒ SƠ CẤU HÌNH HỆ THỐNG VÀ HƯỚNG DẪN VẬN HÀNH (CONFIGURATION & OPERATIONS)

> **Thuộc tài liệu:** Bộ Tài liệu Nghiệp vụ AIoTLibTQB  
> **Tài liệu cha:** [00_TONG_QUAN.md](00_TONG_QUAN.md)  
> **Nhãn truy vết:**  
> - `[Code]`: Kiểm chứng trực tiếp từ mã nguồn thực tế backend Spring Boot.  
> - `[Tài liệu]`: Trích xuất từ tài liệu đặc tả dự án (`docker-compose.yml`, `application.yaml`).  
> - `[Suy luận]`: Phân tích nghiệp vụ và kiến trúc kỹ thuật.  
> - `[Chưa rõ]`: Điểm cần xác nhận thêm từ Product Owner.

---

## 1. HỒ SƠ BIẾN MÔI TRƯỜNG & THAM SỐ CẤU HÌNH (ENVIRONMENT VARIABLES)

Hệ thống AIoTLibTQB áp dụng nguyên lý **12-Factor App**, toàn bộ cấu hình quan trọng được ngoại hóa (Externalized Configuration) thông qua tệp `application.yaml` và nạp tự động từ biến môi trường của hệ điều hành / container `[Code: application.yaml:1-44]`.

> [!IMPORTANT]
> **Quy định An toàn Thông tin:** Bảng dưới đây chỉ liệt kê tên biến, giá trị mặc định cho môi trường phát triển (Dev/Local) và mục đích sử dụng. **Tuyệt đối không ghi các giá trị bí mật (Production Credentials)** vào tài liệu.

| Tên biến môi trường | Đường dẫn thuộc tính Spring | Giá trị mặc định (Local/Dev) | Ý nghĩa nghiệp vụ & Vận hành |
| :--- | :--- | :--- | :--- |
| `MONGO_URI` | `spring.data.mongodb.uri` | `mongodb://root:root@localhost:27017/aiot_identity_db?authSource=admin` | Chuỗi kết nối đến cụm CSDL MongoDB 8.0 `[Code: application.yaml:7]` |
| `JWT_SECRET` | `jwt.secret-key` | `Nfs1Gek0...` (Chuỗi 64 ký tự mẫu dev) | Khóa bí mật dùng để ký và xác thực chữ ký số HMAC-SHA512 cho Token JWT `[Code: application.yaml:24]` |
| `JWT_EXPIRATION_HOURS` | `jwt.expiration-hours` | `1` (giờ) | Thời gian sống của Access Token cấp cho người dùng `[Code: application.yaml:25]` |
| `JWT_REFRESHABLE_HOURS`| `jwt.refreshable-hours` | `24` (giờ) | Cửa sổ thời gian tối đa cho phép sử dụng Refresh Token để gia hạn phiên `[Code: application.yaml:26]` |
| `JWT_ISSUER` | `jwt.issuer` | `AIoTLibTQB.com` | Tên đơn vị phát hành token định danh (Claim `iss`) `[Code: application.yaml:27]` |
| `CORS_ALLOWED_ORIGINS` | `cors.allowed-origins` | `http://localhost:3000,http://localhost:8081` | Danh sách URL nguồn gốc của Web Dashboard được phép gọi API `[Code: application.yaml:30]` |
| `MQTT_BROKER_URL` | `mqtt.broker-url` | `tcp://localhost:1883` | Địa chỉ mạng TCP kết nối tới máy chủ MQTT Mosquitto `[Code: application.yaml:33]` |
| `MQTT_CLIENT_ID` | `mqtt.client-id` | `aiot_backend_consumer` | Mã Client ID của backend khi đăng ký kết nối vào Broker `[Code: application.yaml:34]` |
| `MQTT_USERNAME` | `mqtt.username` | `aiot_backend` | Tên tài khoản dịch vụ backend kết nối Broker `[Code: application.yaml:35]` |
| `MQTT_PASSWORD` | `mqtt.password` | `aiot_backend_secret` | Mật khẩu tài khoản dịch vụ backend kết nối Broker `[Code: application.yaml:36]` |
| `MQTT_TELEMETRY_TOPIC` | `mqtt.default-telemetry-topic`| `devices/+/telemetry` | Topic tiếp nhận luồng dữ liệu cảm biến (Wildcard cấp đơn) `[Code: application.yaml:37]` |
| `MQTT_STATUS_TOPIC` | `mqtt.default-status-topic` | `devices/+/status` | Topic tiếp nhận trạng thái sống còn và bản tin di chúc LWT `[Code: application.yaml:38]` |
| `INITIAL_ADMIN_PASSWORD`| `app.security.initial-admin-password`| Rỗng (Chỉ sinh ngẫu nhiên khi chạy dev) | Mật khẩu khởi tạo tài khoản `admin` lần đầu khi cài đặt hệ thống `[Code: application.yaml:42, ApplicationInitConfig.java:190-219]` |

---

## 2. KIẾN TRÚC HẠ TẦNG VÀ PHỤ THUỘC (CONTAINER INFRASTRUCTURE)

Hệ thống được đóng gói điều phối toàn bộ hạ tầng phụ trợ thông qua tệp `docker-compose.yml` `[Code: docker-compose.yml:1-71]`.

```mermaid
flowchart TD
    subgraph HostNetwork["Mạng Docker Nội Bộ: aiot_network (Bridge Driver)"]
        MongoDB["Dịch Vụ: mongodb (mongo:8.0)\nPort: 27017:27017\nVolume: aiot_mongo_data\nHealthcheck: mongosh ping"]
        MongoExpress["Dịch Vụ: mongo-express (1.0.2)\nPort: 8081:8081\nPhụ thuộc: mongodb (service_healthy)"]
        Mosquitto["Dịch Vụ: mosquitto (eclipse-mosquitto:2.0)\nPort: 1883:1883\nVolumes: config, data, log"]
    end

    subgraph BackendApp["Ứng Dụng Backend"]
        SpringApp["AIoTLibTQB (Spring Boot 3.5.8)\nPort: 8080 (0.0.0.0)"]
    end

    BackendApp -- "TCP 27017 (Mongo URI)" --> MongoDB
    BackendApp -- "TCP 1883 (MQTT Inbound)" --> Mosquitto
    MongoExpress -. "Web UI Quản Trị" .-> MongoDB
```

### 2.1. Chi tiết các Container Dịch Vụ
1. **Container `aiot_mongodb` (`mongo:8.0`):**
   - Lưu trữ toàn bộ dữ liệu người dùng, phân quyền, cấu hình trạm đo và **Native TimeSeries collection** `telemetry_records`.
   - **Healthcheck tích hợp:** Lệnh `CMD mongosh --eval "db.adminCommand('ping')"` chạy mỗi 10 giây (timeout 5s, 5 lần retry) để đảm bảo database sẵn sàng hoàn toàn trước khi các dịch vụ khác truy cập `[Code: docker-compose.yml:18-23]`.
   - Dữ liệu được lưu bền vững trên Docker Volume `aiot_mongo_data`.
2. **Container `aiot_mongo_express` (`mongo-express:1.0.2`):**
   - Giao diện web trực quan giúp đội ngũ vận hành tra cứu dữ liệu CSDL tại cổng `8081`.
   - Phụ thuộc trạng thái sức khỏe: `condition: service_healthy` từ container `mongodb`.
3. **Container `aiot_mosquitto` (`eclipse-mosquitto:2.0`):**
   - Đóng vai trò máy chủ tiếp vận tin nhắn MQTT trung gian giữa trạm phần cứng và Backend tại cổng `1883`.
   - Ánh xạ các tệp cấu hình bảo mật vào container:
     - `mosquitto.conf`: Cấu hình lắng nghe và tắt chế độ nặc danh (`allow_anonymous false`).
     - `password.txt`: Mật khẩu tài khoản hệ thống.
     - `acl.conf`: Danh sách phân quyền truy cập theo Topic.
   - Dữ liệu bền vững lưu trên `aiot_mosquitto_data`, nhật ký lưu trên `aiot_mosquitto_log`.

---

## 3. GIÁM SÁT VẬN HÀNH QUA SPRING BOOT ACTUATOR

Hệ thống tích hợp sẵn module giám sát chuẩn công nghiệp `spring-boot-starter-actuator` `[Code: pom.xml:63-66, application.yaml:14-22]`:

| Endpoint Actuator | Phương thức | Quyền truy cập | Ý nghĩa vận hành & Kiểm tra sức khỏe |
| :--- | :---: | :---: | :--- |
| `/actuator/health` | GET | **Công khai (Public)** `[Code: SecurityConfig.java:57]` | Kiểm tra trạng thái sống còn (Liveness & Readiness). Cấu hình `show-details: when_authorized` giúp ẩn thông tin nhạy cảm về CSDL với bên ngoài, chỉ hiển thị chi tiết khi có JWT hợp lệ `[Code: application.yaml:21]`. |
| `/actuator/info` | GET | **Công khai (Public)** `[Code: SecurityConfig.java:57]` | Cung cấp thông tin phiên bản phần mềm, mô tả ứng dụng. |
| `/actuator/metrics` | GET | **Yêu cầu Xác thực (Authenticated)** `[Code: SecurityConfig.java:61]` | Thu thập chỉ số tài nguyên thời gian thực: số lượng Virtual Threads, dung lượng bộ nhớ Heap JVM, tốc độ GC và lưu lượng HTTP. |

---

## 4. QUY TRÌNH TRIỂN KHAI VÀ KHỞI CHẠY HỆ THỐNG (DEPLOYMENT GUIDE)

### 4.1. Điều kiện Tiên Quyết (Prerequisites)
- Hệ điều hành: Linux (Ubuntu 22.04+ khuyến nghị) hoặc Windows Server / macOS.
- Môi trường thực thi: **Java Development Kit (JDK) 21** trở lên.
- Công cụ container: **Docker Engine 24.0+** và **Docker Compose v2.20+**.
- Công cụ build: Maven Wrapper (`./mvnw` hoặc `mvnw.cmd` có sẵn trong repository).

---

### 4.2. Hướng dẫn Khởi chạy Từng bước (Step-by-Step Execution)

#### Bước 1: Khởi động Hạ tầng Container (Database & MQTT Broker)
Mở terminal tại thư mục gốc của dự án và chạy lệnh:
```bash
docker compose up -d
```
Kiểm tra trạng thái sẵn sàng của các container:
```bash
docker compose ps
```
Đảm bảo container `aiot_mongodb` hiển thị trạng thái `(healthy)` và `aiot_mosquitto` đang lắng nghe tại cổng `1883`.

#### Bước 2: Thiết lập Biến Môi trường Khởi tạo Tài khoản Quản trị
Trước khi khởi động backend trên môi trường Production, bắt buộc phải khai báo biến `INITIAL_ADMIN_PASSWORD`:
- Trên Linux / macOS:
  ```bash
  export INITIAL_ADMIN_PASSWORD="YourStrongPassword@2026"
  export SPRING_PROFILES_ACTIVE="prod"
  ```
- Trên Windows (PowerShell):
  ```powershell
  $env:INITIAL_ADMIN_PASSWORD="YourStrongPassword@2026"
  $env:SPRING_PROFILES_ACTIVE="prod"
  ```

> [!CAUTION]
> **Quy tắc Fail-Fast Production (BR-IAM-12):** Nếu kích hoạt profile `prod` mà không cung cấp biến môi trường `INITIAL_ADMIN_PASSWORD`, ứng dụng sẽ ném ngoại lệ `IllegalStateException` và **tự động dừng khởi động ngay lập tức** nhằm triệt tiêu nguy cơ chạy ứng dụng trên môi trường thực tế với tài khoản quản trị không an toàn `[Code: ApplicationInitConfig.java:210-219]`.

#### Bước 3: Biên dịch và Khởi chạy Ứng dụng Backend
Chạy trực tiếp qua Maven Wrapper:
```bash
./mvnw spring-boot:run
```
Hoặc đóng gói thành file thực thi JAR:
```bash
./mvnw clean package -DskipTests
java -jar target/AIoTLibTQB-0.0.1-SNAPSHOT.jar
```

#### Bước 4: Kiểm tra Nhật ký Khởi động (Bootstrapping Verification)
Quan sát màn hình console hoặc file log:
- **Trên môi trường Dev/Local (nếu không set mật khẩu):** Ứng dụng sẽ tự động sinh ngẫu nhiên mật khẩu 16 ký tự và in ra màn hình dạng:
  ```text
  ================================================================================
   [SECURITY WARNING] No INITIAL_ADMIN_PASSWORD provided for local/dev environment!
   A temporary admin account has been created:
     Username: admin
     Password: <chuỗi_ngẫu_nhiên_16_ký_tự>
   Please change this password immediately after login or set INITIAL_ADMIN_PASSWORD.
  ================================================================================
  ```
  `[Code: ApplicationInitConfig.java:229-235]`.
- Hệ thống thông báo nạp thành công 14 Permissions và 7 Roles chuẩn hóa.
- Backend bắt đầu lắng nghe tại địa chỉ `0.0.0.0:8080`.

#### Bước 5: Kiểm tra Sức khỏe Hệ thống (Smoke Test)
Gửi yêu cầu HTTP kiểm tra:
```bash
curl -X GET http://localhost:8080/actuator/health
```
Kết quả kỳ vọng phản hồi: `{"status":"UP"}`.
