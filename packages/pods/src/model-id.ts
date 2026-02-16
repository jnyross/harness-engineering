export const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/;

export function isValidModelId(modelId: string): boolean {
	return MODEL_ID_PATTERN.test(modelId);
}

export function assertValidModelId(modelId: string): void {
	if (isValidModelId(modelId)) {
		return;
	}

	throw new Error(
		`Invalid model id "${modelId}". Use 1-128 characters from [A-Za-z0-9._/-], starting with a letter or number.`,
	);
}
