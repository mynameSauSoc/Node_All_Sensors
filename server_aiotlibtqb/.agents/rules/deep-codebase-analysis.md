---
name: deep-codebase-analysis
description: Áp dụng khi phân tích toàn diện, kiểm toán kiến trúc (audit), lập roadmap hoặc thiết kế UI/API từ một codebase hiện hữu.
trigger: model_decision
---

# Quy Tắc Phân Tích & Kiểm Toán Mã Nguồn Chuyên Sâu

Khi thực hiện nhiệm vụ đọc hiểu, phân tích, kiểm toán hoặc đánh giá kiến trúc codebase:

## 1. BẰNG CHỨNG 3 LỚP
- Gắn nhãn minh chứng bắt buộc trên mọi nhận định kỹ thuật kèm trích dẫn tọa độ `file:dòng` hoặc `file:class:method`:
  - `[XÁC NHẬN]`: Thấy trực tiếp trong mã nguồn, file cấu hình hoặc tài liệu chính thức.
  - `[SUY LUẬN]`: Suy ra từ nhiều dấu hiệu thực tế (nêu rõ các dấu hiệu căn cứ).
  - `[CHƯA RÕ]`: Thiếu dữ liệu hoặc mâu thuẫn -> bắt buộc đưa vào danh mục "Câu hỏi mở", tuyệt đối không tự suy đoán.
- Tuyệt đối không bịa đặt chức năng không có bằng chứng.

## 2. NGUYÊN TẮC XỬ LÝ XUNG ĐỘT CODE VS DOCS
- Khi tài liệu mâu thuẫn hoặc lệch pha với mã nguồn:
  - Lấy **Code làm chuẩn tối cao cho Hiện trạng (Current State)**.
  - Lấy **Tài liệu làm chuẩn cho Ý định ban đầu (Design Intent)**.
- Liệt kê riêng các điểm lệch kiến trúc (Architectural Drift) và phân loại rõ tính năng (Production-Ready / Stub / Dead Dependency / Chưa có).

## 3. PHÂN CÔNG SUBAGENT ĐƠN NHIỆM & CÔ LẬP NGỮ CẢNH
- Chia tách nhiệm vụ theo các trục kỹ thuật độc lập trực giao (Code vs Config/Hạ tầng vs Docs/Lịch sử vs Contract/Test).
- Mỗi subagent chỉ ghi duy nhất 01 file mục tiêu và ghi lũy tiến theo từng phần (streaming/incremental write).
- Giới hạn ngân sách nghiêm ngặt: Tối đa 4 subagent đồng thời, tổng không quá 6 cho cả đợt; nghiêm cấm subagent sinh đệ quy thêm subagent.

## 4. GIỚI HẠN VÒNG LẶP SỬA LỖI (MAX RETRY = 2)
- Mỗi nhiệm vụ con hoặc tương tác công cụ chỉ được thử lại tối đa 2 lần.
- Cùng một lỗi kỹ thuật (timeout MCP, lỗi công cụ, không tìm thấy file...) gặp 2 lần liên tiếp thì **DỪNG NGAY**, bảo toàn hiện trạng và đưa vào mục "Câu hỏi mở" để con người can thiệp.

## 5. QUÉT MỤC TIÊU BẰNG TỪ KHÓA TRƯỚC KHI ĐỌC SÂU
- Tiếp cận 2 bước:
  - **Bước 1 (Lập khung mục tiêu)**: Dùng grep/search lập danh mục annotations (`@RestController`, `@GetMapping`, `@Scheduled`, `@ServiceActivator`, `@PreAuthorize`...), DTOs, Enums, `TODO|FIXME` trước.
  - **Bước 2 (Đọc sâu có chủ đích)**: Chỉ đọc sâu các hàm và đoạn mã logic phức tạp liên quan trực tiếp đến luồng phân tích. Tuyệt đối không đọc toàn bộ file lớn nếu không cần thiết.

## 6. AN TOÀN & BẢO MẬT DỮ LIỆU TUYỆT ĐỐI
- Giữ nguyên tắc Read-only đối với mã nguồn trong `src/`, file cấu hình và tiến trình build.
- Tuyệt đối không sao chép giá trị secret/credential (JWT secret, mật khẩu DB/MQTT, API key). Chỉ ghi tên khóa và mức độ nhạy cảm; luôn che giá trị bằng `***`.
