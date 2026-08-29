import type { TrumpType } from '@meitra/contracts/game';
import type { DealAnimationCue } from '@meitra/game-client/deal-animation';
import { shouldPlayCardSelectionSound } from '@meitra/game-client/sound-effects';
import type {
  GameHistoryReplayViewContract,
  GameHistorySummaryContract,
} from '@meitra/contracts/game-history';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { BlowControls } from '@/components/game/BlowControls';
import { GameHistory } from '@/components/game/GameHistory';
import { PlayerSeat } from '@/components/game/PlayerSeat';
import { StartPlayerJanken } from '@/components/game/StartPlayerJanken';
import { MiniCard } from '@/components/game/MiniCard';
import { PlayingCard } from '@/components/game/PlayingCard';
import { DealtCard } from '@/components/game/DealtCard';
import { useHandFanMetrics } from '@/hooks/useHandFanMetrics';
import { ScoreBoard } from '@/components/game/ScoreBoard';
import { ChatPanel } from '@/components/social/ChatPanel';
import { Button } from '@/components/ui/Button';
import { isCardPlayable } from '@/lib/cards';
import {
  getCardSeatPosition,
  getSeatOrderWithSelfBottom,
} from '@/lib/table-order';
import { getStrengthOrderLabel } from '@/lib/trump-display';
import { getTeamDisplayName } from '@/lib/team-labels';
import { trumpLabel } from '@/lib/trump-labels';
import { colors, teamColors } from '@/theme/colors';
import type { MobileFirstTurnReveal } from '@/context/GameContext';
import type { MobileGameSnapshot, MobilePlayer } from '@/types/game';
import { t } from '@/i18n';

interface GameHistoryData {
  replay: GameHistoryReplayViewContract | null;
  summary: GameHistorySummaryContract | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

interface GameBoardProps {
  game: MobileGameSnapshot;
  isHost: boolean;
  onDeclare: (trump: TrumpType, pairs: number) => void;
  onPass: () => void;
  onSelectNegri: (card: string) => void;
  onCardSelection?: () => void;
  onCancel?: () => void;
  onPlayCard: (card: string) => void;
  onSelectBaseSuit: (suit: string) => void;
  onRemovePlayer: (seatId: string) => void;
  onReplaceWithCOM: (seatId: string) => void;
  onLeave: () => void;
  actionsDisabled?: boolean;
  history?: GameHistoryData;
  roomId?: string;
  firstTurnReveal?: MobileFirstTurnReveal | null;
  onFirstTurnRevealDone?: () => void;
  dealAnimationCue?: DealAnimationCue | null;
}

export function GameBoard({
  game,
  isHost,
  onDeclare,
  onPass,
  onSelectNegri,
  onCardSelection = () => undefined,
  onCancel = () => undefined,
  onPlayCard,
  onSelectBaseSuit,
  onRemovePlayer,
  onReplaceWithCOM,
  onLeave,
  actionsDisabled = false,
  history,
  roomId,
  firstTurnReveal = null,
  onFirstTurnRevealDone,
  dealAnimationCue = null,
}: GameBoardProps) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    'card' | 'negri' | 'suit' | null
  >(null);
  const [leaving, setLeaving] = useState(false);
  const [showStrength, setShowStrength] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [spectatorPerspectiveId, setSpectatorPerspectiveId] = useState<
    string | null
  >(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const updateReducedMotion = (enabled: boolean) => {
      if (!cancelled) setReducedMotion(enabled);
    };
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      updateReducedMotion,
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(updateReducedMotion);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const hostSeatId =
    game.players.find((p) => p.isHost)?.seatId ??
    game.players[0]?.seatId ??
    null;
  const perspectiveSeatId = game.isSpectator
    ? spectatorPerspectiveId ?? hostSeatId
    : game.youSeatId;

  useEffect(() => {
    if (!game.isSpectator) return;
    const valid = game.players.some(
      (p) => p.seatId === spectatorPerspectiveId,
    );
    if (!valid) setSpectatorPerspectiveId(hostSeatId);
  }, [game.isSpectator, game.players, hostSeatId, spectatorPerspectiveId]);

  const self = game.players.find(
    (player) => player.seatId === perspectiveSeatId,
  );
  const { width: windowWidth } = useWindowDimensions();
  // Size the fan from the hand it actually renders. Spectators have no
  // `game.youSeatId`, so keying off that collapsed the count to 0 and the metrics
  // fell through to the single-card branch (max width, zero overlap).
  const selfHandCount = self?.hand.length ?? 0;
  // board padding (20) + self panel (~86) + fan padding (20)
  const fanAvailableWidth = windowWidth - 126;
  const { cardWidth: handCardWidth, cardMargin: handCardMargin } =
    useHandFanMetrics(fanAvailableWidth, selfHandCount);
  const orderedPlayers = useMemo(
    () => getSeatOrderWithSelfBottom(game.players, perspectiveSeatId),
    [game.players, perspectiveSeatId],
  );
  const leftPlayer = orderedPlayers[1] ?? null;
  const topPlayer = orderedPlayers[2] ?? null;
  const rightPlayer = orderedPlayers[3] ?? null;
  const opponentSlots = useMemo(
    () =>
      [
        { player: leftPlayer, position: 'left' as const },
        { player: topPlayer, position: 'top' as const },
        { player: rightPlayer, position: 'right' as const },
      ].filter(
        (
          slot,
        ): slot is {
          player: MobilePlayer;
          position: 'left' | 'top' | 'right';
        } =>
          slot.player != null,
      ),
    [leftPlayer, topPlayer, rightPlayer],
  );
  const teamFieldCounts = useMemo(() => {
    const counts: Record<number, number> = { 0: 0, 1: 0 };
    for (const field of game.fields) {
      counts[field.winnerTeam] = (counts[field.winnerTeam] ?? 0) + 1;
    }
    return counts;
  }, [game.fields]);
  const highest = game.blowState.currentHighestDeclaration;
  const mustSelectNegri =
    !game.isSpectator &&
    game.gamePhase === 'play' &&
    highest?.seatId === game.youSeatId &&
    !game.negriCard;
  const isMyTurn =
    !game.isSpectator && game.currentTurnSeatId === game.youSeatId;
  const phaseLabel =
    game.gamePhase === 'blow'
      ? t('board.phaseBlow')
      : game.gamePhase === 'play'
        ? t('board.phasePlay')
        : t('board.phaseWaiting');
  const currentTrump = game.blowState.currentTrump;
  const needsBaseSuit =
    !game.isSpectator &&
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
  }, [game.gamePhase, game.youSeatId]);

  useEffect(() => {
    setPendingAction(null);
    if (actionsDisabled) {
      setSelectedCard(null);
    }
  }, [
    actionsDisabled,
    game.currentTurnSeatId,
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

  const toggleSelectedCard = (card: string) => {
    if (selectedCard === card) {
      setSelectedCard(null);
      return;
    }

    if (shouldPlayCardSelectionSound(selectedCard, card)) {
      onCardSelection();
    }
    setSelectedCard(card);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <ScoreBoard
          pointsToWin={game.pointsToWin}
          scores={game.teamScores}
          teamNames={game.teamNames}
        />
        <Pressable
          onPress={() => setShowOptions(true)}
          style={styles.optionsButton}
        >
          <Text style={styles.optionsButtonText}>···</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Text style={styles.phase}>{phaseLabel}</Text>
          {highest ? (
            <Text style={styles.trumpBadge}>
              {trumpLabel(highest.trumpType)} {highest.numberOfPairs}
            </Text>
          ) : null}
        </View>


        {showStrength && currentTrump ? (
          <View style={styles.strengthPanel}>
            <Text style={styles.strengthOrder}>
              {getStrengthOrderLabel(currentTrump)}
            </Text>
          </View>
        ) : null}

        <View style={styles.opponentsArea}>
          {opponentSlots.map(({ player, position }) => {
            const hasNegri =
              game.gamePhase === 'play' &&
              game.negriSeatId === player.seatId;
            const blowWinnerId = highest?.seatId;
            const hasAgari =
              game.gamePhase === 'play' &&
              game.revealedAgari &&
              blowWinnerId === player.seatId;
            const seatEl = (
              <PlayerSeat
                key={player.seatId}
                agariCard={hasAgari ? game.revealedAgari ?? undefined : undefined}
                declaration={
                  highest && highest.seatId === player.seatId
                    ? `${trumpLabel(highest.trumpType)} ${highest.numberOfPairs}`
                    : undefined
                }
                isBlowWinner={blowWinnerId === player.seatId}
                isDisconnected={game.disconnectedSeatIds.includes(
                  player.seatId,
                )}
                isIdle={game.idleSeatIds.includes(player.seatId)}
                isTurn={game.currentTurnSeatId === player.seatId}
                negriCard={hasNegri ? 'hidden' : undefined}
                onPress={
                  game.isSpectator
                    ? () => setSpectatorPerspectiveId(player.seatId)
                    : undefined
                }
                onLongPress={
                  isHost && !player.isCOM
                    ? () => {
                        Alert.alert(
                          player.name,
                          t('waiting.playerActionTitle'),
                          [
                            {
                              text: t('waiting.replaceWithCom'),
                              onPress: () => onReplaceWithCOM(player.seatId),
                            },
                            {
                              text: t('waiting.removePlayer'),
                              style: 'destructive',
                              onPress: () => onRemovePlayer(player.seatId),
                            },
                            { text: t('common.cancel'), style: 'cancel' },
                          ],
                        );
                      }
                    : undefined
                }
                player={player}
                dealAnimationCue={dealAnimationCue}
                reducedMotion={reducedMotion}
                teamFieldCounts={teamFieldCounts}
                teamNames={game.teamNames}
              />
            );
            const posStyle =
              position === 'top'
                ? styles.seatTop
                : position === 'left'
                  ? styles.seatLeft
                  : styles.seatRight;
            const isDisconnected = game.disconnectedSeatIds.includes(
              player.seatId,
            );
            const isIdle = game.idleSeatIds.includes(player.seatId);
            // Matches the web condition (PlayerHand/index.tsx): the host never
            // sees the control on their own seat.
            const showReplacePanel =
              isHost &&
              !player.isCOM &&
              player.seatId !== game.youSeatId &&
              (isDisconnected || isIdle);
            return (
              <View key={player.seatId} style={posStyle}>
                {seatEl}
                {showReplacePanel ? (
                  <View style={styles.replacePanel}>
                    <Text style={styles.replacePanelHeader}>
                      {isDisconnected ? t('seat.disconnected') : t('seat.idle')}
                    </Text>
                    <Pressable
                      onPress={() => onReplaceWithCOM(player.seatId)}
                      style={styles.replacePanelButton}
                    >
                      <Text style={styles.replacePanelButtonText}>
                        {t('waiting.replaceWithCom')}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {game.gamePhase === 'play' ? (
          <View style={styles.field}>
            <View style={styles.fieldCenter}>
              {game.currentField?.cards.length ? (
                game.currentField.cards.map((card, index) => {
                  const seatId = game.currentField!.playedBySeatIds[index];
                  const seat = getCardSeatPosition(
                    seatId,
                    orderedPlayers,
                  );
                  const seatOffsets: Record<string, { x: number; y: number }> = {
                    bottom: { x: 0, y: 24 },
                    top: { x: 0, y: -24 },
                    left: { x: -36, y: 0 },
                    right: { x: 36, y: 0 },
                  };
                  const offset = seatOffsets[seat];
                  return (
                    <View
                      key={`${card}-${index}`}
                      style={[
                        styles.fieldCardAbsolute,
                        {
                          transform: [
                            { translateX: offset.x },
                            { translateY: offset.y },
                          ],
                          zIndex: index + 1,
                        },
                      ]}
                    >
                      <PlayingCard card={card} size="field" />
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyField}>{t('board.emptyField')}</Text>
              )}
            </View>
            {game.currentField?.baseSuit ? (
              <Text style={styles.baseSuit}>
                {t('board.baseSuit', {
                  suit: game.currentField.baseSuit,
                })}
              </Text>
            ) : null}
            {needsBaseSuit ? (
              <View style={styles.suitSelector}>
                <Text style={styles.sectionLabel}>{t('board.selectBaseSuit')}</Text>
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
        ) : null}

        {game.gamePhase === 'blow' ? (
          <BlowControls
            actionHistory={game.blowState.actionHistory}
            actionsDisabled={actionsDisabled || game.isSpectator}
            currentSeatId={game.youSeatId}
            currentTurn={game.currentTurnSeatId}
            highest={highest}
            onDeclare={onDeclare}
            onPass={onPass}
            players={game.players}
          />
        ) : null}

        {(game.gamePhase === 'blow' || game.gamePhase === 'play') && self ? (
          <View style={styles.handSection}>
            <View style={styles.selfRow}>
              <View
                testID="self-player-info"
                style={[
                  styles.selfCard,
                  (game.isSpectator
                    ? game.currentTurnSeatId === self.seatId
                    : isMyTurn) && styles.selfCardTurn,
                ]}
              >
                <View style={[styles.selfAvatar, self.isCOM && styles.selfComAvatar]}>
                  <Text style={styles.selfAvatarText}>
                    {self.isCOM ? '🤖' : '●'}
                  </Text>
                </View>
                <Text numberOfLines={1} style={styles.selfName}>
                  {self.name}
                </Text>
                <View style={[styles.selfTeamBadge, { borderColor: teamColors[self.team] }]}>
                  <Text style={[styles.selfTeamBadgeText, { color: teamColors[self.team] }]}>
                    {getTeamDisplayName(self.team, game.teamNames)}
                  </Text>
                </View>
                <Text style={styles.selfFieldCountText}>
                  {t('seat.fieldsWon', {
                    count: teamFieldCounts[self.team] ?? 0,
                  })}
                </Text>
                {game.gamePhase === 'play' && game.negriCard && highest?.seatId === self.seatId ? (
                  <View style={styles.selfSpecialRow}>
                    <PlayingCard card={game.negriCard} size="seat" />
                    <Text style={styles.selfSpecialLabel}>{t('seat.negri')}</Text>
                  </View>
                ) : null}
                {game.gamePhase === 'play' && game.revealedAgari ? (
                  <View style={styles.selfSpecialRow}>
                    <PlayingCard card={game.revealedAgari} size="seat" />
                    <Text style={styles.selfSpecialLabel}>{t('seat.agariShort')}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.handArea}>
                {game.gamePhase === 'play' ? (
                  game.isSpectator ? (
                    <Text style={styles.instruction}>
                      {t('board.spectatingHand', { name: self.name })}
                    </Text>
                  ) : mustSelectNegri ? (
                    <Text style={styles.instruction}>
                      {t('board.chooseNegri')}
                    </Text>
                  ) : (
                    <Text style={styles.instruction}>
                      {isMyTurn
                        ? t('board.choosePlayCard')
                        : t('board.waitingTurn')}
                    </Text>
                  )
                ) : null}

            <View style={styles.fanContainer}>
              {self.hand.map((card, index) => {
                const total = self.hand.length;
                const half = Math.max((total - 1) / 2, 1);
                const dist = index - (total - 1) / 2;
                const norm = dist / half;
                const rotation = norm * 15;
                const lift = Math.pow(Math.abs(norm), 2) * 18;
                const isPlayPhase =
                  game.gamePhase === 'play' && !game.isSpectator;
                const playable =
                  isPlayPhase &&
                  isMyTurn &&
                  isCardPlayable(
                    self.hand,
                    card,
                    game.currentField,
                    currentTrump,
                  );
                const isSelected = selectedCard === card;
                return (
                  <View
                    key={`${card}-${index}`}
                    style={[
                      styles.fanCard,
                      total > 1 && { marginHorizontal: handCardMargin },
                      {
                        transform: [
                          { rotate: `${rotation}deg` },
                          { translateY: lift + (isSelected ? -28 : 0) },
                        ],
                      },
                    ]}
                  >
                    <DealtCard
                      cue={dealAnimationCue}
                      index={index}
                      reducedMotion={reducedMotion}
                      seatId={self.seatId}
                    >
                      <PlayingCard
                        card={card}
                        width={handCardWidth}
                        disabled={
                          isPlayPhase &&
                          (actionsDisabled ||
                            !playable ||
                            Boolean(pendingAction))
                        }
                        onPress={
                          isPlayPhase
                            ? () => toggleSelectedCard(card)
                            : undefined
                        }
                        selected={isSelected}
                      />
                    </DealtCard>
                  </View>
                );
              })}
            </View>

            {game.gamePhase === 'play' && selectedCard ? (
              <View style={styles.selectedActions}>
                {/* Cancel sits left, confirm right — the destructive/back action
                    on the outside, the primary action under the thumb. */}
                <Button
                  disabled={actionsDisabled || Boolean(pendingAction)}
                  onPress={() => {
                    onCancel();
                    setSelectedCard(null);
                  }}
                  style={styles.actionButton}
                  variant="secondary"
                >
                  {t('common.cancel')}
                </Button>
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
                  {mustSelectNegri ? t('board.setNegri') : t('board.play')}
                </Button>
              </View>
            ) : null}
              </View>
            </View>
            {game.gamePhase === 'play' && self && (() => {
              const myFields = game.fields.filter(
                (field) => field.winnerTeam === self.team,
              );
              if (myFields.length === 0) return null;
              return (
                <View style={styles.completedWrap}>
                  {myFields.map((field, idx) => (
                    <View key={idx} style={styles.completedChip}>
                      {field.cards.map((card, ci) => (
                        <MiniCard card={card} key={ci} />
                      ))}
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>
        ) : null}
      </ScrollView>

      {game.paused ? (
        <View style={styles.pausedOverlay}>
          <Text style={styles.pausedTitle}>{t('board.pausedTitle')}</Text>
          <Text style={styles.pausedText}>{t('board.pausedText')}</Text>
          {isHost ? (
            <View style={styles.pausedReplaceSection}>
              {game.players
                .filter(
                  (p) =>
                    !p.isCOM &&
                    game.disconnectedSeatIds.includes(p.seatId),
                )
                .map((p) => (
                  <Pressable
                    key={p.seatId}
                    onPress={() => onReplaceWithCOM(p.seatId)}
                    style={styles.pausedReplaceButton}
                  >
                    <Text style={styles.pausedReplaceButtonText}>
                      {t('board.replaceNamed', { name: p.name })}
                    </Text>
                  </Pressable>
                ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setShowOptions(false)}
        transparent
        visible={showOptions}
      >
        <View style={styles.optionsOverlay}>
          <Pressable
            onPress={() => setShowOptions(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.optionsMenu}>
            <Pressable
              onPress={() => setShowOptions(false)}
              style={styles.optionsClose}
            >
              <Text style={styles.optionsCloseText}>×</Text>
            </Pressable>
            {currentTrump ? (
              <Button
                onPress={() => {
                  setShowStrength((v) => !v);
                  setShowOptions(false);
                }}
                variant="secondary"
              >
                {t('board.strengthOrder')}
              </Button>
            ) : null}
            {roomId ? (
              <Button
                onPress={() => {
                  setShowChat(true);
                  setShowOptions(false);
                }}
                variant="secondary"
              >
                {t('board.chat')}
              </Button>
            ) : null}
            {history ? (
              <Button
                onPress={() => {
                  history.refresh();
                  setShowHistory(true);
                  setShowOptions(false);
                }}
                variant="secondary"
              >
                {t('board.gameLog')}
              </Button>
            ) : null}
            <Button
              disabled={actionsDisabled || leaving}
              loading={leaving}
              onPress={() => {
                setShowOptions(false);
                handleLeave();
              }}
              variant="ghost"
              style={styles.optionsItemDanger}
            >
              {t('board.leave')}
            </Button>
          </View>
        </View>
      </Modal>

      {roomId ? (
        <Modal
          animationType="slide"
          onRequestClose={() => setShowChat(false)}
          transparent
          visible={showChat}
        >
          <View style={styles.chatOverlay}>
            <View style={styles.chatCard}>
              <View style={styles.chatHeader}>
                <Text style={styles.chatTitle}>{t('board.chat')}</Text>
                <Button
                  onPress={() => setShowChat(false)}
                  variant="ghost"
                >
                  {t('board.close')}
                </Button>
              </View>
              <ChatPanel roomId={roomId} />
            </View>
          </View>
        </Modal>
      ) : null}

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
                <Text style={styles.historyTitle}>{t('board.gameLog')}</Text>
                <Button
                  onPress={() => setShowHistory(false)}
                  variant="ghost"
                >
                  {t('board.close')}
                </Button>
              </View>
              <GameHistory
                error={history.error}
                loading={history.loading}
                onRefresh={history.refresh}
                players={game.players}
                replay={history.replay}
                summary={history.summary}
                teamNames={game.teamNames}
              />
            </View>
          </View>
        </Modal>
      ) : null}

      {firstTurnReveal ? (
        <StartPlayerJanken
          onDone={onFirstTurnRevealDone ?? noop}
          players={game.players}
          reveal={firstTurnReveal}
        />
      ) : null}
    </View>
  );
}

const noop = () => {};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
  },
  scrollContent: {
    gap: 10,
    padding: 10,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phase: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '800',
  },
  trumpBadge: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.panelStrong,
    overflow: 'hidden',
  },
  optionsButton: {
    width: 40,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  optionsButtonText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  optionsOverlay: {
    flex: 1,
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 10,
    backgroundColor: colors.overlay,
  },
  optionsMenu: {
    position: 'relative',
    zIndex: 1,
    width: 200,
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  optionsClose: {
    alignSelf: 'flex-end',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionsCloseText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  optionsItemDanger: {
    borderColor: colors.danger,
  },
  strengthPanel: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.panelStrong,
  },
  strengthOrder: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  opponentsArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  seatLeft: {
    marginTop: 24,
  },
  seatTop: {
    marginTop: 0,
  },
  seatRight: {
    marginTop: 24,
  },
  replacePanel: {
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.panelStrong,
  },
  replacePanelHeader: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '800',
  },
  replacePanelButton: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.danger,
  },
  replacePanelButtonText: {
    color: colors.onDanger,
    fontSize: 11,
    fontWeight: '800',
  },
  field: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  fieldCenter: {
    width: 180,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldCardAbsolute: {
    position: 'absolute',
    alignItems: 'center',
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
  completedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingVertical: 4,
  },
  completedChip: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 4,
    backgroundColor: colors.backgroundElevated,
  },
  handSection: {
    gap: 8,
  },
  selfRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selfCard: {
    minWidth: 64,
    maxWidth: 92,
    flexBasis: '22%',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 3,
    padding: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  selfCardTurn: {
    borderColor: colors.gold,
    borderWidth: 2,
  },
  selfAvatar: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.gold,
  },
  selfComAvatar: {
    backgroundColor: colors.backgroundElevated,
  },
  selfAvatarText: {
    color: colors.text,
    fontSize: 24,
  },
  selfName: {
    maxWidth: 70,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  selfTeamBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.panelStrong,
    borderWidth: 1,
  },
  selfTeamBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  selfFieldCountText: {
    color: colors.textMuted,
    fontSize: 9,
    marginTop: 1,
  },
  selfSpecialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  selfSpecialLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  handArea: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  instruction: {
    color: colors.textMuted,
    fontSize: 13,
  },
  fanContainer: {
    minHeight: 104,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingTop: 16,
    paddingBottom: 4,
  },
  fanCard: {
    zIndex: 1,
    // Web rotates hand cards about their bottom edge
    // (PlayerHand/index.module.scss: transform-origin: bottom center).
    // Without this the fan pivots about each card's centre and splays wrongly.
    transformOrigin: 'bottom center',
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
  pausedReplaceSection: {
    gap: 10,
    marginTop: 16,
    width: '80%',
    maxWidth: 300,
  },
  pausedReplaceButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
  },
  pausedReplaceButtonText: {
    color: colors.onDanger,
    fontSize: 15,
    fontWeight: '800',
  },
  chatOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  chatCard: {
    maxHeight: '80%',
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.background,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  chatTitle: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '800',
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
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Horizontal inset lives on historyCard so the header, the table and the
    // sheet edge all line up.
    paddingTop: 16,
    paddingBottom: 8,
  },
  historyTitle: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '800',
  },
});
