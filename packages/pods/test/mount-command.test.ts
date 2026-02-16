import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractModelsPathFromMountCommand } from "../src/mount-command.js";

describe("extractModelsPathFromMountCommand", () => {
	it("extracts absolute mount targets", () => {
		assert.equal(extractModelsPathFromMountCommand("sudo mount -t nfs server:/share /mnt/models"), "/mnt/models");
		assert.equal(
			extractModelsPathFromMountCommand('sudo mount -t nfs "server:/share" "/mnt/model cache"'),
			"/mnt/model cache",
		);
	});

	it("returns undefined for relative or malformed commands", () => {
		assert.equal(extractModelsPathFromMountCommand("mount -t nfs server:/share relative/path"), undefined);
		assert.equal(extractModelsPathFromMountCommand('mount -t nfs "server:/share /mnt/models'), undefined);
	});
});
