> _Model warning:_ expected `gpt-6-sol`; observed `unknown-gpt` via implementer self-report. Attribution only.

# Review finding 05 — Justify the new rust-overlay input and Rust 1.96.1 pin, or drop them — ADDRESSED — *traits improved: security, maintainability; confidence MEDIUM*

**Severity:** warning
**Scope:** in-scope
**Scope rationale:** The branch adds the rust-overlay flake input, composes it into `overlays.default`, and pins Rust 1.96.1 only to build the upgraded pgrx extensions (pg_search 0.25.9, pg_jsonschema 0.3.4). Whether that toolchain change was needed at all therefore depends directly on the extension-upgrade goal.
**File:** nixops/overlays/postgres.nix
**Line:** 3
**Work unit:** PR_pgupgr-update/RUN-6886066177998911949/WU-004
**Agent:** nhost-reviewer
**Model:** claude-opus-5-5

## Finding

To build the upgraded pgrx extensions, the branch replaces nixpkgs' `rustPlatform` with a toolchain from a new third-party flake input:

```nix
# nixops/overlays/postgres.nix
rust_1_96 = final.rust-bin.stable."1.96.1".minimal;
rustPlatform_1_96 = final.makeRustPlatform { cargo = rust_1_96; rustc = rust_1_96; };
```

`mkCargoPgrx` builds `cargo-pgrx_0_19_0` and `cargo-pgrx_0_19_2` with this platform. `services/postgres/extensions/default.nix` routes every pgrx extension through it as well, via `pkgs.buildPgrxExtension.override { rustPlatform = pkgs.nhost.rustPlatform_1_96; }`. Supporting this required several other changes:

- `flake.nix:19-20` adds the `rust-overlay` input.
- `flake.nix:36-62` defines `overlayComponents` and composes rust-overlay into the published `overlays.default`.
- `flake.lock` locks the new input.
- `nixops/lib/nix/nix.nix` rewrites `checkPinnedToolchains` to check each component's allowlist separately.

Nothing in the code, comments, CHANGELOG or README explains why 1.96.1 is needed. The evidence suggests it is not:

- **nixpkgs' Rust is already new enough.** The locked nixpkgs (unchanged by this branch) has `pkgs.rustc.version` = `1.98.1`. Both cargo-pgrx 0.19.0 and 0.19.2 declare `rust-version = "1.96"` in their crate `Cargo.toml`, so 1.98.1 meets that minimum.
- **1.96.1 is not pg_search's own pin.** pg_search v0.25.9's `rust-toolchain.toml` sets `channel = "1.97.1"`, and pg_jsonschema at `d08e4dea…` has no toolchain file. So 1.96.1 is older than what pg_search's upstream builds with and newer than anything pg_jsonschema requires.
- **pg_jsonschema builds with nixpkgs' Rust.** I built cargo-pgrx 0.19.2 and pg_jsonschema for aarch64-linux using plain nixpkgs `pkgs.rustPlatform` (1.98.1) and `pkgs.buildPgrxExtension` (no override), keeping the branch's hashes and `checkFlags`. The build succeeded: cargo-pgrx's tests passed (46 + 3 + 4) and the pg_jsonschema `postInstall` upgrade-SQL check passed.
- **The base branch already did this.** It built cargo-pgrx 0.18.1 and pg_search 0.24.0 with `final.rustPlatform`.

**Impact of keeping an unexplained pin:**

- **More dependencies and a wider public API.** The repo gains a flake input that has to be kept updated. The public `overlays.default` now also exports rust-overlay's top-level attributes (`rust-bin`, `rustChannelOf`, `rustChannelOfTargets`, `rustChannels`, `latest`, and a `lib` override adding `rustLib`). Downstream flakes such as `nixops/lib/go/example/flake.nix` inherit these.
- **Conflicts for consumers with their own rust-overlay.** If a consumer applies its own rust-overlay before this overlay, the manifests from Nhost's locked rust-overlay silently replace theirs. If it applies its own afterwards, `pkgs.nhost.rustPlatform_1_96` depends on their manifests still containing 1.96.1.
- **Extra check maintenance.** Any `nix flake update` that adds a top-level attribute to rust-overlay will fail `checks.*.nixops` until the allowlist in `flake.nix` is edited.
- **No exit condition.** With no recorded reason, a maintainer cannot tell when the pin can be bumped or removed.

## Suggested plan

- **Try nixpkgs' Rust first.** Rebuild pg_search 0.25.9 on x86_64-linux and aarch64-linux with nixpkgs' `rustPlatform`: build cargo-pgrx 0.19.0 with `final.rustPlatform.buildRustPackage` and call plain `pkgs.buildPgrxExtension`.
- **If that works, go back to the base branch's approach:**
  - `mkCargoPgrx` uses `final.rustPlatform.buildRustPackage`.
  - Remove `rust_1_96`, `rustPlatform_1_96` and the `inherit rustPlatform_1_96;` export from `nixops/overlays/postgres.nix`.
  - Remove the `pgrxBuilder` override in `services/postgres/extensions/default.nix`.
  - Remove the `rust-overlay` input from `flake.nix`, then relock `flake.lock`.
  - Make `overlays.default` import `./nixops/overlays/default.nix` directly again.
  - Revert the per-component machinery in `checkPinnedToolchains` (and its `overlay`/`overlayComponents` parameters in `nixops/project.nix`), unless it is kept on purpose for future composed overlays.
  - Revert the overlay header comment in `nixops/overlays/default.nix`.
- **If a Rust pin really is needed:**
  - Next to `rust_1_96` in `nixops/overlays/postgres.nix`, record the concrete failure it avoids: the compiler error or crate, which extension is affected, and the condition for removing the pin.
  - Explain why 1.96.1 was chosen rather than pg_search's own `rust-toolchain.toml` channel (1.97.1).
  - Consider building the toolchain inside the `nhost` namespace instead of composing rust-overlay into the public `overlays.default`. That keeps the published overlay down to its single `nhost` attribute and avoids clashing with consumers' own rust-overlay.
- **Validation:**
  - `nix build .#packages.aarch64-linux.postgres-pg18` and the `x86_64-linux` equivalent.
  - `nix build .#checks.<system>.nixops`.
  - `make -C services/postgres check`, which runs the plugins and previous-image extension-upgrade tests. This confirms the extension versions reported in `plugins.md` are unchanged.

> _Implementer note (unknown-gpt, confidence MEDIUM):_ `nixops/overlays/postgres.nix` and `services/postgres/extensions/default.nix` build pgrx with nixpkgs Rust 1.98.1; `flake.nix`/`flake.lock` no longer import rust-overlay, and `nixops/lib/nix/nix.nix` guards the sole public `nhost` overlay attribute. ARM PostgreSQL and extension-upgrade integration pass. The operator waived x86_64 package validation; its pg_search compile was interrupted, not verified.
>
> _Reviewer note (claude-opus-5-5, confidence HIGH, verdict ACCEPT_WITH_CONCERNS):_ The Rust 1.96.1 pin is gone. `mkCargoPgrx` in `nixops/overlays/postgres.nix` now uses `final.rustPlatform`, and `services/postgres/extensions/default.nix` calls plain `pkgs.buildPgrxExtension`. The `rust-overlay` input is removed from `flake.nix`, and `flake.lock` is byte-identical to `origin/main`'s again. `overlays.default` is back to the plain Nhost overlay, which exports only `nhost`. `checkPinnedToolchains` still rejects extra top-level attrs and a missing `nhost`; I confirmed that both cases fail the check. On aarch64 the package closure contains only nixpkgs rustc/cargo 1.98.1, and its derivations are the same ones the passing package, image and Docker upgrade checks built. Remaining concern: x86_64-linux `postgres-pg18` is still unverified. The operator waived that build and both attempts were interrupted, so the native x86 build in the PR's `postgres_checks.yaml` must pass before anyone relies on x86 compatibility.
