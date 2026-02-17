import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseArchiveEntryIndex } from "../src/utils/archive-index.js";

describe("parseArchiveEntryIndex", () => {
	it("parses valid archive indices", () => {
		assert.equal(parseArchiveEntryIndex("ppt/slides/slide12.xml", /slide(\d+)\.xml$/), 12);
		assert.equal(parseArchiveEntryIndex("ppt/notesSlides/notesSlide3.xml", /notesSlide(\d+)\.xml$/), 3);
	});

	it("returns zero for malformed or unmatched indices", () => {
		assert.equal(parseArchiveEntryIndex("ppt/slides/slide.xml", /slide(\d+)\.xml$/), 0);
		assert.equal(parseArchiveEntryIndex("ppt/slides/nope.txt", /slide(\d+)\.xml$/), 0);
	});

	it("returns zero for unsafe integer indices", () => {
		assert.equal(parseArchiveEntryIndex("ppt/slides/slide9007199254740993.xml", /slide(\d+)\.xml$/), 0);
	});
});
