'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Player, TrumpType } from '@/types/game.types';
import { ChatDock } from '@/components/social/ChatDock';
import { GameHistoryDock } from '@/components/game/GameHistoryDock';
import { StrengthOrderDock } from '@/components/game/StrengthOrderDock';
import styles from './GameDock.module.scss';

interface GameDockProps {
  roomId: string;
  gameStarted: boolean;
  currentTrump: TrumpType | null;
  gamePhase?: string | null;
  players?: Player[];
  onLeaveRequest?: () => void;
}

export function GameDock({
  roomId,
  gameStarted,
  currentTrump,
  gamePhase,
  players,
  onLeaveRequest,
}: GameDockProps) {
  const tCommon = useTranslations('common');
  const tHistory = useTranslations('gameHistoryDock');
  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 959px)');
    const updateIsMobile = () => {
      setIsMobile(mediaQuery.matches);
      setIsMenuOpen(false);
    };

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

  useEffect(() => {
    if (!isHistoryOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsHistoryOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isHistoryOpen]);

  const tools = (
    <>
      <div className={styles.dockItem}>
        <StrengthOrderDock currentTrump={currentTrump} placement="topbar" />
      </div>
      <div className={styles.dockItem}>
        <ChatDock
          roomId={roomId}
          gameStarted={gameStarted}
          gamePhase={gamePhase}
          placement={isMobile ? 'menu' : 'topbar'}
        />
      </div>
      <div className={styles.dockItem}>
        <button
          type="button"
          className={styles.historyButton}
          onClick={() => {
            setIsHistoryOpen((previous) => !previous);
            setIsMenuOpen(false);
          }}
          aria-expanded={isHistoryOpen}
        >
          {tHistory('title')}
        </button>
      </div>
      {isMobile && onLeaveRequest && (
        <div className={styles.dockItem}>
          <button
            type="button"
            className={styles.leaveMenuButton}
            onClick={() => {
              setIsMenuOpen(false);
              onLeaveRequest();
            }}
          >
            {tCommon('leave')}
          </button>
        </div>
      )}
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
          aria-label={tCommon('menu')}
          title={tCommon('menu')}
        >
          <span className={styles.menuSymbol} aria-hidden="true">
            {isMenuOpen ? '×' : '⋯'}
          </span>
        </button>
        <div
          className={`${styles.mobileMenu} ${isMenuOpen ? styles.mobileMenuOpen : ''}`}
          aria-hidden={!isMenuOpen}
        >
          {tools}
        </div>
        {isHistoryOpen && (
          <div className={styles.historyPanel}>
            <GameHistoryDock
              roomId={roomId}
              gameStarted={gameStarted}
              players={players}
              defaultOpen
              hideOpenPage
              onClose={() => setIsHistoryOpen(false)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {tools}
      {isHistoryOpen && (
        <div className={styles.historyPanel}>
          <GameHistoryDock
            roomId={roomId}
            gameStarted={gameStarted}
            players={players}
            defaultOpen
            hideOpenPage
            onClose={() => setIsHistoryOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
