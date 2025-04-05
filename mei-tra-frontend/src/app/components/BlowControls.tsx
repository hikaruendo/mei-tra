import React from 'react';
import styles from '../styles/BlowControls.module.css';

const BlowControls = () => {
  const declarations = [
    { playerId: 1, trumpType: 'hearts', numberOfPairs: 3 },
    { playerId: 2, trumpType: 'diamonds', numberOfPairs: 2 },
    { playerId: 3, trumpType: 'spades', numberOfPairs: 4 },
    { playerId: 4, trumpType: 'clubs', numberOfPairs: 1 },
  ];

  const latestDeclaration = declarations[declarations.length - 1];
  const highestDeclaration = declarations[declarations.length - 2];

  return (
    <div className={styles.declarationContainer}>
      {declarations.map((declaration) => (
        <div 
          key={declaration.playerId}
          className={`${styles.declarationItem} ${
            declaration === latestDeclaration ? styles.animateSlideIn : ''
          } ${declaration === highestDeclaration ? styles.highest : ''}`}
        >
          {declaration.playerId}: {declaration.trumpType.toUpperCase()} {declaration.numberOfPairs} pairs
        </div>
      ))}
    </div>
  );
};

export default BlowControls; 