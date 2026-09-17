'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { DevChomboScenarioType } from '@contracts/game';
import type { Player, TeamNames, TrumpType } from '@/types/game.types';
import { ChatDock } from '@/components/social/ChatDock';
import { ChomboScenarioPanel } from '@/components/game/ChomboScenarioPanel';
import { GameHistoryDock } from '@/components/game/GameHistoryDock';
import { StrengthOrderDock } from '@/components/game/StrengthOrderDock';
import styles from './GameDock.module.scss';

interface GameDockProps {
  roomId: string;
  gameStarted: boolean;
  currentTrump: TrumpType | null;
  gameMode: 'normal' | 'pro';
  gamePhase?: string | null;
  players?: Player[];
  teamNames?: TeamNames;
  chomboReport?: ReactNode;
  onSetupChomboScenario?: (violationType: DevChomboScenarioType) => void;
  onLeaveRequest?: () => void;
}

export function GameDock({
  roomId,
  gameStarted,
  currentTrump,
  gameMode,
  gamePhase,
  players,
  teamNames,
  chomboReport,
  onSetupChomboScenario,
  onLeaveRequest,
}: GameDockProps) {
  const tCommon = useTranslations('common');
  const tHistory = useTranslations('gameHistoryDock');
  const tChombo = useTranslations('chomboReport');
  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isChomboOpen, setIsChomboOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const hasChomboPanel = Boolean(chomboReport || onSetupChomboScenario);

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
    if (!isHistoryOpen && !isChomboOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsHistoryOpen(false);
        setIsChomboOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isHistoryOpen, isChomboOpen]);

  useEffect(() => {
    if (!hasChomboPanel) {
      setIsChomboOpen(false);
    }
  }, [hasChomboPanel]);

  const tools = (
    <>
      {gameMode === 'normal' && (
        <div className={styles.dockItem}>
          <StrengthOrderDock currentTrump={currentTrump} placement="topbar" />
        </div>
      )}
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
            setIsChomboOpen(false);
            setIsMenuOpen(false);
          }}
          aria-expanded={isHistoryOpen}
        >
          {tHistory('title')}
        </button>
      </div>
      {hasChomboPanel && (
        <div className={styles.dockItem}>
          <button
            type="button"
            className={styles.historyButton}
            onClick={() => {
              setIsChomboOpen((previous) => !previous);
              setIsHistoryOpen(false);
              setIsMenuOpen(false);
            }}
            aria-expanded={isChomboOpen}
          >
            {tChombo('dockLabel')}
          </button>
        </div>
      )}
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

  const panels = (
    <>
      {isHistoryOpen && (
        <div className={styles.historyPanel}>
          <GameHistoryDock
            roomId={roomId}
            gameStarted={gameStarted}
            players={players}
            teamNames={teamNames}
            defaultOpen
            hideOpenPage
            onClose={() => setIsHistoryOpen(false)}
          />
        </div>
      )}
      {isChomboOpen && hasChomboPanel && (
        <div className={styles.chomboPanel}>
          {chomboReport}
          {onSetupChomboScenario && (
            <ChomboScenarioPanel
              onSelect={(violationType) => {
                setIsChomboOpen(false);
                onSetupChomboScenario(violationType);
              }}
            />
          )}
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
        {panels}
      </div>
    );
  }

  return (
    <div className={styles.container} ref={menuRef}>
      {tools}
      {panels}
    </div>
  );
}
