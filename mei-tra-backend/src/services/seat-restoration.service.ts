import { Injectable } from '@nestjs/common';
import { BlowState, DomainPlayer, GameState } from '../types/game.types';
import { toDomainPlayer } from '../types/player-adapters';
import { Room, RoomPlayer } from '../types/room.types';
import { GameStateService } from './game-state.service';
import type { VacantSeats } from '../types/vacant-seat.types';
import { asSeatId, resolveSeatId } from '../types/identity.types';
import {
  resolveCurrentPlayerIndex,
  setCurrentSeat,
} from '../types/current-turn';
import { upsertRuntimeSeat } from './runtime-seat-roster';

@Injectable()
export class SeatRestorationService {
  async restorePlayerFromVacantSeat(
    roomId: string,
    playerId: string,
    room: Room,
    gameState: GameStateService,
    vacantSeats: VacantSeats,
  ): Promise<boolean> {
    const vacantSeatsForRoom = vacantSeats[roomId];
    if (!vacantSeatsForRoom) {
      return false;
    }

    const vacancyEntry = Object.entries(vacantSeatsForRoom).find(
      ([, data]) => data.roomPlayer.seatId === playerId,
    );
    if (!vacancyEntry) {
      return false;
    }

    const [vacantSeatId, seatData] = vacancyEntry;
    const currentSeatPlayer = room.players.find(
      (player) => player.seatId === vacantSeatId,
    );
    if (!currentSeatPlayer || !currentSeatPlayer.isCOM) {
      return false;
    }

    const currentSeatIndex = room.players.findIndex(
      (player) => player.seatId === currentSeatPlayer.seatId,
    );
    if (currentSeatIndex === -1) {
      return false;
    }

    const comPlayerId = currentSeatPlayer.seatId;
    const seatId = resolveSeatId(currentSeatPlayer);
    const restoredRoomPlayer: RoomPlayer = {
      ...seatData.roomPlayer,
      socketId: '',
      seatId: seatId,
      joinedAt: new Date(seatData.roomPlayer.joinedAt),
    };

    const state = gameState.getState();
    const gsIndex = state.players.findIndex(
      (player) => player.seatId === comPlayerId || player.seatId === playerId,
    );

    const restoredGamePlayerBase: DomainPlayer = seatData.gamePlayer
      ? {
          ...toDomainPlayer(seatData.gamePlayer),
          seatId,
          hand: [
            ...(state.players[gsIndex]?.hand.length
              ? state.players[gsIndex].hand
              : seatData.gamePlayer.hand),
          ],
        }
      : toDomainPlayer({
          ...restoredRoomPlayer,
          hand: state.players[gsIndex]?.hand ?? [],
        });

    upsertRuntimeSeat(room, state, restoredRoomPlayer, {
      replaceSeatId: comPlayerId,
      gameplaySource: restoredGamePlayerBase,
    });

    gameState.registerPlayerToken(seatId, seatId);
    gameState.clearDisconnectTimeout(seatId);
    delete vacantSeatsForRoom[asSeatId(vacantSeatId)];
    if (Object.keys(vacantSeatsForRoom).length === 0) {
      delete vacantSeats[roomId];
    }

    await gameState.persistRoster(room.players, room.hostSeatId);
    const persistedState = gameState.getState();
    const advancedBlowTurn =
      this.advanceBlowTurnPastActedPlayer(persistedState);
    if (advancedBlowTurn) {
      await gameState.saveState();
    }
    return true;
  }

  private advanceBlowTurnPastActedPlayer(state: GameState): boolean {
    if (state.gamePhase !== 'blow' || state.players.length === 0) {
      return false;
    }

    const currentIndex = resolveCurrentPlayerIndex(state);
    const currentPlayer = state.players[currentIndex];
    if (
      !currentPlayer ||
      !this.hasActedInBlow(state.blowState, currentPlayer)
    ) {
      return false;
    }

    for (let offset = 1; offset < state.players.length; offset += 1) {
      const candidateIndex = (currentIndex + offset) % state.players.length;
      const candidatePlayer = state.players[candidateIndex];
      if (!this.hasActedInBlow(state.blowState, candidatePlayer)) {
        setCurrentSeat(state, candidatePlayer.seatId);
        return true;
      }
    }

    return false;
  }

  private hasActedInBlow(blowState: BlowState, player: DomainPlayer): boolean {
    return (
      player.isPasser ||
      blowState.declarations.some(
        (declaration) => declaration.seatId === player.seatId,
      ) ||
      (blowState.actionHistory ?? []).some(
        (action) => action.seatId === player.seatId,
      )
    );
  }
}
