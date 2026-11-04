# HƯỚNG DẪN CẤU HÌNH KẾT NỐI SERVER & CHUẨN HÓA DỮ LIỆU CHO FIRMWARE IOT

> **Dự án**: AIoTLibTQB — Hệ thống Giám sát Vi khí hậu & Âm học Thư viện Tạ Quang Bửu  
> **Mục đích tài liệu**: Hướng dẫn đội Firmware / Phần cứng cấu hình kết nối mạng (MQTT / HTTP) và đóng gói chuẩn dữ liệu JSON để khớp 100% với Server Backend.

---

## MỤC LỤC
1. [Thông Số Cấu Hình Kết Nối Server (MQTT Broker)](#1-thông-số-cấu-hình-kết-nối-server-mqtt-broker)
2. [Quy Tắc Đặt Mã Thiết Bị (`hardwareId`) & Hòa Mạng](#2-quy-tắc-đặt-mã-thiết-bị-hardwareid--hòa-mạng)
3. [Chuẩn Hóa Các Kênh MQTT Topic & Cấu Trúc Gói Tin JSON](#3-chuẩn-hóa-các-kênh-mqtt-topic--cấu-trúc-gói-tin-json)
   - [3.1. Gói tin Dữ liệu Đo (`devices/{hardwareId}/telemetry`)](#31-gói-tin-dữ-liệu-đo-deviceshardwareidtelemetry)
   - [3.2. Gói tin Trạng thái & Di chúc LWT (`devices/{hardwareId}/status`)](#32-gói-tin-trạng-thái--di-chúc-lwt-deviceshardwareidstatus)
   - [3.3. Kênh Nhận Lệnh Từ Server (`devices/{hardwareId}/command`)](#33-kênh-nhận-lệnh-từ-server-deviceshardwareidcommand)
4. [Bảng Chuẩn Hóa Đơn Vị, Dải Giá Trị Hợp Lệ & Xử Lý Lỗi Số Đo](#4-bảng-chuẩn-hóa-đơn-vị-dải-giá-trị-hợp-lệ--xử-lý-lỗi-số-đo)
5. [Quy Tắc Thời Gian (`timestamp`) & Chu Kỳ Gửi Tin](#5-quy-tắc-thời-gian-timestamp--chu-kỳ-gửi-tin)
6. [Cấu Hình HTTP API Dự Phòng (Xác Thực API Key / Heartbeat)](#6-cấu-hình-http-api-dự-phòng-xác-thực-api-key--heartbeat)
7. [Đoạn Code Cấu Hình Mẫu (ESP32 C++ / Arduino)](#7-đoạn-code-cấu-hình-mẫu-esp32-c--arduino)
8. [Lệnh Kiểm Thử Nhanh & Các Lỗi Lệch Chuẩn Thường Gặp](#8-lệnh-kiểm-thử-nhanh--các-lỗi-lệch-chuẩn-thường-gặp)

---

## 1. THÔNG SỐ CẤU HÌNH KẾT NỐI SERVER (MQTT BROKER)

Thiết bị giao tiếp với Server thông qua **MQTT Broker (Eclipse Mosquitto 2.0)**. Cần cấu hình MQTT Client trên mạch với đúng các thông số sau:

| Tham số cấu hình | Giá trị bắt buộc / khuyến nghị | Ghi chú kỹ thuật |
| :--- | :--- | :--- |
| **Giao thức** | **MQTT v3.1.1** (TCP) | Không dùng WebSocket cho mạch, kết nối thẳng TCP |
| **Broker Host / IP** | `<SERVER_IP>` | IP máy chủ chạy hệ thống (môi trường local: `localhost`) |
| **Broker Port** | **`1883`** | Cổng TCP mặc định |
| **Xác thực (`allow_anonymous`)** | **`false`** (Bắt buộc có `username` & `password`) | Server chặn mọi kết nối không mật khẩu |
| **MQTT Username & Password** | - **Chế độ Production**: `username` = chính mã `<hardwareId>` của mạch.<br>- **Chế độ Test/Dev**: `username` = `aiot_backend` | Xem lưu ý phân quyền ACL bên dưới |
| **Client ID** | Duy nhất cho mỗi mạch (VD: `node_<hardwareId>`) | Tránh 2 mạch trùng `clientId` đá nhau văng khỏi Broker |
| **Keep-Alive Interval** | **`30` giây** (tối đa `60s`) | Để Broker phát hiện mất kết nối và bắn bản tin LWT kịp thời |
| **Clean Session** | **`true`** | Khởi tạo phiên sạch khi kết nối lại |
| **Mức QoS** | **`QoS 1`** (*At least once*) | Áp dụng cho cả `telemetry` và `status` |
| **Cờ Retain (`retain`)** | **`false`** | **Không bật Retain** để tránh Server đọc lặp lại bản tin cũ |

> [!WARNING]
> **Quy tắc phân quyền ACL trên MQTT Broker (`mosquitto/config/acl.conf`)**:
> - Trên môi trường Production, Broker áp dụng quy tắc:
>   - `pattern write devices/%u/#`
>   - `pattern read devices/%u/command`
> - Nghĩa là nếu mạch đăng nhập MQTT với `username = "ESP32_ROOM_101"`, mạch **chỉ được phép** gửi tin vào `devices/ESP32_ROOM_101/...`. Nếu gửi sang topic của thiết bị khác sẽ bị Broker chặn.
> - Khi thử nghiệm trong phòng Lab, có thể dùng tài khoản chung `aiot_backend` (có quyền `readwrite #`) để test nhanh nhiều mạch.

---

## 2. QUY TẮC ĐẶT MÃ THIẾT BỊ (`hardwareId`) & HÒA MẠNG

### 2.1. Quy Tắc Đặt `hardwareId`
Mỗi mạch phải có một chuỗi định danh `hardwareId` **duy nhất và cố định**:
- **Ký tự cho phép**: Chữ cái không dấu (khuyến nghị in hoa `A-Z`), chữ số (`0-9`), dấu gạch dưới (`_`) hoặc gạch ngang (`-`).
- **Ký tự CẤM**: Tuyệt đối không chứa khoảng trắng, dấu `/`, `+`, `#` (vì `hardwareId` ghép trực tiếp vào đường dẫn MQTT Topic).
- **Ví dụ chuẩn**: `ESP32_ROOM_101`, `ESP32S3_ZONE_A_001`, hoặc dùng địa chỉ MAC không dấu hai chấm `ESP32_A4CF1298B01C`.

> [!CAUTION]
> **QUY TẮC CHỐNG GIẢ MẠO (ANTI-SPOOFING — BẮT BUỘC)**:
> Server kiểm tra đối chiếu giữa `{hardwareId}` trên đường dẫn Topic (`devices/{hardwareId}/...`) và trường `"hardware_id"` bên trong chuỗi JSON.
> - Nếu 2 chuỗi này **khác nhau** (kể cả lệch chữ hoa/thường) $\rightarrow$ **Server lập tức hủy bỏ gói tin** và báo lỗi `Hardware ID spoofing/mismatch detected`.
> - Do đó, trên code firmware chỉ nên khai báo **1 hằng số `HARDWARE_ID` duy nhất** để dùng chung cho cả Topic lẫn JSON.

### 2.2. Cách Hòa Mạng Thiết Bị Mới (Plug-and-Play)
Đội phần cứng **không cần** chờ Admin nhập tay mã thiết bị lên Web trước khi test:
1. Chỉ cần nạp code và bật nguồn cho mạch bắn bản tin MQTT (`telemetry` hoặc `status`) lên Server.
2. Nếu `hardwareId` chưa có trong Database, Server sẽ tự động bắt sóng và đưa mạch đó vào danh sách **"Thiết bị mới phát hiện" (Auto-Discovery Queue)** trên giao diện Admin (lưu tạm trong 10 phút kèm chỉ số `wifi_rssi` và số gói tin đã nhận).
3. Quản trị viên trên Web chỉ cần bấm nút **"Đăng ký"** từ danh sách phát hiện và chọn Phòng cho mạch là dữ liệu bắt đầu được lưu chính thức.

---

## 3. CHUẨN HÓA CÁC KÊNH MQTT TOPIC & CẤU TRÚC GÓI TIN JSON

Toàn bộ dữ liệu gửi đi là chuỗi JSON mã hóa **UTF-8**.

---

### 3.1. Gói tin Dữ liệu Đo (`devices/{hardwareId}/telemetry`)

- **Topic**: `devices/<hardwareId>/telemetry` *(Ví dụ: `devices/ESP32_ROOM_101/telemetry`)*
- **Thao tác**: `PUBLISH` (QoS `1`, Retain `false`)

#### A. Mẫu JSON Chuẩn (`snake_case` khuyến nghị)

```json
{
  "hardware_id": "ESP32_ROOM_101",
  "timestamp": 1728543600000,
  "wifi_rssi": -58,
  "data": {
    "acoustics": {
      "noise_avg": 43.2,
      "noise_peak": 57.8
    },
    "air_quality": {
      "pm1_0": 9.2,
      "pm2_5": 15.6,
      "pm4_0": 19.3,
      "pm10": 22.4
    },
    "environment": {
      "temperature": 24.8,
      "humidity": 52.5,
      "lux": 460.0
    }
  }
}
```

#### B. Bảng Ánh Xạ Tên Trường (Key) & Kiểu Dữ Liệu

Server ưu tiên chuẩn **`snake_case`**, nhưng cũng mở sẵn `@JsonAlias` chấp nhận `camelCase` để tránh lỗi không tương thích:

| Tên Trường Chuẩn | Tên Thay Thế Được Server Chấp Nhận | Kiểu Dữ Liệu | Bắt Buộc? | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `hardware_id` | `hardwareId`, `device_id`, `deviceId` | `String` | Khuyến nghị | Phải trùng 100% với `{hardwareId}` trên Topic |
| `timestamp` | *(không)* | `Long` (Int64) | Khuyến nghị | Thời gian đo Unix Epoch UTC (hỗ trợ cả **giây** 10 số và **mili-giây** 13 số) |
| `wifi_rssi` | `wifiRssi` | `Integer` | Tùy chọn | Cường độ sóng Wi-Fi tính bằng **dBm** (số nguyên âm, VD: `-62`) |
| `data` | *(không)* | `Object` | **Bắt buộc** | Object bọc toàn bộ số liệu cảm biến |
| `data.acoustics` | *(không)* | `Object` | Tùy chọn* | Nhóm dữ liệu âm thanh |
| `data.acoustics.noise_avg` | `noiseAvg` | `Double` / `Float` | Tùy chọn* | Độ ồn trung bình trong chu kỳ gửi (**dBA**) |
| `data.acoustics.noise_peak` | `noisePeak` | `Double` / `Float` | Tùy chọn* | Độ ồn đỉnh lớn nhất trong chu kỳ gửi (**dBA**) |
| `data.air_quality` | `airQuality` | `Object` | Tùy chọn* | Nhóm dữ liệu bụi mịn |
| `data.air_quality.pm1_0` | `pm1` | `Double` / `Float` | Tùy chọn* | Bụi siêu mịn $\text{PM}_{1.0}$ ($\mu\text{g/m}^3$) |
| `data.air_quality.pm2_5` | `pm25` | `Double` / `Float` | Tùy chọn* | Bụi mịn $\text{PM}_{2.5}$ ($\mu\text{g/m}^3$) |
| `data.air_quality.pm4_0` | `pm4` | `Double` / `Float` | Tùy chọn* | Bụi $\text{PM}_{4.0}$ ($\mu\text{g/m}^3$) |
| `data.air_quality.pm10` | *(không)* | `Double` / `Float` | Tùy chọn* | Bụi thô $\text{PM}_{10}$ ($\mu\text{g/m}^3$) |
| `data.environment` | *(không)* | `Object` | Tùy chọn* | Nhóm dữ liệu nhiệt độ, độ ẩm, ánh sáng |
| `data.environment.temperature` | *(không)* | `Double` / `Float` | Tùy chọn* | Nhiệt độ phòng ($^\circ\text{C}$) |
| `data.environment.humidity` | *(không)* | `Double` / `Float` | Tùy chọn* | Độ ẩm tương đối (%RH) |
| `data.environment.lux` | *(không)* | `Double` / `Float` | Tùy chọn* | Cường độ ánh sáng (Lux) |

> *\*Lưu ý*: Mạch không bắt buộc phải gửi đủ cả 9 chỉ số trong mọi gói tin, nhưng **mỗi gói tin phải có ít nhất 1 chỉ số cảm biến hợp lệ**. Nếu `data` rỗng hoặc toàn bộ chỉ số đều lỗi/null, Server sẽ bỏ qua không lưu gói tin đó.

---

### 3.2. Gói tin Trạng thái & Di chúc LWT (`devices/{hardwareId}/status`)

- **Topic**: `devices/<hardwareId>/status` *(Ví dụ: `devices/ESP32_ROOM_101/status`)*
- **Thao tác**: `PUBLISH` khi vừa kết nối mạng VÀ đăng ký làm **Last Will and Testament (LWT)** lúc `mqtt.connect()`.

#### A. Mẫu JSON Khi Mạch Vừa Kết Nối Thành Công (`online`)
Ngay sau khi `mqtt.connect()` thành công, mạch chủ động gửi gói tin này để báo `ONLINE` và cập nhật phiên bản firmware lên Server:
```json
{
  "hardware_id": "ESP32_ROOM_101",
  "status": "online",
  "reason": "power_on",
  "firmware_version": "1.2.0",
  "uptime_seconds": 15,
  "timestamp": 1728543600000
}
```

#### B. Mẫu JSON Đăng Ký Làm Di Chúc LWT (`offline`)
Khai báo sẵn trong hàm `mqtt.connect()` (Will Topic = `devices/<hardwareId>/status`, Will QoS = `1`, Will Retain = `false`). Khi mạch mất nguồn hoặc rớt mạng đột ngột, Broker sẽ tự phát gói tin này cho Server:
```json
{
  "hardware_id": "ESP32_ROOM_101",
  "status": "offline",
  "reason": "lwt"
}
```

#### C. Bảng Đặc Tả Các Trường Trong `status`

| Tên Trường Chuẩn | Tên Thay Thế (`@JsonAlias`) | Kiểu Dữ Liệu | Bắt Buộc? | Quy định giá trị |
| :--- | :--- | :---: | :---: | :--- |
| `hardware_id` | `hardwareId`, `device_id`, `deviceId` | `String` | Khuyến nghị | Phải khớp với `{hardwareId}` trên Topic |
| `status` | *(không)* | `String` | **Bắt buộc** | Chỉ truyền `"online"` hoặc `"offline"` |
| `reason` | *(không)* | `String` | Tùy chọn | Chuỗi mô tả nguyên nhân (VD: `"power_on"`, `"reconnected"`, `"lwt"`, `"ota_reboot"`) |
| `firmware_version` | `firmwareVersion` | `String` | Khuyến nghị | Phiên bản code đang chạy (VD: `"1.2.0"`). Server sẽ tự cập nhật thông tin này vào hồ sơ thiết bị |
| `uptime_seconds` | `uptimeSeconds` | `Long` | Tùy chọn | Số giây mạch đã hoạt động từ lúc bật nguồn |
| `timestamp` | *(không)* | `Long` | Tùy chọn | Unix Epoch UTC (giây hoặc mili-giây) |

---

### 3.3. Kênh Nhận Lệnh Từ Server (`devices/{hardwareId}/command`)

- **Topic**: `devices/<hardwareId>/command`
- Khi kết nối MQTT thành công, khuyến nghị firmware gọi `subscribe("devices/<hardwareId>/command")` để sẵn sàng nhận lệnh điều khiển từ xa (khi mở rộng tính năng OTA/reset từ xa).

---

## 4. BẢNG CHUẨN HÓA ĐƠN VỊ, DẢI GIÁ TRỊ HỢP LỆ & XỬ LÝ LỖI SỐ ĐO

Server có bộ lọc kiểm tra ngưỡng vật lý (`TelemetrySanitizerService`). **Mọi con số nằm ngoài khoảng `[Min, Max]` dưới đây sẽ bị Server từ chối (coi là nhiễu phần cứng)**:

| Chỉ số (`key`) | Đơn vị chuẩn | Giá trị Tối thiểu (`Min`) | Giá trị Tối đa (`Max`) | Quy tắc xử lý bắt buộc trên Firmware |
| :--- | :---: | :---: | :---: | :--- |
| `noise_avg` | **dBA** | **`30.0`** | **`110.0`** | **Cấm gửi `0`**. Nếu công thức tính độ ồn ra `< 30.0` khi phòng yên tĩnh, phải kẹp dưới về **`30.0`**. |
| `noise_peak` | **dBA** | **`30.0`** | **`130.0`** | **Cấm gửi `0`**. Kẹp dưới ở **`30.0`**, kẹp trên ở **`130.0`**. |
| `pm1_0` | **$\mu\text{g/m}^3$** | **`0.0`** | **`1000.0`** | Không gửi số âm (như `-1` khi lỗi cảm biến). |
| `pm2_5` | **$\mu\text{g/m}^3$** | **`0.0`** | **`1000.0`** | Không gửi số âm. |
| `pm4_0` | **$\mu\text{g/m}^3$** | **`0.0`** | **`1000.0`** | Không gửi số âm. |
| `pm10` | **$\mu\text{g/m}^3$** | **`0.0`** | **`1000.0`** | Không gửi số âm. |
| `temperature` | **$^\circ\text{C}$** | **`0.0`** | **`60.0`** | Phải đổi ra độ C (Celsius), không gửi độ F hay Kelvin. |
| `humidity` | **%RH** | **`0.0`** | **`100.0`** | Gửi theo thang `0 – 100` (VD: `55.5`), **không** gửi thang `0.0 – 1.0`. |
| `lux` | **Lux** | **`0.0`** | **`65535.0`** | Nếu cảm biến trả lỗi `65535` (tràn thanh ghi) hoặc `< 0`, cần loại bỏ. |

### Quy Tắc Xử Lý Khi Một Cảm Biến Đọc Lỗi Trên Mạch:
1. **Không gửi mã lỗi giả bằng số (`-1`, `-999`, `0` dBA)**:
   - Nếu trong 1 chu kỳ, một cảm biến bị lỗi đọc tạm thời, firmware **không đưa trường đó vào JSON** (hoặc gán `null`), chỉ gửi các cảm biến đọc tốt.
   - Server đã có cơ chế **Forward-Fill 30 giây** (tự động bù giá trị hợp lệ liền trước trong tối đa 30s cho các chỉ số trừ `noise_peak`) và tự tính lại điểm nếu cảm biến đó nghỉ dài hạn.
2. **Kiểm tra `isnan()` / `isinf()` trước khi đóng gói JSON**:
   - Biến `float` bị `NaN` nếu đưa thẳng vào JSON sẽ tạo chuỗi không hợp lệ (`"temperature": NaN`) làm hỏng toàn bộ gói tin. Luôn kiểm tra `!isnan(x) && !isinf(x)`.
3. **Làm tròn số thập phân**:
   - Khuyến nghị làm tròn **1 hoặc 2 chữ số thập phân** (ví dụ `24.8` hoặc `24.85`) để gói JSON gọn nhẹ.

---

## 5. QUY TẮC THỜI GIAN (`timestamp`) & CHU KỲ GỬI TIN

### 5.1. Quy Tắc Trường `timestamp`
- **Múi giờ**: Luôn dùng **UTC Unix Epoch** (số giây hoặc số mili-giây tính từ `1970-01-01T00:00:00Z`).
- **Tự động nhận diện đơn vị**:
  - Gửi **10 chữ số** (VD `1728543600`) $\rightarrow$ Server hiểu là **Giây (Seconds)**.
  - Gửi **13 chữ số** (VD `1728543600000`) $\rightarrow$ Server hiểu là **Mili-giây (Milliseconds)**.
- **Khi mạch chưa kịp đồng bộ NTP**:
  - Nếu mạch vừa bật chưa lấy được giờ NTP, hãy **bỏ qua trường `timestamp`** (hoặc gửi `0`). Server sẽ tự lấy giờ chuẩn của Server gắn vào bản tin.
  - Nếu đồng hồ mạch bị lệch về trước năm `2020-01-01` hoặc chạy nhanh hơn giờ Server quá **`60 giây`**, Server cũng sẽ tự động kẹp về giờ hiện tại của Server.
- **Hỗ trợ bắn bù dữ liệu khi mất mạng (Offline Buffer)**:
  - Nếu mạch có lưu đệm dữ liệu kèm `timestamp` thực tế lúc đo (nằm trong khoảng từ năm `2020` đến hiện tại) rồi bắn bù lên khi có Wi-Fi lại, Server **vẫn giữ nguyên mốc thời gian lịch sử đó** để vẽ đúng biểu đồ quá khứ.

### 5.2. Chu Kỳ Gửi Tin & Ngưỡng Thời Gian Cần Biết
- **Chu kỳ gửi `telemetry` chuẩn**: **`5 giây / lần`** đến **`10 giây / lần`** (tối đa không được thưa quá **`60 giây / lần`**).
- **Lý do**:
  1. **Watchdog 2 phút**: Server quét mỗi 15 giây; nếu một mạch im lặng quá **`120 giây` (2 phút)** không có bản tin, Server sẽ chuyển mạch sang trạng thái **`OFFLINE`** và phát cảnh báo mất kết nối.
  2. **Cảnh báo vượt ngưỡng (FSM 30 giây)**: Trên Server, các cảnh báo ồn (`noise_avg > 65 dBA`, `noise_peak > 75 dBA`), nóng (`temperature > 32 °C`), bụi (`pm2_5 > 50 µg/m³`) cần duy trì vượt ngưỡng liên tục **$\ge 30$ giây** mới phát báo động chính thức (để lọc nhiễu tức thời), và cần duy trì an toàn **$\ge 60$ giây** để tự đóng cảnh báo. Gửi đều đặn mỗi `5s – 10s` giúp bộ đếm FSM hoạt động chính xác nhất.

---

## 6. CẤU HÌNH HTTP API DỰ PHÒNG (XÁC THỰC API KEY / HEARTBEAT)

Nếu hệ thống yêu cầu mạch xác thực lấy JWT Token hoặc gửi nhịp tim qua HTTP (ngoài MQTT), sử dụng 2 API sau tại `http://<SERVER_IP>:8080`:

### 6.1. Xác Thực Thiết Bị (`POST /api/v1/devices/authenticate`)
- **Giới hạn tần suất (Rate Limit)**: Tối đa **10 lần / phút / IP** (vượt quá sẽ nhận lỗi `HTTP 429`).
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "hardwareId": "ESP32_ROOM_101",
    "apiKey": "<KHOA_API_32_KY_TU_HEX_ADMIN_CAP>"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "code": 1000,
    "result": {
      "token": "eyJhbGciOiJIUzUxMiJ9..."
    }
  }
  ```
  *(Token có hạn **8 giờ**).*

### 6.2. Gửi HTTP Heartbeat (`POST /api/v1/devices/{id}/heartbeat`)
- **Lưu ý**: Nếu mạch đã gửi MQTT `telemetry` định kỳ thì **không cần** gọi API này (vì mỗi bản tin MQTT đã tự động cập nhật trạng thái `ONLINE` và `lastSeenAt`).
- **Headers**: `Authorization: Bearer <DEVICE_JWT_TOKEN>`
- **Response (`200 OK`)**: `{"code": 1000}`

---

## 7. ĐOẠN CODE CẤU HÌNH MẪU (ESP32 C++ / ARDUINO)

Đoạn khung cấu hình dưới đây dùng thư viện `PubSubClient` và `ArduinoJson` (v7), đảm bảo đóng gói đúng chuẩn dữ liệu mà Server yêu cầu:

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <math.h>

// 1. THÔNG SỐ CẤU HÌNH SERVER & ĐỊNH DANH MẠCH
const char* WIFI_SSID       = "Ten_WiFi";
const char* WIFI_PASSWORD   = "<WIFI_PASSWORD>";

const char* MQTT_BROKER_IP  = "192.168.1.100"; // Đổi thành IP Server thực tế
const uint16_t MQTT_PORT    = 1883;

const char* HARDWARE_ID     = "ESP32_ROOM_101"; // Duy nhất cho mỗi mạch
const char* FIRMWARE_VER    = "1.2.0";

const char* MQTT_USERNAME   = "ESP32_ROOM_101"; // Hoặc "aiot_backend" khi test
const char* MQTT_PASSWORD   = "<MQTT_PASSWORD>";

const unsigned long PUBLISH_INTERVAL_MS = 5000; // Gửi mỗi 5 giây

String topicTelemetry = String("devices/") + HARDWARE_ID + "/telemetry";
String topicStatus    = String("devices/") + HARDWARE_ID + "/status";
String topicCommand   = String("devices/") + HARDWARE_ID + "/command";

WiFiClient espClient;
PubSubClient mqttClient(espClient);
unsigned long lastPublishMs = 0;

// Kiểm tra số thực hợp lệ và nằm trong dải [minVal, maxVal] của Server
bool isValidMetric(float val, float minVal, float maxVal) {
    return !isnan(val) && !isinf(val) && (val >= minVal) && (val <= maxVal);
}

float round1(float val) {
    return roundf(val * 10.0f) / 10.0f;
}

int64_t getEpochMillis() {
    struct timeval tv;
    if (gettimeofday(&tv, nullptr) == 0 && tv.tv_sec > 1577836800L) {
        return (int64_t)tv.tv_sec * 1000LL + (tv.tv_usec / 1000LL);
    }
    return 0; // Chưa có NTP thì trả 0 để Server tự gán giờ
}

// 2. BẮN BẢN TIN STATUS ONLINE NGAY KHI KẾT NỐI
void sendOnlineStatus(const char* reason) {
    JsonDocument doc;
    doc["hardware_id"]      = HARDWARE_ID;
    doc["status"]           = "online";
    doc["reason"]           = reason;
    doc["firmware_version"] = FIRMWARE_VER;
    doc["uptime_seconds"]   = millis() / 1000UL;
    int64_t ts = getEpochMillis();
    if (ts > 0) doc["timestamp"] = ts;

    char buf[256];
    serializeJson(doc, buf, sizeof(buf));
    mqttClient.publish(topicStatus.c_str(), buf, false);
}

// 3. KẾT NỐI MQTT KÈM DI CHÚC LWT OFFLINE
void connectMqtt() {
    while (!mqttClient.connected()) {
        String clientId = String("node_") + HARDWARE_ID;

        JsonDocument lwtDoc;
        lwtDoc["hardware_id"] = HARDWARE_ID;
        lwtDoc["status"]      = "offline";
        lwtDoc["reason"]      = "lwt";
        char lwtBuf[128];
        serializeJson(lwtDoc, lwtBuf, sizeof(lwtBuf));

        if (mqttClient.connect(
                clientId.c_str(),
                MQTT_USERNAME,
                MQTT_PASSWORD,
                topicStatus.c_str(),
                1,      // LWT QoS = 1
                false,  // LWT Retain = false
                lwtBuf,
                true    // Clean Session = true
        )) {
            mqttClient.subscribe(topicCommand.c_str(), 1);
            sendOnlineStatus(lastPublishMs == 0 ? "power_on" : "reconnected");
        } else {
            delay(2000);
        }
    }
}

// 4. ĐÓNG GÓI & BẮN BẢN TIN TELEMETRY CHUẨN HÓA
void sendTelemetry(
    float noiseAvg, float noisePeak,
    float pm1_0, float pm2_5, float pm4_0, float pm10,
    float tempC, float humRh, float lux
) {
    JsonDocument doc;
    doc["hardware_id"] = HARDWARE_ID;
    int64_t ts = getEpochMillis();
    if (ts > 0) doc["timestamp"] = ts;
    doc["wifi_rssi"] = WiFi.RSSI();

    JsonObject data = doc["data"].to<JsonObject>();

    // Kẹp ngưỡng dưới độ ồn tại 30.0 dBA nếu cảm biến trả thấp hơn 30
    if (!isnan(noiseAvg) && noiseAvg > 0.0f && noiseAvg < 30.0f) noiseAvg = 30.0f;
    if (!isnan(noisePeak) && noisePeak > 0.0f && noisePeak < 30.0f) noisePeak = 30.0f;

    if (isValidMetric(noiseAvg, 30.0f, 110.0f) || isValidMetric(noisePeak, 30.0f, 130.0f)) {
        JsonObject acoustics = data["acoustics"].to<JsonObject>();
        if (isValidMetric(noiseAvg, 30.0f, 110.0f))  acoustics["noise_avg"]  = round1(noiseAvg);
        if (isValidMetric(noisePeak, 30.0f, 130.0f)) acoustics["noise_peak"] = round1(noisePeak);
    }

    if (isValidMetric(pm2_5, 0.0f, 1000.0f)) {
        JsonObject air = data["air_quality"].to<JsonObject>();
        if (isValidMetric(pm1_0, 0.0f, 1000.0f)) air["pm1_0"] = round1(pm1_0);
        if (isValidMetric(pm2_5, 0.0f, 1000.0f)) air["pm2_5"] = round1(pm2_5);
        if (isValidMetric(pm4_0, 0.0f, 1000.0f)) air["pm4_0"] = round1(pm4_0);
        if (isValidMetric(pm10,  0.0f, 1000.0f)) air["pm10"]  = round1(pm10);
    }

    if (isValidMetric(tempC, 0.0f, 60.0f) || isValidMetric(humRh, 0.0f, 100.0f) || isValidMetric(lux, 0.0f, 65535.0f)) {
        JsonObject env = data["environment"].to<JsonObject>();
        if (isValidMetric(tempC, 0.0f, 60.0f))    env["temperature"] = round1(tempC);
        if (isValidMetric(humRh, 0.0f, 100.0f))   env["humidity"]    = round1(humRh);
        if (isValidMetric(lux,   0.0f, 65535.0f)) env["lux"]         = round1(lux);
    }

    char payload[512];
    size_t len = serializeJson(doc, payload, sizeof(payload));
    mqttClient.publish(topicTelemetry.c_str(), (const uint8_t*)payload, len, false);
}

void setup() {
    Serial.begin(115200);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) delay(500);

    configTime(0, 0, "pool.ntp.org", "time.google.com");

    mqttClient.setServer(MQTT_BROKER_IP, MQTT_PORT);
    mqttClient.setKeepAlive(30);
    // BẮT BUỘC: Tăng buffer lên 512 bytes (mặc định PubSubClient chỉ 256 bytes sẽ làm rớt gói telemetry)
    mqttClient.setBufferSize(512);
}

void loop() {
    if (!mqttClient.connected()) connectMqtt();
    mqttClient.loop();

    if (millis() - lastPublishMs >= PUBLISH_INTERVAL_MS) {
        lastPublishMs = millis();
        // Truyền các biến số đo thực tế từ mạch vào hàm dưới đây:
        sendTelemetry(43.2f, 56.5f, 8.5f, 14.2f, 18.0f, 21.5f, 24.5f, 52.0f, 450.0f);
    }
}
```

---

## 8. LỆNH KIỂM THỬ NHANH & CÁC LỖI LỆCH CHUẨN THƯỜNG GẶP

### 8.1. Lệnh Bắn Thử Gói Tin Từ Máy Tính (`mosquitto_pub`)
```bash
# Test gửi gói Status
mosquitto_pub -h <SERVER_IP> -p 1883 -u aiot_backend -P <MQTT_PASSWORD> \
  -t "devices/ESP32_ROOM_101/status" -q 1 \
  -m '{"hardware_id":"ESP32_ROOM_101","status":"online","reason":"power_on","firmware_version":"1.2.0"}'

# Test gửi gói Telemetry
mosquitto_pub -h <SERVER_IP> -p 1883 -u aiot_backend -P <MQTT_PASSWORD> \
  -t "devices/ESP32_ROOM_101/telemetry" -q 1 \
  -m '{"hardware_id":"ESP32_ROOM_101","wifi_rssi":-55,"data":{"acoustics":{"noise_avg":44.5,"noise_peak":58.2},"air_quality":{"pm1_0":7.5,"pm2_5":12.0,"pm4_0":15.1,"pm10":18.4},"environment":{"temperature":24.5,"humidity":52.0,"lux":450.0}}}'
```

### 8.2. Checklist 5 Lỗi Cấu Hình Khiến Mạch Không Khớp Với Server

1. **Quên `mqttClient.setBufferSize(512)` (trên Arduino `PubSubClient`)**:
   - Gói JSON `telemetry` đầy đủ dài khoảng `280 – 330 bytes`. Nếu để mặc định `256 bytes`, hàm `publish()` sẽ trả về `false` và không gửi gì lên Broker dù bản tin `status` ngắn hơn vẫn đi qua được.
2. **Lệch `hardware_id` giữa Topic và JSON Payload**:
   - Ví dụ gửi vào topic `devices/ESP32_01/telemetry` nhưng trong JSON lại để `"hardware_id": "esp32_01"` (chữ thường). Server sẽ chặn vì vi phạm quy tắc Anti-Spoofing.
3. **Gửi `noise_avg` hoặc `noise_peak` nhỏ hơn `30.0` (hoặc bằng `0`)**:
   - Server quy định dải âm học hợp lệ là `[30.0, 110.0]` dBA cho `noise_avg` và `[30.0, 130.0]` dBA cho `noise_peak`. Mọi giá trị `< 30.0` đều bị bộ lọc từ chối.
4. **Đặt phẳng các chỉ số cảm biến ở ngoài gốc thay vì bọc trong `"data"`**:
   - Cấu trúc bắt buộc phải là `{"hardware_id": "...", "data": {"acoustics": {...}, "air_quality": {...}, "environment": {...}}}`. Nếu gửi phẳng không có `"data"`, Server sẽ coi là bản tin rỗng và hủy bỏ.
5. **Mạch đã gửi tin nhưng chưa được Admin gán vào Phòng trên Web**:
   - Nếu mạch mới tinh chưa từng khai báo, dữ liệu sẽ nằm ở danh sách **Discovery (`/api/v1/devices/discovered`)** chứ chưa lưu vào biểu đồ. Cần báo Admin bấm duyệt thiết bị trên giao diện Web.
