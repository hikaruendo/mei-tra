import { Inject, Injectable } from '@nestjs/common';
import { DomainPlayer, Team } from '../types/game.types';
import { toDomainPlayer, toRoomPlayer } from '../types/player-adapters';
import { Room, RoomPlayer } from '../types/room.types';
import { IComPlayerService } from './interfaces/com-player-service.interface';
import { GameStateService } from './game-state.service';
import { PlayerReferenceRemapperService } from './player-reference-remapper.service';

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
    private readonly playerReferenceRemapper: PlayerReferenceRemapperService,
  ) {}

  private createCOMPlaceholder(
    index: number | string,
    team: Team,
    hand: string[] = [],
  ): RoomPlayer {
    const idStr = String(index);
    return toRoomPlayer({
      session: {
        socketId: `com-${idStr}`,
        playerId: `com-${idStr}`,
        name: 'COM',
      },
      gameplay: {
        playerId: `com-${idStr}`,
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
    sourcePlayer: Pick<
      DomainPlayer,
      'team' | 'isPasser' | 'hasBroken' | 'hasRequiredBroken'
    >,
    hand: string[] = [],
  ): RoomPlayer {
    const comPlayer = this.createCOMPlaceholder(index, sourcePlayer.team, hand);
    comPlayer.isPasser = sourcePlayer.isPasser;
    comPlayer.hasBroken = sourcePlayer.hasBroken ?? false;
    comPlayer.hasRequiredBroken = sourcePlayer.hasRequiredBroken ?? false;
    return comPlayer;
  }

  private cloneRoomPlayer(player: RoomPlayer): RoomPlayer {
    return {
      ...player,
      socketId: '',
      hand: [...player.hand],
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
      room.players.push(placeholder);
      state.players.push(toDomainPlayer(placeholder));
      state.teamAssignments[placeholder.playerId] = placeholder.team;
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
    const lobbyComPlaceholders = room.players.filter((player) => player.isCOM);

    const placeholderIds = new Set(
      lobbyComPlaceholders.map((player) => player.playerId),
    );
    room.players = room.players.filter(
      (player) => !placeholderIds.has(player.playerId),
    );
    const state = gameState.getState();
    state.players = state.players.filter(
      (player) => !placeholderIds.has(player.playerId),
    );
    placeholderIds.forEach((playerId) => {
      delete state.teamAssignments[playerId];
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
      const roomComPlayer = toRoomPlayer({
        session: {
          socketId: `com-${startingPlayerCount + i}`,
          playerId: comPlayer.playerId,
          name: comPlayer.name,
        },
        gameplay: comPlayer,
        isReady: true,
        isHost: false,
        joinedAt: new Date(),
      });

      room.players.push(roomComPlayer);
      state.players.push(toDomainPlayer(comPlayer));
      state.teamAssignments[roomComPlayer.playerId] = roomComPlayer.team;
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

    const originalHand = room.players[playerIndex].hand ?? [];
    const uniqueIdx = `timeout-${playerIndex}-${Date.now()}`;
    const comPlayer = this.createActiveCOMReplacement(
      uniqueIdx,
      room.players[playerIndex],
      [...originalHand],
    );

    vacantSeats[roomId][playerIndex] = {
      roomPlayer: this.cloneRoomPlayer(room.players[playerIndex]),
      gamePlayer:
        gsIndex !== -1
          ? this.cloneGamePlayer(state.players[gsIndex])
          : undefined,
      replacementPlayerId: comPlayer.playerId,
    };

    room.players[playerIndex] = comPlayer;

    if (gsIndex !== -1) {
      const originalGameHand = state.players[gsIndex].hand ?? [];
      const comGamePlayer = this.createActiveCOMReplacement(
        uniqueIdx,
        state.players[gsIndex],
        [...originalGameHand],
      );
      state.players[gsIndex] = toDomainPlayer(comGamePlayer);
      this.playerReferenceRemapper.remapGameStatePlayerIdReferences(
        state,
        playerId,
        comGamePlayer.playerId,
      );
      if (state.teamAssignments[playerId] != null) {
        delete state.teamAssignments[playerId];
      }
      state.teamAssignments[comGamePlayer.playerId] = comGamePlayer.team;
    }

    await gameState.persistRoster(room.players, room.hostId);
    if (gsIndex !== -1) {
      // persistRoster swaps in a fresh state from its DB round-trip, and that
      // round-trip carries the stored playState back verbatim — discarding the
      // remap above. Re-apply it to the refreshed state before persisting.
      this.playerReferenceRemapper.remapGameStatePlayerIdReferences(
        gameState.getState(),
        playerId,
        comPlayer.playerId,
      );
      await gameState.saveState();
    }
    return true;
  }
}
