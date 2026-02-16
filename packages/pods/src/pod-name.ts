export const POD_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function isValidPodName(name: string): boolean {
	return POD_NAME_PATTERN.test(name);
}

export function assertValidPodName(name: string): void {
	if (isValidPodName(name)) {
		return;
	}

	throw new Error(
		`Invalid pod name "${name}". Use 1-64 characters from [A-Za-z0-9._-], starting with a letter or number.`,
	);
}
