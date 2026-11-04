'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, RotateCw, Wifi } from 'lucide-react';
import {
  EmptyState,
  ErrorBanner,
  ModalDialog,
  Skeleton,
  useToast,
} from '@/components/ui/primitives';
import { useAuthStore } from '@/features/auth/store';
import { OneTimeKeyDialog } from '@/features/devices/components/OneTimeKeyDialog';
import {
  useDiscoveredDevicesQuery,
  useRegisterDeviceMutation,
} from '@/features/devices/queries';
import { useRoomsQuery } from '@/features/rooms/queries';
import {
  formatRelativeTimeVi,
  formatVietnamDateTime,
} from '@/lib/format/datetime';
import { ApiError } from '@/lib/http/error-mapper';
import { ERROR_MESSAGES_VI, UI_TEXT_VI } from '@/messages/vi';
import type { DiscoveredDeviceResponse } from '@/types/api';

interface ClaimFormState {
  hardwareId: string;
  name: string;
  zoneId: string;
  roomId: string;
  deviceType: string;
  location: string;
  posX: string;
  posY: string;
}

export default function DeviceDiscoveryPage() {
  const capabilities = useAuthStore((s) => s.capabilities);
  const { pushToast } = useToast();

  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const discoveryQuery = useDiscoveredDevicesQuery(
    capabilities.canManageDevices
  );
  const roomsQuery = useRoomsQuery({ page: 0, size: 100 });
  const registerMutation = useRegisterDeviceMutation();

  const rooms = roomsQuery.data?.content ?? [];
  const discoveredList = discoveryQuery.data ?? [];

  const [claimingDevice, setClaimingDevice] =
    useState<DiscoveredDeviceResponse | null>(null);
  const [claimForm, setClaimForm] = useState<ClaimFormState>({
    hardwareId: '',
    name: '',
    zoneId: 'ZONE_FLOOR_1',
    roomId: '',
    deviceType: 'ESP32_MULTI_SENSOR',
    location: '',
    posX: '0.5',
    posY: '0.5',
  });
  const [claimError, setClaimError] = useState<string | null>(null);

  const [keyDialog, setKeyDialog] = useState<{
    open: boolean;
    deviceName: string;
    hardwareId: string;
    rawApiKey: string | null;
    alreadyExisted: boolean;
  }>({
    open: false,
    deviceName: '',
    hardwareId: '',
    rawApiKey: null,
    alreadyExisted: false,
  });

  const openClaimModal = (item: DiscoveredDeviceResponse) => {
    setClaimingDevice(item);
    setClaimForm({
      hardwareId: item.hardwareId,
      name: `Trạm đo ${item.hardwareId}`,
      zoneId: 'ZONE_FLOOR_1',
      roomId: rooms[0]?.id ?? '',
      deviceType: 'ESP32_MULTI_SENSOR',
      location: '',
      posX: '0.5',
      posY: '0.5',
    });
    setClaimError(null);
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError(null);

    const trimmedName = claimForm.name.trim();
    const trimmedZone = claimForm.zoneId.trim();
    const trimmedType = claimForm.deviceType.trim();

    if (!trimmedName) {
      setClaimError(ERROR_MESSAGES_VI[3004]);
      return;
    }
    if (!trimmedZone) {
      setClaimError(ERROR_MESSAGES_VI[3006]);
      return;
    }

    const posX = parseFloat(claimForm.posX);
    const posY = parseFloat(claimForm.posY);

    try {
      const res = await registerMutation.mutateAsync({
        hardwareId: claimForm.hardwareId,
        name: trimmedName,
        zoneId: trimmedZone,
        roomId: claimForm.roomId || undefined,
        deviceType: trimmedType || 'ESP32_MULTI_SENSOR',
        location: claimForm.location.trim() || undefined,
        posX: Number.isNaN(posX) ? 0.5 : posX,
        posY: Number.isNaN(posY) ? 0.5 : posY,
      });

      setClaimingDevice(null);
      void discoveryQuery.refetch();

      setKeyDialog({
        open: true,
        deviceName: res.name,
        hardwareId: res.hardwareId,
        rawApiKey: res.rawApiKey,
        alreadyExisted: res.alreadyExisted,
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Không thể cấp phát thiết bị.';
      setClaimError(msg);
    }
  };

  const renderRssiBadge = (rssi?: number | null) => {
    if (rssi === undefined || rssi === null) {
      return <span className="text-slate-400">--</span>;
    }
    const colorClass =
      rssi >= -65
        ? 'badge-success'
        : rssi >= -75
        ? 'badge-brand'
        : rssi >= -85
        ? 'badge-warning'
        : 'badge-danger';

    return (
      <span className={colorClass}>
        <Wifi className="h-3 w-3" aria-hidden="true" />
        <span className="tabular">{rssi} dBm</span>
      </span>
    );
  };

  if (!capabilities.canManageDevices) {
    return (
      <div className="page">
        <ErrorBanner message="Bạn không có quyền thực hiện cấp phát thiết bị (MANAGE_DEVICES)." />
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
          <span className="font-medium text-slate-900">Phát hiện thiết bị mới</span>
        </div>

        <div className="page-header pt-1">
          <div>
            <h1 className="page-title">
              Tự động Phát hiện & Cấp phát ESP32
            </h1>
            <p className="page-subtitle">
              Danh sách trạm đo mới cắm điện đang phát tin MQTT nhưng chưa đăng ký vào hệ thống
            </p>
          </div>

          <button
            type="button"
            onClick={() => void discoveryQuery.refetch()}
            className="btn-secondary btn-sm"
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Quét lại hàng đợi</span>
          </button>
        </div>
      </div>

      {/* 4-State View */}
      <div className="card">
        {discoveryQuery.isLoading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : discoveryQuery.isError ? (
          <div className="p-5">
            <ErrorBanner
              message={
                discoveryQuery.error instanceof ApiError
                  ? discoveryQuery.error.message
                  : ERROR_MESSAGES_VI[9999]
              }
              onRetry={() => void discoveryQuery.refetch()}
            />
          </div>
        ) : discoveredList.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Hàng đợi phát hiện đang trống"
              description={UI_TEXT_VI.emptyDiscoveryQueue}
              actionLabel="Quét lại ngay"
              onAction={() => void discoveryQuery.refetch()}
            />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã phần cứng (Hardware ID)</th>
                  <th>Phát hiện lần đầu</th>
                  <th>Bản tin gần nhất</th>
                  <th>Số gói tin</th>
                  <th>Sóng Wi-Fi (RSSI)</th>
                  <th className="text-right">Cấp phát</th>
                </tr>
              </thead>
              <tbody>
                {discoveredList.map((item) => (
                  <tr key={item.hardwareId}>
                    <td className="font-mono font-semibold text-slate-900">
                      {item.hardwareId}
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-500 tabular">
                      {formatVietnamDateTime(item.firstSeenAt)}
                    </td>
                    <td className="whitespace-nowrap text-xs tabular">
                      <div className="font-medium text-slate-800">
                        {formatRelativeTimeVi(item.lastSeenAt, nowTick)}
                      </div>
                      <div className="text-2xs text-slate-400">
                        {formatVietnamDateTime(item.lastSeenAt)}
                      </div>
                    </td>
                    <td className="font-mono text-xs tabular text-slate-700">
                      {item.messageCount} bản tin
                    </td>
                    <td>
                      {renderRssiBadge(item.lastWifiRssi)}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openClaimModal(item)}
                        className="btn-primary btn-sm"
                      >
                        Cấp phát thiết bị
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Claim */}
      <ModalDialog
        open={Boolean(claimingDevice)}
        title={`Cấp phát Thiết bị: ${claimingDevice?.hardwareId ?? ''}`}
        description="Gán tên trạm, phân vùng, phòng đọc và vị trí lắp đặt trên mặt bằng."
        onClose={() => setClaimingDevice(null)}
      >
        <form onSubmit={(e) => void handleClaimSubmit(e)} className="space-y-3.5">
          {claimError && <ErrorBanner message={claimError} />}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="claim-hw" className="label">
                Mã phần cứng (Hardware ID)
              </label>
              <input
                id="claim-hw"
                type="text"
                disabled
                value={claimForm.hardwareId}
                className="input font-mono text-xs opacity-75"
              />
            </div>

            <div>
              <label htmlFor="claim-name" className="label">
                Tên thiết bị *
              </label>
              <input
                id="claim-name"
                type="text"
                required
                value={claimForm.name}
                onChange={(e) =>
                  setClaimForm((p) => ({ ...p, name: e.target.value }))
                }
                className="input text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="claim-zone" className="label">
                Mã phân vùng (Zone ID) *
              </label>
              <input
                id="claim-zone"
                type="text"
                required
                value={claimForm.zoneId}
                onChange={(e) =>
                  setClaimForm((p) => ({ ...p, zoneId: e.target.value }))
                }
                className="input font-mono text-xs"
              />
            </div>

            <div>
              <label htmlFor="claim-room" className="label">
                Phòng đọc gắn kèm
              </label>
              <select
                id="claim-room"
                value={claimForm.roomId}
                onChange={(e) =>
                  setClaimForm((p) => ({ ...p, roomId: e.target.value }))
                }
                className="select text-xs"
              >
                <option value="">-- Chọn phòng đọc --</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    [{room.code}] {room.name} (Tầng {room.floor})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="claim-type" className="label">
                Loại thiết bị *
              </label>
              <input
                id="claim-type"
                type="text"
                required
                value={claimForm.deviceType}
                onChange={(e) =>
                  setClaimForm((p) => ({ ...p, deviceType: e.target.value }))
                }
                className="input text-xs"
              />
            </div>

            <div>
              <label htmlFor="claim-loc" className="label">
                Vị trí lắp đặt
              </label>
              <input
                id="claim-loc"
                type="text"
                value={claimForm.location}
                onChange={(e) =>
                  setClaimForm((p) => ({ ...p, location: e.target.value }))
                }
                placeholder="VD: Cửa sổ Đông tầng 3"
                className="input text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="claim-x" className="label">
                Tọa độ tương đối X [0.0 - 1.0]
              </label>
              <input
                id="claim-x"
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={claimForm.posX}
                onChange={(e) =>
                  setClaimForm((p) => ({ ...p, posX: e.target.value }))
                }
                className="input text-xs tabular"
              />
            </div>

            <div>
              <label htmlFor="claim-y" className="label">
                Tọa độ tương đối Y [0.0 - 1.0]
              </label>
              <input
                id="claim-y"
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={claimForm.posY}
                onChange={(e) =>
                  setClaimForm((p) => ({ ...p, posY: e.target.value }))
                }
                className="input text-xs tabular"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setClaimingDevice(null)}
              className="btn-secondary btn-sm"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="btn-primary btn-sm"
            >
              {registerMutation.isPending
                ? 'Đang cấp phát...'
                : 'Xác nhận cấp phát'}
            </button>
          </div>
        </form>
      </ModalDialog>

      <OneTimeKeyDialog
        open={keyDialog.open}
        deviceName={keyDialog.deviceName}
        hardwareId={keyDialog.hardwareId}
        rawApiKey={keyDialog.rawApiKey}
        alreadyExisted={keyDialog.alreadyExisted}
        onClose={() =>
          setKeyDialog({
            open: false,
            deviceName: '',
            hardwareId: '',
            rawApiKey: null,
            alreadyExisted: false,
          })
        }
      />
    </div>
  );
}
