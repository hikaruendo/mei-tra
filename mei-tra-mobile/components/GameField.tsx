import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Field, CompletedField } from '../types/shared';
import { Card } from './Card';
import { useSocketService } from '../services/useSocketService';

interface GameFieldProps {
  roomId: string;
}

export function GameField({ roomId }: GameFieldProps) {
  const [currentField, setCurrentField] = useState<Field | null>(null);
  const [completedFields, setCompletedFields] = useState<CompletedField[]>([]);
  const [negriCard, setNegriCard] = useState<string | null>(null);
  const { socket } = useSocketService();

  useEffect(() => {
    if (socket) {
      socket.on('game-state', (state: any) => {
        setCurrentField(state.currentField);
        setCompletedFields(state.fields || []);
        setNegriCard(state.negriCard);
      });

      socket.on('card-played', (data: any) => {
        setCurrentField(data.field);
      });

      socket.on('field-complete', (data: any) => {
        setCompletedFields(prev => [...prev, data.field]);
        // Clear current field after a delay
        setTimeout(() => {
          setCurrentField({
            cards: [],
            baseCard: '',
            dealerId: data.nextPlayerId,
            isComplete: false,
          });
        }, 2000);
      });

      socket.on('play-setup-complete', (data: any) => {
        setNegriCard(data.negriCard);
      });

      return () => {
        socket.off('game-state');
        socket.off('card-played');
        socket.off('field-complete');
        socket.off('play-setup-complete');
      };
    }
  }, [socket]);

  const handleSelectBaseSuit = (suit: string) => {
    if (socket && currentField?.baseCard === 'JOKER') {
      socket.emit('select-base-suit', {
        roomId,
        suit,
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Game Field</Text>
      
      {/* Negri Card Display */}
      {negriCard && (
        <View style={styles.negriSection}>
          <Text style={styles.negriLabel}>Negri Card:</Text>
          <Card card={negriCard} size="small" />
        </View>
      )}

      {/* Current Field */}
      {currentField && (
        <View style={styles.currentField}>
          <Text style={styles.fieldTitle}>Current Field</Text>
          <View style={styles.cardsRow}>
            {currentField.cards.map((card, index) => (
              <View key={index} style={styles.fieldCard}>
                <Card card={card} size="medium" />
              </View>
            ))}
          </View>
          
          {/* Base Suit Selection for Joker */}
          {currentField.baseCard === 'JOKER' && !currentField.baseSuit && (
            <View style={styles.suitSelection}>
              <Text style={styles.suitSelectionTitle}>Select base suit:</Text>
              <View style={styles.suitButtons}>
                {['♥', '♦', '♣', '♠'].map((suit) => (
                  <TouchableOpacity
                    key={suit}
                    style={styles.suitButton}
                    onPress={() => handleSelectBaseSuit(suit)}
                  >
                    <Text style={[
                      styles.suitButtonText,
                      { color: ['♥', '♦'].includes(suit) ? '#D40000' : '#000000' }
                    ]}>
                      {suit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Completed Fields Count */}
      {completedFields.length > 0 && (
        <View style={styles.completedSection}>
          <Text style={styles.completedTitle}>
            Completed Fields: {completedFields.length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  negriSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    justifyContent: 'center',
  },
  negriLabel: {
    color: '#4CAF50',
    fontWeight: 'bold',
    marginRight: 10,
  },
  currentField: {
    backgroundColor: '#388E3C',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  fieldTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  fieldCard: {
    margin: 5,
  },
  suitSelection: {
    marginTop: 15,
    alignItems: 'center',
  },
  suitSelectionTitle: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 10,
  },
  suitButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  suitButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suitButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  completedSection: {
    alignItems: 'center',
  },
  completedTitle: {
    color: '#E8F5E8',
    fontSize: 14,
  },
});