import { TeamScore, TeamScoreRecord } from '../../types/game.types';

export interface IScoreService {
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
