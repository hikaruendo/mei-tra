import { Injectable } from '@nestjs/common';
import { BlowState, DomainPlayer, GameState } from '../types/game.types';
import { toDomainPlayer } from '../types/player-adapters';
import { Room, RoomPlayer } from '../types/room.types';
import { GameStateService } from './game-state.service';
import { VacantSeats } from './com-session.service';
import { asSeatId, resolveSeatId } from '../types/identity.types';

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
      ([, data]) => data.roomPlayer.playerId === playerId,
    );
    if (!vacancyEntry) {
      return false;
    }

    const [seatIndexKey, seatData] = vacancyEntry;
    const seatIndex = Number(seatIndexKey);
    const currentSeatPlayer =
      seatData.replacementPlayerId != null
        ? room.players.find(
            (player) => player.playerId === seatData.replacementPlayerId,
          )
        : room.players[seatIndex];
    if (!currentSeatPlayer || !currentSeatPlayer.isCOM) {
      return false;
    }

    const currentSeatIndex = room.players.findIndex(
      (player) => player.playerId === currentSeatPlayer.playerId,
    );
    if (currentSeatIndex === -1) {
      return false;
    }

    const comPlayerId = currentSeatPlayer.playerId;
    const seatId = resolveSeatId(currentSeatPlayer);
    const restoredRoomPlayer: RoomPlayer = {
      ...seatData.roomPlayer,
      socketId: '',
      seatId,
      playerId: seatId,
      hand: [
        ...(currentSeatPlayer.hand.length
          ? currentSeatPlayer.hand
          : seatData.roomPlayer.hand),
      ],
      joinedAt: new Date(seatData.roomPlayer.joinedAt),
    };

    room.players[currentSeatIndex] = restoredRoomPlayer;

    const state = gameState.getState();
    const gsIndex = state.players.findIndex(
      (player) =>
        player.playerId === comPlayerId || player.playerId === playerId,
    );

    const restoredGamePlayerBase: DomainPlayer = seatData.gamePlayer
      ? {
          ...toDomainPlayer(seatData.gamePlayer),
          seatId,
          playerId: seatId,
          hand: [
            ...(state.players[gsIndex]?.hand.length
              ? state.players[gsIndex].hand
              : seatData.gamePlayer.hand),
          ],
        }
      : toDomainPlayer(restoredRoomPlayer);

    if (gsIndex !== -1) {
      state.players[gsIndex] = toDomainPlayer({
        ...restoredGamePlayerBase,
        seatId,
        playerId: seatId,
        name: restoredRoomPlayer.name,
        team: restoredRoomPlayer.team,
        hand: [...restoredRoomPlayer.hand],
        isPasser:
          restoredGamePlayerBase.isPasser ??
          restoredRoomPlayer.isPasser ??
          false,
        hasBroken:
          restoredGamePlayerBase.hasBroken ??
          restoredRoomPlayer.hasBroken ??
          false,
        hasRequiredBroken:
          restoredGamePlayerBase.hasRequiredBroken ??
          restoredRoomPlayer.hasRequiredBroken ??
          false,
      });
    } else {
      state.players.push(restoredGamePlayerBase);
    }

    gameState.registerPlayerToken(seatId, seatId);
    gameState.clearDisconnectTimeout(seatId);
    state.teamAssignments[seatId] = restoredRoomPlayer.team;

    delete vacantSeatsForRoom[seatIndex];
    if (Object.keys(vacantSeatsForRoom).length === 0) {
      delete vacantSeats[roomId];
    }

    await gameState.persistRoster(room.players, room.hostId);
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

    const currentIndex = this.resolveCurrentPlayerIndex(state);
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
        state.currentPlayerIndex = candidateIndex;
        state.currentPlayerId = candidatePlayer.playerId;
        state.currentSeatId = asSeatId(candidatePlayer.playerId);
        return true;
      }
    }

    return false;
  }

  private resolveCurrentPlayerIndex(state: GameState): number {
    if (state.currentPlayerId) {
      const index = state.players.findIndex(
        (player) => player.playerId === state.currentPlayerId,
      );
      if (index !== -1) {
        return index;
      }
    }

    return Math.min(
      Math.max(state.currentPlayerIndex ?? 0, 0),
      state.players.length - 1,
    );
  }

  private hasActedInBlow(blowState: BlowState, player: DomainPlayer): boolean {
    return (
      player.isPasser ||
      blowState.declarations.some(
        (declaration) => declaration.playerId === player.playerId,
      ) ||
      (blowState.actionHistory ?? []).some(
        (action) => action.playerId === player.playerId,
      )
    );
  }
}
