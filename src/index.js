/**
 * swap-file-detector
 *
 * Reads /proc/swaps to identify active swap entries on a Linux system.
 * The parser accepts either a path or a pre-read file body, which makes it
 * testable without touching the real procfs.
 */
export { parseSwaps, readSwaps, detectSwap } from "./core.js";
