# Tài Liệu Kỹ Thuật: Chức Năng Bản Đồ Nhiệt Không Gian 2D Đa Quy Mô (Spatial Floorplan & Heatmap — TQB CAD 1:100)

> **Mục đích tài liệu**: Tài liệu tham chiếu kỹ thuật mô tả toàn bộ kiến trúc, lớp nền kiến trúc AutoCAD 1:100 của Thư viện Tạ Quang Bửu (`76.0m × 57.2m`), luồng dữ liệu, giải thuật toán học (`adaptiveSigma`, `computeRoomBlindspotRatio`, `synthesizeAnonymousMicroZones`), pipeline đồ họa 2D Phóng đại 2 Cấp (`2-Level Zoom`) và ma trận công cụ tác nghiệp theo từng Role User (`USER`/`VIEWER`, `LIBRARIAN`/`ZONE_MANAGER`, `MAINTENANCE`, `ADMIN`) trong dự án **AIoTLibTQB**.
>
> **Quy ước nhãn bằng chứng**:
> - `[XÁC NHẬN]`: Có bằng chứng trực tiếp trong mã nguồn hoặc cấu hình thực tế (kèm tọa độ `file:dòng`).
> - `[SUY LUẬN]`: Kết luận hợp lý rút ra từ việc ghép nối nhiều thành phần mã nguồn.
> - `[CHƯA RÕ]`: Hành vi phụ thuộc vào dữ liệu vận hành thực tế chưa được khóa cứng trong code.

---

## 1. Bản Đồ Mã Nguồn & Tài Liệu Liên Quan (File Map)

Toàn bộ chức năng Bản đồ nhiệt Không gian 2D trải dài trên **3 màn hình Frontend** (`M04 - /floorplan`, `M09 - /admin/rooms/[id]/polygon`, và `M02 - /kiosk`), **bộ Vector SVG mặt bằng kiến trúc AutoCAD 1:100**, **thư viện toán học hình học & đồ họa Canvas**, **hệ thống Realtime WebSocket STOMP**, và **các API Backend quản lý Phòng / Thiết bị / Telemetry / Cảnh báo**.

### 1.1. Frontend — Cấu hình Kiến trúc TQB, Toán học Hình học, Nội suy & Đồ họa
| Tệp tin | Dòng | Vai trò & Thành phần cốt lõi |
| :--- | :--- | :--- |
| [`frontend/public/floorplans/tqb-floor-{1..5}.svg`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/public/floorplans/tqb-floor-3.svg) | Toàn bộ | `[XÁC NHẬN]` Bộ 5 file Vector SVG mặt bằng kiến trúc sạch trích xuất trực tiếp từ bản vẽ AutoCAD 1:100 `Mat bang Thu vien TQB.pdf` (giữ các lớp `TUONG`, `CUA`, `BTCT`, `THANG`, `NOITHAT`, `DO`, `MAY`, lọc bỏ đường kích thước và khung tên) chuẩn hóa về tỷ lệ khung hình thực `76.0m × 57.2m` (`aspectRatio = 0.75263`). |
| [`frontend/src/config/tqb-floorplan-presets.ts`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/config/tqb-floorplan-presets.ts#L1-L2372) | `1–2372` | `[XÁC NHẬN]` Định nghĩa hằng số khung công trình `TQB_BUILDING_ASPECT_RATIO = 57.2 / 76.0` (`dòng 18–21`), hệ thống mốc định vị `TQB_LANDMARKS` (4 cầu thang bộ góc, 2 thang máy trung tâm, WC, giếng trời thông tầng `417.87 m²`), 26 preset phòng thực tế `TQB_ROOM_PRESETS` trên Tầng 1–5 kèm phân khu bàn đọc `readingBays`, hàm tổng hợp phân khu bàn đọc ẩn danh `synthesizeAnonymousMicroZones` (`dòng 2196–2295`) và hàm tìm đường đi bộ `computeWayfindingPath` (`dòng 2301–2372`). |
| [`frontend/src/lib/floorplan/coords.ts`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/lib/floorplan/coords.ts#L1-L29) | `1–29` | `[XÁC NHẬN]` Chuyển đổi hệ tọa độ chuẩn hóa `[0.0, 1.0]` sang tọa độ pixel thực tế của thẻ `<canvas>` (`normalizedToCanvas`, `canvasToNormalized`, `clamp01`). |
| [`frontend/src/lib/floorplan/polygon.ts`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/lib/floorplan/polygon.ts#L1-L233) | `1–233` | `[XÁC NHẬN]` Các hàm hình học đa giác: tính diện tích có dấu Shoelace (`computePolygonSignedArea`), kiểm tra đa giác hợp lệ (`validateBoundaryPolygon`), kiểm tra điểm nằm trong đa giác bằng Ray-casting (`isPointInPolygon`), và tìm tâm hiển thị nhãn cho cả đa giác lồi lẫn lõm chữ L/U (`computeVisualPolygonCenter`). |
| [`frontend/src/lib/floorplan/idw.ts`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/lib/floorplan/idw.ts#L1-L51) | `1–51` | `[XÁC NHẬN]` Định nghĩa kiểu `IdwSample` và hàm thuần `computeIdwValue` tính nội suy khoảng cách nghịch đảo bình phương (IDW bậc 2, $\epsilon = 10^{-6}$). |
| [`frontend/src/lib/floorplan/weatherPalette.ts`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/lib/floorplan/weatherPalette.ts#L1-L435) | `1–435` | `[XÁC NHẬN]` Định nghĩa bảng màu khí tượng liên tục `WEATHER_PALETTES` cho **7 lớp chỉ số** (`comfortScore`, `noiseAvg`, `pm2_5`, `temperature`, `humidity`, `lux`, `wifiRssi`), hàm tính bán kính khuếch tán thích ứng theo diện tích phòng `computeAdaptiveSigma` (`dòng 162–211`), hàm tính tỷ lệ vùng mù cảm biến `computeRoomBlindspotRatio` (`dòng 219–282`), và hàm dựng đồ họa chính `renderWeatherDiffusionHeatmap` (`dòng 284–435`). |
| [`frontend/src/config/thresholds.ts`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/config/thresholds.ts#L1-L157) | `1–157` | `[XÁC NHẬN]` Định nghĩa kiểu `HeatmapLayerMetric` mở rộng 7 lớp chỉ số (`'comfortScore' \| 'noiseAvg' \| 'pm2_5' \| 'temperature' \| 'humidity' \| 'lux' \| 'wifiRssi'`), bảng phân hạng `GRADE_STYLES` (`A, B, C, D, F`), `resolveGradeFromScore` và hàm màu phân bậc `getMetricColorHex`. |

### 1.2. Frontend — Giao diện, Công cụ Tác nghiệp theo Role & Thời gian thực (`frontend/src/`)
| Tệp tin | Dòng | Vai trò & Thành phần cốt lõi |
| :--- | :--- | :--- |
| [`frontend/src/features/floorplan/components/FloorplanCanvas.tsx`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/features/floorplan/components/FloorplanCanvas.tsx#L1-L1359) | `1–1359` | `[XÁC NHẬN]` Component dựng bản đồ nhiệt đa quy mô kết hợp nền Vector CAD SVG (`tqb-floor-{1..5}.svg`), Giếng trời thông tầng (`417.87 m²`), Mốc định vị (`TQB_LANDMARKS`), Phóng đại 2 Cấp (`Whole-Floor Overview` $\leftrightarrow$ `Room Focus Zoom`), Nhãn Thu gọn (`Compact Pill` cho phòng `< 65 m²`) & Nhãn Đầy đủ (`Rich Label` kèm dải `min–max` cho phòng lớn), Phân khu bàn đọc ẩn danh (`FE-VIZ-09`), Lộ trình dẫn đường (`Wayfinding Route`), và Lớp phủ Chẩn đoán Kỹ thuật (`showBlindspots`, `showTechOverlay`). |
| [`frontend/src/app/(protected)/floorplan/page.tsx`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/app/(protected)/floorplan/page.tsx#L1-L1290) | `1–1290` | `[XÁC NHẬN]` Trang M04 (`/floorplan`): Tích hợp bộ chuyển đổi 7 lớp chỉ số, Thanh Chuyển đổi Góc nhìn Vai trò (`Role View Switcher` cho `ADMIN`), Bộ lọc Tìm Chỗ Ngồi Học Lý Tưởng (`Smart Study Spot Finder` cho `USER`/`VIEWER`), Bảng Điều phối Cảnh báo Thời gian thực FSM (`ACK`/`RESOLVE` + lọc `assignedZones` + cảnh báo ẩm mốc Kho sách `< 60%RH` cho `LIBRARIAN`/`ZONE_MANAGER`), và Bảng Chẩn đoán Kỹ thuật & Hạ tầng (`ONLINE/OFFLINE`, `RSSI`, `Blindspots`, `ΔT` điều hòa cho `MAINTENANCE`). |
| [`frontend/src/app/(protected)/admin/rooms/[id]/polygon/page.tsx`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/app/(protected)/admin/rooms/%5Bid%5D/polygon/page.tsx#L1-L915) | `1–915` | `[XÁC NHẬN]` Trang M09 (`/admin/rooms/[id]/polygon`): Trình biên tập không gian 2 chế độ (`polygon` & `device`) trên nền bản vẽ kỹ thuật CAD SVG 1:100 (`<image href={cadSvgUrl} ... />`), hiển thị đường bao mờ các phòng lân cận (`siblingRooms`), và công cụ **"Nạp đa giác chuẩn từ Bản vẽ TQB"** (`handleLoadTqbPreset`) giúp tự động khớp tọa độ kiến trúc thực tế và rải cảm biến theo phân khu bàn đọc. |
| [`frontend/src/app/kiosk/page.tsx`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/app/kiosk/page.tsx#L1-L580) | `1–580` | `[XÁC NHẬN]` Trang M02 (`/kiosk` công khai tại sảnh Tầng 1): Nhúng trực tiếp khu vực **Sơ đồ Mặt bằng Không gian & Dẫn đường Trực quan** (`FloorplanCanvas` tương tác trực tiếp với bộ chọn Tầng 1–5, 4 lớp chỉ số thân thiện và lộ trình đi bộ từ Thang máy/Cầu thang tới phòng đọc). |
| [`frontend/src/lib/realtime/use-room-stream.ts`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/lib/realtime/use-room-stream.ts#L1-L121) | `1–121` | `[XÁC NHẬN]` Hook `useRoomTelemetryStream` lắng nghe kênh STOMP `/topic/rooms/{roomId}/telemetry` và cập nhật trực tiếp vào TanStack Query cache cho cả cấp phòng và cấp thiết bị. |
| [`frontend/src/lib/__tests__/core-standard.test.ts`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/lib/__tests__/core-standard.test.ts#L249-L602) | `249–288`, `381–602` | `[XÁC NHẬN]` Bộ Unit Test (22/22 test cases) kiểm thử hình học đa giác, 100% preset phòng TQB Tầng 1–5, 7 lớp thang màu `WEATHER_PALETTES`, `computeAdaptiveSigma`, `synthesizeAnonymousMicroZones` (`FE-VIZ-09`), `computeRoomBlindspotRatio` và `computeWayfindingPath`. |

### 1.3. Backend & Công cụ Giả lập (`src/main/java/com/tqb/library/` & `tools/iot-simulator/`)
| Tệp tin | Dòng | Vai trò & Thành phần cốt lõi |
| :--- | :--- | :--- |
| [`Point2D.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/tqb/library/shared/model/Point2D.java#L1-L16) & [`Room.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/tqb/library/room/entity/Room.java#L16-L70) | `1–16`, `16–70` | `[XÁC NHẬN]` Value Object `Point2D(Double x, Double y)` và Document MongoDB `rooms` lưu `floor` và `boundaryPolygon`. |
| [`Device.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/tqb/library/device/entity/Device.java#L22-L103) | `22–103` | `[XÁC NHẬN]` Document MongoDB `devices`, lưu `roomId`, `posX` (`Double`), `posY` (`Double`), `online` (`Boolean`). |
| [`tools/iot-simulator/config/rooms.json`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/tools/iot-simulator/config/rooms.json#L1-L559) | `1–559` | `[XÁC NHẬN]` Cấu hình giả lập chuẩn hóa theo đúng mặt bằng AutoCAD 1:100 của Thư viện Tạ Quang Bửu trên Tầng 1, 2, 3, 5 (bao gồm phòng đọc/multimedia 8 đỉnh ôm quanh lõi thang máy và cụm phòng học nhóm Tầng 5) cùng 15 trạm cảm biến ESP32 đặt tại các phân khu bàn đọc thực tế. |

---

## 2. Mô Hình Dữ Liệu Không Gian Chuẩn AutoCAD 1:100 (`76.0m × 57.2m`)

### 2.1. Hệ tọa độ chuẩn hóa `[0.0, 1.0]` & Tỷ lệ Khung hình Thực tế (`aspectRatio = 0.7526`)
`[XÁC NHẬN]` Dựa trên bản vẽ kỹ thuật gốc `Mat bang Thu vien TQB.pdf` (AutoCAD 2018, khổ A0 `MediaBox [0 0 2384 3370]`, `/Rotate 270`, tỷ lệ **1:100** với $1\text{ m} = 28.3465\text{ pt}$):
- Kích thước bao ngoài thực tế của khối nhà chính Thư viện Tạ Quang Bửu là **`76.0m` (Đông–Tây) × `57.2m` (Bắc–Nam)**.
- Tỷ lệ khung hình thực tế được khóa tại [`tqb-floorplan-presets.ts:18-21`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/config/tqb-floorplan-presets.ts#L18-L21):
  $$\text{TQB\_BUILDING\_ASPECT\_RATIO} = \frac{57.2}{76.0} \approx 0.75263158$$
- Cả [`FloorplanCanvas.tsx:359-363`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/features/floorplan/components/FloorplanCanvas.tsx#L359-L363) và trình biên tập [`polygon/page.tsx:148-151`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/app/(protected)/admin/rooms/%5Bid%5D/polygon/page.tsx#L148-L151) đều dùng `ResizeObserver` với tỷ lệ `TQB_BUILDING_ASPECT_RATIO` để đảm bảo lớp nền Vector SVG kiến trúc (`tqb-floor-{1..5}.svg`), lưới cột chịu lực `BTCT`, giếng trời thông tầng (`417.87 m²`) và đa giác `boundaryPolygon` của các phòng khớp 1:1 tuyệt đối ở mọi độ phân giải màn hình.

### 2.2. Đặc trưng Kiến trúc Đa Quy mô trên Tầng 1–5 (`TQB_ROOM_PRESETS`)
`[XÁC NHẬN]` Tệp [`tqb-floorplan-presets.ts:242-2110`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/config/tqb-floorplan-presets.ts#L242-L2110) số hóa đầy đủ 26 không gian phòng tiêu biểu của Thư viện Tạ Quang Bửu:
- **Tầng 1 (`tqb-floor-1.svg`)**: Sảnh trung tâm & Cửa từ kiểm soát (`1448.37 m²`), Kho sách Tự chọn Đông & Tây (`264.70 m²` × 2), Khu nhập & phân loại sách đĩa (`186.40 m²`), Căng tin giải khát (`97.81 m²`).
- **Tầng 2 (`tqb-floor-2.svg`)**: Phòng Multimedia Tầng 2 (`570.57 m²` — đa giác lõm 8 đỉnh ôm quanh lõi thang máy Bắc), 2 Phòng đọc lớn (`301.30 m²` × 2), Khu Hành chính & Phòng Máy chủ (`195.00 m²`).
- **Tầng 3 (`tqb-floor-3.svg`)**: Phòng Multimedia Tầng 3 (`570.57 m²`), 2 Phòng đọc lớn Đông/Tây (`301.30 m²` × 2), Phòng Truyền thống (`225.00 m²`), 2 Phòng đọc sách (`127.14 m²` × 2).
- **Tầng 4 (`tqb-floor-4.svg`)**: Phòng Đọc Chuyên ngành Khoa học Tự nhiên (`570.57 m²`), 2 Phòng đọc chuyên ngành Đông/Tây (`301.30 m²` × 2), Phòng Đọc Báo – Tạp chí Khoa học (`332.62 m²`).
- **Tầng 5 (`tqb-floor-5.svg`)**: Kết hợp đa quy mô điển hình giữa 2 Phòng đọc chuyên ngành lớn (`570.57 m²` và `301.30 m²`) ở cánh Bắc/Đông với **Cụm 8 Phòng Làm việc theo Nhóm nhỏ** (`TQB_506..TQB_513`, diện tích `25.97 m² – 41.47 m²`) xếp dọc hành lang cánh Tây và Nam.

---

## 3. Mở Rộng 7 Lớp Chỉ Số, Bán Kính Khuếch Tán Thích Ứng & Vùng Mù Cảm Biến

### 3.1. Hệ thống 7 Lớp Chỉ số (`HeatmapLayerMetric` & `WEATHER_PALETTES`)
`[XÁC NHẬN]` Định nghĩa tại [`thresholds.ts:8-15`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/config/thresholds.ts#L8-L15) và [`weatherPalette.ts:26-109`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/lib/floorplan/weatherPalette.ts#L26-L109), khai thác toàn bộ dữ liệu thực tế có sẵn trong `TelemetryResponse` ([`api.ts:273-309`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/types/api.ts#L273-L309)):

| Lớp chỉ số (`HeatmapLayerMetric`) | Đơn vị | Mục đích Nghiệp vụ tại Thư viện Tạ Quang Bửu |
| :--- | :--- | :--- |
| **`comfortScore`** (Điểm thoải mái) | `/100` | Đánh giá tổng hợp chất lượng không gian học tập cho sinh viên và Kiosk sảnh. |
| **`noiseAvg`** (Độ ồn trung bình) | `dBA` | Giám sát trật tự phòng đọc yên tĩnh (`< 45 dBA`) vs. khu thảo luận nhóm. |
| **`temperature`** (Nhiệt độ) | `°C` | Giám sát hiệu suất làm mát điều hòa trung tâm và phát hiện bức xạ nhiệt hướng Tây. |
| **`pm2_5`** (Bụi mịn PM2.5) | `µg/m³` | Giám sát chất lượng không khí trong phòng kín đông sinh viên. |
| **`humidity`** (Độ ẩm tương đối) | `%RH` | **Thiết yếu cho Kho sách (`264.7 m²`) và Phòng Truyền thống (`225 m²`)** để phòng ngừa nấm mốc tài liệu khi độ ẩm vượt ngưỡng `>= 60%RH`. |
| **`lux`** (Độ rọi sáng) | `lx` | **Thiết yếu cho Phòng đọc lớn có vách kính mặt dựng** để phát hiện vùng thiếu sáng (`< 200 lx`) hoặc chói nắng gắt (`> 750 lx`). |
| **`wifiRssi`** (Cường độ sóng Wi-Fi) | `dBm` | **Thiết yếu cho Role `MAINTENANCE`** để kiểm tra suy hao sóng qua các vách tường và hệ lưới cột bê tông cốt thép `BTCT` (`<= -75 dBm`). |

### 3.2. Bán kính Khuếch tán Thích ứng theo Diện tích Phòng (`computeAdaptiveSigma`)
`[XÁC NHẬN]` Tại [`weatherPalette.ts:162-211`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/lib/floorplan/weatherPalette.ts#L162-L211):
- Thay vì khóa cứng $\sigma = 0.156$ cho mọi phòng, hàm `computeAdaptiveSigma(normalizedPolygon, sampleCount, fallbackCoverageRadius)` tính diện tích chuẩn hóa thực tế của đa giác phòng $A = |\text{computePolygonSignedArea}(\text{polygon})|$ và bán kính đặc trưng trên mỗi trạm đo:
  $$r_{\text{char}} = \sqrt{\frac{A}{\pi \cdot \max(1, k)}}$$
- Độ lệch chuẩn hàm Gauss $\sigma$ được co giãn tự động theo quy mô diện tích phòng:
  - Với **Cụm phòng làm việc nhóm nhỏ Tầng 5 (`25.97 – 41.47 m²`, $A < 0.008$)**: $\sigma$ thu nhỏ về khoảng `[0.042, 0.068]` giúp vùng nhiệt cô đọng sắc nét ngay trong phòng nhỏ.
  - Với **Phòng đọc vừa (`96 – 264 m²`)**: $\sigma \in [0.068, 0.115]$.
  - Với **Phòng Multimedia & Phòng đọc lớn (`301.30 – 570.57 m²`, $A \ge 0.035$)**: $\sigma \in [0.095, 0.165]$ giúp màu nhiệt hòa trộn mượt mà giữa 3–4 phân khu bàn đọc (`readingBays`) bên trong phòng.

### 3.3. Tính toán & Hiển thị Vùng mù Cảm biến (`computeRoomBlindspotRatio`)
`[XÁC NHẬN]` Tại [`weatherPalette.ts:219-282`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/lib/floorplan/weatherPalette.ts#L219-L282) và [`weatherPalette.ts:392-415`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/lib/floorplan/weatherPalette.ts#L392-L415):
- Hàm `computeRoomBlindspotRatio` lấy mẫu lưới $24 \times 24$ bên trong hộp giới hạn của đa giác phòng, lọc các điểm nằm trong đa giác (`isPointInPolygon`) và tính độ hiện diện trường cảm biến:
  $$\text{fieldPresence}(x, y) = 1 - \exp\left(-2.2 \sum_{i=1}^{k} \exp\left(-\frac{d_i^2}{2\sigma^2}\right)\right)$$
- Các điểm có $\text{fieldPresence} < 0.25$ được xác định là **Vùng mù cảm biến (`Coverage Blindspot`)** — nằm ngoài tầm phủ hiệu dụng của các trạm ESP32 hiện có hoặc do thiết bị trong khu vực đó bị `OFFLINE`.
- Khi kỹ thuật viên (`MAINTENANCE` hoặc `ADMIN`) bật tùy chọn `showBlindspots`, `renderWeatherDiffusionHeatmap` vẽ trực tiếp họa tiết sọc chéo cảnh báo màu hổ phách (`diagonal hatch`) lên đúng các điểm ảnh có `fieldPresence < 0.25` bên trong phòng.

---

## 4. Phóng Đại 2 Cấp (`2-Level Zoom`), Dẫn Đường & Bảo Mật Phần Cứng `FE-VIZ-09`

### 4.1. Cơ chế Phóng đại 2 Cấp (`Whole-Floor Overview` $\leftrightarrow$ `Room Focus Zoom`)
`[XÁC NHẬN]` Cài đặt tại [`FloorplanCanvas.tsx:184-226`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/features/floorplan/components/FloorplanCanvas.tsx#L184-L226) và [`FloorplanCanvas.tsx:660-935`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/features/floorplan/components/FloorplanCanvas.tsx#L660-L935):
1. **Cấp 1 — Toàn tầng (`Whole-Floor Overview`, `zoomedRoomId === null`)**:
   - Hiển thị bao quát toàn bộ mặt bằng tầng (`76.0m × 57.2m`), giếng trời thông tầng (`417.87 m²`), 4 cụm cầu thang bộ, 2 thang máy trung tâm, WC và toàn bộ các phòng.
   - **Chống đè chữ đa quy mô**:
     - Các phòng diện tích nhỏ (`areaM2 < 65 m²`, như cụm 8 phòng nhóm `506–513` ở Tầng 5) tự động hiển thị dạng **Nhãn Thu Gọn (`Compact Pill`)** chỉ gồm mã phòng ngắn và điểm số màu.
     - Các phòng lớn (`areaM2 >= 65 m²`) hiển thị **Nhãn Đầy Đủ (`Rich Label`)** gồm Mã phòng, Tên phòng, Điểm trung bình và **Dải chênh lệch `min – max`** giữa các phân khu bàn đọc trong phòng.
2. **Cấp 2 — Phóng đại Chi tiết Phòng (`Room Focus Zoom`, khi nhấp đúp vào phòng hoặc bấm nút `"Phóng to chi tiết phòng"`)**:
   - Khung vẽ thực hiện phép biến đổi Affine (`scale`, `translateX`, `translateY`) phóng đại phòng được chọn chiếm ~75% khung nhìn.
   - Hiển thị rõ **hệ lưới cột chịu lực `BTCT`** bên trong phòng đọc lớn, vị trí cửa mở (`doorPosition`), ranh giới và nhãn của từng **Phân khu bàn đọc (`readingBays` / `microZones`)** kèm sức chứa ghế ngồi và chỉ số vi khí hậu tại từng dãy bàn.

### 4.2. Giải quyết Triệt để Bài toán `FE-VIZ-09` cho `USER` / `VIEWER` (`synthesizeAnonymousMicroZones`)
`[XÁC NHẬN]` Tại [`tqb-floorplan-presets.ts:2196-2295`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/config/tqb-floorplan-presets.ts#L2196-L2295) và [`FloorplanCanvas.tsx:520-565`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/features/floorplan/components/FloorplanCanvas.tsx#L520-L565):
- Theo quy tắc bảo mật `FE-VIZ-09`, người dùng thông thường (`USER`, `VIEWER`, Kiosk công khai) có `capabilities.canViewDevices === false` nên không được phép tải danh sách phần cứng `DeviceResponse` (ẩn hoàn toàn `hardwareId`, địa chỉ MAC/serial, trạng thái phần cứng).
- Thay vì rơi về **Case B** (tô một màu phẳng đơn điệu cho cả phòng rộng `570.57 m²`), `FloorplanCanvas` gọi `synthesizeAnonymousMicroZones(room, roomTelemetry)` để sinh ra các **Phân khu Bàn đọc Ẩn danh (`AnonymousMicroZone`)** gắn với bố cục không gian thực tế của phòng (ví dụ: *Dãy bàn sát vách kính Bắc*, *Khu bàn trung tâm*, *Góc tự học yên tĩnh phía trong*) dựa trên số liệu thực `roomTelemetry` của phòng đó.
- Nhờ vậy, sinh viên vẫn quan sát được **bản đồ nhiệt phân vùng sống động (Case C Gaussian RBF Diffusion)** và chọn được đúng dãy bàn phù hợp (yên tĩnh hơn hoặc mát hơn) mà **không lộ bất kỳ thông tin phần cứng ESP32 nào**.

---

## 5. Ma Trận Công Cụ Tác Nghiệp Theo Từng Role User (`M04`, `M09`, `M02`)

`[XÁC NHẬN]` Trang [`floorplan/page.tsx`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/app/(protected)/floorplan/page.tsx#L1-L1290) tự động thích ứng giao diện theo quyền hạn thực tế của người đăng nhập (hoặc theo chế độ xem thử `activeRoleView` khi `ADMIN` bật thanh **Role View Switcher**):

| Nhóm Vai Trò (Role) | Nhu cầu Tác nghiệp Thực tế tại TQB | Công cụ Chuyên biệt trên Giao diện (`/floorplan`, `/polygon`, `/kiosk`) | Tọa độ Minh chứng |
| :--- | :--- | :--- | :--- |
| **1. Sinh viên / Bạn đọc (`USER`, `VIEWER`) & Kiosk Sảnh (`/kiosk`)** | Tìm nhanh phòng đọc và dãy bàn phù hợp nhu cầu học tập, biết đường đi bộ từ cầu thang/thang máy gần nhất. | - **Bộ lọc "Tìm Chỗ Ngồi Học Lý Tưởng" (`Smart Study Spot Finder`)** với 4 chế độ 1-click: `quiet` (*Yên tĩnh tuyệt đối*), `group` (*Thảo luận nhóm*), `bright_cool` (*Sáng & Mát cạnh cửa sổ*), `multimedia` (*Máy tính / Multimedia*).<br>- Nhấp vào gợi ý tự động kích hoạt **Phóng đại Cấp 2 (`Room Focus Zoom`)** vào đúng phân khu bàn đọc và vẽ **Lộ trình dẫn đường (`Wayfinding Route`)** từ Thang máy/Cầu thang gần nhất kèm khoảng cách mét.<br>- Tích hợp trực tiếp trên màn hình `/kiosk` công khai. | [`floorplan/page.tsx:310-395`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/app/(protected)/floorplan/page.tsx#L310-L395)<br>[`kiosk/page.tsx:225-330`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/app/kiosk/page.tsx#L225-L330) |
| **2. Thủ thư & Quản lý Khu vực (`LIBRARIAN`, `ZONE_MANAGER`)** | Giám sát trật tự phòng đọc, bảo quản tài liệu Kho sách chống ẩm mốc, xử lý cảnh báo tức thì ngay trên sơ đồ tầng. | - **Bảng Điều phối Cảnh báo Thời gian thực (Live Alert FSM)**: kết nối `useAlertsQuery`, cho phép bấm **`Tiếp nhận (ACK)`** và **`Xử lý xong (RESOLVE)`** trực tiếp trên `/floorplan` mà không cần rời màn hình.<br>- **Cảnh báo đặc thù theo `RoomType`**: kiểm tra nghiêm ngặt độ ẩm **Kho sách (`BOOK_STORAGE`) & Phòng Truyền thống `< 60%RH`** để chống ẩm mốc sách cổ, bên cạnh độ ồn và nhiệt độ phòng đọc.<br>- Bộ lọc **"Chỉ khu vực tôi phụ trách (`assignedZones`)"** dành riêng cho `ZONE_MANAGER`. | [`floorplan/page.tsx:235-308`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/app/(protected)/floorplan/page.tsx#L235-L308)<br>[`floorplan/page.tsx:785-915`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/app/(protected)/floorplan/page.tsx#L785-L915) |
| **3. Kỹ thuật viên Bảo trì & Hạ tầng (`MAINTENANCE`)** | Kiểm tra sức khỏe trạm cảm biến ESP32, suy hao sóng Wi-Fi qua cột `BTCT`, vùng mù chưa phủ sóng và lệch nhiệt điều hòa. | - **Bảng Chẩn đoán Kỹ thuật & Hạ tầng (`Tech & HVAC Diagnostics Overlay`)**: thống kê trạm `ONLINE/OFFLINE`, cảnh báo trạm có sóng Wi-Fi yếu (`RSSI <= -75 dBm`).<br>- Nút bật/tắt **Hiển thị Vùng mù Cảm biến (`showBlindspots`)** gạch chéo các vùng có `fieldPresence < 0.25` để đề xuất lắp bổ sung hoặc dời vị trí ESP32.<br>- Tự động phát hiện **Lệch nhiệt cục bộ (`ΔT >= 2.0°C`)** giữa các trạm trong cùng một phòng đọc lớn để kiểm tra họng gió HVAC. | [`floorplan/page.tsx:397-468`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/app/(protected)/floorplan/page.tsx#L397-L468)<br>[`floorplan/page.tsx:918-1025`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/app/(protected)/floorplan/page.tsx#L918-L1025) |
| **4. Quản trị viên Hệ thống (`ADMIN`)** | Kiểm tra toàn diện mọi góc nhìn nghiệp vụ và số hóa/căn chỉnh đa giác phòng khớp với bản vẽ kiến trúc AutoCAD. | - **Thanh Chuyển đổi Góc nhìn Vai trò (`Role View Switcher`)** ngay trên `/floorplan` để kiểm tra tức thì giao diện của `USER`, `LIBRARIAN`, `MAINTENANCE`, và `ADMIN`.<br>- Trình biên tập `/admin/rooms/[id]/polygon` (`M09`) tích hợp lớp nền **CAD SVG 1:100**, đường bao mờ các phòng cùng tầng và nút **"Nạp đa giác chuẩn từ Bản vẽ TQB"** giúp tự động áp tọa độ đa giác chuẩn và rải thiết bị vào đúng các phân khu bàn đọc. | [`floorplan/page.tsx:595-645`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/app/(protected)/floorplan/page.tsx#L595-L645)<br>[`polygon/page.tsx:242-315`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/frontend/src/app/(protected)/admin/rooms/%5Bid%5D/polygon/page.tsx#L242-L315) |
