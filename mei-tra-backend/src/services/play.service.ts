import { Injectable } from '@nestjs/common';
import { Field, Player, TrumpType } from '../types/game.types';
import { CardService } from './card.service';
import { IPlayService } from './interfaces/play-service.interface';

@Injectable()
export class PlayService implements IPlayService {
  constructor(private readonly cardService: CardService) {}

  determineFieldWinner(
    field: Field,
    players: Player[],
    trumpSuit: TrumpType | null,
  ): Player | null {
    if (players.length === 0) {
      return null;
    }

    const baseCard = field.baseCard;
    const baseSuit = this.cardService.getCardSuit(
      baseCard,
      trumpSuit,
      field.baseSuit,
    );

    let winner: Player | null = null;
    let highestStrength = -1;

    // ディーラーのインデックスを取得
    let dealerIndex = players.findIndex((p) => p.playerId === field.dealerId);

    // ディーラーが見つからない場合、最初の有効なプレイヤーをディーラーとする
    if (dealerIndex === -1) {
      dealerIndex = 0;
      field.dealerId = players[0].playerId;
    }

    // field.cards is stored in actual play order, so winner attribution must use
    // the full seat order, including COM players.
    const updatedPlayerOrder = field.cards.map((_, i) => {
      const index = (dealerIndex + i) % players.length;
      return players[index];
    });

    // 各カードの強度を計算して勝者を決定
    field.cards.forEach((card, cardIndex) => {
      const player = updatedPlayerOrder[cardIndex];
      if (!player) {
        return;
      }

      const strength = this.cardService.getCardStrength(
        card,
        baseSuit,
        trumpSuit,
      );

      if (strength > highestStrength) {
        highestStrength = strength;
        winner = player;
      }
    });

    return winner;
  }
}
