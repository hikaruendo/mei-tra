import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { BlowDeclaration, TrumpType } from '../types/shared';

interface BlowControlsProps {
  onDeclare: (declaration: { trumpType: TrumpType; numberOfPairs: number }) => void;
  onPass: () => void;
  currentDeclaration: BlowDeclaration | null;
  isMyTurn: boolean;
  playerName: string;
  declarations: BlowDeclaration[];
}

const TRUMP_TYPES: { type: TrumpType; label: string; color: string }[] = [
  { type: 'zuppe', label: 'ズッペ', color: '#9C27B0' },
  { type: 'club', label: 'クラブ', color: '#000000' },
  { type: 'daiya', label: 'ダイヤ', color: '#F44336' },
  { type: 'herz', label: 'ハート', color: '#F44336' },
  { type: 'tra', label: 'トラ', color: '#FF9800' },
];

const TRUMP_STRENGTHS = {
  zuppe: 1,
  club: 2,
  daiya: 3,
  herz: 4,
  tra: 5,
};

export const BlowControls: React.FC<BlowControlsProps> = ({
  onDeclare,
  onPass,
  currentDeclaration,
  isMyTurn,
  playerName,
  declarations,
}) => {
  const [selectedTrump, setSelectedTrump] = useState<TrumpType | null>(null);
  const [numberOfPairs, setNumberOfPairs] = useState<number>(6);

  const canDeclare = (trump: TrumpType, pairs: number): boolean => {
    if (!currentDeclaration) return pairs >= 6;
    
    const currentStrength = TRUMP_STRENGTHS[currentDeclaration.trumpType];
    const newStrength = TRUMP_STRENGTHS[trump];
    
    if (pairs > currentDeclaration.numberOfPairs) return true;
    if (pairs === currentDeclaration.numberOfPairs && newStrength > currentStrength) return true;
    
    return false;
  };

  const handleDeclare = () => {
    if (!selectedTrump) {
      Alert.alert('エラー', 'トランプを選択してください');
      return;
    }

    if (!canDeclare(selectedTrump, numberOfPairs)) {
      Alert.alert('エラー', '現在の宣言より高い宣言を行ってください');
      return;
    }

    onDeclare({ trumpType: selectedTrump, numberOfPairs });
  };

  const renderTrumpSelector = () => (
    <View style={styles.trumpContainer}>
      <Text style={styles.sectionTitle}>トランプ選択</Text>
      <View style={styles.trumpButtons}>
        {TRUMP_TYPES.map(({ type, label, color }) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.trumpButton,
              { borderColor: color },
              selectedTrump === type && styles.selectedTrump,
            ]}
            onPress={() => setSelectedTrump(type)}
            disabled={!isMyTurn}
          >
            <Text style={[styles.trumpText, { color }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderPairSelector = () => (
    <View style={styles.pairContainer}>
      <Text style={styles.sectionTitle}>ペア数選択</Text>
      <View style={styles.pairButtons}>
        {Array.from({ length: 8 }, (_, i) => i + 6).map((pairs) => (
          <TouchableOpacity
            key={pairs}
            style={[
              styles.pairButton,
              numberOfPairs === pairs && styles.selectedPair,
              !canDeclare(selectedTrump || 'zuppe', pairs) && styles.disabledPair,
            ]}
            onPress={() => setNumberOfPairs(pairs)}
            disabled={!isMyTurn || !canDeclare(selectedTrump || 'zuppe', pairs)}
          >
            <Text style={[
              styles.pairText,
              numberOfPairs === pairs && styles.selectedPairText,
            ]}>
              {pairs}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderCurrentDeclaration = () => {
    if (!currentDeclaration) return null;

    const trump = TRUMP_TYPES.find(t => t.type === currentDeclaration.trumpType);
    return (
      <View style={styles.currentDeclaration}>
        <Text style={styles.currentDeclarationTitle}>現在の宣言</Text>
        <Text style={styles.currentDeclarationText}>
          {trump?.label} {currentDeclaration.numberOfPairs}ペア
        </Text>
      </View>
    );
  };

  const renderDeclarationHistory = () => (
    <View style={styles.historyContainer}>
      <Text style={styles.sectionTitle}>宣言履歴</Text>
      {declarations.map((declaration, index) => {
        const trump = TRUMP_TYPES.find(t => t.type === declaration.trumpType);
        return (
          <View key={index} style={styles.historyItem}>
            <Text style={styles.historyText}>
              {declaration.playerId}: {trump?.label} {declaration.numberOfPairs}ペア
            </Text>
          </View>
        );
      })}
    </View>
  );

  if (!isMyTurn) {
    return (
      <View style={styles.container}>
        <Text style={styles.waitingText}>他のプレイヤーのターンです</Text>
        {renderCurrentDeclaration()}
        {renderDeclarationHistory()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{playerName}のターン</Text>
      
      {renderCurrentDeclaration()}
      {renderTrumpSelector()}
      {renderPairSelector()}
      
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.button, styles.declareButton]}
          onPress={handleDeclare}
          disabled={!selectedTrump}
        >
          <Text style={styles.buttonText}>宣言</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.passButton]}
          onPress={onPass}
        >
          <Text style={styles.buttonText}>パス</Text>
        </TouchableOpacity>
      </View>

      {renderDeclarationHistory()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#1B5E20',
  },
  waitingText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  trumpContainer: {
    marginBottom: 20,
  },
  trumpButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  trumpButton: {
    width: '18%',
    aspectRatio: 1,
    borderWidth: 2,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  selectedTrump: {
    backgroundColor: '#E8F5E8',
    borderWidth: 3,
  },
  trumpText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  pairContainer: {
    marginBottom: 20,
  },
  pairButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  pairButton: {
    width: '22%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  selectedPair: {
    backgroundColor: '#1B5E20',
    borderColor: '#1B5E20',
  },
  disabledPair: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ccc',
  },
  pairText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedPairText: {
    color: '#fff',
  },
  currentDeclaration: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  currentDeclarationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 5,
  },
  currentDeclarationText: {
    fontSize: 18,
    color: '#1976D2',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    minWidth: 100,
  },
  declareButton: {
    backgroundColor: '#1B5E20',
  },
  passButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  historyContainer: {
    marginTop: 10,
  },
  historyItem: {
    backgroundColor: '#fff',
    padding: 10,
    marginBottom: 5,
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#1B5E20',
  },
  historyText: {
    fontSize: 14,
    color: '#333',
  },
});