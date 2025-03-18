import { Player } from '../types';

interface PlaySetupProps {
  player: Player;
  agariCard: string;
  onSelectNegri: (card: string) => void;
  onSelectBaseCard: (card: string) => void;
  hasSelectedNegri: boolean;
}

export function PlaySetup({ player, agariCard, onSelectNegri, onSelectBaseCard, hasSelectedNegri }: PlaySetupProps) {
  const isRed = (card: string) => {
    const suit = card.match(/[♠♣♥♦]/)?.[0];
    return suit === '♥' || suit === '♦';
  };

  return (
    <div className="play-setup mt-4 p-4 bg-gray-800 rounded-lg shadow-lg">
      <div className="text-center mb-4">
        <h3 className="text-2xl font-bold text-white">Setup Play Phase</h3>
        <p className="text-gray-300 mt-2">
          {!hasSelectedNegri 
            ? "You won the blow phase! Select one card from your hand as Negri."
            : "Now select a card to start the field."}
        </p>
      </div>

      <div className="agari-section mb-6">
        <h4 className="text-xl font-bold text-white mb-2">Agari Card</h4>
        <div className={`card ${isRed(agariCard) ? 'red-suit' : 'black-suit'}`}>
          {agariCard === 'JOKER' ? '🃏' : (
            <>
              {agariCard.replace(/[♠♣♥♦]/, '')}
              <span className="suit">{agariCard.match(/[♠♣♥♦]/)?.[0]}</span>
            </>
          )}
        </div>
      </div>

      <div className="hand-section">
        <h4 className="text-xl font-bold text-white mb-2">
          {!hasSelectedNegri ? 'Select Negri Card' : 'Select Base Card'}
        </h4>
        <div className="flex flex-wrap gap-2">
          {player.hand.map((card, index) => {
            const value = card.replace(/[♠♣♥♦]/, '');
            const suit = card.match(/[♠♣♥♦]/)?.[0] || '';
            
            return (
              <div
                key={index}
                className={`card ${isRed(card) ? 'red-suit' : 'black-suit'} cursor-pointer hover:transform hover:scale-110 transition-transform`}
                onClick={() => hasSelectedNegri ? onSelectBaseCard(card) : onSelectNegri(card)}
              >
                {card === 'JOKER' ? '🃏' : (
                  <>
                    {value}
                    <span className="suit">{suit}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 