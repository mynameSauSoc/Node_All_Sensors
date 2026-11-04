import { create } from 'zustand';
import { registerAuthTokenAccessor } from '@/lib/http/client';
import {
  buildCapabilities,
  type CapabilityMatrix,
} from '@/lib/rbac/capabilities';
import { decodeJwtScope, parseScopeString } from '@/lib/rbac/scope-parser';
import { stompManager } from '@/lib/realtime/stomp-client';
import type { UserResponse } from '@/types/api';

const SESSION_REFRESH_KEY = 'aiot_refresh_token';
const KIOSK_REFRESH_KEY = 'aiot_kiosk_refresh_token';
const AUTH_CHANNEL_NAME = 'aiot_auth_channel';

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserResponse | null;
  capabilities: CapabilityMatrix;
  hydrated: boolean;
  isKioskSession: boolean;
  setTokens: (
    accessToken: string,
    refreshToken: string,
    kioskMode?: boolean
  ) => void;
  setUser: (user: UserResponse | null) => void;
  clearSession: () => void;
  hydrateFromStorage: (kioskMode?: boolean) => string | null;
}

const emptyCapabilities = buildCapabilities(parseScopeString(''));
let broadcastChannelAttached = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  capabilities: emptyCapabilities,
  hydrated: false,
  isKioskSession: false,

  setTokens: (accessToken, refreshToken, kioskMode) => {
    const parsed = decodeJwtScope(accessToken);
    const capabilities = buildCapabilities(parsed);
    const effectiveKiosk =
      kioskMode ??
      (get().isKioskSession ||
        (typeof window !== 'undefined' &&
          Boolean(window.localStorage.getItem(KIOSK_REFRESH_KEY))));

    if (typeof window !== 'undefined') {
      try {
        if (effectiveKiosk) {
          window.localStorage.setItem(KIOSK_REFRESH_KEY, refreshToken);
          window.sessionStorage.removeItem(SESSION_REFRESH_KEY);
        } else {
          window.sessionStorage.setItem(SESSION_REFRESH_KEY, refreshToken);
          window.localStorage.removeItem(KIOSK_REFRESH_KEY);
        }
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel(AUTH_CHANNEL_NAME);
          bc.postMessage({
            type: 'TOKENS_UPDATED',
            accessToken,
            refreshToken,
            isKioskSession: effectiveKiosk,
          });
          bc.close();
        }
      } catch {
        // Ignore storage errors
      }
    }

    set({
      accessToken,
      refreshToken,
      capabilities,
      hydrated: true,
      isKioskSession: effectiveKiosk,
    });
    stompManager.activate();
  },

  setUser: (user) => {
    set({ user });
  },

  clearSession: () => {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(SESSION_REFRESH_KEY);
        window.localStorage.removeItem(KIOSK_REFRESH_KEY);
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel(AUTH_CHANNEL_NAME);
          bc.postMessage({ type: 'SESSION_CLEARED' });
          bc.close();
        }
      } catch {
        // Ignore storage errors
      }
    }
    stompManager.deactivate();
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      capabilities: emptyCapabilities,
      hydrated: true,
      isKioskSession: false,
    });
  },

  hydrateFromStorage: (kioskMode = false) => {
    if (typeof window === 'undefined') {
      set({ hydrated: true });
      return null;
    }

    if (!broadcastChannelAttached && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel(AUTH_CHANNEL_NAME);
        bc.onmessage = (event) => {
          const data = event.data;
          if (!data || typeof data !== 'object') return;
          if (
            data.type === 'TOKENS_UPDATED' &&
            typeof data.accessToken === 'string' &&
            typeof data.refreshToken === 'string'
          ) {
            const parsed = decodeJwtScope(data.accessToken);
            const capabilities = buildCapabilities(parsed);
            set({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              capabilities,
              hydrated: true,
              isKioskSession: Boolean(data.isKioskSession),
            });
            stompManager.activate();
          } else if (data.type === 'SESSION_CLEARED') {
            stompManager.deactivate();
            set({
              accessToken: null,
              refreshToken: null,
              user: null,
              capabilities: emptyCapabilities,
              hydrated: true,
              isKioskSession: false,
            });
          }
        };
        broadcastChannelAttached = true;
      } catch {
        // Ignore BroadcastChannel errors
      }
    }

    const storedRefresh = kioskMode
      ? window.localStorage.getItem(KIOSK_REFRESH_KEY)
      : window.sessionStorage.getItem(SESSION_REFRESH_KEY);

    if (storedRefresh && !get().refreshToken) {
      set({
        refreshToken: storedRefresh,
        hydrated: true,
        isKioskSession: kioskMode,
      });
      return storedRefresh;
    }
    set({ hydrated: true, isKioskSession: kioskMode || get().isKioskSession });
    return get().refreshToken;
  },
}));

// Register HTTP client accessor and STOMP token hooks
registerAuthTokenAccessor({
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  setTokens: (access, refresh) =>
    useAuthStore.getState().setTokens(access, refresh),
  clearSession: () => useAuthStore.getState().clearSession(),
});

stompManager.configure(
  () => useAuthStore.getState().accessToken,
  () => useAuthStore.getState().capabilities.canViewAlerts
);
