import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { GameBoard } from '@/components/game/GameBoard';
import { WaitingRoom } from '@/components/game/WaitingRoom';
import { Button } from '@/components/ui/Button';
import { ConnectionBanner } from '@/components/ui/ConnectionBanner';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/context/AuthContext';
import { useGame } from '@/context/GameContext';
import { colors } from '@/theme/colors';

export default function RoomScreen() {
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { user, loading } = useAuth();
  const {
    currentRoom,
    game,
    connectionStatus,
    currentPlayerId,
    isHost,
    error,
    notice,
    refreshRooms,
    gameOver,
    toggleReady,
    fillWithCOM,
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

  const doLeave = useCallback(async () => {
    const didLeave = await leaveRoom();
    if (didLeave) {
      router.replace('/rooms');
    }
    return didLeave;
  }, [leaveRoom, router]);

  const handleLeaveWithConfirm = useCallback(() => {
    Alert.alert('ゲームから退出', '本当に退出しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '退出する',
        style: 'destructive',
        onPress: () => void doLeave(),
      },
    ]);
  }, [doLeave]);

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
      <ConnectionBanner
        onRetry={refreshRooms}
        retryLabel="再接続を試す"
        status={connectionStatus}
      />
      <FeedbackBanner
        error={error}
        notice={notice}
        onDismiss={clearFeedback}
      />
      {isWaiting && currentRoom ? (
        <WaitingRoom
          actionsDisabled={actionsDisabled}
          currentPlayerId={currentPlayerId}
          isHost={isHost}
          onFillWithCOM={fillWithCOM}
          onLeave={doLeave}
          onRemovePlayer={removePlayer}
          onReplaceWithCOM={replaceWithCOM}
          onShuffle={shuffleTeams}
          onStart={startGame}
          onToggleReady={toggleReady}
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
          onLeave={handleLeaveWithConfirm}
          onPass={passBlow}
          onPlayCard={playCard}
          onRemovePlayer={removePlayer}
          onReplaceWithCOM={replaceWithCOM}
          onSelectBaseSuit={selectBaseSuit}
          onSelectNegri={selectNegri}
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
