export const DATABASE_HEALTH = 'IDatabaseHealth';

export interface IDatabaseHealth {
  healthCheck(): Promise<boolean>;
}
