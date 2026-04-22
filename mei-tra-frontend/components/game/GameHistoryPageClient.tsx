'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { GameHistoryDock } from '@/components/game/GameHistoryDock';
import { useGameHistory } from '@/hooks/useGameHistory';
import styles from './GameHistoryPageClient.module.scss';

interface GameHistoryPageClientProps {
  roomId: string;
}

export function GameHistoryPageClient({
  roomId,
}: GameHistoryPageClientProps) {
  const t = useTranslations('gameHistoryDock');
  const { summary } = useGameHistory(roomId, true, {
    includeReplay: false,
  });
  const summaryStatusLabel = !summary
    ? t('statusInProgress')
    : summary.status === 'completed'
      ? t('statusCompleted')
      : t('statusInProgress');
  const winnerLabel = !summary
    ? t('noWinner')
    : summary.winningTeam === null
      ? t('noWinner')
      : t('teamValue', { team: summary.winningTeam + 1 });
  const lastActionLabel = !summary?.lastActionType
    ? t('noLastAction')
    : t(`actionTypes.${summary.lastActionType}` as never);
  const historyWindowLabel = useMemo(() => {
    if (!summary?.firstTimestamp || !summary.lastTimestamp) {
      return t('unknownTimeWindow');
    }

    return `${summary.firstTimestamp.toLocaleString()} - ${summary.lastTimestamp.toLocaleString()}`;
  }, [summary?.firstTimestamp, summary?.lastTimestamp, t]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <span className={styles.eyebrow}>{t('reportLabel')}</span>
          <h1 className={styles.title}>{t('title')}</h1>
          <p className={styles.description}>{t('pageDescription')}</p>
        </div>
        <Link href="/profile" className={styles.backLink}>
          {t('backToProfile')}
        </Link>
      </div>
      <section className={styles.summaryPanel}>
        <div className={styles.summaryHeader}>
          <div className={styles.statusBadge}>{summaryStatusLabel}</div>
        </div>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{t('overviewWinner')}</span>
            <span className={styles.summaryValue}>{winnerLabel}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{t('overviewLastAction')}</span>
            <span className={styles.summaryValue}>{lastActionLabel}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{t('overviewEntries')}</span>
            <span className={styles.summaryValue}>
              {summary?.totalEntries ?? '--'}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{t('overviewRounds')}</span>
            <span className={styles.summaryValue}>
              {summary?.roundNumbers.length ?? '--'}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{t('overviewPlayers')}</span>
            <span className={styles.summaryValue}>
              {summary?.playerIds.length ?? '--'}
            </span>
          </div>
          <div className={`${styles.summaryCard} ${styles.summaryCardWide}`}>
            <span className={styles.summaryLabel}>{t('overviewWindow')}</span>
            <span className={styles.summaryValueSmall}>{historyWindowLabel}</span>
          </div>
        </div>
      </section>
      <GameHistoryDock
        roomId={roomId}
        gameStarted={false}
        players={[]}
        variant="page"
        showOverview={false}
        summaryOverride={summary}
        includeSummaryFetch={false}
      />
    </div>
  );
}
