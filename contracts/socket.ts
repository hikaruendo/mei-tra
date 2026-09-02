import type {
  BackToLobbyPayload,
  BlowUpdatedPayload,
  BrokenPayload,
  CardPlayedPayload,
  FieldCompletePayload,
  FieldContract,
  GameMessagePayload,
  GameOverPayload,
  GameStartedPayload,
  GameStatePayload,
  NewRoundStartedPayload,
  PlayCardPayload,
  PlayerContract,
  PlayerConvertedToComPayload,
  PlayerDisconnectedPayload,
  PlayerIdlePayload,
  PlayerLeftPayload,
  PlaySetupCompletePayload,
  RequestAgariPayload,
  RevealAgariPayload,
  RoundCancelledPayload,
  RoundResultsPayload,
  SyncGameStatePayload,
  TransportTeamScores,
  TrumpType,
  TurnAckPayload,
  TurnPingPayload,
  UpdatePhasePayload,
  UpdateTurnPayload,
} from './game';
import type {
  GamePlayerJoinedPayload,
  RoomContract,
  RoomPlayerJoinedPayload,
  RoomSyncPayload,
} from './room';
import type { SeatId } from './ids';

export interface GatewayAck {
  success: boolean;
  error?: string;
}

export interface RoomAck extends GatewayAck {
  room?: RoomContract;
}

export interface CreateRoomPayload {
  name: string;
  pointsToWin: number;
  teamAssignmentMethod: 'random' | 'host-choice';
}

export interface JoinRoomPayload {
  roomId: string;
}

export interface WatchRoomPayload {
  roomId: string;
}

export interface LeaveWatchRoomPayload {
  roomId: string;
}

export interface LeaveRoomPayload {
  roomId: string;
}

export interface RoomActionPayload {
  roomId: string;
}

export interface ChangePlayerTeamPayload extends RoomActionPayload {
  teamChanges: Record<string, number>;
}

export interface ModeratePlayerPayload {
  roomId: string;
  targetSeatId: SeatId;
  action: 'remove' | 'replace-with-com';
}

export interface DeclareBlowPayload {
  roomId: string;
  declaration: {
    trumpType: TrumpType;
    numberOfPairs: number;
  };
}

export interface PassBlowPayload {
  roomId: string;
}

export interface SelectNegriPayload {
  roomId: string;
  card: string;
}

export interface SelectBaseSuitPayload {
  roomId: string;
  suit: string;
}

export type RevealBrokenHandPayload = RoomActionPayload;

export interface UpdateAuthPayload {
  token?: string;
}

export type AckCallback<TAck extends GatewayAck = GatewayAck> = (
  response: TAck,
) => void;

export interface ClientAckPayloads {
  'create-room': CreateRoomPayload;
  'join-room': JoinRoomPayload;
  'watch-room': WatchRoomPayload;
  'leave-watch-room': LeaveWatchRoomPayload;
  'leave-room': LeaveRoomPayload;
  'toggle-player-ready': RoomActionPayload;
  'change-player-team': ChangePlayerTeamPayload;
  'shuffle-teams': RoomActionPayload;
  'fill-with-com': RoomActionPayload;
  'start-game': RoomActionPayload;
  'moderate-player': ModeratePlayerPayload;
}

export interface ClientAckResponses {
  'create-room': RoomAck;
  'join-room': RoomAck;
  'watch-room': RoomAck;
  'leave-watch-room': GatewayAck;
  'leave-room': GatewayAck;
  'toggle-player-ready': GatewayAck;
  'change-player-team': GatewayAck;
  'shuffle-teams': GatewayAck;
  'fill-with-com': GatewayAck;
  'start-game': GatewayAck;
  'moderate-player': GatewayAck;
}

export type AckableClientEvent = keyof ClientAckPayloads;

export interface ClientToServerEvents {
  'create-room': (
    payload: CreateRoomPayload,
    ack?: AckCallback<RoomAck>,
  ) => void;
  'join-room': (payload: JoinRoomPayload, ack?: AckCallback<RoomAck>) => void;
  'watch-room': (payload: WatchRoomPayload, ack?: AckCallback<RoomAck>) => void;
  'leave-watch-room': (
    payload: LeaveWatchRoomPayload,
    ack?: AckCallback,
  ) => void;
  'list-rooms': () => void;
  'toggle-player-ready': (
    payload: RoomActionPayload,
    ack?: AckCallback,
  ) => void;
  'leave-room': (payload: LeaveRoomPayload, ack?: AckCallback) => void;
  'moderate-player': (
    payload: ModeratePlayerPayload,
    ack?: AckCallback,
  ) => void;
  'turn-ack': (payload: TurnAckPayload) => void;
  'sync-game-state': (payload: SyncGameStatePayload) => void;
  'change-player-team': (
    payload: ChangePlayerTeamPayload,
    ack?: AckCallback,
  ) => void;
  'shuffle-teams': (payload: RoomActionPayload, ack?: AckCallback) => void;
  'fill-with-com': (payload: RoomActionPayload, ack?: AckCallback) => void;
  'start-game': (payload: RoomActionPayload, ack?: AckCallback) => void;
  'declare-blow': (payload: DeclareBlowPayload) => void;
  'pass-blow': (payload: PassBlowPayload) => void;
  'select-negri': (payload: SelectNegriPayload) => void;
  'request-agari': (payload: RequestAgariPayload) => void;
  'play-card': (payload: PlayCardPayload) => void;
  'select-base-suit': (payload: SelectBaseSuitPayload) => void;
  'reveal-broken-hand': (payload: RevealBrokenHandPayload) => void;
  'update-auth': (payload: UpdateAuthPayload) => void;
  'profile-updated': () => void;
}

export interface ServerToClientEvents {
  'update-users': (users: unknown[]) => void;
  'rooms-list': (rooms: RoomContract[]) => void;
  'room-sync': (payload: RoomSyncPayload) => void;
  'room-player-joined': (payload: RoomPlayerJoinedPayload) => void;
  'set-room-id': (roomId: string) => void;
  'game-player-joined': (payload: GamePlayerJoinedPayload) => void;
  'update-players': (players: PlayerContract[]) => void;
  'game-state': (payload: GameStatePayload) => void;
  'reconnect-token': (reconnectToken: string) => void;
  'game-started': (payload: GameStartedPayload) => void;
  'update-phase': (payload: UpdatePhasePayload) => void;
  'update-turn': (payload: UpdateTurnPayload) => void;
  'blow-updated': (payload: BlowUpdatedPayload) => void;
  broken: (payload: BrokenPayload) => void;
  'round-cancelled': (payload: RoundCancelledPayload) => void;
  'reveal-agari': (payload: RevealAgariPayload) => void;
  'play-setup-complete': (payload: PlaySetupCompletePayload) => void;
  'card-played': (payload: CardPlayedPayload) => void;
  'field-recovered': () => void;
  'field-updated': (field: FieldContract) => void;
  'field-complete': (payload: FieldCompletePayload) => void;
  'round-results': (payload: RoundResultsPayload) => void;
  'round-reset': (payload: unknown) => void;
  'new-round-started': (payload: NewRoundStartedPayload) => void;
  'game-over': (payload: GameOverPayload) => void;
  'game-paused': (payload: GameMessagePayload) => void;
  'game-resumed': (payload: GameMessagePayload) => void;
  'error-message': (message: string) => void;
  'back-to-lobby': (payload?: BackToLobbyPayload) => void;
  'player-left': (payload: PlayerLeftPayload) => void;
  'player-converted-to-com': (payload: PlayerConvertedToComPayload) => void;
  'player-disconnected': (payload: PlayerDisconnectedPayload) => void;
  'player-idle': (payload: PlayerIdlePayload) => void;
  'player-idle-cleared': (payload: PlayerIdlePayload) => void;
  'turn-ping': (payload: TurnPingPayload) => void;
  'profile-updated': (payload: unknown) => void;
  error: (payload: { message: string }) => void;
}

export interface SocketData {
  userId?: string;
  seatId?: SeatId;
}
