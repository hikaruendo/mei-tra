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
import { RepositoriesModule } from './repositories/repositories.module';
import { AuthModule } from './auth/auth.module';
import { JoinRoomUseCase } from './use-cases/join-room.use-case';
import { CreateRoomUseCase } from './use-cases/create-room.use-case';
import { LeaveRoomUseCase } from './use-cases/leave-room.use-case';
import { StartGameUseCase } from './use-cases/start-game.use-case';
import { TogglePlayerReadyUseCase } from './use-cases/toggle-player-ready.use-case';
import { ChangePlayerTeamUseCase } from './use-cases/change-player-team.use-case';
import { DeclareBlowUseCase } from './use-cases/declare-blow.use-case';
import { PassBlowUseCase } from './use-cases/pass-blow.use-case';
import { SelectNegriUseCase } from './use-cases/select-negri.use-case';
import { PlayCardUseCase } from './use-cases/play-card.use-case';
import { SelectBaseSuitUseCase } from './use-cases/select-base-suit.use-case';
import { RevealBrokenHandUseCase } from './use-cases/reveal-broken-hand.use-case';
import { CompleteFieldUseCase } from './use-cases/complete-field.use-case';
import { ProcessGameOverUseCase } from './use-cases/process-game-over.use-case';
import { UpdateAuthUseCase } from './use-cases/update-auth.use-case';

@Module({
  imports: [RepositoriesModule, AuthModule],
  providers: [
    GameGateway,
    GameStateService,
    {
      provide: 'IGameStateService',
      useExisting: GameStateService,
    },
    CardService,
    {
      provide: 'ICardService',
      useExisting: CardService,
    },
    ScoreService,
    {
      provide: 'IScoreService',
      useExisting: ScoreService,
    },
    ChomboService,
    {
      provide: 'IChomboService',
      useExisting: ChomboService,
    },
    BlowService,
    {
      provide: 'IBlowService',
      useExisting: BlowService,
    },
    PlayService,
    {
      provide: 'IPlayService',
      useExisting: PlayService,
    },
    RoomService,
    {
      provide: 'IRoomService',
      useExisting: RoomService,
    },
    GameStateFactory,
    {
      provide: 'IJoinRoomUseCase',
      useClass: JoinRoomUseCase,
    },
    {
      provide: 'ICreateRoomUseCase',
      useClass: CreateRoomUseCase,
    },
    {
      provide: 'ILeaveRoomUseCase',
      useClass: LeaveRoomUseCase,
    },
    {
      provide: 'IStartGameUseCase',
      useClass: StartGameUseCase,
    },
    {
      provide: 'ITogglePlayerReadyUseCase',
      useClass: TogglePlayerReadyUseCase,
    },
    {
      provide: 'IChangePlayerTeamUseCase',
      useClass: ChangePlayerTeamUseCase,
    },
    {
      provide: 'IDeclareBlowUseCase',
      useClass: DeclareBlowUseCase,
    },
    {
      provide: 'IPassBlowUseCase',
      useClass: PassBlowUseCase,
    },
    {
      provide: 'ISelectNegriUseCase',
      useClass: SelectNegriUseCase,
    },
    {
      provide: 'IPlayCardUseCase',
      useClass: PlayCardUseCase,
    },
    {
      provide: 'ISelectBaseSuitUseCase',
      useClass: SelectBaseSuitUseCase,
    },
    {
      provide: 'IRevealBrokenHandUseCase',
      useClass: RevealBrokenHandUseCase,
    },
    {
      provide: 'ICompleteFieldUseCase',
      useClass: CompleteFieldUseCase,
    },
    {
      provide: 'IProcessGameOverUseCase',
      useClass: ProcessGameOverUseCase,
    },
    {
      provide: 'IUpdateAuthUseCase',
      useClass: UpdateAuthUseCase,
    },
  ],
})
export class GameModule {}
