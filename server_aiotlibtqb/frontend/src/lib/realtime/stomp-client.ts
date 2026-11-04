import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { ENV } from '@/config/env';
import type { AlertResponse, TelemetryResponse } from '@/types/api';

/**
 * Pure reducer functions for STOMP incoming messages (FE-RT-05, FE-RT-06).
 */
export function mergeRealtimeTelemetry(
  current: TelemetryResponse | null | undefined,
  incoming: TelemetryResponse
): TelemetryResponse {
  if (!current || !current.timestamp) {
    return incoming;
  }
  const currentMs = new Date(current.timestamp).getTime();
  const incomingMs = new Date(incoming.timestamp).getTime();
  if (!Number.isNaN(currentMs) && !Number.isNaN(incomingMs) && incomingMs < currentMs) {
    return current;
  }
  return incoming;
}

export function upsertRealtimeAlertList(
  currentList: readonly AlertResponse[],
  incoming: AlertResponse
): AlertResponse[] {
  const index = currentList.findIndex((a) => a.id === incoming.id);
  if (index === -1) {
    return [incoming, ...currentList];
  }
  const updated = [...currentList];
  updated[index] = incoming;
  return updated;
}

export type ConnectionListener = (connected: boolean) => void;
export type AlertListener = (alert: AlertResponse) => void;
export type RoomTelemetryListener = (data: TelemetryResponse) => void;

/**
 * Singleton STOMP Client manager (FE-RT-01, FE-RT-02, FE-RT-09).
 */
class AiotStompManager {
  private client: Client | null = null;
  private connected = false;
  private tokenGetter: () => string | null = () => null;
  private canSubscribeAlertsGetter: () => boolean = () => false;

  private connectionListeners = new Set<ConnectionListener>();
  private alertListeners = new Set<AlertListener>();
  private roomListeners = new Map<string, Set<RoomTelemetryListener>>();
  private activeRoomSubs = new Map<string, StompSubscription>();
  private alertSub: StompSubscription | null = null;

  public configure(
    getAccessToken: () => string | null,
    canSubscribeAlerts: () => boolean
  ): void {
    this.tokenGetter = getAccessToken;
    this.canSubscribeAlertsGetter = canSubscribeAlerts;
  }

  public activate(): void {
    if (typeof window === 'undefined') return;
    const token = this.tokenGetter();
    if (!token) return;

    if (this.client?.active) {
      this.client.connectHeaders = {
        Authorization: `Bearer ${token}`,
      };
      if (this.connected) {
        this.resubscribeAll();
      }
      return;
    }

    this.client = new Client({
      brokerURL: ENV.WS_URL,
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      beforeConnect: () => {
        const latestToken = this.tokenGetter();
        if (!this.client) return;
        if (latestToken) {
          this.client.connectHeaders = {
            Authorization: `Bearer ${latestToken}`,
          };
        } else {
          this.client.connectHeaders = {};
        }
      },
      onConnect: () => {
        this.setConnected(true);
        this.resubscribeAll();
      },
      onWebSocketClose: () => {
        this.setConnected(false);
      },
      onStompError: (frame) => {
        // FE-RT-09: Never log raw headers or tokens
        console.warn(
          '[STOMP] Broker error:',
          frame.headers['message'] || 'Unknown error'
        );
        this.setConnected(false);
      },
    });

    this.client.activate();
  }

  public deactivate(): void {
    this.alertSub?.unsubscribe();
    this.alertSub = null;
    this.activeRoomSubs.forEach((sub) => sub.unsubscribe());
    this.activeRoomSubs.clear();
    if (this.client) {
      void this.client.deactivate();
      this.client = null;
    }
    this.setConnected(false);
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public onConnectionChange(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.connected);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  public onAlert(listener: AlertListener): () => void {
    this.alertListeners.add(listener);
    this.ensureAlertSubscription();
    return () => {
      this.alertListeners.delete(listener);
      if (this.alertListeners.size === 0 && this.alertSub) {
        this.alertSub.unsubscribe();
        this.alertSub = null;
      }
    };
  }

  public subscribeRoom(
    roomId: string,
    listener: RoomTelemetryListener
  ): () => void {
    if (!roomId) return () => {};
    let set = this.roomListeners.get(roomId);
    if (!set) {
      set = new Set();
      this.roomListeners.set(roomId, set);
    }
    set.add(listener);
    this.ensureRoomSubscription(roomId);

    return () => {
      const currentSet = this.roomListeners.get(roomId);
      if (!currentSet) return;
      currentSet.delete(listener);
      if (currentSet.size === 0) {
        this.roomListeners.delete(roomId);
        const sub = this.activeRoomSubs.get(roomId);
        if (sub) {
          sub.unsubscribe();
          this.activeRoomSubs.delete(roomId);
        }
      }
    };
  }

  private setConnected(state: boolean): void {
    this.connected = state;
    this.connectionListeners.forEach((cb) => cb(state));
  }

  private resubscribeAll(): void {
    this.alertSub = null;
    this.activeRoomSubs.clear();
    if (this.alertListeners.size > 0) {
      this.ensureAlertSubscription();
    }
    for (const roomId of this.roomListeners.keys()) {
      this.ensureRoomSubscription(roomId);
    }
  }

  private ensureAlertSubscription(): void {
    if (
      !this.connected ||
      !this.client ||
      this.alertSub ||
      !this.canSubscribeAlertsGetter()
    ) {
      return;
    }
    this.alertSub = this.client.subscribe('/topic/alerts', (msg: IMessage) => {
      try {
        const parsed = JSON.parse(msg.body) as AlertResponse;
        this.alertListeners.forEach((cb) => cb(parsed));
      } catch {
        // Ignore malformed frame
      }
    });
  }

  private ensureRoomSubscription(roomId: string): void {
    if (!this.connected || !this.client || this.activeRoomSubs.has(roomId)) {
      return;
    }
    const sub = this.client.subscribe(
      `/topic/rooms/${roomId}/telemetry`,
      (msg: IMessage) => {
        try {
          const parsed = JSON.parse(msg.body) as TelemetryResponse;
          const listeners = this.roomListeners.get(roomId);
          listeners?.forEach((cb) => cb(parsed));
        } catch {
          // Ignore malformed frame
        }
      }
    );
    this.activeRoomSubs.set(roomId, sub);
  }
}

export const stompManager = new AiotStompManager();
