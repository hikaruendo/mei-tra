import { Injectable } from '@nestjs/common';
import { BlowState, DomainPlayer, GameState, Team } from '../types/game.types';
import { Room, RoomPlayer } from '../types/room.types';
import { GameStateService } from './game-state.service';
import type {
  VacantSeats,
  VacantSeatSnapshot,
} from '../types/vacant-seat.types';
import { SessionUser } from '../types/session.types';
import { randomUUID } from 'crypto';
import { asSeatId, resolveSeatId } from '../types/identity.types';
import { RosterMembershipMutation } from '../types/room-membership.types';
import {
  resolveCurrentPlayerIndex,
  setCurrentSeat,
} from '../types/current-turn';
import { upsertRuntimeSeat } from './runtime-seat-roster';

interface JoinRoomParams {
  roomId: string;
  room: Room;
  gameState: GameStateService;
  user: SessionUser;
  vacantSeats: VacantSeats;
}

type RestoredSeatData = VacantSeatSnapshot;

@Injectable()
export class RoomJoinService {
  async joinRoom({
    roomId,
    room,
    gameState,
    user,
    vacantSeats,
  }: JoinRoomParams): Promise<boolean> {
    const state = gameState.getState();

    const existingPlayer = this.findExistingRoomPlayer(room.players, user);
    if (existingPlayer) {
      const statePlayer = state.players.find(
        (player) => player.playerId === existingPlayer.playerId,
      );
      const isWaitingRoom =
        state.gamePhase === null || state.gamePhase === 'waiting';
      if (!statePlayer && !isWaitingRoom) {
        return false;
      }

      const reclaimingVacantSeatId = Object.entries(
        vacantSeats[roomId] ?? {},
      ).find(([seatId, seatData]) => {
        if (seatId !== existingPlayer.playerId) {
          return false;
        }
        return user.userId
          ? seatData.roomPlayer.userId === user.userId
          : seatData.roomPlayer.seatId === user.seatId;
      })?.[0];
      const reclaimingCOMSeat = Boolean(
        existingPlayer.isCOM &&
          ((user.userId && existingPlayer.userId === user.userId) ||
            reclaimingVacantSeatId !== undefined),
      );
      const updatedPlayer: RoomPlayer = {
        ...existingPlayer,
        ...user,
        seatId: resolveSeatId(existingPlayer),
        playerId: resolveSeatId(existingPlayer),
        participantKey:
          user.userId ?? existingPlayer.participantKey ?? user.seatId,
        userId: user.userId ?? existingPlayer.userId,
        isAuthenticated: user.isAuthenticated ?? existingPlayer.isAuthenticated,
        isHost: room.hostSeatId === existingPlayer.playerId,
        isCOM: reclaimingCOMSeat ? false : existingPlayer.isCOM,
      };
      upsertRuntimeSeat(room, state, updatedPlayer, {
        gameplaySource: statePlayer,
      });

      gameState.registerPlayerToken(
        updatedPlayer.playerId,
        updatedPlayer.playerId,
      );
      if (updatedPlayer.userId) {
        gameState.registerPlayerToken(
          updatedPlayer.userId,
          updatedPlayer.playerId,
        );
      }
      gameState.clearDisconnectTimeout(updatedPlayer.playerId);
      await gameState.applyPlayerConnectionState(updatedPlayer.playerId, {
        socketId: updatedPlayer.socketId,
        userId: updatedPlayer.userId,
        isAuthenticated: updatedPlayer.isAuthenticated,
      });
      await gameState.persistRoster(
        room.players,
        room.hostSeatId,
        this.buildMembershipClaim(user),
      );
      if (reclaimingVacantSeatId !== undefined) {
        delete vacantSeats[roomId][asSeatId(reclaimingVacantSeatId)];
        if (Object.keys(vacantSeats[roomId] ?? {}).length === 0) {
          delete vacantSeats[roomId];
        }
      }
      if (this.advanceBlowTurnPastActedPlayer(gameState.getState())) {
        await gameState.saveState();
      }
      return true;
    }

    if (this.countActualPlayers(room.players) >= room.settings.maxPlayers) {
      return false;
    }

    const roomVacant = vacantSeats[roomId] || {};
    const vacantEntries = Object.entries(roomVacant);
    let assignedIndex = -1;
    let gsAssignedIndex = -1;
    let team: Team = 0;
    let replacingComId: string | null = null;
    let restoredSeatData: RestoredSeatData | null = null;

    const matchingVacantEntry = vacantEntries.find(
      ([, seatData]) =>
        user.seatId != null && seatData.roomPlayer.seatId === user.seatId,
    );

    if (matchingVacantEntry) {
      const [vacantSeatId, seatData] = matchingVacantEntry;
      assignedIndex = this.resolveVacantSeatIndex(room, vacantSeatId);
      if (assignedIndex === -1) {
        return false;
      }
      const seatRoomPlayer = seatData.roomPlayer;

      team = seatRoomPlayer ? seatRoomPlayer.team : team;
      restoredSeatData = seatData;
      gameState.clearDisconnectTimeout(vacantSeatId);
      delete roomVacant[asSeatId(vacantSeatId)];
      if (Object.keys(roomVacant).length === 0) {
        delete vacantSeats[roomId];
      }
    } else {
      const availableVacantEntry = vacantEntries.find(([vacantSeatId]) => {
        const currentSeat = room.players.find(
          (player) => player.playerId === vacantSeatId,
        );
        return Boolean(currentSeat && !currentSeat.userId);
      });

      if (availableVacantEntry) {
        const [vacantSeatId, seatData] = availableVacantEntry;
        assignedIndex = this.resolveVacantSeatIndex(room, vacantSeatId);
        const seatRoomPlayer = seatData.roomPlayer;
        team = seatRoomPlayer.team;

        const originalPlayerId = seatRoomPlayer.playerId;
        gameState.removePlayerToken(originalPlayerId);
        gameState.clearDisconnectTimeout(originalPlayerId);

        restoredSeatData = seatData;
        delete roomVacant[asSeatId(vacantSeatId)];
        if (Object.keys(roomVacant).length === 0) {
          delete vacantSeats[roomId];
        }
      }
    }

    if (assignedIndex === -1) {
      if (state.gamePhase !== null) {
        const comIndex = room.players.findIndex((player) =>
          this.isReplaceableCOMSeat(player),
        );
        if (comIndex !== -1) {
          const comPlayerId = room.players[comIndex].playerId;
          team = room.players[comIndex].team;
          replacingComId = comPlayerId;
          assignedIndex = comIndex;
          gsAssignedIndex = state.players.findIndex(
            (player) => player.playerId === comPlayerId,
          );
        }
      }

      if (assignedIndex === -1 && replacingComId === null) {
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
          (player) => this.isReplaceableCOMSeat(player) && !player.isReady,
        );
        if (waitingComIndex !== -1) {
          replacingComId = room.players[waitingComIndex].playerId;
          assignedIndex = waitingComIndex;
        }
      }
    }

    if (
      assignedIndex === -1 &&
      room.players.length >= room.settings.maxPlayers
    ) {
      return false;
    }

    const seatRoomSnapshot = restoredSeatData?.roomPlayer;
    const seatGameSnapshot = restoredSeatData?.gamePlayer;

    if (assignedIndex !== -1) {
      replacingComId = room.players[assignedIndex]?.playerId || null;
    }

    const currentSeatRoomPlayer =
      replacingComId != null
        ? room.players.find((player) => player.playerId === replacingComId)
        : assignedIndex !== -1
          ? room.players[assignedIndex]
          : undefined;
    const assignedSeatId = currentSeatRoomPlayer
      ? resolveSeatId(currentSeatRoomPlayer)
      : seatRoomSnapshot
        ? resolveSeatId(seatRoomSnapshot)
        : asSeatId(randomUUID());
    const player: RoomPlayer = {
      ...(seatRoomSnapshot ?? {}),
      ...user,
      socketId: user.socketId,
      seatId: assignedSeatId,
      playerId: assignedSeatId,
      participantKey: user.userId ?? user.seatId ?? assignedSeatId,
      team: currentSeatRoomPlayer?.team ?? team,
      hand: [],
      isPasser: false,
      hasBroken: false,
      hasRequiredBroken: false,
      isReady:
        currentSeatRoomPlayer?.isReady ?? seatRoomSnapshot?.isReady ?? false,
      isHost: room.hostSeatId === assignedSeatId,
      isCOM: false,
      joinedAt: seatRoomSnapshot?.joinedAt
        ? new Date(seatRoomSnapshot.joinedAt)
        : new Date(),
    };

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

    upsertRuntimeSeat(room, state, player, {
      replaceSeatId: replacingComId ?? player.playerId,
      gameplaySource:
        currentSeatGamePlayer ??
        seatGameSnapshot ??
        (gsAssignedIndex === -1 ? null : state.players[gsAssignedIndex]),
    });

    gameState.registerPlayerToken(player.playerId, player.playerId);
    if (player.userId) {
      gameState.registerPlayerToken(player.userId, player.playerId);
    }
    await gameState.applyPlayerConnectionState(player.playerId, {
      socketId: player.socketId,
      userId: player.userId,
      isAuthenticated: player.isAuthenticated,
    });
    await gameState.persistRoster(
      room.players,
      room.hostSeatId,
      this.buildMembershipClaim(user),
    );
    const persistedState = gameState.getState();
    const advancedBlowTurn =
      this.advanceBlowTurnPastActedPlayer(persistedState);
    if (advancedBlowTurn) {
      await gameState.saveState();
    }
    return true;
  }

  private countActualPlayers(players: RoomPlayer[]): number {
    return players.filter((player) => !player.isCOM).length;
  }

  private resolveVacantSeatIndex(room: Room, vacantSeatId: string): number {
    return room.players.findIndex((player) => player.playerId === vacantSeatId);
  }

  private buildMembershipClaim(
    user: SessionUser,
  ): RosterMembershipMutation | undefined {
    return user.userId
      ? {
          type: 'claim',
          userId: user.userId,
          transitionId: randomUUID(),
        }
      : undefined;
  }

  private findExistingRoomPlayer(
    players: RoomPlayer[],
    user: SessionUser,
  ): RoomPlayer | undefined {
    if (user.userId) {
      const playerByUserId = players.find(
        (player) => player.userId === user.userId,
      );
      if (playerByUserId) {
        return playerByUserId;
      }
    }

    return players.find((player) => player.seatId === user.seatId);
  }

  private isReplaceableCOMSeat(player: RoomPlayer): boolean {
    return player.isCOM === true && !player.userId;
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
        setCurrentSeat(state, candidatePlayer.playerId);
        return true;
      }
    }

    return false;
  }

  private hasActedInBlow(blowState: BlowState, player: DomainPlayer): boolean {
    return (
      player.isPasser ||
      blowState.declarations.some(
        (declaration) => declaration.seatId === player.playerId,
      ) ||
      (blowState.actionHistory ?? []).some(
        (action) => action.seatId === player.playerId,
      )
    );
  }
}
