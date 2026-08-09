import type { PlayerContract, TeamNames } from '@meitra/contracts/game';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlayingCard } from '@/components/game/PlayingCard';
import { TurnClock } from '@/components/game/TurnClock';
import { getTeamDisplayName } from '@/lib/team-labels';
import { CARD_BASE_WIDTHS, cardStackMargin } from '@/theme/cards';
import { colors, teamColors } from '@/theme/colors';

interface PlayerSeatProps {
  player: PlayerContract;
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
}: PlayerSeatProps) {
  const statusLabel = isDisconnected
    ? '切断中'
    : isIdle
      ? '無操作'
      : isTurn
        ? '現在の手番'
        : '手番待ち';

  const faceDownCount = Math.min(player.hand.length, 5);

  const content = (
    <View
      accessibilityLabel={`${player.name}${isSelf ? '、あなた' : ''}、${statusLabel}、手札${player.hand.length}枚`}
      style={[
        styles.container,
        isTurn && styles.turn,
        isDisconnected && styles.disconnected,
        isIdle && styles.idle,
      ]}
    >
      {isBlowWinner && declaration ? (
        <View style={styles.declarationBadge}>
          <Text style={styles.declarationBadgeText}>アゲ: {declaration}</Text>
        </View>
      ) : null}
      <View style={styles.avatarRow}>
        <View style={[styles.avatar, player.isCOM && styles.comAvatar]}>
          <Text style={styles.avatarText}>{player.isCOM ? '🤖' : '●'}</Text>
        </View>
        {isTurn ? <TurnClock size={22} /> : null}
      </View>
      <Text numberOfLines={1} style={styles.name}>
        {player.name}
        {isSelf ? '（あなた）' : ''}
      </Text>
      <View style={[styles.teamBadge, { borderColor: teamColors[player.team] }]}>
        <Text style={[styles.teamBadgeText, { color: teamColors[player.team] }]}>
          {getTeamDisplayName(player.team, teamNames)}
        </Text>
      </View>
      {teamFieldCounts ? (
        <Text style={styles.fieldCountText}>
          取得 {teamFieldCounts[player.team] ?? 0}場
        </Text>
      ) : null}
      {isDisconnected ? (
        <Text style={styles.statusBadge}>切断中</Text>
      ) : isIdle ? (
        <Text style={styles.statusBadge}>無操作</Text>
      ) : null}
      {negriCard ? (
        <View style={styles.specialCardRow}>
          <PlayingCard faceDown size="seat" />
          <Text style={styles.specialCardLabel}>ネグリ</Text>
        </View>
      ) : null}
      {agariCard ? (
        <View style={styles.specialCardRow}>
          <PlayingCard card={agariCard} size="seat" />
          <Text style={styles.specialCardLabel}>アゲ</Text>
        </View>
      ) : null}
      {faceDownCount > 0 ? (
        <View style={styles.faceDownRow}>
          {Array.from({ length: faceDownCount }).map((_, i) => (
            <View key={i} style={i > 0 ? styles.faceDownOverlap : undefined}>
              <PlayingCard faceDown size="seat" />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityHint="タップで視点を切り替え"
        accessibilityRole="button"
        onPress={onPress}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  container: {
    minWidth: 0,
    flex: 1,
    maxWidth: 110,
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
    borderColor: colors.gold,
    borderWidth: 2,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.gold,
  },
  comAvatar: {
    backgroundColor: colors.backgroundElevated,
  },
  avatarText: {
    color: colors.text,
    fontSize: 17,
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
