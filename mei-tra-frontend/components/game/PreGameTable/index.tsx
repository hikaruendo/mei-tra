'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Player, TeamNames } from '@/types/game.types';
import { PlayerAvatar } from '@/components/game/PlayerAvatar';
import { getConsistentTableOrderWithSelfBottom } from '@/lib/utils/tableOrder';
import { getTeamDisplayName } from '@/lib/utils/teamLabels';
import styles from './index.module.scss';

interface PreGameTableProps {
  players: Player[];
  currentPlayerId: string | null;
  isHost: boolean;
  onStart: () => void;
  onLeave: () => void;
  shuffleTeams?: () => void;
  teamNames?: TeamNames;
  onUpdateTeamNames?: (teamNames: TeamNames) => void;
  onRemovePlayer?: (playerId: string) => void;
}

const positions = ['bottom', 'left', 'top', 'right'] as const;

function createEmptySlot(index: number): Player {
  return {
    socketId: `empty-${index}`,
    playerId: `empty-${index}`,
    name: 'COM',
    team: (index % 2) as Player['team'],
    hand: [],
    isCOM: true,
  };
}

export const PreGameTable: React.FC<PreGameTableProps> = ({
  players,
  currentPlayerId,
  isHost,
  onStart,
  onLeave,
  shuffleTeams,
  teamNames,
  onUpdateTeamNames,
  onRemovePlayer,
}) => {
  const tRoot = useTranslations();
  const resolvedTeamNames = useMemo<TeamNames>(
    () => ({
      0: getTeamDisplayName(0, teamNames, (team) =>
        tRoot(team === 0 ? 'gameInfo.teamRed' : 'gameInfo.teamBlack'),
      ),
      1: getTeamDisplayName(1, teamNames, (team) =>
        tRoot(team === 0 ? 'gameInfo.teamRed' : 'gameInfo.teamBlack'),
      ),
    }),
    [teamNames, tRoot],
  );
  const [draftTeamNames, setDraftTeamNames] =
    useState<TeamNames>(resolvedTeamNames);
  const [isEditingTeamNames, setIsEditingTeamNames] = useState(false);

  useEffect(() => {
    setDraftTeamNames(resolvedTeamNames);
  }, [resolvedTeamNames]);

  const ordered = currentPlayerId
    ? getConsistentTableOrderWithSelfBottom(players, currentPlayerId)
    : new Array(4).fill(undefined);

  const slots: Player[] = ordered.map((p, idx) => {
    if (!p) return createEmptySlot(idx);
    if (p.isCOM && !p.isReady) return { ...p, name: 'COM' };
    return p;
  });

  const getTeamLabel = (team: Player['team']) =>
    getTeamDisplayName(team, teamNames, (fallbackTeam) =>
      tRoot(fallbackTeam === 0 ? 'gameInfo.teamRed' : 'gameInfo.teamBlack'),
    );

  const handleTeamNameSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onUpdateTeamNames?.(draftTeamNames);
    setIsEditingTeamNames(false);
  };

  return (
    <div className={styles.playerPositions}>
      {slots.map((player, idx) => (
        <div
          key={player.playerId}
          className={`${styles.playerSeat} ${styles[positions[idx]]} ${
            player.team === 0 ? styles.teamRed : styles.teamBlack
          }`}
        >
          <div className={styles.seatContent}>
            <PlayerAvatar player={player} size="medium" showName={true} />
            <span className={styles.teamBadge} title={getTeamLabel(player.team)}>
              {getTeamLabel(player.team)}
            </span>
            {isHost &&
              onRemovePlayer &&
              !player.isCOM &&
              player.playerId !== currentPlayerId && (
                <button
                  type="button"
                  className={styles.seatActionButton}
                  onClick={() => onRemovePlayer(player.playerId)}
                >
                  {tRoot('room.removePlayer')}
                </button>
              )}
          </div>
        </div>
      ))}

      <div className={styles.center}>
        {isHost ? (
          <>
            {onUpdateTeamNames && (
              <div className={styles.teamNamePanel}>
                <div className={styles.teamNameSummary}>
                  <span className={styles.teamNameSummaryLabel}>
                    {tRoot('room.teamNames')}
                  </span>
                  <span className={`${styles.teamNamePill} ${styles.teamRedPill}`}>
                    {resolvedTeamNames[0]}
                  </span>
                  <span className={`${styles.teamNamePill} ${styles.teamBlackPill}`}>
                    {resolvedTeamNames[1]}
                  </span>
                  <button
                    type="button"
                    className={styles.teamNameEditButton}
                    onClick={() => setIsEditingTeamNames((current) => !current)}
                  >
                    {tRoot(
                      isEditingTeamNames
                        ? 'common.close'
                        : 'room.editTeamNames',
                    )}
                  </button>
                </div>
                {isEditingTeamNames && (
                  <form
                    className={styles.teamNameForm}
                    onSubmit={handleTeamNameSubmit}
                  >
                    <div className={styles.teamNameFields}>
                      <label className={`${styles.teamNameField} ${styles.teamRedField}`}>
                        <span>{tRoot('room.teamRedName')}</span>
                        <input
                          type="text"
                          value={draftTeamNames[0] ?? ''}
                          onChange={(event) =>
                            setDraftTeamNames((current) => ({
                              ...current,
                              0: event.target.value,
                            }))
                          }
                          maxLength={16}
                        />
                      </label>
                      <label className={`${styles.teamNameField} ${styles.teamBlackField}`}>
                        <span>{tRoot('room.teamBlackName')}</span>
                        <input
                          type="text"
                          value={draftTeamNames[1] ?? ''}
                          onChange={(event) =>
                            setDraftTeamNames((current) => ({
                              ...current,
                              1: event.target.value,
                            }))
                          }
                          maxLength={16}
                        />
                      </label>
                    </div>
                    <button type="submit" className={styles.teamNameSaveButton}>
                      {tRoot('room.saveTeamNames')}
                    </button>
                  </form>
                )}
              </div>
            )}
            {shuffleTeams && (
              <button className={styles.shuffleButton} onClick={shuffleTeams}>
                {tRoot('room.shuffleTeams')}
              </button>
            )}
            <button className={styles.startButton} onClick={onStart}>
              {tRoot('room.start')}
            </button>
          </>
        ) : (
          <p className={styles.waitingText}>{tRoot('room.waitingForHost')}</p>
        )}
        <button className={styles.leaveButton} onClick={onLeave}>
          {tRoot('common.leave')}
        </button>
      </div>
    </div>
  );
};
