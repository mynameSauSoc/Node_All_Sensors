'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, UserPlus, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { useLoginMutation, useRegisterMutation } from '@/features/auth/queries';
import { useAuthStore } from '@/features/auth/store';
import { ApiError } from '@/lib/http/error-mapper';
import { ERROR_MESSAGES_VI, UI_TEXT_VI } from '@/messages/vi';

export default function LoginPage() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [kioskMode, setKioskMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  const handleLoginSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (cooldownSeconds > 0 || loginMutation.isPending) return;

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setErrorMessage(ERROR_MESSAGES_VI[1009]);
      return;
    }
    if (!password) {
      setErrorMessage(ERROR_MESSAGES_VI[1010]);
      return;
    }

    setErrorMessage(null);
    loginMutation.mutate(
      { username: trimmedUsername, password },
      {
        onSuccess: (res) => {
          setTokens(res.token, res.refreshToken, kioskMode);
          router.push(kioskMode ? '/kiosk' : '/dashboard');
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            setErrorMessage(err.message);
            if (err.code === 4029 || err.httpStatus === 429) {
              setCooldownSeconds(err.retryAfterSeconds ?? 60);
            }
          } else {
            setErrorMessage(ERROR_MESSAGES_VI[9999]);
          }
        },
      }
    );
  };

  const handleRegisterSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);

    const trimmedUsername = regUsername.trim();
    if (!trimmedUsername) {
      setRegError(ERROR_MESSAGES_VI[1009]);
      return;
    }
    if (trimmedUsername.length < 6) {
      setRegError(ERROR_MESSAGES_VI[1002]);
      return;
    }
    if (!regPassword) {
      setRegError(ERROR_MESSAGES_VI[1010]);
      return;
    }
    if (regPassword.length < 8) {
      setRegError(ERROR_MESSAGES_VI[1003]);
      return;
    }

    registerMutation.mutate(
      {
        username: trimmedUsername,
        password: regPassword,
        email: regEmail.trim() || undefined,
        phone: regPhone.trim() || undefined,
      },
      {
        onSuccess: () => {
          setRegSuccess('Đăng ký tài khoản thành công! Đang tự động đăng nhập...');
          // Auto-login after successful registration
          loginMutation.mutate(
            { username: trimmedUsername, password: regPassword },
            {
              onSuccess: (res) => {
                setTokens(res.token, res.refreshToken, false);
                router.push('/dashboard');
              },
              onError: () => {
                // If auto-login fails, switch back to login tab with username prefilled
                setUsername(trimmedUsername);
                setActiveTab('login');
              },
            }
          );
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            setRegError(err.message);
          } else {
            setRegError(ERROR_MESSAGES_VI[9999]);
          }
        },
      }
    );
  };

  const isLocked = cooldownSeconds > 0 || loginMutation.isPending;

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12 text-slate-900">
      <div className="w-full max-w-sm card p-6 shadow-md">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white shadow-xs">
            TQB
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            {UI_TEXT_VI.appName}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Hệ thống giám sát vi khí hậu Thư viện Tạ Quang Bửu
          </p>
        </div>

        {/* Tab Switcher: Đăng nhập | Đăng ký */}
        <div className="segmented mb-5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setErrorMessage(null);
            }}
            className={`segmented-item flex-1 justify-center ${
              activeTab === 'login' ? 'segmented-item-active' : ''
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Đăng nhập</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setRegError(null);
            }}
            className={`segmented-item flex-1 justify-center ${
              activeTab === 'register' ? 'segmented-item-active' : ''
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Đăng ký</span>
          </button>
        </div>

        {activeTab === 'login' ? (
          <div>
            {errorMessage && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <p>{errorMessage}</p>
                  {cooldownSeconds > 0 && (
                    <p className="mt-1 font-mono font-medium text-red-700">
                      Tạm khóa gửi yêu cầu: vui lòng đợi {cooldownSeconds}s.
                    </p>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-3.5" noValidate>
              <div>
                <label htmlFor="login-username" className="label">
                  Tên tài khoản
                </label>
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLocked}
                  placeholder="VD: admin hoặc user_01"
                  className="input text-xs"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="label">
                  Mật khẩu
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLocked}
                  placeholder="••••••••"
                  className="input text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <input
                  id="login-kiosk-mode"
                  type="checkbox"
                  checked={kioskMode}
                  onChange={(e) => setKioskMode(e.target.checked)}
                  disabled={isLocked}
                  className="checkbox"
                />
                <label
                  htmlFor="login-kiosk-mode"
                  className="cursor-pointer text-xs text-slate-600 select-none"
                >
                  Chế độ Kiosk TV (sảnh thư viện)
                </label>
              </div>

              <button
                type="submit"
                disabled={isLocked}
                className="btn-primary mt-2 w-full justify-center"
              >
                <LogIn className="h-4 w-4" />
                <span>
                  {cooldownSeconds > 0
                    ? `Thử lại sau (${cooldownSeconds}s)`
                    : loginMutation.isPending
                    ? 'Đang xác thực...'
                    : 'Đăng nhập'}
                </span>
              </button>
            </form>

            {/* Helper Info Box */}
            <div className="mt-5 rounded-md border border-slate-200 bg-slate-50/80 p-3 text-2xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
              <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                <Info className="h-3.5 w-3.5 text-brand-600" />
                <span>Thông tin tài khoản hệ thống</span>
              </div>
              <ul className="mt-1.5 space-y-1 list-disc list-inside">
                <li>
                  Tài khoản Quản trị viên khởi tạo: <code className="font-mono font-semibold text-slate-900 dark:text-slate-100">admin</code>
                </li>
                <li>
                  Chưa có tài khoản? Nhấn tab <strong className="text-brand-600 font-medium">Đăng ký</strong> phía trên để tạo tài khoản mới tức thì.
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div>
            {regError && (
              <div
                role="alert"
                className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{regError}</span>
              </div>
            )}

            {regSuccess && (
              <div
                role="status"
                className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{regSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5" noValidate>
              <div>
                <label htmlFor="reg-username" className="label">
                  Tên tài khoản (tối thiểu 6 ký tự) *
                </label>
                <input
                  id="reg-username"
                  type="text"
                  autoComplete="username"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  disabled={registerMutation.isPending || loginMutation.isPending}
                  placeholder="VD: reader_thuvien"
                  className="input text-xs"
                />
              </div>

              <div>
                <label htmlFor="reg-password" className="label">
                  Mật khẩu (tối thiểu 8 ký tự) *
                </label>
                <input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  disabled={registerMutation.isPending || loginMutation.isPending}
                  placeholder="••••••••"
                  className="input text-xs"
                />
              </div>

              <div>
                <label htmlFor="reg-email" className="label">
                  Địa chỉ Email (tùy chọn)
                </label>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  disabled={registerMutation.isPending || loginMutation.isPending}
                  placeholder="user@library.edu.vn"
                  className="input text-xs"
                />
              </div>

              <div>
                <label htmlFor="reg-phone" className="label">
                  Số điện thoại (tùy chọn)
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  autoComplete="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  disabled={registerMutation.isPending || loginMutation.isPending}
                  placeholder="0912345678"
                  className="input text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={registerMutation.isPending || loginMutation.isPending}
                className="btn-primary mt-2 w-full justify-center"
              >
                <UserPlus className="h-4 w-4" />
                <span>
                  {registerMutation.isPending || loginMutation.isPending
                    ? 'Đang tạo tài khoản & đăng nhập...'
                    : 'Tạo tài khoản & Đăng nhập'}
                </span>
              </button>
            </form>

            <p className="mt-4 text-center text-2xs text-slate-500">
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className="font-medium text-brand-600 hover:underline"
              >
                Đăng nhập tại đây
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
