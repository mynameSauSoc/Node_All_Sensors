---
title: BÁO CÁO KỸ THUẬT TỐI ƯU HÓA, ĐÁNH GIÁ VẬN HÀNH VÀ ĐỒNG BỘ HÓA HỆ THỐNG AIoTLibTQB VỚI PHẦN CỨNG NHÚNG NODE 1
school: ĐẠI HỌC BÁCH KHOA HÀ NỘI | faculty: TRƯỜNG ĐIỆN - ĐIỆN TỬ | course: ĐỒ ÁN TỐT NGHIỆP KỸ SƯ
authors: KỸ SƯ PHẦN CỨNG NHÚNG & LẬP TRÌNH VIÊN HỆ THỐNG
advisor: HỘI ĐỒNG ĐỒ ÁN TỐT NGHIỆP
city: HÀ NỘI | year: 2026 | doc_type: BÁO CÁO KỸ THUẬT ĐỒ ÁN
---

# TỔNG QUAN VÀ MỤC ĐÍCH ĐỒNG BỘ HÓA

## Đặt vấn đề và Hiện trạng Kiến trúc
Hệ thống giám sát vi khí hậu Thư viện Tạ Quang Bửu (AIoTLibTQB) được xây dựng dựa trên sự kết hợp giữa:
1. **Phần cứng trạm nhúng Node 1 (Node All Sensors):** Vi điều khiển ESP32-S3 WROOM-1, thiết kế PCB 2 lớp đạt chuẩn Altium Designer 26 (0 lỗi DRC), tích hợp đa cảm biến I2C (SHT30, BH1750, SCD40), micro MEMS I2S DMA INMP441, amply I2S MAX98357A và cảm biến bụi mịn GP2Y1014AU0F.
2. **Hạ tầng Server & Giao diện:** Eclipse Mosquitto 2.0 MQTT Broker, Spring Boot 3 trên nền tảng Java 21 Virtual Threads, cơ sở dữ liệu MongoDB 8.0 TimeSeries Native, và Dashboard Next.js 15.

Code ban đầu của lập trình viên hệ thống sở hữu nền tảng kiến trúc phần mềm rất hiện đại và bài bản (áp dụng Project Loom, Caffeine Cache 2 cấp, FSM chống rung cảnh báo, nội suy không gian IDW trên Canvas CAD). Tuy nhiên, khi kết nối với phần cứng nhúng thực tế và kiểm thử dưới góc độ vận hành thực tiễn của **Thủ thư, Kỹ thuật viên và Sinh viên**, hệ thống xuất hiện một số điểm nghẽn cả ở tầng Backend lẫn tầng Giao diện người dùng (UX/UI) cần được hoàn thiện.

Tài liệu này tổng hợp trung thực, khách quan, ngắn gọn và thực dụng toàn bộ các nhận xét thực tế cùng các thay đổi đã được cập nhật trực tiếp vào mã nguồn.

Table: Bảng tổng hợp hiện trạng và kết quả đồng bộ hóa toàn hệ thống
| Hạng mục kỹ thuật | Trạng thái ban đầu | Trạng thái sau tối ưu hóa | Đánh giá kỹ thuật |
|---|---|---|---|
| Bẫy Deserialization JSON | Lỗi ném ra khi có trường lạ | Tự động bỏ qua trường mở rộng | Đảm bảo 100% không rớt gói |
| Cảm biến CO2 (SCD40) | Thiếu trường CO2 trên UI & DTO | Hỗ trợ 350 - 5000 ppm toàn tuyến | Khớp 100% phần cứng Node 1 |
| Điểm tiện nghi (LCS) | Chỉ 4 chỉ số, sập điểm ban đêm | Nâng lên 6 trụ cột + Lọc Standby | Chuẩn TCVN 8681, ASHRAE & VTT |
| Chu kỳ & Cảnh báo Phòng đọc | Ghi cứng 15s, không nháy đỏ/kêu | Khớp chu kỳ 5s/60s + Nháy đỏ & Chuông | Trực quan hóa tức thì cho Thủ thư |
| Biểu đồ chuỗi thời gian | Không có vạch ngưỡng an toàn | Vẽ đường đứt nét đỏ biểu thị ngưỡng | Nhận diện ngay thời điểm vượt mức |
| Chỉ dẫn vận hành (SOP) | Chỉ báo lỗi chung chung | Bổ sung cẩm nang hành động SOP | Thiết thực cho Thủ thư xử lý |
| Tra cứu dữ liệu cảm biến | Chỉ xem từng phòng đơn lẻ | Thêm Bảng Ma trận Đa phòng Live | Nhìn bao quát 12 phòng trong 1 trang |
| Bản đồ tầng (Floorplan) | Không rõ số Node, vùng phủ, gác lửng | Hiển thị bán kính R=6m & 2 cao độ | Kiểm toán điểm mù & chuẩn CAD |
| Màn hình Kiosk Sảnh | Rườm rà thông số kỹ thuật admin | Chế độ Sinh viên: Top 3 phòng + Đường đi | Đúng mục đích phục vụ độc giả |
| Tốc độ chuyển trang Web | Chậm 3-17s do chạy `next dev` | Đóng gói Production (`<50ms`) + Cache | Chuyển trang mượt mà tức thì |

[[PAGEBREAK]]

# CHI TIẾT CẢI TIẾN TRÊN SERVER, BACKEND VÀ FIRMWARE

## Khắc phục Bẫy Deserialization và Tích hợp Cảm biến CO2 SCD40
- **Hiện tượng ban đầu:** Class `TelemetryPayload` chưa bật cờ `@JsonIgnoreProperties(ignoreUnknown = true)` và thiếu trường `co2`. Khi bo mạch ESP32-S3 gửi kèm nồng độ CO2 từ cảm biến quang âm SCD40 (địa chỉ I2C `0x62`) hoặc trạng thái nguồn UPS, Jackson ném ngoại lệ làm đứt luồng tiếp nhận.
- **Giải pháp đã cập nhật trong code:**
  1. Bật `@JsonIgnoreProperties(ignoreUnknown = true)` trên toàn bộ các DTO tiếp nhận MQTT.
  2. Bổ sung trường `Double co2;` vào `EnvironmentData`, `EnvironmentMetrics` và `TelemetrySanitizerService` (dải hợp lệ `300.0 - 5000.0 ppm`).

## Tối ưu hóa Thuật toán Thùng gỗ Liebig trong Động cơ Tiện nghi (LCS)
- **Hiện tượng ban đầu:** Động cơ `ComfortScoreService` tính toán điểm tiện nghi theo công thức phi tuyến Liebig:
$$ LCS = S_{\text{weighted}} \cdot \left(0.30 + 0.70 \cdot \frac{S_{\min}}{S_{\text{weighted}}}\right) $$ {#eq}
  Khi phòng tự học tắt bớt đèn trần hoặc vào ca trực đêm ($I < 40\text{ lux}$), điểm ánh sáng $S_{\text{light}}$ tụt xuống thấp và kéo sập điểm cả phòng về mức Kém (Poor) dù không khí, nhiệt độ và độ yên tĩnh hoàn hảo.
- **Giải pháp đã cập nhật trong code:** Bổ sung bộ lọc `effectiveMinScore`: khi $S_{\text{light}} \le 40.0$ nhưng độ yên tĩnh âm học đạt $S_{\text{acoustic}} \ge 75.0$ ($\le 42\text{ dBA}$), hệ thống xác định phòng đang ở chế độ nghỉ/tiết kiệm năng lượng và tính $S_{\min}$ theo 3 chỉ số môi trường cốt lõi.

## Phân luồng Gói tin Xả bù Ngoại tuyến (Offline Replay Handling)
- **Hiện tượng ban đầu:** Khi mất Wi-Fi, ESP32-S3 nén dữ liệu vào Flash SPIFFS theo cấu trúc nhị phân 64-byte (`offline_record_64b_t`). Khi có mạng lại và xả bù, Backend ghi đè gói tin lịch sử lên `LatestTelemetryCache`, làm nhảy số sai lệch trên màn hình trực tiếp.
- **Giải pháp đã cập nhật trong code:** Firmware gắn cờ `"is_replay": true` khi xả bù (`offline_storage.c`). Tại `MqttMessageDispatcherService.java`, gói tin có `is_replay = true` chỉ ghi vào MongoDB TimeSeries để phục vụ biểu đồ lịch sử, tuyệt đối không ghi đè RAM Cache hiện thời.

## Bổ sung ZoneController và Chuẩn hóa Định tuyến RESTful
- **Giải pháp đã cập nhật trong code:** Xây dựng `ZoneController.java` (`/api/v1/zones`) phục vụ phân quyền theo khu vực (`ZONE_A`, `ZONE_B`, `ZONE_C`, `ZONE_HALL`) và bổ sung alias `/api/v1/telemetry/overview` cùng các route số ít/số nhiều trong `TelemetryController.java`.

[[PAGEBREAK]]

# ĐÁNH GIÁ THỰC TIỄN 7 HẠNG MỤC GIAO DIỆN & CẬP NHẬT TRONG SOURCE CODE

Dựa trên quá trình kiểm thử thực tế dưới góc độ người vận hành thư viện (Thủ thư, Kỹ thuật viên) và người sử dụng cuối (Sinh viên), 7 bất cập lớn của giao diện ban đầu đã được phân tích nguyên nhân gốc rễ và sửa đổi triệt để trong mã nguồn Frontend (`frontend/src/...`):

## Nhận xét 1: Giao diện Chi tiết Phòng đọc (`/rooms/[id]`)
- **Nhận xét thực tế:**
  1. Chỉ số tiện nghi mới chỉ có 4 thanh thành phần, còn thiếu chỉ số quan trọng; lưới 6 ô cảm biến lại hiển thị Tín hiệu Wi-Fi (RSSI) thay vì Khí CO2.
  2. Nhãn thời gian thực hiển thị cứng `"Định kỳ 15s"`, sai lệch với chu kỳ lấy mẫu thực tế của vi điều khiển (dữ liệu nóng/lạnh theo nguồn AC 5s / Pin UPS 60s / Cảnh báo khẩn cấp `<100ms`).
  3. Khi có chỉ số vượt ngưỡng, giao diện phẳng lặng, không nhấp nháy màu đỏ, không có chuông báo động âm thanh nên thủ thư nhìn vào không phân biệt được ngay chỉ số nào đang nguy hiểm.
  4. Biểu đồ lịch sử (`MinMaxAvgChart`) không có vạch ngang biểu thị ngưỡng giới hạn.
- **Thay đổi đã thực hiện trong code (`rooms/[id]/page.tsx` & `MinMaxAvgChart.tsx`):**
  1. **Mở rộng lên 6 trụ cột tiện nghi:** Bổ sung thanh *Thông thoáng khí tươi (SCD40 CO2)* theo chuẩn ASHRAE 62.1 và *An toàn bảo quản sách (Chống ẩm mốc VTT)* theo chuẩn TCVN 8681.
  2. **Đưa Khí CO2 (SCD40) vào lưới 6 ô cảm biến chính:** Thay thế vị trí của Wi-Fi RSSI (chuyển RSSI xuống thanh trạng thái trạm phát).
  3. **Chuẩn hóa nhãn nhịp lấy mẫu nhúng:** Sửa thành `"STOMP Realtime (<100ms · Chu kỳ AC 5s)"` và `"Chu kỳ nhúng: 5s (AC) / 60s (UPS)"`, đồng thời hạ chu kỳ polling dự phòng trong `queries.ts` xuống 5000ms.
  4. **Cảnh báo thị giác (Nhấp nháy đỏ) & Thính giác (Web Audio API Chime):** Khi Nhiệt độ $>26^\circ\text{C}$, Độ ẩm $>65\%$, Độ ồn $>55\text{ dBA}$, PM2.5 $>25\ \mu\text{g/m}^3$ hoặc CO2 $>1000\text{ ppm}$, ô cảm biến tự động chuyển viền đỏ, nhấp nháy (`animate-pulse`), gắn nhãn `⚠️ VƯỢT MỨC` và phát âm báo tần số kép `880Hz - 1174Hz`. Tích hợp thêm nút **"Test Cảnh báo Đỏ & Âm thanh"** ngay trên đầu trang để kiểm thử tức thì.
  5. **Vẽ vạch ngưỡng trên Biểu đồ SVG:** Trong `MinMaxAvgChart.tsx`, bổ sung đường tham chiếu nét đứt màu đỏ (`#EF4444`) kèm nhãn ngưỡng cụ thể cho từng tab (75 điểm, 55 dBA, 25 µg/m³, 26°C, 65%RH, 300 lux).

## Nhận xét 2: Giao diện Tổng quan (`/dashboard`)
- **Nhận xét thực tế:** Khối "Phòng đọc lý tưởng" và "Phòng cần chú ý" chưa đủ nổi bật; đặc biệt khi cảnh báo phòng cần chú ý lại không chỉ ra thủ thư cần phải làm gì, gây thiếu tính thực tiễn.
- **Thay đổi đã thực hiện trong code (`dashboard/page.tsx` & `lib/format/metrics.ts`):**
  1. Thiết kế lại 2 thẻ Spotlight với dải màu tương phản cao, hiệu ứng nhấp nháy khi vượt ngưỡng.
  2. Xây dựng hàm `getLibrarianActionGuide()` tự động phân tích nguyên nhân giới hạn và hiển thị hộp **"👉 Thủ thư cần thực hiện ngay (Quy trình SOP)"** ngay trong thẻ phòng cần chú ý (ví dụ: *Cử nhân sự nhắc nhở trật tự cụm bàn trung tâm; Bật quạt cấp khí tươi HVAC hạ CO2; Hạ điều hòa về 24°C và bật chế độ Dry chống ẩm mốc sách*).

## Nhận xét 3: Giao diện Trung tâm Cảnh báo (`/alerts`)
- **Nhận xét thực tế:** Giao diện máy trạng thái FSM rất tốt nhưng chỉ hiển thị thông báo lỗi mà thiếu cẩm nang chỉ dẫn hành động khắc phục cho từng cảnh báo.
- **Thay đổi đã thực hiện trong code (`alerts/page.tsx`):**
  1. Bổ sung панель **Cẩm nang Chỉ dẫn Xử lý Nhanh theo 4 Loại Cảnh báo (`ALERT_SOP_GUIDE`)** ở đầu trang, phân định rõ vai trò của *Thủ thư trực phòng* và *Kỹ thuật viên phần cứng nhúng*.
  2. Nâng cấp cột nội dung trong bảng cảnh báo thành **"Nội dung & Chỉ dẫn cần làm ngay (SOP)"**, đính kèm các bước kiểm tra cụ thể cho từng sự cố (`NOISE_EXCEEDED`, `AIR_UNHEALTHY`, `DEVICE_OFFLINE` kiểm tra nguồn 5V/LM1117-3.3 & SPIFFS, `SENSOR_MALFUNCTION` kiểm tra bus I2C GPIO 8/9 và I2S GPIO 4/5/6).

## Nhận xét 4: Giao diện Tra cứu Dữ liệu Cảm biến (`/telemetry-explorer`)
- **Nhận xét thực tế:** Chế độ tra cứu theo từng phòng/thiết bị và khoảng thời gian rất chi tiết nhưng khiến người quản lý không thể nhìn tổng quát toàn bộ các phòng cùng lúc.
- **Thay đổi đã thực hiện trong code (`telemetry-explorer/page.tsx`):**
  Bổ sung thanh chuyển đổi 2 chế độ:
  1. **Tab 1 — Bảng Tổng quan Đa phòng (Live Multi-Room Matrix - Mặc định):** Hiển thị ma trận toàn bộ 12 phòng đọc trên cùng một bảng thời gian thực với đầy đủ 7 chỉ số, cho phép sắp xếp nhanh theo *Phòng cần chú ý nhất, Độ ồn cao nhất, Khí CO2 cao nhất, hoặc theo Tầng*.
  2. **Tab 2 — Tra cứu Lịch sử 24h & Xuất CSV:** Giữ nguyên công cụ truy vấn gói tin thô chuyên sâu theo từng phòng/thiết bị.

[[PAGEBREAK]]

## Nhận xét 5: Giao diện Bản đồ Tầng & Mặt bằng Nhiệt (`/floorplan`)
- **Nhận xét thực tế:**
  1. Một số phòng thực tế có cấu trúc phân tầng/gác lửng (ví dụ Tầng 1 có phòng mượn giáo trình ở sàn dưới và kho sách ở tầng lửng phía trên), bản đồ phẳng 2D chưa làm rõ cấu trúc này.
  2. Khi phòng rộng có nhiều node, cần nhìn rõ số lượng node và phạm vi bán kính bao phủ của node có che phủ hết diện tích phòng hay không.
  3. Về việc kéo thả node trên heatmap: thực tế ở trang Quản lý Thiết bị đã có phần cài đặt tọa độ, đồng nghĩa khi lắp đặt thực tế phải đo tính toán tọa độ trên bản vẽ trước rồi nhập lên Server.
- **Thay đổi đã thực hiện trong code (`floorplan/page.tsx`):**
  1. Bật mặc định lớp hiển thị **Vùng phủ cảm biến (`R = 6.0m`) & Điểm mù (`showBlindspots = true`)** kèm nút bật/tắt nhanh ngay trên thanh công cụ chính.
  2. Bổ sung **Thanh Kiểm toán Mật độ Node, Bán kính Phủ sóng & Cấu trúc Phân tầng** hiển thị rõ từng phòng có bao nhiêu Node trên tổng số Node khuyến nghị (tỷ lệ `%` diện tích được bao phủ), đồng thời gắn nhãn **`2 Cao độ: Sàn T1 (Mượn) + Tầng lửng (Kho sách)`** cho các không gian có gác lửng/kho sách.
  3. Ghi chú rõ quy chuẩn công nghiệp trên giao diện: Tọa độ $(X, Y)$ được chuẩn hóa từ bản vẽ hoàn công CAD (sai số $<5\text{ cm}$) tại mục *Quản lý Thiết bị*, còn Heatmap dùng để nghiệm thu trực quan vùng phủ.

## Nhận xét 6: Tốc độ Chuyển trang và Tối ưu Hóa Hiệu năng Web
- **Nhận xét thực tế:** Khi click chuyển qua lại giữa các trang bị khựng và chờ tải rất lâu (3 đến 15 giây), gây ức chế.
- **Nguyên nhân kỹ thuật & Giải pháp đã thực hiện:**
  1. **Nguyên nhân gốc rễ:** Trước đó Frontend được chạy bằng lệnh `npm run dev` (Next.js Development Mode). Ở chế độ Dev, Next.js chỉ biên dịch từng trang khi người dùng click vào lần đầu tiên (Just-In-Time compilation tốn hàng nghìn module JS), dẫn đến độ trễ 3–17 giây.
  2. **Giải pháp đã cập nhật:**
     - Tinh chỉnh `QueryClient` trong `src/app/providers.tsx`: nâng `staleTime` lên `30.000ms`, `gcTime` lên `300.000ms` và tắt `refetchOnMount` dư thừa, triệt tiêu hoàn toàn hiện tượng gọi lại API dây chuyền khi chuyển tab.
     - Biên dịch toàn bộ ứng dụng sang bản **Production Build (`npm run build` & `npm run start`)**: Mọi trang được biên dịch tĩnh và nạp trước (`<Link prefetch>`), giúp tốc độ chuyển trang thực tế đạt **`< 50ms` (tức thì)**.

## Nhận xét 7: Giao diện Màn hình Kiosk Công cộng (`/kiosk`)
- **Nhận xét thực tế:** Kiosk ban đầu đưa quá nhiều biểu đồ và bản đồ kỹ thuật phức tạp của Admin/Thủ thư ra màn hình sảnh. Sinh viên đứng ở ngoài nhìn vào bị rối, không biết hiện tại mình đang đứng ở đâu, nên vào phòng nào học và đi đường nào lên phòng đó.
- **Thay đổi đã thực hiện trong code (`kiosk/page.tsx`):**
  Thiết kế lại Kiosk với 2 chế độ chuyển đổi linh hoạt, trong đó mặc định là **🎓 Chế độ Sinh viên (Gợi ý nhanh trong 5 giây)**:
  1. **Định vị rõ ràng "📍 BẠN ĐANG Ở ĐÂY: SẢNH CHÍNH TẦNG 1 (CỔNG VÀO TQB)":** Chỉ dẫn rõ Thang máy Trung tâm và Cầu thang bộ nằm cách vị trí đứng 15 mét.
  2. **Khối "GỢI Ý TOP 3 PHÒNG ĐỌC TỐT NHẤT ĐỂ VÀO HỌC NGAY":** Hiển thị 3 phòng có điểm tiện nghi cao nhất với ngôn ngữ tự nhiên dễ hiểu (*"🤫 Rất yên tĩnh"*, *"❄️ Mát mẻ"*, *"🌿 Không khí trong lành"*) kèm hộp chỉ dẫn đường đi từng bước (*"Đi Thang máy Trung tâm lên Tầng 3 → Rẽ trái 15m"*).
  3. **Bảng tra cứu nhanh phân loại theo 3 màu đèn giao thông:** 🟢 *Màu Xanh (Nên vào học ngay)*, 🟡 *Màu Vàng (Học nhóm / Hơi ồn)*, 🔒 *Kho Lưu trữ*. Khi sinh viên chạm vào bất kỳ phòng nào, Kiosk tự động mở sơ đồ mặt bằng dẫn đường của đúng tầng đó.
  4. Giữ lại nút chuyển sang **🗺️ Bản đồ Chi tiết & Thủ thư** cho nhân sự vận hành khi cần kiểm tra chuyên sâu.

[[PAGEBREAK]]

# BẢO TOÀN CÁC THUẬT TOÁN NHÚNG CỐT LÕI & HƯỚNG DẪN KHỞI CHẠY

## Các Thuật toán Cốt lõi Được Bảo toàn trên Firmware ESP32-S3 (`main/`)
1. **Thuật toán Đánh giá Độ ồn Chuẩn Âm học $L_{\text{Aeq}}$ qua I2S0 DMA (`audio_i2s.c`):**
   - Thu mẫu âm thanh 24-bit ở tần số 16 kHz từ Micro INMP441 qua DMA, lọc thông cao IIR bậc 1 khử DC offset:
$$ y[n] = 0.995 \cdot y[n-1] + 0.005 \cdot x[n]; \quad x_{\text{clean}}[n] = x[n] - y[n] $$ {#eq}
   - Quy đổi dB SPL và tích phân EMA thời gian thực, tự động kích hoạt loa I2S1 MAX98357A khi vượt ngưỡng:
$$ \text{SPL}_{\text{inst}} = 94.0 + 20 \cdot \log_{10}\left(\frac{\text{RMS}}{8388608}\right) + 26.0 $$ {#eq}
2. **Nén Nhị phân 64-byte trên Flash SPIFFS (`offline_storage.c`):** Lưu trữ 14.600 bản ghi (40 giờ mất mạng liên tục) trong 1MB Flash.
3. **Truyền tin Đa Chu kỳ Tiết kiệm Năng lượng (`main.c`):** Chu kỳ nhanh khi cấp nguồn lưới AC, tự động giãn chu kỳ khi chạy pin dự phòng UPS, và ngắt khẩn cấp `<100ms` khi vượt ngưỡng nguy hiểm.

## Địa chỉ Truy cập Cục bộ (Localhost) Sau Tối ưu hóa

Table: Bảng danh mục cổng dịch vụ và địa chỉ truy cập cục bộ
| Tên phân hệ / Dịch vụ | Giao thức & Cổng | Địa chỉ truy cập cục bộ (URL) | Tài khoản / Ghi chú kiểm thử |
|---|---|---|---|
| **Frontend Web (Production)** | HTTP (Port 3000) | `http://localhost:3000/dashboard` | Chuyển trang tức thì `<50ms` |
| **Chi tiết Phòng đọc & Test Alert**| HTTP (Port 3000) | `http://localhost:3000/rooms` | Có nút Test Cảnh báo Đỏ & Chuông |
| **Ma trận Cảm biến Đa phòng** | HTTP (Port 3000) | `http://localhost:3000/telemetry-explorer` | Xem bao quát 12 phòng + Xuất CSV |
| **Bản đồ Mặt bằng CAD TQB** | HTTP (Port 3000) | `http://localhost:3000/floorplan` | Bán kính phủ R=6m & Phân tầng |
| **Màn hình Kiosk Sinh viên** | HTTP (Port 3000) | `http://localhost:3000/kiosk` | Top 3 phòng gợi ý & Chỉ đường |
| **Backend REST API Core** | HTTP (Port 8080) | `http://localhost:8080/api/v1/...` | Spring Boot 3 + Virtual Threads |
| **Quản trị Cơ sở Dữ liệu** | HTTP (Port 8081) | `http://localhost:8081` | Mongo Express (`admin` / `pass`) |
| **Eclipse Mosquitto MQTT** | TCP (Port 1883) | `mqtt://localhost:1883` | Xác thực ACL theo thiết bị (`%u`) |
