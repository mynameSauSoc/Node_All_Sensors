const isBrowser = typeof window !== 'undefined';

export const ENV = {
  API_BASE_URL:
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (isBrowser ? `${window.location.origin}/api/v1` : 'http://localhost:8080/api/v1'),
  WS_URL:
    process.env.NEXT_PUBLIC_WS_URL ||
    (isBrowser
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws-aiot`
      : 'ws://localhost:8080/ws-aiot'),
} as const;
