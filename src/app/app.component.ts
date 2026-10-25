
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { BlackjackEngine, Card, score } from './game.engine';
import { GameStatsService } from './game-stats.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { GameSoundService } from './game-sound.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  readonly transloco = inject(TranslocoService);
  readonly sound = inject(GameSoundService);
  readonly currentLanguage = signal(
    localStorage.getItem('blackjack-pro-language') ?? 'de'
  );
  betHistory: number[] = [];



  constructor() {
    this.transloco.setActiveLang(this.currentLanguage());
    document.documentElement.lang = this.currentLanguage();
    document.documentElement.dir =
      this.currentLanguage() === 'ar' ? 'rtl' : 'ltr';
  }

  changeLanguage(language: string): void {
    if (!['de', 'en', 'ar'].includes(language)) return;

    this.currentLanguage.set(language);
    this.transloco.setActiveLang(language);

    localStorage.setItem('blackjack-pro-language', language);

    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }
  game = new BlackjackEngine();
  displayBalance = signal(this.game.balance);

  isDealing = signal(false);
  showRoundResult = signal(false);
  visibleDealerCards = signal(0);
  visiblePlayerCards = signal<number[]>([]);
  private readonly dealDelay = 650;
  dealerHoleHidden = signal(true);

  showStats = signal(false);

  readonly gameStats = inject(GameStatsService);

  private roundRecorded = false;

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
        return this.transloco.translate('results.win');
      case 'lose':
        return this.transloco.translate('results.lose');
      case 'push':
        return this.transloco.translate('results.push');
      case 'blackjack':
        return this.transloco.translate('results.blackjack');
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

    // Zweite Dealer-Karte ist zunächst verdeckt
    this.visibleDealerCards.set(Math.min(2, totalCards));

    await this.sleep(650);

    // Verdeckte Karte aufdecken
    this.dealerHoleHidden.set(false);

    await this.sleep(900);

    // Weitere Dealer-Karten einzeln anzeigen
    for (let count = 3; count <= totalCards; count++) {
      this.visibleDealerCards.set(count);
      this.sound.play('card');

      await this.sleep(1000);
    }

    // Erst nach der vollständigen Animation auszahlen
    this.displayBalance.set(this.game.balance);

    this.finishResultDisplay();
  }



  private finishResultDisplay(): void {
    const finished = this.game.phase === 'finished';

    if (!finished || this.roundRecorded) return;

    // Auszahlung erst nach der Dealer-Animation anzeigen
    this.displayBalance.set(this.game.balance);
    this.showRoundResult.set(true);

    this.gameStats.recordRound(this.game);
    this.roundRecorded = true;

    this.playResultSound();
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


      const previousHands = this.game.hands;
      const balanceBefore = this.game.balance;

      this.game.start();

      // Nur den Einsatz abziehen, noch keinen Gewinn anzeigen
      if (this.game.hands !== previousHands) {
        this.displayBalance.set(balanceBefore - this.game.bet);
      }


      // Keine neue Runde gestartet?
      if (this.game.hands === previousHands) {
        this.visiblePlayerCards.set(
          this.game.hands.map(hand => hand.cards.length)
        );

        this.visibleDealerCards.set(this.game.dealer.length);
        this.dealerHoleHidden.set(false);

        return;
      }

      // Neue Runde wurde erfolgreich gestartet
      this.roundRecorded = false;
      this.betHistory = [];
      this.visiblePlayerCards.set([1]);
      this.sound.play('card');
      await this.sleep(this.dealDelay);

      this.visibleDealerCards.set(1);
      this.sound.play('card');
      await this.sleep(this.dealDelay);

      this.visiblePlayerCards.set([2]);
      this.sound.play('card');
      await this.sleep(this.dealDelay);

      this.visibleDealerCards.set(2);
      this.sound.play('card');
      await this.sleep(this.dealDelay);


    } finally {
      this.visiblePlayerCards.set(
        this.game.hands.map(hand => hand.cards.length)
      );

      if (this.game.phase === 'finished' && !this.roundRecorded) {
        await this.revealDealerAnimated();
      }

      this.isDealing.set(false);
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
      // Sound beim Anzeigen der neuen Karte
      this.sound.play('card');
      await this.animateHandTransition(handIndex);

    } finally {
      this.isDealing.set(false);
    }
  }


  async split(): Promise<void> {
    if (this.isDealing() || !this.game.canSplit) return;

    const handIndex = this.game.activeHandIndex;
    const additionalBet = this.game.activeHand!.bet;

    this.isDealing.set(true);

    try {
      this.game.split();

      // Zusätzlichen Einsatz sofort vom sichtbaren Guthaben abziehen
      this.displayBalance.update(balance => balance - additionalBet);

      // Beide Split-Hände zunächst mit je einer Karte anzeigen
      this.visiblePlayerCards.set(
        this.game.hands.map((hand, index) =>
          index === handIndex || index === handIndex + 1
            ? 1
            : hand.cards.length
        )
      );

      // Zusatzkarte für die erste Hand
      await this.sleep(this.dealDelay);

      this.visiblePlayerCards.update(cards => {
        const updated = [...cards];
        updated[handIndex] =
          this.game.hands[handIndex]?.cards.length ?? 0;
        return updated;
      });

      this.sound.play('card');

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
      this.sound.play('card');

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


  private playResultSound(): void {
    const results = this.game.hands.map(hand => hand.result);

    if (results.includes('blackjack')) {
      this.sound.play('blackjack');
    } else if (results.includes('win')) {
      this.sound.play('win');
    } else if (results.includes('lose')) {
      this.sound.play('lose');
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
    if (this.isDealing() || !this.game.canDouble) return;

    const handIndex = this.game.activeHandIndex;
    const additionalBet = this.game.activeHand!.bet;

    this.isDealing.set(true);

    try {
      this.game.doubleDown();

      // Nur den zusätzlichen Einsatz abziehen.
      // Einen möglichen Gewinn noch nicht anzeigen.
      this.displayBalance.update(balance => balance - additionalBet);

      await this.sleep(this.dealDelay);

      this.visiblePlayerCards.update(cards => {
        const updated = [...cards];
        updated[handIndex] =
          this.game.hands[handIndex]?.cards.length ?? 0;
        return updated;
      });

      this.sound.play('card');

      // Auch nach Double Down kann eine weitere Split-Hand folgen.
      await this.animateHandTransition(handIndex);

    } finally {
      this.isDealing.set(false);
    }
  }



  reset(): void {
    if (this.isDealing()) return;

    this.game.resetBankroll();
    this.displayBalance.set(this.game.balance);

    this.visiblePlayerCards.set([]);
    this.visibleDealerCards.set(0);
    this.dealerHoleHidden.set(true);
    this.showRoundResult.set(false);
    this.roundRecorded = false;
  }


  private canEditBet(): boolean {
    return !this.isDealing() &&
      (this.game.phase === 'betting' ||
        this.game.phase === 'finished');
  }

  addChip(value: number): void {
    if (!this.canEditBet()) return;
    if (value <= 0 || this.game.bet + value > this.game.balance) return;

    this.betHistory.push(this.game.bet);
    this.game.bet += value;
    this.sound.play('chip');
  }

  undoChip(): void {
    if (!this.canEditBet() || this.betHistory.length === 0) return;

    this.game.bet = this.betHistory.pop()!;
    this.sound.play('chip');
  }

  clearBet(): void {
    if (!this.canEditBet() || this.game.bet === 0) return;

    this.betHistory.push(this.game.bet);
    this.game.bet = 0;
    this.sound.play('chip');
  }

  maxBet(): void {
    if (!this.canEditBet()) return;
    if (this.game.balance <= 0 || this.game.bet === this.game.balance) return;

    this.betHistory.push(this.game.bet);
    this.game.bet = this.game.balance;
    this.sound.play('chip');
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
