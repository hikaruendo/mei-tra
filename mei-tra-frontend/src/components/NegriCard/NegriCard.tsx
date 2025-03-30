import React from 'react';

interface NegriCardProps {
  negriCard: string;
  negriPlayerId: string;
  currentPlayerId: string;
}

export const NegriCard: React.FC<NegriCardProps> = ({
  negriCard,
  negriPlayerId,
  currentPlayerId,
}) => {
  const isNegriPlayer = currentPlayerId === negriPlayerId;

  return (
    <div className="negri-card-display mb-2">
      <div className="text-sm text-white">Negri</div>
      {isNegriPlayer ? (
        <div className={`card negri-card ${negriCard.match(/[♥♦]/) ? 'red-suit' : ''}`}>
          {negriCard === 'JOKER' ? <div className="rank">JOKER</div> : (
            <>
              {negriCard.replace(/[♠♣♥♦]/, '')}
              <span className="suit">{negriCard.match(/[♠♣♥♦]/)?.[0]}</span>
            </>
          )}
        </div>
      ) : (
        <div className="card face-down negri-card">
          🂠
        </div>
      )}
    </div>
  );
};