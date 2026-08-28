"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { asSeatId } from "@contracts/ids";
import type {
  GameResultSnapshot,
  GameResultViewerRole,
} from "@meitra/game-client/game-result";

import { GameResultExperience } from "@/components/game/GameResultExperience";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import styles from "./result-demo.module.scss";

export function ResultDemoClient() {
  const t = useTranslations("game.gameOver");
  const [viewerRole, setViewerRole] =
    useState<GameResultViewerRole>("winner");
  const [token, setToken] = useState(1);
  const [active, setActive] = useState(false);
  const playSoundEffect = useSoundEffects(true, true);

  const result = useMemo<GameResultSnapshot>(
    () => ({
      token,
      winningTeam: 0,
      viewerRole,
      teamNames: { 0: t("demoWinningTeam"), 1: t("demoLosingTeam") },
      teams: [
        {
          team: 0,
          total: 12,
          members: [
            {
              seatId: asSeatId("demo-seat-1"),
              name: "Mei",
              initial: "M",
              isCOM: false,
            },
            {
              seatId: asSeatId("demo-seat-3"),
              name: "Tora",
              initial: "T",
              isCOM: true,
            },
          ],
        },
        {
          team: 1,
          total: 8,
          members: [
            {
              seatId: asSeatId("demo-seat-2"),
              name: "Haru",
              initial: "H",
              isCOM: false,
            },
            {
              seatId: asSeatId("demo-seat-4"),
              name: "Kuro",
              initial: "K",
              isCOM: false,
            },
          ],
        },
      ],
    }),
    [t, token, viewerRole],
  );

  const playDemo = useCallback(
    (role: GameResultViewerRole) => {
      setViewerRole(role);
      setToken((current) => current + 1);
      setActive(true);
      playSoundEffect("victory");
    },
    [playSoundEffect],
  );

  return (
    <main className={styles.page}>
      <section className={styles.launcher}>
        <span>{t("demoKicker")}</span>
        <h1>{t("demoTitle")}</h1>
        <p>{t("demoDescription")}</p>
        <div className={styles.actions}>
          {(["winner", "loser", "spectator"] as const).map((role) => (
            <button key={role} type="button" onClick={() => playDemo(role)}>
              {t(`demoRole.${role}`)}
            </button>
          ))}
        </div>
      </section>

      {active && (
        <>
          <GameResultExperience
            result={result}
            onClose={() => setActive(false)}
          />
          <nav
            className={styles.previewControls}
            aria-label={t("demoControlsLabel")}
          >
            {(["winner", "loser", "spectator"] as const).map((role) => (
              <button key={role} type="button" onClick={() => playDemo(role)}>
                {t(`demoRole.${role}`)}
              </button>
            ))}
          </nav>
        </>
      )}
    </main>
  );
}
