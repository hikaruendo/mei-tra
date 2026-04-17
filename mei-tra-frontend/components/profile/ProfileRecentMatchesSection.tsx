'use client';

import { Link } from '@/i18n/routing';
import { useLocale, useTranslations } from 'next-intl';
import { useProfileGameHistory } from '@/hooks/useProfileGameHistory';
import type {
  GameHistoryActionType,
  RecentGameHistoryItem,
} from '@/types/game-history.types';
import styles from './ProfileRecentMatchesSection.module.scss';

interface ProfileRecentMatchesSectionProps {
  userId: string;
  getAccessToken: () => Promise<string | null>;
}

const ACTION_TYPE_MESSAGE_KEYS: Record<GameHistoryActionType, string> = {
  game_started: 'actionTypes.game_started',
  blow_declared: 'actionTypes.blow_declared',
  blow_passed: 'actionTypes.blow_passed',
  play_phase_started: 'actionTypes.play_phase_started',
  card_played: 'actionTypes.card_played',
  field_completed: 'actionTypes.field_completed',
  round_completed: 'actionTypes.round_completed',
  round_cancelled: 'actionTypes.round_cancelled',
  round_reset: 'actionTypes.round_reset',
  broken_hand_revealed: 'actionTypes.broken_hand_revealed',
  game_over: 'actionTypes.game_over',
  player_stats_updated: 'actionTypes.player_stats_updated',
};

export function ProfileRecentMatchesSection({
  userId,
  getAccessToken,
}: ProfileRecentMatchesSectionProps) {
  const t = useTranslations('profile');
  const historyT = useTranslations('gameHistoryDock');
  const locale = useLocale();
  const { items, isLoading, error } = useProfileGameHistory(
    userId,
    Boolean(userId),
    getAccessToken,
  );

  const dateFormatter = new Intl.DateTimeFormat(
    locale === 'ja' ? 'ja-JP' : 'en-US',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  );

  const renderLastAction = (item: RecentGameHistoryItem) => {
    if (!item.lastActionType) {
      return t('recentMatchesNoAction');
    }

    return historyT(ACTION_TYPE_MESSAGE_KEYS[item.lastActionType] as never);
  };

  const renderWinner = (item: RecentGameHistoryItem) => {
    if (item.winningTeam === null) {
      return t('recentMatchesNoWinner');
    }

    return historyT('teamValue', { team: item.winningTeam + 1 });
  };

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h3 className={styles.sectionTitle}>{t('recentMatchesTitle')}</h3>
        <p className={styles.description}>{t('recentMatchesDescription')}</p>
      </div>

      {isLoading ? <p className={styles.statusText}>{t('recentMatchesLoading')}</p> : null}
      {!isLoading && error ? <p className={styles.errorText}>{t('recentMatchesError')}</p> : null}
      {!isLoading && !error && items.length === 0 ? (
        <p className={styles.statusText}>{t('recentMatchesEmpty')}</p>
      ) : null}

      {!isLoading && !error && items.length > 0 ? (
        <div className={styles.list}>
          {items.map((item) => (
            <Link
              key={item.roomId}
              href={`/game-history/${item.roomId}`}
              className={styles.card}
            >
              <div className={styles.cardHeader}>
                <h4 className={styles.roomName}>{item.roomName}</h4>
                <p className={styles.completedAt}>
                  {dateFormatter.format(item.completedAt)}
                </p>
              </div>
              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>{t('recentMatchesRounds')}</span>
                  <span className={styles.metaValue}>{item.roundCount}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>{t('recentMatchesEntries')}</span>
                  <span className={styles.metaValue}>{item.totalEntries}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>{t('recentMatchesWinner')}</span>
                  <span className={styles.metaValue}>{renderWinner(item)}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>{t('recentMatchesLastAction')}</span>
                  <span className={styles.metaValue}>{renderLastAction(item)}</span>
                </div>
              </div>
              <span className={styles.detailsLink}>{t('recentMatchesDetails')}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
