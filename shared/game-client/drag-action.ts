export type CardDropAction = 'play' | 'negri';
const DROP_THRESHOLD_PX = 80;

export const classifyCardDrop = (deltaY: number): CardDropAction | null => {
  if (deltaY <= -DROP_THRESHOLD_PX) return 'play';
  if (deltaY >= DROP_THRESHOLD_PX) return 'negri';
  return null;
};
