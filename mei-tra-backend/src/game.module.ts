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
import { ComPlayerService } from './services/com-player.service';
import { ComStrategyService } from './services/com-strategy.service';
import { ComAutoPlayService } from './services/com-autoplay.service';
import { RepositoriesModule } from './repositories/repositories.module';
import { AuthModule } from './auth/auth.module';
import { SocialModule } from './social.module';
import { JoinRoomUseCase } from './use-cases/join-room.use-case';
import { WatchRoomUseCase } from './use-cases/watch-room.use-case';
import { CreateRoomUseCase } from './use-cases/create-room.use-case';
import { LeaveRoomUseCase } from './use-cases/leave-room.use-case';
import { StartGameUseCase } from './use-cases/start-game.use-case';
import { TogglePlayerReadyUseCase } from './use-cases/toggle-player-ready.use-case';
import { ChangePlayerTeamUseCase } from './use-cases/change-player-team.use-case';
import { FillWithComUseCase } from './use-cases/fill-with-com.use-case';
import { DeclareBlowUseCase } from './use-cases/declare-blow.use-case';
import { PassBlowUseCase } from './use-cases/pass-blow.use-case';
import { SelectNegriUseCase } from './use-cases/select-negri.use-case';
import { PlayCardUseCase } from './use-cases/play-card.use-case';
import { SelectBaseSuitUseCase } from './use-cases/select-base-suit.use-case';
import { RevealBrokenHandUseCase } from './use-cases/reveal-broken-hand.use-case';
import { CompleteFieldUseCase } from './use-cases/complete-field.use-case';
import { ProcessGameOverUseCase } from './use-cases/process-game-over.use-case';
import { UpdateAuthUseCase } from './use-cases/update-auth.use-case';
import { ComAutoPlayUseCase } from './use-cases/com-autoplay.use-case';
import { ActivityTrackerService } from './services/activity-tracker.service';
import { AvatarOrphanCleanupService } from './services/avatar-orphan-cleanup.service';
import { TurnMonitorService } from './services/turn-monitor.service';
import { UserGameStatsService } from './services/user-game-stats.service';
import { ComSessionService } from './services/com-session.service';
import { SeatRestorationService } from './services/seat-restoration.service';
import { RoomJoinService } from './services/room-join.service';
import { JoinRoomGatewayEffectsService } from './services/join-room-gateway-effects.service';
import { DisconnectGatewayEffectsService } from './services/disconnect-gateway-effects.service';
import { RoomUpdateGatewayEffectsService } from './services/room-update-gateway-effects.service';
import { StartGameGatewayEffectsService } from './services/start-game-gateway-effects.service';
import { SpectatorGatewayEffectsService } from './services/spectator-gateway-effects.service';
import { ReconnectionUseCase } from './use-cases/reconnection.use-case';
import { ModeratePlayerUseCase } from './use-cases/moderate-player.use-case';
import { ShuffleTeamsUseCase } from './use-cases/shuffle-teams.use-case';
import { UpdateTeamNamesUseCase } from './use-cases/update-team-names.use-case';
import { GameEventLogService } from './services/game-event-log.service';
import { GameHistoryMembershipLogService } from './services/game-history-membership-log.service';
import { GameHistoryController } from './controllers/game-history.controller';
import { GetGameHistoryUseCase } from './use-cases/get-game-history.use-case';
import { GetUserRecentGameHistoryUseCase } from './use-cases/get-user-recent-game-history.use-case';
import { ComAutoPlayRecoveryService } from './services/com-autoplay-recovery.service';
import { RoomMembershipService } from './services/room-membership.service';
import { DatabaseModule } from './database/database.module';
import { RoomMembershipReconcilerService } from './services/room-membership-reconciler.service';
import { ConnectionGatewayEffectsService } from './services/connection-gateway-effects.service';
import { DeleteAccountUseCase } from './use-cases/delete-account.use-case';
import { PushNotificationModule } from './push/push-notification.module';
import { GameplayNotificationService } from './services/gameplay-notification.service';
import { AccountActionGateService } from './services/account-action-gate.service';

@Module({
  imports: [
    DatabaseModule,
    RepositoriesModule,
    AuthModule,
    SocialModule,
    PushNotificationModule,
  ],
  controllers: [GameHistoryController],
  providers: [
    GameGateway,
    ActivityTrackerService,
    AvatarOrphanCleanupService,
    TurnMonitorService,
    ComAutoPlayRecoveryService,
    UserGameStatsService,
    ComSessionService,
    SeatRestorationService,
    RoomJoinService,
    RoomMembershipService,
    RoomMembershipReconcilerService,
    ConnectionGatewayEffectsService,
    GameplayNotificationService,
    AccountActionGateService,
    JoinRoomGatewayEffectsService,
    DisconnectGatewayEffectsService,
    RoomUpdateGatewayEffectsService,
    StartGameGatewayEffectsService,
    SpectatorGatewayEffectsService,
    GameEventLogService,
    GameHistoryMembershipLogService,
    {
      provide: 'IActivityTrackerService',
      useExisting: ActivityTrackerService,
    },
    {
      provide: 'IGameEventLogService',
      useExisting: GameEventLogService,
    },
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
    ComPlayerService,
    {
      provide: 'IComPlayerService',
      useExisting: ComPlayerService,
    },
    ComStrategyService,
    {
      provide: 'IComStrategyService',
      useExisting: ComStrategyService,
    },
    ComAutoPlayService,
    {
      provide: 'IComAutoPlayService',
      useExisting: ComAutoPlayService,
    },
    {
      provide: 'IJoinRoomUseCase',
      useClass: JoinRoomUseCase,
    },
    {
      provide: 'IWatchRoomUseCase',
      useClass: WatchRoomUseCase,
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
      provide: 'IFillWithComUseCase',
      useClass: FillWithComUseCase,
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
    {
      provide: 'IComAutoPlayUseCase',
      useClass: ComAutoPlayUseCase,
    },
    {
      provide: 'IGetGameHistoryUseCase',
      useClass: GetGameHistoryUseCase,
    },
    {
      provide: 'IGetUserRecentGameHistoryUseCase',
      useClass: GetUserRecentGameHistoryUseCase,
    },
    {
      provide: 'IDeleteAccountUseCase',
      useClass: DeleteAccountUseCase,
    },
    ReconnectionUseCase,
    ModeratePlayerUseCase,
    ShuffleTeamsUseCase,
    UpdateTeamNamesUseCase,
  ],
  exports: [
    'IActivityTrackerService',
    'IGetUserRecentGameHistoryUseCase',
    'IDeleteAccountUseCase',
  ],
})
export class GameModule {}
