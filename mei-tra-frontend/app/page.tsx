'use client';

import { GameTable } from '../components/GameTable';
import { Notification } from '../components/Notification';
import { useGame } from '../hooks/useGame';
import GameJoinGroup from '../components/organisms/GameJoinGroup';

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
  } = gameState;

  return (
    <main className="">
      <div className="">
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}
        {paused ? (
          <div className="text-center text-yellow-600 font-bold text-xl my-8">
            ゲームは一時停止中です。4人揃うと再開します。
          </div>
        ) : (
          <>
            <div style={{ display: gameStarted ? 'none' : 'block' }}>
              <GameJoinGroup
                name={name}
                onNameChange={setName}
                onJoinGame={gameActions.joinGame}
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
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
