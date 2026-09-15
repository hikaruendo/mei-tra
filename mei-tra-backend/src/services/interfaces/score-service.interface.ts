import { TeamScore, TeamScoreRecord } from '../../types/game.types';

export interface IScoreService {
  addPoints(team: number, points: number, scores: { [key: number]: TeamScore }): void;
  calculatePlayPoints(declaredPairs: number, wonFields: number): number;
  updateTeamScore(
    team: number,
    points: number,
    scoreRecord: TeamScoreRecord,
  ): TeamScoreRecord;
  flipScoreCard(
    team: number,
    cardIndex: number,
    scoreRecord: TeamScoreRecord,
  ): boolean;
  initializeTeamScores(): { [key: number]: TeamScore };
  initializeTeamScoreRecords(): { [key: number]: TeamScoreRecord };
}
