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
import { asSeatId } from '../types/identity.types';
import type { SeatId } from '../types/identity.types';
import { RosterMembershipMutation } from '../types/room-membership.types';
import {
  resolveCurrentPlayerIndex,
  setCurrentSeat,
} from '../domain/current-turn';
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
        (player) => player.seatId === existingPlayer.seatId,
      );
      const isWaitingRoom =
        state.gamePhase === null || state.gamePhase === 'waiting';
      if (!statePlayer && !isWaitingRoom) {
        return false;
      }

      const reclaimingVacantSeatId = Object.entries(
        vacantSeats[roomId] ?? {},
      ).find(([seatId, seatData]) => {
        if (seatId !== existingPlayer.seatId) {
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
        seatId: existingPlayer.seatId,
        participantKey:
          user.userId ?? existingPlayer.participantKey ?? user.seatId,
        userId: user.userId ?? existingPlayer.userId,
        isAuthenticated: user.isAuthenticated ?? existingPlayer.isAuthenticated,
        isHost: room.hostSeatId === existingPlayer.seatId,
        isCOM: reclaimingCOMSeat ? false : existingPlayer.isCOM,
      };
      upsertRuntimeSeat(room, state, updatedPlayer, {
        gameplaySource: statePlayer,
      });

      gameState.registerSeatToken(updatedPlayer.seatId, updatedPlayer.seatId);
      if (updatedPlayer.userId) {
        gameState.registerSeatToken(updatedPlayer.userId, updatedPlayer.seatId);
      }
      gameState.clearDisconnectTimeout(updatedPlayer.seatId);
      gameState.applyPlayerConnectionState(updatedPlayer.seatId, {
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
    let replacingComSeatId: SeatId | null = null;
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
      gameState.clearDisconnectTimeout(asSeatId(vacantSeatId));
      delete roomVacant[asSeatId(vacantSeatId)];
      if (Object.keys(roomVacant).length === 0) {
        delete vacantSeats[roomId];
      }
    } else {
      const availableVacantEntry = vacantEntries.find(([vacantSeatId]) => {
        const currentSeat = room.players.find(
          (player) => player.seatId === vacantSeatId,
        );
        return Boolean(currentSeat && !currentSeat.userId);
      });

      if (availableVacantEntry) {
        const [vacantSeatId, seatData] = availableVacantEntry;
        assignedIndex = this.resolveVacantSeatIndex(room, vacantSeatId);
        const seatRoomPlayer = seatData.roomPlayer;
        team = seatRoomPlayer.team;

        const originalSeatId = seatRoomPlayer.seatId;
        gameState.removeSeatToken(originalSeatId);
        gameState.clearDisconnectTimeout(originalSeatId);

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
          const comSeatId = room.players[comIndex].seatId;
          team = room.players[comIndex].team;
          replacingComSeatId = comSeatId;
          assignedIndex = comIndex;
          gsAssignedIndex = state.players.findIndex(
            (player) => player.seatId === comSeatId,
          );
        }
      }

      if (assignedIndex === -1 && replacingComSeatId === null) {
        const team0Count = room.players.filter(
          (player) => !player.isCOM && player.team === 0,
        ).length;
        const team1Count = room.players.filter(
          (player) => !player.isCOM && player.team === 1,
        ).length;
        team = (team0Count <= team1Count ? 0 : 1) as Team;
      }

      if (!replacingComSeatId && assignedIndex === -1) {
        const waitingComIndex = room.players.findIndex(
          (player) => this.isReplaceableCOMSeat(player) && !player.isReady,
        );
        if (waitingComIndex !== -1) {
          replacingComSeatId = room.players[waitingComIndex].seatId;
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
      replacingComSeatId = room.players[assignedIndex]?.seatId ?? null;
    }

    const currentSeatRoomPlayer =
      replacingComSeatId != null
        ? room.players.find((player) => player.seatId === replacingComSeatId)
        : assignedIndex !== -1
          ? room.players[assignedIndex]
          : undefined;
    const assignedSeatId = currentSeatRoomPlayer
      ? currentSeatRoomPlayer.seatId
      : seatRoomSnapshot
        ? seatRoomSnapshot.seatId
        : asSeatId(randomUUID());
    const player: RoomPlayer = {
      ...(seatRoomSnapshot ?? {}),
      ...user,
      socketId: user.socketId,
      seatId: assignedSeatId,
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

    if (gsAssignedIndex === -1 && replacingComSeatId) {
      gsAssignedIndex = state.players.findIndex(
        (statePlayer) => statePlayer.seatId === replacingComSeatId,
      );
    }

    const currentSeatGamePlayer =
      replacingComSeatId != null
        ? state.players.find(
            (statePlayer) => statePlayer.seatId === replacingComSeatId,
          )
        : undefined;

    upsertRuntimeSeat(room, state, player, {
      replaceSeatId: replacingComSeatId ?? player.seatId,
      gameplaySource:
        currentSeatGamePlayer ??
        seatGameSnapshot ??
        (gsAssignedIndex === -1 ? null : state.players[gsAssignedIndex]),
    });

    gameState.registerSeatToken(player.seatId, player.seatId);
    if (player.userId) {
      gameState.registerSeatToken(player.userId, player.seatId);
    }
    gameState.applyPlayerConnectionState(player.seatId, {
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
    return room.players.findIndex((player) => player.seatId === vacantSeatId);
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
