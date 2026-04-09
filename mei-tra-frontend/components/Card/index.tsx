import React from 'react';
import { CardFace } from '../CardFace';
import styles from './index.module.scss';

interface CardProps {
  card: string;
}

export const Card: React.FC<CardProps> = ({ card }) => {
  return (
    <div className={styles.card}>
      <CardFace card={card} />
    </div>
  );
};
