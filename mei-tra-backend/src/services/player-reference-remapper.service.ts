import { Injectable } from '@nestjs/common';
import { GameState } from '../types/game.types';

@Injectable()
export class PlayerReferenceRemapperService {
  remapPlayStatePlayerIdReferences(
    state: GameState,
    fromPlayerId: string,
    toPlayerId: string,
  ): void {
    const playState = state.playState;
    if (!playState || fromPlayerId === toPlayerId) {
      return;
    }

    if (playState.currentField?.dealerId === fromPlayerId) {
      playState.currentField.dealerId = toPlayerId;
    }

    if (playState.lastWinnerId === fromPlayerId) {
      playState.lastWinnerId = toPlayerId;
    }

    if (playState.openDeclarerId === fromPlayerId) {
      playState.openDeclarerId = toPlayerId;
    }

    playState.fields = playState.fields.map((field) => ({
      ...field,
      winnerId: field.winnerId === fromPlayerId ? toPlayerId : field.winnerId,
      dealerId: field.dealerId === fromPlayerId ? toPlayerId : field.dealerId,
    }));

    if (playState.neguri[fromPlayerId]) {
      playState.neguri[toPlayerId] = playState.neguri[fromPlayerId];
      delete playState.neguri[fromPlayerId];
    }
  }

  remapBlowStatePlayerIdReferences(
    state: GameState,
    fromPlayerId: string,
    toPlayerId: string,
  ): void {
    const blowState = state.blowState;
    if (!blowState || fromPlayerId === toPlayerId) {
      return;
    }

    blowState.declarations = blowState.declarations.map((declaration) =>
      declaration.playerId === fromPlayerId
        ? { ...declaration, playerId: toPlayerId }
        : declaration,
    );

    blowState.actionHistory = blowState.actionHistory.map((action) =>
      action.playerId === fromPlayerId
        ? { ...action, playerId: toPlayerId }
        : action,
    );

    if (blowState.currentHighestDeclaration?.playerId === fromPlayerId) {
      blowState.currentHighestDeclaration = {
        ...blowState.currentHighestDeclaration,
        playerId: toPlayerId,
      };
    }

    if (blowState.lastPasser === fromPlayerId) {
      blowState.lastPasser = toPlayerId;
    }
  }

  remapGameStatePlayerIdReferences(
    state: GameState,
    fromPlayerId: string,
    toPlayerId: string,
  ): void {
    this.remapPlayStatePlayerIdReferences(state, fromPlayerId, toPlayerId);
    this.remapBlowStatePlayerIdReferences(state, fromPlayerId, toPlayerId);
  }
}
