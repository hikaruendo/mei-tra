import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSocketService } from '../services/useSocketService';
import { Player, GamePhase, TeamScores, BlowDeclaration, TrumpType } from '../types/shared';
import { PlayerHand } from '../components/PlayerHand';
import { GameField } from '../components/GameField';
import { BlowControls } from '../components/BlowControls';
import { GameResult } from '../components/GameResult';
import { NotificationSystem } from '../components/NotificationSystem';
import { DetailedScoreBoard } from '../components/DetailedScoreBoard';
import { useNotification } from '../hooks/useNotification';

interface GameScreenProps {
  route: {
    params: {
      roomId: string;
    };
  };
  navigation: any;
}

export function GameScreen({ route, navigation }: GameScreenProps) {
  const { roomId } = route.params;
  const { socket } = useSocketService();
  const { notifications, removeNotification, showInfo, showSuccess, showWarning, showError } = useNotification();
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>(null);
  const [whoseTurn, setWhoseTurn] = useState<string | null>(null);
  const [teamScores, setTeamScores] = useState<TeamScores>({});
  const [currentDeclaration, setCurrentDeclaration] = useState<BlowDeclaration | null>(null);
  const [declarations, setDeclarations] = useState<BlowDeclaration[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [winnerTeam, setWinnerTeam] = useState<number | null>(null);
  const [roundResults, setRoundResults] = useState<any[]>([]);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [roundHistory, setRoundHistory] = useState<any[]>([]);
  const [showDetailedScores, setShowDetailedScores] = useState(false);

  useEffect(() => {
    if (socket) {
      socket.on('game-state', (state: any) => {
        setPlayers(state.players);
        setGamePhase(state.gamePhase);
        setTeamScores(state.teamScores || {});
        setCurrentDeclaration(state.currentDeclaration || null);
        setDeclarations(state.declarations || []);
        setCurrentRound(state.currentRound || 1);
        setRoundHistory(state.roundHistory || []);
        
        // Find current player
        const player = state.players.find((p: Player) => p.id === socket.id);
        setCurrentPlayer(player || null);
      });

      socket.on('update-turn', (playerId: string) => {
        setWhoseTurn(playerId);
      });

      socket.on('update-players', (updatedPlayers: Player[]) => {
        setPlayers(updatedPlayers);
        const player = updatedPlayers.find((p: Player) => p.id === socket.id);
        setCurrentPlayer(player || null);
      });

      socket.on('blow-started', (data: any) => {
        setCurrentDeclaration(null);
        setDeclarations([]);
      });

      socket.on('blow-updated', (data: any) => {
        setCurrentDeclaration(data.currentDeclaration);
        setDeclarations(data.declarations);
      });

      socket.on('round-results', (data: any) => {
        setRoundResults(data.results || []);
      });

      socket.on('game-over', (data: any) => {
        setGameOver(true);
        setWinnerTeam(data.winnerTeam);
        setTeamScores(data.finalScores || {});
      });

      socket.on('game-paused', () => {
        showWarning('ゲーム一時停止', 'プレイヤーが不足しているため、ゲームが一時停止されました。');
      });

      socket.on('game-resumed', () => {
        showSuccess('ゲーム再開', 'プレイヤーが復帰したため、ゲームが再開されました。');
      });

      socket.on('player-joined', (data: { playerName: string }) => {
        showInfo('プレイヤー参加', `${data.playerName}がゲームに参加しました`);
      });

      socket.on('player-left', (data: { playerName: string }) => {
        showWarning('プレイヤー退出', `${data.playerName}がゲームから退出しました`);
      });

      socket.on('game-started', () => {
        showSuccess('ゲーム開始', 'ゲームが開始されました！');
      });

      socket.on('phase-changed', (data: { phase: GamePhase }) => {
        const phaseNames = {
          deal: 'カード配布',
          blow: 'ブロー宣言',
          play: 'カードプレイ',
          waiting: '待機中',
        };
        const phaseName = phaseNames[data.phase as keyof typeof phaseNames] || 'ゲーム';
        showInfo('フェーズ変更', `${phaseName}フェーズに移行しました`);
      });

      socket.on('back-to-lobby', () => {
        navigation.navigate('Lobby');
      });

      return () => {
        socket.off('game-state');
        socket.off('update-turn');
        socket.off('update-players');
        socket.off('blow-started');
        socket.off('blow-updated');
        socket.off('round-results');
        socket.off('game-over');
        socket.off('game-paused');
        socket.off('game-resumed');
        socket.off('player-joined');
        socket.off('player-left');
        socket.off('game-started');
        socket.off('phase-changed');
        socket.off('back-to-lobby');
      };
    }
  }, [socket, navigation]);

  const handleStartGame = () => {
    if (socket) {
      socket.emit('start-game', { roomId });
    }
  };

  const handleLeaveRoom = () => {
    Alert.alert(
      'Leave Room',
      'Are you sure you want to leave the room?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            if (socket) {
              socket.emit('leave-room', { roomId });
            }
          },
        },
      ]
    );
  };

  const handleDeclare = (declaration: { trumpType: TrumpType; numberOfPairs: number }) => {
    if (socket) {
      socket.emit('declare-blow', {
        roomId,
        declaration,
      });
    }
  };

  const handlePass = () => {
    if (socket) {
      socket.emit('pass-blow', {
        roomId,
      });
    }
  };

  const handleBackToLobby = () => {
    setGameOver(false);
    setWinnerTeam(null);
    setRoundResults([]);
    navigation.navigate('Lobby');
  };

  const handleNewGame = () => {
    if (socket) {
      socket.emit('start-new-game', { roomId });
      setGameOver(false);
      setWinnerTeam(null);
      setRoundResults([]);
    }
  };

  const isCurrentPlayerTurn = currentPlayer && whoseTurn === currentPlayer.playerId;

  return (
    <View style={styles.container}>
      {/* Notification System */}
      <NotificationSystem
        notifications={notifications}
        onDismiss={removeNotification}
      />
      
      <View style={styles.header}>
        <Text style={styles.roomId}>Room: {roomId}</Text>
        <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveRoom}>
          <Text style={styles.leaveButtonText}>Leave</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.gamePhase}>
        Phase: {gamePhase || 'Waiting'}
      </Text>

      {whoseTurn && (
        <Text style={[styles.turnIndicator, isCurrentPlayerTurn && styles.myTurn]}>
          {isCurrentPlayerTurn ? "Your turn!" : `${whoseTurn}'s turn`}
        </Text>
      )}

      <ScrollView style={styles.content}>
        {/* Team Scores */}
        {Object.keys(teamScores).length > 0 && (
          <View style={styles.scoresSection}>
            <View style={styles.scoreHeader}>
              <Text style={styles.sectionTitle}>Team Scores</Text>
              <TouchableOpacity
                style={styles.detailButton}
                onPress={() => setShowDetailedScores(!showDetailedScores)}
              >
                <Text style={styles.detailButtonText}>
                  {showDetailedScores ? '簡易表示' : '詳細表示'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {showDetailedScores ? (
              <DetailedScoreBoard
                teamScores={teamScores}
                currentRound={currentRound}
                roundHistory={roundHistory}
              />
            ) : (
              Object.entries(teamScores).map(([team, score]) => (
                <Text key={team} style={styles.scoreText}>
                  Team {parseInt(team) + 1}: {score.total} points
                </Text>
              ))
            )}
          </View>
        )}

        {/* Players List */}
        <View style={styles.playersSection}>
          <Text style={styles.sectionTitle}>Players ({players.length}/4)</Text>
          {players.map((player) => (
            <View key={player.playerId} style={styles.playerItem}>
              <Text style={styles.playerName}>
                {player.name} {player.id === socket?.id && '(You)'}
              </Text>
              <Text style={styles.playerInfo}>
                Team {player.team} • Cards: {player.hand.length}
              </Text>
            </View>
          ))}
        </View>

        {/* Blow Controls */}
        {gamePhase === 'blow' && currentPlayer && (
          <BlowControls
            onDeclare={handleDeclare}
            onPass={handlePass}
            currentDeclaration={currentDeclaration}
            isMyTurn={isCurrentPlayerTurn}
            playerName={currentPlayer.name}
            declarations={declarations}
          />
        )}

        {/* Game Field */}
        {gamePhase && gamePhase !== 'waiting' && gamePhase !== 'blow' && (
          <GameField roomId={roomId} />
        )}

        {/* Current Player's Hand */}
        {currentPlayer && currentPlayer.hand.length > 0 && gamePhase === 'play' && (
          <PlayerHand 
            player={currentPlayer} 
            roomId={roomId}
            isMyTurn={isCurrentPlayerTurn}
          />
        )}

        {/* Game Controls */}
        {gamePhase === 'waiting' && players.length === 4 && (
          <TouchableOpacity style={styles.startButton} onPress={handleStartGame}>
            <Text style={styles.startButtonText}>Start Game</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Game Result Modal */}
      <GameResult
        visible={gameOver}
        teamScores={teamScores}
        winnerTeam={winnerTeam}
        roundResults={roundResults}
        onBackToLobby={handleBackToLobby}
        onNewGame={handleNewGame}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B5E20',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#2E7D32',
  },
  roomId: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  leaveButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  leaveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  gamePhase: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    padding: 10,
    backgroundColor: '#388E3C',
  },
  turnIndicator: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    padding: 8,
    backgroundColor: '#4CAF50',
  },
  myTurn: {
    backgroundColor: '#FF9800',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  scoresSection: {
    marginBottom: 20,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  detailButton: {
    backgroundColor: '#388E3C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  detailButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  scoreText: {
    color: '#E8F5E8',
    fontSize: 16,
    marginBottom: 5,
  },
  playersSection: {
    marginBottom: 20,
  },
  playerItem: {
    backgroundColor: '#2E7D32',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  playerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playerInfo: {
    color: '#E8F5E8',
    fontSize: 14,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});