'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const tCommon = useTranslations('common');
  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);

    updateIsMobile();
    mediaQuery.addEventListener('change', updateIsMobile);

    return () => mediaQuery.removeEventListener('change', updateIsMobile);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isMenuOpen]);

  const renderTools = () => (
    <>
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
    </>
  );

  if (isMobile) {
    return (
      <div className={styles.container} ref={menuRef}>
        <button
          type="button"
          className={styles.menuButton}
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-expanded={isMenuOpen}
        >
          {tCommon('menu')}
        </button>
        {isMenuOpen && (
          <div className={styles.mobileMenu}>
            {renderTools()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {renderTools()}
    </div>
  );
}
