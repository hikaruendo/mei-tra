import type { TeamNames } from '@meitra/contracts/game';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { ChatPanel } from '@/components/social/ChatPanel';
import { Button } from '@/components/ui/Button';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { getTeamDisplayName } from '@/lib/team-labels';
import { colors, teamColors } from '@/theme/colors';
import type { MobileRoom } from '@/types/game';
import { t } from '@/i18n';

interface WaitingRoomProps {
  room: MobileRoom;
  currentSeatId: string | null;
  isHost: boolean;
  onShuffle: () => void;
  onStart: () => void;
  onLeave: () => void;
  onRemovePlayer: (seatId: string) => void;
  onReplaceWithCOM: (seatId: string) => void;
  onUpdateTeamNames: (teamNames: TeamNames) => void;
  actionsDisabled?: boolean;
}

export function WaitingRoom({
  room,
  currentSeatId,
  isHost,
  onShuffle,
  onStart,
  onLeave,
  onRemovePlayer,
  onReplaceWithCOM,
  onUpdateTeamNames,
  actionsDisabled = false,
}: WaitingRoomProps) {
  const canStart =
    isHost &&
    room.players.length === room.settings.maxPlayers;
  const { width } = useWindowDimensions();
  const [showChat, setShowChat] = useState(false);
  const [showTeamNameEditor, setShowTeamNameEditor] = useState(false);
  const [draftTeamNames, setDraftTeamNames] = useState<Record<0 | 1, string>>({
    0: '',
    1: '',
  });
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraftTeamNames({
      0: getTeamDisplayName(0, room.settings.teamNames),
      1: getTeamDisplayName(1, room.settings.teamNames),
    });
  }, [room.settings.teamNames]);

  useEffect(() => {
    setPendingAction(null);
  }, [actionsDisabled, room]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const runAction = (
    name: string,
    action: () => void,
  ) => {
    if (actionsDisabled || pendingAction) return;
    setPendingAction(name);
    action();
    timeoutRef.current = setTimeout(() => setPendingAction(null), 1800);
  };

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>{room.name}</Text>
        <Text style={styles.subtitle}>
          {t('waiting.seats', {
            current: room.players.length,
            max: room.settings.maxPlayers,
          })}
          {t('rooms.pointsSuffix', { points: room.settings.pointsToWin })}
        </Text>
      </View>

      <View style={[styles.teams, width < 380 && styles.teamsNarrow]}>
        {([0, 1] as const).map((team) => {
          const teamLabel = getTeamDisplayName(team, room.settings.teamNames);
          const teamColor = teamColors[team];
          return (
          <View key={team} style={styles.team}>
            <View style={styles.teamHeader}>
              <View style={[styles.teamBadge, { borderColor: teamColor }]}>
                <Text style={[styles.teamBadgeText, { color: teamColor }]}>
                  {teamLabel}
                </Text>
              </View>
            </View>
            {[0, 1].map((seat) => {
              const player = room.players.filter(
                (candidate) => candidate.team === team,
              )[seat];
              const canRemove =
                isHost &&
                player &&
                !player.isHost &&
                !player.isCOM &&
                player.seatId !== currentSeatId;
              const seatView = (
                <View
                  accessibilityLabel={t('waiting.seatA11y', {
                    name: player?.name ?? t('waiting.emptySeat'),
                    status: player
                      ? player.isHost
                        ? t('waiting.host')
                        : player.isCOM
                          ? 'COM'
                          : t('waiting.joined')
                      : t('waiting.waitingJoin'),
                  })}
                  accessibilityRole="text"
                  style={styles.seat}
                >
                  <Text style={styles.seatAvatar}>
                    {player?.isCOM ? '🤖' : player ? '●' : '○'}
                  </Text>
                  <View style={styles.seatText}>
                    <Text numberOfLines={1} style={styles.playerName}>
                      {player?.name ?? t('waiting.emptySeat')}
                    </Text>
                    <Text style={styles.ready}>
                      {player?.isHost
                        ? t('waiting.host')
                        : player?.isCOM
                          ? 'COM'
                          : player
                            ? t('waiting.joined')
                            : t('waiting.waitingJoin')}
                    </Text>
                  </View>
                </View>
              );
              if (canRemove) {
                return (
                  <Pressable
                    key={seat}
                    onLongPress={() => {
                      Alert.alert(
                        player.name,
                        t('waiting.playerActionTitle'),
                        [
                          {
                            text: t('waiting.replaceWithCom'),
                            onPress: () =>
                              onReplaceWithCOM(player.seatId),
                          },
                          {
                            text: t('waiting.removePlayer'),
                            style: 'destructive',
                            onPress: () =>
                              onRemovePlayer(player.seatId),
                          },
                          { text: t('common.cancel'), style: 'cancel' },
                        ],
                      );
                    }}
                  >
                    {seatView}
                  </Pressable>
                );
              }
              return (
                <View key={seat}>{seatView}</View>
              );
            })}
          </View>
          );
        })}
      </View>

      {isHost ? (
        showTeamNameEditor ? (
          <View style={styles.teamNamePanel}>
            <View style={styles.teamNamePanelHeader}>
              <Text style={styles.teamNamePanelTitle}>{t('waiting.teamNames')}</Text>
              {([0, 1] as const).map((team) => (
                <View
                  key={team}
                  style={[
                    styles.teamColorDot,
                    { borderColor: teamColors[team] },
                  ]}
                >
                  <Text style={[styles.teamColorDotText, { color: teamColors[team] }]}>
                    {draftTeamNames[team].slice(0, 1) || `${team + 1}`}
                  </Text>
                </View>
              ))}
              <Pressable onPress={() => setShowTeamNameEditor(false)}>
                <Text style={styles.teamNameClose}>{t('waiting.close')}</Text>
              </Pressable>
            </View>
            {([0, 1] as const).map((team) => (
              <View key={team} style={styles.teamNameRow}>
                <View
                  style={[
                    styles.teamColorLabel,
                    { borderColor: teamColors[team] },
                  ]}
                >
                  <Text style={[styles.teamColorLabelText, { color: teamColors[team] }]}>
                    {team === 0 ? t('team.red') : t('team.black')}
                  </Text>
                </View>
                <TextInput
                  maxLength={16}
                  onChangeText={(text) =>
                    setDraftTeamNames((prev) => ({ ...prev, [team]: text }))
                  }
                  placeholder={getTeamDisplayName(team)}
                  placeholderTextColor={colors.textMuted}
                  style={styles.teamNameInput}
                  value={draftTeamNames[team]}
                />
              </View>
            ))}
            <Button
              disabled={actionsDisabled}
              onPress={() => {
                const names: TeamNames = {};
                if (draftTeamNames[0].trim()) names[0] = draftTeamNames[0].trim();
                if (draftTeamNames[1].trim()) names[1] = draftTeamNames[1].trim();
                onUpdateTeamNames(names);
                setShowTeamNameEditor(false);
              }}
              variant="secondary"
            >
              {t('waiting.save')}
            </Button>
          </View>
        ) : (
          <Pressable
            onPress={() => setShowTeamNameEditor(true)}
            style={styles.editTeamNamesButton}
          >
            <Text style={styles.editTeamNamesLabel}>{t('waiting.teamNames')}</Text>
            {([0, 1] as const).map((team) => (
              <View
                key={team}
                style={[
                  styles.teamColorDot,
                  { borderColor: teamColors[team] },
                ]}
              >
                <Text style={[styles.teamColorDotText, { color: teamColors[team] }]}>
                  {getTeamDisplayName(team, room.settings.teamNames).slice(0, 1)}
                </Text>
              </View>
            ))}
            <Text style={styles.editTeamNamesAction}>{t('waiting.edit')}</Text>
          </Pressable>
        )
      ) : null}

      {isHost ? (
        <View style={styles.hostActions}>
          <Button
            disabled={actionsDisabled || Boolean(pendingAction)}
            loading={pendingAction === 'shuffle'}
            onPress={() => runAction('shuffle', onShuffle)}
            variant="secondary"
          >
            {t('waiting.shuffleTeams')}
          </Button>
          <Button
            disabled={!canStart || actionsDisabled || Boolean(pendingAction)}
            loading={pendingAction === 'start'}
            onPress={() => runAction('start', onStart)}
          >
            {t('waiting.startGame')}
          </Button>
          {!canStart ? (
            <Text style={styles.hint}>
              {t('waiting.needFourSeats')}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.hint}>{t('waiting.waitingForHost')}</Text>
      )}

      <View style={styles.bottomActions}>
        <Button
          onPress={() => setShowChat(true)}
          style={styles.chatButton}
          variant="secondary"
        >
          {t('waiting.chat')}
        </Button>
        <Button
          disabled={actionsDisabled || Boolean(pendingAction)}
          loading={pendingAction === 'leave'}
          onPress={() => runAction('leave', onLeave)}
          style={styles.leaveButton}
          variant="ghost"
        >
          {t('waiting.leave')}
        </Button>
      </View>

      <ModalSheet
        closeLabel={t('waiting.close')}
        onClose={() => setShowChat(false)}
        testID="waiting-chat-sheet"
        title={t('waiting.chat')}
        visible={showChat}
      >
        <ChatPanel roomId={room.id} />
      </ModalSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 18,
    padding: 18,
  },
  heading: {
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
  },
  teams: {
    flexDirection: 'row',
    gap: 12,
  },
  teamsNarrow: {
    gap: 8,
  },
  team: {
    flex: 1,
    minWidth: 0,
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.panelStrong,
    borderWidth: 1,
  },
  teamBadgeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  editTeamNamesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  editTeamNamesLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  editTeamNamesAction: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  teamColorDot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.panelStrong,
    borderWidth: 1.5,
  },
  teamColorDotText: {
    fontSize: 11,
    fontWeight: '800',
  },
  teamNamePanel: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  teamNamePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamNamePanelTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  teamNameClose: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  teamNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamColorLabel: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: colors.panelStrong,
    borderWidth: 1.5,
  },
  teamColorLabelText: {
    fontSize: 13,
    fontWeight: '800',
  },
  teamNameInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    color: colors.text,
    fontSize: 15,
  },
  seat: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 12,
    backgroundColor: colors.backgroundElevated,
  },
  seatAvatar: {
    fontSize: 26,
  },
  seatText: {
    flex: 1,
    gap: 3,
  },
  playerName: {
    maxWidth: '100%',
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  ready: {
    color: colors.textMuted,
    fontSize: 12,
  },
  hostActions: {
    gap: 10,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
  },
  chatButton: {
    flex: 1,
  },
  leaveButton: {
    flex: 1,
  },
});
