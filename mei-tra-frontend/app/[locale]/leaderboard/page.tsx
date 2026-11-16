'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { GAME_MODES, type GameMode } from '@contracts/room';
import {
  describeLeaderboardStanding,
  LEADERBOARD_MODE_LABEL_KEYS,
} from '@meitra/game-client/leaderboard-standing';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/hooks/useAuth';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import styles from './page.module.scss';

function LeaderboardContent() {
  const t = useTranslations('leaderboard');
  const { getAccessToken, user } = useAuth();
  const [mode, setMode] = useState<GameMode>('normal');
  const { leaderboard, isLoading, hasError } = useLeaderboard(mode, getAccessToken);
  const standing = leaderboard && describeLeaderboardStanding(leaderboard, Boolean(user?.isAnonymous));

  return <>
    <Navigation />
    <main className={styles.main}>
      <div className={styles.panel}>
        <h1 className={styles.title}>{t('title')}</h1>
        <div className={styles.tabs} role="tablist" aria-label={t('mode')}>
          {GAME_MODES.map((value) => <button key={value}
            type="button" role="tab" aria-selected={mode === value}
            className={mode === value ? `${styles.tab} ${styles.selected}` : styles.tab}
            onClick={() => setMode(value)}>{t(LEADERBOARD_MODE_LABEL_KEYS[value])}</button>)}
        </div>
        {isLoading ? <p role="status">{t('loading')}</p> : hasError || !leaderboard ? <p role="alert">{t('error')}</p> : <>
          <p className={styles.hint}>{t('hint', { minimumGames: leaderboard.minimumGames })}</p>
          {standing && <p className={styles.me}>{t(standing.key, standing.values)}</p>}
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
