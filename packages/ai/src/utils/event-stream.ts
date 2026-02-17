import type { AssistantMessage, AssistantMessageEvent } from "../types.js";

// Generic event stream class for async iteration
export class EventStream<T, R = T> implements AsyncIterable<T> {
	private queue: T[] = [];
	private waiting: ((value: IteratorResult<T>) => void)[] = [];
	private done = false;
	private finalResultSettled = false;
	private finalResultPromise: Promise<R>;
	private resolveFinalResult!: (result: R) => void;
	private rejectFinalResult!: (error: Error) => void;

	constructor(
		private isComplete: (event: T) => boolean,
		private extractResult: (event: T) => R,
	) {
		this.finalResultPromise = new Promise((resolve, reject) => {
			this.resolveFinalResult = resolve;
			this.rejectFinalResult = reject;
		});
	}

	private resolveFinal(result: R): void {
		if (this.finalResultSettled) {
			return;
		}
		this.finalResultSettled = true;
		this.resolveFinalResult(result);
	}

	private rejectFinal(error: Error): void {
		if (this.finalResultSettled) {
			return;
		}
		this.finalResultSettled = true;
		this.rejectFinalResult(error);
	}

	push(event: T): void {
		if (this.done) return;

		if (this.isComplete(event)) {
			this.done = true;
			this.resolveFinal(this.extractResult(event));
		}

		// Deliver to waiting consumer or queue it
		const waiter = this.waiting.shift();
		if (waiter) {
			waiter({ value: event, done: false });
		} else {
			this.queue.push(event);
		}
	}

	end(result?: R): void {
		this.done = true;
		if (result !== undefined) {
			this.resolveFinal(result);
		} else {
			this.rejectFinal(new Error("Event stream ended without completion event"));
		}
		// Notify all waiting consumers that we're done
		while (this.waiting.length > 0) {
			const waiter = this.waiting.shift()!;
			// biome-ignore lint/suspicious/noExplicitAny: migration
			waiter({ value: undefined as any, done: true });
		}
	}

	async *[Symbol.asyncIterator](): AsyncIterator<T> {
		while (true) {
			if (this.queue.length > 0) {
				yield this.queue.shift()!;
			} else if (this.done) {
				return;
			} else {
				const result = await new Promise<IteratorResult<T>>((resolve) => this.waiting.push(resolve));
				if (result.done) return;
				yield result.value;
			}
		}
	}

	result(): Promise<R> {
		return this.finalResultPromise;
	}
}

export class AssistantMessageEventStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
	constructor() {
		super(
			(event) => event.type === "done" || event.type === "error",
			(event) => {
				if (event.type === "done") {
					return event.message;
				} else if (event.type === "error") {
					return event.error;
				}
				throw new Error("Unexpected event type for final result");
			},
		);
	}
}

/** Factory function for AssistantMessageEventStream (for use in extensions) */
export function createAssistantMessageEventStream(): AssistantMessageEventStream {
	return new AssistantMessageEventStream();
}
