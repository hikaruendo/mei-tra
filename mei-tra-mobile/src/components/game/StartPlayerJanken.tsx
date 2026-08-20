import {
  buildFirstTurnRevealScript,
  isFirstTurnRevealStale,
  JANKEN_HAND_PATHS,
  type FirstTurnRevealScript,
  type JankenHand,
} from '@meitra/game-client/first-turn-reveal';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme/colors';
import type { MobileFirstTurnReveal } from '@/context/GameContext';
import type { MobilePlayer } from '@/types/game';
import { t } from '@/i18n';

interface StartPlayerJankenProps {
  reveal: MobileFirstTurnReveal;
  players: MobilePlayer[];
  onDone: () => void;
}

// Catalogue keys; read through t() so both locales render.
const CAPTION_KEYS = {
  chant: 'janken.chant',
  ready: 'janken.ready',
  showdown: 'janken.showdown',
} as const;

function HandGlyph({ hand, winner }: { hand: JankenHand; winner?: boolean }) {
  return (
    <Svg width={34} height={34} viewBox="0 0 64 64">
      {JANKEN_HAND_PATHS[hand].map((d) => (
        <Path
          key={d}
          d={d}
          fill="none"
          stroke={winner ? colors.goldStrong : colors.text}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

/**
 * Plays the game-start "ジャンケンシュッシュ" reveal. Per the original rule
 * the janken winner blows last (吹き上げ); their neighbor blows first.
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

        // A reveal armed while this screen was closed (e.g. the user was on
        // the room list at game start) must not replay minutes later.
        if (isFirstTurnRevealStale(reveal, Date.now())) {
          onDoneRef.current();
          return;
        }

        const script = buildFirstTurnRevealScript({
          seatIds: playersRef.current.map((player) => player.seatId),
          firstTurnSeatId: reveal.seatId,
          lastBlowSeatId: reveal.lastBlowSeatId,
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

  const nameOf = (seatId: string) =>
    players.find((player) => player.seatId === seatId)?.name ?? '';
  const isResult = step.kind === 'result';

  return (
    <Modal animationType="fade" transparent visible>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          {step.kind !== 'result' ? (
            <Text
              style={[
                styles.chant,
                step.kind !== 'chant' && styles.chantPunch,
              ]}
            >
              {t(CAPTION_KEYS[step.kind])}
            </Text>
          ) : null}

          <View style={styles.hands}>
            {players.map((player) => {
              const hand = step.hands?.[player.seatId] ?? 'rock';
              const isWinner = player.seatId === reveal.lastBlowSeatId;
              const winnerRow = isResult && isWinner;
              const dimRow = isResult && !isWinner;

              return (
                <View
                  key={player.seatId}
                  style={[
                    styles.handRow,
                    winnerRow && styles.handRowWinner,
                    dimRow && styles.handRowDim,
                  ]}
                >
                  <HandGlyph hand={hand} winner={winnerRow} />
                  <Text
                    numberOfLines={1}
                    style={[styles.name, winnerRow && styles.nameWinner]}
                  >
                    {player.name}
                  </Text>
                </View>
              );
            })}
          </View>

          {isResult ? (
            <View accessibilityLiveRegion="polite">
              <Text style={styles.verdict}>
                {t('janken.result', {
                  name: nameOf(reveal.lastBlowSeatId),
                })}
              </Text>
            </View>
          ) : null}
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
  chant: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  chantPunch: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
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
    shadowColor: colors.gold,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
    transform: [{ scale: 1.03 }],
  },
  handRowDim: {
    opacity: 0.35,
  },
  name: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  nameWinner: {
    color: colors.goldStrong,
    fontWeight: '800',
  },
  verdict: {
    color: colors.goldStrong,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
});
