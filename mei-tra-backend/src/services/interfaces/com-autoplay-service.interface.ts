export interface IComAutoPlayService {
  scheduleComTurn(
    roomId: string,
    playerId: string,
    action: () => Promise<void>,
  ): void;
  clearComTurn(roomId: string, playerId: string): void;
  clearRoomTimers(roomId: string): void;
}
