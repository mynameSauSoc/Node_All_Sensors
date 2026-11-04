# ĐẶC TẢ THAM CHIẾU REST API VÀ DANH MỤC MÃ LỖI (AIoTLibTQB)

> **Tài liệu**: `docs/07-api-reference.md`  
> **Dự án**: AIoTLibTQB — Hệ thống Giám sát Vi khí hậu & Âm học Thông minh Thư viện Tạ Quang Bửu  
> **Phiên bản**: 2.0 (Toàn diện & Đã kiểm chứng thực địa mã nguồn)  
> **Nguyên tắc kỹ thuật**: Mã nguồn thực tế là nguồn sự thật tối thượng (*Code is the Single Source of Truth*). Mọi endpoint, tham số request/response, cấu trúc bọc `ApiResponse<T>` và mã lỗi đều được đối chiếu trực tiếp với mã nguồn đang chạy.

---

## 1. MỤC TIÊU

Tài liệu này là cẩm nang kỹ thuật toàn diện đặc tả giao thức giao tiếp RESTful API của hệ sinh thái AIoTLibTQB:
1. **Chuẩn hóa Hợp đồng Giao tiếp (API Contract)**: Quy định cấu trúc đóng gói thống nhất cho toàn bộ phản hồi qua vỏ bọc `ApiResponse<T>` và phân trang chuẩn hóa `PageResponse<T>`.
2. **Đặc tả 7 Phân hệ RESTful Endpoints**: Chi tiết hóa từng endpoint từ phương thức HTTP, đường dẫn, quyền hạn bảo mật, tham số URL/query params, JSON request body mẫu đến JSON response body mẫu.
3. **Kỹ thuật Downsampling Chuỗi Thời Gian**: Hướng dẫn khai thác API nén bucket thời gian thực (`$dateTrunc` trên các bước nhảy 15m, 1h, 1d) phục vụ vẽ biểu đồ hiệu năng cao trên Frontend.
4. **Bảng Tra cứu Mã Lỗi Hệ thống (Error Code Catalogue)**: Danh mục toàn bộ 46 mã lỗi được định nghĩa tại `ErrorCode.java` kèm mã HTTP status, thông điệp lỗi và nguyên nhân phát sinh.

---

## 2. ĐỐI TƯỢNG ĐỌC

Tài liệu này được biên soạn cho:
- **Kỹ sư Frontend (Next.js 15, React 19, TypeScript)**: Nắm bắt chính xác kiểu dữ liệu (DTO Types), cách gửi header Bearer Token, xử lý phân trang và bắt mã lỗi trả về.
- **Kỹ sư Backend & Microservices**: Đảm bảo việc mở rộng hoặc bổ sung API tuân thủ đúng quy ước vỏ bọc, xử lý ngoại lệ qua `GlobalExceptionHandler` và kiểm soát quyền hạn.
- **Kỹ sư Nhúng IoT (ESP32-S3 Firmware Developers)**: Sử dụng các endpoint cấp phát khóa API, gửi tín hiệu nhịp tim `heartbeat` và xác thực thiết bị `authenticate`.
- **Kỹ sư Kiểm thử Phần mềm (QA / Automation Testers)**: Xây dựng bộ test suite tự động (Postman/Newman, REST Assured) dựa trên hợp đồng dữ liệu chuẩn.

---

## 3. NỘI DUNG CHI TIẾT

### 3.1. Chuẩn Hóa Định Dạng Giao Tiếp (Envelope Specification)

Toàn bộ các endpoint REST API trong AIoTLibTQB đều bắt buộc phải bọc dữ liệu trả về trong cấu trúc `ApiResponse<T>`:
- **Tọa độ mã nguồn**: `src/main/java/com/example/AIoTLibTQB/dto/response/ApiResponse.java:1-21`

#### 3.1.1. Cấu trúc Vỏ bọc `ApiResponse<T>`
```json
{
  "code": 1000,
  "message": "Operation successful",
  "result": { ... }
}
```

- `code` (`int`): Mã trạng thái nghiệp vụ. Quy ước mã thành công chuẩn là `1000`. Khi xảy ra lỗi, `code` sẽ mang giá trị tương ứng từ `ErrorCode.java` (ví dụ: `1006`, `3001`, `4031`...).
- `message` (`String`): Thông điệp mô tả kết quả xử lý hoặc thông báo lỗi cho người dùng.
- `result` (`T`): Dữ liệu nghiệp vụ trả về (Object, List, Page, hoặc null). Được cấu hình `@JsonInclude(NON_NULL)` nên trường này sẽ tự động ẩn đi nếu giá trị là `null` trong các phản hồi lỗi.

#### 3.1.2. Cấu trúc Phân trang Chuẩn `PageResponse<T>`
Đối với các API tra cứu danh sách có phân trang, trường `result` sẽ chứa cấu trúc `PageResponse<T>`:
- **Tọa độ mã nguồn**: `src/main/java/com/example/AIoTLibTQB/dto/response/PageResponse.java:1-27`

```json
{
  "code": 1000,
  "result": {
    "content": [ ... ],
    "page": 0,
    "size": 10,
    "totalElements": 42,
    "totalPages": 5,
    "last": false
  }
}
```

- `content` (`List<T>`): Danh sách bản ghi thuộc trang hiện tại.
- `page` (`int`): Chỉ số trang hiện tại (0-indexed, trang đầu tiên là `0`).
- `size` (`int`): Số lượng phần tử tối đa trên một trang (được kẹp an toàn từ 1 đến 100).
- `totalElements` (`long`): Tổng số bản ghi thỏa mãn điều kiện lọc trong CSDL.
- `totalPages` (`int`): Tổng số trang tương ứng với kích thước `size`.
- `last` (`boolean`): Cờ đánh dấu có phải trang cuối cùng hay không.

#### 3.1.3. Bảng Phân Loại Đối Tượng Tiêu Thụ (Consumer Classification) & Ma Trận Validation DTO

Nhằm chuẩn hóa việc tích hợp giữa các tầng hệ thống, bảng dưới đây phân loại đối tượng sử dụng cho từng nhóm endpoint và quy định các ràng buộc kiểm tra dữ liệu đầu vào (Bean Validation Annotations) áp dụng trên các DTO tương ứng:

| Nhóm API Endpoints | Đối Tượng Tiêu Thụ Chính (Consumers) | Các DTO Yêu Cầu Chính | Các Ràng Buộc Validation Bắt Buộc (@Valid) |
| :--- | :--- | :--- | :--- |
| **Nhóm 1: Xác Thực**<br>`/api/v1/auth/**` | - **Frontend Web UI** (Login, Logout)<br>- **Kiosk Công cộng**<br>- **Admin Dashboard** | `AuthenticationRequest`<br>`RefreshRequest`<br>`LogoutRequest` | - `username`: `@NotBlank`, `@Size(min = 3, max = 50)`<br>- `password`: `@NotBlank`, `@Size(min = 6)`<br>- `token`, `refreshToken`: `@NotBlank` |
| **Nhóm 2: Người Dùng**<br>`/api/v1/users/**` | - **Admin Console** (CRUD tài khoản)<br>- **Frontend Web UI** (`/profile`, `myInfo`) | `UserCreationRequest`<br>`UserUpdateRequest`<br>`PasswordChangeRequest` | - `username`: `@NotBlank`, `@Size(min = 3, max = 50)`, chữ & số<br>- `email`: `@Email(message = "INVALID_EMAIL")`<br>- `phone`: `@Pattern(regexp = "^(0[35789])[0-9]{8}$")`<br>- `oldPassword`, `newPassword`: `@NotBlank`, `@Size(min = 6)` |
| **Nhóm 3: Phân Quyền**<br>`/api/v1/roles/**`<br>`/api/v1/permissions/**` | - **Admin Toàn Quyền** (Thiết lập vai trò) | `RoleCreationRequest`<br>`RoleUpdateRequest` | - `name`: `@NotBlank`, `@Size(min = 2, max = 30)`<br>- `description`: `@Size(max = 255)`<br>- `permissions`: `@NotEmpty` |
| **Nhóm 4: Không Gian**<br>`/api/v1/rooms/**` | - **Frontend Web UI** (Floorplan 2D)<br>- **Màn hình Kiosk** (Tra cứu phòng)<br>- **Thủ thư & Zone Manager** | `RoomCreationRequest`<br>`RoomUpdateRequest` | - `code`: `@NotBlank`, `@Size(min = 2, max = 20)`, auto uppercase<br>- `name`: `@NotBlank`, `@Size(max = 100)`<br>- `floor`: `@NotNull`, `@Min(1)`<br>- `targetComfortScore`: `@DecimalMin("0.0")`, `@DecimalMax("100.0")`<br>- `boundaryPolygon`: `@NotEmpty` (tối thiểu 3 điểm Point2D) |
| **Nhóm 5: Thiết Bị IoT**<br>`/api/v1/devices/**` | - **Trạm Đo ESP32-S3** (`authenticate`, `heartbeat`)<br>- **Admin & Kỹ sư Phần cứng** (Cấp khóa, Discovery) | `DeviceCreationRequest`<br>`DeviceUpdateRequest`<br>`DeviceAuthenticateRequest` | - `hardwareId`: `@NotBlank`, `@Pattern(regexp = "^ESP32_[A-Za-z0-9_]+$")`<br>- `roomId`: `@NotBlank`<br>- `posX`, `posY`: `@NotNull`, `@DecimalMin("0.0")`, `@DecimalMax("1.0")`<br>- `apiKey`: `@NotBlank(message = "API_KEY_REQUIRED")` |
| **Nhóm 6: Chuỗi Thời Gian**<br>`/api/v1/telemetry/**` | - **Frontend Web UI** (Charts, Heatmap)<br>- **Màn hình Kiosk sảnh** (LCS tóm tắt)<br>- **Báo cáo định kỳ** | `TelemetryQueryFilter`<br>`TelemetryBucketsFilter` | - `roomId`, `deviceId`: `@NotBlank`<br>- `from`, `to`: ISO-8601 UTC Instant, `from <= to`<br>- `step`: enum bắt buộc (`15m`, `1h`, `1d`)<br>- `limit`: `@Max(1000)` (Hạn ngạch chống OOM) |
| **Nhóm 7: Cảnh Báo**<br>`/api/v1/alerts/**` | - **Thủ thư & Nhân viên trực ban**<br>- **Kỹ sư bảo trì thiết bị** (Alerts page)<br>- **Hệ thống cảnh báo tự động** | `AlertAcknowledgeRequest` | - `acknowledgedBy`: `@NotBlank(message = "OPERATOR_NAME_REQUIRED")`<br>- `status`: Enum (`PENDING`, `FIRING`, `ACKNOWLEDGED`, `RESOLVED`) |

---

### 3.2. Nhóm 1: Xác Thực & Phiên Làm Việc (`/api/v1/auth`)
- **Đối tượng sử dụng chính**: Frontend Web UI, Kiosk công cộng, Admin Console.
- **Controller**: `src/main/java/com/example/AIoTLibTQB/controller/AuthenticationController.java:1-60`
- **Tần suất giới hạn (Rate Limit)**: Áp dụng Bucket4j 10 requests / phút / IP đối với mọi endpoint công khai trong nhóm này.

#### 3.2.1. Đăng nhập hệ thống (`POST /api/v1/auth/login`)
- **Mô tả**: Xác thực thông tin đăng nhập của người dùng qua tên đăng nhập và mật khẩu, cấp phát cặp Access Token (1h) và Refresh Token (24h).
- **Quyền hạn**: Public (Không cần token).
- **Request Body** (`AuthenticationRequest`):
  ```json
  {
    "username": "admin",
    "password": "SecurePassword123!"
  }
  ```
- **Response Body (200 OK)** (`ApiResponse<AuthenticationResponse>`):
  ```json
  {
    "code": 1000,
    "result": {
      "token": "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhZG1pbiIsImlzcyI6ImFpb3QtYmFja2VuZCIsImV4cCI6MTcxOTc1NjAwMCwianRpIjoiY2YwZDBiMjEtOTY1Ny00OWE4LTlmYjctNjFhNzc3ZGVhMzE5Iiwic2NvcGUiOiJBRE1JTiBSRUFEX1NFTlNPUl9EQVRBIiwidXNlcklkIjoiNjgxMjM0NTZhYmNkZWYwMTIzNDU2Nzg5IiwidG9rZW5UeXBlIjoiQUNDRVNTIn0...",
      "refreshToken": "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhZG1pbiIsImlzcyI6ImFpb3QtYmFja2VuZCIsImV4cCI6MTcxOTg0MjQwMCwianRpIjoiODgyOGE4NjQtMGNjYi00MDdmLWE3MmYtNzk2ODBiYzBkNDJkIiwidXNlcklkIjoiNjgxMjM0NTZhYmNkZWYwMTIzNDU2Nzg5IiwidG9rZW5UeXBlIjoiUkVGUkVTSCJ9..."
    }
  }
  ```
- **Lỗi thường gặp**:
  - `400 Bad Request` (`1005: USER_DID_NOT_EXIST`): Tài khoản không tồn tại.
  - `401 Unauthorized` (`1006: UNAUTHENTICATED`): Mật khẩu không chính xác.
  - `403 Forbidden` (`1008: USER_INACTIVE`): Tài khoản đã bị quản trị viên khóa.
  - `429 Too Many Requests` (`4029: TOO_MANY_REQUESTS`): Đăng nhập sai quá 10 lần trong 1 phút.

#### 3.2.2. Kiểm tra tính hợp lệ của Token (`POST /api/v1/auth/introspect`)
- **Mô tả**: Dành cho các dịch vụ vệ tinh hoặc API gateway kiểm tra nhanh trạng thái token mà không cần phân tích sâu.
- **Quyền hạn**: Public.
- **Request Body** (`IntrospectRequest`):
  ```json
  {
    "token": "eyJhbGciOiJIUzUxMiJ9..."
  }
  ```
- **Response Body (200 OK)** (`ApiResponse<IntrospectResponse>`):
  ```json
  {
    "code": 1000,
    "result": {
      "valid": true
    }
  }
  ```

#### 3.2.3. Xoay vòng Refresh Token (`POST /api/v1/auth/refresh`)
- **Mô tả**: Đổi Refresh Token cũ lấy một cặp Access Token và Refresh Token mới hoàn toàn (Single-Use Token Rotation). Refresh Token cũ bị đưa vào Blacklist ngay tức thì.
- **Quyền hạn**: Public.
- **Request Body** (`RefreshRequest`):
  ```json
  {
    "token": "<valid_refresh_token>"
  }
  ```
- **Response Body (200 OK)**:
  ```json
  {
    "code": 1000,
    "result": {
      "token": "<new_access_token>",
      "refreshToken": "<new_refresh_token>"
    }
  }
  ```
- **Lỗi thường gặp**:
  - `401 Unauthorized` (`1006: UNAUTHENTICATED`): Token không đúng định dạng `REFRESH`, chữ ký sai, token đã hết hạn, hoặc token đã bị thu hồi trong Blacklist.

#### 3.2.4. Đăng xuất khỏi hệ thống (`POST /api/v1/auth/logout`)
- **Mô tả**: Thu hồi Access Token và Refresh Token, lưu các `jwtID` vào MongoDB collection `invalidated_tokens`.
- **Quyền hạn**: Public (nhận token từ request body).
- **Request Body** (`LogoutRequest`):
  ```json
  {
    "token": "<access_token_to_revoke>",
    "refreshToken": "<refresh_token_to_revoke>"
  }
  ```
- **Response Body (200 OK)**:
  ```json
  {
    "code": 1000,
    "result": null
  }
  ```

---

### 3.3. Nhóm 2: Người Dùng & Hồ Sơ Cá Nhân (`/api/v1/users`)
- **Đối tượng sử dụng chính**: Admin Console (Quản trị tài khoản, phân vùng phụ trách); Frontend Web UI (`/profile`, thông tin cá nhân).
- **Controller**: `src/main/java/com/example/AIoTLibTQB/controller/UserController.java:1-105`

#### 3.3.1. Đăng ký tài khoản người dùng (`POST /api/v1/users`)
- **Quyền hạn**: Public.
- **Request Body** (`UserCreationRequest`):
  ```json
  {
    "username": "nguyenvana",
    "password": "Password123!",
    "email": "vana@hust.edu.vn",
    "phone": "0987654321"
  }
  ```
- **Response Body (200 OK)**:
  ```json
  {
    "code": 1000,
    "result": {
      "id": "673f8a9b1c2d3e4f5a6b7c8d",
      "username": "nguyenvana",
      "email": "vana@hust.edu.vn",
      "phone": "0987654321",
      "active": true,
      "roles": [
        { "name": "USER", "description": "Người dùng web thông thường" }
      ],
      "assignedZones": []
    }
  }
  ```

#### 3.3.2. Lấy danh sách người dùng (`GET /api/v1/users`)
- **Quyền hạn**: `hasAuthority('ADMIN')`
- **Query Parameters**:
  - `page` (`int`, default `0`): Chỉ số trang.
  - `size` (`int`, default `10`): Kích thước trang.
  - `sortBy` (`String`, default `"createdAt"`): Trường sắp xếp (`"username"`, `"createdAt"`, `"email"`).
  - `sortDir` (`String`, default `"desc"`): Chiều sắp xếp (`"asc"`, `"desc"`).
- **Response Body (200 OK)**: `ApiResponse<PageResponse<UserResponse>>`.

#### 3.3.3. Lấy hồ sơ tài khoản hiện tại (`GET /api/v1/users/myInfo`)
- **Quyền hạn**: Bất kỳ người dùng nào đã xác thực (`Authenticated`).
- **Response Body (200 OK)**: `ApiResponse<UserResponse>` chứa thông tin cá nhân, danh sách roles, permissions và `assignedZones`.

#### 3.3.4. Đổi mật khẩu cá nhân (`POST /api/v1/users/change-password`)
- **Quyền hạn**: `Authenticated`.
- **Request Body** (`PasswordChangeRequest`):
  ```json
  {
    "oldPassword": "CurrentPassword123!",
    "newPassword": "NewStrongPassword456!"
  }
  ```
- **Xử lý ngầm**: Hệ thống cập nhật `user.credentialsUpdatedAt = Instant.now()`. Toàn bộ token cũ phát hành trước thời điểm này sẽ bị vô hiệu hóa tức thì.
- **Response Body (200 OK)**:
  ```json
  {
    "code": 1000,
    "message": "Password changed successfully"
  }
  ```

#### 3.3.5. Cập nhật thông tin & Phân quyền vùng (`PUT /api/v1/users/{userId}`)
- **Quyền hạn**: `hasAuthority('ADMIN')`.
- **Request Body** (`UserUpdateRequest`):
  ```json
  {
    "email": "thuthu_tang2@hust.edu.vn",
    "phone": "0912345678",
    "roles": ["ZONE_MANAGER"],
    "assignedZones": ["ZONE_TANG_2", "ZONE_KHO_SACH"]
  }
  ```
- **Response Body (200 OK)**: `ApiResponse<UserResponse>` đã cập nhật.

#### 3.3.6. Khóa / Mở khóa tài khoản (`PATCH /api/v1/users/{userId}/status`)
- **Quyền hạn**: `hasAuthority('ADMIN')`.
- **Request Body** (`UserStatusRequest`):
  ```json
  {
    "active": false
  }
  ```
- **Ràng buộc an ninh**: Admin không được phép tự khóa tài khoản của chính mình (`ErrorCode.CANNOT_DEACTIVATE_SELF`).

#### 3.3.7. Xóa người dùng (`DELETE /api/v1/users/{userId}`)
- **Quyền hạn**: `hasAuthority('ADMIN')`.
- **Ràng buộc an ninh**: Admin không được phép tự xóa tài khoản của chính mình (`ErrorCode.CANNOT_DELETE_SELF`).

---

### 3.4. Nhóm 3: Vai Trò & Phân Quyền (`/api/v1/roles`, `/api/v1/permissions`)
- **Đối tượng sử dụng chính**: Admin Console (Toàn quyền ADMIN quản trị danh mục quyền và vai trò hệ thống).
- **Controllers**: `RoleController.java:1-48`, `PermissionController.java:1-45`
- **Quyền hạn chung**: Chỉ duy nhất người dùng có vai trò `ADMIN` mới có quyền truy cập nhóm endpoint này.

| Method | Endpoint | Mô tả | Request Body / Params |
| :---: | :--- | :--- | :--- |
| `POST` | `/api/v1/roles` | Tạo mới một vai trò | `RoleRequest` (`name`, `description`, `permissions`) |
| `GET` | `/api/v1/roles` | Danh sách toàn bộ vai trò và quyền nhúng | Không |
| `PUT` | `/api/v1/roles/{name}` | Cập nhật mô tả và danh sách quyền của vai trò | `RoleRequest` |
| `DELETE`| `/api/v1/roles/{name}` | Xóa vai trò (Cấm xóa vai trò hệ thống: `ADMIN`, `LIBRARIAN`...) | Không |
| `POST` | `/api/v1/permissions` | Tạo mới một quyền hạn | `PermissionRequest` (`name`, `description`) |
| `GET` | `/api/v1/permissions` | Liệt kê toàn bộ quyền hạn trong hệ thống | Không |
| `DELETE`| `/api/v1/permissions/{name}`| Xóa quyền hạn (Cấm xóa nếu đang gán cho vai trò nào đó) | Không |

---

### 3.5. Nhóm 4: Không Gian Phòng Đọc (`/api/v1/rooms`)
- **Đối tượng sử dụng chính**: Frontend Web UI (Floorplan bản đồ số 2D, Dashboard danh sách phòng), Kiosk công cộng tra cứu, Thủ thư & Quản lý phân khu.
- **Controller**: `src/main/java/com/example/AIoTLibTQB/controller/RoomController.java:1-83`

#### 3.5.1. Tạo mới phòng đọc (`POST /api/v1/rooms`)
- **Quyền hạn**: `hasAnyAuthority('ADMIN', 'LIBRARIAN')`.
- **Request Body** (`RoomCreationRequest`):
  ```json
  {
    "code": "P201",
    "name": "Phòng Tự Học Yên Tĩnh 201",
    "floor": 2,
    "capacity": 80,
    "description": "Khu vực tự học chuyên sâu lầu 2 phía Đông",
    "targetComfortScore": 85.0,
    "type": "STUDY_ROOM",
    "boundaryPolygon": [
      { "x": 10.5, "y": 20.0 },
      { "x": 40.0, "y": 20.0 },
      { "x": 40.0, "y": 60.0 },
      { "x": 10.5, "y": 60.0 }
    ]
  }
  ```
- **Response Body (200 OK)** (`ApiResponse<RoomResponse>`):
  ```json
  {
    "code": 1000,
    "result": {
      "id": "673f8a9b1c2d3e4f5a6b7c8e",
      "code": "P201",
      "name": "Phòng Tự Học Yên Tĩnh 201",
      "floor": 2,
      "capacity": 80,
      "description": "Khu vực tự học chuyên sâu lầu 2 phía Đông",
      "targetComfortScore": 85.0,
      "type": "STUDY_ROOM",
      "boundaryPolygon": [
        { "x": 10.5, "y": 20.0 },
        { "x": 40.0, "y": 20.0 },
        { "x": 40.0, "y": 60.0 },
        { "x": 10.5, "y": 60.0 }
      ],
      "createdAt": "2026-10-30T10:00:00Z"
    }
  }
  ```

#### 3.5.2. Lấy danh sách phòng có phân trang (`GET /api/v1/rooms`)
- **Quyền hạn**: Mọi vai trò giám sát và bạn đọc (`ADMIN`, `LIBRARIAN`, `ZONE_MANAGER`, `MAINTENANCE`, `VIEWER`, `USER`).
- **Query Parameters**:
  - `page` (`int`, default `0`): Trang hiện tại.
  - `size` (`int`, default `10`): Số lượng phòng/trang.
  - `floor` (`Integer`, optional): Lọc theo tầng (ví dụ `floor=2`).
- **Response Body (200 OK)**: `ApiResponse<PageResponse<RoomResponse>>`.

#### 3.5.3. Tra cứu chi tiết phòng theo ID hoặc Code
- `GET /api/v1/rooms/{id}`: Tra cứu theo mã ID MongoDB ObjectId.
- `GET /api/v1/rooms/code/{code}`: Tra cứu theo mã phòng viết hoa (ví dụ `P201`, `KHO101`).

#### 3.5.4. Xóa phòng (`DELETE /api/v1/rooms/{id}`)
- **Quyền hạn**: `hasAuthority('ADMIN')` hoặc `hasAuthority('LIBRARIAN')`.
- **Ràng buộc toàn vẹn dữ liệu**: Nếu phòng còn liên kết với bất kỳ thiết bị IoT nào (`deviceRepository.existsByRoomId(id)`), hệ thống lập tức từ chối và trả về lỗi `ErrorCode.ROOM_HAS_DEVICES` (mã code `5006`).

---

### 3.6. Nhóm 5: Thiết Bị IoT ESP32-S3 (`/api/v1/devices`)
- **Đối tượng sử dụng chính**: Trạm đo phần cứng ESP32-S3 (`authenticate`, `heartbeat`), Admin & Kỹ sư phần cứng (Đăng ký node, Khám phá discovery, Cấp lại API key).
- **Controller**: `src/main/java/com/example/AIoTLibTQB/controller/DeviceController.java:1-124`

#### 3.6.1. Thiết bị xác thực lấy Device JWT (`POST /api/v1/devices/authenticate`)
- **Mô tả**: Node IoT ESP32-S3 gửi mã phần cứng và khóa API thô đã được cấp để nhận Device Token (thời hạn 8 giờ) có quyền `WRITE_SENSOR_DATA`.
- **Quyền hạn**: Public (Rate limit 10/phút).
- **Request Body** (`DeviceAuthRequest`):
  ```json
  {
    "hardwareId": "ESP32S3_ZONE_A_001",
    "apiKey": "4f9d8a7c2e1b4f3a9d8c7e6b5a4f3e2d"
  }
  ```
- **Response Body (200 OK)**:
  ```json
  {
    "code": 1000,
    "result": {
      "token": "<device_jwt_token_8h>",
      "refreshToken": null
    }
  }
  ```
- **Lỗi thường gặp**:
  - `401 Unauthorized` (`3003: INVALID_API_KEY`): Sai API Key hoặc chưa được cấp.
  - `403 Forbidden` (`3002: DEVICE_INACTIVE`): Thiết bị đang bị vô hiệu hóa.

#### 3.6.2. Xem các thiết bị mới phát hiện qua MQTT (`GET /api/v1/devices/discovered`)
- **Mô tả**: Khi một node mới cắm nguồn và phát tin MQTT lên topic `devices/+/status` hoặc `telemetry`, hệ thống tự động ghi nhận vào bộ đệm RAM in-memory `DiscoveredDeviceService`. Quản trị viên vào màn hình này để bấm đăng ký node vào không gian phòng.
- **Quyền hạn**: `hasAnyAuthority('ADMIN', 'LIBRARIAN')`.
- **Response Body (200 OK)**: `ApiResponse<List<DiscoveredDeviceResponse>>`.

#### 3.6.3. Đăng ký thiết bị vào hệ thống (`POST /api/v1/devices`)
- **Mô tả**: Đăng ký node mới vào CSDL, gắn tọa độ 2D và gán phòng. Trả về API Key thô đúng **một lần duy nhất**.
- **Quyền hạn**: `hasAnyAuthority('ADMIN', 'LIBRARIAN')`.
- **Request Body** (`DeviceRegistrationRequest`):
  ```json
  {
    "name": "Node Giám Sát Bàn Học 1",
    "hardwareId": "ESP32S3_ZONE_A_001",
    "zoneId": "ZONE_TANG_2",
    "roomId": "673f8a9b1c2d3e4f5a6b7c8e",
    "posX": 15.5,
    "posY": 25.0,
    "deviceType": "ESP32-S3",
    "location": "Góc đông nam, cột số 3",
    "firmwareVersion": "1.2.0"
  }
  ```
- **Response Body (200 OK)** (`ApiResponse<DeviceRegistrationResponse>`):
  ```json
  {
    "code": 1000,
    "result": {
      "id": "673f8a9b1c2d3e4f5a6b7c90",
      "name": "Node Giám Sát Bàn Học 1",
      "hardwareId": "ESP32S3_ZONE_A_001",
      "apiKey": "4f9d8a7c2e1b4f3a9d8c7e6b5a4f3e2d",
      "zoneId": "ZONE_TANG_2",
      "roomId": "673f8a9b1c2d3e4f5a6b7c8e",
      "posX": 15.5,
      "posY": 25.0,
      "deviceType": "ESP32-S3",
      "active": true
    }
  }
  ```

#### 3.6.4. Thu hồi & Cấp lại API Key (`POST /api/v1/devices/{id}/regenerate-key`)
- **Mô tả**: Vô hiệu hóa khóa cũ, sinh khóa ngẫu nhiên mới, băm BCrypt vào CSDL và trả về khóa mới duy nhất một lần.
- **Quyền hạn**: `hasAnyAuthority('ADMIN', 'LIBRARIAN')`.

#### 3.6.5. Tín hiệu nhịp tim duy trì kết nối (`POST /api/v1/devices/{id}/heartbeat`)
- **Mô tả**: Cập nhật `lastSeenAt = Instant.now()`.
- **Quyền hạn**: `hasAnyAuthority('ADMIN', 'DEVICE')`.

---

### 3.7. Nhóm 6: Cảnh Báo Vi Khí Hậu (`/api/v1/alerts`)
- **Đối tượng sử dụng chính**: Thủ thư, Nhân viên trực ban và Kỹ sư bảo trì (Alert Center M06), Hệ thống cảnh báo tự động qua WebSocket STOMP.
- **Controller**: `src/main/java/com/example/AIoTLibTQB/controller/AlertController.java:1-85`

#### 3.7.1. Lấy danh sách cảnh báo (`GET /api/v1/alerts`)
- **Quyền hạn**: `hasAuthority('VIEW_ALERTS')`.
- **Query Parameters**:
  - `roomId` (`String`, optional): Lọc theo phòng.
  - `type` (`AlertType`, optional): `NOISE_EXCEEDED`, `AIR_UNHEALTHY`, `DEVICE_OFFLINE`, `SENSOR_MALFUNCTION`.
  - `status` (`AlertStatus`, optional): `PENDING`, `FIRING`, `ACKNOWLEDGED`, `RESOLVED`.
  - `page` (`int`, default `0`), `size` (`int`, default `10`).
  - `sortBy` (`String`, default `"startedAt"`): Whitelist gồm `"startedAt"`, `"severity"`, `"status"`, `"type"`, `"createdAt"`.
  - `direction` (`String`, default `"DESC"`): `"ASC"`, `"DESC"`.
- **Phân quyền vùng ngầm**: Đối với người dùng có vai trò `ZONE_MANAGER`, hệ thống tự động lọc chỉ trả về cảnh báo thuộc các thiết bị/phòng trong `user.assignedZones`.
- **Response Body (200 OK)**:
  ```json
  {
    "code": 1000,
    "result": {
      "content": [
        {
          "id": "673f9b1c2d3e4f5a6b7c8e01",
          "deviceId": "673f8a9b1c2d3e4f5a6b7c90",
          "hardwareId": "ESP32S3_ZONE_A_001",
          "roomId": "673f8a9b1c2d3e4f5a6b7c8e",
          "type": "NOISE_EXCEEDED",
          "status": "FIRING",
          "currentValue": 68.5,
          "threshold": 55.0,
          "message": "Mức ồn trung bình (68.5 dBA) vượt ngưỡng cho phép (55.0 dBA)",
          "startedAt": "2026-10-30T10:15:30Z",
          "acknowledgedAt": null,
          "acknowledgedBy": null
        }
      ],
      "page": 0,
      "size": 10,
      "totalElements": 1,
      "totalPages": 1,
      "last": true
    }
  }
  ```

#### 3.7.2. Đếm số lượng cảnh báo chưa đọc (`GET /api/v1/alerts/unread-count`)
- **Quyền hạn**: `hasAuthority('VIEW_ALERTS')`.
- **Response Body (200 OK)**: Trả về số lượng cảnh báo đang ở trạng thái `FIRING`.

#### 3.7.3. Tiếp nhận cảnh báo (`POST /api/v1/alerts/{id}/acknowledge`)
- **Quyền hạn**: `hasAuthority('ACKNOWLEDGE_ALERT')`.
- **Mô tả**: Nhân viên thư viện hoặc kỹ thuật viên bấm xác nhận đang xử lý sự cố. FSM chuyển trạng thái: `FIRING` $\to$ `ACKNOWLEDGED`. Tự động lưu `acknowledgedBy = currentUser.getUsername()`.

#### 3.7.4. Đóng thủ công cảnh báo (`POST /api/v1/alerts/{id}/resolve`)
- **Quyền hạn**: `hasAuthority('MANAGE_ALERT_CONFIG')`.
- **Mô tả**: Đóng sự cố và kết thúc cảnh báo. FSM chuyển trạng thái `RESOLVED`.

---

### 3.8. Nhóm 7: Giám Sát Dữ Liệu Đo Đạc & Downsampling (`/api/v1/telemetry`)
- **Đối tượng sử dụng chính**: Frontend Web UI (Biểu đồ Telemetry Explorer M07, Bản đồ nhiệt Heatmap M04, Chi tiết phòng M05), Kiosk công cộng hiển thị điểm LCS, Tiến trình trích xuất báo cáo định kỳ.
- **Controller**: `src/main/java/com/example/AIoTLibTQB/controller/TelemetryController.java:1-227`
- **Quyền hạn chung**: `@PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN', 'ZONE_MANAGER', 'MAINTENANCE', 'USER', 'VIEWER')")`.

#### 3.8.1. Lấy dữ liệu vi khí hậu mới nhất của phòng (`GET /api/v1/telemetry/room/{roomId}/latest`)
- **Mô tả**: Trả về gói telemetry kèm điểm LCS tính toán mới nhất từ bộ đệm RAM L1 `LatestTelemetryCache` (đáp ứng dưới 2ms, zero DB hit).
- **Response Body (200 OK)** (`ApiResponse<TelemetryResponse>`):
  ```json
  {
    "code": 1000,
    "result": {
      "id": "673fa123456789abcdef0123",
      "timestamp": "2026-10-30T10:30:15Z",
      "metadata": {
        "deviceId": "673f8a9b1c2d3e4f5a6b7c90",
        "hardwareId": "ESP32S3_ZONE_A_001",
        "roomId": "673f8a9b1c2d3e4f5a6b7c8e"
      },
      "acoustics": {
        "noiseAvg": 38.2,
        "noisePeak": 52.0
      },
      "airQuality": {
        "pm1_0": 4.5,
        "pm2_5": 8.2,
        "pm4_0": 11.0,
        "pm10": 14.3
      },
      "environment": {
        "temperature": 24.2,
        "humidity": 52.0,
        "lux": 450.0
      },
      "comfortScore": {
        "overall": 96.5,
        "grade": "Platinum",
        "acousticScore": 95.2,
        "airScore": 100.0,
        "thermalScore": 97.5,
        "lightScore": 100.0
      },
      "wifiRssi": -58
    }
  }
  ```

#### 3.8.2. Downsampling Chuỗi Thời Gian (`GET /api/v1/telemetry/room/{roomId}/buckets`)
- **Mô tả**: Tổng hợp và nén chuỗi thời gian triệu bản ghi thành các bucket thống kê bằng toán tử `$dateTrunc` của MongoDB Aggregation Pipeline.
- **Query Parameters**:
  - `interval` (`String`, default `"1h"`): Bước nhảy thời gian. Chỉ hỗ trợ 3 giá trị: `"15m"`, `"1h"`, `"1d"`.
  - `start` (`Instant ISO-8601`, optional): Mốc thời gian bắt đầu (mặc định 24 giờ trước).
  - `end` (`Instant ISO-8601`, optional): Mốc thời gian kết thúc (mặc định hiện tại).
- **Ràng buộc giới hạn an toàn**:
  - `start` phải trước `end` (`ErrorCode.INVALID_TIME_RANGE`).
  - Tổng số buckets sinh ra không được vượt quá **1000** (`ErrorCode.TOO_MANY_BUCKETS`), tránh làm tràn bộ nhớ CSDL.
- **Response Body (200 OK)** (`ApiResponse<TelemetryBucketResponse>`):
  ```json
  {
    "code": 1000,
    "result": {
      "roomId": "673f8a9b1c2d3e4f5a6b7c8e",
      "interval": "1h",
      "dataPoints": [
        {
          "bucket": "2026-10-30T09:00:00Z",
          "comfortScoreAvg": 94.2,
          "comfortScoreMin": 88.0,
          "comfortScoreMax": 98.0,
          "tempAvg": 24.1,
          "humidityAvg": 51.5,
          "noiseAvg": 41.2,
          "pm25Avg": 9.5,
          "luxAvg": 460.0,
          "sampleCount": 360
        },
        {
          "bucket": "2026-10-30T10:00:00Z",
          "comfortScoreAvg": 95.8,
          "comfortScoreMin": 91.5,
          "comfortScoreMax": 99.0,
          "tempAvg": 24.3,
          "humidityAvg": 50.8,
          "noiseAvg": 39.0,
          "pm25Avg": 8.8,
          "luxAvg": 475.0,
          "sampleCount": 360
        }
      ]
    }
  }
  ```

#### 3.8.3. Báo cáo Tóm tắt Toàn Thư viện (`GET /api/v1/telemetry/overview/summary`)
- **Mô tả**: Trả về thống kê toàn diện: tổng số phòng giám sát, điểm LCS trung bình toàn thư viện, phòng có chất lượng vi khí hậu tốt nhất (`bestRoom`), và phòng có chất lượng kém nhất (`worstRoom`) phục vụ hiển thị Widget Dashboard quản trị.
- **Response Body (200 OK)**: `ApiResponse<TelemetrySummaryResponse>`.

---

### 3.9. Danh Mục Toàn Bộ 46 Mã Lỗi Hệ Thống (`ErrorCode.java`)

Toàn bộ các mã lỗi được định nghĩa tập trung tại `src/main/java/com/example/AIoTLibTQB/enums/ErrorCode.java:1-80` và được chuẩn hóa phản hồi tự động qua `GlobalExceptionHandler.java`:

| Mã Lỗi (`code`) | Enum Hằng Số | HTTP Status | Thông Điệp Mặc Định | Nguyên Nhân Phát Sinh & Giải Quyết |
| :---: | :--- | :---: | :--- | :--- |
| **9999** | `UNCATEGORIZED_EXCEPTION` | 500 Internal Server | Uncategorized exception | Lỗi không mong muốn trong mã nguồn backend; kiểm tra log máy chủ. |
| **1001** | `USER_EXISTED` | 400 Bad Request | User already existed | Tên đăng nhập đã được đăng ký từ trước. |
| **1002** | `USERNAME_INVALID` | 400 Bad Request | Username must be at least 6 characters | Tên đăng nhập ngắn hơn 6 ký tự. |
| **1003** | `PASSWORD_INVALID` | 400 Bad Request | Password must be at least 8 characters | Mật khẩu ngắn hơn 8 ký tự. |
| **1004** | `INVALID_MESSAGE_KEY` | 400 Bad Request | Validation key is invalid | Khóa thông điệp validation không tồn tại trong từ điển. |
| **1005** | `USER_DID_NOT_EXIST` | 404 Not Found | User does not exist | Không tìm thấy người dùng với định danh hoặc username yêu cầu. |
| **1006** | `UNAUTHENTICATED` | 401 Unauthorized | Unauthenticated | Chưa xác thực, token thiếu, chữ ký sai, hoặc token đã hết hạn. |
| **1007** | `UNAUTHORIZED` | 403 Forbidden | You do not have permission | Người dùng không đủ quyền hạn (thiếu role/permission). |
| **1008** | `USER_INACTIVE` | 403 Forbidden | Account is disabled. Please contact administrator | Tài khoản người dùng đang ở trạng thái bị khóa (`active = false`). |
| **1009** | `USERNAME_REQUIRED` | 400 Bad Request | Username is required | Thiếu trường username trong yêu cầu tạo tài khoản. |
| **1010** | `PASSWORD_REQUIRED` | 400 Bad Request | Password is required | Thiếu trường password trong yêu cầu tạo tài khoản. |
| **1011** | `OLD_PASSWORD_INCORRECT` | 400 Bad Request | Current password does not match | Mật khẩu hiện tại nhập vào không chính xác khi đổi mật khẩu. |
| **1012** | `PASSWORD_SAME_AS_OLD` | 400 Bad Request | New password must be different from current password | Mật khẩu mới trùng với mật khẩu cũ. |
| **1013** | `CANNOT_DEACTIVATE_SELF` | 400 Bad Request | Cannot deactivate your own account | Quản trị viên không được phép tự khóa tài khoản của chính mình. |
| **1014** | `CANNOT_DELETE_SELF` | 400 Bad Request | Cannot delete your own account | Quản trị viên không được phép tự xóa tài khoản của chính mình. |
| **1015** | `TOKEN_REQUIRED` | 400 Bad Request | Token is required | Thiếu token trong body request của endpoint introspect/refresh. |
| **2001** | `ROLE_EXISTED` | 400 Bad Request | Role already existed | Tên vai trò đã tồn tại trong CSDL. |
| **2002** | `ROLE_NOT_EXISTED` | 404 Not Found | Role does not exist | Không tìm thấy vai trò cần cập nhật hoặc gán. |
| **2003** | `PERMISSION_EXISTED` | 400 Bad Request | Permission already existed | Quyền hạn đã tồn tại. |
| **2004** | `PERMISSION_NOT_EXISTED` | 404 Not Found | Permission does not exist | Quyền hạn không tồn tại. |
| **2005** | `PERMISSION_IN_USE` | 400 Bad Request | Permission is currently in use by one or more roles | Không thể xóa quyền khi đang được gán cho một hoặc nhiều vai trò. |
| **2006** | `CANNOT_DELETE_SYSTEM_ROLE`| 400 Bad Request | Cannot delete system default role | Cấm xóa các vai trò cốt lõi của hệ thống (`ADMIN`, `USER`...). |
| **2007** | `ROLE_NAME_REQUIRED` | 400 Bad Request | Role name is required | Thiếu tên vai trò khi khởi tạo. |
| **2008** | `PERMISSION_NAME_REQUIRED`| 400 Bad Request | Permission name is required | Thiếu tên quyền hạn khi khởi tạo. |
| **3001** | `DEVICE_NOT_EXISTED` | 404 Not Found | Device does not exist | Không tìm thấy thiết bị IoT theo ID hoặc hardwareId. |
| **3002** | `DEVICE_INACTIVE` | 403 Forbidden | Device is disabled | Thiết bị đang bị vô hiệu hóa; không thể gửi dữ liệu hoặc xác thực. |
| **3003** | `INVALID_API_KEY` | 401 Unauthorized | Invalid API key | Khóa API gửi lên từ ESP32-S3 không khớp với bản băm BCrypt. |
| **3004** | `DEVICE_NAME_REQUIRED` | 400 Bad Request | Device name is required | Thiếu tên thiết bị trong payload đăng ký. |
| **3005** | `HARDWARE_ID_REQUIRED` | 400 Bad Request | Hardware ID is required | Thiếu Hardware ID (MAC Address). |
| **3006** | `ZONE_ID_REQUIRED` | 400 Bad Request | Zone ID is required | Thiếu mã phân khu gán cho thiết bị. |
| **3007** | `DEVICE_TYPE_REQUIRED` | 400 Bad Request | Device type is required | Thiếu chủng loại phần cứng thiết bị. |
| **3008** | `API_KEY_REQUIRED` | 400 Bad Request | API key is required | Thiếu khóa API khi gọi endpoint xác thực thiết bị. |
| **4029** | `TOO_MANY_REQUESTS` | 429 Too Many Req | Too many requests. Please try again later | Vượt quá giới hạn tần suất Bucket4j (10 req/phút). |
| **4031** | `ZONE_ACCESS_DENIED` | 403 Forbidden | You do not have access to this zone | `ZONE_MANAGER` cố tình truy cập thiết bị/phòng ngoài `assignedZones`. |
| **5001** | `ROOM_EXISTED` | 400 Bad Request | Room already existed | Mã phòng (`code`) đã tồn tại trong CSDL. |
| **5002** | `ROOM_NOT_EXISTED` | 404 Not Found | Room does not exist | Không tìm thấy phòng theo ID hoặc mã định danh. |
| **5003** | `ROOM_CODE_REQUIRED` | 400 Bad Request | Room code is required | Thiếu mã phòng viết hoa (`code`). |
| **5004** | `ROOM_NAME_REQUIRED` | 400 Bad Request | Room name is required | Thiếu tên hiển thị của phòng. |
| **5005** | `FLOOR_REQUIRED` | 400 Bad Request | Floor is required | Thiếu số tầng của phòng đọc. |
| **5006** | `ROOM_HAS_DEVICES` | 400 Bad Request | Cannot delete room with associated devices | Không thể xóa phòng khi vẫn còn các thiết bị IoT đang được gán. |
| **6001** | `ALERT_NOT_EXISTED` | 404 Not Found | Alert does not exist | Không tìm thấy cảnh báo theo ID yêu cầu. |
| **7001** | `INVALID_TIME_RANGE` | 400 Bad Request | Invalid time range: start must be before end | Mốc thời gian bắt đầu (`start`) lớn hơn hoặc bằng kết thúc (`end`). |
| **7002** | `TOO_MANY_BUCKETS` | 400 Bad Request | Too many buckets requested: maximum allowed is 1000 | Khoảng thời gian và bước nhảy yêu cầu sinh ra quá 1000 buckets. |
| **7003** | `INVALID_INTERVAL` | 400 Bad Request | Invalid interval: supported intervals are 15m, 1h, 1d | Bước nhảy không hợp lệ; chỉ chấp nhận `15m`, `1h`, hoặc `1d`. |
| **9001** | `INVALID_REQUEST_PAYLOAD`| 400 Bad Request | Invalid request payload | Payload JSON gửi lên sai cú pháp hoặc sai kiểu dữ liệu trường. |
| **9002** | `INVALID_PARAMETER` | 400 Bad Request | Invalid request parameter | Tham số query param hoặc path variable không hợp lệ hoặc bị thiếu. |

---

## 4. ĐỌC TIẾP

Để nắm rõ các quy ước lập trình, kiến trúc dữ liệu và cách tích hợp vào giao diện người dùng, hãy tham khảo các tài liệu liên quan:
- **Cổng thông tin & Hướng dẫn khai thác**: [`docs/00-README.md`](./00-README.md)
- **Mô hình Dữ liệu CSDL MongoDB 8.0**: [`docs/05-data-model.md`](./05-data-model.md)
- **Kiến trúc An ninh & Phân quyền RBAC**: [`docs/06-security-rbac.md`](./06-security-rbac.md)
- **Kiến trúc Giao diện Next.js 15 & Heatmap 2D**: [`docs/08-frontend.md`](./08-frontend.md)
- **Quy ước Kỹ thuật & Mẫu thiết kế chuẩn**: [`docs/10-conventions.md`](./10-conventions.md)
