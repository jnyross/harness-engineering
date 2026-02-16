import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const configDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@mariozechner/pi-agent-core": resolve(configDir, "../agent/src/index.ts"),
			"@mariozechner/pi-ai": resolve(configDir, "../ai/src/index.ts"),
			"@mariozechner/pi-tui": resolve(configDir, "../tui/src/index.ts"),
		},
	},
	test: {
		globals: true,
		environment: "node",
		testTimeout: 30000, // 30 seconds for API calls
		server: {
			deps: {
				external: [/@silvia-odwyer\/photon-node/],
			},
		},
	},
});
