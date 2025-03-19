import React from 'react';

interface CardProps {
  card: string;
  small?: boolean;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  card,
  small = false,
  className = '',
}) => {
  const value = card.replace(/[♠♣♥♦]/, '');
  const suit = card.match(/[♠♣♥♦]/)?.[0] || '';
  const isRed = suit === '♥' || suit === '♦';

  return (
    <div className={`card ${isRed ? 'red-suit' : 'black-suit'} ${small ? 'small' : ''} ${className}`}>
      {card === 'JOKER' ? '🃏' : (
        <>
          {value}
          <span className="suit">{suit}</span>
        </>
      )}
    </div>
  );
}; 