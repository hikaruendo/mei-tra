'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { LEADERBOARD_MODES, type LeaderboardMode } from '@contracts/leaderboard';
import {
  describeLeaderboardStanding,
  type LeaderboardStanding,
} from '@meitra/api-client/leaderboard';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/hooks/useAuth';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import styles from './page.module.scss';

const MODE_LABEL_KEYS = { normal: 'modeNormal', pro: 'modePro' } as const;

function LeaderboardContent() {
  const t = useTranslations('leaderboard');
  const { getAccessToken, user } = useAuth();
  const [mode, setMode] = useState<LeaderboardMode>('normal');
  const { leaderboard, isLoading, hasError } = useLeaderboard(mode, getAccessToken);

  const standingText = (standing: LeaderboardStanding) => {
    switch (standing.kind) {
      case 'ranked':
        return t('myRank', { rank: standing.rank, wins: standing.gamesWon, games: standing.gamesPlayed });
      case 'progress':
        return t('progress', { games: standing.gamesPlayed, remaining: standing.remaining });
      case 'guestQualified':
        return t('guestNote', { minimumGames: standing.minimumGames });
      case 'guestProgress':
        return t('guestProgress', { games: standing.gamesPlayed, remaining: standing.remaining });
    }
  };

  return <>
    <Navigation />
    <main className={styles.main}>
      <div className={styles.panel}>
        <h1 className={styles.title}>{t('title')}</h1>
        <div className={styles.tabs} role="tablist" aria-label={t('mode')}>
          {LEADERBOARD_MODES.map((value) => <button key={value}
            type="button" role="tab" aria-selected={mode === value}
            className={mode === value ? `${styles.tab} ${styles.selected}` : styles.tab}
            onClick={() => setMode(value)}>{t(MODE_LABEL_KEYS[value])}</button>)}
        </div>
        {isLoading ? <p role="status">{t('loading')}</p> : hasError || !leaderboard ? <p role="alert">{t('error')}</p> : <>
          <p className={styles.hint}>{t('hint', { minimumGames: leaderboard.minimumGames })}</p>
          <p className={styles.me}>{standingText(describeLeaderboardStanding(leaderboard, Boolean(user?.isAnonymous)))}</p>
          {leaderboard.entries.length ? <ol className={styles.list}>
            {leaderboard.entries.map((entry) => <li key={entry.userId} className={styles.row}>
              <span className={styles.rank}>{entry.rank}</span>
              {entry.avatarUrl ? <Image className={styles.avatar} src={entry.avatarUrl} alt="" width={40} height={40} unoptimized /> : <span className={styles.avatarPlaceholder} aria-hidden="true">{entry.displayName.charAt(0)}</span>}
              <span className={styles.name}>{entry.displayName}</span>
              <span className={styles.score}>{entry.winRate.toFixed(1)}%<small className={styles.record}>{t('record', { wins: entry.gamesWon, games: entry.gamesPlayed })}</small></span>
            </li>)}
          </ol> : <p className={styles.empty}>{t('empty')}</p>}
        </>}
      </div>
    </main>
    <Footer />
  </>;
}

export default function LeaderboardPage() {
  return <ProtectedRoute requireAuth><LeaderboardContent /></ProtectedRoute>;
}
