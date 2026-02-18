import { describe, expect, it } from "vitest";
import { parseDeploymentNameMap } from "../src/providers/azure-openai-responses.js";

describe("parseDeploymentNameMap", () => {
	it("parses valid model-to-deployment mappings", () => {
		const parsed = parseDeploymentNameMap("gpt-4o=deployment-a,gpt-5=deployment-b");
		expect(parsed.get("gpt-4o")).toBe("deployment-a");
		expect(parsed.get("gpt-5")).toBe("deployment-b");
	});

	it("ignores mappings with blank model ids or deployment names", () => {
		const parsed = parseDeploymentNameMap(" =deployment-a,gpt-4o= ,gpt-6=deployment-c");
		expect(parsed.has("")).toBe(false);
		expect(parsed.has("gpt-4o")).toBe(false);
		expect(parsed.get("gpt-6")).toBe("deployment-c");
	});

	it("rejects whitespace-padded model/deployment mapping segments", () => {
		const parsed = parseDeploymentNameMap(" gpt-4o=deployment-a,gpt-5 =deployment-b,gpt-6= deployment-c ");
		expect(parsed.has("gpt-4o")).toBe(false);
		expect(parsed.has("gpt-5")).toBe(false);
		expect(parsed.has("gpt-6")).toBe(false);
	});
});
