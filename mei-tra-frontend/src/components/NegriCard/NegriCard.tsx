import React from 'react';
import { getSocket } from '@/app/socket';

interface NegriCardProps {
  negriCard: string;
  negriPlayerId: string;
}

export const NegriCard: React.FC<NegriCardProps> = ({
  negriCard,
  negriPlayerId,
}) => {
  return (
    <div className="negri-card-display mb-2">
      <div className="text-sm text-white">Negri</div>
      {getSocket().id === negriPlayerId ? (
        <div className="card negri-card">
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