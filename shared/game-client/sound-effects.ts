export type SoundEffect =
  | "cardPlay"
  | "cardSelect"
  | "cancel"
  | "negri"
  | "shuffle"
  | "victory"
  | "defeat"
  | "resultNeutral";

export type SoundEffectGameEvent =
  | "card-played"
  | "play-setup-complete"
  | "game-started"
  | "new-round-started"
  | "broken"
  | "round-cancelled";

const SOUND_EFFECT_BY_EVENT: Record<SoundEffectGameEvent, SoundEffect> = {
  "card-played": "cardPlay",
  "play-setup-complete": "negri",
  "game-started": "shuffle",
  "new-round-started": "shuffle",
  broken: "shuffle",
  "round-cancelled": "shuffle",
};

export const soundEffectForGameEvent = (
  event: SoundEffectGameEvent,
): SoundEffect => SOUND_EFFECT_BY_EVENT[event];

export const soundEffectForCardSelection = (): SoundEffect => "cardSelect";

export const soundEffectForCancellation = (): SoundEffect => "cancel";

export const soundEffectForGameResultRole = (
  role: "winner" | "loser" | "spectator",
): SoundEffect => {
  if (role === "winner") return "victory";
  if (role === "loser") return "defeat";
  return "resultNeutral";
};

export const shouldPlayCardSelectionSound = (
  currentCard: string | null,
  nextCard: string | null,
): boolean => nextCard !== null && nextCard !== currentCard;

export const shouldPlayConfirmedNegriSound = (
  pendingCard: string | null,
  confirmedCard: string,
): boolean => pendingCard !== null && pendingCard === confirmedCard;
