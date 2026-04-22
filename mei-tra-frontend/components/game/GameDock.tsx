'use client';

import type { TrumpType } from '@/types/game.types';
import { ChatDock } from '@/components/social/ChatDock';
import { StrengthOrderDock } from '@/components/game/StrengthOrderDock';
import styles from './GameDock.module.scss';

interface GameDockProps {
  roomId: string;
  gameStarted: boolean;
  currentTrump: TrumpType | null;
  gamePhase?: string | null;
}

export function GameDock({
  roomId,
  gameStarted,
  currentTrump,
  gamePhase,
}: GameDockProps) {
  return (
    <div className={styles.container}>
      <div className={styles.dockItem}>
        <StrengthOrderDock currentTrump={currentTrump} placement="topbar" />
      </div>
      <div className={styles.dockItem}>
        <ChatDock
          roomId={roomId}
          gameStarted={gameStarted}
          gamePhase={gamePhase}
          placement="topbar"
        />
      </div>
    </div>
  );
}
