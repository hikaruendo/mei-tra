'use client';

import { GameTable } from '../components/GameTable';
import { Notification } from '../components/Notification';
import { Navigation } from '../components/layout/Navigation';
import { useGame } from '../hooks/useGame';
import GameJoinGroup from '../components/organisms/GameJoinGroup';
import styles from './index.module.css';

export const dynamic = 'force-dynamic';

export default function Home() {
  const gameState = useGame();

  if (!gameState) {
    return null;
  }

  const {
    name,
    setName,
    gameStarted,
    gamePhase,
    whoseTurn,
    currentTrump,
    currentField,
    players,
    negriCard,
    negriPlayerId,
    completedFields,
    revealedAgari,
    gameActions,
    blowDeclarations,
    currentHighestDeclaration,
    selectedTrump,
    setSelectedTrump,
    numberOfPairs,
    setNumberOfPairs,
    teamScores,
    currentPlayerId,
    notification,
    setNotification,
    currentRoomId,
    paused,
    pointsToWin,
    isConnected,
    isConnecting,
  } = gameState;

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
            Game is paused. It will resume when 4 players are present.
          </div>
        ) : (
          <>
            <div style={{ display: gameStarted ? 'none' : 'block' }}>
              <GameJoinGroup
                name={name}
                onNameChange={setName}
                onJoinGame={gameActions.joinGame}
                isConnected={isConnected}
                isConnecting={isConnecting}
              />
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
