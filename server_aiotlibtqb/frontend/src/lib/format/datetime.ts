import { UI_TEXT_VI } from '@/messages/vi';

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

export function formatVietnamDateTime(
  isoString: string | null | undefined
): string {
  if (!isoString) return '--';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '--';

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatRelativeTimeVi(
  isoString: string | null | undefined,
  nowMs: number = Date.now()
): string {
  if (!isoString) return UI_TEXT_VI.neverConnected;
  const targetMs = new Date(isoString).getTime();
  if (Number.isNaN(targetMs)) return UI_TEXT_VI.neverConnected;

  const diffSeconds = Math.max(0, Math.floor((nowMs - targetMs) / 1000));
  if (diffSeconds < 15) return 'Vừa xong';
  if (diffSeconds < 60) return `${diffSeconds} giây trước`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}
