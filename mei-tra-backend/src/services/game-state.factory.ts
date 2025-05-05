import { Injectable } from '@nestjs/common';
import { CardService } from './card.service';
import { GameStateService } from './game-state.service';
import { ChomboService } from './chombo.service';

@Injectable()
export class GameStateFactory {
  constructor(
    private readonly cardService: CardService,
    private readonly chomboService: ChomboService,
  ) {}

  createGameState() {
    return new GameStateService(this.cardService, this.chomboService);
  }
}
