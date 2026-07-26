---
description: Inspect compiler-generated assembly for Rust functions with `cargo asm` to verify auto-vectorization, codegen quality, and target-specific lowering. Use when the user asks whether a loop is SIMD/vectorized, wants to compare codegen across targets, audits a hot path, or needs to verify specific instructions (popcnt, AVX, NEON, etc.) are emitted.
metadata:
    github-path: cargo-asm
    github-ref: refs/heads/main
    github-repo: https://github.com/Licenser/skills
    github-tree-sha: 8c108d8a9d36625fe29c477cf8b1fcadb8f8ede3
name: cargo-asm
---
# cargo-asm

Use [`cargo-show-asm`](https://github.com/pacak/cargo-show-asm) (`cargo asm`) to dump the assembly that rustc/LLVM actually produced for a Rust function, then read it to answer codegen questions. Don't speculate — read the asm.

## When to Reach for It

- "Is this loop auto-vectorized?"
- "Does the compiler emit `popcnt` / `vpopcntq` / `cnt.16b` / `udot` / `vpshufb` here?"
- "Is this branch eliminated / this bounds check elided / this function inlined?"
- "How does codegen differ between aarch64 and x86-64-v3?"
- Verifying a `#[inline]`, `#[cold]`, or `target_feature` change had the intended effect.

## Preflight

```bash
which cargo-asm && cargo asm --version
```

If absent: `cargo install cargo-show-asm`. Don't install without asking the user.

## Basic Usage

`cargo asm` matches against function paths, not raw symbols. Match is by substring of the demangled path.

```bash
# Library function, by partial path:
cargo asm -p <crate> --lib <substring>

# Specific binary / bench / example / integration test:
cargo asm -p <crate> --bin  <name>     <fn>
cargo asm -p <crate> --bench <name>    <fn>
cargo asm -p <crate> --example <name>  <fn>
cargo asm -p <crate> --test <name>     <fn>

# List candidates when the substring is ambiguous (or returns "Can't find..."):
cargo asm -p <crate> --lib                # prints the index of items
```

Useful flags:
- `--rust` — interleave Rust source lines (extremely helpful for finding the right block).
- `--simplify` — drop cfi/debug noise.
- `-C target-cpu=<cpu>` — re-tune codegen (e.g. `x86-64-v3`, `native`, `apple-m1`).
- `--target <triple>` — cross-target inspection (needs the target installed via `rustup target add`).
- `--full-name` — show full demangled paths in the index.
- `--context N` — also dump callees up to N deep.

## The Hidden Problem: Inlined / Internal Functions

`cargo asm` can only show functions that are actually emitted into the artifact. Two common reasons a function "disappears":

1. **`#[inline]` or `#[inline(always)]`**: fully inlined into callers; no standalone body emitted.
2. **No public caller in the artifact**: a generic or internal `pub` fn that nothing in the crate's lib/bin/bench/test invokes won't appear.

If `cargo asm -p crate --lib MyFn` returns "Can't find any items matching ...", that's almost always the cause.

### The Pinning Recipe

Add a temporary `examples/<name>.rs` that pins a non-inlined entry point calling the function you want to inspect. This is the most reliable way to look at an `#[inline]`-marked hot path with the exact monomorphization you care about.

```rust
//! examples/probe_asm.rs — temporary, delete after inspection.
use mycrate::Thing;

#[inline(never)]
#[unsafe(no_mangle)]
pub fn probe(t: &Thing, input: &[u64], out: &mut Vec<u32>) {
    out.clear();
    out.extend(t.hot_method(input));
}

fn main() {
    // Use the probe so the linker keeps it.
    let t = Thing::new();
    let mut out = Vec::new();
    probe(&t, &[0; 1024], &mut out);
    std::hint::black_box(&out);
}
```

Then:

```bash
cargo asm -p mycrate --example probe_asm probe
```

`#[inline(never)]` keeps `probe` itself emitted; `#[unsafe(no_mangle)]` (Rust 2024) gives it a stable symbol name. The body inside `hot_method` is still inlined *into* `probe`, so you see its real codegen in context.

**Delete the example file when done** unless the user asks to keep it as a verification aid.

## Cross-Target Comparison

For "does this vectorize on x86?" use rustc directly on a standalone reproducer — it's faster than configuring a full cross build of the workspace.

```bash
mkdir -p /tmp/asmcheck && cd /tmp/asmcheck
cat > probe.rs <<'EOF'
#![crate_type = "lib"]
#[unsafe(no_mangle)]
pub fn sum_popcnt(xs: &[u64]) -> u32 {
    xs.iter().map(|x| x.count_ones()).sum()
}
EOF

for cpu in x86-64 x86-64-v2 x86-64-v3 x86-64-v4; do
  rustc -O --emit=asm --target x86_64-unknown-linux-gnu -C target-cpu=$cpu probe.rs
  cp probe.s probe_$cpu.s
done
# Inspect: awk '/^sum_popcnt:/,/\.cfi_endproc/' probe_x86-64-v3.s
```

Requires `rustup target add x86_64-unknown-linux-gnu` (or the relevant triple).

### Vectorization Tell-Tales (general)

Across architectures, look for:
- **Wide register prefixes** in the hot loop: `xmm`/`ymm`/`zmm` on x86, `q<n>`/`v<n>.*` on aarch64.
- **Multiple parallel accumulators** (e.g. `v0,v1,v2,v3` summed after the loop) — sign LLVM unrolled for ILP.
- **Large stride per iteration**: `add x, x, #128` / `subs ..., #16` (16 × u64) on aarch64; `add $64, %rdi` on x86.
- **A scalar tail block** after the SIMD loop (handles `len % vector_width`).

If the hot loop only uses general-purpose registers (`rax`, `x0`–`x30`) with a `ldr`/`mov` + scalar op + `b.ne`, it's **not** vectorized.

## Common Pitfalls

1. **`cargo check` then `cargo asm` is fine**, but `cargo asm` triggers its own release build with `debuginfo=2`. Build times can surprise you on first run; subsequent runs are incremental.
2. **Generics**: `cargo asm` needs a monomorphized instance. Either call the generic with a concrete type from a pinned probe, or pass the full monomorphized path: `cargo asm -p c --lib 'mycrate::foo::<u64>'`.
3. **Profiles**: defaults to `release`. Use `--dev` only if you're debugging codegen of the dev profile specifically — most autovec questions are release-only.
4. **`opt-level`**: if the crate sets `opt-level = 1` or LTO settings in `[profile.release]`, the asm will reflect that. Mention this when reporting findings.
5. **`target-cpu = native` in `.cargo/config.toml`**: results are host-specific. State the effective target-cpu in the report.

## Reporting Findings

When verifying autovec for the user, your report should include:
1. Exact `cargo asm` command used.
2. Target + target-cpu (effective, not just default).
3. The hot-loop block (label-to-label), not the full dump.
4. A one-line identification of the SIMD idiom (e.g. "ARMv8.2 NEON popcount via `cnt`+`udot`").
5. Stride per iteration and number of parallel accumulators.
6. If it's *not* vectorized, the reason (scalar dependency chain, unknown trip count and `opt-level`, `panic` in the loop body inhibiting hoisting, etc.) — read the asm to confirm, don't guess.
