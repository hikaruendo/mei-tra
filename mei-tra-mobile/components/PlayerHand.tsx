import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Player } from '../types/shared';
import { Card } from './Card';
import { useSocketService } from '../services/useSocketService';

interface PlayerHandProps {
  player: Player;
  roomId: string;
  isMyTurn: boolean;
}

export function PlayerHand({ player, roomId, isMyTurn }: PlayerHandProps) {
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const { socket } = useSocketService();

  const handleCardPress = (card: string) => {
    if (!isMyTurn) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (selectedCards.includes(card)) {
      setSelectedCards(selectedCards.filter(c => c !== card));
    } else {
      setSelectedCards([card]); // Single card selection for now
    }
  };

  const handlePlayCard = () => {
    if (selectedCards.length === 0) {
      Alert.alert('Error', 'Please select a card to play');
      return;
    }

    if (socket) {
      socket.emit('play-card', {
        roomId,
        card: selectedCards[0],
      });
      setSelectedCards([]);
    }
  };

  const handleSelectNegri = () => {
    if (selectedCards.length === 0) {
      Alert.alert('Error', 'Please select a card as Negri');
      return;
    }

    if (socket) {
      socket.emit('select-negri', {
        roomId,
        card: selectedCards[0],
      });
      setSelectedCards([]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Your Hand ({player.hand.length} cards)
      </Text>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.cardsContainer}
        contentContainerStyle={styles.cardsContent}
      >
        {player.hand.map((card) => (
          <TouchableOpacity
            key={card}
            onPress={() => handleCardPress(card)}
            disabled={!isMyTurn}
            style={[
              styles.cardWrapper,
              selectedCards.includes(card) && styles.selectedCardWrapper,
              !isMyTurn && styles.disabledCardWrapper,
            ]}
          >
            <Card
              card={card}
              isSelected={selectedCards.includes(card)}
              size="medium"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isMyTurn && selectedCards.length > 0 && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.playButton]}
            onPress={handlePlayCard}
          >
            <Text style={styles.actionButtonText}>Play Card</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.negriButton]}
            onPress={handleSelectNegri}
          >
            <Text style={styles.actionButtonText}>Select as Negri</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isMyTurn && (
        <Text style={styles.waitingText}>
          Waiting for other players...
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  cardsContainer: {
    maxHeight: 120,
  },
  cardsContent: {
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  cardWrapper: {
    marginHorizontal: 3,
    transform: [{ scale: 1 }],
  },
  selectedCardWrapper: {
    transform: [{ scale: 1.1 }, { translateY: -10 }],
  },
  disabledCardWrapper: {
    opacity: 0.6,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  playButton: {
    backgroundColor: '#4CAF50',
  },
  negriButton: {
    backgroundColor: '#FF9800',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  waitingText: {
    color: '#E8F5E8',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 10,
  },
});