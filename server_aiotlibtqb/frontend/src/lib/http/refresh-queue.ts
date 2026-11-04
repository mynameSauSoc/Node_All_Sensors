import type { AuthenticationResponse } from '@/types/api';

export type RefreshHandler = () => Promise<AuthenticationResponse>;

/**
 * Single-flight Refresh Queue (FE-AUTH-03).
 * Guarantees that concurrent 401 responses trigger at most ONE refresh call.
 */
export class SingleFlightRefreshCoordinator {
  private inFlightPromise: Promise<AuthenticationResponse> | null = null;

  public async executeRefresh(
    refreshFn: RefreshHandler
  ): Promise<AuthenticationResponse> {
    if (!this.inFlightPromise) {
      this.inFlightPromise = refreshFn().finally(() => {
        this.inFlightPromise = null;
      });
    }
    return this.inFlightPromise;
  }

  public isRefreshing(): boolean {
    return this.inFlightPromise !== null;
  }
}

export const defaultRefreshCoordinator = new SingleFlightRefreshCoordinator();
