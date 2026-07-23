import type { PlayerContract } from '@meitra/contracts/game';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface PlayerSeatProps {
  player: PlayerContract;
  isTurn: boolean;
  isSelf?: boolean;
  declaration?: string;
}

export function PlayerSeat({
  player,
  isTurn,
  isSelf = false,
  declaration,
}: PlayerSeatProps) {
  return (
    <View
      accessibilityLabel={`${player.name}${isSelf ? '、あなた' : ''}、${
        isTurn ? '現在の手番' : '手番待ち'
      }、手札${player.hand.length}枚`}
      style={[styles.container, isTurn && styles.turn]}
    >
      <View style={[styles.avatar, player.isCOM && styles.comAvatar]}>
        <Text style={styles.avatarText}>{player.isCOM ? '🤖' : '●'}</Text>
      </View>
      <Text numberOfLines={1} style={styles.name}>
        {player.name}
        {isSelf ? '（あなた）' : ''}
      </Text>
      <Text style={styles.meta}>
        {player.hand.length}枚・チーム{player.team + 1}
      </Text>
      {declaration ? <Text style={styles.declaration}>{declaration}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 104,
    maxWidth: 148,
    flexShrink: 1,
    alignItems: 'center',
    gap: 3,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  turn: {
    borderColor: colors.gold,
    borderWidth: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.gold,
  },
  comAvatar: {
    backgroundColor: colors.backgroundElevated,
  },
  avatarText: {
    color: colors.text,
    fontSize: 21,
  },
  name: {
    maxWidth: 132,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  declaration: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
  },
});
