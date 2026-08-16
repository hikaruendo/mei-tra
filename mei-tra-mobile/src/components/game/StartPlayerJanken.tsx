import {
  buildFirstTurnRevealScript,
  type FirstTurnRevealScript,
  type JankenHand,
} from '@meitra/game-client/first-turn-reveal';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '@/theme/colors';
import type { MobileFirstTurnReveal } from '@/context/GameContext';
import type { MobilePlayer } from '@/types/game';

interface StartPlayerJankenProps {
  reveal: MobileFirstTurnReveal;
  players: MobilePlayer[];
  onDone: () => void;
}

const HAND_GLYPHS: Record<JankenHand, string> = {
  rock: '✊',
  scissors: '✌️',
  paper: '✋',
};

const CAPTIONS = {
  chant: 'ジャンケン…',
  ready: 'シュッ！',
  draw: 'あいこ！',
  showdown: 'シュ！',
} as const;

/**
 * Plays the game-start "ジャンケンシュッシュ" reveal, landing on the seat the
 * server already chose. The loser of the janken blows first.
 */
export function StartPlayerJanken({
  reveal,
  players,
  onDone,
}: StartPlayerJankenProps) {
  const [state, setState] = useState<{
    script: FirstTurnRevealScript;
    stepIndex: number;
  } | null>(null);

  const playersRef = useRef(players);
  playersRef.current = players;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reducedMotion) => {
        if (cancelled) return;

        const script = buildFirstTurnRevealScript({
          seatIds: playersRef.current.map((player) => player.seatId),
          firstTurnSeatId: reveal.seatId,
          roomId: reveal.roomId,
          reducedMotion,
        });

        if (!script) {
          onDoneRef.current();
          return;
        }

        setState({ script, stepIndex: 0 });

        let elapsed = 0;
        script.steps.forEach((step, index) => {
          elapsed += step.durationMs;
          const isLast = index === script.steps.length - 1;
          timers.push(
            setTimeout(() => {
              if (isLast) {
                onDoneRef.current();
                return;
              }
              setState((current) =>
                current ? { ...current, stepIndex: index + 1 } : current,
              );
            }, elapsed),
          );
        });
      });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [reveal]);

  if (!state) {
    return null;
  }

  const step = state.script.steps[state.stepIndex];
  if (!step) {
    return null;
  }

  const firstTurnName =
    players.find((player) => player.seatId === reveal.seatId)?.name ?? '';
  const caption =
    step.kind === 'result'
      ? `${firstTurnName} から吹き始め`
      : CAPTIONS[step.kind];

  return (
    <Modal animationType="fade" transparent visible>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.hands}>
            {players.map((player) => {
              const hand = step.hands?.[player.seatId];
              const isFirstTurn = player.seatId === reveal.seatId;
              const isWinnerRow = step.kind === 'result' && isFirstTurn;

              return (
                <View
                  key={player.seatId}
                  style={[styles.handRow, isWinnerRow && styles.handRowWinner]}
                >
                  <Text style={styles.glyph}>
                    {hand ? HAND_GLYPHS[hand] : HAND_GLYPHS.rock}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.name, isWinnerRow && styles.nameWinner]}
                  >
                    {player.name}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.caption,
              step.kind === 'result' && styles.captionResult,
            ]}
          >
            {caption}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
    padding: 24,
  },
  panel: {
    width: '100%',
    maxWidth: 340,
    gap: 16,
    padding: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  hands: {
    gap: 8,
  },
  handRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelStrong,
  },
  handRowWinner: {
    borderColor: colors.gold,
  },
  glyph: {
    fontSize: 26,
  },
  name: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  nameWinner: {
    color: colors.goldStrong,
  },
  caption: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  captionResult: {
    color: colors.goldStrong,
  },
});
