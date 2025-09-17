import { Injectable, Inject } from '@nestjs/common';
import { CardService } from './card.service';
import { GameStateService } from './game-state.service';
import { ChomboService } from './chombo.service';
import { IGameStateRepository } from '../repositories/interfaces/game-state.repository.interface';

@Injectable()
export class GameStateFactory {
  constructor(
    private readonly cardService: CardService,
    private readonly chomboService: ChomboService,
    @Inject('IGameStateRepository')
    private readonly gameStateRepository: IGameStateRepository,
  ) {}

  createGameState() {
    return new GameStateService(
      this.cardService,
      this.chomboService,
      this.gameStateRepository,
    );
  }
}
