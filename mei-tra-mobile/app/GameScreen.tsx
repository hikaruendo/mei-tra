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
import { Player, GamePhase, TeamScores } from '../types/shared';
import { PlayerHand } from '../components/PlayerHand';
import { GameField } from '../components/GameField';

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
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>(null);
  const [whoseTurn, setWhoseTurn] = useState<string | null>(null);
  const [teamScores, setTeamScores] = useState<TeamScores>({});

  useEffect(() => {
    if (socket) {
      socket.on('game-state', (state: any) => {
        setPlayers(state.players);
        setGamePhase(state.gamePhase);
        setTeamScores(state.teamScores || {});
        
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

      socket.on('back-to-lobby', () => {
        navigation.navigate('Lobby');
      });

      return () => {
        socket.off('game-state');
        socket.off('update-turn');
        socket.off('update-players');
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

  const isCurrentPlayerTurn = currentPlayer && whoseTurn === currentPlayer.playerId;

  return (
    <View style={styles.container}>
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
            <Text style={styles.sectionTitle}>Team Scores</Text>
            {Object.entries(teamScores).map(([team, score]) => (
              <Text key={team} style={styles.scoreText}>
                Team {team}: {score.total} points
              </Text>
            ))}
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

        {/* Game Field */}
        {gamePhase && gamePhase !== 'waiting' && (
          <GameField roomId={roomId} />
        )}

        {/* Current Player's Hand */}
        {currentPlayer && currentPlayer.hand.length > 0 && (
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
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
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