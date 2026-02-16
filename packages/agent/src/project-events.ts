/**
 * Project loop event types and NDJSON writer for events.jsonl.
 */

import { appendFileSync } from "node:fs";

export type ProjectLoopPhase =
	| "brainstorm"
	| "plan"
	| "work"
	| "review"
	| "compound"
	| "integrate"
	| "brooks_iteration"
	| "done"
	| "fail";

export interface ProjectLoopEvent {
	type: "project_phase";
	phase: ProjectLoopPhase;
	timestamp: number;
	taskIndex?: number;
	iteration?: number;
	payload?: Record<string, unknown>;
}

/**
 * Append a single event as one NDJSON line to the given path.
 */
export function writeProjectEvent(eventsPath: string, event: ProjectLoopEvent): void {
	const line = `${JSON.stringify({ ...event, timestamp: event.timestamp ?? Date.now() })}\n`;
	appendFileSync(eventsPath, line, "utf-8");
}

/**
 * Create an event object for the given phase (caller can append via writeProjectEvent).
 */
export function createProjectEvent(
	phase: ProjectLoopPhase,
	options?: { taskIndex?: number; iteration?: number; payload?: Record<string, unknown> },
): ProjectLoopEvent {
	return {
		type: "project_phase",
		phase,
		timestamp: Date.now(),
		taskIndex: options?.taskIndex,
		iteration: options?.iteration,
		payload: options?.payload,
	};
}
