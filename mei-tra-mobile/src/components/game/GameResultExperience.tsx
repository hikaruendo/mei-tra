import {
  GAME_RESULT_REVEAL_MS,
  type GameResultSnapshot,
} from "@meitra/game-client/game-result";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { t } from "@/i18n";
import { getTeamDisplayName } from "@/lib/team-labels";
import { colors } from "@/theme/colors";

interface Props {
  result: GameResultSnapshot;
  onClose: () => void;
  onRegister?: () => void;
}

const SUITS = ["♠", "♥", "♦", "♣"];

export function GameResultExperience({ result, onClose, onRegister }: Props) {
  const [revealing, setRevealing] = useState(true);
  const progress = useRef(new Animated.Value(0)).current;
  const winner = result.teams[0];
  const winnerName = getTeamDisplayName(winner.team, result.teamNames);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!mounted || reduced) {
        if (mounted) setRevealing(false);
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration: GAME_RESULT_REVEAL_MS,
        useNativeDriver: true,
      }).start();
      timer = setTimeout(() => setRevealing(false), GAME_RESULT_REVEAL_MS);
    });
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      progress.stopAnimation();
    };
  }, [progress, result.token]);

  const headline =
    result.viewerRole === "winner"
      ? t("result.victory")
      : result.viewerRole === "loser"
        ? t("result.defeat")
        : t("result.spectatorVictory", { team: winnerName });

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={revealing ? () => setRevealing(false) : onClose}
    >
      <SafeAreaView style={styles.overlay}>
        {revealing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("result.tapToSkip")}
            onPress={() => setRevealing(false)}
            style={styles.revealPressable}
          >
            {SUITS.map((suit, index) => (
              <Animated.Text
                key={suit}
                style={[
                  styles.suit,
                  {
                    opacity: progress.interpolate({
                      inputRange: [0, 0.15, 0.75, 1],
                      outputRange: [0, 0.8, 0.55, 0],
                    }),
                    transform: [
                      { rotate: `${index * 90}deg` },
                      {
                        translateX: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [12, 150],
                        }),
                      },
                      { rotate: `${index * -90}deg` },
                    ],
                  },
                ]}
              >
                {suit}
              </Animated.Text>
            ))}
            <Animated.View
              style={[
                styles.reveal,
                result.viewerRole === "loser" && styles.revealLoser,
                {
                  opacity: progress.interpolate({
                    inputRange: [0, 0.16, 1],
                    outputRange: [0, 1, 1],
                  }),
                  transform: [
                    {
                      scale: progress.interpolate({
                        inputRange: [0, 0.3, 1],
                        outputRange: [0.72, 1, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.crownSuit}>♠</Text>
              <Text
                adjustsFontSizeToFit
                numberOfLines={2}
                style={styles.revealTitle}
              >
                {headline}
              </Text>
              <Text style={styles.revealTeam}>{winnerName}</Text>
              <Text style={styles.skip}>{t("result.tapToSkip")}</Text>
            </Animated.View>
          </Pressable>
        ) : (
          <ScrollView
            accessible
            contentContainerStyle={styles.panel}
            style={styles.panelScroll}
          >
            <Text style={styles.kicker}>{t("result.kicker")}</Text>
            <Text style={styles.title}>{t("result.finalResult")}</Text>
            <Text style={styles.headline}>{headline}</Text>
            {result.teams.map((team, index) => (
              <View
                key={team.team}
                style={[styles.team, index === 0 && styles.champion]}
              >
                <View style={styles.teamHeading}>
                  <View style={styles.teamNameWrap}>
                    {index === 0 ? (
                      <Text style={styles.badge}>
                        {t("result.winnerBadge")}
                      </Text>
                    ) : null}
                    <Text style={styles.teamName}>
                      {getTeamDisplayName(team.team, result.teamNames)}
                    </Text>
                  </View>
                  <Text style={styles.score}>
                    {t("result.points", { score: team.total })}
                  </Text>
                </View>
                <View style={styles.members}>
                  {team.members.map((member) => (
                    <View key={member.seatId} style={styles.member}>
                      <Text style={styles.initial}>{member.initial}</Text>
                      <Text numberOfLines={1} style={styles.memberName}>
                        {member.name}
                        {member.isCOM ? ` ${t("result.com")}` : ""}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
            {onRegister ? (
              <View style={styles.guestBox}>
                <Text style={styles.guestText}>{t("board.guestPrompt")}</Text>
                <Button variant="ghost" onPress={onRegister}>
                  {t("board.registerAccount")}
                </Button>
              </View>
            ) : null}
            <Button onPress={onClose}>{t("result.toRooms")}</Button>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: colors.background,
  },
  revealPressable: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  reveal: { alignItems: "center", maxWidth: "92%" },
  revealLoser: { opacity: 0.8 },
  crownSuit: { color: colors.gold, fontSize: 44 },
  revealTitle: {
    color: colors.gold,
    fontFamily: "serif",
    fontSize: 64,
    fontWeight: "800",
    letterSpacing: 5,
    textAlign: "center",
  },
  revealTeam: { color: colors.text, fontSize: 22, marginTop: 8 },
  skip: { color: colors.textMuted, fontSize: 13, marginTop: 42 },
  suit: { position: "absolute", color: colors.gold, fontSize: 26 },
  panelScroll: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "96%",
    borderRadius: 24,
    backgroundColor: colors.panel,
  },
  panel: {
    padding: 22,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 24,
  },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    letterSpacing: 4,
    textAlign: "center",
  },
  title: {
    color: colors.text,
    fontFamily: "serif",
    fontSize: 36,
    fontWeight: "700",
    textAlign: "center",
  },
  headline: {
    color: colors.gold,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 18,
    textAlign: "center",
  },
  team: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    marginBottom: 10,
  },
  champion: { borderColor: colors.gold, backgroundColor: colors.goldSubtle },
  teamHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  teamNameWrap: { flex: 1 },
  badge: { color: colors.gold, fontSize: 10, letterSpacing: 2 },
  teamName: { color: colors.text, fontSize: 20, fontWeight: "700" },
  score: { color: colors.gold, fontSize: 20, fontWeight: "800" },
  members: { gap: 7, marginTop: 10 },
  member: { flexDirection: "row", alignItems: "center", gap: 9 },
  initial: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 16,
    color: colors.gold,
    lineHeight: 30,
    textAlign: "center",
  },
  memberName: { flex: 1, color: colors.text, fontSize: 15 },
  guestBox: {
    gap: 8,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.goldSubtle,
  },
  guestText: { color: colors.textMuted, textAlign: "center" },
});
