import { Player } from '../types';
import { Card } from '@/components/card/Card';

interface PlaySetupProps {
  player: Player;
  agariCard: string;
  onSelectNegri: (card: string) => void;
  onSelectBaseCard: (card: string) => void;
  hasSelectedNegri: boolean;
}

export function PlaySetup({ player, agariCard, onSelectNegri, onSelectBaseCard, hasSelectedNegri }: PlaySetupProps) {
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
        <Card card={agariCard} />
      </div>

      <div className="hand-section">
        <h4 className="text-xl font-bold text-white mb-2">
          {!hasSelectedNegri ? 'Select Negri Card' : 'Select Base Card'}
        </h4>
        <div className="flex flex-wrap gap-2">
          {player.hand.map((card, index) => (
            <div
              key={index}
              className="cursor-pointer hover:transform hover:scale-110 transition-transform"
              onClick={() => hasSelectedNegri ? onSelectBaseCard(card) : onSelectNegri(card)}
            >
              <Card card={card} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 