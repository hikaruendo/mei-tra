'use client';

import type { TrumpType } from '../../types/game.types';
import { ChatDock } from '../social/ChatDock';
import { StrengthOrderDock } from './StrengthOrderDock';
import styles from './GameDock.module.scss';

interface GameDockProps {
  roomId: string;
  gameStarted: boolean;
  currentTrump: TrumpType | null;
  gamePhase?: string | null;
}

export function GameDock({ roomId, gameStarted, currentTrump, gamePhase }: GameDockProps) {
  return (
    <div className={styles.container}>
      <StrengthOrderDock currentTrump={currentTrump} />
      <ChatDock roomId={roomId} gameStarted={gameStarted} gamePhase={gamePhase} />
    </div>
  );
}
