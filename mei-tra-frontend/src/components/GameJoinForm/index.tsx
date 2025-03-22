'use client';

interface GameJoinFormProps {
  name: string;
  onNameChange: (name: string) => void;
  onJoinGame: () => void;
  onStartGame: () => void;
  playerCount: number;
}

export const GameJoinForm = ({
  name,
  onNameChange,
  onJoinGame,
  onStartGame,
  playerCount,
}: GameJoinFormProps) => {
  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-lg shadow-md">
      <input 
        type="text" 
        placeholder="Enter name" 
        value={name} 
        onChange={(e) => onNameChange(e.target.value)} 
        className="border rounded p-2 w-full" 
      />
      <div className="flex gap-2">
        <button 
          onClick={onJoinGame} 
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Join Game
        </button>
        <button 
          onClick={onStartGame} 
          disabled={playerCount < 4} 
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          Start Game ({playerCount}/4 players)
        </button>
      </div>
    </div>
  );
}; 