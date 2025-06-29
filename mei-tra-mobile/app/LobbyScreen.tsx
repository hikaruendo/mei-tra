import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
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
  const [rooms, setRooms] = useState<Room[]>([]);
  const { socket, isConnected } = useSocketService();
  const { notifications, removeNotification, showError, showWarning, showSuccess } = useNotification();

  useEffect(() => {
    if (socket) {
      socket.on('rooms-list', (roomsList: Room[]) => {
        setRooms(roomsList);
      });

      socket.on('room-player-joined', ({ roomId }: { roomId: string }) => {
        navigation.navigate('Game', { roomId });
      });

      // Error handling
      socket.on('error', (data: { message: string }) => {
        showError('エラー', data.message);
      });

      socket.on('room-full', () => {
        showWarning('ルーム満員', 'このルームは満員です');
      });

      socket.on('room-not-found', () => {
        showError('ルーム不明', 'ルームが見つかりません');
      });

      socket.on('join-room-error', (data: { message: string }) => {
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
        socket.off('rooms-list');
        socket.off('room-player-joined');
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

    if (!socket || !socket.connected) {
      showError('接続エラー', 'サーバーに接続されていません');
      return;
    }

    try {
      socket.emit('create-room', {
        name: `${playerName}'s Room`,
        pointsToWin: 100,
        teamAssignmentMethod: 'random',
      });
    } catch (error) {
      showError('エラー', 'ルーム作成に失敗しました');
    }
  };

  const handleJoinRoom = (room: Room) => {
    if (!playerName.trim()) {
      showWarning('入力エラー', 'プレイヤー名を入力してください');
      return;
    }

    if (!socket || !socket.connected) {
      showError('接続エラー', 'サーバーに接続されていません');
      return;
    }

    try {
      socket.emit('join-room', {
        roomId: room.id,
        user: {
          id: socket.id,
          playerId: `player-${Date.now()}`,
          name: playerName,
        },
      });
    } catch (error) {
      showError('エラー', 'ルーム参加に失敗しました');
    }
  };

  const renderRoom = ({ item }: { item: Room }) => (
    <TouchableOpacity
      style={styles.roomItem}
      onPress={() => handleJoinRoom(item)}
    >
      <Text style={styles.roomName}>{item.name}</Text>
      <Text style={styles.roomInfo}>
        Players: {item.players.length}/{item.settings.maxPlayers}
      </Text>
      <Text style={styles.roomStatus}>Status: {item.status}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
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

      <TouchableOpacity
        style={[styles.button, styles.createButton]}
        onPress={handleCreateRoom}
        disabled={!isConnected}
      >
        <Text style={styles.buttonText}>Create Room</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Available Rooms:</Text>
      
      {!isConnected && (
        <Text style={styles.connectionStatus}>Connecting to server...</Text>
      )}

      <FlatList
        data={rooms}
        renderItem={renderRoom}
        keyExtractor={(item) => item.id}
        style={styles.roomsList}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {isConnected ? 'No rooms available' : 'Loading...'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B5E20',
    padding: 20,
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
  roomItem: {
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
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
});