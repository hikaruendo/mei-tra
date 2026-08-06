import type { TrumpType } from '@meitra/contracts/game';
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
import { PlayerSeat } from '@/components/game/PlayerSeat';
import { PlayingCard } from '@/components/game/PlayingCard';
import { ScoreBoard } from '@/components/game/ScoreBoard';
import { Button } from '@/components/ui/Button';
import { isCardPlayable } from '@/lib/cards';
import { colors } from '@/theme/colors';
import type {
  MobileGameOver,
  MobileGameSnapshot,
} from '@/types/game';

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
}: GameBoardProps) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    'card' | 'negri' | 'suit' | null
  >(null);
  const [leaving, setLeaving] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const self = game.players.find((player) => player.playerId === game.you);
  const opponents = game.players.filter(
    (player) => player.playerId !== game.you,
  );
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

        {highest ? (
          <Text style={styles.declaration}>
            宣言: {trumpLabels[highest.trumpType]}・
            {highest.numberOfPairs}ペア
          </Text>
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
              game.currentField.cards.map((card, index) => (
                <PlayingCard card={card} compact key={`${card}-${index}`} />
              ))
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
              <Text style={styles.agari}>アゲ: {game.revealedAgari}</Text>
            ) : null}
            {game.negriCard ? (
              <Text style={styles.negri}>ネグリ: {game.negriCard}</Text>
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
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
  agari: {
    color: colors.success,
    fontSize: 15,
    fontWeight: '700',
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
});
