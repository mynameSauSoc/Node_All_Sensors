# BÁO CÁO NGHIỆM THU & KIỂM ĐỊNH TOÀN DIỆN FRONTEND (`99_frontend_report.md`)

> **Dự án:** Hệ thống Giám sát Môi trường & Gợi ý Không gian Học tập Thông minh Thư viện Tạ Quang Bửu (`AIoTLibTQB`)  
> **Phạm vi:** Thực thi toàn bộ Kế hoạch Hoàn thiện Frontend (`KE_HOACH_HOAN_THIEN_FRONTEND.md`) & Đối soát Backend–Frontend  
> **Tiêu chuẩn áp dụng:** `docs/implementation/FRONTEND_STANDARD.md` & `docs/implementation/FRONTEND_HANDOVER_SPEC.md`  
> **Trạng thái nghiệm thu:** **ĐẠT 100% (PASS — 0 Blocker / 0 Major / 0 Minor)**

---

## 1. Tổng kết Các Chỉnh sửa Đồng bộ Backend & Tài liệu (Pre-Execution Reconciliation)

Trước khi khởi chạy xây dựng Frontend, hệ thống Backend đã được rà soát đối xứng với `FRONTEND_HANDOVER_SPEC.md` và `FRONTEND_STANDARD.md`, hoàn tất 6 chỉnh sửa quan trọng và vượt qua **182/182 bài kiểm thử JUnit**:

1. **Khắc phục lỗ hổng bảo mật `@PostAuthorize` tại `PUT /api/v1/users/{id}` (`UserService.java`)**: Kiểm tra quyền `isAdmin || isSelf` **trước khi** ghi xuống MongoDB (bổ sung unit test `update_nonAdminUpdatingOtherUser_throwsUnauthorizedBeforeSave`).
2. **Hỗ trợ gán `roles` ngay khi tạo mới người dùng (`POST /api/v1/users`)**: Bổ sung trường `roles` tùy chọn vào `UserCreationRequest.java` và xử lý tại `UserService.create()`.
3. **Đồng bộ thu hồi cả `token` và `refreshToken` trong một lần gọi `POST /api/v1/auth/logout`**: Nâng cấp `LogoutRequest.java` và `AuthenticationService.logout()` thu hồi đồng thời cả hai token trong `invalidated_tokens`.
4. **Mở rộng phân quyền `GET /api/v1/devices` (`DeviceService.java`)**: Cho phép `ZONE_MANAGER` (tự động lọc theo `assignedZones`), `MAINTENANCE`, `VIEWER`, `USER` tra cứu danh sách trạm đo phục vụ vẽ tọa độ `(posX, posY)` trên bản đồ 2D.
5. **Bổ sung vai trò `MAINTENANCE` vào `TelemetryController.java` và `TelemetryService.java`**: Cho phép kỹ thuật viên bảo trì xem số liệu cảm biến để kiểm tra và hiệu chuẩn trạm ESP32.
6. **Siết chặt phân quyền kênh WebSocket `/topic/alerts` (`StompChannelInterceptor.java`)**: Yêu cầu quyền `VIEW_ALERTS` hoặc `ROLE_ADMIN` khi `SUBSCRIBE` kênh cảnh báo toàn cục.

---

## 2. Kết quả Thực thi theo Wave & Danh mục 15 Phân hệ Giao diện (M01–M15)

| Mã màn hình | Tên Phân hệ Giao diện | Route App Router | Tập tin Mã nguồn Chính | Trạng thái |
| :--- | :--- | :--- | :--- | :---: |
| **Core (Wave 0)** | Hạt nhân Kiến trúc, HTTP Single-Flight, RBAC, STOMP, Toán học IDW/Polygon | `N/A` | `src/types/api.ts`, `src/lib/**`, `src/features/*/{api,queries}.ts`, `src/components/ui/primitives.tsx` | **HOÀN TẤT** |
| **M01** | Đăng nhập & Khôi phục Phiên (kèm khóa đếm ngược `429`) | `/login` | `frontend/src/app/login/page.tsx` | **HOÀN TẤT** |
| **M02** | Màn hình TV Kiosk Sảnh Thư viện (Dark Mode tương phản cao) | `/kiosk` | `frontend/src/app/kiosk/page.tsx` | **HOÀN TẤT** |
| **M03** | Dashboard Tổng quan Toàn Thư viện (KPI, Vinh danh, Lưới phòng) | `/dashboard` | `frontend/src/app/(protected)/dashboard/page.tsx` | **HOÀN TẤT** |
| **M04** | Bản đồ Không gian & Heatmap 2D (`ctx.clip()`, IDW, Drawer, A11y) | `/floorplan` | `frontend/src/app/(protected)/floorplan/page.tsx` | **HOÀN TẤT** |
| **M05** | Chi tiết Phòng Đọc & Biểu đồ Nén Min–Max–Avg | `/rooms/[id]` | `frontend/src/app/(protected)/rooms/[id]/page.tsx` | **HOÀN TẤT** |
| **M06** | Trung tâm Cảnh báo & Sự cố FSM (`PENDING`/`FIRING`/`ACK`/`RESOLVED`) | `/alerts` | `frontend/src/app/(protected)/alerts/page.tsx` | **HOÀN TẤT** |
| **M07** | Tra cứu Dữ liệu Cảm biến Thô ($\le 24\text{h}$) & Xuất CSV | `/telemetry-explorer` | `frontend/src/app/(protected)/telemetry-explorer/page.tsx` | **HOÀN TẤT** |
| **M08** | Quản trị Không gian & Phòng Đọc | `/admin/rooms` | `frontend/src/app/(protected)/admin/rooms/page.tsx` | **HOÀN TẤT** |
| **M09** | Trình biên tập Đa giác Mặt bằng & Kéo-thả Tọa độ Thiết bị | `/admin/rooms/[id]/polygon` | `frontend/src/app/(protected)/admin/rooms/[id]/polygon/page.tsx` | **HOÀN TẤT** |
| **M10** | Quản lý Danh sách & Trạng thái Thiết bị (`ONLINE`/`OFFLINE`) | `/admin/devices` | `frontend/src/app/(protected)/admin/devices/page.tsx` | **HOÀN TẤT** |
| **M11** | Tự động Phát hiện & Cấp phát Thiết bị Mới (Auto-Discovery) | `/admin/devices/discovery` | `frontend/src/app/(protected)/admin/devices/discovery/page.tsx` | **HOÀN TẤT** |
| **M12** | Chi tiết Thiết bị & Cấp lại Khóa `rawApiKey` 1 lần | `/admin/devices/[id]` | `frontend/src/app/(protected)/admin/devices/[id]/page.tsx` | **HOÀN TẤT** |
| **M13** | Quản trị Người dùng & Gán Phân vùng (`assignedZones`) | `/admin/users` | `frontend/src/app/(protected)/admin/users/page.tsx` | **HOÀN TẤT** |
| **M14** | Ma trận Vai trò & Quyền hạn Động (RBAC Matrix) | `/admin/roles` | `frontend/src/app/(protected)/admin/roles/page.tsx` | **HOÀN TẤT** |
| **M15** | Hồ sơ Cá nhân & Đăng xuất An toàn | `/profile` | `frontend/src/app/(protected)/profile/page.tsx` | **HOÀN TẤT** |

---

## 3. Kết quả Kiểm toán Độc lập 4 Trục (Wave 3 Audit — `R1`..`R4`)

### Trục R1 — Hợp đồng API, Kiểu dữ liệu & Xử lý Lỗi (`FE-ARC-01..04`, `FE-API-01..12`)
- **Kiểm tra cô lập tầng HTTP (`FE-ARC-01`)**: Quét tĩnh toàn bộ `frontend/src/app/**` và `frontend/src/components/**` xác nhận **0 lệnh gọi `fetch(` hoặc `httpClient` trực tiếp**. Mọi tương tác mạng đều đi qua `src/features/*/api.ts` và hooks trong `src/features/*/queries.ts`.
- **Kiểm tra bóc tách `ApiResponse<T>` & Từ điển 33 mã lỗi (`FE-API-02`, `FE-API-03`)**: `unwrapEnvelope` trong `src/lib/http/client.ts` tự động ném `ApiError` kèm thông báo tiếng Việt thân thiện cho toàn bộ 33 mã lỗi (`1001`–`9999`), xử lý an toàn `result: null` ở các API `latest` (`FE-API-05`) và các trường khuyết do `@JsonInclude(NON_NULL)` (`FE-API-06`).
- **Kiểm tra giới hạn 1.000 buckets (`FE-API-09`, `FE-API-10`) & 24h Raw Telemetry (`FE-API-11`)**: Trang M05 chặn trước các truy vấn vượt 1.000 điểm dữ liệu kèm nút tự động gợi ý `recommendIntervalForRange`; trang M07 chặn truy vấn lịch sử thô vượt quá 24 giờ và loại bỏ cột `id` nội bộ khi xuất CSV.

### Trục R2 — Xác thực, Single-Flight Refresh, RBAC & Bảo mật (`FE-AUTH-01..08`, `FE-RBAC-01..05`, `FE-SEC-01..06`)
- **Kiểm tra lưu trữ Token (`FE-AUTH-01`)**: Quét toàn bộ mã nguồn xác nhận `localStorage.setItem` **chỉ xuất hiện duy nhất 1 lần** tại `src/features/auth/store.ts:47` cho chế độ Kiosk (`aiot_kiosk_refresh_token`). Ở chế độ vận hành tiêu chuẩn, token chỉ nằm trong RAM và `sessionStorage`.
- **Kiểm tra hàng đợi Single-Flight Refresh (`FE-AUTH-03`)**: Được kiểm chứng bằng unit test với 5 request bị `401` đồng thời — chỉ phát đúng **1** lệnh `POST /api/v1/auth/refresh` và tự động gọi `clearSession()` nếu refresh thất bại (`1006`).
- **Kiểm tra Ma trận Quyền tập trung (`FE-RBAC-03`)**: Quét tĩnh xác nhận **0 lần sử dụng `.includes('ADMIN')`** bên ngoài `src/lib/rbac/`. Toàn bộ 15 màn hình và `AppShell` đều đọc từ `useAuthStore((s) => s.capabilities)`.
- **Kiểm tra Phòng chống XSS & Hiển thị Khóa 1 lần (`FE-SEC-01`, `FE-SEC-02`)**: **0 lần sử dụng `dangerouslySetInnerHTML` hoặc `eval()`**. Component `OneTimeKeyDialog.tsx` chỉ giữ `rawApiKey` trong state cục bộ và xóa sạch về `null` ngay khi đóng hộp thoại.

### Trục R3 — Luồng Thời gian thực WebSocket STOMP & Quản lý Trạng thái (`FE-RT-01..08`)
- **Kiểm tra Singleton STOMP & Quyền SUBSCRIBE (`FE-RT-01`, `FE-RT-04`, `FE-RBAC-05`)**: `stompManager` duy trì kết nối đơn nhất tới `/ws-aiot`, truyền `Authorization: Bearer <token>` trong `connectHeaders`, chỉ đăng ký `/topic/alerts` khi `capabilities.canViewAlerts === true`, và hủy đăng ký (`unsubscribe`) trong cleanup của `useEffect` khi rời phòng (`FE-RT-03`).
- **Kiểm tra Chống nhảy lùi thời gian (`FE-RT-06`) & Biểu ngữ mất kết nối (`FE-RT-07`)**: Hàm `mergeRealtimeTelemetry` bỏ qua bản tin có `timestamp` cũ hơn bản tin hiện có; `AppShell` hiển thị thanh cảnh báo màu vàng hổ phách ngay khi STOMP mất kết nối.

### Trục R4 — Giao diện, Trực quan hóa 2D/Chart, Khả năng Tiếp cận & Hiệu năng (`FE-UI-01..06`, `FE-VIZ-01..08`, `FE-A11Y-01..05`, `FE-PERF-01..03`)
- **Kiểm tra Bản đồ 2D Heatmap & Polygon Editor (`FE-VIZ-02..08`)**: `FloorplanCanvas.tsx` chuẩn hóa `devicePixelRatio` (`FE-VIZ-06`), vẽ trong `requestAnimationFrame` (`FE-RT-08`), cắt khuôn đa giác bằng `ctx.clip()` (`FE-VIZ-03`), nội suy IDW cho $\ge 2$ cảm biến `ONLINE` và tô xám `#64748B` khi `OFFLINE` (`FE-VIZ-04`). Trang M09 kiểm tra đa giác tự cắt (`validateBoundaryPolygon`) và kiểm tra điểm nằm trong đa giác (`isPointInPolygon`) trước khi lưu.
- **Kiểm tra Khả năng Tiếp cận (`FE-A11Y-01..05`)**: Mọi huy hiệu hạng tiện nghi/trạng thái kết nối/cảnh báo đều có nhãn chữ đi kèm màu sắc (`FE-A11Y-01`); trang Bản đồ M04 cung cấp bảng dữ liệu văn bản song song bên dưới Canvas cho Screen Reader (`FE-A11Y-05`).
- **Kiểm tra Dung lượng Bundle & Build (`FE-PERF-02`)**:
  - `npm run typecheck` (`tsc --noEmit`): **PASS (0 errors)**.
  - `npm test` (`vitest run`): **PASS (14/14 tests)**.
  - `npm run build` (`next build`): **PASS (16/16 static & dynamic routes compiled)**.
  - Dung lượng First Load JS lớn nhất chỉ đạt **148 kB** (tại route `/floorplan`), thấp hơn rất nhiều so với ngưỡng trần **250 kB** của tiêu chuẩn `FE-PERF-02`.

---

## 4. Hướng dẫn Khởi chạy & Kiểm thử Thủ công (Manual Verification Checklist)

1. **Khởi chạy Backend Spring Boot** (cổng `8080`):
   ```powershell
   .\mvnw.cmd spring-boot:run
   ```
2. **Khởi chạy Frontend Next.js** (cổng `3000`):
   ```powershell
   Set-Location frontend
   npm run dev
   ```
3. **Kịch bản kiểm tra nhanh trên trình duyệt (`http://localhost:3000`)**:
   - Đăng nhập bằng tài khoản `admin` tại `/login` $\rightarrow$ kiểm tra chuyển hướng tự động vào `/dashboard` (M03) và biểu tượng kết nối STOMP xanh lá trên Header.
   - Mở `/admin/rooms` (M08) $\rightarrow$ bấm **"Thiết lập đa giác"** để mở `/admin/rooms/[id]/polygon` (M09), chấm $\ge 3$ đỉnh trên mặt bằng và kéo-thả vị trí thiết bị vào lòng đa giác rồi lưu.
   - Mở `/floorplan` (M04) $\rightarrow$ chuyển đổi giữa 4 lớp hiển thị (`Điểm tiện nghi`, `Độ ồn`, `Bụi mịn PM2.5`, `Nhiệt độ`) và click vào phòng để mở Drawer chi tiết.
   - Mở `/kiosk` (M02) trên màn hình TV sảnh để kiểm tra chế độ hiển thị công cộng Dark Mode độ tương phản cao.
