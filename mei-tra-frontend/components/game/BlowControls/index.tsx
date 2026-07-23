import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { BlowAction, BlowDeclaration, Player, TrumpType } from '@/types/game.types';
import {
  getValidBlowPairValues,
  isBlowDeclarationValid,
} from '@meitra/game-client/blow';
import styles from './index.module.scss';

interface BlowControlsProps {
  isCurrentPlayer: boolean;
  whoseTurn: string | null;
  selectedTrump: TrumpType | null;
  setSelectedTrump: (trump: TrumpType | null) => void;
  numberOfPairs: number;
  setNumberOfPairs: (pairs: number) => void;
  declareBlow: () => void;
  passBlow: () => void;
  blowDeclarations: BlowDeclaration[];
  blowActionHistory: BlowAction[];
  currentHighestDeclaration: BlowDeclaration | null;
  players: Player[];
}

export function BlowControls({
  isCurrentPlayer,
  whoseTurn,
  selectedTrump,
  setSelectedTrump,
  numberOfPairs,
  setNumberOfPairs,
  declareBlow,
  passBlow,
  blowDeclarations,
  blowActionHistory,
  currentHighestDeclaration,
  players,
}: BlowControlsProps) {
  const t = useTranslations('blowControls');
  const currentPlayerName = players.find(p => p.playerId === whoseTurn)?.name;
  const playerMap = new Map(players.map((player) => [player.playerId, player]));
  const currentPlayer =
    isCurrentPlayer && whoseTurn ? playerMap.get(whoseTurn) : undefined;
  const currentPlayerAlreadyActed =
    !!currentPlayer &&
    (currentPlayer.isPasser ||
      blowDeclarations.some((declaration) => declaration.playerId === currentPlayer.playerId) ||
      blowActionHistory.some((action) => action.playerId === currentPlayer.playerId));

  // 宣言処理
  const handleDeclare = () => {
    if (!isCurrentPlayer) return;
    declareBlow();
    // フォームのリセット
    setSelectedTrump(null);
    setNumberOfPairs(0);
  };

  // パス処理
  const handlePass = () => {
    if (!isCurrentPlayer) return;
    passBlow();
  };

  const validPairOptions = getValidBlowPairValues(
    currentHighestDeclaration,
    selectedTrump,
  ).map((pair) => ({
    value: pair,
    label: `${pair} ${t('pairs')}`,
  }));

  // 宣言アイテムのクラス名を生成
  const getDeclarationItemClassName = (declaration?: BlowDeclaration) => {
    if (!declaration) return '';

    const isLatestDeclaration = declaration === blowDeclarations[blowDeclarations.length - 1];
    const isHighestDeclaration = currentHighestDeclaration && 
      declaration.playerId === currentHighestDeclaration.playerId &&
      declaration.trumpType === currentHighestDeclaration.trumpType &&
      declaration.numberOfPairs === currentHighestDeclaration.numberOfPairs;

    return `${styles.declarationItem} ${
      isLatestDeclaration ? styles.animateSlideIn : ''
    } ${isHighestDeclaration ? styles.highest : ''}`;
  };

  // コントロールが無効かどうか
  const isDisabled = !isCurrentPlayer || currentPlayerAlreadyActed;
  const isSelectedDeclarationValid =
    selectedTrump !== null &&
    isBlowDeclarationValid(
      selectedTrump,
      numberOfPairs,
      currentHighestDeclaration,
    );

  useEffect(() => {
    if (selectedTrump && numberOfPairs > 0 && !isSelectedDeclarationValid) {
      setNumberOfPairs(0);
    }
  }, [
    selectedTrump,
    numberOfPairs,
    isSelectedDeclarationValid,
    setNumberOfPairs,
  ]);
  
  const chronologicalDeclarations = [...blowActionHistory].sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  return (
    <div className={styles.blowControlsContainer}>
      <div className={styles.content}>
        <div className={styles.title}>
          <div className={`${styles.currentTurn} ${isCurrentPlayer ? styles.active : styles.inactive}`}>
            {t('currentTurn')} {currentPlayerName}
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.controlsRow}>
            {/* トランプ選択 */}
            <select
              value={selectedTrump || ''}
              onChange={(e) => setSelectedTrump(e.target.value as TrumpType)}
              className={styles.select}
              disabled={isDisabled}
            >
              <option value="">{t('selectTrump')}</option>
              <option value="tra">{t('tra')}</option>
              <option value="herz">{t('herz')}</option>
              <option value="daiya">{t('daiya')}</option>
              <option value="club">{t('club')}</option>
              <option value="zuppe">{t('zuppe')}</option>
            </select>

            {/* ペア数選択 */}
            <select
              value={numberOfPairs || ''}
              onChange={(e) => {
                const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                setNumberOfPairs(value);
              }}
              className={styles.select}
              disabled={isDisabled}
            >
              <option value="">{t('selectPairs')}</option>
              {validPairOptions.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            {/* アクションボタン */}
            <div className={styles.buttonGroup}>
              <button
                onClick={handleDeclare}
                disabled={!isSelectedDeclarationValid || isDisabled}
                className={`${styles.button} ${styles.declareButton}`}
              >
                {t('declare')}
              </button>

              <button
                onClick={handlePass}
                disabled={isDisabled}
                className={`${styles.button} ${styles.passButton}`}
              >
                {t('pass')}
              </button>
            </div>
          </div>
        </div>

        {/* 宣言リスト */}
        <div className={styles.declarations}>
          <div className={styles.declarationList}>
            {chronologicalDeclarations.map((entry, index) => {
              const player = playerMap.get(entry.playerId);
              if (!player) return null;

              if (entry.type === 'pass') {
                return (
                  <div 
                    key={`pass-${entry.playerId}-${index}`}
                    className={`${styles.declarationItem} ${styles.pass}`}
                  >
                    {player.name}: {t('passed')}
                  </div>
                );
              }

              const declaration = {
                playerId: entry.playerId,
                trumpType: entry.trumpType,
                numberOfPairs: entry.numberOfPairs,
                timestamp: entry.timestamp,
              } as BlowDeclaration;

              return (
                <div
                  key={`${entry.playerId}-${entry.timestamp}`}
                  className={getDeclarationItemClassName(declaration)}
                >
                  {player.name}: {entry.trumpType?.toUpperCase()} {entry.numberOfPairs} pairs
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
