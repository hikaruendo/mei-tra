import { Player } from '../../types/game.types';

/**
 * チーム番号に基づいてプレイヤー名からチーム表示名を生成
 */
export const getTeamDisplayName = (players: Player[], teamNumber: 0 | 1): string => {
  const teamPlayers = players
    .filter(p => p.team === teamNumber && !p.playerId.startsWith('dummy-'))
    .map(p => p.name);

  if (teamPlayers.length === 0) {
    return `チーム ${teamNumber + 1}`;
  }

  // プレイヤー名を「・」で結合
  return teamPlayers.join('・');
};

/**
 * 勝利チームの表示名を取得
 */
export const getWinningTeamName = (players: Player[], winningTeam: 0 | 1): string => {
  const teamName = getTeamDisplayName(players, winningTeam);
  return teamName || `チーム ${winningTeam + 1}`;
};

/**
 * チーム選択用のオプション表示を取得
 */
export const getTeamOptionLabel = (players: Player[], teamNumber: 0 | 1): string => {
  const teamPlayers = players
    .filter(p => p.team === teamNumber && !p.playerId.startsWith('dummy-'));

  if (teamPlayers.length === 0) {
    return `チーム ${teamNumber + 1}`;
  }

  const names = teamPlayers.map(p => p.name).join('・');
  return `${names} (${teamPlayers.length}/2)`;
};