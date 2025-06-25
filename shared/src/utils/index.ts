// Utility functions placeholder
// This will be populated with card-related utilities and game logic helpers

export function generatePlayerId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function isValidCard(card: string): boolean {
  if (card === 'JOKER') return true;
  
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  
  return ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].includes(rank) &&
         ['♥', '♦', '♣', '♠'].includes(suit);
}