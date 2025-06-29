import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TeamScores } from '../types/shared';

interface DetailedScoreBoardProps {
  teamScores: TeamScores;
  currentRound?: number;
  roundHistory?: {
    round: number;
    teamScores: {
      [teamId: number]: {
        deal: number;
        blow: number;
        play: number;
        total: number;
      };
    };
  }[];
}

export const DetailedScoreBoard: React.FC<DetailedScoreBoardProps> = ({
  teamScores,
  currentRound,
  roundHistory = [],
}) => {
  const getTeamName = (teamId: number) => `チーム ${teamId + 1}`;

  const renderCurrentScores = () => (
    <View style={styles.currentScoresContainer}>
      <Text style={styles.sectionTitle}>現在のスコア</Text>
      {Object.entries(teamScores).map(([teamId, score]) => {
        const teamNum = parseInt(teamId);
        return (
          <View key={teamId} style={styles.teamScoreRow}>
            <Text style={styles.teamName}>{getTeamName(teamNum)}</Text>
            <View style={styles.scoreBreakdown}>
              <Text style={styles.scoreDetail}>
                プレイ: {score.play}点
              </Text>
              <Text style={styles.totalScore}>
                合計: {score.total}点
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderRoundHistory = () => {
    if (roundHistory.length === 0) return null;

    return (
      <View style={styles.historyContainer}>
        <Text style={styles.sectionTitle}>ラウンド履歴</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.historyTable}>
            {/* Header */}
            <View style={styles.historyHeader}>
              <Text style={styles.headerCell}>ラウンド</Text>
              {Object.keys(teamScores).map((teamId) => (
                <Text key={teamId} style={styles.headerCell}>
                  {getTeamName(parseInt(teamId))}
                </Text>
              ))}
            </View>

            {/* Rows */}
            {roundHistory.map((round) => (
              <View key={round.round} style={styles.historyRow}>
                <Text style={styles.roundCell}>{round.round}</Text>
                {Object.entries(round.teamScores).map(([teamId, scores]) => (
                  <View key={teamId} style={styles.scoreCell}>
                    <Text style={styles.cellScoreDetail}>
                      配: {scores.deal}
                    </Text>
                    <Text style={styles.cellScoreDetail}>
                      ブ: {scores.blow}
                    </Text>
                    <Text style={styles.cellScoreDetail}>
                      プ: {scores.play}
                    </Text>
                    <Text style={styles.cellTotal}>
                      計: {scores.total}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderGameProgress = () => {
    if (!currentRound) return null;

    const maxScore = Math.max(...Object.values(teamScores).map(s => s.total));
    const winningScore = 500; // ゲーム設定に応じて調整

    return (
      <View style={styles.progressContainer}>
        <Text style={styles.sectionTitle}>ゲーム進行</Text>
        <Text style={styles.progressText}>
          ラウンド {currentRound} • 勝利まで {winningScore - maxScore}点
        </Text>
        
        {/* Progress bars for each team */}
        {Object.entries(teamScores).map(([teamId, score]) => {
          const teamNum = parseInt(teamId);
          const progress = Math.min(score.total / winningScore, 1);
          
          return (
            <View key={teamId} style={styles.progressBarContainer}>
              <Text style={styles.progressTeamName}>
                {getTeamName(teamNum)}
              </Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { width: `${progress * 100}%` },
                    teamNum === 0 ? styles.team0Progress : styles.team1Progress,
                  ]}
                />
              </View>
              <Text style={styles.progressScore}>{score.total}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {renderCurrentScores()}
      {renderGameProgress()}
      {renderRoundHistory()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginBottom: 15,
    textAlign: 'center',
  },
  currentScoresContainer: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  teamScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  scoreBreakdown: {
    alignItems: 'flex-end',
  },
  scoreDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  totalScore: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  progressContainer: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  progressTeamName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    width: 80,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  team0Progress: {
    backgroundColor: '#4CAF50',
  },
  team1Progress: {
    backgroundColor: '#2196F3',
  },
  progressScore: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    width: 40,
    textAlign: 'right',
  },
  historyContainer: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyTable: {
    minWidth: 400,
  },
  historyHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 2,
    borderBottomColor: '#ddd',
  },
  headerCell: {
    flex: 1,
    padding: 10,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    minWidth: 80,
  },
  historyRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  roundCell: {
    flex: 1,
    padding: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    minWidth: 80,
  },
  scoreCell: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    minWidth: 80,
  },
  cellScoreDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 1,
  },
  cellTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginTop: 2,
  },
});