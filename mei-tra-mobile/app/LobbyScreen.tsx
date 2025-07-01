import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useSocketService } from '../services/useSocketService';
import { Room } from '../types/shared';
import { NotificationSystem } from '../components/NotificationSystem';
import { useNotification } from '../hooks/useNotification';

interface LobbyScreenProps {
  navigation: any;
}

export function LobbyScreen({ navigation }: LobbyScreenProps) {
  const [playerName, setPlayerName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('4');
  const [teamAssignment, setTeamAssignment] = useState('random');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [lastJoinAttempt, setLastJoinAttempt] = useState<number>(0);
  const joinTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { socket, isConnected } = useSocketService();
  const { notifications, removeNotification, showError, showWarning, showSuccess } = useNotification();

  useEffect(() => {
    if (socket) {
      socket.on('rooms-list', (roomsList: Room[]) => {
        setRooms(roomsList);
      });

      socket.on('room-player-joined', (data: { roomId: string; playerId: string; room?: Room }) => {
        // Clear timeout and joining state for the current player
        if (data.playerId === socket.id) {
          if (joinTimeoutRef.current) {
            clearTimeout(joinTimeoutRef.current);
            joinTimeoutRef.current = null;
          }
          setJoiningRoomId(null);
        }
        
        if (data.room) {
          setCurrentRoom(data.room);
          // Find current player's ready status
          const currentPlayer = data.room.players.find(p => p.id === socket.id);
          setIsPlayerReady(currentPlayer?.isReady || false);
          
          // Only show success message for the current player
          if (data.playerId === socket.id) {
            showSuccess('ルーム参加', `ルーム "${data.room.name}" に参加しました`);
          }
        }
      });

      socket.on('game-player-joined', (data: { playerId: string; roomId: string; isHost: boolean; roomStatus?: string; room?: Room }) => {
        // Clear timeout and joining state
        if (joinTimeoutRef.current) {
          clearTimeout(joinTimeoutRef.current);
          joinTimeoutRef.current = null;
        }
        setJoiningRoomId(null);
        
        // Only process if this event is for the current player
        if (data.playerId === socket.id || socket.id?.includes(data.playerId)) {
          // Request updated room info since game-player-joined doesn't always include room data
          socket.emit('get-room-info', { roomId: data.roomId });
        }
      });

      socket.on('player-ready-updated', (data: { playerId: string; isReady: boolean; room: Room }) => {
        console.log('Player ready updated:', data);
        console.log('Current socket.id:', socket.id);
        
        // Find current player by socket.id instead of playerId
        const currentPlayer = data.room.players.find(p => p.id === socket.id);
        if (currentPlayer && data.playerId === currentPlayer.playerId) {
          console.log('Updating ready state for current player:', data.isReady);
          setIsPlayerReady(data.isReady);
        }
        setCurrentRoom(data.room);
      });

      socket.on('room-left', () => {
        setCurrentRoom(null);
        setIsPlayerReady(false);
        setJoiningRoomId(null);
        showSuccess('ルーム退出', 'ルームから退出しました');
      });

      socket.on('game-started', (data: { roomId: string }) => {
        navigation.navigate('Game', { roomId: data.roomId });
      });

      // Error handling
      socket.on('error', (data: { message: string }) => {
        if (joinTimeoutRef.current) {
          clearTimeout(joinTimeoutRef.current);
          joinTimeoutRef.current = null;
        }
        setJoiningRoomId(null); // Clear joining state on error
        showError('エラー', data.message);
      });

      socket.on('room-full', () => {
        if (joinTimeoutRef.current) {
          clearTimeout(joinTimeoutRef.current);
          joinTimeoutRef.current = null;
        }
        setJoiningRoomId(null); // Clear joining state on error
        showWarning('ルーム満員', 'このルームは満員です');
      });

      socket.on('room-not-found', () => {
        if (joinTimeoutRef.current) {
          clearTimeout(joinTimeoutRef.current);
          joinTimeoutRef.current = null;
        }
        setJoiningRoomId(null); // Clear joining state on error
        showError('ルーム不明', 'ルームが見つかりません');
      });

      socket.on('join-room-error', (data: { message: string }) => {
        if (joinTimeoutRef.current) {
          clearTimeout(joinTimeoutRef.current);
          joinTimeoutRef.current = null;
        }
        setJoiningRoomId(null); // Clear joining state on error
        showError('参加エラー', data.message);
      });

      socket.on('create-room-error', (data: { message: string }) => {
        showError('作成エラー', data.message);
      });

      // Request rooms list when connected
      if (isConnected) {
        socket.emit('list-rooms');
      }

      return () => {
        // Clear timeout on cleanup
        if (joinTimeoutRef.current) {
          clearTimeout(joinTimeoutRef.current);
          joinTimeoutRef.current = null;
        }
        
        socket.off('rooms-list');
        socket.off('room-player-joined');
        socket.off('game-player-joined');
        socket.off('player-ready-updated');
        socket.off('room-left');
        socket.off('game-started');
        socket.off('error');
        socket.off('room-full');
        socket.off('room-not-found');
        socket.off('join-room-error');
        socket.off('create-room-error');
      };
    }
  }, [socket, isConnected, navigation]);

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      showWarning('入力エラー', 'プレイヤー名を入力してください');
      return;
    }

    if (!roomName.trim()) {
      showWarning('入力エラー', 'ルーム名を入力してください');
      return;
    }

    if (!socket || !socket.connected) {
      showError('接続エラー', 'サーバーに接続されていません');
      return;
    }

    try {
      socket.emit('create-room', {
        name: roomName,
        pointsToWin: 100,
        maxPlayers: parseInt(maxPlayers),
        teamAssignmentMethod: teamAssignment,
      });
    } catch (error) {
      showError('エラー', 'ルーム作成に失敗しました');
    }
  };

  const handleToggleReady = () => {
    if (!currentRoom || !socket || !socket.connected) {
      showError('接続エラー', 'サーバーに接続されていません');
      return;
    }

    // Find current player's playerId
    const currentPlayer = currentRoom.players.find(p => p.id === socket.id);
    if (!currentPlayer) {
      showError('エラー', 'プレイヤー情報が見つかりません');
      return;
    }

    try {
      console.log('Toggling ready state:', { 
        roomId: currentRoom.id, 
        playerId: currentPlayer.playerId,
        currentIsReady: isPlayerReady
      });
      socket.emit('toggle-player-ready', { 
        roomId: currentRoom.id, 
        playerId: currentPlayer.playerId 
      });
    } catch (error) {
      console.error('Error toggling ready state:', error);
      showError('エラー', '準備状態の変更に失敗しました');
    }
  };

  const handleLeaveCurrentRoom = () => {
    if (!currentRoom || !socket || !socket.connected) {
      showError('接続エラー', 'サーバーに接続されていません');
      return;
    }

    try {
      socket.emit('leave-room', { roomId: currentRoom.id, playerId: socket.id });
    } catch (error) {
      showError('エラー', 'ルーム退出に失敗しました');
    }
  };

  const handleStartGame = () => {
    if (!currentRoom || !socket || !socket.connected) {
      showError('接続エラー', 'サーバーに接続されていません');
      return;
    }

    try {
      socket.emit('start-game', { roomId: currentRoom.id });
    } catch (error) {
      showError('エラー', 'ゲーム開始に失敗しました');
    }
  };

  const handleJoinRoom = (room: Room) => {
    const now = Date.now();
    const DEBOUNCE_DELAY = 1000; // 1 second debounce
    
    // Debounce: Prevent rapid successive clicks
    if (now - lastJoinAttempt < DEBOUNCE_DELAY) {
      showWarning('操作が早すぎます', '少し待ってから再試行してください');
      return;
    }
    
    // Prevent joining if already in a room or currently joining
    if (currentRoom || joiningRoomId) {
      showWarning('既に参加中', 'すでにルームに参加しています');
      return;
    }

    if (!playerName.trim()) {
      showWarning('入力エラー', 'プレイヤー名を入力してください');
      return;
    }

    if (!socket || !socket.connected) {
      showError('接続エラー', 'サーバーに接続されていません');
      return;
    }

    // Set joining state to prevent multiple joins
    setLastJoinAttempt(now);
    setJoiningRoomId(room.id);

    try {
      socket.emit('join-room', {
        roomId: room.id,
        user: {
          id: socket.id,
          playerId: `player-${Date.now()}`,
          name: playerName,
        },
      });

      // Set timeout to clear joining state if no response within 10 seconds
      joinTimeoutRef.current = setTimeout(() => {
        setJoiningRoomId(null);
        showError('タイムアウト', 'ルーム参加がタイムアウトしました。再試行してください。');
      }, 10000);
      
    } catch (error) {
      setJoiningRoomId(null); // Clear joining state on error
      showError('エラー', 'ルーム参加に失敗しました');
    }
  };

  const renderRoom = ({ item }: { item: Room }) => {
    const isCurrentRoom = currentRoom?.id === item.id;
    const isJoining = joiningRoomId === item.id;
    const isFull = item.players.length >= item.settings.maxPlayers;
    
    return (
      <View style={styles.roomItem}>
        <View style={styles.roomContent}>
          <Text style={styles.roomName}>{item.name}</Text>
          <Text style={styles.roomInfo}>
            Players: {item.players.length}/{item.settings.maxPlayers}
          </Text>
          <Text style={styles.roomStatus}>Status: {item.status}</Text>
        </View>
        
        {/* Show Ready/Leave buttons if this is the current room */}
        {isCurrentRoom ? (
          <View style={styles.roomItemButtons}>
            <TouchableOpacity
              style={[styles.roomReadyButton, isPlayerReady && styles.roomReadyButtonActive]}
              onPress={handleToggleReady}
            >
              <Text style={styles.roomButtonText}>
                {isPlayerReady ? 'Not Ready' : 'Ready'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.roomLeaveButton}
              onPress={handleLeaveCurrentRoom}
            >
              <Text style={styles.roomButtonText}>Leave</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Show JOIN button for other rooms */
          <TouchableOpacity
            style={[
              styles.joinButton, 
              (isFull || currentRoom || isJoining) && styles.joinButtonDisabled
            ]}
            onPress={() => handleJoinRoom(item)}
            disabled={isFull || currentRoom !== null || isJoining}
          >
            <Text style={styles.joinButtonText}>
              {currentRoom ? 'JOINED' :
               isJoining ? 'JOINING...' :
               isFull ? 'FULL' : 'JOIN'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContainer}>
      <NotificationSystem
        notifications={notifications}
        onDismiss={removeNotification}
      />
      
      <Text style={styles.title}>Welcome to Mei-Tra</Text>
      
      <View style={styles.nameSection}>
        <Text style={styles.label}>Your Name:</Text>
        <TextInput
          style={styles.nameInput}
          value={playerName}
          onChangeText={setPlayerName}
          placeholder="Enter your name"
          maxLength={20}
        />
      </View>

      <View style={styles.createRoomSection}>
        <Text style={styles.sectionTitle}>Create Room</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Room Name:</Text>
          <TextInput
            style={styles.nameInput}
            value={roomName}
            onChangeText={setRoomName}
            placeholder="Enter room name"
            maxLength={30}
          />
        </View>

        <View style={styles.settingsRow}>
          <View style={styles.settingItem}>
            <Text style={styles.label}>Max Players:</Text>
            <View style={styles.pickerContainer}>
              <TouchableOpacity
                style={[styles.pickerButton, maxPlayers === '4' && styles.pickerButtonActive]}
                onPress={() => setMaxPlayers('4')}
              >
                <Text style={[styles.pickerText, maxPlayers === '4' && styles.pickerTextActive]}>4</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.label}>Team Assignment:</Text>
            <View style={styles.pickerContainer}>
              <TouchableOpacity
                style={[styles.pickerButton, teamAssignment === 'random' && styles.pickerButtonActive]}
                onPress={() => setTeamAssignment('random')}
              >
                <Text style={[styles.pickerText, teamAssignment === 'random' && styles.pickerTextActive]}>Random</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerButton, teamAssignment === 'manual' && styles.pickerButtonActive]}
                onPress={() => setTeamAssignment('manual')}
              >
                <Text style={[styles.pickerText, teamAssignment === 'manual' && styles.pickerTextActive]}>Manual</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.createButton]}
          onPress={handleCreateRoom}
          disabled={!isConnected || !playerName.trim() || !roomName.trim()}
        >
          <Text style={styles.buttonText}>Create Room</Text>
        </TouchableOpacity>
      </View>

      {/* Current Room Status */}
      {currentRoom && (
        <View style={styles.currentRoomSection}>
          <Text style={styles.sectionTitle}>Joined Room</Text>
          <View style={styles.currentRoomCard}>
            <View style={styles.currentRoomContent}>
              <Text style={styles.currentRoomName}>{currentRoom.name}</Text>
              <Text style={styles.currentRoomInfo}>
                Players: {currentRoom.players.length}/{currentRoom.settings.maxPlayers}
              </Text>
              <Text style={styles.currentRoomStatus}>Status: {currentRoom.status}</Text>
              
              {/* Players List */}
              <View style={styles.currentRoomPlayers}>
                {currentRoom.players.map((player, index) => (
                  <Text key={player.playerId} style={styles.playerText}>
                    {index + 1}. {player.name} {player.id === socket?.id && '(You)'} Team {player.team}
                    {player.isReady && <Text style={styles.readyIndicator}> • Ready</Text>}
                  </Text>
                ))}
              </View>
            </View>
            
            {/* Ready/Leave buttons for current room */}
            <View style={styles.joinedRoomButtons}>
              <TouchableOpacity
                style={[styles.readyButton, isPlayerReady && styles.readyButtonActive]}
                onPress={handleToggleReady}
              >
                <Text style={styles.joinedRoomButtonText}>
                  {isPlayerReady ? 'Not Ready' : 'Ready'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.leaveButton}
                onPress={handleLeaveCurrentRoom}
              >
                <Text style={styles.joinedRoomButtonText}>Leave Room</Text>
              </TouchableOpacity>
            </View>

            {/* Start Game Button - only show if all players are ready and room is full */}
            {currentRoom.players.length === currentRoom.settings.maxPlayers && 
             currentRoom.players.every(p => p.isReady) && (
              <TouchableOpacity
                style={styles.startGameButton}
                onPress={handleStartGame}
              >
                <Text style={styles.startGameButtonText}>Start Game</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Available Rooms:</Text>
      
      {!isConnected && (
        <Text style={styles.connectionStatus}>Connecting to server...</Text>
      )}

      <View style={styles.roomsContainer}>
        {(() => {
          const availableRooms = rooms.filter((room) => room.id !== currentRoom?.id);
          return availableRooms.length > 0 ? (
            availableRooms.map((room) => (
              <View key={room.id}>
                {renderRoom({ item: room })}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>
              {!isConnected 
                ? 'Loading...' 
                : currentRoom 
                  ? 'No other rooms available' 
                  : 'No rooms available'}
            </Text>
          );
        })()}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B5E20',
  },
  scrollContainer: {
    padding: 20,
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
  },
  nameSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  roomsList: {
    flex: 1,
  },
  roomsContainer: {
    marginBottom: 20,
  },
  roomItem: {
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roomContent: {
    flex: 1,
  },
  roomName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  roomInfo: {
    fontSize: 14,
    color: '#E8F5E8',
    marginBottom: 3,
  },
  roomStatus: {
    fontSize: 14,
    color: '#E8F5E8',
  },
  emptyText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  connectionStatus: {
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 14,
  },
  joinButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginLeft: 10,
  },
  joinButtonDisabled: {
    backgroundColor: '#757575',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  createRoomSection: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  settingItem: {
    flex: 1,
    marginHorizontal: 5,
  },
  pickerContainer: {
    flexDirection: 'row',
    marginTop: 5,
  },
  pickerButton: {
    backgroundColor: '#388E3C',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pickerButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#81C784',
  },
  pickerText: {
    color: '#E8F5E8',
    fontSize: 14,
    fontWeight: '600',
  },
  pickerTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  currentRoomSection: {
    marginBottom: 20,
  },
  currentRoomCard: {
    backgroundColor: '#388E3C',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  currentRoomContent: {
    marginBottom: 15,
  },
  currentRoomName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  currentRoomInfo: {
    fontSize: 14,
    color: '#E8F5E8',
    marginBottom: 3,
  },
  currentRoomStatus: {
    fontSize: 14,
    color: '#E8F5E8',
    marginBottom: 10,
  },
  currentRoomPlayers: {
    marginTop: 10,
  },
  playerText: {
    fontSize: 13,
    color: '#E8F5E8',
    marginBottom: 3,
  },
  readyIndicator: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  currentRoomButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  readyButtonLarge: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  readyButtonLargeActive: {
    backgroundColor: '#2E7D32',
  },
  readyButtonLargeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  leaveButtonLarge: {
    flex: 1,
    backgroundColor: '#F44336',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  leaveButtonLargeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  startGameButton: {
    backgroundColor: '#FF9800',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  startGameButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  roomItemButtons: {
    flexDirection: 'column',
    gap: 6,
    minWidth: 80,
  },
  roomReadyButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  roomReadyButtonActive: {
    backgroundColor: '#2E7D32',
  },
  roomLeaveButton: {
    backgroundColor: '#F44336',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  roomButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  joinedRoomNote: {
    backgroundColor: '#1B5E20',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  joinedRoomNoteText: {
    color: '#E8F5E8',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  joinedRoomButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  readyButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  readyButtonActive: {
    backgroundColor: '#2E7D32',
  },
  leaveButton: {
    flex: 1,
    backgroundColor: '#F44336',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  joinedRoomButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});