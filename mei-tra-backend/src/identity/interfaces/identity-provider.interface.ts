export interface VerifiedIdentity {
  id: string;
  email?: string;
  isAnonymous: boolean;
}

export type DeleteIdentityResult = 'deleted' | 'not-found';

export interface IIdentityProvider {
  verifyAccessToken(token: string): Promise<VerifiedIdentity | null>;
  deleteUser(userId: string): Promise<DeleteIdentityResult>;
}
