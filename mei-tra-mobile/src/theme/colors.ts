import { palette } from './palette';

/**
 * Component-facing colour surface.
 *
 * Every value is derived from `palette.ts` (the semantic layer mirroring the
 * web app's `--mt-*` tokens) — nothing is hard-coded here. Keeping these flat
 * names means the ~250 existing call sites did not have to churn, while the
 * values themselves now match the web design system exactly.
 *
 * Prefer `palette` (or `theme` from './index') in new code; this object exists
 * so that components read a short name at the point of use.
 */
export const colors = {
  // Surfaces
  background: palette.surface.felt,
  backgroundElevated: palette.surface.raised,
  panel: palette.surface.raised,
  panelStrong: palette.surface.raised2,

  // Lines
  border: palette.border.hairline,

  // Text
  text: palette.text.primary,
  textMuted: palette.text.secondary,
  /** Text on a brass fill. Replaces the seven hard-coded `#fff` sites. */
  onAccent: palette.text.onAccent,
  /** Text on a danger fill. */
  onDanger: palette.text.onDanger,

  // Accent (brass)
  gold: palette.accent.base,
  goldPressed: palette.accent.pressed,
  goldStrong: palette.accent.strong,
  goldSubtle: palette.accent.subtle,

  // Status
  danger: palette.status.danger,
  dangerSubtle: palette.status.dangerSubtle,
  dangerText: palette.status.dangerText,
  warning: palette.status.warning,
  success: palette.status.success,

  // Physical card chrome (the artwork carries its own colours)
  card: palette.card.face,
  cardText: palette.card.ink,
  redSuit: palette.card.red,
  cardBack: palette.card.back,
  cardDisabled: palette.overlay.cardDisabled,

  overlay: palette.overlay.scrim,
  modalOverlay: palette.overlay.modalScrim,
} as const;

/**
 * Team identity, indexed by the `Team` value (0 | 1) used across the contracts,
 * so `teamColors[player.team]` reads naturally.
 *
 * This replaces three conflicting palettes that previously coexisted
 * (`['#c0392b','#2c3e50']` in ScoreBoard/WaitingRoom, and an inline
 * `'#8b2020' / '#1a2a2a'` in GameBoard/PlayerSeat), which is why team badges
 * and the scoreboard did not agree.
 *
 * NOTE: team 1 is deliberately LIGHT — the web uses these as text colours, not
 * fills. Render team badges as outline-style (tinted border + matching text on
 * a raised surface), never as a solid fill with white text.
 */
export const teamColors = palette.team;

export const trumpColors = palette.trump;
