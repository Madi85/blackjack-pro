
import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { BlackjackEngine, Card, score } from './game.engine';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  game = new BlackjackEngine();

  mode = signal<'casino' | 'training'>('casino');

  total = (cards: Card[]) => score(cards).total;

  red = (card: Card) =>
    card.suit === '♥' || card.suit === '♦';

  start(): void {
    this.game.start();
  }

  hit(): void {
    this.game.hit();
  }

  stand(): void {
    this.game.stand();
  }

  doubleDown(): void {
    this.game.doubleDown();
  }

  reset(): void {
    this.game.resetBankroll();
  }

  changeBet(delta: number): void {
    if (this.game.phase !== 'playing') {
      this.game.bet = Math.max(
        1,
        Math.min(this.game.balance, this.game.bet + delta)
      );
    }
  }

  hint(): string {
    if (this.game.phase !== 'playing') {
      return 'Starte eine Runde für deinen Hinweis.';
    }

    const player = score(this.game.player);
    const upCard = this.game.dealer[0];

    const dealerValue =
      upCard.rank === 'A'
        ? 11
        : ['J', 'Q', 'K'].includes(upCard.rank)
          ? 10
          : Number(upCard.rank);

    if (player.soft) {
      if (player.total <= 17) {
        return 'Hit (vereinfachter Hinweis)';
      }

      if (player.total >= 19) {
        return 'Stand';
      }

      return dealerValue >= 9 ? 'Hit' : 'Stand';
    }

    if (player.total <= 11) {
      return 'Hit (Double möglich)';
    }

    if (player.total >= 17) {
      return 'Stand';
    }

    if (player.total >= 13 && dealerValue <= 6) {
      return 'Stand';
    }

    if (
      player.total === 12 &&
      dealerValue >= 4 &&
      dealerValue <= 6
    ) {
      return 'Stand';
    }

    return 'Hit';
  }
}
