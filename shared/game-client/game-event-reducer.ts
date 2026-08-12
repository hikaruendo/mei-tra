import type {
  BlowStartedPayload,
  BlowStateContract,
  BlowUpdatedPayload,
  BrokenPayload,
  CardPlayedPayload,
  CompletedFieldContract,
  FieldCompletePayload,
  FieldContract,
  GameStartedPayload,
  GameStatePayload,
  NewRoundStartedPayload,
  PlayerContract,
  PlaySetupCompletePayload,
  RevealAgariPayload,
  RoundCancelledPayload,
  RoundResultsPayload,
  TransportGamePhase,
  TransportTeamScores,
  UpdatePhasePayload,
  UpdateTurnPayload,
} from '@meitra/contracts/game';
import type { SeatId } from '@meitra/contracts/ids';
import {
  type CanonicalBlowState,
  type CanonicalCompletedFieldContract,
  type CanonicalFieldContract,
  type CanonicalPlayerContract,
  normalizeBlowActionIdentity,
  normalizeBlowDeclarationIdentity,
  normalizeCompletedFieldIdentity,
  normalizeFieldIdentity,
  normalizeGameStateIdentity,
  normalizePlayerIdentities,
} from './identity';

export interface GameEventState {
  players: Array<CanonicalPlayerContract<PlayerContract>>;
  gamePhase: TransportGamePhase;
  currentTurnSeatId: SeatId | null;
  currentField: CanonicalFieldContract | null;
  blowState: CanonicalBlowState;
  teamScores: TransportTeamScores;
  negriCard: string | null;
  negriSeatId: SeatId | null;
  revealedAgari: string | null;
  fields: CanonicalCompletedFieldContract[];
}

export type GameServerEvent =
  | { type: 'update-phase'; payload: UpdatePhasePayload }
  | { type: 'update-turn'; payload: UpdateTurnPayload }
  | { type: 'blow-started'; payload: BlowStartedPayload }
  | { type: 'blow-updated'; payload: BlowUpdatedPayload }
  | { type: 'broken'; payload: BrokenPayload }
  | { type: 'round-cancelled'; payload: RoundCancelledPayload }
  | { type: 'reveal-agari'; payload: RevealAgariPayload }
  | { type: 'play-setup-complete'; payload: PlaySetupCompletePayload }
  | { type: 'card-played'; payload: CardPlayedPayload }
  | { type: 'field-updated'; payload: FieldContract }
  | { type: 'field-complete'; payload: FieldCompletePayload }
  | { type: 'round-results'; payload: RoundResultsPayload }
  | { type: 'new-round-started'; payload: NewRoundStartedPayload };

interface GameEventContext {
  selfSeatId?: string | null;
}

export const createEmptyBlowState = (): CanonicalBlowState => ({
  currentTrump: null,
  currentHighestDeclaration: null,
  declarations: [],
  actionHistory: [],
  lastPasserSeatId: null,
  lastPasser: null,
  isRoundCancelled: false,
  currentBlowIndex: 0,
});

export const createEmptyGameEventState = (): GameEventState => ({
  players: [],
  gamePhase: null,
  currentTurnSeatId: null,
  currentField: null,
  blowState: createEmptyBlowState(),
  teamScores: {
    0: { play: 0, total: 0 },
    1: { play: 0, total: 0 },
  },
  negriCard: null,
  negriSeatId: null,
  revealedAgari: null,
  fields: [],
});

export const createGameEventStateFromSnapshot = (
  payload: GameStatePayload,
): GameEventState => {
  const normalized = normalizeGameStateIdentity(payload);
  return {
    players: normalized.players,
    gamePhase: normalized.gamePhase,
    currentTurnSeatId: normalized.currentTurnSeatId,
    currentField: normalized.currentField,
    blowState: normalized.blowState,
    teamScores: normalized.teamScores,
    negriCard: normalized.negriCard,
    negriSeatId: normalized.negriSeatId,
    revealedAgari: normalized.revealedAgari ?? null,
    fields: dedupeCompletedFields(normalized.fields),
  };
};

export const createGameEventStateFromStartedGame = (
  payload: GameStartedPayload,
): GameEventState => ({
  ...createEmptyGameEventState(),
  players: normalizePlayerIdentities(payload.players),
  gamePhase: 'blow',
});

export const dedupeCompletedFields = (
  fields: CompletedFieldContract[],
): CanonicalCompletedFieldContract[] => {
  const seen = new Set<string>();
  return fields.map(normalizeCompletedFieldIdentity).filter((field) => {
    const key = [
      field.dealerId,
      field.winnerId,
      field.winnerTeam,
      field.cards.join(','),
    ].join('|');
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const createEmptyField = (dealerSeatId: SeatId): CanonicalFieldContract => ({
  cards: [],
  playedBy: [],
  playedBySeatIds: [],
  baseCard: '',
  dealerSeatId,
  dealerId: dealerSeatId,
  isComplete: false,
});

export const reduceGameEvent = (
  state: GameEventState,
  event: GameServerEvent,
  context: GameEventContext = {},
): GameEventState => {
  switch (event.type) {
    case 'update-phase': {
      const { phase, scores, currentHighestDeclaration } = event.payload;
      const highest = currentHighestDeclaration
        ? normalizeBlowDeclarationIdentity(currentHighestDeclaration)
        : state.blowState.currentHighestDeclaration;
      return {
        ...state,
        gamePhase: phase,
        teamScores: scores,
        blowState: {
          ...state.blowState,
          currentTrump: phase === 'play' ? (highest?.trumpType ?? null) : null,
          currentHighestDeclaration: highest,
        },
      };
    }
    case 'update-turn': {
      return {
        ...state,
        currentTurnSeatId: event.payload,
      };
    }
    case 'blow-started': {
      return {
        ...state,
        players: normalizePlayerIdentities(event.payload.players),
        gamePhase: 'blow',
        currentTurnSeatId: event.payload.startingSeatId,
      };
    }
    case 'blow-updated': {
      const lastPasserSeatId = event.payload.lastPasserSeatId;
      return {
        ...state,
        blowState: {
          ...state.blowState,
          declarations: event.payload.declarations.map(
            normalizeBlowDeclarationIdentity,
          ),
          actionHistory: (event.payload.actionHistory ?? []).map(
            normalizeBlowActionIdentity,
          ),
          currentHighestDeclaration: event.payload.currentHighest
            ? normalizeBlowDeclarationIdentity(event.payload.currentHighest)
            : null,
          lastPasserSeatId,
          lastPasser: lastPasserSeatId,
        },
      };
    }
    case 'broken': {
      return {
        ...state,
        players: normalizePlayerIdentities(event.payload.players),
        gamePhase: event.payload.gamePhase ?? 'blow',
        currentTurnSeatId: event.payload.nextSeatId,
        currentField: null,
        blowState: createEmptyBlowState(),
        negriCard: null,
        negriSeatId: null,
        revealedAgari: null,
        fields: [],
      };
    }
    case 'round-cancelled': {
      const currentTurnSeatId = event.payload.nextDealerSeatId;
      return {
        ...state,
        players: normalizePlayerIdentities(event.payload.players),
        gamePhase: 'blow',
        currentTurnSeatId,
        currentField: null,
        blowState: {
          ...createEmptyBlowState(),
          currentTrump: event.payload.currentTrump ?? null,
          currentHighestDeclaration: event.payload.currentHighestDeclaration
            ? normalizeBlowDeclarationIdentity(
                event.payload.currentHighestDeclaration,
              )
            : null,
          declarations: (event.payload.blowDeclarations ?? []).map(
            normalizeBlowDeclarationIdentity,
          ),
          actionHistory: (event.payload.actionHistory ?? []).map(
            normalizeBlowActionIdentity,
          ),
        },
        negriCard: null,
        negriSeatId: null,
        revealedAgari: null,
        fields: [],
      };
    }
    case 'reveal-agari': {
      return { ...state, revealedAgari: event.payload.agari };
    }
    case 'play-setup-complete': {
      const startingSeatId = event.payload.startingSeatId;
      const selfSeatId = context.selfSeatId;
      return {
        ...state,
        players: selfSeatId
          ? state.players.map((player) =>
              player.playerId === selfSeatId
                ? {
                    ...player,
                    hand: player.hand.filter(
                      (card) => card !== event.payload.negriCard,
                    ),
                  }
                : player,
            )
          : state.players,
        currentTurnSeatId: startingSeatId,
        negriCard: event.payload.negriCard,
        negriSeatId: startingSeatId,
        revealedAgari: null,
        blowState: {
          ...state.blowState,
          currentTrump:
            state.blowState.currentHighestDeclaration?.trumpType ?? null,
        },
      };
    }
    case 'card-played': {
      const players = normalizePlayerIdentities(event.payload.players);
      const currentField = normalizeFieldIdentity(event.payload.field);
      return {
        ...state,
        players,
        currentField,
        currentTurnSeatId:
          event.payload.nextSeatId ?? state.currentTurnSeatId,
      };
    }
    case 'field-updated': {
      return { ...state, currentField: normalizeFieldIdentity(event.payload) };
    }
    case 'field-complete': {
      const field = normalizeCompletedFieldIdentity(event.payload.field);
      const nextSeatId = event.payload.nextSeatId;
      return {
        ...state,
        currentTurnSeatId: nextSeatId ?? state.currentTurnSeatId,
        currentField: nextSeatId
          ? createEmptyField(nextSeatId)
          : state.currentField,
        fields: dedupeCompletedFields([...state.fields, field]),
      };
    }
    case 'round-results': {
      return { ...state, teamScores: event.payload.scores };
    }
    case 'new-round-started': {
      const currentTurnSeatId = event.payload.currentTurnSeatId;
      const negriSeatId = event.payload.negriSeatId;
      return {
        ...state,
        players: normalizePlayerIdentities(event.payload.players),
        currentTurnSeatId,
        gamePhase: event.payload.gamePhase,
        currentField: event.payload.currentField
          ? normalizeFieldIdentity(event.payload.currentField)
          : null,
        fields: dedupeCompletedFields(event.payload.completedFields),
        negriCard: event.payload.negriCard,
        negriSeatId,
        revealedAgari: event.payload.revealedAgari,
        blowState: {
          ...createEmptyBlowState(),
          currentTrump: event.payload.currentTrump,
          currentHighestDeclaration: event.payload.currentHighestDeclaration
            ? normalizeBlowDeclarationIdentity(
                event.payload.currentHighestDeclaration,
              )
            : null,
          declarations: event.payload.blowDeclarations.map(
            normalizeBlowDeclarationIdentity,
          ),
        },
      };
    }
  }
};
