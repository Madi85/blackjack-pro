
import { Injectable, signal } from '@angular/core';

export type GameSound =
    | 'card'
    | 'chip'
    | 'stand'
    | 'win'
    | 'lose'
    | 'blackjack';

@Injectable({ providedIn: 'root' })
export class GameSoundService {

    readonly enabled = signal(
        localStorage.getItem('blackjack-pro-sound') !== 'false'
    );

    private readonly sounds: Record<GameSound, string> = {
        card: '/assets/sounds/card.mp3',
        chip: '/assets/sounds/chip.mp3',
        stand: '/assets/sounds/stand.mp3',
        win: '/assets/sounds/win.mp3',
        lose: '/assets/sounds/lose.mp3',
        blackjack: '/assets/sounds/blackjack.mp3'
    };

    toggle(): void {
        const next = !this.enabled();
        this.enabled.set(next);
        localStorage.setItem('blackjack-pro-sound', String(next));
    }

    play(sound: GameSound): void {
        if (!this.enabled()) return;

        const audio = new Audio(this.sounds[sound]);
        audio.volume = 0.35;
        void audio.play().catch(() => {
            // Browser kann Audio vor einer Nutzerinteraktion blockieren.
        });
    }
}
