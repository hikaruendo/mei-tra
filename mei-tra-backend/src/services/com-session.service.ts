import { Inject, Injectable } from '@nestjs/common';
import { DomainPlayer, Team } from '../types/game.types';
import { toDomainPlayer, toRoomPlayer } from '../types/player-adapters';
import { Room, RoomPlayer } from '../types/room.types';
import { IComPlayerService } from './interfaces/com-player-service.interface';
import { GameStateService } from './game-state.service';
import { randomUUID } from 'crypto';
import { asSeatId, resolveSeatId } from '../types/identity.types';
import { RosterMembershipMutation } from '../types/room-membership.types';
import { upsertRuntimeSeat } from './runtime-seat-roster';

export type VacantSeats = Record<
  string,
  Record<
    number,
    {
      roomPlayer: RoomPlayer;
      gamePlayer?: DomainPlayer;
      replacementPlayerId?: string;
    }
  >
>;

@Injectable()
export class ComSessionService {
  constructor(
    @Inject('IComPlayerService')
    private readonly comPlayerService: IComPlayerService,
  ) {}

  private createCOMPlaceholder(
    index: number | string,
    team: Team,
    hand: string[] = [],
    seatId = asSeatId(randomUUID()),
  ): RoomPlayer {
    const idStr = String(index);
    return toRoomPlayer({
      session: {
        socketId: `com-${idStr}`,
        seatId,
        playerId: seatId,
        name: 'COM',
      },
      participantKey: `com-${idStr}-${seatId}`,
      gameplay: {
        seatId,
        playerId: seatId,
        name: 'COM',
        isCOM: true,
        hand,
        team,
        isPasser: true,
        hasBroken: false,
        hasRequiredBroken: false,
      },
      isReady: false,
      isHost: false,
      joinedAt: new Date(),
    });
  }

  private createActiveCOMReplacement(
    index: number | string,
    sourcePlayer: Pick<RoomPlayer, 'seatId' | 'playerId' | 'team'>,
  ): RoomPlayer {
    return this.createCOMPlaceholder(
      index,
      sourcePlayer.team,
      [],
      resolveSeatId(sourcePlayer),
    );
  }

  private cloneRoomPlayer(player: RoomPlayer): RoomPlayer {
    return {
      ...player,
      socketId: '',
      joinedAt: new Date(player.joinedAt),
    };
  }

  private cloneGamePlayer(player: DomainPlayer): DomainPlayer {
    return toDomainPlayer(player);
  }

  async initCOMPlaceholders(
    roomId: string,
    room: Room,
    gameState: GameStateService,
  ): Promise<void> {
    void roomId;
    const state = gameState.getState();
    const capacity = room.settings?.maxPlayers ?? 4;
    const actualCount = room.players.filter((player) => !player.isCOM).length;
    const placeholderCount = room.players.filter(
      (player) => player.isCOM && !player.isReady,
    ).length;
    const slotsToFill = capacity - actualCount - placeholderCount;
    let rosterChanged = false;

    for (let i = 0; i < slotsToFill; i++) {
      const idx = actualCount + placeholderCount + i;
      const team0Count = room.players.filter(
        (player) => player.team === 0,
      ).length;
      const team1Count = room.players.filter(
        (player) => player.team === 1,
      ).length;
      const team = (team0Count <= team1Count ? 0 : 1) as Team;
      const placeholder = this.createCOMPlaceholder(idx, team);
      upsertRuntimeSeat(room, state, placeholder);
      gameState.registerPlayerToken(placeholder.playerId, placeholder.playerId);
      rosterChanged = true;
    }

    if (rosterChanged) {
      await gameState.persistRoster(room.players, room.hostId);
    }
  }

  async fillVacantSeatsWithCOM(
    roomId: string,
    room: Room,
    gameState: GameStateService,
  ): Promise<void> {
    void roomId;
    const state = gameState.getState();
    room.players.forEach((roomPlayer) => {
      if (!roomPlayer.isCOM) {
        return;
      }
      roomPlayer.isReady = true;
      const statePlayer = state.players.find(
        (player) => player.playerId === roomPlayer.playerId,
      );
      upsertRuntimeSeat(room, state, roomPlayer, {
        gameplaySource: statePlayer ? { ...statePlayer, isCOM: true } : null,
      });
    });

    const maxPlayers = room.settings?.maxPlayers ?? 4;
    if (room.players.length >= maxPlayers) {
      await gameState.persistRoster(room.players, room.hostId);
      return;
    }

    const comCount = maxPlayers - room.players.length;
    const existingTeam0Count = room.players.filter(
      (player) => player.team === 0,
    ).length;
    const team0Needed = Math.max(0, 2 - existingTeam0Count);
    const startingPlayerCount = room.players.length;

    for (let i = 0; i < comCount; i++) {
      const team = i < team0Needed ? (0 as Team) : (1 as Team);
      const comPlayer = this.comPlayerService.createComPlayer(
        startingPlayerCount + i,
        team,
      );
      const seatId = asSeatId(randomUUID());
      const roomComPlayer = toRoomPlayer({
        session: {
          socketId: `com-${startingPlayerCount + i}`,
          seatId,
          playerId: seatId,
          name: comPlayer.name,
        },
        participantKey: comPlayer.playerId,
        gameplay: {
          ...comPlayer,
          seatId,
          playerId: seatId,
        },
        isReady: true,
        isHost: false,
        joinedAt: new Date(),
      });

      upsertRuntimeSeat(room, state, roomComPlayer);
      gameState.registerPlayerToken(
        roomComPlayer.playerId,
        roomComPlayer.playerId,
      );
    }

    await gameState.persistRoster(room.players, room.hostId);
  }

  async convertPlayerToCOM(
    roomId: string,
    playerId: string,
    room: Room,
    gameState: GameStateService,
    vacantSeats: VacantSeats,
    membershipMutation?: RosterMembershipMutation,
  ): Promise<boolean> {
    const playerIndex = room.players.findIndex(
      (player) => player.playerId === playerId,
    );
    if (playerIndex === -1) {
      return false;
    }

    if (!vacantSeats[roomId]) {
      vacantSeats[roomId] = {};
    }

    const state = gameState.getState();
    const gsIndex = state.players.findIndex(
      (player) => player.playerId === playerId,
    );

    const uniqueIdx = `timeout-${playerIndex}-${Date.now()}`;
    const comPlayer = this.createActiveCOMReplacement(
      uniqueIdx,
      room.players[playerIndex],
    );
    if (membershipMutation?.type === 'complete-disconnect-timeout') {
      comPlayer.userId = room.players[playerIndex].userId;
      comPlayer.isAuthenticated = room.players[playerIndex].isAuthenticated;
      comPlayer.participantKey = room.players[playerIndex].participantKey;
    }

    vacantSeats[roomId][playerIndex] = {
      roomPlayer: this.cloneRoomPlayer(room.players[playerIndex]),
      gamePlayer:
        gsIndex !== -1
          ? this.cloneGamePlayer(state.players[gsIndex])
          : undefined,
      replacementPlayerId: comPlayer.playerId,
    };

    upsertRuntimeSeat(room, state, comPlayer, {
      replaceSeatId: playerId,
      gameplaySource: gsIndex === -1 ? null : state.players[gsIndex],
    });

    await gameState.persistRoster(
      room.players,
      room.hostId,
      membershipMutation,
    );
    return true;
  }
}
