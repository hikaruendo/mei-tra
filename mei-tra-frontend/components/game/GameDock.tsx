'use client';

import type { Player, TrumpType } from '@/types/game.types';
import { useKeyboardOffset } from '@/hooks/useKeyboardOffset';
import { ChatDock } from '@/components/social/ChatDock';
import { GameHistoryDock } from '@/components/game/GameHistoryDock';
import { StrengthOrderDock } from '@/components/game/StrengthOrderDock';
import styles from './GameDock.module.scss';

interface GameDockProps {
  roomId: string;
  gameStarted: boolean;
  currentTrump: TrumpType | null;
  gamePhase?: string | null;
  players: Player[];
}

export function GameDock({
  roomId,
  gameStarted,
  currentTrump,
  gamePhase,
  players,
}: GameDockProps) {
  const keyboardOffset = useKeyboardOffset();

  return (
    <div
      className={styles.container}
      style={keyboardOffset > 0 ? { bottom: `${keyboardOffset}px` } : undefined}
    >
      <StrengthOrderDock currentTrump={currentTrump} />
      <GameHistoryDock roomId={roomId} gameStarted={gameStarted} players={players} />
      <ChatDock roomId={roomId} gameStarted={gameStarted} gamePhase={gamePhase} />
    </div>
  );
}
