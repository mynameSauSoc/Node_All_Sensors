import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

/**
 * Design tokens — xem docs/implementation/UI_STYLE_GUIDE.md.
 * - brand: màu nhấn indigo, CHỈ dùng cho hành động/điều hướng (không dùng cho trạng thái môi trường).
 * - Thang bo góc được nén lại để các lớp rounded-xl/2xl/3xl cũ không còn "phồng".
 * - shadow-xs / shadow-2xs / rounded-xs / backdrop-blur-xs: bổ sung vì đây là lớp của
 *   Tailwind v4 nhưng dự án dùng v3.4 (trước đây bị bỏ qua âm thầm).
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/config/**/*.{js,ts}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-mono)', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
          950: '#1E1B4B',
        },
        canvas: {
          DEFAULT: '#FAFAF9',
          subtle: '#F1F5F9',
        },
        subtle: '#E2E8F0',
        strong: '#CBD5E1',
      },
      borderRadius: {
        xs: '2px',
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '10px',
        '2xl': '12px',
        '3xl': '14px',
      },
      boxShadow: {
        '2xs': '0 1px 0 0 rgb(15 23 42 / 0.03)',
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
        sm: '0 1px 2px 0 rgb(15 23 42 / 0.06), 0 1px 3px 0 rgb(15 23 42 / 0.04)',
        md: '0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.05)',
        lg: '0 12px 24px -6px rgb(15 23 42 / 0.12), 0 4px 8px -4px rgb(15 23 42 / 0.06)',
        xl: '0 20px 40px -12px rgb(15 23 42 / 0.18)',
        '2xl': '0 28px 56px -16px rgb(15 23 42 / 0.25)',
      },
      backdropBlur: {
        xs: '2px',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
    },
  },
  plugins: [],
};

export default config;
