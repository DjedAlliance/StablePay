# AGENTS.md

Instructions for AI coding agents working in this repository. Humans should read [CONTRIBUTING.md](CONTRIBUTING.md) instead — this file assumes that one has been read and covers only what an agent needs on top of it.

## What this project is

StablePay is a decentralized payment widget. A merchant embeds it; it talks directly to smart contracts on EVM chains with no intermediary server. A customer can pay in the chain's native currency and the merchant receives a stablecoin — the conversion happens by minting against the stablecoin protocol's reserve.

Two protocols are supported behind one interface: **Djed** (live networks) and **Tectonic** (in development).

## Repository layout

This is a multi-package repository with **no workspace root**. There is no top-level `package.json`; install and run commands per package.

| Path | What it is |
| ---- | ---------- |
| `stablepay-sdk/` | The widget. React components plus the protocol-agnostic core. |
| `stablepay-sdk/example/` | Demo merchant site (Vite). The integration test surface. |
| `djed-sdk/` | Djed protocol client. Pre-existing, stable. |
| `tectonic-sdk/` | Tectonic protocol client. Newer, actively changing. |
| `tectonic-local/` | Foundry project: a fork of Tectonic contracts plus a local deploy script. |
| `brand/` | Logo, icons, colour and type tokens. See `brand/Brand.md`. |

Key files inside `stablepay-sdk/src/`:

- `core/adapters/ProtocolAdapter.js` — the interface both protocols implement
- `core/adapters/TectonicAdapter.js`, `DjedAdapter.js` — the implementations
- `core/Transaction.js` — picks an adapter from network config; **no component should branch on protocol**
- `utils/config.js` — the network registry, plus `useLocalTectonic()`
- `contexts/chains.js` — viem chain definitions and wallet add-chain payloads

## Commands

```bash
# Install (per package — there is no root install)
cd stablepay-sdk && npm install
cd tectonic-sdk  && npm install
cd stablepay-sdk/example && npm install

# Test
cd tectonic-sdk   && npm test        # 29 unit tests, node:test
cd tectonic-local && forge test      # Solidity

# Lint
cd stablepay-sdk/example && npm run lint

# Build the SDK  (REQUIRED after any change to stablepay-sdk/src)
cd stablepay-sdk && npm run build

# Run the demo
cd stablepay-sdk/example && npm run dev
cd stablepay-sdk/example && VITE_SDK_SRC=1 npm run dev   # alias to src, no rebuild loop
```

Full local-chain workflow, including `anvil` and the deploy script, is in the [README](README.md#building-testing-and-running).

## Rules

### Correctness beats elegance

This code moves money. A rounding error is a merchant being underpaid; a mishandled revert is a customer whose funds left their wallet for nothing. When those trade off against readability, choose correctness and leave a comment saying why.

### Never share scaling constants between protocols

**Djed scales by `1e24`. Tectonic scales by `1e18`.** The two SDKs deliberately do not share the constant — see the comment at the top of `tectonic-sdk/src/constants.js`.

Copying a helper from one SDK to the other without adjusting the scale is a six-orders-of-magnitude mispricing, and it is the single most likely serious bug an agent will introduce here. Unit tests written with round numbers will not catch it. If you touch a pricing path, run the smoke test.

### Verify pricing changes against a real chain

`tectonic-sdk/scripts/smoke-local.mjs` deploys nothing but asserts everything: it drives the real contract on `anvil` and checks that a merchant invoiced for N stablecoins receives at least N. Stubbed unit tests cannot catch a scaling error that the code and the stub share. This test can.

```bash
anvil   # terminal 1
cd tectonic-local && forge script script/DeployLocal.s.sol \
  --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
cd ../tectonic-sdk && npm run smoke
```

### `dist/` is committed and must be rebuilt

`stablepay-sdk/dist/` is checked into git on purpose — the example app and merchant integrations resolve the package through `main`/`module`, which point there. `tectonic-sdk` is bundled into that output rather than kept external.

So: **if you change `stablepay-sdk/src/` or `tectonic-sdk/src/`, run `npm run build` in `stablepay-sdk` and commit the result.** Forgetting produces a repository where the source is fixed and the shipped bundle is not — a failure mode that looks exactly like "my fix didn't work".

### Contracts under `tectonic-local/` are a fork

`tectonic-local/src/` mirrors [StabilityNexus/Tectonic-EVM-Contracts](https://github.com/StabilityNexus/Tectonic-EVM-Contracts) so that a diff against upstream shows only the intentional patches.

Do not perform cosmetic renames there, even ones a linter suggests. Renaming a `public` state variable changes the ABI, and `tectonic-sdk` reads it. `foundry.toml` documents which lints are suppressed and why — read that comment before "fixing" a lint warning.

### Extending, not branching

To add a protocol: implement `ProtocolAdapter`, register it in `core/adapters/index.js`, add a network entry in `utils/config.js` with the right `protocol` field. `Transaction` resolves the adapter from config.

If you are about to write `if (protocol === '...')` inside a React component, stop — the logic belongs in an adapter.

### Comments

Explain reasoning and constraints, not syntax. Existing comments in this repo are load-bearing: they record why a scaling factor is what it is, why a lint is suppressed, why a `try/catch` around `vm.writeFile` exists. Match that register. Do not add comments that restate the line below them, and do not strip existing ones while refactoring.

### Do not commit secrets

Private keys appearing in this repo (`0xac09...ff80` and friends) are **anvil's public, deterministic test accounts**. They are safe precisely because everyone has them. Never introduce a real key, an RPC URL with an embedded API token, or a `.env` file. `gitleaks` runs in review.

## Conventions

- ES modules everywhere; `const` over `let`; no `var`
- Commit prefixes: `feat:` `fix:` `docs:` `style:` `refactor:` `test:` `chore:`
- New functionality ships with tests
- Branch from `main`, never commit to it directly

## Disclosure

If you are an AI agent producing a pull request, the PR description must say so, name the tool, and state which parts of the change were AI-generated. This is a hard requirement in [CONTRIBUTING.md](CONTRIBUTING.md), not a courtesy.

Say plainly what you did not verify. An unrun test reported as passing is worse than no test, because it spends a reviewer's trust on something that was never checked.
