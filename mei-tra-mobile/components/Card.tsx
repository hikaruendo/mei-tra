import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface CardProps {
  card: string;
  isSelected?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function Card({ card, isSelected = false, size = 'medium' }: CardProps) {
  const parseCard = (cardStr: string) => {
    if (cardStr === 'JOKER') {
      return { rank: 'JOKER', suit: '', isJoker: true };
    }

    const rank = cardStr.slice(0, -1);
    const suit = cardStr.slice(-1);
    
    return { rank, suit, isJoker: false };
  };

  const { rank, suit, isJoker } = parseCard(card);
  
  const getSuitColor = (suit: string) => {
    return ['♥', '♦'].includes(suit) ? '#D40000' : '#000000';
  };

  const getSuitSymbol = (suit: string) => {
    const suitMap: { [key: string]: string } = {
      '♥': '♥',
      '♦': '♦', 
      '♣': '♣',
      '♠': '♠',
    };
    return suitMap[suit] || suit;
  };

  const cardSize = {
    small: { width: 40, height: 56 },
    medium: { width: 50, height: 70 },
    large: { width: 60, height: 84 },
  }[size];

  const fontSize = {
    small: { rank: 10, suit: 12 },
    medium: { rank: 12, suit: 16 },
    large: { rank: 14, suit: 18 },
  }[size];

  return (
    <View
      style={[
        styles.card,
        cardSize,
        isSelected && styles.selectedCard,
        isJoker && styles.jokerCard,
      ]}
    >
      {isJoker ? (
        <Text style={[styles.jokerText, { fontSize: fontSize.rank }]}>
          JOKER
        </Text>
      ) : (
        <>
          <Text
            style={[
              styles.rank,
              { fontSize: fontSize.rank, color: getSuitColor(suit) },
            ]}
          >
            {rank}
          </Text>
          <Text
            style={[
              styles.suit,
              { fontSize: fontSize.suit, color: getSuitColor(suit) },
            ]}
          >
            {getSuitSymbol(suit)}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectedCard: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    shadowColor: '#4CAF50',
    shadowOpacity: 0.5,
  },
  jokerCard: {
    backgroundColor: '#E1BEE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rank: {
    fontWeight: 'bold',
    lineHeight: 14,
  },
  suit: {
    lineHeight: 16,
    alignSelf: 'flex-end',
  },
  jokerText: {
    color: '#7B1FA2',
    fontWeight: 'bold',
    textAlign: 'center',
    transform: [{ rotate: '90deg' }],
  },
});