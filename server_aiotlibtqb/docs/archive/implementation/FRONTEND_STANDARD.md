# TIÊU CHUẨN FRONTEND & BỘ TIÊU CHÍ REVIEW (FRONTEND ENGINEERING & REVIEW STANDARD)

> **Dự án**: AIoTLibTQB — Web Dashboard & Kiosk giám sát vi khí hậu/âm học Thư viện Tạ Quang Bửu
> **Phiên bản**: 1.0 — 2026-10-22
> **Đối tượng**: Đội Frontend, reviewer (người hoặc agent trong teamwork review), Tech Lead
> **Nguồn tham chiếu**: [FRONTEND_HANDOVER_SPEC.md](FRONTEND_HANDOVER_SPEC.md), [09_ui_blueprint.md](../analysis/09_ui_blueprint.md), [06_references.md](../analysis/06_references.md), mã nguồn backend tại commit `e62386d`
> **Nhãn bằng chứng**: `[XÁC NHẬN]` = đã thấy trong code/tài liệu · `[SUY LUẬN]` = suy ra từ nhiều dấu hiệu · `[ĐỀ XUẤT]` = quyết định thiết kế của tiêu chuẩn này, không có trong nguồn · `[CHƯA RÕ]` = xem mục 14

---

## 0. CÁCH DÙNG TÀI LIỆU

### 0.1. Thứ tự ưu tiên nguồn chuẩn (khi mâu thuẫn)
1. **Mã nguồn backend** (controller/service/DTO) — chuẩn cho hành vi hiện tại.
2. **Mục 1 của tài liệu này** (bảng sai lệch đã xác minh) — ghi đè các điểm sai trong Handover Spec.
3. [FRONTEND_HANDOVER_SPEC.md](FRONTEND_HANDOVER_SPEC.md) — chuẩn cho cấu trúc màn hình, luồng, ý định thiết kế.
4. [09_ui_blueprint.md](../analysis/09_ui_blueprint.md), [06_references.md](../analysis/06_references.md) — tham khảo UX.

### 0.2. Cấu trúc một quy tắc
Mỗi quy tắc có **Mã** (`FE-<NHÓM>-<số>`), **Mức** và **Cách kiểm** để reviewer chấm được:

| Mức | Ý nghĩa | Hệ quả khi vi phạm |
| :--- | :--- | :--- |
| **MUST** | Bắt buộc | Vi phạm = finding **Blocker** hoặc **Major** (theo cột "Mức lỗi") |
| **SHOULD** | Nên làm; được bỏ qua nếu ghi lý do trong PR | Finding **Minor** nếu không có lý do |
| **MAY** | Tuỳ chọn | Không tạo finding |

| Mức lỗi | Định nghĩa | Điều kiện merge |
| :--- | :--- | :--- |
| **Blocker** | Lỗ hổng bảo mật, lộ secret, sai hợp đồng API làm hỏng dữ liệu/luồng chính | Phải sửa trước merge |
| **Major** | Sai chức năng, thiếu UI state, sai RBAC hiển thị, hỏng a11y mức A | Phải sửa trước merge hoặc có ticket được Tech Lead duyệt |
| **Minor** | Code style, khả năng bảo trì, tối ưu nhỏ | Được merge, tạo ticket |

---

## 1. HỢP ĐỒNG ĐỒNG BỘ GIỮA BACKEND CODE, HANDOVER SPEC & FRONTEND STANDARD

> [!IMPORTANT]
> Cả 3 nguồn (**Mã nguồn Backend**, [FRONTEND_HANDOVER_SPEC.md](FRONTEND_HANDOVER_SPEC.md), và tài liệu này) đã được đồng bộ 100%. Reviewer kiểm tra các quy chuẩn cốt lõi dưới đây:

| # | Chủ đề | Quy chuẩn đã đồng bộ trên toàn hệ thống | Bằng chứng Mã nguồn |
| :-: | :--- | :--- | :--- |
| D1 | Tên 14 permission | `READ_SENSOR_DATA`, `READ_SENSOR_DETAIL`, `WRITE_SENSOR_DATA`, `VIEW_ALERTS`, `ACKNOWLEDGE_ALERT`, `MANAGE_ALERT_CONFIG`, `MANAGE_DEVICES`, `VIEW_DEVICE_STATUS`, `MANAGE_ZONES`, `VIEW_ZONE_SUMMARY`, `GENERATE_REPORT`, `VIEW_ANALYTICS`, `MANAGE_USERS`, `MANAGE_ROLES` | [Permission.java](../../../src/main/java/com/example/AIoTLibTQB/enums/Permission.java) |
| D2 | Role thiết bị & bạn đọc | `DEVICE` (`WRITE_SENSOR_DATA`); role `USER` có **0 permission** (chỉ đọc qua role authority trên `/rooms`, `/devices`, `/telemetry`) | [ApplicationInitConfig.java:151-159](../../../src/main/java/com/example/AIoTLibTQB/configuration/ApplicationInitConfig.java#L151-L159) |
| D3 | Hạng tiện nghi (`grade`, `overallGrade`) | `Platinum` (≥90), `Gold` (≥75), `Silver` (≥60), `Bronze` (≥45), `Poor` (<45); summary rỗng trả `"N/A"` | [ComfortScoreService.java](../../../src/main/java/com/example/AIoTLibTQB/service/ComfortScoreService.java), [TelemetryController.java:98,163-170](../../../src/main/java/com/example/AIoTLibTQB/controller/TelemetryController.java#L163-L170) |
| D4 | `AuthenticationResponse` | `{ token, refreshToken }` | [AuthenticationResponse.java](../../../src/main/java/com/example/AIoTLibTQB/dto/response/AuthenticationResponse.java) |
| D5 | Tạo & Sửa User (`POST /users`, `PUT /users/{id}`) | `POST /users` nhận tùy chọn `roles`, `assignedZones` (chỉ có hiệu lực khi người gọi là `ADMIN`; tự đăng ký mặc định gán `USER`). `PUT /users/{id}` kiểm quyền **trước** khi ghi DB (`ADMIN` hoặc chính chủ) | [UserCreationRequest.java](../../../src/main/java/com/example/AIoTLibTQB/dto/request/UserCreationRequest.java), [UserService.java:39-64,89-125](../../../src/main/java/com/example/AIoTLibTQB/service/UserService.java#L39-L64) |
| D6 | Logout (`POST /auth/logout`) | Nhận `{ token, refreshToken }` để blacklist đồng thời cả Access Token và Refresh Token trong 1 lần gọi | [LogoutRequest.java](../../../src/main/java/com/example/AIoTLibTQB/dto/request/LogoutRequest.java), [AuthenticationService.java:81-98](../../../src/main/java/com/example/AIoTLibTQB/service/AuthenticationService.java#L81-L98) |
| D7 | Rate limit | Áp dụng cho `/api/v1/auth/login` và `/api/v1/devices/authenticate` (10 req/phút/IP); `Retry-After` = số giây động đến lần nạp tiếp theo | [RateLimitFilter.java:34-37,82](../../../src/main/java/com/example/AIoTLibTQB/configuration/RateLimitFilter.java#L34-L37) |
| D8 | `TelemetryResponse.metadata` | `{ deviceId, hardwareId, roomId }` | [TelemetryMetadata.java](../../../src/main/java/com/example/AIoTLibTQB/document/TelemetryMetadata.java) |
| D9 | Summary (`/overview/summary`) | Tính từ `LatestTelemetryCache` (0 DB query): `roomName` = `roomId` (FE join tên phòng từ cache `rooms`); `attentionRoom` = `worstRoom`; `bottleneckReason = null` khi score ≥ 75; `totalRooms = 0` ngay sau khi restart backend | [TelemetryController.java:86-211](../../../src/main/java/com/example/AIoTLibTQB/controller/TelemetryController.java#L86-L211) |
| D10 | Quyền đọc `GET /devices` (phân trang) | Cho phép `ADMIN`, `LIBRARIAN`, `ZONE_MANAGER` (tự động lọc theo `assignedZones`), `MAINTENANCE`, `VIEWER`, `USER` (phục vụ bản đồ M04 và danh sách M10) | [DeviceService.java:114-141](../../../src/main/java/com/example/AIoTLibTQB/service/DeviceService.java#L114-L141) |
| D11 | Quyền `GET /devices/{id}` & `/zone/{z}` | `{id}`: ADMIN, LIBRARIAN, ZONE_MANAGER, MAINTENANCE. `/zone/{z}`: ADMIN, LIBRARIAN, ZONE_MANAGER (kiểm zone → `4031`) | [DeviceService.java:191-217](../../../src/main/java/com/example/AIoTLibTQB/service/DeviceService.java#L191-L217) |
| D12 | Quyền Telemetry (`/telemetry/**`) | Cho phép `ADMIN`, `LIBRARIAN`, `ZONE_MANAGER` (kiểm zone), `MAINTENANCE`, `USER`, `VIEWER` | [TelemetryController.java:28](../../../src/main/java/com/example/AIoTLibTQB/controller/TelemetryController.java#L28), [TelemetryService.java:42](../../../src/main/java/com/example/AIoTLibTQB/service/TelemetryService.java#L42) |
| D13 | Quyền Alerts (`/alerts/**`) | Kiểm theo permission: list/unread = `VIEW_ALERTS`; ack = `ACKNOWLEDGE_ALERT`; resolve = `MANAGE_ALERT_CONFIG` | [AlertController.java:29-65](../../../src/main/java/com/example/AIoTLibTQB/controller/AlertController.java#L29-L65) |
| D14 | STOMP SUBSCRIBE | Yêu cầu đã xác thực; riêng `/topic/alerts` kiểm tra quyền `VIEW_ALERTS` ngay tại `StompChannelInterceptor` | [StompChannelInterceptor.java:88-112](../../../src/main/java/com/example/AIoTLibTQB/configuration/StompChannelInterceptor.java#L88-L112) |
| D15 | `DeviceRegistrationResponse` | Có trường `rawApiKey` (hiển thị 1 lần) và `alreadyExisted: boolean` | [DeviceRegistrationResponse.java](../../../src/main/java/com/example/AIoTLibTQB/dto/response/DeviceRegistrationResponse.java) |
| D16 | Bucket nulls & Hệ tọa độ | `BucketDataPoint` có `@JsonInclude(NON_NULL)`. Hệ tọa độ `boundaryPolygon` và `(posX, posY)` chuẩn hóa tương đối trong đoạn `[0.0, 1.0]` | [BucketDataPoint.java:15](../../../src/main/java/com/example/AIoTLibTQB/dto/response/BucketDataPoint.java#L15) |

---

## 2. KIẾN TRÚC & CẤU TRÚC MÃ NGUỒN

### 2.1. Stack chốt `[ĐỀ XUẤT dựa trên Handover Spec §8.1]`
Next.js (App Router) + TypeScript `strict` · Tailwind CSS + shadcn/ui · TanStack Query v5 (server state) · Zustand (client state) · `@stomp/stompjs` · React Hook Form + Zod · Recharts · HTML5 Canvas 2D. Phiên bản cụ thể chốt trong `package.json` lúc khởi tạo (tài liệu này không xác minh phiên bản).

### 2.2. Cấu trúc thư mục chuẩn `[ĐỀ XUẤT]`
```
src/
  app/                    # route (M01–M15), chỉ ghép layout + feature
  features/<domain>/      # auth, rooms, devices, telemetry, alerts, iam, floorplan, kiosk
    api.ts                # hàm gọi REST của domain
    queries.ts            # useQuery/useMutation + queryKeys
    components/           # UI riêng domain
    schemas.ts            # Zod schema form
  lib/
    http/                 # client duy nhất, interceptor, unwrap envelope, error mapper
    realtime/             # STOMP client singleton + hooks subscribe
    rbac/                 # parse scope, capability map
    format/               # số, đơn vị, thời gian, grade→màu
  types/api.ts            # type DTO (Phụ lục A) — nguồn duy nhất
  config/thresholds.ts    # thang màu/ngưỡng hiển thị — nguồn duy nhất
```

| Mã | Mức | Quy tắc | Mức lỗi | Cách kiểm |
| :--- | :---: | :--- | :---: | :--- |
| FE-ARC-01 | MUST | Component trong `app/` và `components/` **không** gọi `fetch`/`axios` trực tiếp; chỉ qua `features/*/queries.ts` | Major | `grep -rn "fetch(\|axios\." src/app src/features/*/components` = 0 |
| FE-ARC-02 | MUST | Một và chỉ một HTTP client (`lib/http`) | Major | grep `axios.create\|new Client(` chỉ xuất hiện 1 lần mỗi loại |
| FE-ARC-03 | MUST | Mọi type DTO lấy từ `types/api.ts`; cấm khai báo lại type DTO trong component | Minor | grep `interface .*Response` ngoài `types/` |
| FE-ARC-04 | MUST | TS `strict: true`, cấm `any` không chú thích lý do (`// eslint-disable-next-line` kèm lý do) | Major | `tsconfig.json`; `grep -rn ": any" src` |
| FE-ARC-05 | SHOULD | Feature không import chéo `components/` của feature khác; dùng chung qua `components/ui` | Minor | ESLint `import/no-restricted-paths` |

---

## 3. CHUẨN TẦNG GỌI API (HTTP CONTRACT)

| Mã | Mức | Quy tắc | Mức lỗi | Cách kiểm |
| :--- | :---: | :--- | :---: | :--- |
| FE-API-01 | MUST | Base URL lấy từ env (`NEXT_PUBLIC_API_BASE_URL`), mặc định dev `http://localhost:8080/api/v1`; cấm hard-code host trong code | Major | grep `localhost:8080` ngoài `.env*`/config |
| FE-API-02 | MUST | Unwrap `ApiResponse<T>`: thành công khi `code === 1000` → trả `result`; còn lại ném `ApiError{code, message, httpStatus}` | Blocker | Unit test `lib/http` |
| FE-API-03 | MUST | Thông báo lỗi người dùng tra theo **`code`** (bảng §7 Handover Spec), không hiển thị nguyên `message` tiếng Anh của backend; fallback cho code lạ = thông báo chung + log | Major | Unit test error mapper phủ tất cả code trong [ErrorCode.java](../../../src/main/java/com/example/AIoTLibTQB/enums/ErrorCode.java) |
| FE-API-04 | MUST | Phân trang **0-based** (`page=0`); đọc `totalElements/totalPages/last` từ `PageResponse`, không tự tính | Major | Review + test |
| FE-API-05 | MUST | Thời gian gửi lên/nhận về là ISO-8601 UTC (`Instant`); chỉ đổi sang giờ địa phương ở tầng hiển thị (`Asia/Ho_Chi_Minh` `[ĐỀ XUẤT]`) | Major | grep `toLocaleString\|format(` chỉ trong `lib/format` |
| FE-API-06 | MUST | Mọi trường số trong DTO coi là **nullable** (`number \| null \| undefined`), hiển thị `--` khi thiếu (đặc biệt D16) | Major | Type ở Phụ lục A; test render với dữ liệu thiếu |
| FE-API-07 | MUST | Query key theo mẫu `[domain, scope, params]` (vd. `['alerts','list',{page,status}]`); mutation invalidate đúng key liên quan | Minor | Review `queries.ts` |
| FE-API-08 | MUST | Không gọi `GET /telemetry/room/{id}` (raw) cho biểu đồ; biểu đồ **chỉ** dùng `/buckets` | Major | grep raw endpoint ngoài M07 |
| FE-API-09 | MUST | Trước khi gọi `/buckets`, client kiểm `start < end` và `ceil((end-start)/interval) ≤ 1000` (chừa biên an toàn, cách đếm bucket chính xác của backend `[CHƯA RÕ]`); vượt ngưỡng → tự nâng interval hoặc chặn trên DatePicker | Major | Unit test hàm chọn interval |
| FE-API-10 | SHOULD | Quy tắc chọn interval mặc định: ≤ 24h → `15m`; ≤ 7 ngày → `1h`; còn lại → `1d` `[ĐỀ XUẤT]` | Minor | Unit test |
| FE-API-11 | MUST | Raw telemetry (M07) giới hạn khoảng ≤ 24h trên UI (raw endpoint không phân trang) | Major | Test DatePicker |
| FE-API-12 | MUST | Xử lý 429 (`4029`): đọc header `Retry-After` (giây, **động**), khoá nút submit + đếm ngược; không retry tự động | Major | Test M01 với MSW trả 429 |

---

## 4. XÁC THỰC & PHIÊN

| Mã | Mức | Quy tắc | Mức lỗi | Cách kiểm |
| :--- | :---: | :--- | :---: | :--- |
| FE-AUTH-01 | MUST | Access token chỉ giữ trong bộ nhớ (store không persist). Refresh token lưu `sessionStorage` cho dashboard `[ĐỀ XUẤT]`; Kiosk (§9.M02) được phép `localStorage` với tài khoản `VIEWER` riêng | Blocker | grep `localStorage.setItem` chỉ trong module kiosk |
| FE-AUTH-02 | MUST | Cấm đặt token trong URL/query string, cookie không httpOnly do FE tự tạo, log, analytics, Sentry breadcrumb | Blocker | grep `token=` trong URL; review logger |
| FE-AUTH-03 | MUST | Silent refresh **single-flight**: khi nhận 401/`1006`, chỉ một request `POST /auth/refresh` chạy; các request khác xếp hàng và phát lại với token mới. Refresh token cũ bị blacklist ngay sau khi dùng nên gọi trùng = đăng xuất ngoài ý muốn | Blocker | Unit test: 5 request 401 đồng thời → đúng 1 lần refresh |
| FE-AUTH-04 | MUST | Không refresh khi chính request lỗi là `/auth/login` hoặc `/auth/refresh`; refresh thất bại → xoá state, lưu `returnUrl`, về `/login` | Major | Unit test |
| FE-AUTH-05 | SHOULD | Đồng bộ token giữa các tab bằng `BroadcastChannel` để tab khác không dùng refresh token đã bị xoay | Minor | Test thủ công 2 tab |
| FE-AUTH-06 | MUST | Logout: gọi `POST /auth/logout` truyền `{ token: accessToken, refreshToken }` trong 1 request (D6); lỗi mạng khi logout vẫn xoá state cục bộ | Major | Test MSW kiểm tra body chứa cả 2 token |
| FE-AUTH-07 | MUST | Sau login gọi `GET /users/myInfo` để lấy hồ sơ; `401/1008 USER_INACTIVE` hiển thị thông báo tài khoản bị khoá | Major | Test M01 |
| FE-AUTH-08 | MUST | Form login validate phía client: `username`, `password` bắt buộc; form tạo user: `username ≥ 6`, `password ≥ 8` (khớp `@Size` backend) | Minor | Zod schema test |

---

## 5. PHÂN QUYỀN HIỂN THỊ (RBAC TRÊN UI)

### 5.1. Nguyên tắc
- **FE-RBAC-01 (MUST, Blocker)**: RBAC trên UI chỉ là UX; không bao giờ là ranh giới bảo mật. Không gửi dữ liệu nhạy cảm xuống client dựa vào việc "đã ẩn nút".
- **FE-RBAC-02 (MUST, Major)**: Quyền tính từ claim `scope` của access token (role và permission cách nhau bởi dấu cách, **không có tiền tố** `ROLE_` — [SecurityConfig.java:80](../../../src/main/java/com/example/AIoTLibTQB/configuration/SecurityConfig.java#L80)). Chỉ giải mã payload để đọc, không tự xác minh chữ ký.
- **FE-RBAC-03 (MUST, Major)**: Một `capability map` duy nhất trong `lib/rbac` phản chiếu **đúng biểu thức backend** (có chỗ kiểm role, có chỗ kiểm permission). Cấm rải `roles.includes('ADMIN')` trong component. Cách kiểm: grep `includes('ADMIN'` ngoài `lib/rbac` = 0.
- **FE-RBAC-04 (MUST, Major)**: Nhận 403 (`1007`/`4031`) → toast thân thiện, **không** đăng xuất, không retry.
- **FE-RBAC-05 (MUST, Major)**: Dữ liệu STOMP `/topic/alerts` chỉ hiển thị khi user có `VIEW_ALERTS` (vì backend phát cho mọi user — D14).

### 5.2. Ma trận quyền thực tế `[XÁC NHẬN trên code]`
`ADM`=ADMIN · `LIB`=LIBRARIAN · `ZM`=ZONE_MANAGER · `MNT`=MAINTENANCE · `VWR`=VIEWER · `USR`=USER

| Nhóm API | ADM | LIB | ZM | MNT | VWR | USR | Biểu thức backend |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :--- |
| `GET /rooms*` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | authenticated |
| `POST/PUT /rooms` | ✓ | ✓ | – | – | – | – | role ADMIN, LIBRARIAN |
| `DELETE /rooms/{id}` | ✓ | – | – | – | – | – | role ADMIN |
| `GET /devices` (page) | ✓ | ✓ | ✓* | ✓ | ✓ | ✓ | role + ZM tự lọc theo `assignedZones` (*) (D10) |
| `GET /devices/{id}` | ✓ | ✓ | ✓ | ✓ | – | – | role (D11) |
| `GET /devices/zone/{z}` | ✓ | ✓ | ✓* | – | – | – | role + kiểm zone (*) |
| `GET /devices/discovered`, register, update, regenerate-key, status | ✓ | ✓ | – | – | – | – | role ADMIN, LIBRARIAN |
| `DELETE /devices/{id}` | ✓ | – | – | – | – | – | role ADMIN |
| `GET /telemetry/**` | ✓ | ✓ | ✓* | ✓ | ✓ | ✓ | role (D12), ZM kiểm zone |
| `GET /alerts`, `/unread-count` | ✓ | ✓ | ✓ | ✓ | ✓ | – | perm `VIEW_ALERTS` |
| `…/acknowledge` | ✓ | ✓ | ✓ | ✓ | – | – | perm `ACKNOWLEDGE_ALERT` |
| `…/resolve` | ✓ | ✓ | – | – | – | – | perm `MANAGE_ALERT_CONFIG` |
| `GET /users` (page), status, delete | ✓ | – | – | – | – | – | role ADMIN |
| `GET/PUT /users/{id}` | ✓ | self | self | self | self | self | ADMIN hoặc chính chủ (kiểm trước khi save) |
| `/roles/**`, `/permissions/**` | ✓ | – | – | – | – | – | role ADMIN |
| STOMP `/topic/rooms/**` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | authenticated |
| STOMP `/topic/alerts` | ✓ | ✓ | ✓ | ✓ | ✓ | – | perm `VIEW_ALERTS` (D14) |

---

## 6. KÊNH THỜI GIAN THỰC (STOMP)

| Mã | Mức | Quy tắc | Mức lỗi | Cách kiểm |
| :--- | :---: | :--- | :---: | :--- |
| FE-RT-01 | MUST | Một STOMP client singleton cho toàn app (`lib/realtime`); chỉ `activate()` sau khi có access token; `deactivate()` khi logout | Major | grep `new Client(` = 1 |
| FE-RT-02 | MUST | Token gửi qua `connectHeaders.Authorization = "Bearer <token>"`; **không** qua URL. Dùng hook `beforeConnect` để nạp token mới nhất trước mỗi lần (re)connect, tránh reconnect bằng token đã hết hạn | Blocker | Review `lib/realtime` |
| FE-RT-03 | MUST | Subscribe theo vòng đời màn hình: vào M04/M05 thì subscribe `/topic/rooms/{roomId}/telemetry` cần thiết, rời màn hình phải `unsubscribe()`; cấm subscribe toàn bộ phòng khi chỉ xem 1 phòng | Major | Test: mount/unmount → số subscription về 0 |
| FE-RT-04 | MUST | Dữ liệu STOMP ghi vào cache TanStack Query qua `setQueryData` cùng key với REST `/latest`; UI chỉ đọc từ một nguồn | Major | Review |
| FE-RT-05 | MUST | So sánh `timestamp` trước khi ghi đè; bỏ bản tin cũ hơn bản đang có (thứ tự đến không đảm bảo) | Major | Unit test reducer |
| FE-RT-06 | MUST | Sự kiện alert: upsert theo `id` vào danh sách; badge `unread-count` **refetch** (không tự cộng/trừ) khi có sự kiện | Major | Unit test |
| FE-RT-07 | MUST | Mất kết nối: banner vàng "Đang kết nối lại…", tự reconnect (`reconnectDelay` 5s), fallback polling `/latest` mỗi 15s `[ĐỀ XUẤT]` cho phòng đang xem; tắt polling khi kết nối lại | Major | Test tắt backend |
| FE-RT-08 | MUST | Render 1Hz/phòng không làm re-render toàn trang: selector theo `roomId`, `React.memo`, cập nhật Canvas trong `requestAnimationFrame` | Major | React Profiler: 1 bản tin → chỉ thẻ phòng liên quan render |
| FE-RT-09 | MUST | `onStompError`/`onWebSocketClose` không in token, không in nguyên frame header | Blocker | Review |

---

## 7. TRẠNG THÁI GIAO DIỆN, HIỂN THỊ DỮ LIỆU & A11Y

### 7.1. Bốn trạng thái bắt buộc (theo Handover Spec §5.3)
**FE-UI-01 (MUST, Major)**: Mọi widget dữ liệu có đủ **Loading** (skeleton khớp bố cục, không spinner chặn toàn trang), **Empty** (thông điệp + CTA theo ngữ cảnh), **Error/Stale** (banner + nút "Thử lại"), **Realtime active** (pulse ≤ 300ms tại số thay đổi). Cách kiểm: Storybook/story hoặc test cho cả 4 trạng thái của mỗi widget.

Empty bắt buộc riêng:
- Summary `totalRooms = 0` / `overallGrade = "N/A"` → "Đang chờ dữ liệu từ trạm đo" (xảy ra sau mỗi lần restart backend — D9).
- Phòng chưa có `boundaryPolygon` → CTA sang M09.
- Discovery rỗng, bảng cảnh báo rỗng → thông điệp theo [09_ui_blueprint.md §2.2](../analysis/09_ui_blueprint.md).

### 7.2. Định dạng số & đơn vị `[ĐỀ XUẤT]`
| Chỉ số | Trường | Đơn vị | Số lẻ |
| :--- | :--- | :--- | :-: |
| Nhiệt độ | `environment.temperature` | °C | 1 |
| Độ ẩm | `environment.humidity` | %RH | 0 |
| Ánh sáng | `environment.lux` | lux | 0 |
| Độ ồn | `acoustics.noiseAvg`, `noisePeak` | dBA | 1 |
| Bụi mịn | `airQuality.pm2_5` (và `pm1_0`, `pm4_0`, `pm10`) | µg/m³ | 1 |
| Điểm tiện nghi | `comfortScore.overall` | /100 | 0 |
| RSSI | `wifiRssi` | dBm | 0 |

- **FE-UI-02 (MUST, Major)**: Định dạng tập trung ở `lib/format`; giá trị `null` → `--` + tooltip.
- **FE-UI-03 (MUST, Major)**: Thời gian tương đối (`lastSeenAt` → "3 phút trước") tự cập nhật mỗi 30s; `lastSeenAt = null` → "Chưa từng kết nối".

### 7.3. Hạng & thang màu
- **FE-UI-04 (MUST, Major)**: Ánh xạ grade theo giá trị thật (D3), đặt trong `config/thresholds.ts`:

| Grade (backend) | Ngưỡng `overall` | Màu `[ĐỀ XUẤT]` | Nhãn VI |
| :--- | :-: | :--- | :--- |
| `Platinum` | ≥ 90 | `#10B981` emerald-500 | Tối ưu |
| `Gold` | 75–89.99 | `#22C55E` green-500 | Tốt |
| `Silver` | 60–74.99 | `#F59E0B` amber-500 | Chú ý |
| `Bronze` | 45–59.99 | `#F97316` orange-500 | Kém |
| `Poor` | < 45 | `#EF4444` red-500 | Cảnh báo |
| `N/A` / OFFLINE | — | `#64748B` slate-500 | Không có dữ liệu |

- **FE-UI-05 (MUST, Major)**: Ngưỡng cảnh báo hiển thị trong bảng alert lấy từ `AlertResponse.threshold`, **không** hard-code ở FE. Thang màu chỉ số (noise/PM) cho heatmap đặt ở một file config duy nhất.
- **FE-UI-06 (MUST, Major)**: Thẻ "Phòng cần chú ý" phải join `roomId` với danh sách rooms để lấy tên (D9); nếu `attentionRoom.roomId === bestRoom.roomId` (chỉ có 1 phòng) thì ẩn thẻ "cần chú ý". `bottleneckReason = null` → hiển thị "Đạt chuẩn".

### 7.4. Accessibility & ngôn ngữ
| Mã | Mức | Quy tắc | Mức lỗi |
| :--- | :---: | :--- | :---: |
| FE-A11Y-01 | MUST | Mục tiêu WCAG 2.1 AA; trạng thái không chỉ truyền đạt bằng màu (kèm icon + chữ: ONLINE/OFFLINE, grade) | Major |
| FE-A11Y-02 | MUST | Tương phản chữ ≥ 4.5:1 (cả dark mode Kiosk) | Major |
| FE-A11Y-03 | MUST | Toàn bộ thao tác dùng được bằng bàn phím; dialog bẫy focus và trả focus khi đóng | Major |
| FE-A11Y-04 | MUST | Toast cảnh báo dùng `aria-live` (`assertive` cho `FIRING`, `polite` cho còn lại); âm báo phải do người dùng bật (trình duyệt chặn autoplay) | Minor |
| FE-A11Y-05 | MUST | Canvas heatmap có phương án thay thế: bảng/list giá trị theo phòng cho trình đọc màn hình | Major |
| FE-A11Y-06 | MUST | UI tiếng Việt; chuỗi hiển thị gom vào một nơi (`messages/vi.ts`) để sẵn sàng i18n | Minor |

---

## 8. BIỂU ĐỒ, BẢN ĐỒ NHIỆT & TRÌNH VẼ ĐA GIÁC

| Mã | Mức | Quy tắc | Mức lỗi | Cách kiểm |
| :--- | :---: | :--- | :---: | :--- |
| FE-VIZ-01 | MUST | Biểu đồ M05 vẽ dải Min–Max + đường Avg từ `/buckets`; khoảng trống dữ liệu hiển thị đứt đoạn, không nối thẳng | Major | Story với bucket thiếu |
| FE-VIZ-02 | MUST | Mọi phép đổi toạ độ `boundaryPolygon`/`posX,posY` (hệ chuẩn hoá tương đối `[0.0, 1.0]`) ↔ pixel nằm trong **một** module `floorplan/coords.ts` | Major | grep phép nhân scale ngoài module |
| FE-VIZ-03 | MUST | Heatmap: `ctx.save()` → path đa giác → `ctx.clip()` → tô → `ctx.restore()` theo từng phòng; màu không tràn ra ngoài đa giác | Major | Test ảnh chụp (visual snapshot) |
| FE-VIZ-04 | MUST | IDW chỉ dùng thiết bị `connectionState = "ONLINE"` có giá trị; phòng không còn thiết bị hợp lệ → tô `slate-500` | Major | Unit test hàm IDW |
| FE-VIZ-05 | MUST | Hàm IDW là hàm thuần (không phụ thuộc DOM), có unit test (1 điểm, 2 điểm, điểm trùng vị trí thiết bị, ε > 0) | Major | Test |
| FE-VIZ-06 | MUST | Canvas xử lý `devicePixelRatio` (không mờ trên màn hình HiDPI/TV 4K) | Minor | Kiểm thủ công |
| FE-VIZ-07 | SHOULD | Tính lưới IDW chỉ khi dữ liệu đổi; nếu > 16ms/khung hình thì chuyển sang Web Worker/OffscreenCanvas | Minor | Performance profile |
| FE-VIZ-08 | MUST | Trình vẽ M09: đa giác ≥ 3 đỉnh, không tự cắt (self-intersect) trước khi `PUT`; thiết bị kéo-thả phải nằm trong đa giác phòng | Major | Unit test validator |
| FE-VIZ-09 | MUST | Màn hình bản đồ xử lý trường hợp không lấy được danh sách thiết bị (403 với role ≠ ADM/LIB — D10): vẫn vẽ đa giác + màu theo `/telemetry/room/{id}/latest`, ẩn marker | Major | Test với role VIEWER |

---

## 9. TIÊU CHÍ NGHIỆM THU THEO MÀN HÌNH (ĐÃ HIỆU CHỈNH THEO CODE)

| Mã | Role được vào (route guard) | Điểm review bắt buộc |
| :-: | :--- | :--- |
| **M01** Login | Public | FE-AUTH-03/04/07/08, FE-API-12; điều hướng sau login về `/dashboard` (M03) hoặc `returnUrl` |
| **M02** Kiosk | VWR, USR (tài khoản kiosk riêng) | Đăng nhập tài khoản `VIEWER`; tự refresh dài hạn; dark mode; tự phục hồi sau mất mạng; không hiển thị dữ liệu alert nếu tài khoản là `USER` |
| **M03** Dashboard | ADM, LIB, ZM, MNT, VWR, USR | KPI từ summary (D9, FE-UI-06); khối alert chỉ hiện khi có `VIEW_ALERTS` (`USER` ẩn) |
| **M04** Floorplan | ADM, LIB, ZM, MNT, VWR, USR | §8; vẽ đa giác + marker từ `GET /devices`; `ZM` tự động chỉ nhận thiết bị trong `assignedZones` |
| **M05** Room detail | ADM, LIB, ZM, MNT, VWR, USR | FE-API-08/09/10, FE-VIZ-01, 4 thanh điểm thành phần, FE-RT-03 |
| **M06** Alerts | quyền `VIEW_ALERTS` | Nút "Tiếp nhận" chỉ khi `ACKNOWLEDGE_ALERT` và status `FIRING`; nút "Đóng" chỉ khi `MANAGE_ALERT_CONFIG` và status ≠ `RESOLVED`; FE-RT-06; lọc `type`/`status` dùng đúng enum |
| **M07** Raw explorer | ADM, LIB, ZM | FE-API-11; xuất CSV phía client không chứa `id` nội bộ không cần thiết |
| **M08** Rooms admin | ADM, LIB (xoá: ADM) | Lỗi `5001`, `5006` hiển thị hướng dẫn; xác nhận trước khi xoá |
| **M09** Polygon editor | ADM, LIB | FE-VIZ-02/08 (lưu toạ độ chuẩn hoá `[0.0, 1.0]`) |
| **M10** Devices | ADM, LIB, ZM, MNT | Badge ONLINE/OFFLINE + chữ; FE-UI-03; nút sửa/toggle `active` chỉ hiện cho ADM, LIB |
| **M11** Discovery | ADM, LIB | Xử lý `alreadyExisted = true` (D15); hộp thoại **One-time secret** cho `rawApiKey` (FE-SEC-02) |
| **M12** Device detail | Xem: ADM, LIB, ZM, MNT · Sửa: ADM, LIB · Xoá: ADM | `regenerate-key` có xác nhận 2 bước + FE-SEC-02; đổi phòng/toạ độ cập nhật lại M04 cache |
| **M13** Users | ADM | Tạo user qua 1 lệnh `POST /users` kèm `roles` và `assignedZones` (D5) |
| **M14** Roles matrix | ADM | Hàng = 14 permission **tên thật** (D1) lấy động từ `GET /permissions`, không hard-code; lỗi `2005` |
| **M15** Profile | Authenticated | Chỉ gửi `password/phone/email` (non-admin không đổi được role/zone); FE-AUTH-06 |

---

## 10. BẢO MẬT PHÍA CLIENT

| Mã | Mức | Quy tắc | Mức lỗi | Cách kiểm |
| :--- | :---: | :--- | :---: | :--- |
| FE-SEC-01 | MUST | Cấm `dangerouslySetInnerHTML`/`innerHTML` với dữ liệu từ API (tên phòng, `message` alert, `location`…) | Blocker | grep = 0 hoặc có sanitize + lý do |
| FE-SEC-02 | MUST | `rawApiKey`: chỉ hiển thị trong dialog một lần, có nút copy; **không** lưu vào Query cache (dùng `gcTime: 0` hoặc state cục bộ), store, log, URL; đóng dialog = xoá khỏi bộ nhớ | Blocker | Review + kiểm React Query Devtools |
| FE-SEC-03 | MUST | Không commit `.env` có giá trị thật; chỉ biến `NEXT_PUBLIC_*` không bí mật mới được đưa ra client | Blocker | `git ls-files .env*` |
| FE-SEC-04 | SHOULD | Bật CSP (`script-src 'self'`, `connect-src` chỉ API + WS host), `X-Frame-Options`/`frame-ancestors` | Minor | Header response |
| FE-SEC-05 | MUST | Origin FE phải nằm trong `cors.allowed-origins` của backend (mặc định dev `:3000`, `:8081`); không yêu cầu backend mở `*` | Major | Kiểm cấu hình triển khai |
| FE-SEC-06 | MUST | Thao tác phá huỷ (xoá phòng/thiết bị/user/role, regenerate-key) có dialog xác nhận nêu rõ hậu quả | Major | Review UI |

---

## 11. HIỆU NĂNG `[ĐỀ XUẤT — mục tiêu, chưa đo]`

| Mã | Mức | Chỉ tiêu | Cách kiểm |
| :--- | :---: | :--- | :--- |
| FE-PERF-01 | SHOULD | LCP ≤ 2.5s, CLS ≤ 0.1 trên Dashboard (Lighthouse, máy dev, build production) | Lighthouse CI |
| FE-PERF-02 | SHOULD | JS tải đầu cho route `/dashboard` ≤ 250KB gzip; thư viện chart/canvas tải lazy theo route | `next build` output |
| FE-PERF-03 | MUST | Không polling song song với STOMP đang kết nối (FE-RT-07) | Network tab |
| FE-PERF-04 | MUST | Danh sách > 100 dòng dùng phân trang server; không tải toàn bộ rồi lọc client | Review |
| FE-PERF-05 | SHOULD | Độ trễ hiển thị từ lúc nhận frame STOMP đến khi DOM cập nhật ≤ 100ms (phục vụ mục tiêu E2E ≤ 1.5s của backend) | Performance profile |

---

## 12. KIỂM THỬ & CỔNG CHẤT LƯỢNG

| Mã | Mức | Quy tắc | Mức lỗi |
| :--- | :---: | :--- | :---: |
| FE-TEST-01 | MUST | CI chạy: `tsc --noEmit`, ESLint (0 error), unit test, `next build` — tất cả xanh mới được merge | Blocker |
| FE-TEST-02 | MUST | Unit test bắt buộc cho: unwrap envelope + error mapper (mọi `ErrorCode`), refresh single-flight, capability map (đối chiếu bảng §5.2), chọn interval/giới hạn bucket, grade→màu, IDW, validator đa giác, reducer STOMP (timestamp, upsert alert) | Major |
| FE-TEST-03 | MUST | Mock API bằng MSW dựng từ type Phụ lục A và ví dụ JSON thật (không tự bịa trường) | Major |
| FE-TEST-04 | SHOULD | E2E (Playwright) cho 3 luồng: login→dashboard; alert FIRING→acknowledge→resolve; claim thiết bị + one-time key | Minor |
| FE-TEST-05 | SHOULD | Coverage dòng ≥ 70% cho `lib/` và `features/*/queries.ts` `[ĐỀ XUẤT]` | Minor |
| FE-TEST-06 | MUST | Mỗi PR thay đổi UI kèm ảnh chụp/clip cho trạng thái chính + 1 trạng thái lỗi | Minor |

---

## 13. QUY TRÌNH REVIEW THEO NHÓM (TEAMWORK REVIEW)

### 13.1. Chia trục review (mỗi reviewer/agent một trục, chỉ đọc)
| Trục | Phạm vi quy tắc | Đầu vào tối thiểu |
| :--- | :--- | :--- |
| **R1 — Contract & Data** | §1, FE-API-*, FE-ARC-03/04, Phụ lục A | `lib/http`, `types/api.ts`, `features/*/api.ts` |
| **R2 — Auth, RBAC & Security** | FE-AUTH-*, FE-RBAC-*, FE-SEC-*, §5.2 | `lib/http`, `lib/rbac`, route guard, M11/M12/M13 |
| **R3 — Realtime & State** | FE-RT-*, FE-API-07, FE-PERF-03/05 | `lib/realtime`, `queries.ts`, M03/M04/M05/M06 |
| **R4 — UI, A11y, Viz & Test** | FE-UI-*, FE-A11Y-*, FE-VIZ-*, FE-TEST-*, §9 | `components/`, `floorplan/`, test, story |

### 13.2. Định dạng finding bắt buộc
```
| ID | Quy tắc | Mức lỗi | Vị trí (file:dòng) | Bằng chứng | Đề xuất sửa |
| R2-03 | FE-AUTH-03 | Blocker | src/lib/http/refresh.ts:41 | 2 request 401 song song gọi /refresh 2 lần | Dùng promise dùng chung |
```
- Mỗi finding phải trỏ **một mã quy tắc** và **file:dòng**; không có bằng chứng → không ghi finding.
- Nghi ngờ nhưng không xác minh được → ghi vào mục "Câu hỏi cho tác giả", không ghi là lỗi.
- Reviewer **không** tự sửa code; tối đa 1 vòng re-review sau khi tác giả sửa.

### 13.3. Cổng merge (Definition of Done cho một PR)
- [ ] CI xanh (FE-TEST-01).
- [ ] 0 Blocker; Major = 0 hoặc có ticket được Tech Lead duyệt.
- [ ] Không dùng hành vi ở cột "Spec ghi" của §1.
- [ ] Màn hình chạm tới đạt tiêu chí §9 tương ứng.
- [ ] Đủ 4 UI state (FE-UI-01) cho widget mới.
- [ ] Không có secret/token trong code, log, ảnh chụp PR.

### 13.4. Mẫu checklist trong PR template
```md
- [ ] Gọi API qua features/*/queries.ts (FE-ARC-01)
- [ ] Lỗi tra theo code, có fallback (FE-API-03)
- [ ] Field số nullable, hiển thị "--" (FE-API-06)
- [ ] Quyền lấy từ lib/rbac, khớp §5.2 (FE-RBAC-03)
- [ ] Subscribe/unsubscribe đúng vòng đời (FE-RT-03)
- [ ] 4 UI state + ảnh chụp (FE-UI-01, FE-TEST-06)
- [ ] Không lưu rawApiKey/token ngoài phạm vi cho phép (FE-SEC-02, FE-AUTH-01)
```

---

## 14. CÁC ĐIỂM LƯU Ý VẬN HÀNH & MỞ RỘNG (GIAI ĐOẠN 2)

> [!NOTE]
> Các vấn đề chặn luồng (Q1, Q2, Q3, Q4, Q7, Q9) đã được giải quyết triệt để trong mã nguồn Backend và đồng bộ giữa 2 tài liệu. Các điểm dưới đây là lưu ý thiết kế cho Frontend ở Giai đoạn 1:

| # | Chủ đề | Hành vi chuẩn hiện tại | Quy tắc xử lý trên Frontend |
| :-: | :--- | :--- | :--- |
| N1 | Chế độ Kiosk (M02) | Sử dụng tài khoản `VIEWER` chuyên dụng cho màn hình TV sảnh | Lưu refresh token trong `localStorage` riêng cho route `/kiosk`, tự động xoay vòng token định kỳ |
| N2 | Summary từ RAM Cache (D9) | `roomName` chứa `roomId`; `totalRooms = 0` khi mới khởi động lại server | Join tên phòng từ cache `GET /rooms`; hiển thị Empty state *"Đang chờ bản tin đầu tiên"* khi `totalRooms === 0` |
| N3 | Công thức đếm Bucket | `bucketCount = (durationSeconds + intervalSeconds - 1) / intervalSeconds <= 1000` (`TelemetryService.java:115`) | Dùng đúng công thức nguyên này ở `lib/format` để kiểm tra trước khi gọi `/buckets` |

---

## PHỤ LỤC A — TYPE DTO CHUẨN (ĐỐI CHIẾU CODE)

```typescript
// Envelope
export interface ApiResponse<T> { code: number; message?: string; result?: T }
export interface PageResponse<T> {
  content: T[]; page: number; size: number; totalElements: number; totalPages: number; last: boolean;
}

// Auth
export interface AuthenticationResponse { token: string; refreshToken: string }
export interface LogoutRequest { token?: string; refreshToken?: string }

// IAM
export interface PermissionResponse { name: string; description: string }
export interface RoleResponse { name: string; description: string; permissions: PermissionResponse[] }
export interface UserResponse {
  id: string; username: string; phone?: string; email?: string;
  active: boolean;
  createdAt: string; updatedAt: string;
  roles: RoleResponse[]; assignedZones: string[];
}
export interface UserCreationRequest {
  username: string; password: string; phone?: string; email?: string;
  roles?: string[]; assignedZones?: string[];
}
export interface UserUpdateRequest { password?: string; phone?: string; email?: string; roles?: string[]; assignedZones?: string[] }

// Rooms
export type RoomType = 'STUDY_ROOM' | 'BOOK_STORAGE' | 'CIRCULATION_HALL'; // [XÁC NHẬN] enums/RoomType.java
export interface Point2D { x: number; y: number }
export interface RoomResponse {
  id: string; code: string; name: string; floor: number; capacity?: number; description?: string;
  targetComfortScore?: number; type?: RoomType; boundaryPolygon?: Point2D[];
  createdAt: string; updatedAt: string;
}

// Devices
export interface DeviceResponse {
  id: string; name: string; hardwareId: string; zoneId: string; roomId?: string;
  posX?: number; posY?: number; deviceType: string; location?: string; firmwareVersion?: string;
  active: boolean;                       // Q10
  lastSeenAt: string | null; connectionState: 'ONLINE' | 'OFFLINE' | string; lastOfflineAt: string | null;
  createdAt: string; updatedAt: string; online: boolean;
}
export interface DeviceRegistrationResponse {
  id: string; name: string; hardwareId: string; zoneId: string; roomId?: string;
  posX?: number; posY?: number; deviceType: string; location?: string; firmwareVersion?: string;
  active: boolean; createdAt: string;
  rawApiKey: string;                     // FE-SEC-02
  alreadyExisted: boolean;               // D15
}
export interface DiscoveredDeviceResponse {
  hardwareId: string; firstSeenAt: string; lastSeenAt: string; messageCount: number; lastWifiRssi: number | null;
}

// Telemetry
export type ComfortGrade = 'Platinum' | 'Gold' | 'Silver' | 'Bronze' | 'Poor'; // D3
export interface TelemetryResponse {
  id: string; timestamp: string;
  metadata: { deviceId: string; hardwareId: string; roomId: string };          // không có zoneId (D8)
  acoustics?: { noiseAvg: number | null; noisePeak: number | null };
  airQuality?: { pm1_0: number | null; pm2_5: number | null; pm4_0: number | null; pm10: number | null };
  environment?: { temperature: number | null; humidity: number | null; lux: number | null };
  comfortScore?: {
    overall: number | null; grade: ComfortGrade | null;
    acousticScore: number | null; airScore: number | null; thermalScore: number | null; lightScore: number | null;
  };
  wifiRssi: number | null;
}
export interface RoomSummaryInfo {
  roomId: string; roomName: string;      // roomName == roomId (D9)
  comfortScore: number | null; grade: ComfortGrade | null;
  temperature: number | null; humidity: number | null; noiseAvg: number | null; pm25: number | null;
  bottleneckReason: string | null;
}
export interface TelemetrySummaryResponse {
  totalRooms: number; optimalRoomsCount: number; averageComfortScore: number;
  overallGrade: ComfortGrade | 'N/A';
  bestRoom: RoomSummaryInfo | null; attentionRoom: RoomSummaryInfo | null; worstRoom: RoomSummaryInfo | null;
}
export type BucketInterval = '15m' | '1h' | '1d';
export interface BucketDataPoint {        // NON_NULL: mọi trường số có thể vắng (D16)
  bucketTime: string; sampleCount?: number;
  comfortScoreAvg?: number; comfortScoreMin?: number; comfortScoreMax?: number;
  tempAvg?: number; tempMin?: number; tempMax?: number;
  humidityAvg?: number; humidityMin?: number; humidityMax?: number;
  noiseAvg?: number; noiseMin?: number; noiseMax?: number;
  pm25Avg?: number; pm25Min?: number; pm25Max?: number;
  luxAvg?: number; luxMin?: number; luxMax?: number;
}
export interface TelemetryBucketResponse { roomId: string; interval: BucketInterval; dataPoints?: BucketDataPoint[] }

// Alerts
export type AlertType = 'NOISE_EXCEEDED' | 'AIR_UNHEALTHY' | 'DEVICE_OFFLINE' | 'SENSOR_MALFUNCTION';
export type AlertStatus = 'PENDING' | 'FIRING' | 'ACKNOWLEDGED' | 'RESOLVED';
export interface AlertResponse {
  id: string; deviceId: string; hardwareId: string; roomId: string | null;
  type: AlertType; status: AlertStatus; currentValue: number | null; threshold: number | null; message: string;
  startedAt: string; acknowledgedAt: string | null; resolvedAt: string | null; acknowledgedBy: string | null;
}
```

> [!NOTE]
> Trường, kiểu và enum (`RoomType`, `AlertType`, `AlertStatus`) trong Phụ lục A đã được đối chiếu với code backend; trường nào nullable/optional là lựa chọn phòng thủ của FE `[ĐỀ XUẤT]`. Khi backend có OpenAPI (task T7), chuyển sang sinh type tự động.
