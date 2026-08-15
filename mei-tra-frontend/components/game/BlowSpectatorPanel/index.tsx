import { useTranslations } from 'next-intl';
import { BlowAction, BlowDeclaration, Player } from '@/types/game.types';
import styles from './index.module.scss';

interface BlowSpectatorPanelProps {
  whoseTurn: string | null;
  blowDeclarations: BlowDeclaration[];
  blowActionHistory: BlowAction[];
  currentHighestDeclaration: BlowDeclaration | null;
  players: Player[];
}

export function BlowSpectatorPanel({
  whoseTurn,
  blowDeclarations,
  blowActionHistory,
  currentHighestDeclaration,
  players,
}: BlowSpectatorPanelProps) {
  const t = useTranslations('blowControls');
  const playerMap = new Map<string, Player>(
    players.map((player) => [player.seatId, player]),
  );
  const currentPlayerName = whoseTurn
    ? playerMap.get(whoseTurn)?.name ?? whoseTurn
    : t('waiting');
  const actionHistory = blowActionHistory.length > 0
    ? blowActionHistory
    : blowDeclarations.map((declaration) => ({
      type: 'declare' as const,
      seatId: declaration.seatId,
      trumpType: declaration.trumpType,
      numberOfPairs: declaration.numberOfPairs,
      timestamp: declaration.timestamp,
    }));
  const chronologicalActions = [...actionHistory].sort(
    (first, second) => first.timestamp - second.timestamp,
  );

  const getPlayerName = (seatId: string) =>
    playerMap.get(seatId)?.name ?? seatId;
  const isHighestDeclaration = (action: BlowAction) =>
    action.type === 'declare' &&
    currentHighestDeclaration?.timestamp === action.timestamp &&
    currentHighestDeclaration.seatId === action.seatId;

  return (
    <section
      className={styles.spectatorPanel}
      aria-label={t('spectatorProgress')}
      aria-live="polite"
    >
      <div className={styles.header}>
        <span className={styles.title}>{t('spectatorProgress')}</span>
        <span className={styles.viewOnly}>{t('viewOnly')}</span>
      </div>

      <dl className={styles.summary}>
        <div className={styles.summaryRow}>
          <dt>{t('currentTurn')}</dt>
          <dd title={currentPlayerName}>{currentPlayerName}</dd>
        </div>
        <div className={styles.summaryRow}>
          <dt>{t('highestBid')}</dt>
          <dd>
            {currentHighestDeclaration ? (
              <span className={styles.declarationValue}>
                <span
                  className={styles.playerName}
                  title={getPlayerName(currentHighestDeclaration.seatId)}
                >
                  {getPlayerName(currentHighestDeclaration.seatId)}
                </span>
                <span
                  className={styles.trump}
                  data-trump={currentHighestDeclaration.trumpType}
                >
                  {t(currentHighestDeclaration.trumpType)}
                </span>
                <span>{currentHighestDeclaration.numberOfPairs}</span>
              </span>
            ) : t('noBid')}
          </dd>
        </div>
      </dl>

      <div className={styles.history}>
        <span className={styles.historyTitle}>{t('history')}</span>
        {chronologicalActions.length > 0 ? (
          <ol className={styles.historyList}>
            {chronologicalActions.map((action) => (
              <li
                key={`${action.type}-${action.seatId}-${action.timestamp}`}
                className={`${styles.historyItem} ${
                  action.type === 'pass' ? styles.pass : ''
                } ${isHighestDeclaration(action) ? styles.highest : ''}`}
              >
                <span
                  className={styles.playerName}
                  title={getPlayerName(action.seatId)}
                >
                  {getPlayerName(action.seatId)}
                </span>
                {action.type === 'pass' ? (
                  <span>{t('pass')}</span>
                ) : (
                  <span className={styles.declarationValue}>
                    <span>{t('bid')}</span>
                    <span className={styles.trump} data-trump={action.trumpType}>
                      {action.trumpType ? t(action.trumpType) : ''}
                    </span>
                    <span>{action.numberOfPairs}</span>
                  </span>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.emptyHistory}>{t('noHistory')}</p>
        )}
      </div>
    </section>
  );
}
