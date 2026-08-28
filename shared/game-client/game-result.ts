import type {
  GameOverPayload,
  PlayerContract,
  Team,
  TeamNames,
} from "@meitra/contracts/game";
import type { SeatId } from "@meitra/contracts/ids";

export const GAME_RESULT_REVEAL_MS = 4000;

export type GameResultViewerRole = "winner" | "loser" | "spectator";

export interface GameResultMember {
  seatId: SeatId;
  name: string;
  initial: string;
  isCOM: boolean;
}

export interface GameResultTeam {
  team: Team;
  total: number;
  members: GameResultMember[];
}

export interface GameResultSnapshot {
  token: number;
  winningTeam: Team;
  viewerRole: GameResultViewerRole;
  teams: [GameResultTeam, GameResultTeam];
  teamNames?: TeamNames;
}

export const resolveWinningTeam = (
  payload: Pick<GameOverPayload, "winner" | "winningTeam">,
): Team | null => {
  if (payload.winningTeam === 0 || payload.winningTeam === 1) {
    return payload.winningTeam;
  }
  if (payload.winner === "Team 0") return 0;
  if (payload.winner === "Team 1") return 1;
  return null;
};

const initialFor = (name: string): string =>
  Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "?";

export const buildGameResultSnapshot = ({
  payload,
  players,
  viewerSeatId,
  isSpectator,
  teamNames,
  token,
}: {
  payload: GameOverPayload;
  players: readonly PlayerContract[];
  viewerSeatId: SeatId | string | null;
  isSpectator: boolean;
  teamNames?: TeamNames;
  token: number;
}): GameResultSnapshot | null => {
  const winningTeam = resolveWinningTeam(payload);
  if (winningTeam === null) return null;

  const viewer = players.find((player) => player.seatId === viewerSeatId);
  const viewerRole: GameResultViewerRole =
    isSpectator || !viewer
      ? "spectator"
      : viewer.team === winningTeam
        ? "winner"
        : "loser";
  const losingTeam: Team = winningTeam === 0 ? 1 : 0;
  const makeTeam = (team: Team): GameResultTeam => ({
    team,
    total: payload.finalScores[team]?.total ?? 0,
    members: players
      .filter((player) => player.team === team)
      .map((player) => ({
        seatId: player.seatId,
        name: player.name,
        initial: initialFor(player.name),
        isCOM: player.isCOM === true,
      })),
  });

  return {
    token,
    winningTeam,
    viewerRole,
    teams: [makeTeam(winningTeam), makeTeam(losingTeam)],
    teamNames,
  };
};
