// Game constants
export const GAME_CONSTANTS = {
  MAX_PLAYERS: 4,
  MAX_TEAMS: 2,
  CARDS_PER_PLAYER: 13,
  DEFAULT_POINTS_TO_WIN: 100,
  RECONNECT_TIMEOUT: 10000, // 10 seconds
} as const;

// Card suits
export const SUITS = {
  HEARTS: '♥',
  DIAMONDS: '♦',
  CLUBS: '♣',
  SPADES: '♠',
} as const;

// Card ranks
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

// Trump types
export const TRUMP_TYPES = {
  TRA: 'tra',
  HERZ: 'herz',
  DAIYA: 'daiya',
  CLUB: 'club',
  ZUPPE: 'zuppe',
} as const;