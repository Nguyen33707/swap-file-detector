# swap-file-detector

Identifies active swap files and swap partitions on a Linux system by parsing `/proc/swaps`.

## Usage

```js
import { parseSwaps, readSwaps, detectSwap } from "swap-file-detector";

// Read directly from the live procfs
const entries = readSwaps("/proc/swaps");
for (const e of entries) {
  console.log(e.filename, e.type, e.sizeKiB, e.usedKiB, e.priority);
}

// Or parse text you already have (useful in tests or when reading from a snapshot)
const parsed = parseSwaps(
  "Filename Type Size Used Priority\n" +
  "/swapfile file 2097148 0 -2\n",
);

// Boolean check
if (detectSwap()) {
  console.log("swap is active");
}
```

## Exports

- `parseSwaps(text: string): SwapEntry[]` — parse raw `/proc/swaps` text.
- `readSwaps(path?: string): SwapEntry[]` — read and parse from a path (defaults to `/proc/swaps`).
- `detectSwap(path?: string): boolean` — true if at least one swap entry exists.

A `SwapEntry` is `{ filename: string, type: "file" | "partition", sizeKiB: number, usedKiB: number, priority: number }`. Sizes are in kibibytes, matching the kernel's unit convention.

## Why

Programs that want to reason about memory pressure on Linux sometimes need to know whether swap is active and how much of it is in use, without pulling in a metrics agent or parsing `/proc/meminfo` (which only gives aggregate `SwapTotal`/`SwapFree`). `/proc/swaps` is the per-device source of truth and is readable by any unprivileged user.

The trade-off: this library only reads `/proc/swaps`. It does not cross-reference `smaps` to attribute swapped pages to individual processes — that would require scanning every PID and is far more expensive. If you need per-process swap attribution, walk `/proc/[pid]/smaps_rollup` yourself.

## Edge cases

- An empty `/proc/swaps` (header only, no data lines) yields an empty array, not an error.
- Malformed data lines — wrong column count, unrecognised type, or non-integer sizes — are silently skipped rather than thrown. A corrupt header, however, throws, because it suggests the kernel format has changed in a way the caller should know about.
- The header is matched case-insensitively against the five canonical column names, so minor formatting differences from different kernel versions are tolerated.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

