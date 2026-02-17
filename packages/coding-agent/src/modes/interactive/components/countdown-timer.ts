/**
 * Reusable countdown timer for dialog components.
 */

import type { TUI } from "@mariozechner/pi-tui";

export class CountdownTimer {
	private intervalId: ReturnType<typeof setInterval> | undefined;
	private remainingSeconds: number;
	private expired = false;

	constructor(
		timeoutMs: number,
		private tui: TUI | undefined,
		private onTick: (seconds: number) => void,
		private onExpire: () => void,
	) {
		this.remainingSeconds = Math.ceil(timeoutMs / 1000);
		if (!this.emitTick(this.remainingSeconds)) {
			return;
		}

		this.intervalId = setInterval(() => {
			this.remainingSeconds--;
			if (!this.emitTick(this.remainingSeconds)) {
				return;
			}
			this.tui?.requestRender();

			if (this.remainingSeconds <= 0 && !this.expired) {
				this.expired = true;
				this.dispose();
				try {
					this.onExpire();
				} catch (error) {
					console.error("CountdownTimer onExpire callback failed:", error);
				}
			}
		}, 1000);
	}

	private emitTick(seconds: number): boolean {
		try {
			this.onTick(seconds);
			return true;
		} catch (error) {
			console.error("CountdownTimer onTick callback failed:", error);
			this.dispose();
			return false;
		}
	}

	dispose(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = undefined;
		}
	}
}
