# UI Style Guide — AIoTLibTQB Frontend

> Phong cách: **sáng, tối giản (Linear/Vercel)**. Nền trắng ngà, viền mảnh, ít màu; số liệu là điểm nhấn.
> Tokens: `frontend/tailwind.config.ts`. Lớp component: `frontend/src/app/globals.css`.
> Kiosk (`/kiosk`) là ngoại lệ duy nhất: nền tối.

## 1. Quy tắc màu
| Mục đích | Dùng | KHÔNG dùng |
|---|---|---|
| Nút chính, link, focus, mục đang chọn | `brand-*` (indigo) qua `.btn-primary`, `text-brand-600` | `emerald-*` cho hành động |
| Trạng thái tốt / cảnh báo / lỗi | `emerald` / `amber` / `red` qua `.badge-success|warning|danger` | Tô cả nền thẻ bằng màu trạng thái |
| Hạng tiện nghi, màu chỉ số | `getGradeStyle()` / `getMetricColorHex()` (chấm màu, viền mảnh, thanh tiến trình) | Hard-code hex |
| Chữ | `slate-900` tiêu đề/số, `slate-700` nội dung, `slate-500` phụ, `slate-400` placeholder/đơn vị | `slate-300` cho chữ trên nền trắng |

- Không gradient, không `dark:` mới trong trang quản trị (app không bật dark mode).
- Không nền màu đậm cho khối lớn (vd. `bg-emerald-600` cả thẻ). Màu chỉ ở chấm, badge, viền trái 2px, hoặc con số.

## 2. Chữ
- Font: Be Vietnam Pro (đã nạp qua `next/font`). Cỡ cơ sở 14px.
- Thang dùng được: `text-2xs` (11px, chỉ nhãn nhóm/metadata), `text-xs` (12), `text-[13px]`, `text-sm` (14), `text-base`, `text-lg`, `text-xl` (tiêu đề trang), `text-2xl`/`text-3xl` (chỉ cho con số KPI).
- **Cấm**: `text-[10px]`, `text-[11px]` (dùng `text-2xs`), `font-black`, `font-extrabold`. Đậm nhất là `font-semibold` (riêng số KPI có thể `font-semibold`).
- **Cấm** `uppercase tracking-wider` cho nhãn — dùng `.eyebrow`/`.metric-label` (chữ thường, `text-xs text-slate-500`).
- Số liệu: luôn thêm `tabular-nums`. Đơn vị dùng `.metric-unit` (nhỏ, nhạt).

## 3. Bo góc & đổ bóng
- Thẻ/khung/modal: `rounded-xl` (10px). Nút/input/select: `rounded-lg` (8px). Badge: `rounded-md`. Chấm/avatar: `rounded-full`.
- **Cấm** `rounded-2xl`, `rounded-3xl` trong code mới (config đã nén nhưng phải thay khi rà trang). Không dùng `rounded-full` cho nút/khung chữ nhật.
- Bóng: thẻ `shadow-xs`; dropdown/toast `shadow-lg`; modal `shadow-xl`. Không `shadow-2xl`, `shadow-inner`.

## 4. Lớp component (ưu tiên dùng)
- Trang: `<div className="page">` → `<div className="page-header"><div><h1 className="page-title">…</h1><p className="page-subtitle">…</p></div><div>…actions</div></div>`.
- Thẻ: `.card` (+ `.card-header`, `.card-body`), thẻ bấm được `.card-interactive`.
- KPI: `.metric-label`, `.metric-value`, `.metric-unit`.
- Nút: `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.btn-danger-ghost`, `.btn-icon`; thêm `.btn-sm` cho nút trong bảng.
- Form: `.label`, `.input`, `.select`, `.textarea`, `.hint`, `.field-error`, `.checkbox`.
- Bảng: bọc `.card` > `.table-wrap` > `<table className="data-table">`; `PaginationBar` đặt ngay dưới bảng trong cùng card.
- Badge: `.badge-neutral|brand|success|warning|danger` + `<span className="dot bg-…" />`.
- Bộ lọc dạng tab: `.segmented` + `.segmented-item` / `.segmented-item-active`.

## 5. Icon
- Chỉ dùng `lucide-react`, cỡ `h-4 w-4` (trong nút/menu) hoặc `h-5 w-5` (ô icon của thẻ), màu `text-slate-400`/`text-slate-500`, luôn `aria-hidden="true"`.
- **Cấm emoji** làm icon (🔔 👤 ⚠️ ✓ ✕ …).

## 6. Văn phong UI
- Tiếng Việt thuần, ngắn: "Tiếp nhận", "Đóng sự cố", "Sao chép", "Trực tuyến". Không ghép song ngữ kiểu "Tiếp nhận (Ack)", "(Copy to Clipboard)".
- Không hiển thị mã nội bộ (`M03`, `FE-API-09`, `(M11)`) trên giao diện.
- Không viết hoa toàn bộ câu.

## 7. Khoảng cách
- Giữa các khối trong trang: `space-y-6` (đã có trong `.page`). Lưới thẻ: `gap-4`. Trong thẻ: `p-5` (`.card-body`).
- Bộ lọc: một hàng `flex flex-wrap items-end gap-3`, mỗi ô có `.label` phía trên.
