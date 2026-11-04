'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Shield,
  Key,
  Mail,
  Phone,
  LogOut,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Hash,
  Lock,
} from 'lucide-react';
import { useMyInfoQuery, useLogoutMutation } from '@/features/auth/queries';
import { useAuthStore } from '@/features/auth/store';
import {
  useChangePasswordMutation,
  useUpdateUserMutation,
} from '@/features/iam/queries';
import { ApiError } from '@/lib/http/error-mapper';
import { ERROR_MESSAGES_VI } from '@/messages/vi';
import { ErrorBanner, Skeleton, useToast } from '@/components/ui/primitives';

export default function ProfilePage() {
  const router = useRouter();
  const { pushToast } = useToast();

  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const storeUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearSession = useAuthStore((s) => s.clearSession);

  const myInfoQuery = useMyInfoQuery(true);
  const updateUserMutation = useUpdateUserMutation();
  const changePasswordMutation = useChangePasswordMutation();
  const logoutMutation = useLogoutMutation();

  const profile = myInfoQuery.data ?? storeUser;

  // Contact update state
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [contactError, setContactError] = useState<string | null>(null);

  // Dedicated Password Change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setPhone(profile.phone ?? '');
      setEmail(profile.email ?? '');
    }
  }, [profile]);

  const handleUpdateContact = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;

    setContactError(null);
    updateUserMutation.mutate(
      {
        id: profile.id,
        body: {
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        },
      },
      {
        onSuccess: (updated) => {
          setUser(updated);
          void myInfoQuery.refetch();
          pushToast({
            title: 'Đã cập nhật thông tin',
            message: 'Thông tin liên hệ của bạn đã được lưu thành công.',
            variant: 'success',
          });
        },
        onError: (err) => {
          const msg =
            err instanceof ApiError ? err.message : ERROR_MESSAGES_VI[9999];
          setContactError(msg);
        },
      }
    );
  };

  const handleChangePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordError(null);

    if (!oldPassword) {
      setPasswordError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (!newPassword) {
      setPasswordError(ERROR_MESSAGES_VI[1010]);
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(ERROR_MESSAGES_VI[1003]);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Xác nhận mật khẩu mới không khớp.');
      return;
    }
    if (oldPassword === newPassword) {
      setPasswordError(ERROR_MESSAGES_VI[1012]);
      return;
    }

    changePasswordMutation.mutate(
      {
        oldPassword,
        newPassword,
      },
      {
        onSuccess: () => {
          pushToast({
            title: 'Đổi mật khẩu thành công',
            message: 'Vui lòng đăng nhập lại bằng mật khẩu mới của bạn.',
            variant: 'success',
          });

          // Invalidate tokens and redirect to login
          logoutMutation.mutate(
            {
              token: accessToken ?? undefined,
              refreshToken: refreshToken ?? undefined,
            },
            {
              onSettled: () => {
                clearSession();
                router.replace('/login');
              },
            }
          );
        },
        onError: (err) => {
          const msg =
            err instanceof ApiError ? err.message : ERROR_MESSAGES_VI[9999];
          setPasswordError(msg);
        },
      }
    );
  };

  const handleSafeLogout = () => {
    logoutMutation.mutate(
      {
        token: accessToken ?? undefined,
        refreshToken: refreshToken ?? undefined,
      },
      {
        onSettled: () => {
          clearSession();
          router.replace('/login');
        },
      }
    );
  };

  if (myInfoQuery.isLoading && !profile) {
    return (
      <div className="page max-w-4xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (myInfoQuery.isError && !profile) {
    const errMsg =
      myInfoQuery.error instanceof ApiError
        ? myInfoQuery.error.message
        : ERROR_MESSAGES_VI[9999];
    return (
      <div className="page max-w-4xl">
        <ErrorBanner
          message={errMsg}
          onRetry={() => void myInfoQuery.refetch()}
        />
      </div>
    );
  }

  if (!profile) return null;

  const uniquePermissions = Array.from(
    new Set(
      (profile.roles ?? []).flatMap((r) =>
        (r.permissions ?? []).map((p) => p.name)
      )
    )
  );

  return (
    <div className="page max-w-4xl space-y-6">
      {/* Page Header */}
      <div className="page-header flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>M15</span>
            <span>·</span>
            <span>Quản trị tài khoản &amp; Phiên làm việc</span>
          </div>
          <h1 className="page-title mt-1 flex items-center gap-2">
            <User className="h-5 w-5 text-brand-600" />
            <span>Hồ sơ cá nhân</span>
            <span className="text-base font-normal text-slate-400">
              ({profile.username})
            </span>
          </h1>
        </div>

        <button
          type="button"
          onClick={handleSafeLogout}
          disabled={logoutMutation.isPending}
          className="btn-secondary text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <LogOut className="h-4 w-4" />
          <span>
            {logoutMutation.isPending ? 'Đang thu hồi phiên...' : 'Đăng xuất an toàn'}
          </span>
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Info Column */}
        <section className="card p-5 md:p-6">
          <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
            <Shield className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Thông tin định danh &amp; Phân quyền
            </h2>
          </div>

          <dl className="mt-4 space-y-3.5 text-xs">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
              <dt className="flex items-center gap-1.5 text-slate-500">
                <Hash className="h-3.5 w-3.5 text-slate-400" />
                Mã định danh (ID)
              </dt>
              <dd className="font-mono text-2xs text-slate-600 dark:text-slate-400">
                {profile.id}
              </dd>
            </div>

            <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
              <dt className="text-slate-500">Tên đăng nhập</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                {profile.username}
              </dd>
            </div>

            <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
              <dt className="text-slate-500">Trạng thái tài khoản</dt>
              <dd>
                <span
                  className={
                    profile.active ? 'badge-success' : 'badge-danger'
                  }
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      profile.active ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                  />
                  {profile.active ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}
                </span>
              </dd>
            </div>

            <div className="border-b border-border-subtle pb-2.5">
              <dt className="text-slate-500">Vai trò (Roles)</dt>
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {profile.roles && profile.roles.length > 0 ? (
                  profile.roles.map((r) => (
                    <span key={r.name} className="badge-info font-mono text-2xs">
                      {r.name}
                    </span>
                  ))
                ) : (
                  <span className="text-2xs text-slate-400">Chưa gán vai trò</span>
                )}
              </dd>
            </div>

            <div className="border-b border-border-subtle pb-2.5">
              <dt className="flex items-center gap-1.5 text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                Phân vùng phụ trách (assignedZones)
              </dt>
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {profile.assignedZones && profile.assignedZones.length > 0 ? (
                  profile.assignedZones.map((zone) => (
                    <span key={zone} className="badge-neutral font-mono text-2xs">
                      {zone}
                    </span>
                  ))
                ) : (
                  <span className="text-2xs text-slate-400">
                    Toàn thư viện / Không giới hạn phân vùng riêng
                  </span>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-slate-500">Quyền hạn chi tiết (Permissions)</dt>
              <dd className="mt-1.5 flex flex-wrap gap-1">
                {uniquePermissions.length > 0 ? (
                  uniquePermissions.map((perm) => (
                    <span
                      key={perm}
                      className="badge-neutral font-mono text-2xs"
                    >
                      {perm}
                    </span>
                  ))
                ) : (
                  <span className="text-2xs text-slate-400">
                    Mặc định theo vai trò
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        {/* Action Column: Two clean cards */}
        <div className="space-y-6">
          {/* Card A: Contact Info */}
          <section className="card p-5 md:p-6">
            <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
              <Mail className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Thông tin liên hệ
              </h2>
            </div>

            {contactError && (
              <div
                role="alert"
                className="mt-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{contactError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateContact} className="mt-4 space-y-3.5">
              <div>
                <label
                  htmlFor="profile-email"
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  Địa chỉ Email
                </label>
                <input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@library.edu.vn"
                  className="input mt-1 text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-phone"
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  Số điện thoại
                </label>
                <input
                  id="profile-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912345678"
                  className="input mt-1 text-xs"
                />
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                  className="btn-primary w-full justify-center"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {updateUserMutation.isPending
                      ? 'Đang lưu thay đổi...'
                      : 'Lưu thông tin liên hệ'}
                  </span>
                </button>
              </div>
            </form>
          </section>

          {/* Card B: Dedicated Password Change */}
          <section className="card p-5 md:p-6">
            <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
              <Key className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Đổi mật khẩu an toàn
              </h2>
            </div>

            {passwordError && (
              <div
                role="alert"
                className="mt-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="mt-4 space-y-3.5">
              <div>
                <label
                  htmlFor="profile-old-password"
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                  Mật khẩu hiện tại *
                </label>
                <input
                  id="profile-old-password"
                  type="password"
                  autoComplete="current-password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input mt-1 text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-new-password"
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  <Key className="h-3.5 w-3.5 text-slate-400" />
                  Mật khẩu mới (tối thiểu 8 ký tự) *
                </label>
                <input
                  id="profile-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input mt-1 text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-confirm-password"
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
                  Xác nhận mật khẩu mới *
                </label>
                <input
                  id="profile-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input mt-1 text-xs"
                />
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={changePasswordMutation.isPending || logoutMutation.isPending}
                  className="btn-primary w-full justify-center"
                >
                  <Lock className="h-4 w-4" />
                  <span>
                    {changePasswordMutation.isPending || logoutMutation.isPending
                      ? 'Đang đổi mật khẩu...'
                      : 'Đổi mật khẩu & Đăng nhập lại'}
                  </span>
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
