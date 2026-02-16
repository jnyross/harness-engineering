import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPodSetupCommand } from "../src/commands/pods.js";

describe("buildPodSetupCommand", () => {
	it("builds command with required arguments", () => {
		const command = buildPodSetupCommand({
			modelsPath: "/mnt/models",
			hfToken: "hf_abc123",
			vllmApiKey: "pi-key",
			vllmVersion: "release",
		});

		assert.equal(
			command,
			"'bash' '/tmp/pod_setup.sh' '--models-path' '/mnt/models' '--hf-token' 'hf_abc123' '--vllm-api-key' 'pi-key' '--vllm' 'release'",
		);
	});

	it("quotes values with spaces and single quotes safely", () => {
		const command = buildPodSetupCommand({
			modelsPath: "/mnt/team models",
			hfToken: "hf_token_with_'quote",
			vllmApiKey: "key with spaces",
			mount: "sudo mount -t nfs server:/share /mnt/team models",
			vllmVersion: "nightly",
		});

		assert.equal(
			command,
			"'bash' '/tmp/pod_setup.sh' '--models-path' '/mnt/team models' '--hf-token' 'hf_token_with_'\"'\"'quote' '--vllm-api-key' 'key with spaces' '--mount' 'sudo mount -t nfs server:/share /mnt/team models' '--vllm' 'nightly'",
		);
	});
});
