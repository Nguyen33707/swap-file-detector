import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSwaps, readSwaps, detectSwap } from "../src/core.js";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const VALID_HEADER =
  "Filename                                Type            Size       Used       Priority";

test("parseSwaps returns empty array for empty input", () => {
  assert.deepEqual(parseSwaps(""), []);
});

test("parseSwaps returns empty array for header-only input", () => {
  assert.deepEqual(parseSwaps(`${VALID_HEADER}\n`), []);
});

test("parseSwaps parses a single file entry", () => {
  const text = `${VALID_HEADER}\n/swapfile                               file            2097148    0          -2\n`;
  const result = parseSwaps(text);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    filename: "/swapfile",
    type: "file",
    sizeKiB: 2097148,
    usedKiB: 0,
    priority: -2,
  });
});

test("parseSwaps parses a partition entry", () => {
  const text = `${VALID_HEADER}\n/dev/sda2                               partition       8388604    1024       -2\n`;
  const result = parseSwaps(text);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    filename: "/dev/sda2",
    type: "partition",
    sizeKiB: 8388604,
    usedKiB: 1024,
    priority: -2,
  });
});

test("parseSwaps parses multiple entries", () => {
  const text = [
    VALID_HEADER,
    "/swapfile                               file            2097148    0          -2",
    "/dev/sda2                               partition       8388604    1024       -2",
    "/swapfile2                              file            1048572    512        3",
    "",
  ].join("\n");
  const result = parseSwaps(text);
  assert.equal(result.length, 3);
  assert.equal(result[2].priority, 3);
  assert.equal(result[2].usedKiB, 512);
});

test("parseSwaps ignores blank lines between entries", () => {
  const text = `${VALID_HEADER}\n\n/swapfile                               file            2097148    0          -2\n\n`;
  const result = parseSwaps(text);
  assert.equal(result.length, 1);
});

test("parseSwaps skips malformed data lines without erroring", () => {
  // A line with only 2 columns is malformed and silently skipped.
  const text = [
    VALID_HEADER,
    "/swapfile                               file",
    "/swapfile2                              file            2097148    0          -2",
  ].join("\n");
  const result = parseSwaps(text);
  assert.equal(result.length, 1);
  assert.equal(result[0].filename, "/swapfile2");
});

test("parseSwaps skips line with invalid type field", () => {
  const text = [
    VALID_HEADER,
    "/weird                                  zswap           2097148    0          -2",
    "/ok                                     file            1048572    0          -2",
  ].join("\n");
  const result = parseSwaps(text);
  assert.equal(result.length, 1);
  assert.equal(result[0].filename, "/ok");
});

test("parseSwaps throws when first non-empty line is not a valid header", () => {
  assert.throws(
    () => parseSwaps("/swapfile                               file            2097148    0          -2\n"),
    /Invalid \/proc\/swaps header/,
  );
});

test("parseSwaps throws on corrupt header", () => {
  assert.throws(
    () => parseSwaps("NotTheRightHeader\n/swapfile file 100 0 -2\n"),
    /Invalid \/proc\/swaps header/,
  );
});

test("parseSwaps throws on non-string input", () => {
  assert.throws(() => parseSwaps(42), TypeError);
  assert.throws(() => parseSwaps(null), TypeError);
});

test("readSwaps reads and parses a real file", () => {
  const dir = mkdtempSync(join(tmpdir(), "swp-"));
  const filePath = join(dir, "fake_swaps");
  writeFileSync(
    filePath,
    `${VALID_HEADER}\n/swapfile                               file            2097148    0          -2\n`,
    "utf8",
  );
  try {
    const result = readSwaps(filePath);
    assert.equal(result.length, 1);
    assert.equal(result[0].filename, "/swapfile");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("detectSwap returns true when swap is present", () => {
  const dir = mkdtempSync(join(tmpdir(), "swp-"));
  const filePath = join(dir, "fake_swaps");
  writeFileSync(
    filePath,
    `${VALID_HEADER}\n/swapfile                               file            2097148    0          -2\n`,
    "utf8",
  );
  try {
    assert.equal(detectSwap(filePath), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("detectSwap returns false when no swap is present", () => {
  const dir = mkdtempSync(join(tmpdir(), "swp-"));
  const filePath = join(dir, "fake_swaps");
  writeFileSync(filePath, `${VALID_HEADER}\n`, "utf8");
  try {
    assert.equal(detectSwap(filePath), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
