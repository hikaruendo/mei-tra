import { config } from '@/lib/config';
import { t } from '@/i18n';

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
      t('auth.sessionExpired'),
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
      t('account.networkError'),
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
      t('account.leaveRoomFirst'),
      response.status,
      activeRoomCount,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new AccountDeletionError(
      'unauthorized',
      t('auth.sessionExpired'),
      response.status,
    );
  }

  throw new AccountDeletionError(
    'server',
    message || t('account.deleteFailed'),
    response.status,
  );
};
