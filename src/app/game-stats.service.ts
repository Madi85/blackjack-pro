
import { Injectable, signal } from '@angular/core';
import { BlackjackEngine } from './game.engine';

export interface GameStats {
    rounds: number;
    handsWon: number;
    handsLost: number;
    handsPushed: number;
    blackjacks: number;
    netProfit: number;
}

const EMPTY_STATS: GameStats = {
    rounds: 0,
    handsWon: 0,
    handsLost: 0,
    handsPushed: 0,
    blackjacks: 0,
    netProfit: 0
};

@Injectable({
    providedIn: 'root'
})
export class GameStatsService {
    private readonly storageKey = 'blackjack-pro-stats-v1';

    readonly stats = signal<GameStats>(this.load());

    get winRate(): number {
        const stats = this.stats();
        const totalHands =
            stats.handsWon +
            stats.handsLost +
            stats.handsPushed;

        return totalHands === 0
            ? 0
            : (stats.handsWon / totalHands) * 100;
    }

    recordRound(game: BlackjackEngine): void {
        if (game.phase !== 'finished') return;

        const next: GameStats = {
            ...this.stats(),
            rounds: this.stats().rounds + 1
        };

        for (const hand of game.hands) {
            switch (hand.result) {
                case 'win':
                    next.handsWon++;
                    next.netProfit += hand.bet;
                    break;

                case 'blackjack':
                    next.handsWon++;
                    next.blackjacks++;
                    next.netProfit += hand.bet * 1.5;
                    break;

                case 'lose':
                    next.handsLost++;
                    next.netProfit -= hand.bet;
                    break;

                case 'push':
                    next.handsPushed++;
                    break;
            }
        }

        // Insurance ist eine separate Nebenwette.
        if (game.insuranceBet > 0) {
            if (game.insuranceResult === 'won') {
                next.netProfit += game.insuranceBet * 2;
            } else if (game.insuranceResult === 'lost') {
                next.netProfit -= game.insuranceBet;
            }
        }

        this.stats.set(next);
        this.save(next);
    }

    resetStats(): void {
        const empty = { ...EMPTY_STATS };
        this.stats.set(empty);
        this.save(empty);
    }

    private load(): GameStats {
        try {
            if (typeof localStorage === 'undefined') {
                return { ...EMPTY_STATS };
            }

            const saved = localStorage.getItem(this.storageKey);

            if (!saved) return { ...EMPTY_STATS };

            const parsed = JSON.parse(saved) as Partial<GameStats>;

            const stats = { ...EMPTY_STATS };

            for (const key of Object.keys(stats) as (keyof GameStats)[]) {
                const value = parsed[key];

                if (typeof value === 'number' && Number.isFinite(value)) {
                    stats[key] = value;
                }
            }

            return stats;
        } catch {
            return { ...EMPTY_STATS };
        }
    }

    private save(stats: GameStats): void {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(
                    this.storageKey,
                    JSON.stringify(stats)
                );
            }
        } catch {
            // Spiel bleibt auch ohne Browser-Speicher nutzbar.
        }
    }
}
