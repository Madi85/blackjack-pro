import { Component, signal } from '@angular/core';
import { BlackjackEngine, Card, score } from './game.engine';
@Component({
  selector: 'app-root', standalone: true,
  template: `
    <main class="shell">
      <header><div class="brand">♠ BLACKJACK <span>PRO</span></div><div class="bank">Guthaben <strong>{{game.balance | number:'1.0-1'}} ●</strong></div></header>
      <nav><button [class.selected]="mode()==='casino'" (click)="mode.set('casino')">♣ Casino</button><button [class.selected]="mode()==='training'" (click)="mode.set('training')">♙ Training</button></nav>
      <section class="table">
        <div class="table-label">BLACKJACK PAYS 3 TO 2 <small>DEALER STANDS ON ALL 17</small></div>
        <div class="hand"><div class="hand-title">DEALER <span *ngIf="game.dealer.length">{{game.phase==='playing' ? '?' : total(game.dealer)}}</span></div>
          <div class="cards"><div class="card" *ngFor="let c of game.dealer; let i=index" [class.red]="red(c)" [class.hidden]="i===1 && game.phase==='playing'">{{i===1 && game.phase==='playing' ? '♠' : c.rank + c.suit}}</div></div></div>
        <div class="center"><div class="chip">{{game.bet}}</div><div class="status">{{game.message}}</div></div>
        <div class="hand"><div class="hand-title">DU <span *ngIf="game.player.length">{{total(game.player)}}</span></div>
          <div class="cards"><div class="card" *ngFor="let c of game.player" [class.red]="red(c)">{{c.rank}}{{c.suit}}</div></div></div>
      </section>
      <section class="controls"><div class="betrow"><label>Einsatz</label><button (click)="changeBet(-10)" [disabled]="game.phase==='playing'">−</button><strong>{{game.bet}} ●</strong><button (click)="changeBet(10)" [disabled]="game.phase==='playing'">+</button></div>
      <div class="actions"><button class="gold" (click)="start()" [disabled]="game.phase==='playing'">{{game.phase==='finished' ? 'NÄCHSTE RUNDE' : 'KARTEN GEBEN'}}</button><button (click)="hit()" [disabled]="game.phase!=='playing'">HIT</button><button (click)="stand()" [disabled]="game.phase!=='playing'">STAND</button></div>
      <div class="foot"><span *ngIf="mode()==='training'">Training: {{hint()}}</span><span *ngIf="mode()==='casino'">6 Decks · S17 · Virtuelle Chips</span><button class="link" (click)="reset()">Guthaben zurücksetzen</button></div></section>
    </main>`,
  styles: [],
  imports: [CommonModule, DecimalPipe]
})
export class AppComponent {
  game = new BlackjackEngine();
  mode = signal<'casino'|'training'>('casino');
  total = (cards: Card[]) => score(cards).total;
  red = (c: Card) => c.suit === '♥' || c.suit === '♦';
  start() { this.game.start(); }
  hit() { this.game.hit(); }
  stand() { this.game.stand(); }
  reset() { this.game.resetBankroll(); }
  changeBet(delta: number) { if (this.game.phase !== 'playing') this.game.bet = Math.max(1, Math.min(this.game.balance, this.game.bet + delta)); }
  hint(): string {
    if (this.game.phase !== 'playing') return 'Starte eine Runde für deinen Hinweis.';
    const p = score(this.game.player);
    const up = this.game.dealer[0];
    const d = up.rank === 'A' ? 11 : ['J','Q','K'].includes(up.rank) ? 10 : Number(up.rank);
    if (p.soft) return p.total <= 17 ? 'Hit (vereinfachter Hinweis)' : p.total >= 19 ? 'Stand' : d >= 9 ? 'Hit' : 'Stand';
    if (p.total <= 11) return 'Hit (Double folgt in Phase 2)';
    if (p.total >= 17) return 'Stand';
    if (p.total >= 13 && d <= 6) return 'Stand';
    if (p.total === 12 && d >= 4 && d <= 6) return 'Stand';
    return 'Hit';
  }
}
import { CommonModule, DecimalPipe } from '@angular/common';
