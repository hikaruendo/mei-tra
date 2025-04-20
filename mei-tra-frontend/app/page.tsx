'use client';

import { GameJoinForm } from '../components/GameJoinForm';
import { GameTable } from '../components/GameTable';
import { Notification } from '../components/Notification';
import { RoomList } from '../components/RoomList';
import { useGame } from '../hooks/useGame';

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
    setNotification
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
        {!gameStarted ? (
          <>
            <RoomList />
            <GameJoinForm
              name={name}
              onNameChange={setName}
              onJoinGame={gameActions.joinGame}
              onStartGame={gameActions.startGame}
              playerCount={players.length}
            />
          </>
        ) : (
          <>
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
            />
          </>
        )}
      </div>
    </main>
  );
}
