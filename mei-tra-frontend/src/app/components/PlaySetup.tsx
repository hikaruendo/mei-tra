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
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-black/80 backdrop-blur-md rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl">
        <div className="text-center mb-8">
          <h3 className="text-3xl font-bold text-white mb-4">Setup Play Phase</h3>
          <p className="text-xl text-gray-300">
            {!hasSelectedNegri 
              ? "You won the blow phase! Select one card from your hand as Negri."
              : "Now select a card to start the field."}
          </p>
        </div>

        <div className="agari-section mb-8">
          <h4 className="text-2xl font-bold text-white mb-4">Agari Card</h4>
          <div className="flex justify-center">
            <Card card={agariCard} />
          </div>
        </div>

        <div className="hand-section">
          <h4 className="text-2xl font-bold text-white mb-4">
            {!hasSelectedNegri ? 'Select Negri Card' : 'Select Base Card'}
          </h4>
          <div className="flex flex-wrap justify-center gap-4">
            {player.hand.map((card, index) => (
              <div
                key={index}
                className="cursor-pointer hover:transform hover:scale-110 transition-transform duration-200"
                onClick={() => hasSelectedNegri ? onSelectBaseCard(card) : onSelectNegri(card)}
              >
                <Card card={card} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 