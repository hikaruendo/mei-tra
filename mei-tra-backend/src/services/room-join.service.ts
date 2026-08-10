import { Injectable } from '@nestjs/common';
import { BlowState, DomainPlayer, GameState, Team } from '../types/game.types';
import { toDomainPlayer } from '../types/player-adapters';
import { Room, RoomPlayer } from '../types/room.types';
import { GameStateService } from './game-state.service';
import { VacantSeats } from './com-session.service';
import { SessionUser } from '../types/session.types';
import { randomUUID } from 'crypto';
import { asSeatId, resolveSeatId } from '../types/identity.types';
import { RosterMembershipMutation } from '../types/room-membership.types';

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
  async joinRoom({
    roomId,
    room,
    gameState,
    user,
    vacantSeats,
  }: JoinRoomParams): Promise<boolean> {
    void roomId;
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

      const updatedPlayer: RoomPlayer = {
        ...existingPlayer,
        ...user,
        seatId: resolveSeatId(existingPlayer),
        playerId: resolveSeatId(existingPlayer),
        participantKey:
          user.userId ?? existingPlayer.participantKey ?? user.playerId,
        userId: user.userId ?? existingPlayer.userId,
        isAuthenticated: user.isAuthenticated ?? existingPlayer.isAuthenticated,
        isHost: room.hostId === existingPlayer.playerId,
      };
      Object.assign(existingPlayer, updatedPlayer);
      if (statePlayer) {
        statePlayer.name = updatedPlayer.name;
        statePlayer.team = updatedPlayer.team;
      } else {
        state.players.push(toDomainPlayer(updatedPlayer));
      }
      state.teamAssignments[updatedPlayer.playerId] = updatedPlayer.team;

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
        room.hostId,
        this.buildMembershipClaim(user),
      );
      if (this.advanceBlowTurnPastActedPlayer(gameState.getState())) {
        await gameState.saveState();
      }
      return true;
    }

    if (this.countActualPlayers(room.players) >= room.settings.maxPlayers) {
      return false;
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
      participantKey: user.userId ?? user.playerId,
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
      isHost: room.hostId === assignedSeatId,
      joinedAt: seatRoomSnapshot?.joinedAt
        ? new Date(seatRoomSnapshot.joinedAt)
        : new Date(),
    };

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

    state.teamAssignments[player.playerId] = player.team;

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
      room.hostId,
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
        (player) => !player.isCOM && player.userId === user.userId,
      );
      if (playerByUserId) {
        return playerByUserId;
      }
    }

    return players.find((player) => player.playerId === user.playerId);
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
