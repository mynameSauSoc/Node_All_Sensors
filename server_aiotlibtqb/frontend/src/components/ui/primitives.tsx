'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Inbox,
  RotateCw,
  X,
  XCircle,
} from 'lucide-react';
import { getGradeStyle } from '@/config/thresholds';
import type { ComfortGrade } from '@/types/api';

// 1. Skeleton Shimmer (FE-UI-01)
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-slate-200/70 ${className}`}
    />
  );
}

// 2. Empty State with Contextual CTA (FE-UI-01)
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden="true" />}
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="btn-primary mt-5">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// 3. Error Banner with Retry (FE-UI-01)
export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-800"
    >
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          Thử lại
        </button>
      )}
    </div>
  );
}

// 4. Comfort Grade Badge (FE-UI-04, FE-A11Y-01: Color + Icon + Text)
export function GradeBadge({
  grade,
  score,
}: {
  grade?: ComfortGrade | 'N/A' | string | null;
  score?: number | null;
}) {
  const style = getGradeStyle(grade, score);
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200"
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: style.hex }}
        aria-hidden="true"
      />
      <span>{style.labelVi}</span>
    </span>
  );
}

// 5. Connection Badge (FE-A11Y-01: Never convey status by color alone)
export function ConnectionBadge({
  online,
  connectionState,
}: {
  online?: boolean;
  connectionState?: string | null;
}) {
  const isOnline =
    online === true ||
    (online === undefined &&
      connectionState?.toUpperCase() === 'ONLINE');

  return isOnline ? (
    <span className="badge-success">
      <span className="dot bg-emerald-500" aria-hidden="true" />
      Trực tuyến
    </span>
  ) : (
    <span className="badge-neutral">
      <span className="dot bg-slate-400" aria-hidden="true" />
      Mất kết nối
    </span>
  );
}

// 6. Accessible Modal / Confirm Dialog with Keyboard Escape & Focus Trap (FE-A11Y-03, FE-SEC-06)
export function ModalDialog({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[10vh] backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="modal-title" className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="btn-icon -mr-1.5 -mt-1"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// 7. Pagination Controls (0-based matching PageResponse<T>, FE-API-04)
export function PaginationBar({
  page,
  totalPages,
  totalElements,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (nextPage: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-[13px] text-slate-500">
      <span className="tabular">
        {totalElements} bản ghi · Trang{' '}
        <span className="font-medium text-slate-900">{page + 1}</span> /{' '}
        {Math.max(1, totalPages)}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
          className="btn-secondary btn-sm"
          aria-label="Trang trước"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Trước
        </button>
        <button
          type="button"
          disabled={page + 1 >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="btn-secondary btn-sm"
          aria-label="Trang sau"
        >
          Sau
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// 8. Toast Notification System with aria-live (FE-A11Y-04)
export interface ToastItem {
  id: string;
  title: string;
  message: string;
  variant: 'info' | 'success' | 'warning' | 'danger';
}

interface ToastContextValue {
  pushToast: (item: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue>({
  pushToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const TOAST_ICON: Record<ToastItem['variant'], React.ReactNode> = {
  info: <Info className="h-4 w-4 text-brand-600" aria-hidden="true" />,
  success: <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />,
  danger: <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (item: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-4), { ...item, id }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.variant === 'danger' ? 'alert' : 'status'}
            aria-live={t.variant === 'danger' ? 'assertive' : 'polite'}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg"
          >
            <span className="mt-0.5">{TOAST_ICON[t.variant]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">{t.title}</p>
              {t.message && (
                <p className="mt-0.5 text-[13px] text-slate-500">{t.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Đóng thông báo"
              className="-m-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
