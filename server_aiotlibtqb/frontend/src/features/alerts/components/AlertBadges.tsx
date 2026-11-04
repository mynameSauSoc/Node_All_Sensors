'use client';

import React from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Volume2,
  Wind,
  WifiOff,
  Cpu,
} from 'lucide-react';
import type { AlertStatus, AlertType } from '@/types/api';

export interface BadgeStyleConfig {
  labelVi: string;
  shortCode: string;
  icon: React.ReactNode;
  dotClass: string;
  badgeClass: string;
}

export const ALERT_STATUS_META: Record<AlertStatus, BadgeStyleConfig> = {
  FIRING: {
    labelVi: 'Đang kích hoạt',
    shortCode: 'FIRING',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />,
    dotClass: 'bg-red-500 animate-pulse',
    badgeClass: 'badge-danger',
  },
  PENDING: {
    labelVi: 'Chờ xác nhận',
    shortCode: 'PENDING',
    icon: <Clock className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />,
    dotClass: 'bg-amber-500',
    badgeClass: 'badge-warning',
  },
  ACKNOWLEDGED: {
    labelVi: 'Đã tiếp nhận',
    shortCode: 'ACKNOWLEDGED',
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />,
    dotClass: 'bg-brand-500',
    badgeClass: 'badge-brand',
  },
  RESOLVED: {
    labelVi: 'Đã đóng',
    shortCode: 'RESOLVED',
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />,
    dotClass: 'bg-emerald-500',
    badgeClass: 'badge-success',
  },
};

export const ALERT_TYPE_META: Record<
  AlertType,
  BadgeStyleConfig & { unit?: string; decimals: number }
> = {
  NOISE_EXCEEDED: {
    labelVi: 'Vượt ngưỡng tiếng ồn',
    shortCode: 'NOISE_EXCEEDED',
    icon: <Volume2 className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />,
    dotClass: 'bg-rose-500',
    badgeClass: 'badge-danger',
    unit: 'dBA',
    decimals: 1,
  },
  AIR_UNHEALTHY: {
    labelVi: 'Chất lượng không khí kém',
    shortCode: 'AIR_UNHEALTHY',
    icon: <Wind className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />,
    dotClass: 'bg-amber-500',
    badgeClass: 'badge-warning',
    unit: 'µg/m³',
    decimals: 1,
  },
  DEVICE_OFFLINE: {
    labelVi: 'Trạm đo mất kết nối',
    shortCode: 'DEVICE_OFFLINE',
    icon: <WifiOff className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />,
    dotClass: 'bg-slate-400',
    badgeClass: 'badge-neutral',
    unit: 'giây',
    decimals: 0,
  },
  SENSOR_MALFUNCTION: {
    labelVi: 'Lỗi phần cứng cảm biến',
    shortCode: 'SENSOR_MALFUNCTION',
    icon: <Cpu className="h-3.5 w-3.5 text-purple-600" aria-hidden="true" />,
    dotClass: 'bg-purple-500',
    badgeClass: 'badge-neutral',
    unit: undefined,
    decimals: 1,
  },
};

/**
 * FE-A11Y-01: Combines color dot + symbolic icon + explicit Vietnamese label
 */
export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const meta = ALERT_STATUS_META[status] ?? {
    labelVi: status,
    shortCode: status,
    icon: <span className="dot bg-slate-400" aria-hidden="true" />,
    dotClass: 'bg-slate-400',
    badgeClass: 'badge-neutral',
  };

  return (
    <span className={`badge ${meta.badgeClass}`}>
      <span className={`dot ${meta.dotClass}`} aria-hidden="true" />
      <span>{meta.labelVi}</span>
    </span>
  );
}

/**
 * FE-A11Y-01: Combines color dot + symbolic icon + explicit Vietnamese label
 */
export function AlertTypeBadge({ type }: { type: AlertType }) {
  const meta = ALERT_TYPE_META[type] ?? {
    labelVi: type,
    shortCode: type,
    icon: <span className="dot bg-slate-400" aria-hidden="true" />,
    dotClass: 'bg-slate-400',
    badgeClass: 'badge-neutral',
  };

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
      {meta.icon}
      <span>{meta.labelVi}</span>
    </span>
  );
}
