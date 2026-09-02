import type { TeamNames } from '@meitra/contracts/game';
import type { DealAnimationCue } from '@meitra/game-client/deal-animation';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlayingCard } from '@/components/game/PlayingCard';
import { DealtCard } from '@/components/game/DealtCard';
import { TurnClock } from '@/components/game/TurnClock';
import { PlayerAvatar } from '@/components/game/PlayerAvatar';
import { getTeamDisplayName } from '@/lib/team-labels';
import { CARD_BASE_WIDTHS, cardStackMargin } from '@/theme/cards';
import { colors, teamColors } from '@/theme/colors';
import type { MobilePlayer } from '@/types/game';
import { t } from '@/i18n';

interface PlayerSeatProps {
  player: MobilePlayer;
  isTurn: boolean;
  isSelf?: boolean;
  declaration?: string;
  isBlowWinner?: boolean;
  isDisconnected?: boolean;
  isIdle?: boolean;
  negriCard?: string;
  agariCard?: string;
  teamNames?: TeamNames;
  teamFieldCounts?: Record<number, number>;
  onPress?: () => void;
  dealAnimationCue?: DealAnimationCue | null;
  reducedMotion?: boolean | null;
}

export function PlayerSeat({
  player,
  isTurn,
  isSelf = false,
  declaration,
  isBlowWinner = false,
  isDisconnected = false,
  isIdle = false,
  negriCard,
  agariCard,
  teamNames,
  teamFieldCounts,
  onPress,
  dealAnimationCue = null,
  reducedMotion = false,
}: PlayerSeatProps) {
  const statusLabel = isDisconnected
    ? t('seat.disconnected')
    : isIdle
      ? t('seat.idle')
      : isTurn
        ? t('seat.currentTurn')
        : t('seat.waitingTurn');

  const faceDownCount = Math.min(player.hand.length, 5);

  return (
    <Pressable
      accessibilityLabel={t('seat.a11yLabel', {
        name: player.name,
        self: isSelf ? t('seat.a11ySelf') : '',
        status: statusLabel,
        count: player.hand.length,
      })}
      accessibilityHint={onPress ? t('seat.switchPerspective') : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      testID={`player-seat-${player.seatId}`}
      style={[
        styles.container,
        isTurn && styles.turn,
        isDisconnected && styles.disconnected,
        isIdle && styles.idle,
      ]}
    >
      {isBlowWinner && declaration ? (
        <View style={styles.declarationBadge}>
          <Text style={styles.declarationBadgeText}>
            {t('seat.agari', { card: declaration })}
          </Text>
        </View>
      ) : null}
      {isTurn ? (
        <View style={styles.turnBadgeSlot}>
          <TurnClock size={22} />
        </View>
      ) : null}
      <PlayerAvatar player={player} size={32} />
      <Text numberOfLines={1} style={styles.name}>
        {player.name}
        {isSelf ? t('blow.youSuffix') : ''}
      </Text>
      <View style={[styles.teamBadge, { borderColor: teamColors[player.team] }]}>
        <Text style={[styles.teamBadgeText, { color: teamColors[player.team] }]}>
          {getTeamDisplayName(player.team, teamNames)}
        </Text>
      </View>
      {teamFieldCounts ? (
        <Text style={styles.fieldCountText}>
          {t('seat.fieldsWon', { count: teamFieldCounts[player.team] ?? 0 })}
        </Text>
      ) : null}
      {isDisconnected ? (
        <Text style={styles.statusBadge}>{t('seat.disconnected')}</Text>
      ) : isIdle ? (
        <Text style={styles.statusBadge}>{t('seat.idle')}</Text>
      ) : null}
      {negriCard ? (
        <View style={styles.specialCardRow}>
          <PlayingCard faceDown size="seat" />
          <Text style={styles.specialCardLabel}>{t('seat.negri')}</Text>
        </View>
      ) : null}
      {agariCard ? (
        <View style={styles.specialCardRow}>
          <PlayingCard card={agariCard} size="seat" />
          <Text style={styles.specialCardLabel}>{t('seat.agariShort')}</Text>
        </View>
      ) : null}
      {faceDownCount > 0 ? (
        <View style={styles.faceDownRow}>
          {Array.from({ length: faceDownCount }).map((_, i) => (
            <View key={i} style={i > 0 ? styles.faceDownOverlap : undefined}>
              <DealtCard
                cue={dealAnimationCue}
                index={i}
                reducedMotion={reducedMotion}
                seatId={player.seatId}
              >
                <PlayingCard faceDown size="seat" />
              </DealtCard>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  turnBadgeSlot: {
    // Overhangs the seat's top-right corner, matching web's .avatarTurnBadge
    // (top: -0.32rem; right: -0.4rem).
    position: 'absolute',
    top: -6,
    right: -7,
    zIndex: 4,
  },
  container: {
    width: '100%',
    minWidth: 0,
    maxWidth: 110,
    flexGrow: 0,
    flexShrink: 1,
    alignItems: 'center',
    gap: 2,
    padding: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  turn: {
    borderColor: colors.turnRing,
    borderWidth: 2,
  },
  name: {
    maxWidth: 96,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  teamBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.panelStrong,
    borderWidth: 1,
  },
  teamBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  disconnected: {
    opacity: 0.5,
  },
  idle: {
    borderColor: colors.warning,
    borderWidth: 2,
  },
  statusBadge: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '700',
  },
  declarationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.backgroundElevated,
  },
  declarationBadgeText: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  specialCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  specialCardLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  fieldCountText: {
    color: colors.textMuted,
    fontSize: 9,
  },
  faceDownRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  faceDownOverlap: {
    marginLeft: cardStackMargin(CARD_BASE_WIDTHS.seat),
  },
});
