import { Injectable } from '@nestjs/common';
import { Field, Player, TrumpType } from '../types/game.types';
import { CardService } from './card.service';

@Injectable()
export class PlayService {
  constructor(private readonly cardService: CardService) {}

  determineFieldWinner(
    field: Field,
    players: Player[],
    trumpSuit: TrumpType | null,
  ): Player | null {
    console.log('Determining field winner with:', {
      field,
      players: players.map((p) => ({ id: p.playerId, name: p.name })),
      trumpSuit,
    });

    // 有効なプレイヤー（ダミーでないプレイヤー）のみをフィルタリング
    const validPlayers = players.filter(
      (p) => !p.playerId.startsWith('dummy-'),
    );
    if (validPlayers.length === 0) {
      console.log('No valid players found');
      return null;
    }

    const baseCard = field.baseCard;
    const baseSuit = this.cardService.getCardSuit(
      baseCard,
      trumpSuit,
      field.baseSuit,
    );

    console.log('Base card and suit:', { baseCard, baseSuit });

    let winner: Player | null = null;
    let highestStrength = -1;

    // ディーラーのインデックスを取得
    let dealerIndex = validPlayers.findIndex(
      (p) => p.playerId === field.dealerId,
    );

    // ディーラーが見つからない場合、最初の有効なプレイヤーをディーラーとする
    if (dealerIndex === -1) {
      console.log('Dealer not found, using first valid player as dealer');
      dealerIndex = 0;
      field.dealerId = validPlayers[0].playerId;
    }

    // プレイヤーの順序を更新（有効なプレイヤーのみ）
    const updatedPlayerOrder = field.cards.map((_, i) => {
      const index = (dealerIndex + i) % validPlayers.length;
      return validPlayers[index];
    });

    console.log(
      'Updated player order:',
      updatedPlayerOrder.map((p) => ({ id: p.playerId, name: p.name })),
    );

    // 各カードの強度を計算して勝者を決定
    field.cards.forEach((card, cardIndex) => {
      const player = updatedPlayerOrder[cardIndex];
      if (!player) {
        console.log(`No player found for card at index ${cardIndex}`);
        return;
      }

      const strength = this.cardService.getCardStrength(
        card,
        baseSuit,
        trumpSuit,
      );

      console.log(
        `Card ${card} played by ${player.name} has strength ${strength}`,
      );

      if (strength > highestStrength) {
        highestStrength = strength;
        winner = player;
      }
    });

    if (winner) {
      console.log(`Winner determined with strength ${highestStrength}`);
    } else {
      console.log('No winner could be determined');
    }

    return winner;
  }
}
