import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from './providers';

export const metadata: Metadata = {
  title: 'AIoTLibTQB — Giám sát Vi khí hậu & Âm học Thư viện Tạ Quang Bửu',
  description:
    'Hệ thống quản lý và giám sát chất lượng môi trường, âm học phòng đọc thời gian thực.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
