'use client';

import { GameJoinForm } from '../../molecules/GameJoinForm';
import { RoomList } from '../../molecules/RoomList';
import styles from './index.module.scss';
type GameJoinGroupProps = {
  name: string;
  onNameChange: (name: string) => void;
  onJoinGame: () => void;
};

export default function GameJoinGroup({ name, onNameChange, onJoinGame }: GameJoinGroupProps) {
  return (
    <div className={styles.container}>
      <GameJoinForm
        name={name}
        onNameChange={onNameChange}
        onJoinGame={onJoinGame}
      />
      <RoomList />
    </div>
  );
}
