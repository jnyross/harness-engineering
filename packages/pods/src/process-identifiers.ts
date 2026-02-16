const MAX_PID = 2_147_483_647;

export function isValidPid(pid: number): boolean {
	return Number.isInteger(pid) && pid > 0 && pid <= MAX_PID;
}

export function isValidPort(port: number): boolean {
	return Number.isInteger(port) && port > 0 && port <= 65535;
}

export function assertValidPid(pid: number, context: string): void {
	if (isValidPid(pid)) {
		return;
	}
	throw new Error(`Invalid ${context} pid "${pid}". Expected integer between 1 and ${MAX_PID}.`);
}

export function assertValidPort(port: number, context: string): void {
	if (isValidPort(port)) {
		return;
	}
	throw new Error(`Invalid ${context} port "${port}". Expected integer between 1 and 65535.`);
}
