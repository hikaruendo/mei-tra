/**
 * A banner message. Server text arrives already worded, so it is kept as-is;
 * our own copy is stored as a catalogue key and translated when rendered, so
 * switching languages re-words a banner that is still on screen.
 */
export type FeedbackMessage =
  | string
  | { key: string; params?: Record<string, string | number> };
