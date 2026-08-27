'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { GameTable } from '@/components/game/GameTable';
import { PreGameTable } from '@/components/game/PreGameTable';
import { Notification } from '@/components/shared/Notification';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { useGame } from '@/hooks/useGame';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { RoomList } from '@/components/room/RoomList';
import { LandingPage } from '@/components/landing/LandingPage';
import { AuthModal } from '@/components/auth/AuthModal';
import { UpgradeAccountModal } from '@/components/auth/UpgradeAccountModal';
import { GuestUpgradePrompt } from '@/components/auth/GuestUpgradePrompt';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { useAuth } from '@/hooks/useAuth';
import styles from './index.module.css';

export const dynamic = 'force-dynamic';

export default function Home() {
  const t = useTranslations('game');
  const commonT = useTranslations('common');
  const authT = useTranslations('auth');
  const locale = useLocale();
  const { user, loading: authLoading, signInAnonymously } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isGuestSigningIn, setIsGuestSigningIn] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const gameState = useGame();

  const openAuthModal = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleGuestStart = async () => {
    if (isGuestSigningIn) return;

    setIsGuestSigningIn(true);
    try {
      const guestNumber = Math.floor(1000 + Math.random() * 9000);
      const { error } = await signInAnonymously({
        displayName: authT('guestDefaultName', { number: guestNumber }),
        locale: locale === 'en' ? 'en' : 'ja',
      });

      // On failure fall back to the auth modal, whose guest button surfaces errors.
      if (error) {
        openAuthModal('signin');
      }
    } finally {
      setIsGuestSigningIn(false);
    }
  };

  if (authLoading) {
    return (
      <>
        <Navigation gameStarted={false} />
        <main className={styles.main}>
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
          onGuestClick={handleGuestStart}
          guestPending={isGuestSigningIn}
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
        <main className={styles.main}>
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
    completedFields = [],
    revealedAgari = null,
    gameActions,
    blowDeclarations = [],
    blowActionHistory = [],
    currentHighestDeclaration = null,
    selectedTrump = null,
    setSelectedTrump,
    numberOfPairs = 0,
    setNumberOfPairs,
    teamScores = { 0: { deal: 0, blow: 0, play: 0, total: 0 }, 1: { deal: 0, blow: 0, play: 0, total: 0 } },
    currentSeatId = null,
    notification,
    setNotification,
    gameOverModal = null,
    closeGameOverModal = () => {},
    currentRoomId = null,
    isHost = false,
    isSpectator = false,
    teamNames,
    startGame,
    shuffleTeams,
    updateTeamNames,
    removePlayerFromRoom,
    replacePlayerWithCOM,
    idleSeatIds = [],
    disconnectedSeatIds = [],
    paused = false,
    pointsToWin = 0,
    isConnected = false,
    isConnecting = false,
    users = [],
    socket = null,
    firstTurnReveal = null,
    clearFirstTurnReveal,
    dealAnimationCue = null,
    playCardInteractionSound = () => {},
  } = gameState;

  // Type guard to ensure gameActions exists
  if (!gameActions || !setSelectedTrump || !setNumberOfPairs || !setNotification) {
    return (
      <>
        <Navigation gameStarted={false} />
        <main className={styles.main}>
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
    if (socket && currentRoomId && isSpectator) {
      socket.emit('leave-watch-room', { roomId: currentRoomId });
      return;
    }

    if (socket && currentRoomId && currentSeatId) {
      socket.emit('leave-room', { roomId: currentRoomId });
    }
  };

  return (
    <ProtectedRoute requireAuth={true}>
      <Navigation gameStarted={gameStarted} inRoom={!!currentRoomId} />
      <main className={styles.main}>
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}
        {gameOverModal && (
          <ConfirmModal
            isOpen={true}
            title={gameOverModal.title}
            message={gameOverModal.message}
            onConfirm={closeGameOverModal}
            onCancel={closeGameOverModal}
            confirmText={commonT('close')}
            showCancelButton={false}
          >
            {user?.isAnonymous && (
              <GuestUpgradePrompt
                onRegisterClick={() => {
                  closeGameOverModal();
                  setIsUpgradeModalOpen(true);
                }}
              />
            )}
          </ConfirmModal>
        )}
        <UpgradeAccountModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
        />
        {paused ? (
          <div className={styles.paused}>
            {t('paused')}
          </div>
        ) : (
          <>
            {/* ① RoomList: 部屋に入っていない && ゲーム未開始 */}
            {!currentRoomId && !gameStarted && (
              <div>
                <RoomList
                  isConnected={isConnected}
                  isConnecting={isConnecting}
                  users={users}
                  currentSeatId={currentSeatId}
                />
                <Footer />
              </div>
            )}

            {/* ② PreGameTable: 待機中 / GameTable: ゲーム中 */}
            {currentRoomId && (
              <div className={`${styles.gameWrapper} ${gameStarted ? styles.activeGameWrapper : ''}`}>
                {!gameStarted ? (
                  <PreGameTable
                    players={players}
                    currentSeatId={currentSeatId}
                    isHost={isHost}
                    onStart={startGame}
                    onLeave={handleLeaveRoom}
                    shuffleTeams={shuffleTeams}
                    teamNames={teamNames}
                    onUpdateTeamNames={updateTeamNames}
                    onRemovePlayer={removePlayerFromRoom}
                  />
                ) : (
                <GameTable
                  whoseTurn={whoseTurn}
                  gamePhase={gamePhase}
                  currentTrump={currentTrump}
                  currentField={currentField}
                  players={players}
                  negriCard={negriCard}
                  completedFields={completedFields}
                  revealedAgari={revealedAgari}
                  gameActions={gameActions}
                  blowDeclarations={blowDeclarations}
                  blowActionHistory={blowActionHistory}
                  currentHighestDeclaration={currentHighestDeclaration}
                  selectedTrump={selectedTrump}
                  setSelectedTrump={setSelectedTrump}
                  numberOfPairs={numberOfPairs}
                  setNumberOfPairs={setNumberOfPairs}
                  teamScores={teamScores}
                  currentSeatId={currentSeatId}
                  currentRoomId={currentRoomId}
                  isHost={isHost}
                  isSpectator={isSpectator}
                  teamNames={teamNames}
                  idleSeatIds={idleSeatIds}
                  disconnectedSeatIds={disconnectedSeatIds}
                  pointsToWin={pointsToWin}
                  onLeave={handleLeaveRoom}
                  onReplaceWithCOM={replacePlayerWithCOM}
                  firstTurnReveal={firstTurnReveal}
                  onFirstTurnRevealDone={clearFirstTurnReveal}
                  dealAnimationCue={dealAnimationCue}
                  onCardInteraction={playCardInteractionSound}
                />
                )}
              </div>
            )}
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}
