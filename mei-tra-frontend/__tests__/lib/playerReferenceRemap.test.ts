import {
  rememberSeatPlayerReplacements,
  resolveBlowActionsForRoster,
  resolveDeclarationForRoster,
  resolveDeclarationsForRoster,
  resolvePlayerIdForRoster,
} from '@/lib/utils/playerReferenceRemap';
import type { BlowAction, BlowDeclaration, Player } from '@/types/game.types';

const createPlayer = (
  playerId: string,
  team: Player['team'],
  overrides: Partial<Player> = {},
): Player => ({
  socketId: '',
  playerId,
  name: playerId,
  team,
  hand: [],
  ...overrides,
});

describe('playerReferenceRemap', () => {
  it('resolves stale declaration playerId to the same-seat replacement', () => {
    const replacements = new Map<string, string>();
    const previousPlayers = [
      createPlayer('top-human', 0),
      createPlayer('right-player', 1),
    ];
    const nextPlayers = [
      createPlayer('top-com', 0, { isCOM: true }),
      createPlayer('right-player', 1),
    ];

    rememberSeatPlayerReplacements(previousPlayers, nextPlayers, replacements);

    const declaration: BlowDeclaration = {
      playerId: 'top-human',
      team: 0,
      trumpType: 'daiya',
      numberOfPairs: 8,
      timestamp: 1,
    };

    expect(
      resolveDeclarationForRoster(declaration, nextPlayers, replacements),
    ).toEqual({ ...declaration, playerId: 'top-com' });
  });

  it('does not resolve a replacement when the seat team changes', () => {
    const replacements = new Map<string, string>();
    const previousPlayers = [createPlayer('old-player', 0)];
    const nextPlayers = [createPlayer('new-player', 1)];

    rememberSeatPlayerReplacements(previousPlayers, nextPlayers, replacements);

    expect(resolvePlayerIdForRoster('old-player', nextPlayers, replacements)).toBe(
      'old-player',
    );
  });

  it('follows chained same-seat replacements', () => {
    const replacements = new Map<string, string>();
    const firstPlayers = [createPlayer('human', 1)];
    const secondPlayers = [createPlayer('com', 1, { isCOM: true })];
    const thirdPlayers = [createPlayer('returned-human', 1)];

    rememberSeatPlayerReplacements(firstPlayers, secondPlayers, replacements);
    rememberSeatPlayerReplacements(secondPlayers, thirdPlayers, replacements);

    expect(resolvePlayerIdForRoster('human', thirdPlayers, replacements)).toBe(
      'returned-human',
    );
  });

  it('resolves declarations and blow actions for the current roster', () => {
    const replacements = new Map<string, string>([['old-lead', 'new-lead']]);
    const players = [createPlayer('new-lead', 0), createPlayer('other', 1)];
    const declarations: BlowDeclaration[] = [
      {
        playerId: 'old-lead',
        team: 0,
        trumpType: 'herz',
        numberOfPairs: 7,
        timestamp: 1,
      },
    ];
    const actions: BlowAction[] = [
      {
        type: 'declare',
        playerId: 'old-lead',
        trumpType: 'herz',
        numberOfPairs: 7,
        timestamp: 1,
      },
    ];

    expect(resolveDeclarationsForRoster(declarations, players, replacements)[0])
      .toMatchObject({ playerId: 'new-lead' });
    expect(resolveBlowActionsForRoster(actions, players, replacements)[0])
      .toMatchObject({ playerId: 'new-lead' });
  });

  it('resolves an orphan pass action to the only current roster passer without an action', () => {
    const players = [
      createPlayer('player-2', 0, { isPasser: true }),
      createPlayer('host', 1),
      createPlayer('com-2', 0, { isCOM: true }),
      createPlayer('com-3', 1, { isCOM: true, isPasser: true }),
    ];
    const actions: BlowAction[] = [
      {
        type: 'declare',
        playerId: 'com-2',
        trumpType: 'zuppe',
        numberOfPairs: 6,
        timestamp: 1,
      },
      { type: 'pass', playerId: 'com-3', timestamp: 2 },
      { type: 'pass', playerId: 'old-player-2', timestamp: 3 },
    ];

    expect(resolveBlowActionsForRoster(actions, players, new Map())).toEqual([
      actions[0],
      actions[1],
      { type: 'pass', playerId: 'player-2', timestamp: 3 },
    ]);
  });

  it('does not guess an orphan pass action when multiple passers are possible', () => {
    const players = [
      createPlayer('player-2', 0, { isPasser: true }),
      createPlayer('host', 1, { isPasser: true }),
    ];
    const actions: BlowAction[] = [
      { type: 'pass', playerId: 'old-player', timestamp: 1 },
    ];

    expect(resolveBlowActionsForRoster(actions, players, new Map())).toEqual(
      actions,
    );
  });
});
