import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { BlowAction, BlowDeclaration, Player, TrumpType } from '../../types/game.types';
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

// トランプの強さを定義
const TRUMP_STRENGTHS: Record<TrumpType, number> = {
  tra: 5,
  herz: 4,
  daiya: 3,
  club: 2,
  zuppe: 1,
};

// ペア数の最小値と最大値
const MIN_PAIRS = 6;
const DEFAULT_MAX_PAIRS = 10;
const MAX_PAIRS = 13;

// 基本のペア数選択肢
const DEFAULT_PAIR_OPTIONS = Array.from(
  { length: DEFAULT_MAX_PAIRS - MIN_PAIRS + 1 },
  (_, index) => MIN_PAIRS + index,
);

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

  // トランプの強さを取得
  const getTrumpStrength = (trumpType: TrumpType): number => {
    return TRUMP_STRENGTHS[trumpType] || 0;
  };

  const isDeclarationValid = (
    trumpType: TrumpType,
    pairs: number,
  ): boolean => {
    if (pairs < MIN_PAIRS || pairs > MAX_PAIRS) {
      return false;
    }

    if (!currentHighestDeclaration) {
      return pairs <= DEFAULT_MAX_PAIRS;
    }

    if (currentHighestDeclaration.numberOfPairs >= DEFAULT_MAX_PAIRS) {
      return pairs === currentHighestDeclaration.numberOfPairs + 1;
    }

    if (pairs > currentHighestDeclaration.numberOfPairs) {
      return true;
    }

    if (pairs < currentHighestDeclaration.numberOfPairs) {
      return false;
    }

    return (
      getTrumpStrength(trumpType) >
      getTrumpStrength(currentHighestDeclaration.trumpType)
    );
  };

  // 有効なペア数選択肢を生成
  const getValidPairOptions = () => {
    if (!currentHighestDeclaration) {
      return DEFAULT_PAIR_OPTIONS.map(pair => ({
        value: pair,
        label: `${pair} ${t('pairs')}`
      }));
    }

    if (currentHighestDeclaration.numberOfPairs >= DEFAULT_MAX_PAIRS) {
      const nextPair = currentHighestDeclaration.numberOfPairs + 1;

      if (nextPair > MAX_PAIRS) {
        return [];
      }

      return [{
        value: nextPair,
        label: `${nextPair} ${t('pairs')}`
      }];
    }

    const currentTrumpStrength = getTrumpStrength(currentHighestDeclaration.trumpType);
    const selectedTrumpStrength = selectedTrump ? getTrumpStrength(selectedTrump) : 0;

    const validPairs = DEFAULT_PAIR_OPTIONS.filter(pair => {
      // ペア数が現在の最高宣言より大きい場合は有効
      if (pair > currentHighestDeclaration.numberOfPairs) return true;

      // ペア数が同じ場合、トランプの強さを比較
      if (pair === currentHighestDeclaration.numberOfPairs && selectedTrumpStrength > currentTrumpStrength) {
        return true;
      }

      return false;
    });

    if (validPairs.length === 0) {
      const nextValidPair = selectedTrumpStrength > currentTrumpStrength
        ? currentHighestDeclaration.numberOfPairs
        : currentHighestDeclaration.numberOfPairs + 1;

      if (nextValidPair <= DEFAULT_MAX_PAIRS) {
        return [{
          value: nextValidPair,
          label: `${nextValidPair} ${t('overCall')}`
        }];
      }

      return [];
    }

    return validPairs.map(pair => ({
      value: pair,
      label: `${pair} ${t('pairs')}`
    }));
  };

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
  const isDisabled = !isCurrentPlayer;
  const isSelectedDeclarationValid =
    selectedTrump !== null &&
    isDeclarationValid(selectedTrump, numberOfPairs);

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
  
  // 有効なペア数選択肢
  const validPairOptions = getValidPairOptions();
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
