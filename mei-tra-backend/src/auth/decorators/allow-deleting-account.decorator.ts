import { SetMetadata } from '@nestjs/common';

export const ALLOW_DELETING_ACCOUNT_AUTH = 'allowDeletingAccountAuth';

export const AllowDeletingAccountAuth = () =>
  SetMetadata(ALLOW_DELETING_ACCOUNT_AUTH, true);
