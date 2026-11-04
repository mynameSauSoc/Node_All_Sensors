import { ERROR_MESSAGES_VI } from '@/messages/vi';

export class ApiError extends Error {
  public readonly code: number;
  public readonly httpStatus: number;
  public readonly rawMessage?: string;
  public readonly retryAfterSeconds?: number;

  constructor(params: {
    code: number;
    httpStatus: number;
    rawMessage?: string;
    retryAfterSeconds?: number;
  }) {
    const friendly = getFriendlyErrorMessage(params.code, params.httpStatus);
    super(friendly);
    this.name = 'ApiError';
    this.code = params.code;
    this.httpStatus = params.httpStatus;
    this.rawMessage = params.rawMessage;
    this.retryAfterSeconds = params.retryAfterSeconds;
  }
}

export function getFriendlyErrorMessage(
  code?: number,
  httpStatus?: number
): string {
  if (code !== undefined && code in ERROR_MESSAGES_VI) {
    return ERROR_MESSAGES_VI[code];
  }
  if (httpStatus === 429) return ERROR_MESSAGES_VI[4029];
  if (httpStatus === 401) return ERROR_MESSAGES_VI[1006];
  if (httpStatus === 403) return ERROR_MESSAGES_VI[1007];
  return ERROR_MESSAGES_VI[9999];
}
