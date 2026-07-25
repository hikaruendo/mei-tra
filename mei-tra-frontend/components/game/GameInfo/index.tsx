import React, { useState } from 'react';
import {
  TeamScores,
  Player,
} from '@/types/game.types';
import styles from './index.module.scss';
import { useTranslations } from 'next-intl';
import { ConfirmModal } from '@/components/shared/ConfirmModal';

type ScoreStatus = 'normal' | 'leading' | 'reach' | 'win';

interface GameInfoProps {
  teamScores: TeamScores;
  pointsToWin: number;
  players: Player[];
  actionSlot?: (onLeaveRequest: () => void) => React.ReactNode;
  onLeave?: () => void;
}

export const GameInfo: React.FC<GameInfoProps> = ({
  teamScores,
  pointsToWin,
  players,
  actionSlot,
  onLeave,
}) => {
  const t = useTranslations();
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const getTeamPlayerNames = (teamNumber: number): string => {
    const teamPlayers = players.filter(player => player.team === teamNumber);
    return teamPlayers.map(player => player.isCOM ? 'COM' : player.name).join('・');
  };
  const getScoreProgress = (score: number) => {
    if (pointsToWin <= 0) {
      return 0;
    }

    return Math.min(100, Math.max(0, (score / pointsToWin) * 100));
  };
  const getScoreStatus = (score: number, opposingScore: number): ScoreStatus => {
    if (pointsToWin > 0 && score >= pointsToWin) {
      return 'win';
    }

    if (pointsToWin > 0 && score < pointsToWin && pointsToWin - score <= 1) {
      return 'reach';
    }

    if (score > opposingScore) {
      return 'leading';
    }

    return 'normal';
  };
  const getScoreStatusLabel = (status: ScoreStatus) => {
    switch (status) {
      case 'reach':
        return t('gameInfo.reach');
      case 'win':
        return t('gameInfo.win');
      default:
        return null;
    }
  };
  const scoreTeams = [0, 1].map((teamNumber) => {
    const score = teamScores[teamNumber].total;
    const opposingScore = teamScores[teamNumber === 0 ? 1 : 0].total;
    const status = getScoreStatus(score, opposingScore);

    return {
      teamNumber,
      teamName: getTeamPlayerNames(teamNumber),
      score,
      progress: getScoreProgress(score),
      status,
      statusLabel: getScoreStatusLabel(status),
    };
  });
  const scoreAnnouncement = scoreTeams
    .filter(({ status }) => status === 'reach' || status === 'win')
    .map(({ teamName, score, statusLabel }) => `${teamName}: ${score}/${pointsToWin} ${statusLabel}`)
    .join('、');

  const handleLeaveClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmLeave = () => {
    onLeave?.();
    setShowConfirmModal(false);
  };

  const handleCancelLeave = () => {
    setShowConfirmModal(false);
  };

  return (
    <>
      <div className={styles.scoreAnnouncement} aria-atomic="true" aria-live="polite">
        {scoreAnnouncement}
      </div>
      <div className={styles.gameInfoContainer}>
        <div className={styles.gameInfoContent}>
          <div className={styles.gameInfoScores}>
            {scoreTeams.map(({ teamNumber, teamName, score, progress, status, statusLabel }) => {
              const hasScoreEmphasis = status === 'reach' || status === 'win';

              return (
                <div
                  key={teamNumber}
                  className={`${styles.gameInfoScore} ${
                    teamNumber === 0 ? styles.team0 : styles.team1
                  } ${hasScoreEmphasis ? styles.scoreEmphasis : ''} ${
                    status === 'reach' ? styles.reachingTeam : ''
                  } ${status === 'win' ? styles.winningTeam : ''}`}
                  aria-label={teamName}
                  aria-valuemax={pointsToWin}
                  aria-valuemin={0}
                  aria-valuenow={score}
                  aria-valuetext={`${score}/${pointsToWin}${statusLabel ? ` ${statusLabel}` : ''}`}
                  role="meter"
                  style={{ '--team-score-progress': `${progress}%` } as React.CSSProperties}
                >
                  <div className={styles.gameInfoScoreContent}>
                    <span className={styles.gameInfoScoreTeam} title={teamName}>
                      {teamName}
                    </span>
                    <div className={styles.gameInfoMeter}>
                      <div className={styles.gameInfoScoreFill} aria-hidden="true" />
                      <div className={styles.gameInfoScoreMeta}>
                        {statusLabel && (
                          <span className={styles.gameInfoScoreStatus}>{statusLabel}</span>
                        )}
                        <span className={styles.gameInfoScoreValue}>
                          {score}<span>/{pointsToWin}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className={styles.gameInfoActions}>
          {actionSlot?.(handleLeaveClick)}
          <button onClick={handleLeaveClick} className={styles.leaveButton}>
            {t('common.leave')}
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        title={t('room.leaveConfirm.title')}
        message={t('room.leaveConfirm.message')}
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
        confirmText={t('common.leave')}
        cancelText={t('common.cancel')}
      />
    </>
  );
}; 
