import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { TeamScores } from '../types/shared';

interface GameResultProps {
  visible: boolean;
  teamScores: TeamScores;
  winnerTeam: number | null;
  roundResults?: {
    team: number;
    dealPoints: number;
    blowPoints: number;
    playPoints: number;
    totalPoints: number;
  }[];
  onBackToLobby: () => void;
  onNewGame?: () => void;
}

export const GameResult: React.FC<GameResultProps> = ({
  visible,
  teamScores,
  winnerTeam,
  roundResults,
  onBackToLobby,
  onNewGame,
}) => {
  const getTeamName = (team: number) => `チーム ${team + 1}`;

  const renderFinalScores = () => (
    <View style={styles.scoresContainer}>
      <Text style={styles.scoresTitle}>最終スコア</Text>
      {Object.entries(teamScores).map(([team, score]) => {
        const teamNum = parseInt(team);
        const isWinner = winnerTeam === teamNum;
        return (
          <View
            key={team}
            style={[
              styles.teamScore,
              isWinner && styles.winnerTeamScore,
            ]}
          >
            <Text style={[
              styles.teamName,
              isWinner && styles.winnerTeamName,
            ]}>
              {getTeamName(teamNum)}
            </Text>
            <Text style={[
              styles.teamPoints,
              isWinner && styles.winnerTeamPoints,
            ]}>
              {score.total}点
            </Text>
          </View>
        );
      })}
    </View>
  );

  const renderRoundResults = () => {
    if (!roundResults || roundResults.length === 0) return null;

    return (
      <View style={styles.roundResultsContainer}>
        <Text style={styles.roundResultsTitle}>ラウンド詳細</Text>
        {roundResults.map((result, index) => (
          <View key={index} style={styles.roundResult}>
            <Text style={styles.roundTeamName}>
              {getTeamName(result.team)}
            </Text>
            <View style={styles.roundPoints}>
              <Text style={styles.roundPointDetail}>
                配り: {result.dealPoints}点
              </Text>
              <Text style={styles.roundPointDetail}>
                ブロー: {result.blowPoints}点
              </Text>
              <Text style={styles.roundPointDetail}>
                プレイ: {result.playPoints}点
              </Text>
              <Text style={styles.roundPointTotal}>
                合計: {result.totalPoints}点
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onBackToLobby}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>ゲーム終了</Text>
          {winnerTeam !== null && (
            <Text style={styles.winnerAnnouncement}>
              🏆 {getTeamName(winnerTeam)} の勝利！
            </Text>
          )}
        </View>

        <View style={styles.content}>
          {renderFinalScores()}
          {renderRoundResults()}
        </View>

        <View style={styles.actions}>
          {onNewGame && (
            <TouchableOpacity
              style={[styles.button, styles.newGameButton]}
              onPress={onNewGame}
            >
              <Text style={styles.buttonText}>新しいゲーム</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.button, styles.lobbyButton]}
            onPress={onBackToLobby}
          >
            <Text style={styles.buttonText}>ロビーに戻る</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#1B5E20',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  winnerAnnouncement: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scoresContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  teamScore: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  winnerTeamScore: {
    backgroundColor: '#E8F5E8',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  teamName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  winnerTeamName: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  teamPoints: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#555',
  },
  winnerTeamPoints: {
    color: '#2E7D32',
    fontSize: 22,
  },
  roundResultsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  roundResultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  roundResult: {
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  roundTeamName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginBottom: 8,
  },
  roundPoints: {
    paddingLeft: 10,
  },
  roundPointDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  roundPointTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  actions: {
    padding: 20,
    gap: 12,
  },
  button: {
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  newGameButton: {
    backgroundColor: '#4CAF50',
  },
  lobbyButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});