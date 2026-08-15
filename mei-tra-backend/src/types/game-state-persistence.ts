import {
  BlowAction,
  BlowDeclaration,
  BlowState,
  CompletedField,
  Field,
  PendingBrokenHandReveal,
  PlayState,
} from './game.types';
import { asSeatId, SeatId } from './identity.types';

const SCALAR_SEAT_FIELDS = new Set([
  'seatId',
  'currentSeatId',
  'lastPasserSeatId',
  'negriSeatId',
  'dealerSeatId',
  'winnerSeatId',
  'lastWinnerSeatId',
  'openDeclarerSeatId',
]);

const ARRAY_SEAT_FIELDS = new Set(['playedBySeatIds']);
const SEAT_KEYED_FIELDS = new Set([
  'playerStates',
  'playerNames',
  'neguri',
  'teamAssignments',
]);

export type PersistedBlowDeclaration = Omit<BlowDeclaration, 'seatId'> & {
  seatId: SeatId;
};

export type PersistedBlowAction = Omit<BlowAction, 'seatId'> & {
  seatId: SeatId;
};

export type PersistedBlowState = Omit<
  BlowState,
  | 'currentHighestDeclaration'
  | 'declarations'
  | 'actionHistory'
  | 'lastPasserSeatId'
> & {
  currentHighestDeclaration: PersistedBlowDeclaration | null;
  declarations: PersistedBlowDeclaration[];
  actionHistory: PersistedBlowAction[];
  lastPasserSeatId: SeatId | null;
};

export type PersistedField = Omit<Field, 'playedBy' | 'playedBySeatIds'> & {
  playedBySeatIds: SeatId[];
  dealerSeatId: SeatId;
};

export type PersistedCompletedField = CompletedField;

export type PersistedPlayState = Omit<
  PlayState,
  | 'currentField'
  | 'negriSeatId'
  | 'fields'
  | 'lastWinnerSeatId'
  | 'openDeclarerSeatId'
> & {
  currentField: PersistedField | null;
  negriSeatId: SeatId | null;
  fields: PersistedCompletedField[];
  lastWinnerSeatId: SeatId | null;
  openDeclarerSeatId: SeatId | null;
};

export type PersistedPendingBrokenHandReveal = Omit<
  PendingBrokenHandReveal,
  'seatId'
> & {
  seatId: SeatId;
};

function omitKeys(
  value: object,
  keys: readonly string[],
): Record<string, unknown> {
  const persistedValue: Record<string, unknown> = { ...value };
  keys.forEach((key) => Reflect.deleteProperty(persistedValue, key));
  return persistedValue;
}

function toPersistedBlowDeclaration(
  declaration: BlowDeclaration,
): PersistedBlowDeclaration {
  return {
    ...omitKeys(declaration, ['seatId']),
    seatId: declaration.seatId,
  } as PersistedBlowDeclaration;
}

function toPersistedBlowAction(action: BlowAction): PersistedBlowAction {
  return {
    ...omitKeys(action, ['seatId']),
    seatId: action.seatId,
  } as PersistedBlowAction;
}

export function toPersistedBlowState(blowState: BlowState): PersistedBlowState {
  const lastPasserSeatId = blowState.lastPasserSeatId ?? null;

  return {
    ...omitKeys(blowState, [
      'currentHighestDeclaration',
      'declarations',
      'actionHistory',
      'lastPasserSeatId',
    ]),
    currentHighestDeclaration: blowState.currentHighestDeclaration
      ? toPersistedBlowDeclaration(blowState.currentHighestDeclaration)
      : null,
    declarations: blowState.declarations.map(toPersistedBlowDeclaration),
    actionHistory: blowState.actionHistory.map(toPersistedBlowAction),
    lastPasserSeatId,
  } as PersistedBlowState;
}

function toPersistedField(field: Field): PersistedField {
  return {
    ...omitKeys(field, ['playedBy', 'playedBySeatIds']),
    playedBySeatIds:
      field.playedBySeatIds ?? field.playedBy.map((seatId) => asSeatId(seatId)),
    dealerSeatId: field.dealerSeatId,
  } as PersistedField;
}

function toPersistedCompletedField(
  field: CompletedField,
): PersistedCompletedField {
  return { ...field };
}

export function toPersistedPlayState(
  playState: PlayState | undefined,
): PersistedPlayState | undefined {
  if (!playState) {
    return undefined;
  }

  return {
    ...omitKeys(playState, [
      'currentField',
      'negriSeatId',
      'fields',
      'lastWinnerSeatId',
      'openDeclarerSeatId',
    ]),
    currentField: playState.currentField
      ? toPersistedField(playState.currentField)
      : null,
    negriSeatId: playState.negriSeatId ?? null,
    fields: playState.fields.map(toPersistedCompletedField),
    lastWinnerSeatId: playState.lastWinnerSeatId ?? null,
    openDeclarerSeatId: playState.openDeclarerSeatId ?? null,
  } as PersistedPlayState;
}

export function toPersistedPendingBrokenHandReveal(
  pendingReveal: PendingBrokenHandReveal | null | undefined,
): PersistedPendingBrokenHandReveal | null | undefined {
  if (!pendingReveal) {
    return pendingReveal;
  }

  return {
    ...omitKeys(pendingReveal, ['seatId']),
    seatId: pendingReveal.seatId,
  } as PersistedPendingBrokenHandReveal;
}

export function findUnknownPersistedSeatReferences(
  value: unknown,
  allowedSeatIds: ReadonlySet<string>,
): string[] {
  const references = new Set<string>();

  const visit = (candidate: unknown, parentKey?: string): void => {
    if (Array.isArray(candidate)) {
      candidate.forEach((item) => visit(item, parentKey));
      return;
    }
    if (!candidate || typeof candidate !== 'object') {
      return;
    }

    Object.entries(candidate).forEach(([key, nestedValue]) => {
      if (parentKey && SEAT_KEYED_FIELDS.has(parentKey)) {
        references.add(key);
      }
      if (SCALAR_SEAT_FIELDS.has(key) && typeof nestedValue === 'string') {
        references.add(nestedValue);
      }
      if (ARRAY_SEAT_FIELDS.has(key) && Array.isArray(nestedValue)) {
        nestedValue.forEach((seatId) => {
          if (typeof seatId === 'string') {
            references.add(seatId);
          }
        });
      }
      visit(nestedValue, key);
    });
  };

  visit(value);
  return [...references].filter((seatId) => !allowedSeatIds.has(seatId));
}
