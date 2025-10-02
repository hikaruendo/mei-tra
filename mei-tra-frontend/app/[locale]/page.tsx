'use client';

import { useTranslations } from 'next-intl';
import { GameTable } from '../../components/GameTable';
import { Notification } from '../../components/Notification';
import { Navigation } from '../../components/layout/Navigation';
import { useGame } from '../../hooks/useGame';
import { useAuth } from '../../contexts/AuthContext';
import GameJoinGroup from '../../components/organisms/GameJoinGroup';
import { RoomList } from '../../components/molecules/RoomList';
import styles from './index.module.css';

export const dynamic = 'force-dynamic';

export default function Home() {
  const t = useTranslations('game');
  const gameState = useGame();
  const { user, loading: authLoading } = useAuth();

  // Always show UI - only show loading overlay if truly necessary
  if (!gameState) {
    return (
      <>
        <Navigation />
        <main>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <span className={styles.loadingText}>{t('initializing')}</span>
          </div>
        </main>
      </>
    );
  }

  const {
    name = '',
    setName,
    gameStarted = false,
    gamePhase = null,
    whoseTurn = null,
    currentTrump = null,
    currentField = null,
    players = [],
    negriCard = null,
    negriPlayerId = null,
    completedFields = [],
    revealedAgari = null,
    gameActions,
    blowDeclarations = [],
    currentHighestDeclaration = null,
    selectedTrump = null,
    setSelectedTrump,
    numberOfPairs = 0,
    setNumberOfPairs,
    teamScores = { 0: { deal: 0, blow: 0, play: 0, total: 0 }, 1: { deal: 0, blow: 0, play: 0, total: 0 } },
    currentPlayerId = null,
    notification,
    setNotification,
    currentRoomId = null,
    paused = false,
    pointsToWin = 0,
    isConnected = false,
    isConnecting = false,
  } = gameState;

  // Type guard to ensure gameActions exists
  if (!gameActions || !setName || !setSelectedTrump || !setNumberOfPairs || !setNotification) {
    return (
      <>
        <Navigation />
        <main>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <span className={styles.loadingText}>
              {t('initializingActions')}
            </span>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <main>
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}
        {paused ? (
          <div className={styles.paused}>
            {t('paused')}
          </div>
        ) : (
          <>
            <div style={{ display: gameStarted ? 'none' : 'block' }}>
              {user && !authLoading ? (
                // 認証済みユーザー: ルーム一覧のみ表示
                <RoomList isConnected={isConnected} isConnecting={isConnecting} />
              ) : (
                // 未認証ユーザー: 従来のjoinGame フォームを表示
                <GameJoinGroup
                  name={name}
                  onNameChange={setName}
                  onJoinGame={gameActions.joinGame}
                  isConnected={isConnected}
                  isConnecting={isConnecting}
                />
              )}
            </div>
            <div style={{ display: gameStarted ? 'block' : 'none' }}>
              <GameTable
                whoseTurn={whoseTurn}
                gamePhase={gamePhase}
                currentTrump={currentTrump}
                currentField={currentField}
                players={players}
                negriCard={negriCard}
                negriPlayerId={negriPlayerId}
                completedFields={completedFields}
                revealedAgari={revealedAgari}
                gameActions={gameActions}
                blowDeclarations={blowDeclarations}
                currentHighestDeclaration={currentHighestDeclaration}
                selectedTrump={selectedTrump}
                setSelectedTrump={setSelectedTrump}
                numberOfPairs={numberOfPairs}
                setNumberOfPairs={setNumberOfPairs}
                teamScores={teamScores}
                currentPlayerId={currentPlayerId}
                currentRoomId={currentRoomId}
                pointsToWin={pointsToWin}
              />
            </div>
          </>
        )}
      </main>
    </>
  );
}
