import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { GameBoard } from '@/components/game/GameBoard';
import { WaitingRoom } from '@/components/game/WaitingRoom';
import { Button } from '@/components/ui/Button';
import { ConnectionBanner } from '@/components/ui/ConnectionBanner';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/context/AuthContext';
import { useGame } from '@/context/GameContext';
import { useGameHistory } from '@/hooks/useGameHistory';
import { colors } from '@/theme/colors';

export default function RoomScreen() {
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { user, loading } = useAuth();
  const {
    currentRoom,
    game,
    connectionStatus,
    currentSeatId,
    isHost,
    error,
    notice,
    refreshRooms,
    gameOver,
    shuffleTeams,
    startGame,
    leaveRoom,
    declareBlow,
    passBlow,
    selectNegri,
    playCard,
    selectBaseSuit,
    removePlayer,
    replaceWithCOM,
    updateTeamNames,
    clearFeedback,
    closeGameOver,
  } = useGame();

  useKeepAwake();

  useEffect(() => {
    if (gameOver && !currentRoom && !game) {
      closeGameOver();
      router.replace('/rooms');
    }
  }, [gameOver, currentRoom, game, closeGameOver, router]);

  const gameStarted = Boolean(
    game && game.gamePhase && game.gamePhase !== 'waiting',
  );
  const historyRoomId = game?.roomId ?? currentRoom?.id ?? null;
  const history = useGameHistory(historyRoomId, gameStarted);

  const doLeave = useCallback(async () => {
    const didLeave = await leaveRoom();
    if (didLeave) {
      router.replace('/rooms');
    }
    return didLeave;
  }, [leaveRoom, router]);

  if (!loading && !user) {
    return <Redirect href="/sign-in" />;
  }

  if (loading || !user) {
    return (
      <Screen contentStyle={styles.center}>
        <ActivityIndicator color={colors.gold} size="large" />
        <Text accessibilityLiveRegion="polite" style={styles.loadingText}>
          アカウント情報を読み込んでいます
        </Text>
      </Screen>
    );
  }

  const resolvedRoomId =
    roomId === 'current' ? currentRoom?.id ?? game?.roomId : roomId;
  const roomMatches = currentRoom?.id === resolvedRoomId;
  const gameMatches = game?.roomId === resolvedRoomId;

  if (!roomMatches && !gameMatches) {
    return (
      <Screen contentStyle={styles.center}>
        <ActivityIndicator color={colors.gold} size="large" />
        <Text style={styles.loadingText}>
          {connectionStatus === 'connected'
            ? 'ルーム情報を復元しています'
            : 'サーバーへ再接続しています'}
        </Text>
        <Button variant="ghost" onPress={() => router.replace('/rooms')}>
          ルーム一覧へ戻る
        </Button>
      </Screen>
    );
  }

  const isWaiting =
    !gameMatches || !game || game.gamePhase === 'waiting' || !game.gamePhase;
  const actionsDisabled = connectionStatus !== 'connected';

  return (
    <Screen>
      {connectionStatus !== 'connected' ? (
        <ConnectionBanner
          onRetry={refreshRooms}
          retryLabel="再接続を試す"
          status={connectionStatus}
        />
      ) : null}
      <FeedbackBanner
        error={error}
        notice={notice}
        onDismiss={clearFeedback}
      />
      {isWaiting && currentRoom ? (
        <WaitingRoom
          actionsDisabled={actionsDisabled}
          currentSeatId={currentSeatId}
          isHost={isHost}
          onLeave={doLeave}
          onRemovePlayer={removePlayer}
          onReplaceWithCOM={replaceWithCOM}
          onShuffle={shuffleTeams}
          onStart={startGame}
          onUpdateTeamNames={updateTeamNames}
          room={currentRoom}
        />
      ) : game ? (
        <GameBoard
          actionsDisabled={actionsDisabled}
          game={game}
          gameOver={gameOver}
          isHost={isHost}
          onCloseGameOver={async () => {
            const didLeave = await doLeave();
            if (didLeave) {
              closeGameOver();
            }
          }}
          onDeclare={declareBlow}
          onLeave={() => void doLeave()}
          onPass={passBlow}
          onPlayCard={playCard}
          onRemovePlayer={removePlayer}
          onReplaceWithCOM={replaceWithCOM}
          onSelectBaseSuit={selectBaseSuit}
          onSelectNegri={selectNegri}
          history={history}
          roomId={resolvedRoomId}
        />
      ) : (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  loadingText: {
    color: colors.text,
    fontSize: 17,
    textAlign: 'center',
  },
});
