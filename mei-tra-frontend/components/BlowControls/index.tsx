import { BlowDeclaration, Player, TrumpType } from '../../types/game.types';
import styles from './index.module.css';

interface BlowControlsProps {
  isCurrentPlayer: boolean;
  currentPlayer: Player | undefined;
  selectedTrump: TrumpType | null;
  setSelectedTrump: (trump: TrumpType | null) => void;
  numberOfPairs: number;
  setNumberOfPairs: (pairs: number) => void;
  declareBlow: () => void;
  passBlow: () => void;
  blowDeclarations: BlowDeclaration[];
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
const MAX_PAIRS = 13;

// 基本のペア数選択肢
const BASE_PAIR_OPTIONS = [6, 7, 8, 9, 10];

export function BlowControls({
  isCurrentPlayer,
  currentPlayer,
  selectedTrump,
  setSelectedTrump,
  numberOfPairs,
  setNumberOfPairs,
  declareBlow,
  passBlow,
  blowDeclarations,
  currentHighestDeclaration,
  players,
}: BlowControlsProps) {
  const currentPlayerName = players.find(p => p.playerId === currentPlayer?.playerId)?.name;

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

  // 有効なペア数選択肢を生成
  const getValidPairOptions = () => {
    if (!currentHighestDeclaration) {
      // 最初の宣言ではすべてのペア数が有効
      return BASE_PAIR_OPTIONS.map(pair => ({
        value: pair,
        label: `${pair} Pairs`
      }));
    }

    const currentTrumpStrength = getTrumpStrength(currentHighestDeclaration.trumpType);
    const selectedTrumpStrength = selectedTrump ? getTrumpStrength(selectedTrump) : 0;

    // 現在の最高宣言を上回る有効なペア数をフィルタリング
    const validPairs = BASE_PAIR_OPTIONS.filter(pair => {
      // ペア数が現在の最高宣言より大きい場合は有効
      if (pair > currentHighestDeclaration.numberOfPairs) return true;

      // ペア数が同じ場合、トランプの強さを比較
      if (pair === currentHighestDeclaration.numberOfPairs && selectedTrumpStrength > currentTrumpStrength) {
        return true;
      }

      return false;
    });

    // 有効なペア数がない場合はオーバーコールの選択肢を追加
    if (validPairs.length === 0) {
      const nextValidPair = selectedTrumpStrength > currentTrumpStrength
        ? currentHighestDeclaration.numberOfPairs
        : currentHighestDeclaration.numberOfPairs + 1;

      if (nextValidPair <= MAX_PAIRS) {
        return [{
          value: nextValidPair,
          label: `${nextValidPair} Pairs (Over Call)`
        }];
      }
      
      return [];
    }

    return validPairs.map(pair => ({
      value: pair,
      label: `${pair} Pairs`
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
  
  // 有効なペア数選択肢
  const validPairOptions = getValidPairOptions();

  return (
    <div className={styles.blowControlsContainer}>
      <div className={styles.content}>
        <div className={styles.title}>
          <div className={`${styles.currentTurn} ${isCurrentPlayer ? styles.active : styles.inactive}`}>
            Current Turn: {currentPlayerName}
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
              <option value="">Select Trump</option>
              <option value="tra">Tra</option>
              <option value="herz">Herz (♥)</option>
              <option value="daiya">Daiya (♦)</option>
              <option value="club">Club (♣)</option>
              <option value="zuppe">Zuppe (♠)</option>
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
              <option value="">Select Pairs</option>
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
                disabled={!selectedTrump || numberOfPairs < MIN_PAIRS || isDisabled}
                className={`${styles.button} ${styles.declareButton}`}
              >
                Declare
              </button>

              <button 
                onClick={handlePass}
                disabled={isDisabled}
                className={`${styles.button} ${styles.passButton}`}
              >
                Pass
              </button>
            </div>
          </div>
        </div>

        {/* 宣言リスト */}
        <div className={styles.declarations}>
          <div className={styles.declarationList}>
            {players.map((player) => {
              const declaration = blowDeclarations.find(d => d.playerId === player.playerId);

              if (player.isPasser) {
                return (
                  <div 
                    key={`pass-${player.playerId}`}
                    className={`${styles.declarationItem} ${styles.pass}`}
                  >
                    {player.name}: Passed
                  </div>
                );
              }

              if (declaration) {
                return (
                  <div 
                    key={declaration.playerId}
                    className={getDeclarationItemClassName(declaration)}
                  >
                    {player.name}: {declaration.trumpType.toUpperCase()} {declaration.numberOfPairs} pairs
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}