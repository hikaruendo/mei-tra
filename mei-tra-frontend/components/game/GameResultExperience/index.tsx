"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { GameResultSnapshot } from "@meitra/game-client/game-result";
import { GAME_RESULT_REVEAL_MS } from "@meitra/game-client/game-result";
import { getTeamDisplayName } from "@/lib/utils/teamLabels";
import { GuestUpgradePrompt } from "@/components/auth/GuestUpgradePrompt";
import styles from "./GameResultExperience.module.scss";

interface Props {
  result: GameResultSnapshot;
  onClose: () => void;
  onRegister?: () => void;
}

const SUITS = ["♠", "♥", "♦", "♣", "♠", "♦", "♣", "♥"];
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function GameResultExperience({ result, onClose, onRegister }: Props) {
  const t = useTranslations("game.gameOver");
  const gameT = useTranslations("game");
  const [revealing, setRevealing] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const winner = result.teams[0];
  const teamName = (team: 0 | 1) =>
    getTeamDisplayName(team, result.teamNames, (fallbackTeam) =>
      gameT(fallbackTeam === 0 ? "teamRed" : "teamBlack"),
    );
  const winnerName = teamName(winner.team);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      setRevealing(false);
      return;
    }
    const timer = window.setTimeout(
      () => setRevealing(false),
      GAME_RESULT_REVEAL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [result.token]);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    return () => previouslyFocused?.focus();
  }, []);

  useEffect(() => {
    if (revealing) {
      overlayRef.current?.focus();
    } else {
      panelRef.current?.focus();
    }
  }, [revealing]);

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (revealing) {
      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "Escape"
      ) {
        event.preventDefault();
        setRevealing(false);
      }
      return;
    }

    if (event.key !== "Tab") return;

    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const active = document.activeElement;
    if (event.shiftKey && (active === panel || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === panel || active === last)) {
      event.preventDefault();
      first.focus();
    }
  };

  const headline =
    result.viewerRole === "winner"
      ? t("victory")
      : result.viewerRole === "loser"
        ? t("defeat")
        : t("spectatorVictory", { team: winnerName });

  return (
    <div
      className={`${styles.overlay} ${styles[result.viewerRole]} ${revealing ? styles.revealing : styles.complete}`}
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={headline}
      tabIndex={revealing ? 0 : -1}
      onClick={revealing ? () => setRevealing(false) : undefined}
      onKeyDown={handleDialogKeyDown}
    >
      <div className={styles.vignette} />
      {SUITS.map((suit, index) => (
        <span
          key={`${suit}-${index}`}
          className={styles.suit}
          style={{ "--i": index } as React.CSSProperties}
          aria-hidden="true"
        >
          {suit}
        </span>
      ))}
      {revealing ? (
        <div className={styles.revealCard}>
          <span className={styles.crownSuit}>♠</span>
          <h1>{headline}</h1>
          <p>{winnerName}</p>
          <small>{t("tapToSkip")}</small>
        </div>
      ) : (
        <div className={styles.panel} ref={panelRef} tabIndex={-1}>
          <header>
            <span>{t("resultKicker")}</span>
            <h1>{t("finalResult")}</h1>
            <p className={styles.headline}>{headline}</p>
          </header>
          <div className={styles.teams}>
            {result.teams.map((team, index) => (
              <section
                className={`${styles.team} ${index === 0 ? styles.champion : ""}`}
                key={team.team}
              >
                <div className={styles.teamHeading}>
                  <div>
                    {index === 0 && (
                      <span className={styles.badge}>{t("winnerBadge")}</span>
                    )}
                    <h2>{teamName(team.team)}</h2>
                  </div>
                  <strong>{t("points", { score: team.total })}</strong>
                </div>
                <div className={styles.members}>
                  {team.members.map((member) => (
                    <div className={styles.member} key={member.seatId}>
                      <span className={styles.initial}>{member.initial}</span>
                      <span>
                        {member.name}
                        {member.isCOM ? ` ${t("com")}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
          {onRegister && <GuestUpgradePrompt onRegisterClick={onRegister} />}
          <button
            className={styles.closeButton}
            type="button"
            onClick={onClose}
          >
            {t("toRooms")}
          </button>
        </div>
      )}
    </div>
  );
}
