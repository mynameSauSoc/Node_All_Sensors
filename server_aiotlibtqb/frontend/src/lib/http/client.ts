import { ENV } from '@/config/env';
import type { ApiResponse, AuthenticationResponse } from '@/types/api';
import { ApiError } from './error-mapper';
import {
  defaultRefreshCoordinator,
  SingleFlightRefreshCoordinator,
} from './refresh-queue';

export interface AuthTokenAccessor {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearSession: () => void;
}

let tokenAccessor: AuthTokenAccessor = {
  getAccessToken: () => null,
  getRefreshToken: () => null,
  setTokens: () => {},
  clearSession: () => {},
};

export function registerAuthTokenAccessor(accessor: AuthTokenAccessor): void {
  tokenAccessor = accessor;
}

export function unwrapEnvelope<T>(
  payload: ApiResponse<T> | null | undefined,
  httpStatus: number,
  retryAfterSeconds?: number
): T {
  if (!payload || typeof payload.code !== 'number') {
    throw new ApiError({
      code: 9999,
      httpStatus,
      retryAfterSeconds,
    });
  }

  if (payload.code !== 1000) {
    throw new ApiError({
      code: payload.code,
      httpStatus,
      rawMessage: payload.message,
      retryAfterSeconds,
    });
  }

  return payload.result as T;
}

const NON_REFRESHABLE_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

export interface HttpRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
  _isRetry?: boolean;
}

export function createHttpClient(
  customFetch: typeof fetch = fetch,
  coordinator: SingleFlightRefreshCoordinator = defaultRefreshCoordinator
) {
  async function performRefresh(): Promise<AuthenticationResponse> {
    const currentRefreshToken = tokenAccessor.getRefreshToken();
    if (!currentRefreshToken) {
      tokenAccessor.clearSession();
      throw new ApiError({ code: 1006, httpStatus: 401 });
    }

    const res = await customFetch(`${ENV.API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: currentRefreshToken }),
    });

    const json = (await res.json().catch(() => null)) as ApiResponse<AuthenticationResponse> | null;
    if (!res.ok || !json || json.code !== 1000 || !json.result) {
      tokenAccessor.clearSession();
      throw new ApiError({
        code: json?.code ?? 1006,
        httpStatus: res.status || 401,
        rawMessage: json?.message,
      });
    }

    tokenAccessor.setTokens(json.result.token, json.result.refreshToken);
    return json.result;
  }

  async function request<T>(
    path: string,
    options: HttpRequestOptions = {}
  ): Promise<T> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${ENV.API_BASE_URL}${normalizedPath}`;

    const headers = new Headers(options.headers);
    if (options.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (!options.skipAuth) {
      const accessToken = tokenAccessor.getAccessToken();
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
      }
    }

    const response = await customFetch(url, {
      ...options,
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterSeconds = retryAfterHeader
      ? Number.parseInt(retryAfterHeader, 10)
      : undefined;

    const payload = (await response
      .json()
      .catch(() => null)) as ApiResponse<T> | null;

    const isUnauthorized =
      response.status === 401 || payload?.code === 1006;
    const canRefresh =
      !options._isRetry &&
      !options.skipAuth &&
      !NON_REFRESHABLE_PATHS.some((p) => normalizedPath.startsWith(p));

    if (isUnauthorized && canRefresh && tokenAccessor.getRefreshToken()) {
      await coordinator.executeRefresh(performRefresh);
      return request<T>(normalizedPath, { ...options, _isRetry: true });
    }

    if (!response.ok) {
      throw new ApiError({
        code: payload?.code ?? (response.status === 429 ? 4029 : 9999),
        httpStatus: response.status,
        rawMessage: payload?.message,
        retryAfterSeconds: Number.isNaN(retryAfterSeconds)
          ? undefined
          : retryAfterSeconds,
      });
    }

    return unwrapEnvelope<T>(payload, response.status, retryAfterSeconds);
  }

  return {
    request,
    get: <T>(path: string, options?: HttpRequestOptions) =>
      request<T>(path, { ...options, method: 'GET' }),
    post: <T>(path: string, body?: unknown, options?: HttpRequestOptions) =>
      request<T>(path, { ...options, method: 'POST', body }),
    put: <T>(path: string, body?: unknown, options?: HttpRequestOptions) =>
      request<T>(path, { ...options, method: 'PUT', body }),
    patch: <T>(path: string, body?: unknown, options?: HttpRequestOptions) =>
      request<T>(path, { ...options, method: 'PATCH', body }),
    delete: <T>(path: string, options?: HttpRequestOptions) =>
      request<T>(path, { ...options, method: 'DELETE' }),
  };
}

export const httpClient = createHttpClient();
