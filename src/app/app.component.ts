
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { BlackjackEngine, Card, score } from './game.engine';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  game = new BlackjackEngine();

  isDealing = signal(false);
  showRoundResult = signal(false);
  visibleDealerCards = signal(0);
  visiblePlayerCards = signal<number[]>([]);
  private readonly dealDelay = 650;
  dealerHoleHidden = signal(true);

  private syncVisibleCards(): void {
    // Alle aktuellen Spielerkarten anzeigen
    this.visiblePlayerCards.set(
      this.game.hands.map(hand => hand.cards.length)
    );

    // Dealer-Karten hier NICHT aktualisieren.
    // Dafür ist revealDealerAnimated() zuständig.
  }


  readonly chipValues = [100, 50, 25, 10, 5, 1];

  getTableBet(): number {
    // Während und nach einer Runde den tatsächlich
    // gespielten Einsatz anzeigen.
    if (
      this.game.phase !== 'betting' &&
      this.game.hands.length > 0
    ) {
      return this.game.hands.reduce(
        (sum, hand) => sum + hand.bet,
        0
      );
    }

    return this.game.bet;
  }


  getResultTitle(result: string | null): string {
    switch (result) {
      case 'win':
        return 'YOU WIN!';
      case 'lose':
        return 'YOU LOSE';
      case 'push':
        return 'PUSH';
      case 'blackjack':
        return 'BLACKJACK!';
      default:
        return '';
    }
  }

  getResultClass(result: string | null): string {
    switch (result) {
      case 'win':
        return 'result-win';
      case 'lose':
        return 'result-lose';
      case 'push':
        return 'result-push';
      case 'blackjack':
        return 'result-blackjack';
      default:
        return '';
    }
  }

  getNetWin(result: string | null, bet: number): number {
    switch (result) {
      case 'win':
        return bet;
      case 'lose':
        return -bet;
      case 'blackjack':
        return bet * 1.5;
      case 'push':
        return 0;
      default:
        return 0;
    }
  }

  getTotalNetWin(): number {
    return this.game.hands.reduce(
      (sum, hand) =>
        sum + this.getNetWin(hand.result, hand.bet),
      0
    );
  }


  getTableChips(): number[] {
    let remaining = Math.floor(this.getTableBet());
    const chips: number[] = [];

    for (const value of this.chipValues) {
      while (remaining >= value) {
        chips.push(value);
        remaining -= value;
      }
    }

    // Maximal 6 Chips auf dem Tisch darstellen
    return chips.slice(0, 6);
  }



  private async revealDealerAnimated(): Promise<void> {
    const totalCards = this.game.dealer.length;

    console.log('Dealer-Animation START', {
      totalCards,
      visibleBefore: this.visibleDealerCards()
    });

    this.visibleDealerCards.set(Math.min(2, totalCards));

    await this.sleep(650);

    this.dealerHoleHidden.set(false);
    console.log('Dealer-Karte 2 aufgedeckt');

    await this.sleep(900);

    for (let count = 3; count <= totalCards; count++) {


      this.visibleDealerCards.set(count);

      await this.sleep(1000);
    }

    this.finishResultDisplay();
  }

  private finishResultDisplay(): void {
    this.showRoundResult.set(
      this.game.phase === 'finished'
    );
  }


  private sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        console.log('Animation wartet:', ms, 'ms');
        resolve();
      }, ms);
    });
  }

  mode = signal<'casino' | 'training'>('casino');

  total = (cards: Card[]) => score(cards).total;

  red = (card: Card) =>
    card.suit === '♥' || card.suit === '♦';


  async start(): Promise<void> {
    if (this.isDealing()) return;

    if (
      this.game.phase !== 'betting' &&
      this.game.phase !== 'finished'
    ) return;

    this.isDealing.set(true);
    this.showRoundResult.set(false);
    this.dealerHoleHidden.set(true);
    this.visibleDealerCards.set(0);
    this.visiblePlayerCards.set([0]);

    try {
      this.game.start();

      this.visiblePlayerCards.set([1]);
      await this.sleep(this.dealDelay);

      this.visibleDealerCards.set(1);
      await this.sleep(this.dealDelay);

      this.visiblePlayerCards.set([2]);
      await this.sleep(this.dealDelay);

      this.visibleDealerCards.set(2);
      await this.sleep(this.dealDelay);

    } finally {
      this.visiblePlayerCards.set(
        this.game.hands.map(hand => hand.cards.length)
      );

      this.isDealing.set(false);
      if (this.game.phase === 'finished') {
        this.finishResultDisplay();
      }
    }
  }

  async hit(): Promise<void> {
    if (this.isDealing() || this.game.phase !== 'playing') {
      return;
    }

    const handIndex = this.game.activeHandIndex;

    this.isDealing.set(true);

    try {
      this.game.hit();

      await this.sleep(this.dealDelay);

      this.visiblePlayerCards.update(cards => {
        const updated = [...cards];

        updated[handIndex] =
          this.game.hands[handIndex]?.cards.length ?? 0;

        return updated;
      });

      await this.animateHandTransition(handIndex);

    } finally {
      this.isDealing.set(false);
    }
  }

  async split(): Promise<void> {
    if (this.isDealing() || !this.game.canSplit) {
      return;
    }

    this.isDealing.set(true);

    try {
      const handIndex = this.game.activeHandIndex;

      this.game.split();

      // Beide Split-Hände zunächst mit einer Karte anzeigen.
      // Bereits vorhandene andere Hände bleiben unverändert.
      this.visiblePlayerCards.set(
        this.game.hands.map((hand, index) =>
          index === handIndex || index === handIndex + 1
            ? 1
            : hand.cards.length
        )
      );

      // Zusatzkarte für die aktuelle Hand
      await this.sleep(this.dealDelay);

      this.visiblePlayerCards.update(cards => {
        const updated = [...cards];

        updated[handIndex] =
          this.game.hands[handIndex]?.cards.length ?? 0;

        return updated;
      });

      await this.animateHandTransition(handIndex);

    } finally {
      this.isDealing.set(false);
    }
  }

  private async animateHandTransition(
    previousHandIndex: number
  ): Promise<void> {

    const nextHandIndex = this.game.activeHandIndex;

    // Keine Animation, wenn die Runde bereits beendet ist
    if (this.isGameFinished()) {
      await this.revealDealerAnimated();
      this.finishResultDisplay();
      return;
    }

    // Nur bei einem tatsächlichen Handwechsel
    if (nextHandIndex !== previousHandIndex) {

      // Die neue Hand zunächst mit einer Karte anzeigen
      this.visiblePlayerCards.update(cards => {
        const updated = [...cards];
        updated[nextHandIndex] = 1;
        return updated;
      });

      await this.sleep(this.dealDelay);

      // Zweite Karte der neuen Hand anzeigen
      this.visiblePlayerCards.update(cards => {
        const updated = [...cards];

        updated[nextHandIndex] =
          this.game.hands[nextHandIndex]?.cards.length ?? 0;

        return updated;
      });
    }
  }





  async takeInsurance(): Promise<void> {
    if (this.isDealing() || this.game.phase !== 'insurance') {
      return;
    }

    this.isDealing.set(true);

    try {
      this.game.takeInsurance();

      if (this.isGameFinished()) {
        await this.revealDealerAnimated();
      }

      this.visiblePlayerCards.set(
        this.game.hands.map(hand => hand.cards.length)
      );

    } finally {
      this.isDealing.set(false);
    }
  }

  async declineInsurance(): Promise<void> {
    if (this.isDealing() || this.game.phase !== 'insurance') {
      return;
    }

    this.isDealing.set(true);

    try {
      this.game.declineInsurance();

      if (this.isGameFinished()) {
        await this.revealDealerAnimated();
      }

      this.visiblePlayerCards.set(
        this.game.hands.map(hand => hand.cards.length)
      );

    } finally {
      this.isDealing.set(false);
    }
  }




  async stand(): Promise<void> {
    if (this.isDealing() || this.game.phase !== 'playing') {
      return;
    }

    const previousHandIndex = this.game.activeHandIndex;

    this.isDealing.set(true);

    try {
      this.game.stand();

      await this.animateHandTransition(previousHandIndex);

    } finally {
      this.isDealing.set(false);
    }
  }


  private isGameFinished(): boolean {
    return this.game.phase === 'finished';
  }



  async doubleDown(): Promise<void> {
    if (this.isDealing() || !this.game.canDouble) {
      return;
    }

    const handIndex = this.game.activeHandIndex;

    this.isDealing.set(true);

    try {
      this.game.doubleDown();

      // Die zusätzliche Spielerkarte einzeln anzeigen
      await this.sleep(this.dealDelay);

      this.visiblePlayerCards.update(cards => {
        const updated = [...cards];
        updated[handIndex] =
          this.game.hands[handIndex]?.cards.length ?? 0;
        return updated;
      });

      // Dealer spielt, falls die Runde abgeschlossen ist
      if (this.isGameFinished()) {
        await this.revealDealerAnimated();
      }

    } finally {
      this.isDealing.set(false);
    }
  }


  reset(): void {
    this.game.resetBankroll();
  }


  addChip(value: number): void {
    if (this.isDealing()) return;

    if (
      this.game.phase !== 'betting' &&
      this.game.phase !== 'finished'
    ) return;

    this.game.bet = Math.min(
      this.game.balance,
      this.game.bet + value
    );
  }

  clearBet(): void {
    if (this.isDealing()) return;

    if (
      this.game.phase !== 'betting' &&
      this.game.phase !== 'finished'
    ) return;

    this.game.bet = 0;
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
