export function extractGpuType(name: string | undefined): string {
	if (!name) {
		return "";
	}

	const normalized = name
		.replace(/^NVIDIA\s+/i, "")
		.replace(/^AMD\s+/i, "")
		.trim();

	if (!normalized) {
		return "";
	}

	const [gpuType] = normalized.split(/\s+/);
	return gpuType ?? "";
}
