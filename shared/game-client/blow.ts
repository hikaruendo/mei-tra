import type {
  BlowDeclarationContract,
  TrumpType,
} from '@meitra/contracts/game';

export const BLOW_MIN_PAIRS = 6;
export const BLOW_DEFAULT_MAX_PAIRS = 10;
export const BLOW_MAX_PAIRS = 13;

export const BLOW_TRUMP_STRENGTHS: Record<TrumpType, number> = {
  tra: 5,
  herz: 4,
  daiya: 3,
  club: 2,
  zuppe: 1,
};

export const BLOW_DEFAULT_PAIR_OPTIONS = Array.from(
  { length: BLOW_DEFAULT_MAX_PAIRS - BLOW_MIN_PAIRS + 1 },
  (_, index) => BLOW_MIN_PAIRS + index,
);

export const getTrumpStrength = (trump: TrumpType): number =>
  BLOW_TRUMP_STRENGTHS[trump] || 0;

export const isBlowDeclarationValid = (
  trump: TrumpType,
  pairs: number,
  currentHighest: BlowDeclarationContract | null,
): boolean => {
  if (pairs < BLOW_MIN_PAIRS || pairs > BLOW_MAX_PAIRS) {
    return false;
  }

  if (!currentHighest) {
    return pairs <= BLOW_DEFAULT_MAX_PAIRS;
  }

  if (currentHighest.numberOfPairs >= BLOW_DEFAULT_MAX_PAIRS) {
    return pairs === currentHighest.numberOfPairs + 1;
  }

  if (pairs > currentHighest.numberOfPairs) {
    return true;
  }

  if (pairs < currentHighest.numberOfPairs) {
    return false;
  }

  return getTrumpStrength(trump) > getTrumpStrength(currentHighest.trumpType);
};

export const getValidBlowPairValues = (
  currentHighest: BlowDeclarationContract | null,
  selectedTrump: TrumpType | null,
): number[] => {
  if (!currentHighest) {
    return BLOW_DEFAULT_PAIR_OPTIONS.map((pair) => pair);
  }

  if (currentHighest.numberOfPairs >= BLOW_DEFAULT_MAX_PAIRS) {
    const nextPair = currentHighest.numberOfPairs + 1;
    return nextPair <= BLOW_MAX_PAIRS ? [nextPair] : [];
  }

  const currentTrumpStrength = getTrumpStrength(currentHighest.trumpType);
  const selectedTrumpStrength = selectedTrump
    ? getTrumpStrength(selectedTrump)
    : 0;
  const validPairs = BLOW_DEFAULT_PAIR_OPTIONS.filter(
    (pair) =>
      pair > currentHighest.numberOfPairs ||
      (pair === currentHighest.numberOfPairs &&
        selectedTrumpStrength > currentTrumpStrength),
  );

  if (validPairs.length > 0) {
    return validPairs;
  }

  const nextValidPair =
    selectedTrumpStrength > currentTrumpStrength
      ? currentHighest.numberOfPairs
      : currentHighest.numberOfPairs + 1;

  return nextValidPair <= BLOW_DEFAULT_MAX_PAIRS ? [nextValidPair] : [];
};
