import { Inject, Injectable } from '@nestjs/common';
import { IRoomRepository } from '../repositories/interfaces/room.repository.interface';
import { DomainPlayer } from '../types/game.types';
import { toDomainPlayer } from '../types/player-adapters';
import { Room, RoomPlayer } from '../types/room.types';
import { GameStateService } from './game-state.service';
import { PlayerReferenceRemapperService } from './player-reference-remapper.service';
import { VacantSeats } from './com-session.service';

@Injectable()
export class SeatRestorationService {
  constructor(
    @Inject('IRoomRepository')
    private readonly roomRepository: IRoomRepository,
    private readonly playerReferenceRemapper: PlayerReferenceRemapperService,
  ) {}

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
    const restoredRoomPlayer: RoomPlayer = {
      ...seatData.roomPlayer,
      socketId: '',
      playerId,
      hand: [
        ...(currentSeatPlayer.hand.length
          ? currentSeatPlayer.hand
          : seatData.roomPlayer.hand),
      ],
      joinedAt: new Date(seatData.roomPlayer.joinedAt),
    };

    room.players[currentSeatIndex] = restoredRoomPlayer;

    await this.roomRepository.removePlayer(roomId, comPlayerId);
    const addSuccess = await this.roomRepository.addPlayer(
      roomId,
      restoredRoomPlayer,
    );
    if (!addSuccess) {
      await this.roomRepository.addPlayer(roomId, currentSeatPlayer);
      room.players[currentSeatIndex] = currentSeatPlayer;
      return false;
    }

    const state = gameState.getState();
    const gsIndex = state.players.findIndex(
      (player) =>
        player.playerId === comPlayerId || player.playerId === playerId,
    );

    const restoredGamePlayerBase: DomainPlayer = seatData.gamePlayer
      ? {
          ...toDomainPlayer(seatData.gamePlayer),
          playerId,
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
        playerId,
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

    this.playerReferenceRemapper.remapGameStatePlayerIdReferences(
      state,
      comPlayerId,
      playerId,
    );

    gameState.registerPlayerToken(playerId, playerId);
    gameState.clearDisconnectTimeout(playerId);
    if (state.teamAssignments[comPlayerId] != null) {
      delete state.teamAssignments[comPlayerId];
    }
    state.teamAssignments[playerId] = restoredRoomPlayer.team;

    delete vacantSeatsForRoom[seatIndex];
    if (Object.keys(vacantSeatsForRoom).length === 0) {
      delete vacantSeats[roomId];
    }

    return true;
  }
}
