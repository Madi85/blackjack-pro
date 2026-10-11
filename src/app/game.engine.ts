export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export interface Card { suit: Suit; rank: Rank; }
export type Phase = 'betting' | 'insurance' | 'playing' | 'dealer' | 'finished';
export type Result = 'win' | 'lose' | 'push' | 'blackjack' | null;
export interface PlayerHand {
  cards: Card[];
  bet: number;
  finished: boolean;
  doubled: boolean;
  fromSplit: boolean;
  result: Result;
  splitAces: boolean;
}
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export function newShoe(decks = 6): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) for (const suit of SUITS) for (const rank of RANKS) cards.push({ suit, rank });
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
export function score(cards: Card[]): { total: number; soft: boolean } {
  let total = 0, aces = 0;
  for (const card of cards) {
    if (card.rank === 'A') { aces++; total++; }
    else if (['J', 'Q', 'K'].includes(card.rank)) total += 10;
    else total += Number(card.rank);
  }
  const soft = aces > 0 && total + 10 <= 21;
  if (soft) total += 10;
  return { total, soft };
}
function pairValue(card: Card): number {
  if (card.rank === 'A') return 11;
  if (['10', 'J', 'Q', 'K'].includes(card.rank)) return 10;
  return Number(card.rank);
}
export class BlackjackEngine {
  shoe = newShoe();
  hands: PlayerHand[] = [];
  activeHandIndex = 0;
  dealer: Card[] = [];
  phase: Phase = 'betting';
  result: Result = null;
  balance = 1000;
  bet = 20;
  message = 'Wähle deinen Einsatz und starte eine Runde.';
  insuranceBet = 0;
  insuranceResult: 'won' | 'lost' | null = null;

  get player(): Card[] { return this.hands[this.activeHandIndex]?.cards ?? []; }
  get activeHand(): PlayerHand | undefined { return this.hands[this.activeHandIndex]; }
  get insuranceCost(): number { return this.bet / 2; }
  get canInsure(): boolean { return this.phase === 'insurance' && this.balance >= this.insuranceCost; }
  get canDouble(): boolean {
    const hand = this.activeHand;
    return this.phase === 'playing' && !!hand && !hand.finished &&
      !hand.splitAces && hand.cards.length === 2 && this.balance >= hand.bet;
  }
  get canSplit(): boolean {
    const hand = this.activeHand;
    return this.phase === 'playing' && !!hand && !hand.finished &&
      !hand.splitAces && hand.cards.length === 2 && this.hands.length < 4 &&
      pairValue(hand.cards[0]) === pairValue(hand.cards[1]) && this.balance >= hand.bet;
  }
  private draw(): Card {
    if (this.shoe.length === 0) this.shoe = newShoe();
    return this.shoe.pop()!;
  }
  private makeHand(cards: Card[], bet: number, fromSplit = false, splitAces = false): PlayerHand {
    return { cards, bet, finished: false, doubled: false, fromSplit, splitAces, result: null };
  }
  start(): void {
    if (this.phase !== 'betting' && this.phase !== 'finished') return;
    if (this.bet < 1 || this.bet > this.balance) { this.message = 'Ungültiger Einsatz.'; return; }
    if (this.shoe.length < 52) this.shoe = newShoe();
    this.balance -= this.bet;
    this.hands = [this.makeHand([this.draw(), this.draw()], this.bet)];
    this.activeHandIndex = 0;
    this.dealer = [this.draw(), this.draw()];
    this.result = null;
    this.insuranceBet = 0;
    this.insuranceResult = null;
    if (this.dealer[0].rank === 'A') {
      this.phase = 'insurance';
      this.message = `Dealer zeigt ein Ass. Versicherung für ${this.insuranceCost} Chips nehmen?`;
      return;
    }
    this.checkInitialBlackjack();
  }
  takeInsurance(): void {
    if (!this.canInsure) return;
    this.insuranceBet = this.insuranceCost;
    this.balance -= this.insuranceBet;
    this.resolveInsurance();
  }
  declineInsurance(): void {
    if (this.phase !== 'insurance') return;
    this.resolveInsurance();
  }
  private resolveInsurance(): void {
    const dealerBlackjack = this.isDealerBlackjack();
    if (this.insuranceBet > 0) {
      this.insuranceResult = dealerBlackjack ? 'won' : 'lost';
      if (dealerBlackjack) this.balance += 3 * this.insuranceBet;
    }
    this.checkInitialBlackjack();
    if (this.insuranceResult) {
      const info = this.insuranceResult === 'won'
        ? `Versicherung gewonnen (+${2 * this.insuranceBet} netto).`
        : `Versicherung verloren (−${this.insuranceBet}).`;
      this.message = `${info} ${this.message}`;
    }
  }
  private isDealerBlackjack(): boolean {
    return this.dealer.length === 2 && score(this.dealer).total === 21;
  }
  private checkInitialBlackjack(): void {
    if (score(this.player).total === 21 || this.isDealerBlackjack()) {
      this.settle();
    } else {
      this.phase = 'playing';
      this.message = 'Hit, Stand, Double oder Split?';
    }
  }
  hit(): void {
    const hand = this.activeHand;
    if (this.phase !== 'playing' || !hand || hand.finished || hand.splitAces) return;
    hand.cards.push(this.draw());
    if (score(hand.cards).total >= 21) this.finishHand();
  }
  stand(): void {
    if (this.phase !== 'playing' || !this.activeHand || this.activeHand.finished) return;
    this.finishHand();
  }
  doubleDown(): void {
    if (!this.canDouble) return;
    const hand = this.activeHand!;
    this.balance -= hand.bet;
    hand.bet *= 2;
    hand.doubled = true;
    hand.cards.push(this.draw());
    this.finishHand();
  }
  split(): void {
    if (!this.canSplit) return;
    const hand = this.activeHand!;
    const second = hand.cards.pop()!;
    const splitAces = hand.cards[0].rank === 'A';
    this.balance -= hand.bet;
    hand.fromSplit = true;
    hand.splitAces = splitAces;
    const nextHand = this.makeHand([second], hand.bet, true, splitAces);
    hand.cards.push(this.draw());
    nextHand.cards.push(this.draw());
    this.hands.splice(this.activeHandIndex + 1, 0, nextHand);
    if (splitAces) {
      hand.finished = true;
      nextHand.finished = true;
      this.advance();
    } else {
      this.message = `Hand ${this.activeHandIndex + 1} von ${this.hands.length} spielen.`;
    }
  }
  private finishHand(): void {
    this.activeHand!.finished = true;
    this.advance();
  }
  private advance(): void {
    const next = this.hands.findIndex(h => !h.finished);
    if (next >= 0) {
      this.activeHandIndex = next;
      this.message = `Hand ${next + 1} von ${this.hands.length} spielen.`;
      return;
    }
    this.phase = 'dealer';
    if (this.hands.some(h => score(h.cards).total <= 21)) {
      while (score(this.dealer).total < 17) this.dealer.push(this.draw());
    }
    this.settle();
  }
  private settle(): void {
    const d = score(this.dealer).total;
    const dealerBlackjack = this.isDealerBlackjack();
    for (const hand of this.hands) {
      const p = score(hand.cards).total;
      const natural = !hand.fromSplit && hand.cards.length === 2 && p === 21;
      let result: Exclude<Result, null>;
      if (p > 21) result = 'lose';
      else if (natural && dealerBlackjack) result = 'push';
      else if (natural) result = 'blackjack';
      else if (dealerBlackjack) result = 'lose';
      else if (d > 21 || p > d) result = 'win';
      else if (p === d) result = 'push';
      else result = 'lose';
      hand.result = result;
      if (result === 'push') this.balance += hand.bet;
      if (result === 'win') this.balance += 2 * hand.bet;
      if (result === 'blackjack') this.balance += 2.5 * hand.bet;
    }
    this.result = this.hands.length === 1 ? this.hands[0].result : null;
    this.phase = 'finished';
    this.message = this.hands.length === 1
      ? ({ push: 'Unentschieden – Einsatz zurück.', win: 'Gewonnen!', lose: 'Dealer gewinnt.', blackjack: 'Blackjack! Auszahlung 3:2.' } as const)[this.hands[0].result!]
      : this.hands.map((h, i) => `Hand ${i + 1}: ${h.result}`).join(' · ');
  }
  resetBankroll(): void {
    if (this.phase === 'playing' || this.phase === 'dealer' || this.phase === 'insurance') return;
    this.balance = 1000;
    this.bet = 20;
    this.phase = 'betting';
    this.hands = [];
    this.activeHandIndex = 0;
    this.dealer = [];
    this.result = null;
    this.insuranceBet = 0;
    this.insuranceResult = null;
    this.message = 'Neues Guthaben: 1.000 Chips.';
  }
}
