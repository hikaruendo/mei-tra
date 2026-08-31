import { raw } from './raw';

/**
 * Layer 2 — semantic colour roles, mirrored from the web app's `--mt-*` tokens.
 *
 * Only the DARK values are defined; the mobile app ships a single theme
 * (`app.json` pins `userInterfaceStyle: "dark"`). Adding a light theme later
 * means duplicating this one file and swapping the exported object — no
 * component needs to change, because components only ever reference roles.
 */
export const palette = {
  surface: {
    felt: raw.felt900,
    raised: raw.felt800,
    raised2: raw.felt700,
    raised3: raw.felt600,
  },

  text: {
    primary: raw.ivory,
    secondary: raw.sage,
    muted: 'rgba(169, 183, 166, 0.6)',
    // Text sitting on an accent (brass) fill.
    onAccent: raw.felt800,
    // Text sitting on a danger fill. Mode-stable on web.
    onDanger: raw.ivory,
    onSuccess: raw.felt900,
  },

  accent: {
    base: raw.brass500,
    strong: raw.brass300,
    pressed: raw.brass600,
    subtle: 'rgba(201, 163, 78, 0.14)',
  },

  border: {
    hairline: 'rgba(236, 230, 214, 0.12)',
    focus: raw.brass500,
  },

  /**
   * "It is your turn", in two roles that need opposite treatment.
   *
   * Neither is `accent`: brass is the ambient accent of every panel, badge and
   * button, so the turn cue was one more gold thing among many.
   *
   * `clockDisc` is a SOLID fill carrying an ivory dial, so it is picked for
   * the dial to read on it (ivory on brass was 2.09:1; on this red, 4.01:1).
   * `ring` is a HAIRLINE seen against the panel it outlines, so it is picked
   * for the panel and goes pale — the same reasoning as `team[0]` below.
   *
   * Mirrors the web `--mt-turn-*` tokens (dark values — see the note above).
   */
  turn: {
    clockDisc: raw.alert500,
    clockDial: raw.ivory,
    ring: raw.cardRedMedium,
  },

  status: {
    danger: '#c0362c',
    dangerSubtle: 'rgba(192, 54, 44, 0.16)',
    success: '#6fb98f',
    warning: '#e0c784',
    /**
     * Danger used as TEXT on the felt background.
     *
     * Deliberately lighter than `danger`. The web app colours error text with
     * `--mt-danger` (#c0362c) directly, which is ~3.2:1 against felt — below
     * WCAG AA. Matching web exactly here would be an accessibility regression,
     * so mobile keeps the ~7:1 tint. Revisit if web fixes its own contrast.
     */
    dangerText: '#ffb0a8',
  },

  /**
   * Physical card tokens — mode-stable on web ("a card's identity must not
   * shift with chrome theme"). These describe card *chrome* (chips, borders,
   * placeholders); the card artwork itself carries its own colours inside the
   * SVG and is deliberately left untouched.
   */
  card: {
    face: '#f4f0e3',
    ink: '#23281f',
    red: '#c0362c',
    back: '#173d30',
  },

  /**
   * Team identity. Indexed by the `Team` value (0 | 1) used across the
   * contracts, so `team[player.team]` reads naturally at call sites.
   *
   * NOTE: BOTH entries are intentionally LIGHT (web uses these as text
   * colours, not fills). Badges must therefore be outline-style — a tinted
   * border and matching text on a raised surface — never a solid fill with
   * white text.
   *
   * team[0] is raw.cardRedLight, not raw.cardRed: the card ink reads at 2.18:1
   * as text on surface.raised2, against 7.68:1 for the black side. Team
   * identity and card ink are separate roles — web splits them the same way,
   * as --mt-team-red vs --mt-card-red.
   */
  team: [raw.cardRedLight, '#c8d1c8'] as const,

  trump: {
    tra: '#e0b24a',
    herz: '#e07264',
    daiya: '#6fa0d6',
    club: '#86be6e',
    zuppe: '#c9c1b0',
  },

  overlay: {
    scrim: 'rgba(0, 0, 0, 0.7)',
    modalScrim: 'rgba(0, 0, 0, 0.38)',
    // Laid over a disabled card. Web uses `filter: brightness(.45) saturate(.3)`,
    // which React Native has no dependable cross-platform equivalent for.
    cardDisabled: 'rgba(14, 42, 33, 0.55)',
  },
} as const;
