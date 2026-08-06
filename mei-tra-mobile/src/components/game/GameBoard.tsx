import type { TrumpType } from '@meitra/contracts/game';
import type {
  GameHistoryReplayViewContract,
  GameHistorySummaryContract,
} from '@meitra/contracts/game-history';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BlowControls } from '@/components/game/BlowControls';
import { GameHistory } from '@/components/game/GameHistory';
import { PlayerSeat } from '@/components/game/PlayerSeat';
import { PlayingCard } from '@/components/game/PlayingCard';
import { ScoreBoard } from '@/components/game/ScoreBoard';
import { Button } from '@/components/ui/Button';
import { isCardPlayable } from '@/lib/cards';
import { getSeatOrderWithSelfBottom } from '@/lib/table-order';
import { getStrengthOrderLabel } from '@/lib/trump-display';
import { colors } from '@/theme/colors';
import type {
  MobileGameOver,
  MobileGameSnapshot,
} from '@/types/game';

interface GameHistoryData {
  replay: GameHistoryReplayViewContract | null;
  summary: GameHistorySummaryContract | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

interface GameBoardProps {
  game: MobileGameSnapshot;
  gameOver: MobileGameOver | null;
  isHost: boolean;
  onCloseGameOver: () => void;
  onDeclare: (trump: TrumpType, pairs: number) => void;
  onPass: () => void;
  onSelectNegri: (card: string) => void;
  onPlayCard: (card: string) => void;
  onSelectBaseSuit: (suit: string) => void;
  onRemovePlayer: (playerId: string) => void;
  onReplaceWithCOM: (playerId: string) => void;
  onLeave: () => void;
  actionsDisabled?: boolean;
  history?: GameHistoryData;
}

const trumpLabels: Record<TrumpType, string> = {
  tra: 'トラ',
  herz: 'ヘルツ ♥',
  daiya: 'ダイヤ ♦',
  club: 'クラブ ♣',
  zuppe: 'ズッペ ♠',
};

export function GameBoard({
  game,
  gameOver,
  isHost,
  onCloseGameOver,
  onDeclare,
  onPass,
  onSelectNegri,
  onPlayCard,
  onSelectBaseSuit,
  onRemovePlayer,
  onReplaceWithCOM,
  onLeave,
  actionsDisabled = false,
  history,
}: GameBoardProps) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    'card' | 'negri' | 'suit' | null
  >(null);
  const [leaving, setLeaving] = useState(false);
  const [showStrength, setShowStrength] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const self = game.players.find((player) => player.playerId === game.you);
  const orderedPlayers = useMemo(
    () => getSeatOrderWithSelfBottom(game.players, game.you),
    [game.players, game.you],
  );
  const opponents = orderedPlayers.filter(
    (player) => player.playerId !== game.you,
  );
  const playerNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of game.players) {
      map.set(p.playerId, p.name);
    }
    return map;
  }, [game.players]);
  const highest = game.blowState.currentHighestDeclaration;
  const mustSelectNegri =
    game.gamePhase === 'play' &&
    highest?.playerId === game.you &&
    !game.negriCard;
  const isMyTurn = game.currentTurn === game.you;
  const currentTurnName =
    game.players.find((player) => player.playerId === game.currentTurn)?.name ??
    '—';
  const phaseLabel =
    game.gamePhase === 'blow'
      ? '吹き'
      : game.gamePhase === 'play'
        ? 'プレイ'
        : '待機';
  const currentTrump = game.blowState.currentTrump;
  const needsBaseSuit =
    game.currentField?.baseCard === 'JOKER' &&
    !game.currentField.baseSuit &&
    isMyTurn;
  const selectedPlayable = useMemo(
    () =>
      Boolean(
        selectedCard &&
          self &&
          isCardPlayable(
            self.hand,
            selectedCard,
            game.currentField,
            currentTrump,
          ),
      ),
    [currentTrump, game.currentField, selectedCard, self],
  );
  const fieldCardsKey = game.currentField?.cards.join(',') ?? '';

  useEffect(() => {
    setSelectedCard(null);
    setPendingAction(null);
  }, [game.gamePhase, game.you]);

  useEffect(() => {
    setPendingAction(null);
    if (actionsDisabled) {
      setSelectedCard(null);
    }
  }, [
    actionsDisabled,
    game.currentTurn,
    fieldCardsKey,
    game.blowState.currentHighestDeclaration?.timestamp,
    game.negriCard,
  ]);

  const fieldsCount = game.fields.length;
  const prevFieldsCount = useRef(fieldsCount);
  useEffect(() => {
    if (fieldsCount > prevFieldsCount.current) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevFieldsCount.current = fieldsCount;
  }, [fieldsCount]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const markPending = (action: 'card' | 'negri' | 'suit') => {
    setPendingAction(action);
    timeoutRef.current = setTimeout(() => setPendingAction(null), 1800);
  };

  const handleLeave = () => {
    if (actionsDisabled || leaving) return;
    setLeaving(true);
    onLeave();
    timeoutRef.current = setTimeout(() => setLeaving(false), 1800);
  };

  const confirmSelected = () => {
    if (actionsDisabled || !selectedCard || pendingAction) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (mustSelectNegri) {
      markPending('negri');
      onSelectNegri(selectedCard);
    } else {
      markPending('card');
      onPlayCard(selectedCard);
    }
    setSelectedCard(null);
  };

  return (
    <View style={styles.container}>
      <ScoreBoard
        players={game.players}
        pointsToWin={game.pointsToWin}
        scores={game.teamScores}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.phase}>{phaseLabel}フェーズ</Text>
            <Text style={styles.turn}>順番: {currentTurnName}</Text>
          </View>
          <View style={styles.topBarActions}>
            {history ? (
              <Button
                onPress={() => {
                  history.refresh();
                  setShowHistory(true);
                }}
                style={styles.historyButton}
                variant="secondary"
              >
                履歴
              </Button>
            ) : null}
            <Button
              disabled={actionsDisabled || leaving}
              loading={leaving}
              onPress={handleLeave}
              style={styles.leaveButton}
              variant="ghost"
            >
              退出
            </Button>
          </View>
        </View>

        {highest ? (
          <Text style={styles.declaration}>
            宣言: {trumpLabels[highest.trumpType]}・
            {highest.numberOfPairs}ペア
          </Text>
        ) : null}

        {currentTrump ? (
          <Pressable
            onPress={() => setShowStrength((v) => !v)}
            style={styles.strengthToggle}
          >
            <Text style={styles.strengthToggleText}>
              {showStrength ? '▼' : '▶'} カード強さ順
            </Text>
            {showStrength ? (
              <Text style={styles.strengthOrder}>
                {getStrengthOrderLabel(currentTrump)}
              </Text>
            ) : null}
          </Pressable>
        ) : null}

        <ScrollView
          horizontal
          contentContainerStyle={styles.opponents}
          showsHorizontalScrollIndicator={false}
        >
          {opponents.map((player) => {
            const seat = (
              <PlayerSeat
                key={player.playerId}
                declaration={
                  highest?.playerId === player.playerId
                    ? `${trumpLabels[highest.trumpType]} ${highest.numberOfPairs}`
                    : undefined
                }
                isDisconnected={game.disconnectedPlayerIds.includes(
                  player.playerId,
                )}
                isIdle={game.idlePlayerIds.includes(player.playerId)}
                isTurn={game.currentTurn === player.playerId}
                player={player}
              />
            );
            if (isHost && !player.isCOM) {
              return (
                <Pressable
                  key={player.playerId}
                  onLongPress={() => {
                    Alert.alert(
                      player.name,
                      'プレイヤーの操作を選択してください',
                      [
                        {
                          text: 'COMに置換',
                          onPress: () => onReplaceWithCOM(player.playerId),
                        },
                        {
                          text: '退出させる',
                          style: 'destructive',
                          onPress: () => onRemovePlayer(player.playerId),
                        },
                        { text: 'キャンセル', style: 'cancel' },
                      ],
                    );
                  }}
                >
                  {seat}
                </Pressable>
              );
            }
            return seat;
          })}
        </ScrollView>

        <View style={styles.field}>
          <Text style={styles.sectionLabel}>場</Text>
          <View style={styles.fieldCards}>
            {game.currentField?.cards.length ? (
              game.currentField.cards.map((card, index) => {
                const playedById =
                  game.currentField?.playedBy[index];
                const playerName = playedById
                  ? playerNameMap.get(playedById)
                  : undefined;
                return (
                  <View key={`${card}-${index}`} style={styles.fieldCardSlot}>
                    <PlayingCard card={card} compact />
                    {playerName ? (
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.fieldCardPlayer,
                          playedById === game.you && styles.fieldCardPlayerSelf,
                        ]}
                      >
                        {playerName}
                      </Text>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyField}>まだカードはありません</Text>
            )}
          </View>
          {game.currentField?.baseSuit ? (
            <Text style={styles.baseSuit}>
              台札のスート: {game.currentField.baseSuit}
            </Text>
          ) : null}
          {needsBaseSuit ? (
            <View style={styles.suitSelector}>
              <Text style={styles.sectionLabel}>台札のスートを選択</Text>
              <View style={styles.suitButtons}>
                {['♠', '♥', '♦', '♣'].map((suit) => (
                  <Button
                    key={suit}
                    disabled={actionsDisabled || Boolean(pendingAction)}
                    loading={pendingAction === 'suit'}
                    onPress={() => {
                      markPending('suit');
                      onSelectBaseSuit(suit);
                    }}
                    style={styles.suitButton}
                    variant="secondary"
                  >
                    {suit}
                  </Button>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {game.gamePhase === 'blow' ? (
          <BlowControls
            actionsDisabled={actionsDisabled}
            currentPlayerId={game.you}
            currentTurn={game.currentTurn}
            highest={highest}
            onDeclare={onDeclare}
            onPass={onPass}
            players={game.players}
          />
        ) : null}

        {game.gamePhase === 'play' && game.fields.length > 0 ? (
          <View style={styles.completedFields}>
            <Text style={styles.sectionLabel}>獲得ペア</Text>
            <View style={styles.completedTeams}>
              {([0, 1] as const).map((team) => {
                const teamFields = game.fields.filter(
                  (field) => field.winnerTeam === team,
                );
                return (
                  <View key={team} style={styles.completedTeam}>
                    <Text style={styles.completedTeamLabel}>
                      T{team + 1}: {teamFields.length}
                    </Text>
                    <View style={styles.completedCards}>
                      {teamFields.map((field, idx) => (
                        <View key={idx} style={styles.miniCards}>
                          {field.cards.map((card, ci) => (
                            <Text key={ci} style={styles.miniCard}>
                              {card}
                            </Text>
                          ))}
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {game.gamePhase === 'play' && self ? (
          <View style={styles.handSection}>
            <View style={styles.handHeading}>
              <Text style={styles.sectionLabel}>あなたの手札</Text>
              <Text style={styles.pairs}>
                獲得 {game.fields.filter((field) => field.winnerTeam === self.team).length}
                ペア
              </Text>
            </View>
            {mustSelectNegri ? (
              <Text style={styles.instruction}>
                ネグリにするカードを選んでください
              </Text>
            ) : (
              <Text style={styles.instruction}>
                {isMyTurn ? 'プレイするカードを選んでください' : '順番を待っています'}
              </Text>
            )}
            {game.revealedAgari ? (
              <View style={styles.agariRow}>
                <Text style={styles.agari}>アゲ:</Text>
                <PlayingCard card={game.revealedAgari} compact />
              </View>
            ) : null}
            {game.negriCard ? (
              <View style={styles.negriRow}>
                <Text style={styles.negri}>ネグリ:</Text>
                <PlayingCard card={game.negriCard} compact />
              </View>
            ) : null}

            <ScrollView
              horizontal
              contentContainerStyle={styles.hand}
              showsHorizontalScrollIndicator={false}
            >
              {self.hand.map((card, index) => {
                const playable =
                  isMyTurn &&
                  isCardPlayable(
                    self.hand,
                    card,
                    game.currentField,
                    currentTrump,
                  );
                return (
                  <PlayingCard
                    card={card}
                    disabled={
                      actionsDisabled || !playable || Boolean(pendingAction)
                    }
                    key={`${card}-${index}`}
                    onPress={() =>
                      setSelectedCard((current) =>
                        current === card ? null : card,
                      )
                    }
                    selected={selectedCard === card}
                  />
                );
              })}
            </ScrollView>

            {selectedCard ? (
              <View style={styles.selectedActions}>
                <Button
                  disabled={
                    actionsDisabled ||
                    !selectedPlayable ||
                    Boolean(pendingAction)
                  }
                  loading={pendingAction === 'card' || pendingAction === 'negri'}
                  onPress={confirmSelected}
                  style={styles.actionButton}
                >
                  {mustSelectNegri ? 'ネグリにする' : 'プレイ'}
                </Button>
                <Button
                  disabled={actionsDisabled || Boolean(pendingAction)}
                  onPress={() => setSelectedCard(null)}
                  style={styles.actionButton}
                  variant="secondary"
                >
                  キャンセル
                </Button>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {game.paused ? (
        <View style={styles.pausedOverlay}>
          <Text style={styles.pausedTitle}>ゲームを一時停止しています</Text>
          <Text style={styles.pausedText}>プレイヤーの再接続を待っています</Text>
        </View>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={onCloseGameOver}
        transparent
        visible={Boolean(gameOver)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>ゲーム終了</Text>
            <Text style={styles.modalText}>
              勝者: {gameOver?.winner}
              {'\n'}
              チーム1 {gameOver?.finalScores[0]?.total ?? 0}点 / チーム2{' '}
              {gameOver?.finalScores[1]?.total ?? 0}点
            </Text>
            <Button disabled={actionsDisabled} onPress={onCloseGameOver}>
              ルーム一覧へ
            </Button>
          </View>
        </View>
      </Modal>

      {history ? (
        <Modal
          animationType="slide"
          onRequestClose={() => setShowHistory(false)}
          transparent
          visible={showHistory}
        >
          <View style={styles.historyOverlay}>
            <View style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>ゲーム履歴</Text>
                <Button
                  onPress={() => setShowHistory(false)}
                  variant="ghost"
                >
                  閉じる
                </Button>
              </View>
              <GameHistory
                error={history.error}
                loading={history.loading}
                onRefresh={history.refresh}
                replay={history.replay}
                summary={history.summary}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    gap: 14,
    padding: 14,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phase: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '800',
  },
  turn: {
    color: colors.text,
    fontSize: 15,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyButton: {
    minHeight: 42,
    paddingHorizontal: 12,
  },
  leaveButton: {
    minHeight: 42,
  },
  declaration: {
    color: colors.text,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.panelStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  strengthToggle: {
    gap: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.panelStrong,
  },
  strengthToggleText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  strengthOrder: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  opponents: {
    gap: 10,
  },
  field: {
    minHeight: 150,
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  fieldCards: {
    minHeight: 90,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 8,
  },
  fieldCardSlot: {
    alignItems: 'center',
    gap: 4,
    maxWidth: 70,
  },
  fieldCardPlayer: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
  },
  fieldCardPlayerSelf: {
    color: colors.gold,
    fontWeight: '700',
  },
  emptyField: {
    color: colors.textMuted,
  },
  baseSuit: {
    color: colors.gold,
    fontSize: 15,
    textAlign: 'center',
  },
  suitSelector: {
    gap: 8,
  },
  suitButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  suitButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 8,
  },
  completedFields: {
    gap: 8,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  completedTeams: {
    flexDirection: 'row',
    gap: 12,
  },
  completedTeam: {
    flex: 1,
    gap: 4,
  },
  completedTeamLabel: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '800',
  },
  completedCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  miniCards: {
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    borderRadius: 6,
    backgroundColor: colors.backgroundElevated,
  },
  miniCard: {
    color: colors.text,
    fontSize: 11,
  },
  handSection: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  handHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pairs: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '800',
  },
  instruction: {
    color: colors.textMuted,
    fontSize: 14,
  },
  agariRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agari: {
    color: colors.success,
    fontSize: 15,
    fontWeight: '700',
  },
  negriRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  negri: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '700',
  },
  hand: {
    minHeight: 104,
    alignItems: 'flex-end',
    gap: 6,
    paddingHorizontal: 4,
    paddingTop: 12,
  },
  selectedActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 30,
    backgroundColor: colors.overlay,
  },
  pausedTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  pausedText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.overlay,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    gap: 16,
    padding: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.panel,
  },
  modalTitle: {
    color: colors.gold,
    fontSize: 26,
    fontWeight: '900',
  },
  modalText: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 26,
  },
  historyOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  historyCard: {
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.background,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  historyTitle: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '800',
  },
});
