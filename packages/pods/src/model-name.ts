export const MODEL_INSTANCE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function isValidModelInstanceName(name: string): boolean {
	return MODEL_INSTANCE_NAME_PATTERN.test(name);
}

export function assertValidModelInstanceName(name: string): void {
	if (isValidModelInstanceName(name)) {
		return;
	}

	throw new Error(
		`Invalid model instance name "${name}". Use 1-64 characters from [A-Za-z0-9._-], starting with a letter or number.`,
	);
}
