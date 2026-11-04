'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import { ModalDialog, useToast } from '@/components/ui/primitives';

export interface OneTimeKeyDialogProps {
  open: boolean;
  deviceName: string;
  hardwareId: string;
  rawApiKey: string | null;
  alreadyExisted?: boolean;
  onClose: () => void;
}

const CLIPBOARD_CLEAR_MS = 60_000;

/**
 * FE-SEC-02 / FE-SEC-05: Hiển thị rawApiKey đúng 1 lần duy nhất trong bộ nhớ (ephemeral state).
 * Tuyệt đối không ghi rawApiKey vào localStorage, sessionStorage hoặc console.log.
 */
export function OneTimeKeyDialog({
  open,
  deviceName,
  hardwareId,
  rawApiKey,
  alreadyExisted = false,
  onClose,
}: OneTimeKeyDialogProps) {
  const { pushToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const clipboardTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (clipboardTimerRef.current !== null) {
        window.clearTimeout(clipboardTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (!rawApiKey) return;
    try {
      await navigator.clipboard.writeText(rawApiKey);
      setCopied(true);
      pushToast({
        title: 'Đã sao chép API Key',
        message: 'Khóa thiết bị đã được lưu vào Clipboard (tự động xóa sau 60 giây).',
        variant: 'success',
      });
      setTimeout(() => setCopied(false), 3000);
      if (clipboardTimerRef.current !== null) {
        window.clearTimeout(clipboardTimerRef.current);
      }
      clipboardTimerRef.current = window.setTimeout(() => {
        navigator.clipboard.writeText('').catch(() => {});
        clipboardTimerRef.current = null;
      }, CLIPBOARD_CLEAR_MS);
    } catch {
      pushToast({
        title: 'Không thể sao chép tự động',
        message: 'Vui lòng chọn và sao chép chuỗi khóa thủ công.',
        variant: 'warning',
      });
    }
  };

  const handleSafeClose = () => {
    setCopied(false);
    setConfirmedSaved(false);
    onClose();
  };

  return (
    <ModalDialog
      open={open}
      title={
        alreadyExisted
          ? 'Thiết bị đã đăng ký trước đó'
          : 'Khóa xác thực thiết bị (One-Time API Key)'
      }
      description={`Thiết bị: ${deviceName || '--'} · Mã phần cứng: ${hardwareId || '--'}`}
      onClose={handleSafeClose}
    >
      <div className="space-y-4">
        {alreadyExisted ? (
          <div
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 leading-relaxed"
          >
            <p className="font-semibold">
              Thiết bị mang mã phần cứng <code className="font-mono text-slate-900">{hardwareId}</code> đã tồn tại trong hệ thống.
            </p>
            <p className="mt-1 opacity-90">
              Vì lý do bảo mật, hệ thống không cấp lại khóa mới khi đăng ký lặp lại. Nếu bạn làm mất khóa cũ, vui lòng vào trang Chi tiết thiết bị để chọn <strong>Cấp lại API Key</strong>.
            </p>
          </div>
        ) : rawApiKey ? (
          <>
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">
                  Khóa API Key này chỉ hiển thị duy nhất một lần. Vui lòng sao chép và nạp vào firmware ngay.
                </p>
                <p className="mt-0.5 text-amber-700">
                  Sau khi đóng hộp thoại, chuỗi khóa gốc sẽ bị xóa khỏi bộ nhớ và không thể khôi phục.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-2xs text-slate-500">
                  X-API-KEY / MQTT Secret
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="btn-secondary btn-sm"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                      <span>Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="mt-2 overflow-x-auto rounded border border-slate-200 bg-white p-2.5 font-mono text-xs text-brand-700 break-all select-all">
                {rawApiKey}
              </pre>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 select-none">
              <input
                type="checkbox"
                checked={confirmedSaved}
                onChange={(e) => setConfirmedSaved(e.target.checked)}
                className="checkbox"
              />
              <span>
                Tôi đã sao chép và lưu trữ an toàn khóa API Key cho trạm{' '}
                <strong className="font-mono">{hardwareId}</strong>.
              </span>
            </label>
          </>
        ) : (
          <p className="text-xs text-slate-500">
            Không có khóa API Key mới nào được trả về từ máy chủ.
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            disabled={Boolean(rawApiKey && !alreadyExisted && !confirmedSaved)}
            onClick={handleSafeClose}
            className="btn-primary btn-sm"
          >
            Đã hiểu & Đóng hộp thoại
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
