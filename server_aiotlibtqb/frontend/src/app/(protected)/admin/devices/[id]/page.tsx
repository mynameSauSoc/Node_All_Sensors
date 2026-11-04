'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ChevronRight,
  KeyRound,
  Trash2,
} from 'lucide-react';
import {
  ConnectionBadge,
  ErrorBanner,
  ModalDialog,
  Skeleton,
  useToast,
} from '@/components/ui/primitives';
import { useAuthStore } from '@/features/auth/store';
import { OneTimeKeyDialog } from '@/features/devices/components/OneTimeKeyDialog';
import {
  useDeleteDeviceMutation,
  useDeviceDetailQuery,
  useRegenerateDeviceKeyMutation,
  useToggleDeviceStatusMutation,
  useUpdateDeviceMutation,
} from '@/features/devices/queries';
import { useRoomsQuery } from '@/features/rooms/queries';
import {
  formatRelativeTimeVi,
  formatVietnamDateTime,
} from '@/lib/format/datetime';
import { ApiError } from '@/lib/http/error-mapper';
import { ERROR_MESSAGES_VI } from '@/messages/vi';

interface MetadataFormState {
  name: string;
  zoneId: string;
  roomId: string;
  posX: string;
  posY: string;
  deviceType: string;
  location: string;
  firmwareVersion: string;
}

export default function DeviceDetailPage() {
  const params = useParams<{ id: string }>();
  const deviceId = typeof params?.id === 'string' ? params.id : '';
  const router = useRouter();
  const capabilities = useAuthStore((s) => s.capabilities);
  const { pushToast } = useToast();

  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const deviceQuery = useDeviceDetailQuery(deviceId);
  const roomsQuery = useRoomsQuery({ page: 0, size: 100 });
  const rooms = roomsQuery.data?.content ?? [];

  const updateMutation = useUpdateDeviceMutation();
  const toggleStatusMutation = useToggleDeviceStatusMutation();
  const regenerateKeyMutation = useRegenerateDeviceKeyMutation();
  const deleteMutation = useDeleteDeviceMutation();

  const device = deviceQuery.data;

  const [form, setForm] = useState<MetadataFormState>({
    name: '',
    zoneId: '',
    roomId: '',
    posX: '',
    posY: '',
    deviceType: '',
    location: '',
    firmwareVersion: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!device) return;
    setForm({
      name: device.name ?? '',
      zoneId: device.zoneId ?? '',
      roomId: device.roomId ?? '',
      posX:
        device.posX !== null && device.posX !== undefined
          ? String(device.posX)
          : '',
      posY:
        device.posY !== null && device.posY !== undefined
          ? String(device.posY)
          : '',
      deviceType: device.deviceType ?? '',
      location: device.location ?? '',
      firmwareVersion: device.firmwareVersion ?? '',
    });
  }, [device]);

  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [regenAckChecked, setRegenAckChecked] = useState(false);

  const [keyDialog, setKeyDialog] = useState<{
    open: boolean;
    rawApiKey: string | null;
  }>({
    open: false,
    rawApiKey: null,
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!device) return;
    setFormError(null);

    const name = form.name.trim();
    const zoneId = form.zoneId.trim();

    if (!name) {
      setFormError(ERROR_MESSAGES_VI[3004]);
      return;
    }
    if (!zoneId) {
      setFormError(ERROR_MESSAGES_VI[3006]);
      return;
    }

    const posX = form.posX ? parseFloat(form.posX) : undefined;
    const posY = form.posY ? parseFloat(form.posY) : undefined;

    if (posX !== undefined && (posX < 0 || posX > 1)) {
      setFormError('Tọa độ tương đối X phải nằm trong khoảng [0.0 - 1.0].');
      return;
    }
    if (posY !== undefined && (posY < 0 || posY > 1)) {
      setFormError('Tọa độ tương đối Y phải nằm trong khoảng [0.0 - 1.0].');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: device.id,
        body: {
          name,
          zoneId,
          roomId: form.roomId.trim(),
          posX,
          posY,
          deviceType: form.deviceType.trim() || undefined,
          location: form.location.trim(),
          firmwareVersion: form.firmwareVersion.trim() || undefined,
        },
      });

      pushToast({
        title: 'Cập nhật thành công',
        message: `Thông tin trạm ${device.name} đã được lưu vào hệ thống.`,
        variant: 'success',
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Không thể cập nhật cấu hình thiết bị.';
      setFormError(msg);
    }
  };

  const handleToggleActive = async () => {
    if (!device) return;
    const nextActive = !device.active;
    try {
      await toggleStatusMutation.mutateAsync({
        id: device.id,
        active: nextActive,
      });
      pushToast({
        title: 'Cập nhật trạng thái',
        message: `Thiết bị ${device.name} đã ${nextActive ? 'được kích hoạt' : 'bị tạm ngưng'}.`,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Thao tác thất bại',
        message:
          err instanceof ApiError ? err.message : ERROR_MESSAGES_VI[9999],
        variant: 'danger',
      });
    }
  };

  const handleConfirmRegenerateKey = async () => {
    if (!device || !regenAckChecked) return;
    try {
      const res = await regenerateKeyMutation.mutateAsync(device.id);
      setRegenConfirmOpen(false);
      setRegenAckChecked(false);

      setKeyDialog({
        open: true,
        rawApiKey: res.rawApiKey,
      });

      pushToast({
        title: 'Đã sinh API Key mới',
        message: 'Khóa cũ đã bị vô hiệu hóa lập tức.',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Không thể cấp lại khóa',
        message:
          err instanceof ApiError ? err.message : ERROR_MESSAGES_VI[9999],
        variant: 'danger',
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!device) return;
    try {
      await deleteMutation.mutateAsync(device.id);
      pushToast({
        title: 'Đã xóa thiết bị',
        message: `Trạm ${device.hardwareId} đã được xóa khỏi hệ thống.`,
        variant: 'info',
      });
      setDeleteConfirmOpen(false);
      router.push('/admin/devices');
    } catch (err) {
      pushToast({
        title: 'Không thể xóa thiết bị',
        message:
          err instanceof ApiError ? err.message : ERROR_MESSAGES_VI[9999],
        variant: 'danger',
      });
    }
  };

  if (deviceQuery.isLoading) {
    return (
      <div className="page space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (deviceQuery.isError || !device) {
    return (
      <div className="page space-y-4">
        <Link href="/admin/devices" className="text-xs text-slate-500 hover:text-slate-900">
          ← Quay lại danh sách thiết bị
        </Link>
        <ErrorBanner
          message={
            deviceQuery.error instanceof ApiError
              ? deviceQuery.error.message
              : ERROR_MESSAGES_VI[3001]
          }
          onRetry={() => void deviceQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link href="/admin/devices" className="text-slate-500 hover:text-slate-900">
            Quản lý thiết bị
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="font-medium text-slate-900">{device.name}</span>
        </div>

        <div className="page-header pt-1">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="page-title">{device.name}</h1>
              <ConnectionBadge
                online={device.online}
                connectionState={device.connectionState}
              />
            </div>
            <p className="mt-0.5 font-mono text-2xs text-slate-500">
              Hardware ID: {device.hardwareId} · Phân vùng: {device.zoneId}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {capabilities.canManageDevices && (
              <button
                type="button"
                disabled={toggleStatusMutation.isPending}
                onClick={() => void handleToggleActive()}
                className="btn-secondary btn-sm"
              >
                {device.active ? 'Tạm ngưng nhận tin' : 'Kích hoạt lại'}
              </button>
            )}

            {capabilities.canManageDevices && (
              <button
                type="button"
                onClick={() => {
                  setRegenAckChecked(false);
                  setRegenConfirmOpen(true);
                }}
                className="btn-secondary btn-sm text-amber-700 hover:bg-amber-50"
              >
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Cấp lại API Key</span>
              </button>
            )}

            {capabilities.canDeleteDevice && (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="btn-danger-ghost btn-sm"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Xóa</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <span className="metric-label">Lần cuối gửi bản tin</span>
          <div className="mt-1 font-semibold text-slate-900 tabular">
            {formatRelativeTimeVi(device.lastSeenAt, nowTick)}
          </div>
          <div className="text-2xs text-slate-400">
            {formatVietnamDateTime(device.lastSeenAt)}
          </div>
        </div>

        <div className="card p-4">
          <span className="metric-label">Mất kết nối gần nhất</span>
          <div className="mt-1 font-semibold text-slate-900 tabular">
            {device.lastOfflineAt
              ? formatRelativeTimeVi(device.lastOfflineAt, nowTick)
              : 'Chưa từng'}
          </div>
          <div className="text-2xs text-slate-400">
            {formatVietnamDateTime(device.lastOfflineAt)}
          </div>
        </div>

        <div className="card p-4">
          <span className="metric-label">Firmware & Loại trạm</span>
          <div className="mt-1 font-mono text-sm font-semibold text-slate-900">
            {device.firmwareVersion || 'v1.0.0-esp32'}
          </div>
          <div className="text-2xs text-slate-400">
            {device.deviceType}
          </div>
        </div>

        <div className="card p-4">
          <span className="metric-label">Vị trí lắp đặt mặt bằng</span>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {device.posX !== null && device.posY !== null
              ? `X: ${device.posX} · Y: ${device.posY}`
              : 'Chưa chấm tọa độ'}
          </div>
          <div className="text-2xs text-slate-400 truncate">
            {device.location || 'Chưa ghi chú'}
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="card p-5">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="section-title">Cấu hình & Thuộc tính thiết bị</h2>
          <p className="text-xs text-slate-500">
            Cập nhật tên trạm, phân vùng phụ trách, phòng đọc và vị trí tương đối
          </p>
        </div>

        <form onSubmit={(e) => void handleSaveMetadata(e)} className="mt-4 space-y-4">
          {formError && <ErrorBanner message={formError} />}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="dev-name" className="label">
                Tên thiết bị *
              </label>
              <input
                id="dev-name"
                type="text"
                disabled={!capabilities.canManageDevices}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="input text-xs"
              />
            </div>

            <div>
              <label htmlFor="dev-zone" className="label">
                Mã phân vùng (Zone ID) *
              </label>
              <input
                id="dev-zone"
                type="text"
                disabled={!capabilities.canManageDevices}
                value={form.zoneId}
                onChange={(e) => setForm((p) => ({ ...p, zoneId: e.target.value }))}
                className="input font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="dev-room" className="label">
                Phòng đọc gắn kèm
              </label>
              <select
                id="dev-room"
                disabled={!capabilities.canManageDevices}
                value={form.roomId}
                onChange={(e) => setForm((p) => ({ ...p, roomId: e.target.value }))}
                className="select text-xs"
              >
                <option value="">-- Chưa gán phòng --</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    [{room.code}] {room.name} (Tầng {room.floor})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="dev-type" className="label">
                Loại thiết bị
              </label>
              <input
                id="dev-type"
                type="text"
                disabled={!capabilities.canManageDevices}
                value={form.deviceType}
                onChange={(e) => setForm((p) => ({ ...p, deviceType: e.target.value }))}
                className="input text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="dev-location" className="label">
                Vị trí lắp đặt
              </label>
              <input
                id="dev-location"
                type="text"
                disabled={!capabilities.canManageDevices}
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                className="input text-xs"
              />
            </div>

            <div>
              <label htmlFor="dev-posx" className="label">
                Tọa độ tương đối X [0.0 - 1.0]
              </label>
              <input
                id="dev-posx"
                type="number"
                step="0.01"
                min={0}
                max={1}
                disabled={!capabilities.canManageDevices}
                value={form.posX}
                onChange={(e) => setForm((p) => ({ ...p, posX: e.target.value }))}
                className="input text-xs tabular"
              />
            </div>

            <div>
              <label htmlFor="dev-posy" className="label">
                Tọa độ tương đối Y [0.0 - 1.0]
              </label>
              <input
                id="dev-posy"
                type="number"
                step="0.01"
                min={0}
                max={1}
                disabled={!capabilities.canManageDevices}
                value={form.posY}
                onChange={(e) => setForm((p) => ({ ...p, posY: e.target.value }))}
                className="input text-xs tabular"
              />
            </div>
          </div>

          {capabilities.canManageDevices && (
            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="btn-primary btn-sm"
              >
                {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Modal Cấp lại API Key */}
      <ModalDialog
        open={regenConfirmOpen}
        title="Xác nhận cấp lại khóa API Key"
        description="Thao tác này sẽ vô hiệu hóa khóa cũ ngay lập tức."
        onClose={() => setRegenConfirmOpen(false)}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <p>
              Khóa API Key hiện tại của trạm <strong className="font-mono">{device.hardwareId}</strong> sẽ bị vô hiệu hóa. Thiết bị ESP32 sẽ mất quyền gửi tin MQTT cho tới khi được nạp khóa mới.
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={regenAckChecked}
              onChange={(e) => setRegenAckChecked(e.target.checked)}
              className="checkbox"
            />
            <span>Tôi hiểu và đồng ý cấp lại khóa xác thực mới.</span>
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setRegenConfirmOpen(false)}
              className="btn-secondary btn-sm"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={!regenAckChecked || regenerateKeyMutation.isPending}
              onClick={() => void handleConfirmRegenerateKey()}
              className="btn-primary btn-sm bg-amber-600 hover:bg-amber-700"
            >
              {regenerateKeyMutation.isPending
                ? 'Đang sinh khóa...'
                : 'Cấp lại khóa mới'}
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* Modal Xóa thiết bị */}
      <ModalDialog
        open={deleteConfirmOpen}
        title="Xác nhận xóa thiết bị"
        description="Xóa vĩnh viễn thiết bị khỏi cơ sở dữ liệu."
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Bạn có chắc chắn muốn xóa thiết bị <strong className="text-slate-900">{device.name}</strong> ({device.hardwareId})? Mọi cấu hình liên quan sẽ bị xóa khỏi hệ thống.
          </p>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(false)}
              className="btn-secondary btn-sm"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => void handleConfirmDelete()}
              className="btn-danger btn-sm"
            >
              {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* Dialog hiển thị Key 1 lần */}
      <OneTimeKeyDialog
        open={keyDialog.open}
        deviceName={device.name}
        hardwareId={device.hardwareId}
        rawApiKey={keyDialog.rawApiKey}
        onClose={() => {
          regenerateKeyMutation.reset();
          setKeyDialog({ open: false, rawApiKey: null });
        }}
      />
    </div>
  );
}
