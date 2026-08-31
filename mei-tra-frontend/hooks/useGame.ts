import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type {
  BackToLobbyPayload,
  BlowActionContract,
  BlowDeclarationContract,
  BlowUpdatedPayload,
  BrokenPayload,
  CardPlayedPayload,
  CompletedFieldContract,
  FieldCompletePayload,
  FieldContract,
  GameStartedPayload,
  GameOverPayload,
  GameStatePayload,
  NewRoundStartedPayload,
  PlayerContract,
  PlayCardPayload,
  PlaySetupCompletePayload,
  PlayerConvertedToComPayload,
  PlayerDisconnectedPayload,
  PlayerIdlePayload,
  PlayerLeftPayload,
  ReconnectionFailureCode,
  RequestAgariPayload,
  RevealAgariPayload,
  RoundCancelledPayload,
  RoundResultsPayload,
  SyncGameStatePayload,
  TransportGamePhase,
  TransportTeamScores,
  UpdatePhasePayload,
  UpdateTurnPayload,
} from '@contracts/game';
import type {
  GamePlayerJoinedPayload,
  RoomSyncPayload,
} from '@contracts/room';
import { useSocket } from './useSocket';
import { useAuth } from './useAuth';
import {
  BlowAction,
  BlowDeclaration,
  CompletedField,
  ConnectionUser,
  Field,
  FirstTurnReveal,
  GamePhase,
  Player,
  Team,
  TeamNames,
  TeamScores,
  TrumpType,
  fromPlayerContracts,
} from '../types/game.types';
import { fromRoomSyncPayload } from '../types/room.types';
import { clearPlayerProfileCache } from '../lib/utils/profileUtils';
import { getTeamDisplayName } from '../lib/utils/teamLabels';
import {
  createEmptyGameEventState,
  createGameEventStateFromSnapshot,
  createGameEventStateFromStartedGame,
  reduceGameEvent,
  type GameEventState,
  type GameServerEvent,
} from '@meitra/game-client/game-event-reducer';
import { completedFieldKey } from '@meitra/game-client/completed-field';
import { resolveSelfSeatId } from '../lib/utils/playerIdentity';
import {
  DEFAULT_USER_PREFERENCES,
  normalizeUserPreferences,
} from '../lib/preferences';
import {
  hasBlowActivity,
  resolveLastBlowSeatId,
  shouldAbortRevealOnTurn,
} from '@meitra/game-client/first-turn-reveal';
import type {
  DealAnimationCue,
  DealEvent,
} from '@meitra/game-client/deal-animation';
import {
  shouldPlayConfirmedNegriSound,
  soundEffectForCancellation,
  soundEffectForCardSelection,
  soundEffectForGameEvent,
  soundEffectForGameResultRole,
} from '@meitra/game-client/sound-effects';
import { useSoundEffects } from './useSoundEffects';
import {
  buildGameResultSnapshot,
  resolveWinningTeam,
  type GameResultSnapshot,
} from '@meitra/game-client/game-result';

interface ProfileUpdatedPayload {
  userId: string;
}

const reconnectRecoveryMessageKeys: Record<
  ReconnectionFailureCode,
  | 'reconnectRecovery.roomUnavailable'
  | 'reconnectRecovery.sessionInvalid'
  | 'reconnectRecovery.stateInconsistent'
> = {
  roomUnavailable: 'reconnectRecovery.roomUnavailable',
  sessionInvalid: 'reconnectRecovery.sessionInvalid',
  stateInconsistent: 'reconnectRecovery.stateInconsistent',
};

const dedupeCompletedFields = (fields: CompletedField[]): CompletedField[] => {
  const seen = new Set<string>();

  return fields.filter((field) => {
    const signature = completedFieldKey(field);
    if (seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    return true;
  });
};

const createEmptyTeamScores = (): TeamScores => ({
  0: { deal: 0, blow: 0, play: 0, total: 0 },
  1: { deal: 0, blow: 0, play: 0, total: 0 },
});

const toUiGamePhase = (phase: TransportGamePhase): GamePhase =>
  phase === 'waiting' ? null : phase;

const toUiBlowDeclaration = (
  declaration: BlowDeclarationContract,
): BlowDeclaration => {
  const seatId = declaration.seatId;
  return { ...declaration, seatId };
};

const toUiBlowAction = (action: BlowActionContract): BlowAction => {
  const seatId = action.seatId;
  return { ...action, seatId };
};

const toUiField = (field: FieldContract | null): Field | null => {
  if (!field) {
    return null;
  }

  const dealerSeatId = field.dealerSeatId;
  const playedBySeatIds = [...field.playedBySeatIds];
  return {
    cards: field.cards,
    playedBySeatIds,
    baseCard: field.baseCard,
    baseSuit: field.baseSuit,
    dealerSeatId,
    isComplete: field.isComplete,
  };
};

const toUiCompletedField = (
  field: CompletedFieldContract,
): CompletedField => {
  const winnerSeatId = field.winnerSeatId;
  const dealerSeatId = field.dealerSeatId;
  return {
    cards: field.cards,
    winnerSeatId,
    winnerTeam: field.winnerTeam,
    dealerSeatId,
  };
};

const toUiCompletedFields = (
  fields: CompletedFieldContract[] | undefined,
): CompletedField[] =>
  dedupeCompletedFields((fields ?? []).map((field) => toUiCompletedField(field)));

const toUiTeamScores = (scores: TransportTeamScores): TeamScores => ({
  0: {
    deal: 0,
    blow: 0,
    play: scores[0]?.play ?? 0,
    total: scores[0]?.total ?? 0,
  },
  1: {
    deal: 0,
    blow: 0,
    play: scores[1]?.play ?? 0,
    total: scores[1]?.total ?? 0,
  },
});

const mergePlayersPreservingIdentity = (
  previousPlayers: Player[],
  nextPlayers: Player[],
): Player[] => {
  const previousBySeatId = new Map(
    previousPlayers.map((player) => [player.seatId, player]),
  );

  return nextPlayers.map((nextPlayer) => {
    const previousPlayer = previousBySeatId.get(nextPlayer.seatId);
    if (!previousPlayer || nextPlayer.isCOM) {
      return nextPlayer;
    }

    return {
      ...previousPlayer,
      ...nextPlayer,
      userId: nextPlayer.userId ?? previousPlayer.userId,
      isAuthenticated:
        nextPlayer.isAuthenticated ?? previousPlayer.isAuthenticated,
      isHost: nextPlayer.isHost ?? previousPlayer.isHost,
      name: nextPlayer.name || previousPlayer.name,
    };
  });
};

export const useGame = () => {
  const tStatus = useTranslations('playerStatus');
  const t = useTranslations('game');
  const { socket, isConnected, isConnecting } = useSocket();
  const { user } = useAuth();
  const preferences = normalizeUserPreferences(user?.profile?.preferences);
  const playSoundEffect = useSoundEffects(preferences.sound);
  const playCardSelectionSound = useCallback(() => {
    playSoundEffect(soundEffectForCardSelection());
  }, [playSoundEffect]);
  const playCancelSound = useCallback(() => {
    playSoundEffect(soundEffectForCancellation());
  }, [playSoundEffect]);
  const playHandReorderSound = useCallback(() => {
    playSoundEffect('negri');
  }, [playSoundEffect]);
  const gameOverShownRef = useRef<string | null>(null);
  const gameResultTokenRef = useRef(0);
  const gameEventStateRef = useRef(createEmptyGameEventState());
  const agariRequestKeyRef = useRef<string | null>(null);
  const gameStateSyncKeyRef = useRef<string | null>(null);
  const pendingNegriCardRef = useRef<string | null>(null);
  // Read through a ref so the long-lived socket handlers see the current value.
  const startPlayerAnimationEnabledRef = useRef(
    DEFAULT_USER_PREFERENCES.startPlayerAnimation,
  );
  startPlayerAnimationEnabledRef.current = preferences.startPlayerAnimation;

  // Player and Game State
  const [name, setName] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gamePhase, setGamePhase] = useState<GamePhase>(null);
  const [whoseTurn, setWhoseTurn] = useState<string | null>(null);
  // Set only by the live 'game-started' event; a reload starts it null, so a
  // reconnect restores through the snapshot without replaying the reveal.
  const [firstTurnReveal, setFirstTurnReveal] =
    useState<FirstTurnReveal | null>(null);
  const [dealAnimationCue, setDealAnimationCue] =
    useState<DealAnimationCue | null>(null);
  const dealAnimationSequenceRef = useRef(0);
  // Mirrors the state for the long-lived socket handlers, which need it
  // synchronously and would otherwise close over a stale value.
  const firstTurnRevealRef = useRef<FirstTurnReveal | null>(null);
  const updateFirstTurnReveal = useCallback(
    (next: FirstTurnReveal | null) => {
      firstTurnRevealRef.current = next;
      setFirstTurnReveal(next);
    },
    [],
  );
  const clearFirstTurnReveal = useCallback(() => {
    updateFirstTurnReveal(null);
    // `update-turn` may arrive while the reveal hides the turn indicator.
    // After the reveal, show the latest turn received from the server.
    setWhoseTurn(gameEventStateRef.current.currentTurnSeatId);
  }, [updateFirstTurnReveal]);
  const startDealAnimation = useCallback(
    (event: DealEvent, playerContracts: readonly PlayerContract[]) => {
      dealAnimationSequenceRef.current += 1;
      setDealAnimationCue({
        token: dealAnimationSequenceRef.current,
        startedAt: Date.now(),
        seatIds: playerContracts.map((player) => player.seatId),
      });
      playSoundEffect(soundEffectForGameEvent(event));
    },
    [playSoundEffect],
  );
  const [teamScores, setTeamScores] = useState<TeamScores>(createEmptyTeamScores);
  // Blow Phase State
  const [blowDeclarations, setBlowDeclarations] = useState<BlowDeclaration[]>([]);
  const [blowActionHistory, setBlowActionHistory] = useState<BlowAction[]>([]);
  const [currentHighestDeclaration, setCurrentHighestDeclaration] = useState<BlowDeclaration | null>(null);
  const [selectedTrump, setSelectedTrump] = useState<TrumpType | null>(null);
  const [numberOfPairs, setNumberOfPairs] = useState<number>(0);

  // Pausing or ending the game unmounts the table mid-animation, so the reveal
  // would never report itself done and would keep gating the turn indicator.
  useEffect(() => {
    if (!gameStarted && firstTurnRevealRef.current) {
      clearFirstTurnReveal();
    }
  }, [gameStarted, clearFirstTurnReveal]);

  // Client-side rendering guard
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      pendingNegriCardRef.current = null;
    }

    return () => {
      pendingNegriCardRef.current = null;
    };
  }, [isConnected]);

  // Loading state details
  const [loadingState, setLoadingState] = useState<{
    isLoading: boolean;
    step: string;
  }>({
    isLoading: true,
    step: '認証状態を確認中...'
  });

  const [revealedAgari, setRevealedAgari] = useState<string | null>(null);
  const [currentField, setCurrentField] = useState<Field | null>(null);
  const [currentTrump, setCurrentTrump] = useState<TrumpType | null>(null);
  const [negriCard, setNegriCard] = useState<string | null>(null);
  const [negriSeatId, setNegriSeatId] = useState<string | null>(null);

  // Add state for completed fields
  const [completedFields, setCompletedFields] = useState<CompletedField[]>([]);

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [gameResult, setGameResult] = useState<GameResultSnapshot | null>(null);
  const [currentSeatId, setCurrentSeatId] = useState<string | null>(null);

  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [currentHostSeatId, setCurrentHostSeatId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [pointsToWin, setPointsToWin] = useState<number>(0);
  const [teamNames, setTeamNames] = useState<TeamNames | undefined>();
  const [idleSeatIds, setIdleSeatIds] = useState<string[]>([]);
  const [disconnectedSeatIds, setDisconnectedSeatIds] = useState<string[]>([]);

  const [users, setUsers] = useState<ConnectionUser[]>([]);
  // Keep a ref to users so event handlers always see the latest value (avoids stale closure)
  const usersRef = useRef<ConnectionUser[]>([]);
  const playersRef = useRef<Player[]>([]);

  const [paused, setPaused] = useState(false);

  const resetRoomState = useCallback(() => {
    pendingNegriCardRef.current = null;
    gameEventStateRef.current = createEmptyGameEventState();
    gameOverShownRef.current = null;
    agariRequestKeyRef.current = null;
    gameStateSyncKeyRef.current = null;
    setGameStarted(false);
    setGamePhase(null);
    setCurrentRoomId(null);
    setCurrentHostSeatId(null);
    setCurrentSeatId(null);
    setIsHost(false);
    setIsSpectator(false);
    setIdleSeatIds([]);
    setDisconnectedSeatIds([]);
    playersRef.current = [];
    setPlayers([]);
    setTeamScores(createEmptyTeamScores());
    setTeamNames(undefined);
    setCurrentField(null);
    setCompletedFields([]);
    setCurrentTrump(null);
    setWhoseTurn(null);
    firstTurnRevealRef.current = null;
    setFirstTurnReveal(null);
    setDealAnimationCue(null);
    setBlowDeclarations([]);
    setBlowActionHistory([]);
    setCurrentHighestDeclaration(null);
    setRevealedAgari(null);
    setNegriCard(null);
    setNegriSeatId(null);
    setPointsToWin(0);
    setPaused(false);
    sessionStorage.removeItem('roomId');
  }, []);

  const getTeamLabel = useCallback(
    (team: Team) =>
      getTeamDisplayName(team, teamNames, (fallbackTeam) =>
        t(fallbackTeam === 0 ? 'teamRed' : 'teamBlack'),
      ),
    [teamNames, t],
  );

  const syncDisconnectedSeatIdsFromPlayers = useCallback(
    (nextPlayers: Array<Pick<Player, 'seatId' | 'isCOM' | 'socketId'>>) => {
      setDisconnectedSeatIds(
        nextPlayers
          .filter((player) => !player.isCOM && !player.socketId)
          .map((player) => player.seatId),
      );
    },
    [],
  );

  const resolveCurrentUserSeatId = useCallback(<T extends { seatId: string; userId?: string }>(
    nextPlayers: T[],
    fallbackSeatId?: string | null,
    serverSeatId?: string | null,
  ): string | null => {
    return resolveSelfSeatId(nextPlayers, {
      userId: user?.id,
      serverSeatId,
      fallbackSeatId,
    });
  }, [user?.id]);

  const syncCurrentPlayerIdentity = useCallback((
    nextPlayers: Player[],
    fallbackSeatId?: string | null,
    serverSeatId?: string | null,
  ) => {
    const nextCurrentSeatId = resolveCurrentUserSeatId(
      nextPlayers,
      fallbackSeatId,
      serverSeatId,
    );
    if (nextCurrentSeatId) {
      setCurrentSeatId(nextCurrentSeatId);
    }
  }, [resolveCurrentUserSeatId]);

  const getCurrentUserSeatId = useCallback(
    () => resolveCurrentUserSeatId(playersRef.current, currentSeatId),
    [currentSeatId, resolveCurrentUserSeatId],
  );

  const hasPlayerActedInCurrentBlow = useCallback(
    (seatId: string): boolean => {
      const player = playersRef.current.find(
        (candidate) => candidate.seatId === seatId,
      );

      return (
        Boolean(player?.isPasser) ||
        blowDeclarations.some(
          (declaration) => declaration.seatId === seatId,
        ) ||
        blowActionHistory.some((action) => action.seatId === seatId)
      );
    },
    [blowActionHistory, blowDeclarations],
  );

  const updatePlayersLocally = useCallback((
    updater: (previousPlayers: Player[]) => Player[],
  ) => {
    setPlayers((previousPlayers) => {
      const nextPlayers = updater(previousPlayers);
      playersRef.current = nextPlayers;
      return nextPlayers;
    });
  }, []);

  const commitPlayers = useCallback((nextPlayers: Player[]) => {
    playersRef.current = nextPlayers;
    setPlayers(nextPlayers);
  }, []);

  const resetBlowState = useCallback((options?: { preservePlayers?: boolean }) => {
    setBlowDeclarations([]);
    setBlowActionHistory([]);
    setCurrentHighestDeclaration(null);
    setSelectedTrump(null);
    setNumberOfPairs(0);
    setNegriCard(null);
    setNegriSeatId(null);
    setCurrentField(null);
    setCompletedFields([]);
    setRevealedAgari(null);
    if (!options?.preservePlayers) {
      updatePlayersLocally((prev) =>
        prev.map((player) => ({ ...player, isPasser: false })),
      );
    }
  }, [updatePlayersLocally]);

  useEffect(() => {
    if (!currentHostSeatId || !currentSeatId) {
      setIsHost(false);
      return;
    }

    setIsHost(currentHostSeatId === currentSeatId);
  }, [currentHostSeatId, currentSeatId]);

  useEffect(() => {
    if (
      !socket?.connected ||
      !currentRoomId ||
      gamePhase !== 'play' ||
      !currentSeatId ||
      currentHighestDeclaration?.seatId !== currentSeatId ||
      revealedAgari ||
      negriCard
    ) {
      if (gamePhase !== 'play') {
        agariRequestKeyRef.current = null;
      }
      return;
    }

    const requestKey = [
      currentRoomId,
      socket.id,
      currentSeatId,
      currentHighestDeclaration.trumpType,
      currentHighestDeclaration.numberOfPairs,
      currentHighestDeclaration.timestamp,
    ].join(':');
    if (agariRequestKeyRef.current === requestKey) {
      return;
    }

    agariRequestKeyRef.current = requestKey;
    const payload: RequestAgariPayload = { roomId: currentRoomId };
    socket.emit('request-agari', payload);
  }, [
    currentHighestDeclaration,
    currentSeatId,
    currentRoomId,
    gamePhase,
    negriCard,
    revealedAgari,
    socket,
  ]);

  useEffect(() => {
    setIsClient(true);

    // Update loading state based on socket status - but don't block UI
    if (isConnecting) {
      setLoadingState({
        isLoading: false, // Don't block UI for socket connection
        step: 'サーバーに接続中...'
      });
    } else if (!socket) {
      setLoadingState({
        isLoading: false, // Don't block UI
        step: 'Socket接続を準備中...'
      });
    } else if (!isConnected) {
      setLoadingState({
        isLoading: false, // Don't block UI
        step: '接続を確立中...'
      });
    } else {
      setLoadingState({
        isLoading: false,
        step: '準備完了'
      });
    }

    if (!socket) return;

    /**
     * The single way server state may reveal whose turn it is. While the start
     * reveal plays it holds the turn back, because every snapshot the server
     * sends already carries the seat that the delayed `update-turn` is
     * reserving animation time for. `clearFirstTurnReveal` applies the seat
     * once the animation ends.
     */
    const commitTurn = (seatId: string | null) => {
      setWhoseTurn(firstTurnRevealRef.current ? null : seatId);
    };

    const commitGameEventState = (
      previous: GameEventState,
      next: GameEventState,
    ) => {
      if (next.players !== previous.players) {
        const nextPlayers = mergePlayersPreservingIdentity(
          playersRef.current,
          fromPlayerContracts(next.players),
        );
        commitPlayers(nextPlayers);
        syncDisconnectedSeatIdsFromPlayers(nextPlayers);
        setIdleSeatIds((idleIds) =>
          idleIds.filter((seatId) =>
            nextPlayers.some((player) => player.seatId === seatId),
          ),
        );
        if (!isSpectator) {
          syncCurrentPlayerIdentity(nextPlayers, currentSeatId);
        }
      }

      setGamePhase(toUiGamePhase(next.gamePhase));
      commitTurn(next.currentTurnSeatId);
      setCurrentField(toUiField(next.currentField));
      setCurrentTrump(next.blowState.currentTrump);
      setCurrentHighestDeclaration(
        next.blowState.currentHighestDeclaration
          ? toUiBlowDeclaration(next.blowState.currentHighestDeclaration)
          : null,
      );
      setBlowDeclarations(
        next.blowState.declarations.map(toUiBlowDeclaration),
      );
      setBlowActionHistory(
        (next.blowState.actionHistory ?? []).map(toUiBlowAction),
      );
      setTeamScores(toUiTeamScores(next.teamScores));
      setNegriCard(next.negriCard);
      setNegriSeatId(next.negriSeatId);
      setRevealedAgari(next.revealedAgari);
      setCompletedFields(toUiCompletedFields(next.fields));
    };

    const applyGameServerEvent = (event: GameServerEvent) => {
      const previous = gameEventStateRef.current;
      const next = reduceGameEvent(previous, event);
      gameEventStateRef.current = next;
      commitGameEventState(previous, next);
      return next;
    };

    const socketHandlers = {
      // ユーザーの更新
      'update-users': (users: ConnectionUser[]) => {
        usersRef.current = users;
        setUsers(users);
      },
      'update-players': (playerContracts: PlayerContract[]) => {
        gameEventStateRef.current = {
          ...gameEventStateRef.current,
          players: playerContracts,
        };
        const nextPlayers = mergePlayersPreservingIdentity(
          playersRef.current,
          fromPlayerContracts(playerContracts),
        );
        commitPlayers(nextPlayers);
        syncDisconnectedSeatIdsFromPlayers(nextPlayers);
        setIdleSeatIds((prev) =>
          prev.filter((seatId) =>
            nextPlayers.some((player) => player.seatId === seatId),
          ),
        );
        syncCurrentPlayerIdentity(nextPlayers, currentSeatId);
      },
      'set-room-id': (roomId: string) => {
        setCurrentRoomId(roomId);
      },
      'room-sync': (payload: RoomSyncPayload) => {
        const { room: nextRoom, players: nextPlayers } =
          fromRoomSyncPayload(payload);
        const selfSeatId = resolveCurrentUserSeatId(
          nextRoom.players,
          currentSeatId,
        );
        const isCurrentRoom =
          nextRoom.id === currentRoomId ||
          Boolean(
            selfSeatId &&
              nextRoom.players.some(
                (player) => player.seatId === selfSeatId,
              ),
          );

        if (!isCurrentRoom) {
          return;
        }

        // The reducer keeps its own copy of the players and reduces from it,
        // so a room-sync that only reached React state would leave the reducer
        // working from a hand the server has already changed — and the next
        // reduced event would write that stale hand back over the fresh one.
        // Holds the raw contracts, like 'update-players' above.
        gameEventStateRef.current = {
          ...gameEventStateRef.current,
          players: payload.players,
        };

        const mergedPlayers = mergePlayersPreservingIdentity(
          playersRef.current,
          nextPlayers,
        );
        commitPlayers(mergedPlayers);
        syncDisconnectedSeatIdsFromPlayers(mergedPlayers);
        syncCurrentPlayerIdentity(mergedPlayers, selfSeatId);

        if (!currentRoomId) {
          setCurrentRoomId(nextRoom.id);
        }

        setCurrentHostSeatId(nextRoom.hostSeatId);
        setTeamNames(nextRoom.settings.teamNames);
        if (selfSeatId) {
          setCurrentSeatId(selfSeatId);
        }
      },
      'game-state': ({
        players: playerContracts,
        gamePhase,
        currentField,
        currentTurnSeatId,
        blowState,
        teamScores,
        youSeatId,
        negriCard,
        negriSeatId,
        revealedAgari: syncedRevealedAgari,
        fields,
        roomId,
        hostSeatId,
        pointsToWin,
        teamNames,
        isSpectator,
      }: GameStatePayload) => {
        pendingNegriCardRef.current = null;
        gameEventStateRef.current = createGameEventStateFromSnapshot({
          players: playerContracts,
          gamePhase,
          currentField,
          currentTurnSeatId,
          blowState,
          teamScores,
          youSeatId,
          negriCard,
          negriSeatId,
          revealedAgari: syncedRevealedAgari,
          fields,
          roomId,
          hostSeatId,
          pointsToWin,
          teamNames,
          isSpectator,
        });
        const nextPlayers = mergePlayersPreservingIdentity(
          playersRef.current,
          fromPlayerContracts(playerContracts),
        );
        commitPlayers(nextPlayers);
        syncDisconnectedSeatIdsFromPlayers(nextPlayers);
        if (!isSpectator) {
          syncCurrentPlayerIdentity(nextPlayers, currentSeatId, youSeatId);
        }
        setGamePhase(toUiGamePhase(gamePhase));
        setRevealedAgari(syncedRevealedAgari ?? null);
        commitTurn(currentTurnSeatId);
        setCurrentField(toUiField(currentField));
        setCurrentTrump(blowState.currentTrump);
        setCurrentHighestDeclaration(
          blowState.currentHighestDeclaration
            ? toUiBlowDeclaration(blowState.currentHighestDeclaration)
            : null,
        );
        setBlowDeclarations(blowState.declarations.map(toUiBlowDeclaration));
        setBlowActionHistory(
          (blowState.actionHistory ?? []).map(toUiBlowAction),
        );
        setTeamScores(toUiTeamScores(teamScores));
        setIsSpectator(Boolean(isSpectator));
        setNegriCard(negriCard);
        setCompletedFields(toUiCompletedFields(fields));
        setNegriSeatId(negriSeatId);
        setCurrentRoomId(roomId);
        setCurrentHostSeatId(hostSeatId);
        if (isSpectator) {
          setIsHost(false);
        }
        setGameStarted(true);
        setPointsToWin(pointsToWin);
        setTeamNames(teamNames);
        setIdleSeatIds((prev) =>
          prev.filter((seatId) =>
            nextPlayers.some((player) => player.seatId === seatId),
          ),
        );
      },
      'game-player-joined': (data: GamePlayerJoinedPayload) => {
        const joinedSeatId = data.seatId;
        // isSelf: true means the backend confirmed "this is YOUR player ID".
        // Only set currentSeatId from this explicit self-identification event.
        if (data.isSelf) {
          setCurrentSeatId(joinedSeatId);
          setCurrentRoomId(data.roomId);
          setIsHost(data.isHost);
        }

        if (joinedSeatId === currentSeatId) {
          setCurrentRoomId(data.roomId);
          setIsHost(data.isHost);
        }
        if (data.roomStatus === 'playing') {
          setGameStarted(true);
          // ゲーム中の場合、プレイヤー配列は'game-state'イベントで更新されるため、ここでは更新しない
          return;
        }
        updatePlayersLocally((prev) => {
          const existingPlayer = prev.find(p => p.seatId === joinedSeatId);
          if (existingPlayer) {
            return prev;
          }

          // Look up display name from users list by seatId (not socket.id).
          // Use usersRef.current to avoid stale closure — users state may be empty at handler registration time.
          const knownUser = usersRef.current.find(u => u.seatId === joinedSeatId);

          return [...prev, {
            socketId: knownUser?.socketId ?? '',
            seatId: joinedSeatId,
            name: data.name || knownUser?.name || joinedSeatId,
            team: (data.team ?? 0) as Player['team'],
            hand: [],
            isHost: data.isHost,
          }];
        });
      },
      'profile-updated': ({ userId }: ProfileUpdatedPayload) => {
        if (!userId) {
          return;
        }

        clearPlayerProfileCache(userId);
        const profileRevision = Date.now();

        updatePlayersLocally((prev) =>
          prev.map((player) =>
            player.userId === userId || player.seatId === userId
              ? { ...player, profileRevision }
              : player,
          ),
        );
      },
      'game-started': ({
        roomId,
        players: playerContracts,
        pointsToWin,
        teamNames,
        currentTurnSeatId,
      }: GameStartedPayload) => {
        pendingNegriCardRef.current = null;
        startDealAnimation('game-started', playerContracts);
        gameEventStateRef.current = createGameEventStateFromStartedGame({
          roomId,
          players: playerContracts,
          pointsToWin,
          teamNames,
        });
        const nextPlayers = mergePlayersPreservingIdentity(
          playersRef.current,
          fromPlayerContracts(playerContracts),
        );
        gameOverShownRef.current = null;
        setGameResult(null);
        resetBlowState({ preservePlayers: true });
        commitPlayers(nextPlayers);
        syncDisconnectedSeatIdsFromPlayers(nextPlayers);
        const selfSeatId = resolveCurrentUserSeatId(
          nextPlayers,
          currentSeatId,
        );
        if (selfSeatId) {
          setCurrentSeatId(selfSeatId);
        } else if (currentSeatId) {
          console.error('[useGame] Player not found in game-started', {
            currentSeatId,
            userId: user?.id,
          });
        }

        setCurrentRoomId(roomId);
        setPointsToWin(pointsToWin);
        setTeamNames(teamNames);
        setGameStarted(true);
        setGamePhase('blow');

        // The server holds `update-turn` back for the reveal, so clear any turn
        // left over from a previous game and then either animate or, when the
        // reveal is off, apply the turn now instead of idling for the delay.
        setWhoseTurn(null);
        // The payload array is the server roster order, i.e. blow order —
        // the merged local players state may be ordered differently.
        const lastBlowSeatId = currentTurnSeatId
          ? resolveLastBlowSeatId(
              playerContracts.map((player) => player.seatId),
              currentTurnSeatId,
            )
          : null;
        if (
          currentTurnSeatId &&
          lastBlowSeatId &&
          startPlayerAnimationEnabledRef.current
        ) {
          updateFirstTurnReveal({
            roomId,
            seatId: currentTurnSeatId,
            lastBlowSeatId,
            token: Date.now(),
          });
        } else {
          updateFirstTurnReveal(null);
          if (currentTurnSeatId) {
            // Reduce it rather than setting state directly, so the shared
            // reducer agrees and a later event cannot blank the turn again.
            applyGameServerEvent({
              type: 'update-turn',
              payload: currentTurnSeatId,
            });
          }
        }
      },
      'update-phase': ({
        phase,
        scores,
        winner,
        currentHighestDeclaration,
      }: UpdatePhasePayload) => {
        applyGameServerEvent({
          type: 'update-phase',
          payload: { phase, scores, winner, currentHighestDeclaration },
        });
        const nextPhase = toUiGamePhase(phase);

        // Only show alert for phases other than 'play' and when not transitioning to a new round
        if (winner !== null && nextPhase !== 'play' && nextPhase !== 'blow') {
          setNotification({
            message: t('phaseResult', {
              teamName: getTeamLabel(winner),
              phase: t(`phaseNames.${nextPhase}` as 'phaseNames.deal'),
            }),
            type: 'success',
          });
        }
      },
      'error-message': (message: string) => {
        pendingNegriCardRef.current = null;
        setNotification({ message, type: 'error' });
      },
      'update-turn': (seatId: UpdateTurnPayload) => {
        if (shouldAbortRevealOnTurn(firstTurnRevealRef.current, seatId)) {
          updateFirstTurnReveal(null);
        }
        applyGameServerEvent({ type: 'update-turn', payload: seatId });
        if (socket && currentRoomId && !isSpectator) {
          socket.emit('turn-ack', { roomId: currentRoomId });
        }
      },
      'game-over': (payload: GameOverPayload) => {
        // Prevent replaying the result and viewpoint-specific sound for the same game.
        const winningTeam = resolveWinningTeam(payload);
        const gameOverKey = `${winningTeam}-${payload.finalScores[0]?.total}-${payload.finalScores[1]?.total}`;
        if (gameOverShownRef.current === gameOverKey) {
          return;
        }
        gameOverShownRef.current = gameOverKey;
        gameResultTokenRef.current += 1;
        const result = buildGameResultSnapshot({
          payload,
          players: playersRef.current,
          viewerSeatId: currentSeatId,
          isSpectator,
          teamNames,
          token: gameResultTokenRef.current,
        });
        setGameResult(result);
        if (result) {
          playSoundEffect(soundEffectForGameResultRole(result.viewerRole));
        }
        setGameStarted(false);
        setGamePhase(null);
        setTeamScores(createEmptyTeamScores());

        // ゲーム終了後、古いroomIdでの再接続ループを防ぐ
        sessionStorage.removeItem('roomId');

        // Keep ref set until the next game starts (game-started handler clears it)
      },
      'blow-updated': (payload: BlowUpdatedPayload) => {
        // A player whose reveal is disabled can declare before our animation
        // ends; cut it short rather than narrate a turn that already moved.
        if (hasBlowActivity(payload)) {
          updateFirstTurnReveal(null);
        }
        applyGameServerEvent({ type: 'blow-updated', payload });
      },
      'broken': (payload: BrokenPayload) => {
        pendingNegriCardRef.current = null;
        startDealAnimation('broken', payload.players);
        setNotification({
          message: 'Broken happened, reset the game',
          type: 'warning'
        });
        applyGameServerEvent({ type: 'broken', payload });
      },
      // TODO: 実装
      // 'reveal-hands': ({ players }: { players: { seatId: string; hand: string[] }[] }) => {
      //   setPlayers(currentPlayers => 
      //     currentPlayers.map(p => {
      //       const revealedPlayer = players.find(rp => rp.seatId === p.seatId);
      //       return revealedPlayer ? { ...p, hand: revealedPlayer.hand } : p;
      //     })
      //   );
      // },
      'round-reset': () => {
        pendingNegriCardRef.current = null;
        gameEventStateRef.current = {
          ...gameEventStateRef.current,
          blowState: createEmptyGameEventState().blowState,
          currentField: null,
          fields: [],
          negriCard: null,
          negriSeatId: null,
          revealedAgari: null,
        };
        resetBlowState();
      },
      'round-cancelled': (payload: RoundCancelledPayload) => {
        pendingNegriCardRef.current = null;
        startDealAnimation('round-cancelled', payload.players);
        setNotification({
          message: 'Round cancelled! All players passed.',
          type: 'warning'
        });
        applyGameServerEvent({ type: 'round-cancelled', payload });
      },
      'reveal-agari': (payload: RevealAgariPayload) => {
        applyGameServerEvent({ type: 'reveal-agari', payload });
        setNotification({
          message: payload.message,
          type: 'success'
        });
      },
      'play-setup-complete': (payload: PlaySetupCompletePayload) => {
        const pendingNegriCard = pendingNegriCardRef.current;
        pendingNegriCardRef.current = null;
        if (shouldPlayConfirmedNegriSound(pendingNegriCard, payload.negriCard)) {
          playSoundEffect(soundEffectForGameEvent('play-setup-complete'));
        }
        applyGameServerEvent({ type: 'play-setup-complete', payload });
      },
      'card-played': (payload: CardPlayedPayload) => {
        playSoundEffect(soundEffectForGameEvent('card-played'));
        applyGameServerEvent({ type: 'card-played', payload });
      },
      'field-updated': (field: FieldContract) => {
        applyGameServerEvent({ type: 'field-updated', payload: field });
      },
      'field-complete': (payload: FieldCompletePayload) => {
        applyGameServerEvent({ type: 'field-complete', payload });
      },
      'round-results': (payload: RoundResultsPayload) => {
        applyGameServerEvent({ type: 'round-results', payload });
      },
      'new-round-started': (payload: NewRoundStartedPayload) => {
        pendingNegriCardRef.current = null;
        startDealAnimation('new-round-started', payload.players);
        applyGameServerEvent({ type: 'new-round-started', payload });
      },
      'back-to-lobby': (payload?: BackToLobbyPayload) => {
        pendingNegriCardRef.current = null;
        console.warn('[useGame] back-to-lobby received', {
          currentRoomId,
          currentSeatId,
          storedRoomId:
            typeof window !== 'undefined'
              ? sessionStorage.getItem('roomId')
              : null,
        });
        resetRoomState();
        if (payload?.code) {
          setNotification({
            message: t(reconnectRecoveryMessageKeys[payload.code]),
            type: 'warning',
          });
        }
      },
      'game-paused': ({ message }: { message: string }) => {
        setPaused(true);
        setGameStarted(false);
        setNotification({ message, type: 'warning' });
      },
      'game-resumed': ({ message }: { message: string }) => {
        setPaused(false);
        setGameStarted(true);
        setNotification({ message, type: 'success' });
      },
      'player-disconnected': ({
        seatId,
        playerName,
      }: PlayerDisconnectedPayload) => {
        gameEventStateRef.current = {
          ...gameEventStateRef.current,
          players: gameEventStateRef.current.players.map((player) =>
            player.seatId === seatId
              ? {
                  ...player,
                  socketId: '',
                  name: playerName ?? player.name,
                }
              : player,
          ),
        };
        updatePlayersLocally((prev) =>
          prev.map((player) =>
            player.seatId === seatId
              ? {
                  ...player,
                  socketId: '',
                  name: playerName ?? player.name,
                }
              : player,
          ),
        );
        setIdleSeatIds((prev) => prev.filter((id) => id !== seatId));
        setDisconnectedSeatIds((prev) =>
          prev.includes(seatId) ? prev : [...prev, seatId],
        );
        setNotification({
          message: tStatus('disconnectedNotice', {
            playerName: playerName ?? seatId,
          }),
          type: 'warning'
        });
      },
      'player-idle': ({
        seatId,
        playerName,
      }: PlayerIdlePayload) => {
        setIdleSeatIds((prev) =>
          prev.includes(seatId) ? prev : [...prev, seatId],
        );
        setNotification({
          message: tStatus('idleNotice', {
            playerName: playerName ?? seatId,
          }),
          type: 'warning',
        });
      },
      'player-idle-cleared': ({ seatId }: PlayerIdlePayload) => {
        setIdleSeatIds((prev) => prev.filter((id) => id !== seatId));
      },
      'player-converted-to-com': ({
        seatId,
        playerName,
        message,
      }: PlayerConvertedToComPayload) => {
        console.log('[useGame] Player converted to COM:', seatId, message);
        gameEventStateRef.current = {
          ...gameEventStateRef.current,
          players: gameEventStateRef.current.players.map((player) =>
            player.seatId === seatId
              ? { ...player, isCOM: true, socketId: '' }
              : player,
          ),
        };
        setIdleSeatIds((prev) => prev.filter((id) => id !== seatId));
        setDisconnectedSeatIds((prev) => prev.filter((id) => id !== seatId));
        if (seatId === currentSeatId) {
          resetRoomState();
          setNotification({
            message: tStatus('convertedToComNotice', {
              playerName: playerName ?? seatId,
            }),
            type: 'warning'
          });
          return;
        }
        setNotification({
          message: tStatus('convertedToComNotice', {
            playerName: playerName ?? seatId,
          }),
          type: 'warning'
        });
      },
      'player-left': ({ seatId }: PlayerLeftPayload) => {
        setIdleSeatIds((prev) => prev.filter((id) => id !== seatId));
        setDisconnectedSeatIds((prev) => prev.filter((id) => id !== seatId));
        if (seatId === currentSeatId) {
          setCurrentRoomId(null);
          setIsHost(false);
        }
      },
      'turn-ping': ({ roomId }: { roomId: string }) => {
        if (!isSpectator) {
          socket.emit('turn-ack', { roomId });
        }
      },
    };

    // Register all socket handlers
    Object.entries(socketHandlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    const storedRoomId =
      typeof window === 'undefined'
        ? null
        : sessionStorage.getItem('roomId');
    const gameStateSyncKey =
      socket.connected && socket.id && storedRoomId
        ? `${socket.id}:${storedRoomId}`
        : null;

    if (
      gameStateSyncKey &&
      gameStateSyncKeyRef.current !== gameStateSyncKey
    ) {
      gameStateSyncKeyRef.current = gameStateSyncKey;
      const payload: SyncGameStatePayload = {
        roomId: storedRoomId ?? undefined,
      };
      socket.emit('sync-game-state', payload);
    }

    // Cleanup socket handlers
    return () => {
      Object.keys(socketHandlers).forEach((event) => {
        socket.off(event, socketHandlers[event as keyof typeof socketHandlers]);
      });
    };
  }, [
    socket,
    name,
    currentHighestDeclaration,
    players,
    isConnecting,
    isConnected,
    currentSeatId,
    currentRoomId,
    isSpectator,
    teamNames,
    negriSeatId,
    commitPlayers,
    resolveCurrentUserSeatId,
    getCurrentUserSeatId,
    updatePlayersLocally,
    syncCurrentPlayerIdentity,
    resetRoomState,
    resetBlowState,
    syncDisconnectedSeatIdsFromPlayers,
    getTeamLabel,
    t,
    tStatus,
    updateFirstTurnReveal,
    startDealAnimation,
    playSoundEffect,
    user?.id,
  ]);

  const startGame = () => {
    const selfSeatId = getCurrentUserSeatId();
    if (!currentRoomId || !selfSeatId) return;
    socket?.emit('start-game', { roomId: currentRoomId });
  };

  const removePlayerFromRoom = (targetSeatId: string) => {
    const selfSeatId = getCurrentUserSeatId();
    if (!socket || !currentRoomId || !selfSeatId) return;
    socket.emit('moderate-player', {
      roomId: currentRoomId,
      targetSeatId: targetSeatId,
      action: 'remove',
    });
  };

  const replacePlayerWithCOM = (targetSeatId: string) => {
    const selfSeatId = getCurrentUserSeatId();
    if (!socket || !currentRoomId || !selfSeatId) return;
    socket.emit('moderate-player', {
      roomId: currentRoomId,
      targetSeatId: targetSeatId,
      action: 'replace-with-com',
    });
  };

  const shuffleTeams = () => {
    const selfSeatId = getCurrentUserSeatId();
    if (!socket || !currentRoomId || !selfSeatId) return;
    socket.emit('shuffle-teams', {
      roomId: currentRoomId,
    });
  };

  const updateTeamNames = (nextTeamNames: TeamNames) => {
    const selfSeatId = getCurrentUserSeatId();
    if (!socket || !currentRoomId || !selfSeatId) return;
    socket.emit('update-team-names', {
      roomId: currentRoomId,
      teamNames: nextTeamNames,
    });
  };

  const gameActions = {
    declareBlow: () => {
      if (!currentSeatId || whoseTurn !== currentSeatId) {
        setNotification({ message: t('errors.notYourTurnDeclare'), type: 'error' });
        return;
      }
      if (hasPlayerActedInCurrentBlow(currentSeatId)) {
        setNotification({ message: t('errors.alreadyActedInBlow'), type: 'error' });
        return;
      }
      if (!selectedTrump || numberOfPairs < 1) {
        setNotification({ message: t('errors.selectTrumpAndPairs'), type: 'error' });
        return;
      }
      socket?.emit('declare-blow', {
        roomId: currentRoomId,
        declaration: {
          trumpType: selectedTrump,
          numberOfPairs,
        },
      });
    },
    passBlow: () => {
      if (!currentSeatId || whoseTurn !== currentSeatId) {
        setNotification({ message: t('errors.notYourTurnPass'), type: 'error' });
        return;
      }
      if (hasPlayerActedInCurrentBlow(currentSeatId)) {
        setNotification({ message: t('errors.alreadyActedInBlow'), type: 'error' });
        return;
      }
      socket?.emit('pass-blow', {
        roomId: currentRoomId,
      });
    },
    selectNegri: (card: string) => {
      if (!socket || !currentRoomId) {
        pendingNegriCardRef.current = null;
        return;
      }
      pendingNegriCardRef.current = card;
      socket.emit('select-negri', {
        roomId: currentRoomId,
        card,
      });
    },
    playCard: (card: string) => {
      if (!currentSeatId || whoseTurn !== currentSeatId) {
        setNotification({ message: t('errors.notYourTurnPlay'), type: 'error' });
        return;
      }
      if (!currentRoomId) {
        return;
      }
      const payload: PlayCardPayload = {
        roomId: currentRoomId,
        card,
      };
      socket?.emit('play-card', payload);
    },
    selectBaseSuit: (suit: string) => {
      if (!currentSeatId || whoseTurn !== currentSeatId) {
        setNotification({ message: t('errors.notYourTurnBaseSuit'), type: 'error' });
        return;
      }
      socket?.emit('select-base-suit', {
        roomId: currentRoomId,
        suit,
      });
    },
    revealBrokenHand: (seatId: string) => {
      const selfSeatId = getCurrentUserSeatId();
      if (!selfSeatId || seatId !== selfSeatId) {
        return;
      }
      socket?.emit('reveal-broken-hand', {
        roomId: currentRoomId,
      });
    }
  };

  const closeGameResult = useCallback(() => {
    setGameResult(null);
    resetRoomState();
  }, [resetRoomState]);


  if (!isClient) {
    return {
      isLoading: true,
      loadingStep: 'クライアントを初期化中...',
      socket,
      isConnected: false,
      isConnecting: false,
      gameResult: null,
      closeGameResult: () => {},
    };
  }

  // Return loading state information when still loading
  if (loadingState.isLoading) {
    return {
      isLoading: true,
      loadingStep: loadingState.step,
      socket,
      isConnected,
      isConnecting,
      gameResult: null,
      closeGameResult: () => {},
    };
  }

  return {
    isLoading: false,
    loadingStep: loadingState.step,
    name,
    setName,
    gameStarted,
    gamePhase,
    whoseTurn,
    currentTrump,
    currentField,
    players,
    negriCard,
    negriSeatId,
    completedFields,
    revealedAgari,
    gameActions,
    blowDeclarations,
    blowActionHistory,
    currentHighestDeclaration,
    selectedTrump,
    setSelectedTrump,
    numberOfPairs,
    setNumberOfPairs,
    teamScores,
    currentSeatId,
    notification,
    setNotification,
    gameResult,
    closeGameResult,
    currentRoomId,
    isHost,
    isSpectator,
    teamNames,
    startGame,
    shuffleTeams,
    updateTeamNames,
    removePlayerFromRoom,
    replacePlayerWithCOM,
    idleSeatIds,
    disconnectedSeatIds,
    pointsToWin,
    users,
    paused,
    socket,
    isConnected,
    isConnecting,
    firstTurnReveal,
    clearFirstTurnReveal,
    dealAnimationCue,
    playCardSelectionSound,
    playCancelSound,
    playHandReorderSound,
  };
};
