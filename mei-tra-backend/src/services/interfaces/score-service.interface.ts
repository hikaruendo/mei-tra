import {
  ScoreRecord,
  Team,
  TeamScore,
  TeamScoreRecord,
} from '../../types/game.types';

export interface IScoreService {
  addPoints(
    team: Team,
    points: number,
    scores: { [key: number]: TeamScore },
    records: Record<Team, ScoreRecord[]>,
    reason: string,
  ): void;
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
