export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export interface Card { suit: Suit; rank: Rank; }
export type Phase = 'betting' | 'playing' | 'dealer' | 'finished';
export type Result = 'win' | 'lose' | 'push' | 'blackjack' | null;
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
  let soft = false;
  if (aces && total + 10 <= 21) { total += 10; soft = true; }
  return { total, soft };
}
export class BlackjackEngine {
  shoe = newShoe();
  player: Card[] = [];
  dealer: Card[] = [];
  phase: Phase = 'betting';
  result: Result = null;
  balance = 1000;
  bet = 20;
  message = 'Wähle deinen Einsatz und starte eine Runde.';
  private draw(): Card {
    if (this.shoe.length === 0) this.shoe = newShoe();
    return this.shoe.pop()!;
  }
  start(): void {
    if (this.phase !== 'betting' && this.phase !== 'finished') return;
    if (this.bet < 1 || this.bet > this.balance) { this.message = 'Ungültiger Einsatz.'; return; }
    if (this.shoe.length < 52) this.shoe = newShoe();
    this.balance -= this.bet;
    this.result = null;
    this.player = [this.draw(), this.draw()];
    this.dealer = [this.draw(), this.draw()];
    this.phase = 'playing';
    this.message = 'Hit oder Stand?';
    if (score(this.player).total === 21 || score(this.dealer).total === 21) this.settle();
  }
  hit(): void {
    if (this.phase !== 'playing') return;
    this.player.push(this.draw());
    const total = score(this.player).total;
    if (total > 21) this.settle();
    else if (total === 21) this.stand();
  }
  stand(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'dealer';
    while (score(this.dealer).total < 17) this.dealer.push(this.draw());
    this.settle();
  }
  private settle(): void {
    const p = score(this.player).total;
    const d = score(this.dealer).total;
    const pbj = this.player.length === 2 && p === 21;
    const dbj = this.dealer.length === 2 && d === 21;
    if ((pbj && dbj) || (p <= 21 && !pbj && !dbj && p === d)) this.result = 'push';
    else if (pbj && !dbj) this.result = 'blackjack';
    else if (p > 21 || dbj || (d <= 21 && d > p)) this.result = 'lose';
    else this.result = 'win';
    if (this.result === 'push') this.balance += this.bet;
    if (this.result === 'win') this.balance += 2 * this.bet;
    if (this.result === 'blackjack') this.balance += 2.5 * this.bet;
    this.phase = 'finished';
    this.message = ({ push: 'Unentschieden – Einsatz zurück.', win: 'Gewonnen!', lose: 'Dealer gewinnt.', blackjack: 'Blackjack! Auszahlung 3:2.' } as const)[this.result];
  }
  resetBankroll(): void {
    if (this.phase === 'playing' || this.phase === 'dealer') return;
    this.balance = 1000;
    this.bet = 20;
    this.phase = 'betting';
    this.player = []; this.dealer = []; this.result = null;
    this.message = 'Neues Guthaben: 1.000 Chips.';
  }
}
