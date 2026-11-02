'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { LeaderboardMode, LeaderboardResponse } from '@contracts/leaderboard';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/hooks/useAuth';
import { Link } from '@/i18n/routing';
import styles from './page.module.scss';

function LeaderboardContent() {
  const t = useTranslations('leaderboard');
  const { getAccessToken, user } = useAuth();
  const [mode, setMode] = useState<LeaderboardMode>('normal');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setData(null);
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('No session');
        const response = await fetch(`/api/leaderboard?mode=${mode}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Leaderboard: ${response.status}`);
        if (active) setData(await response.json() as LeaderboardResponse);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [getAccessToken, mode]);

  return <>
    <Navigation />
    <main className={styles.main}>
      <Link href="/rooms" className={styles.back}>{t('back')}</Link>
      <div className={styles.panel}>
        <h1>{t('title')}</h1>
        <p className={styles.hint}>{t('hint')}</p>
        <div className={styles.tabs} role="tablist" aria-label={t('mode')}>
          {(['normal', 'pro'] as const).map((value) => <button key={value}
            type="button" role="tab" aria-selected={mode === value}
            className={mode === value ? styles.selected : ''}
            onClick={() => setMode(value)}>{t(value)}</button>)}
        </div>
        {loading ? <p role="status">{t('loading')}</p> : error ? <p role="alert">{t('error')}</p> : <>
          {user?.isAnonymous ? <p className={styles.me}>{(data?.me?.gamesPlayed ?? 0) >= 10
            ? t('guestNote')
            : t('guestProgress', { games: data?.me?.gamesPlayed ?? 0, remaining: 10 - (data?.me?.gamesPlayed ?? 0) })}</p> : data?.me && <p className={styles.me}>{data.me.rank
            ? t('myRank', { rank: data.me.rank, wins: data.me.gamesWon, games: data.me.gamesPlayed })
            : t('progress', { games: data.me.gamesPlayed, remaining: Math.max(0, 10 - data.me.gamesPlayed) })}</p>}
          {!user?.isAnonymous && !data?.me && <p className={styles.me}>{t('progress', { games: 0, remaining: 10 })}</p>}
          {data?.entries.length ? <ol className={styles.list}>
            {data.entries.map((entry) => <li key={entry.userId} className={styles.row}>
              <span className={styles.rank}>{entry.rank}</span>
              {entry.avatarUrl ? <Image className={styles.avatar} src={entry.avatarUrl} alt="" width={40} height={40} unoptimized /> : <span className={styles.avatarPlaceholder} aria-hidden="true">{entry.displayName.charAt(0)}</span>}
              <span className={styles.name}>{entry.displayName}</span>
              <span className={styles.score}>{entry.winRate.toFixed(1)}%<small>{t('record', { wins: entry.gamesWon, games: entry.gamesPlayed })}</small></span>
            </li>)}
          </ol> : <p>{t('empty')}</p>}
        </>}
      </div>
    </main>
    <Footer />
  </>;
}

export default function LeaderboardPage() {
  return <ProtectedRoute requireAuth><LeaderboardContent /></ProtectedRoute>;
}
