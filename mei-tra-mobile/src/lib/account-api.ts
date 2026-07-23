import { config } from '@/lib/config';

export type AccountDeletionErrorKind =
  | 'active-room'
  | 'unauthorized'
  | 'server'
  | 'network';

export class AccountDeletionError extends Error {
  readonly kind: AccountDeletionErrorKind;
  readonly status: number | null;
  readonly activeRoomCount: number | null;

  constructor(
    kind: AccountDeletionErrorKind,
    message: string,
    status: number | null = null,
    activeRoomCount: number | null = null,
  ) {
    super(message);
    this.name = 'AccountDeletionError';
    this.kind = kind;
    this.status = status;
    this.activeRoomCount = activeRoomCount;
  }
}

interface AccountDeletionErrorBody {
  message?: unknown;
  activeRoomCount?: unknown;
}

const readErrorBody = async (
  response: Response,
): Promise<AccountDeletionErrorBody> => {
  try {
    const body: unknown = await response.json();
    return body && typeof body === 'object'
      ? (body as AccountDeletionErrorBody)
      : {};
  } catch {
    return {};
  }
};

export const deleteAccountRequest = async (
  userId: string,
  accessToken: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<void> => {
  if (!accessToken) {
    throw new AccountDeletionError(
      'unauthorized',
      'ログインセッションが切れています。もう一度ログインしてください。',
      401,
    );
  }

  let response: Response;
  try {
    response = await fetchImpl(
      `${config.backendUrl}/api/user-profile/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  } catch {
    throw new AccountDeletionError(
      'network',
      'サーバーに接続できませんでした。通信状態を確認して再試行してください。',
    );
  }

  if (response.ok) return;

  const body = await readErrorBody(response);
  const message = typeof body.message === 'string' ? body.message : '';
  const activeRoomCount =
    typeof body.activeRoomCount === 'number' ? body.activeRoomCount : null;

  if (response.status === 409) {
    throw new AccountDeletionError(
      'active-room',
      '参加中のルームから退出してからアカウントを削除してください。',
      response.status,
      activeRoomCount,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new AccountDeletionError(
      'unauthorized',
      'ログインセッションが切れています。もう一度ログインしてください。',
      response.status,
    );
  }

  throw new AccountDeletionError(
    'server',
    message || 'アカウントを削除できませんでした。時間をおいて再試行してください。',
    response.status,
  );
};
