import type {
  BlowActionContract,
  BlowDeclarationContract,
  TrumpType,
} from '@meitra/contracts/game';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { LiquidGlassSurface } from '@/components/ui/LiquidGlassSurface';
import { trumpLabel } from '@/lib/trump-labels';
import { colors } from '@/theme/colors';
import { getValidBlowPairValues } from '@meitra/game-client/blow';
import type { MobilePlayer } from '@/types/game';
import { t } from '@/i18n';

const TRUMP_ORDER: TrumpType[] = ['zuppe', 'club', 'daiya', 'herz', 'tra'];

const trumpOptions: { value: TrumpType; label: string }[] = TRUMP_ORDER.map(
  (value) => ({ value, label: trumpLabel(value) }),
);

const declarationLabel = (declaration: BlowDeclarationContract | null) => {
  if (!declaration) return t('blow.noDeclaration');
  const trump = trumpOptions.find(
    (option) => option.value === declaration.trumpType,
  );
  return t('blow.declarationSummary', {
    trump: trump?.label ?? declaration.trumpType,
    pairs: declaration.numberOfPairs,
  });
};

interface BlowControlsProps {
  players: MobilePlayer[];
  currentTurn: string | null;
  currentSeatId: string | null;
  highest: BlowDeclarationContract | null;
  actionHistory: BlowActionContract[];
  onDeclare: (trump: TrumpType, pairs: number) => void;
  onPass: () => void;
  actionsDisabled?: boolean;
}

export function BlowControls({
  players,
  currentTurn,
  currentSeatId,
  highest,
  actionHistory,
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
  const isMyTurn = currentTurn === currentSeatId;
  const turnName =
    players.find((player) => player.seatId === currentTurn)?.name ?? '—';

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
    <LiquidGlassSurface
      fallbackStyle={styles.containerFallback}
      style={styles.container}
      testID="blow-controls-surface"
    >
      <Text style={styles.turn}>
        {t('blow.currentTurn', { name: turnName })}
        {isMyTurn ? t('blow.youSuffix') : ''}
      </Text>
      <Text style={styles.highest}>
        {t('blow.highest', { label: declarationLabel(highest) })}
      </Text>

      <Text style={styles.label}>{t('blow.selectTrump')}</Text>
      <View testID="blow-trump-options" style={styles.trumpOptions}>
        {trumpOptions.map((option) => (
          <Button
            key={option.value}
            testID={`blow-trump-${option.value}`}
            variant={selectedTrump === option.value ? 'primary' : 'ghost'}
            disabled={actionsDisabled || !isMyTurn || Boolean(pendingAction)}
            onPress={() => setSelectedTrump(option.value)}
            style={styles.optionButton}
          >
            {option.label}
          </Button>
        ))}
      </View>

      <Text style={styles.label}>{t('blow.selectPairs')}</Text>
      <ScrollView
        horizontal
        contentContainerStyle={styles.options}
        showsHorizontalScrollIndicator={false}
      >
        {validPairs.map((pair) => (
          <Button
            key={pair}
            testID={`blow-pairs-${pair}`}
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
          testID="blow-declare"
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
          {t('blow.declare')}
        </Button>
        <Button
          testID="blow-pass"
          variant="secondary"
          disabled={actionsDisabled || !isMyTurn || Boolean(pendingAction)}
          loading={pendingAction === 'pass'}
          onPress={() => {
            markPending('pass');
            onPass();
          }}
          style={styles.action}
        >
          {t('blow.pass')}
        </Button>
      </View>

      {actionHistory.length > 0 ? (
        <View style={styles.historySection}>
          <Text style={styles.historyLabel}>{t('blow.history')}</Text>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.historyScroll}
          >
            {actionHistory.map((action, index) => {
              const name =
                players.find((p) => p.seatId === action.seatId)?.name ??
                '—';
              const isHighest =
                action.type === 'declare' &&
                highest?.seatId === action.seatId &&
                highest?.trumpType === action.trumpType &&
                highest?.numberOfPairs === action.numberOfPairs;
              const trump = action.trumpType
                ? trumpOptions.find((o) => o.value === action.trumpType)
                : null;
              return (
                <View
                  key={index}
                  style={[
                    styles.historyEntry,
                    isHighest && styles.historyEntryHighest,
                  ]}
                >
                  <Text style={styles.historyName}>{name}</Text>
                  <Text
                    style={[
                      styles.historyAction,
                      action.type === 'pass' && styles.historyPass,
                    ]}
                  >
                    {action.type === 'pass'
                      ? t('blow.pass')
                      : t('blow.historyEntry', {
                          trump: trump?.label ?? action.trumpType ?? '',
                          pairs: action.numberOfPairs ?? 0,
                        })}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </LiquidGlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    padding: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  containerFallback: {
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
  trumpOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    width: '30%',
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
  historySection: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  historyLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  historyScroll: {
    maxHeight: 72,
  },
  historyEntry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  historyEntryHighest: {
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.backgroundElevated,
  },
  historyName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  historyAction: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  historyPass: {
    color: colors.textMuted,
  },
});
