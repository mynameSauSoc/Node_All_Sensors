'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Map, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  EmptyState,
  ErrorBanner,
  ModalDialog,
  PaginationBar,
  Skeleton,
  useToast,
} from '@/components/ui/primitives';
import { useAuthStore } from '@/features/auth/store';
import {
  useCreateRoomMutation,
  useDeleteRoomMutation,
  useRoomsQuery,
  useUpdateRoomMutation,
} from '@/features/rooms/queries';
import { ApiError } from '@/lib/http/error-mapper';
import { ERROR_MESSAGES_VI, UI_TEXT_VI } from '@/messages/vi';
import type { RoomResponse, RoomType } from '@/types/api';

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  STUDY_ROOM: 'Phòng tự học / đọc',
  BOOK_STORAGE: 'Kho lưu trữ sách',
  CIRCULATION_HALL: 'Sảnh mượn trả',
};

const FLOOR_OPTIONS = [0, 1, 2, 3, 4, 5];

interface RoomFormState {
  code: string;
  name: string;
  floor: number;
  capacity: string;
  targetComfortScore: string;
  type: RoomType;
  description: string;
}

const DEFAULT_FORM: RoomFormState = {
  code: '',
  name: '',
  floor: 1,
  capacity: '80',
  targetComfortScore: '80',
  type: 'STUDY_ROOM',
  description: '',
};

export default function AdminRoomsPage() {
  const capabilities = useAuthStore((s) => s.capabilities);
  const { pushToast } = useToast();

  const [page, setPage] = useState(0);
  const [selectedFloor, setSelectedFloor] = useState<number | undefined>(
    undefined
  );

  const roomsQuery = useRoomsQuery(
    {
      page,
      size: 10,
      floor: selectedFloor,
    },
    capabilities.canManageRooms
  );

  const createMutation = useCreateRoomMutation();
  const updateMutation = useUpdateRoomMutation();
  const deleteMutation = useDeleteRoomMutation();

  // Create / Edit Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomResponse | null>(null);
  const [form, setForm] = useState<RoomFormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirm Modal state (FE-SEC-06)
  const [deletingRoom, setDeletingRoom] = useState<RoomResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingRoom(null);
    setForm({
      ...DEFAULT_FORM,
      floor: selectedFloor ?? 1,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const openEditModal = (room: RoomResponse) => {
    setEditingRoom(room);
    setForm({
      code: room.code,
      name: room.name,
      floor: room.floor,
      capacity: room.capacity !== undefined ? String(room.capacity) : '',
      targetComfortScore:
        room.targetComfortScore !== undefined
          ? String(room.targetComfortScore)
          : '80',
      type: room.type ?? 'STUDY_ROOM',
      description: room.description ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedCode = form.code.trim().toUpperCase();
    const trimmedName = form.name.trim();

    if (!editingRoom && !trimmedCode) {
      setFormError(ERROR_MESSAGES_VI[5003]);
      return;
    }
    if (!trimmedName) {
      setFormError(ERROR_MESSAGES_VI[5004]);
      return;
    }
    if (!Number.isFinite(form.floor) || form.floor < 0) {
      setFormError(ERROR_MESSAGES_VI[5005]);
      return;
    }

    const parsedCapacity =
      form.capacity.trim() !== '' ? Number(form.capacity) : undefined;
    const parsedTarget =
      form.targetComfortScore.trim() !== ''
        ? Number(form.targetComfortScore)
        : undefined;

    try {
      if (editingRoom) {
        await updateMutation.mutateAsync({
          id: editingRoom.id,
          body: {
            name: trimmedName,
            floor: form.floor,
            capacity: parsedCapacity,
            targetComfortScore: parsedTarget,
            type: form.type,
            description: form.description.trim() || undefined,
          },
        });
        pushToast({
          title: 'Đã cập nhật phòng',
          message: `Phòng ${editingRoom.code} (${trimmedName}) đã được lưu.`,
          variant: 'success',
        });
      } else {
        await createMutation.mutateAsync({
          code: trimmedCode,
          name: trimmedName,
          floor: form.floor,
          capacity: parsedCapacity,
          targetComfortScore: parsedTarget,
          type: form.type,
          description: form.description.trim() || undefined,
        });
        pushToast({
          title: 'Đã thêm phòng mới',
          message: `Phòng ${trimmedCode} (${trimmedName}) đã được tạo.`,
          variant: 'success',
        });
      }
      setFormOpen(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : ERROR_MESSAGES_VI[9999];
      setFormError(msg);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingRoom) return;
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(deletingRoom.id);
      pushToast({
        title: 'Đã xóa phòng',
        message: `Phòng ${deletingRoom.code} đã được gỡ khỏi hệ thống.`,
        variant: 'info',
      });
      setDeletingRoom(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === 5006) {
        setDeleteError(ERROR_MESSAGES_VI[5006]);
      } else {
        const msg =
          err instanceof ApiError
            ? err.message
            : ERROR_MESSAGES_VI[9999];
        setDeleteError(msg);
      }
    }
  };

  const rooms = roomsQuery.data?.content ?? [];
  const totalPages = roomsQuery.data?.totalPages ?? 1;
  const totalElements = roomsQuery.data?.totalElements ?? 0;

  if (!capabilities.canManageRooms) {
    return (
      <div className="page">
        <ErrorBanner message={ERROR_MESSAGES_VI[1007]} />
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Phòng đọc</h1>
          <p className="page-subtitle">
            Danh mục phòng, sức chứa, điểm tiện nghi mục tiêu và đa giác mặt bằng.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/floorplan" className="btn-secondary">
            <Map className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Bản đồ nhiệt
          </Link>
          {capabilities.canManageRooms && (
            <button
              type="button"
              onClick={openCreateModal}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Thêm phòng
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="eyebrow">Tầng</span>
        <div className="segmented" role="group" aria-label="Lọc theo tầng">
          <button
            type="button"
            onClick={() => {
              setSelectedFloor(undefined);
              setPage(0);
            }}
            aria-pressed={selectedFloor === undefined}
            className={
              selectedFloor === undefined
                ? 'segmented-item-active'
                : 'segmented-item'
            }
          >
            Tất cả
          </button>
          {FLOOR_OPTIONS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setSelectedFloor(f);
                setPage(0);
              }}
              aria-pressed={selectedFloor === f}
              className={
                selectedFloor === f ? 'segmented-item-active' : 'segmented-item'
              }
            >
              Tầng {f}
            </button>
          ))}
        </div>
      </div>

      {/* 4-State Table View (FE-UI-01) */}
      {roomsQuery.isLoading ? (
        <div className="card card-body space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : roomsQuery.isError ? (
        <ErrorBanner
          message={
            roomsQuery.error instanceof ApiError
              ? roomsQuery.error.message
              : ERROR_MESSAGES_VI[9999]
          }
          onRetry={() => void roomsQuery.refetch()}
        />
      ) : rooms.length === 0 ? (
        <EmptyState
          title={UI_TEXT_VI.emptyRoomsFloor}
          description="Chưa có phòng nào trong phạm vi lọc hiện tại."
          actionLabel={
            capabilities.canManageRooms ? 'Thêm phòng đầu tiên' : undefined
          }
          onAction={capabilities.canManageRooms ? openCreateModal : undefined}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã phòng</th>
                  <th>Tên phòng</th>
                  <th>Tầng</th>
                  <th>Loại</th>
                  <th className="text-right">Sức chứa</th>
                  <th className="text-right">Điểm mục tiêu</th>
                  <th>Mặt bằng</th>
                  <th className="text-right">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => {
                  const vertexCount = room.boundaryPolygon?.length ?? 0;
                  const hasValidPolygon = vertexCount >= 3;

                  return (
                    <tr key={room.id}>
                      <td>
                        <Link
                          href={`/rooms/${room.id}`}
                          className="font-mono text-[13px] font-medium text-slate-900 hover:text-brand-600"
                        >
                          {room.code}
                        </Link>
                      </td>
                      <td>
                        <div className="font-medium text-slate-900">
                          {room.name}
                        </div>
                        {room.description && (
                          <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                            {room.description}
                          </div>
                        )}
                      </td>
                      <td className="tabular-nums">Tầng {room.floor}</td>
                      <td className="text-slate-600">
                        {room.type
                          ? ROOM_TYPE_LABELS[room.type] ?? room.type
                          : '—'}
                      </td>
                      <td className="text-right tabular-nums">
                        {room.capacity !== undefined ? (
                          <>
                            <span className="text-slate-900">{room.capacity}</span>
                            <span className="ml-1 text-xs text-slate-400">chỗ</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="text-right tabular-nums">
                        {room.targetComfortScore !== undefined ? (
                          <span className="font-medium text-slate-900">
                            {room.targetComfortScore}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-2">
                          {hasValidPolygon ? (
                            <span className="badge-success">
                              <span
                                className="dot bg-emerald-500"
                                aria-hidden="true"
                              />
                              {vertexCount} đỉnh
                            </span>
                          ) : (
                            <span className="badge-warning">
                              <span
                                className="dot bg-amber-500"
                                aria-hidden="true"
                              />
                              Chưa có đa giác
                            </span>
                          )}
                          {capabilities.canManageRooms && (
                            <Link
                              href={`/admin/rooms/${room.id}/polygon`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                            >
                              {hasValidPolygon ? 'Sửa' : 'Vẽ'}
                              <ArrowRight className="h-3 w-3" aria-hidden="true" />
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {capabilities.canManageRooms && (
                            <button
                              type="button"
                              onClick={() => openEditModal(room)}
                              className="btn-ghost btn-sm"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              Sửa
                            </button>
                          )}
                          {capabilities.canDeleteRoom && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError(null);
                                setDeletingRoom(room);
                              }}
                              className="btn-danger-ghost btn-sm"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalElements={totalElements}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Modal Thêm / Sửa Phòng */}
      <ModalDialog
        open={formOpen}
        title={editingRoom ? `Cập nhật phòng ${editingRoom.code}` : 'Thêm phòng'}
        description="Thông tin không gian, tầng, sức chứa và điểm tiện nghi mục tiêu."
        onClose={() => setFormOpen(false)}
      >
        <form onSubmit={(e) => void handleFormSubmit(e)} className="space-y-4">
          {formError && <ErrorBanner message={formError} />}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="room-code" className="label">
                Mã phòng <span className="text-red-500">*</span>
              </label>
              <input
                id="room-code"
                type="text"
                required
                disabled={Boolean(editingRoom)}
                value={form.code}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, code: e.target.value }))
                }
                placeholder="VD: R-301"
                className="input font-mono"
              />
            </div>

            <div>
              <label htmlFor="room-floor" className="label">
                Tầng <span className="text-red-500">*</span>
              </label>
              <input
                id="room-floor"
                type="number"
                min={1}
                max={20}
                required
                value={form.floor}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    floor: Number(e.target.value),
                  }))
                }
                className="input tabular-nums"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="room-name" className="label">
                Tên phòng <span className="text-red-500">*</span>
              </label>
              <input
                id="room-name"
                type="text"
                required
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="VD: Phòng tự học tầng 3 - cánh Đông"
                className="input"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="room-type" className="label">
                Loại không gian
              </label>
              <select
                id="room-type"
                value={form.type}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    type: e.target.value as RoomType,
                  }))
                }
                className="select"
              >
                <option value="STUDY_ROOM">{ROOM_TYPE_LABELS.STUDY_ROOM}</option>
                <option value="BOOK_STORAGE">
                  {ROOM_TYPE_LABELS.BOOK_STORAGE}
                </option>
                <option value="CIRCULATION_HALL">
                  {ROOM_TYPE_LABELS.CIRCULATION_HALL}
                </option>
              </select>
            </div>

            <div>
              <label htmlFor="room-capacity" className="label">
                Sức chứa (chỗ ngồi)
              </label>
              <input
                id="room-capacity"
                type="number"
                min={0}
                value={form.capacity}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, capacity: e.target.value }))
                }
                className="input tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="room-target-score" className="label">
                Điểm tiện nghi mục tiêu
              </label>
              <input
                id="room-target-score"
                type="number"
                min={0}
                max={100}
                value={form.targetComfortScore}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    targetComfortScore: e.target.value,
                  }))
                }
                className="input tabular-nums"
              />
              <p className="hint">Thang điểm 0–100.</p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="room-description" className="label">
                Mô tả
              </label>
              <textarea
                id="room-description"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Ghi chú về vị trí hoặc quy định yên tĩnh…"
                className="textarea"
              />
            </div>
          </div>

          <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="btn-secondary"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="btn-primary"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Đang lưu…'
                : editingRoom
                ? 'Lưu thay đổi'
                : 'Tạo phòng'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal xác nhận xóa phòng (FE-SEC-06 & 5006 ROOM_HAS_DEVICES guard) */}
      <ModalDialog
        open={Boolean(deletingRoom)}
        title="Xóa phòng"
        description={
          deletingRoom
            ? `Bạn có chắc muốn xóa phòng ${deletingRoom.code} (${deletingRoom.name})?`
            : undefined
        }
        onClose={() => {
          setDeletingRoom(null);
          setDeleteError(null);
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Thao tác này không thể hoàn tác. Chỉ xóa được phòng khi không còn thiết bị cảm biến nào được gắn.
          </p>

          {deleteError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-800"
            >
              <p className="font-medium">{deleteError}</p>
              <p className="mt-1 text-xs text-red-700">
                Mở{' '}
                <Link
                  href={`/admin/devices?roomId=${deletingRoom?.id ?? ''}`}
                  className="font-medium underline underline-offset-2"
                >
                  danh sách thiết bị của phòng
                </Link>{' '}
                để chuyển hoặc gỡ thiết bị trước khi xóa.
              </p>
            </div>
          )}

          <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            <button
              type="button"
              onClick={() => {
                setDeletingRoom(null);
                setDeleteError(null);
              }}
              className="btn-secondary"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => void handleConfirmDelete()}
              className="btn-danger"
            >
              {deleteMutation.isPending ? 'Đang xóa…' : 'Xóa vĩnh viễn'}
            </button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
