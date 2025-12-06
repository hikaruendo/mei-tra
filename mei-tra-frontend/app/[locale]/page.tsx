'use client';

import { useTranslations } from 'next-intl';
import { GameTable } from '../../components/GameTable';
import { Notification } from '../../components/Notification';
import { Navigation } from '../../components/layout/Navigation';
import { useGame } from '../../hooks/useGame';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { RoomList } from '../../components/molecules/RoomList';
import { ChatDock } from '../../components/social/ChatDock';
import styles from './index.module.css';

export const dynamic = 'force-dynamic';

export default function Home() {
  const t = useTranslations('game');
  const gameState = useGame();

  // Always show UI - only show loading overlay if truly necessary
  if (!gameState) {
    return (
      <>
        <Navigation gameStarted={false} />
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
  if (!gameActions || !setSelectedTrump || !setNumberOfPairs || !setNotification) {
    return (
      <>
        <Navigation gameStarted={false} />
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
    <ProtectedRoute requireAuth={true}>
      <Navigation gameStarted={gameStarted} />
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
              <RoomList isConnected={isConnected} isConnecting={isConnecting} />
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
              {currentRoomId && (
                <ChatDock roomId={currentRoomId} gameStarted={gameStarted} />
              )}
            </div>
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}
