import { readFileSync } from "node:fs";

/**
 * Internal: parse the first line of /proc/swaps to get column positions.
 *
 * The header looks like:
 *   Filename                                Type            Size       Used       Priority
 *
 * Lines are space-separated, but the filename field is the remainder of the
 * first token group and may contain embedded spaces (rare, but possible for
 * loop-mounted files with spaces in the path). We split on whitespace and
 * require exactly five columns.
 */
function parseHeaderLine(header) {
  const parts = header.trim().split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }
  const [filename, type, size, used, priority] = parts;
  if (
    filename.toLowerCase() !== "filename" ||
    type.toLowerCase() !== "type" ||
    size.toLowerCase() !== "size" ||
    used.toLowerCase() !== "used" ||
    priority.toLowerCase() !== "priority"
  ) {
    return null;
  }
  return true;
}

/**
 * Internal: parse a single data line into a SwapEntry or return null.
 *
 * A data line looks like:
 *   /swapfile                               file            2097148    0          -2
 *   /dev/sda2                               partition       8388604    1024       -2
 *
 * Size and used are in kibibytes per the kernel convention; priority is a
 * signed integer.
 */
function parseDataLine(line) {
  const parts = line.trim().split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }
  const [filename, type, sizeStr, usedStr, priorityStr] = parts;
  if (type !== "file" && type !== "partition") {
    return null;
  }
  const size = Number(sizeStr);
  const used = Number(usedStr);
  const priority = Number(priorityStr);
  if (!Number.isInteger(size) || size < 0) {
    return null;
  }
  if (!Number.isInteger(used) || used < 0) {
    return null;
  }
  if (!Number.isInteger(priority)) {
    return null;
  }
  return { filename, type, sizeKiB: size, usedKiB: used, priority };
}

/**
 * Parse the full text of /proc/swaps into a list of swap entries.
 *
 * Accepts the file contents as a string so it can be tested independently of
 * the filesystem. Returns an empty array for an empty file. Throws if the
 * first non-empty line is not a valid header — a malformed /proc/swaps would
 * indicate something is very wrong with the kernel and we surface that rather
 * than silently returning partial data.
 *
 * @param {string} text - raw contents of /proc/swaps
 * @returns {Array<{filename: string, type: string, sizeKiB: number, usedKiB: number, priority: number}>}
 */
export function parseSwaps(text) {
  if (typeof text !== "string") {
    throw new TypeError("parseSwaps expects a string");
  }
  const lines = text.split("\n");
  const entries = [];
  let headerSeen = false;
  for (const raw of lines) {
    if (raw.trim() === "") {
      continue;
    }
    if (!headerSeen) {
      if (!parseHeaderLine(raw)) {
        throw new Error(
          `Invalid /proc/swaps header: ${JSON.stringify(raw)}`,
        );
      }
      headerSeen = true;
      continue;
    }
    const entry = parseDataLine(raw);
    if (entry) {
      entries.push(entry);
    }
  }
  if (!headerSeen && text.trim() !== "") {
    // Non-empty input with no recognisable header is an error.
    throw new Error("Missing /proc/swaps header");
  }
  return entries;
}

/**
 * Read /proc/swaps from the given path and return parsed entries.
 *
 * Defaults to "/proc/swaps". Exposes the path so tests can point at a fixture
 * file without monkey-patching the fs module.
 *
 * @param {string} [path="/proc/swaps"]
 * @returns {Array<{filename: string, type: string, sizeKiB: number, usedKiB: number, priority: number}>}
 */
export function readSwaps(path = "/proc/swaps") {
  const text = readFileSync(path, "utf8");
  return parseSwaps(text);
}

/**
 * Convenience: return true if at least one swap entry is active.
 *
 * @param {string} [path="/proc/swaps"]
 * @returns {boolean}
 */
export function detectSwap(path = "/proc/swaps") {
  return readSwaps(path).length > 0;
}
