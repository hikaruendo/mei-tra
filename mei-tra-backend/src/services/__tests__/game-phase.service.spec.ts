import {
  GamePhaseService,
  InvalidGamePhaseTransitionError,
} from '../game-phase.service';

describe('GamePhaseService', () => {
  let service: GamePhaseService;

  beforeEach(() => {
    service = new GamePhaseService();
  });

  it('allows the current production phase flows', () => {
    expect(() => service.assertTransition(null, 'blow')).not.toThrow();
    expect(() => service.assertTransition('blow', 'play')).not.toThrow();
    expect(() => service.assertTransition('play', 'blow')).not.toThrow();
    expect(() => service.assertTransition('waiting', 'blow')).not.toThrow();
  });

  it('allows idempotent transitions', () => {
    expect(() => service.assertTransition('blow', 'blow')).not.toThrow();
    expect(() => service.assertTransition(null, null)).not.toThrow();
  });

  it('rejects illegal transitions', () => {
    expect(() => service.assertTransition(null, 'play')).toThrow(
      InvalidGamePhaseTransitionError,
    );
    expect(() => service.assertTransition('blow', 'deal')).toThrow(
      InvalidGamePhaseTransitionError,
    );
    expect(() => service.assertTransition('play', 'deal')).toThrow(
      InvalidGamePhaseTransitionError,
    );
  });
});
