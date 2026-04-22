import { Injectable } from '@nestjs/common';
import { GamePhase } from '../types/game.types';

type PhaseKey = 'null' | 'deal' | 'blow' | 'play' | 'waiting';

const ALLOWED_PHASE_TRANSITIONS: Record<PhaseKey, readonly GamePhase[]> = {
  null: [null, 'deal', 'blow', 'waiting'],
  deal: ['deal', 'blow', 'waiting', null],
  blow: ['blow', 'play', 'waiting', null],
  play: ['play', 'blow', 'waiting', null],
  waiting: ['waiting', 'blow', 'play', null],
};

export class InvalidGamePhaseTransitionError extends Error {
  constructor(
    readonly currentPhase: GamePhase,
    readonly nextPhase: GamePhase,
  ) {
    super(
      `Invalid game phase transition: ${String(currentPhase)} -> ${String(nextPhase)}`,
    );
    this.name = InvalidGamePhaseTransitionError.name;
  }
}

@Injectable()
export class GamePhaseService {
  assertTransition(currentPhase: GamePhase, nextPhase: GamePhase): void {
    if (currentPhase === nextPhase) {
      return;
    }

    const allowedTransitions =
      ALLOWED_PHASE_TRANSITIONS[this.getPhaseKey(currentPhase)];
    if (!allowedTransitions.includes(nextPhase)) {
      throw new InvalidGamePhaseTransitionError(currentPhase, nextPhase);
    }
  }

  private getPhaseKey(phase: GamePhase): PhaseKey {
    return phase ?? 'null';
  }
}
