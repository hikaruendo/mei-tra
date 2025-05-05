import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameStateService } from './services/game-state.service';
import { CardService } from './services/card.service';
import { ScoreService } from './services/score.service';
import { ChomboService } from './services/chombo.service';
import { BlowService } from './services/blow.service';
import { PlayService } from './services/play.service';
import { RoomService } from './services/room.service';
import { GameStateFactory } from './services/game-state.factory';

@Module({
  imports: [],
  providers: [
    GameGateway,
    GameStateService,
    CardService,
    ScoreService,
    ChomboService,
    BlowService,
    PlayService,
    RoomService,
    GameStateFactory,
  ],
})
export class GameModule {}
