'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GameTable } from '../../components/GameTable';
import { Notification } from '../../components/Notification';
import { Navigation } from '../../components/layout/Navigation';
import { useGame } from '../../hooks/useGame';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { RoomList } from '../../components/molecules/RoomList';
import { PreGameTable } from '../../components/PreGameTable';
import { GameDock } from '../../components/game/GameDock';
import { LandingPage } from '../../components/landing/LandingPage';
import { AuthModal } from '../../components/auth/AuthModal';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import styles from './index.module.css';

export const dynamic = 'force-dynamic';

export default function Home() {
  const t = useTranslations('game');
  const { user, loading: authLoading } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const gameState = useGame();
  const { socket } = useSocket();

  const openAuthModal = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  if (authLoading) {
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

  if (!user) {
    return (
      <>
        <Navigation gameStarted={false} />
        <LandingPage
          onLoginClick={() => openAuthModal('signin')}
          onSignupClick={() => openAuthModal('signup')}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          initialMode={authMode}
        />
      </>
    );
  }

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
    isHost = false,
    startGame,
    paused = false,
    pointsToWin = 0,
    isConnected = false,
    isConnecting = false,
    users = [],
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

  const handleLeaveRoom = () => {
    if (socket && currentRoomId && currentPlayerId) {
      socket.emit('leave-room', { roomId: currentRoomId, playerId: currentPlayerId });
    }
  };

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
            {/* ① RoomList: 部屋に入っていない && ゲーム未開始 */}
            <div style={{ display: (!currentRoomId && !gameStarted) ? 'block' : 'none' }}>
              <RoomList
                isConnected={isConnected}
                isConnecting={isConnecting}
                players={players}
                users={users}
                currentPlayerId={currentPlayerId}
              />
            </div>

            {/* ② プレゲームエリア: 部屋に入っている && ゲーム未開始 */}
            {currentRoomId && !gameStarted && (
              <PreGameTable
                players={players}
                currentPlayerId={currentPlayerId}
                isHost={isHost}
                onStart={startGame}
                onLeave={handleLeaveRoom}
              />
            )}

            {/* ③ GameTable: ゲーム開始後 */}
            <div className={gameStarted ? styles.gameWrapper : undefined} style={{ display: gameStarted ? 'block' : 'none' }}>
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
                <GameDock
                  roomId={currentRoomId}
                  gameStarted={gameStarted}
                  currentTrump={currentTrump}
                  gamePhase={gamePhase}
                />
              )}
            </div>
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}
