export interface SessionUser {
  socketId: string;
  playerId: string;
  name: string;
  userId?: string;
  isAuthenticated?: boolean;
}

export interface PlayerConnectionState {
  socketId: string;
  userId?: string;
  isAuthenticated?: boolean;
}
