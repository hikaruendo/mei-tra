'use client';

import type { TrumpType } from '../../types/game.types';
import { useKeyboardOffset } from '../../hooks/useKeyboardOffset';
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
  const keyboardOffset = useKeyboardOffset();

  return (
    <div
      className={styles.container}
      style={keyboardOffset > 0 ? { bottom: `${keyboardOffset}px` } : undefined}
    >
      <StrengthOrderDock currentTrump={currentTrump} />
      <ChatDock roomId={roomId} gameStarted={gameStarted} gamePhase={gamePhase} />
    </div>
  );
}
