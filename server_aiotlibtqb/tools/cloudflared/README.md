# AIoTLibTQB Public Web Access (Phương án 2: Cloudflare Tunnel)

Công cụ này cho phép phát toàn bộ hệ thống web **AIoTLibTQB** từ máy tính cá nhân ra mạng Internet toàn cầu với kết nối bảo mật **HTTPS / WSS** miễn phí mà **không cần**:
- Mua tên miền (Domain)
- Mua Cloud VPS
- Mở cổng Modem (Port Forwarding / NAT)
- Đăng ký IP tĩnh

---

## 🛠️ Cách Thức Hoạt Động (Kiến Trúc Unified Gateway)

```
[Người dùng trên Internet (Điện thoại / Laptop)]
               |  (Truy cập https://xyz.trycloudflare.com)
               v
      [Cloudflare Global Edge Network]
               |  (Đường hầm mã hóa TLS)
               v
  [tools/cloudflared/cloudflared.exe]
               |  (Chuyển tiếp về Port 4000)
               v
   [Local Gateway - gateway.js :4000]
     ├── /api/v1/*   ──> Spring Boot Backend (:8080)
     ├── /ws-aiot/*  ──> WebSocket STOMP Server (:8080)
     └── /*          ──> Next.js Frontend (:3000)
```

---

## 🚀 Hướng Dẫn Sử Dụng (1-Click)

### Bước 1: Khởi động các dịch vụ của dự án
Đảm bảo bạn đã khởi động hệ thống như bình thường:
```bash
docker compose up -d
```
*(Hoặc chạy Backend trên cổng 8080 và Frontend trên cổng 3000)*.

### Bước 2: Bật đường hầm Cloudflare Tunnel
Có 2 cách:
1. **Cách 1 (Chuột)**: Nhấp đúp chuột vào tệp `tools/cloudflared/start-public-web.bat`.
2. **Cách 2 (Terminal)**: Mở PowerShell và chạy:
   ```powershell
   .\tools\cloudflared\start-public-web.ps1
   ```

### Bước 3: Nhận link truy cập
Terminal sẽ hiển thị đường link công khai dạng:
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://example-random-words.trycloudflare.com                                            |
+--------------------------------------------------------------------------------------------+
```

Sao chép đường link `https://*.trycloudflare.com` và gửi cho bất kỳ ai (hoặc mở trên điện thoại) để truy cập hệ thống ngay lập tức!
Bấm `Ctrl + C` trong cửa sổ lệnh để tắt đường hầm khi không dùng nữa.
