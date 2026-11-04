import type { ComfortGrade } from '@/types/api';

export interface GradeStyle {
  grade: ComfortGrade | 'N/A';
  labelVi: string;
  hex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  minScore: number;
}

export const GRADE_STYLES: Record<ComfortGrade | 'N/A', GradeStyle> = {
  Platinum: {
    grade: 'Platinum',
    labelVi: 'Tối ưu (Platinum)',
    hex: '#10B981',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    borderClass: 'border-emerald-500/40',
    minScore: 90,
  },
  Gold: {
    grade: 'Gold',
    labelVi: 'Tốt (Gold)',
    hex: '#22C55E',
    bgClass: 'bg-green-500/15',
    textClass: 'text-green-600 dark:text-green-400',
    borderClass: 'border-green-500/40',
    minScore: 75,
  },
  Silver: {
    grade: 'Silver',
    labelVi: 'Chú ý (Silver)',
    hex: '#F59E0B',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-500/40',
    minScore: 60,
  },
  Bronze: {
    grade: 'Bronze',
    labelVi: 'Kém (Bronze)',
    hex: '#F97316',
    bgClass: 'bg-orange-500/15',
    textClass: 'text-orange-600 dark:text-orange-400',
    borderClass: 'border-orange-500/40',
    minScore: 45,
  },
  Poor: {
    grade: 'Poor',
    labelVi: 'Cảnh báo (Poor)',
    hex: '#EF4444',
    bgClass: 'bg-red-500/15',
    textClass: 'text-red-600 dark:text-red-400',
    borderClass: 'border-red-500/40',
    minScore: 0,
  },
  'N/A': {
    grade: 'N/A',
    labelVi: 'Chưa có dữ liệu',
    hex: '#64748B',
    bgClass: 'bg-slate-500/15',
    textClass: 'text-slate-600 dark:text-slate-400',
    borderClass: 'border-slate-500/40',
    minScore: -1,
  },
};

export function resolveGradeFromScore(
  score: number | null | undefined
): ComfortGrade | 'N/A' {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return 'N/A';
  }
  if (score >= 90) return 'Platinum';
  if (score >= 75) return 'Gold';
  if (score >= 60) return 'Silver';
  if (score >= 45) return 'Bronze';
  return 'Poor';
}

export function getGradeStyle(
  grade?: ComfortGrade | 'N/A' | string | null,
  fallbackScore?: number | null
): GradeStyle {
  if (grade && grade in GRADE_STYLES) {
    return GRADE_STYLES[grade as ComfortGrade | 'N/A'];
  }
  return GRADE_STYLES[resolveGradeFromScore(fallbackScore)];
}

export type HeatmapLayerMetric =
  | 'comfortScore'
  | 'noiseAvg'
  | 'pm2_5'
  | 'temperature'
  | 'humidity'
  | 'lux'
  | 'wifiRssi';

export function getMetricColorHex(
  metric: HeatmapLayerMetric,
  value: number | null | undefined
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return GRADE_STYLES['N/A'].hex;
  }

  switch (metric) {
    case 'comfortScore':
      return GRADE_STYLES[resolveGradeFromScore(value)].hex;
    case 'noiseAvg':
      if (value < 45) return '#10B981';
      if (value <= 55) return '#22C55E';
      if (value <= 65) return '#F59E0B';
      if (value <= 70) return '#F97316';
      return '#EF4444';
    case 'pm2_5':
      if (value < 12) return '#10B981';
      if (value <= 35) return '#22C55E';
      if (value <= 55) return '#F59E0B';
      if (value <= 75) return '#F97316';
      return '#EF4444';
    case 'temperature':
      if (value >= 22 && value <= 25) return '#10B981';
      if (value >= 20 && value <= 26.5) return '#22C55E';
      if (value >= 18 && value <= 28.5) return '#F59E0B';
      return '#EF4444';
    case 'humidity':
      if (value >= 48 && value <= 58) return '#10B981';
      if (value >= 42 && value <= 60) return '#22C55E';
      if (value >= 35 && value <= 68) return '#F59E0B';
      if (value <= 75) return '#F97316';
      return '#EF4444';
    case 'lux':
      if (value >= 320 && value <= 520) return '#10B981';
      if (value >= 250 && value <= 600) return '#22C55E';
      if (value >= 160 && value <= 750) return '#F59E0B';
      return '#EF4444';
    case 'wifiRssi':
      if (value >= -58) return '#10B981';
      if (value >= -67) return '#22C55E';
      if (value >= -75) return '#F59E0B';
      if (value >= -82) return '#F97316';
      return '#EF4444';
  }
}
