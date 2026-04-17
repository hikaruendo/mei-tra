import { Inject, Injectable } from '@nestjs/common';
import { IRoomRepository } from '../repositories/interfaces/room.repository.interface';
import { DomainPlayer, Team } from '../types/game.types';
import { toDomainPlayer } from '../types/player-adapters';
import { Room, RoomPlayer } from '../types/room.types';
import { GameStateService } from './game-state.service';
import { PlayerReferenceRemapperService } from './player-reference-remapper.service';
import { VacantSeats } from './com-session.service';
import { SessionUser } from '../types/session.types';

interface JoinRoomParams {
  roomId: string;
  room: Room;
  gameState: GameStateService;
  user: SessionUser;
  vacantSeats: VacantSeats;
}

interface RestoredSeatData {
  roomPlayer: RoomPlayer;
  gamePlayer?: DomainPlayer;
  replacementPlayerId?: string;
}

@Injectable()
export class RoomJoinService {
  constructor(
    @Inject('IRoomRepository')
    private readonly roomRepository: IRoomRepository,
    private readonly playerReferenceRemapperService: PlayerReferenceRemapperService,
  ) {}

  async joinRoom({
    roomId,
    room,
    gameState,
    user,
    vacantSeats,
  }: JoinRoomParams): Promise<boolean> {
    const state = gameState.getState();

    if (this.countActualPlayers(room.players) >= room.settings.maxPlayers) {
      return false;
    }

    const existingPlayer = room.players.find(
      (player) => player.playerId === user.playerId,
    );
    if (existingPlayer) {
      return true;
    }

    const roomVacant = vacantSeats[roomId] || {};
    const vacantIndexes = Object.keys(roomVacant).map(Number);
    let assignedIndex = -1;
    let gsAssignedIndex = -1;
    let hand: string[] = [];
    let team: Team = 0;
    let replacingComId: string | null = null;
    let restoredSeatData: RestoredSeatData | null = null;

    const matchingVacantIndex = vacantIndexes.find(
      (index) => roomVacant[index]?.roomPlayer.playerId === user.playerId,
    );

    if (matchingVacantIndex !== undefined) {
      assignedIndex = matchingVacantIndex;
      const seatData = roomVacant[assignedIndex];
      const seatRoomPlayer = seatData?.roomPlayer;
      const seatGamePlayer = seatData?.gamePlayer;

      hand = seatGamePlayer
        ? [...seatGamePlayer.hand]
        : seatRoomPlayer
          ? [...seatRoomPlayer.hand]
          : [];
      team = seatRoomPlayer ? seatRoomPlayer.team : team;
      restoredSeatData = seatData ?? null;
      gameState.clearDisconnectTimeout(user.playerId);
      delete roomVacant[assignedIndex];
      if (Object.keys(roomVacant).length === 0) {
        delete vacantSeats[roomId];
      }
    } else if (vacantIndexes.length > 0) {
      assignedIndex = vacantIndexes[0];
      const seatData = roomVacant[assignedIndex];
      const seatRoomPlayer = seatData?.roomPlayer;
      hand = seatRoomPlayer ? [...seatRoomPlayer.hand] : [];
      team = seatRoomPlayer ? seatRoomPlayer.team : team;

      const originalPlayerId = seatRoomPlayer?.playerId;
      if (originalPlayerId) {
        gameState.removePlayerToken(originalPlayerId);
        gameState.clearDisconnectTimeout(originalPlayerId);
      }

      restoredSeatData = seatData ?? null;
      delete roomVacant[assignedIndex];
      if (Object.keys(roomVacant).length === 0) {
        delete vacantSeats[roomId];
      }
    } else {
      if (state.gamePhase !== null) {
        const comIndex = room.players.findIndex(
          (player) => player.isCOM === true,
        );
        if (comIndex !== -1) {
          const comPlayerId = room.players[comIndex].playerId;
          team = room.players[comIndex].team;
          replacingComId = comPlayerId;
          assignedIndex = comIndex;
          gsAssignedIndex = state.players.findIndex(
            (player) => player.playerId === comPlayerId,
          );
          const currentGamePlayer =
            gsAssignedIndex !== -1 ? state.players[gsAssignedIndex] : null;
          hand = currentGamePlayer
            ? [...(currentGamePlayer.hand ?? [])]
            : [...(room.players[comIndex].hand ?? [])];
        }
      }

      if (hand.length === 0) {
        const team0Count = room.players.filter(
          (player) => !player.isCOM && player.team === 0,
        ).length;
        const team1Count = room.players.filter(
          (player) => !player.isCOM && player.team === 1,
        ).length;
        team = (team0Count <= team1Count ? 0 : 1) as Team;
      }

      if (!replacingComId && assignedIndex === -1) {
        const waitingComIndex = room.players.findIndex(
          (player) => player.isCOM === true && !player.isReady,
        );
        if (waitingComIndex !== -1) {
          replacingComId = room.players[waitingComIndex].playerId;
          assignedIndex = waitingComIndex;
        }
      }
    }

    const seatRoomSnapshot = restoredSeatData?.roomPlayer;
    const seatGameSnapshot = restoredSeatData?.gamePlayer;
    const replacementPlayerId = restoredSeatData?.replacementPlayerId;

    if (replacementPlayerId) {
      const currentRoomSeatIndex = room.players.findIndex(
        (player) => player.playerId === replacementPlayerId,
      );
      if (currentRoomSeatIndex !== -1) {
        assignedIndex = currentRoomSeatIndex;
        replacingComId = replacementPlayerId;
      }
    } else if (assignedIndex !== -1) {
      replacingComId = room.players[assignedIndex]?.playerId || null;
    }

    const currentSeatRoomPlayer =
      replacingComId != null
        ? room.players.find((player) => player.playerId === replacingComId)
        : assignedIndex !== -1
          ? room.players[assignedIndex]
          : undefined;
    const currentSeatRoomHand =
      currentSeatRoomPlayer && currentSeatRoomPlayer.hand.length > 0
        ? currentSeatRoomPlayer.hand
        : undefined;

    const player: RoomPlayer = {
      ...(seatRoomSnapshot ?? {}),
      ...user,
      socketId: user.socketId,
      playerId: user.playerId,
      team: currentSeatRoomPlayer?.team ?? team,
      hand: [...(currentSeatRoomHand ?? hand)],
      isPasser:
        seatGameSnapshot?.isPasser ??
        currentSeatRoomPlayer?.isPasser ??
        seatRoomSnapshot?.isPasser ??
        false,
      hasBroken:
        seatGameSnapshot?.hasBroken ??
        currentSeatRoomPlayer?.hasBroken ??
        seatRoomSnapshot?.hasBroken ??
        false,
      hasRequiredBroken:
        seatGameSnapshot?.hasRequiredBroken ??
        currentSeatRoomPlayer?.hasRequiredBroken ??
        seatRoomSnapshot?.hasRequiredBroken ??
        false,
      isReady:
        currentSeatRoomPlayer?.isReady ?? seatRoomSnapshot?.isReady ?? false,
      isHost: room.hostId === user.playerId,
      joinedAt: seatRoomSnapshot?.joinedAt
        ? new Date(seatRoomSnapshot.joinedAt)
        : new Date(),
    };

    if (replacingComId) {
      await this.roomRepository.removePlayer(roomId, replacingComId);
      const addSuccess = await this.roomRepository.addPlayer(roomId, player);
      if (!addSuccess) {
        return false;
      }
    } else {
      const addSuccess = await this.roomRepository.addPlayer(roomId, player);
      if (!addSuccess) {
        return false;
      }
    }

    if (assignedIndex !== -1) {
      room.players[assignedIndex] = player;
    } else {
      const comIndex = room.players.findIndex(
        (roomPlayer) => roomPlayer.isCOM === true && !roomPlayer.isReady,
      );
      if (comIndex !== -1) {
        room.players[comIndex] = player;
      } else {
        room.players.push(player);
      }
    }

    if (replacementPlayerId) {
      gsAssignedIndex = state.players.findIndex(
        (statePlayer) => statePlayer.playerId === replacementPlayerId,
      );
    }
    if (gsAssignedIndex === -1 && replacingComId) {
      gsAssignedIndex = state.players.findIndex(
        (statePlayer) => statePlayer.playerId === replacingComId,
      );
    }

    const currentSeatGamePlayer =
      replacingComId != null
        ? state.players.find(
            (statePlayer) => statePlayer.playerId === replacingComId,
          )
        : undefined;

    player.hand = [
      ...(currentSeatGamePlayer?.hand.length
        ? currentSeatGamePlayer.hand
        : player.hand),
    ];
    player.isPasser =
      currentSeatGamePlayer?.isPasser ?? player.isPasser ?? false;
    player.hasBroken =
      currentSeatGamePlayer?.hasBroken ?? player.hasBroken ?? false;
    player.hasRequiredBroken =
      currentSeatGamePlayer?.hasRequiredBroken ??
      player.hasRequiredBroken ??
      false;

    const gamePlayer = toDomainPlayer(player);

    if (gsAssignedIndex !== -1) {
      state.players[gsAssignedIndex] = gamePlayer;
    } else {
      const comIndex = state.players.findIndex(
        (statePlayer) => statePlayer.isCOM === true,
      );
      if (comIndex !== -1) {
        state.players[comIndex] = gamePlayer;
      } else {
        state.players.push(gamePlayer);
      }
    }

    if (replacingComId) {
      this.playerReferenceRemapperService.remapGameStatePlayerIdReferences(
        state,
        replacingComId,
        player.playerId,
      );
      if (state.teamAssignments[replacingComId] != null) {
        delete state.teamAssignments[replacingComId];
      }
    }
    state.teamAssignments[player.playerId] = player.team;

    gameState.registerPlayerToken(player.playerId, player.playerId);

    await this.roomRepository.updateLastActivity(roomId);
    return true;
  }

  private countActualPlayers(players: RoomPlayer[]): number {
    return players.filter((player) => !player.isCOM).length;
  }
}
