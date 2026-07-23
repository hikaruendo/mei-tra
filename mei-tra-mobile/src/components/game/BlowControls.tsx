import type {
  BlowDeclarationContract,
  PlayerContract,
  TrumpType,
} from '@meitra/contracts/game';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors } from '@/theme/colors';
import { getValidBlowPairValues } from '@meitra/game-client/blow';

const trumpOptions: { value: TrumpType; label: string }[] = [
  { value: 'zuppe', label: 'ズッペ ♠' },
  { value: 'club', label: 'クラブ ♣' },
  { value: 'daiya', label: 'ダイヤ ♦' },
  { value: 'herz', label: 'ヘルツ ♥' },
  { value: 'tra', label: 'トラ' },
];

const declarationLabel = (declaration: BlowDeclarationContract | null) => {
  if (!declaration) return 'まだ宣言はありません';
  const trump = trumpOptions.find(
    (option) => option.value === declaration.trumpType,
  );
  return `${trump?.label ?? declaration.trumpType}・${declaration.numberOfPairs}ペア`;
};

interface BlowControlsProps {
  players: PlayerContract[];
  currentTurn: string | null;
  currentPlayerId: string | null;
  highest: BlowDeclarationContract | null;
  onDeclare: (trump: TrumpType, pairs: number) => void;
  onPass: () => void;
  actionsDisabled?: boolean;
}

export function BlowControls({
  players,
  currentTurn,
  currentPlayerId,
  highest,
  onDeclare,
  onPass,
  actionsDisabled = false,
}: BlowControlsProps) {
  const [selectedTrump, setSelectedTrump] = useState<TrumpType | null>(null);
  const [selectedPairs, setSelectedPairs] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<'declare' | 'pass' | null>(
    null,
  );
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMyTurn = currentTurn === currentPlayerId;
  const turnName =
    players.find((player) => player.playerId === currentTurn)?.name ?? '—';

  const validPairs = useMemo(
    () => getValidBlowPairValues(highest, selectedTrump),
    [highest, selectedTrump],
  );

  useEffect(() => {
    if (selectedPairs && !validPairs.includes(selectedPairs)) {
      setSelectedPairs(null);
    }
  }, [selectedPairs, validPairs]);

  useEffect(() => {
    setPendingAction(null);
    if (actionsDisabled) {
      setSelectedTrump(null);
      setSelectedPairs(null);
    }
  }, [actionsDisabled, currentTurn, highest]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const markPending = (action: 'declare' | 'pass') => {
    setPendingAction(action);
    timeoutRef.current = setTimeout(() => setPendingAction(null), 1800);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.turn}>
        現在の宣言順: {turnName}
        {isMyTurn ? '（あなた）' : ''}
      </Text>
      <Text style={styles.highest}>最高宣言: {declarationLabel(highest)}</Text>

      <Text style={styles.label}>キリ（切り札）を選択</Text>
      <ScrollView
        horizontal
        contentContainerStyle={styles.options}
        showsHorizontalScrollIndicator={false}
      >
        {trumpOptions.map((option) => (
          <Button
            key={option.value}
            variant={selectedTrump === option.value ? 'primary' : 'ghost'}
            disabled={actionsDisabled || !isMyTurn || Boolean(pendingAction)}
            onPress={() => setSelectedTrump(option.value)}
            style={styles.optionButton}
          >
            {option.label}
          </Button>
        ))}
      </ScrollView>

      <Text style={styles.label}>ペア数を選択</Text>
      <ScrollView
        horizontal
        contentContainerStyle={styles.options}
        showsHorizontalScrollIndicator={false}
      >
        {validPairs.map((pair) => (
          <Button
            key={pair}
            variant={selectedPairs === pair ? 'primary' : 'ghost'}
            disabled={actionsDisabled || !isMyTurn || Boolean(pendingAction)}
            onPress={() => setSelectedPairs(pair)}
            style={styles.pairButton}
          >
            {pair}
          </Button>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <Button
          disabled={
            !isMyTurn ||
            actionsDisabled ||
            Boolean(pendingAction) ||
            !selectedTrump ||
            !selectedPairs
          }
          loading={pendingAction === 'declare'}
          onPress={() => {
            if (!selectedTrump || !selectedPairs) return;
            markPending('declare');
            onDeclare(selectedTrump, selectedPairs);
            setSelectedTrump(null);
            setSelectedPairs(null);
          }}
          style={styles.action}
        >
          宣言
        </Button>
        <Button
          variant="secondary"
          disabled={actionsDisabled || !isMyTurn || Boolean(pendingAction)}
          loading={pendingAction === 'pass'}
          onPress={() => {
            markPending('pass');
            onPass();
          }}
          style={styles.action}
        >
          パス
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  turn: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  highest: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '700',
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
  },
  options: {
    gap: 8,
  },
  optionButton: {
    minHeight: 44,
    paddingHorizontal: 12,
  },
  pairButton: {
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  action: {
    flex: 1,
  },
});
