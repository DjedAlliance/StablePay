# Contributing to StablePay

⭐ First off, thank you for considering contributing to StablePay! ⭐

We welcome contributions from everyone. By participating in this project, you agree to abide by our Code of Conduct: be respectful, be constructive, assume good faith.

## 💬 Discord Communication is Mandatory

**All project communication happens on Discord. We do not reliably see GitHub notifications.**

- Join the [Stability Nexus Discord](https://discord.gg/YzDKeEfWtS), then go to the project's own channel: **[#stablepay](https://discord.com/channels/995968619034984528/1283781801751351418)**
- Post your PR and issue updates in [#stablepay](https://discord.com/channels/995968619034984528/1283781801751351418) — this is **mandatory**
- GitHub is for code; Discord is for conversation

**PRs without a Discord update may sit unreviewed.**

## 📋 Table of Contents

- [What You Should Know First](#-what-you-should-know-first)
- [How Can I Contribute?](#-how-can-i-contribute)
- [Coding with AI](#-coding-with-ai)
- [Getting Started](#-getting-started)
- [Development Workflow](#-development-workflow)
- [Testing Requirements](#-testing-requirements)
- [Pull Request Guidelines](#-pull-request-guidelines)
- [Code Style Guidelines](#-code-style-guidelines)
- [Community Guidelines](#-community-guidelines)

## 🧭 What You Should Know First

StablePay moves other people's money. That single fact sets the bar for everything below.

A rounding error in a quote is not a cosmetic bug — it is a merchant being underpaid. A mishandled revert is a customer whose funds left their wallet with nothing to show for it. When you are weighing "clean" against "provably correct" in this codebase, pick correct, and leave a comment explaining the choice.

Two consequences worth internalising before your first PR:

- **Never widen a number's path without checking its scaling.** Djed scales by `1e24`; Tectonic scales by `1e18`. The two SDKs deliberately do not share that constant. Copying a helper from one to the other without adjusting is a six-orders-of-magnitude mispricing that unit tests with round numbers will happily miss.
- **The merchant must never be short-changed.** If you touch pricing, run the smoke test (below), which asserts exactly that property against a live chain.

## 🤝 How Can I Contribute?

### Reporting Bugs

Search [existing issues](https://github.com/DjedAlliance/StablePay/issues) first. A good report has:

- A clear, descriptive title
- Steps to reproduce
- Expected vs. actual behaviour
- The network and contract address involved, if the bug is on-chain
- Wallet and browser versions, if it's a widget bug
- Screenshots or a screen recording for UI issues

Found a **security** issue? Do not open a public issue — see [SECURITY.md](SECURITY.md).

### Suggesting Features

- Check whether it's already been suggested
- Describe the problem it solves, not just the solution you have in mind
- Say which part of the stack it touches (widget, SDK, contracts)

### Contributing Code

1. **Open an issue first** for features, bugs, or enhancements
2. **Get assigned** before starting work (preferred)
3. **Submit your PR** referencing the issue
4. PRs unrelated to an issue may be closed or take longer to review

## 🤖 Coding with AI

We accept the use of AI-powered tools (GitHub Copilot, ChatGPT, Claude, Cursor, and so on) for code, tests, and documentation.

⚠️ **Transparency is required.** If you used AI assistance, say so in your PR description.

- **Disclose usage** — "Used Copilot for autocompletion" or "drafted the tests with Claude" is enough
- **Specify the scope** — which parts of the change involved AI
- **Review what it produced** — you are accountable for code you submit, and "the model wrote it" is not an explanation anyone can act on during review

This matters more here than in most repos. LLMs are fluent at producing plausible-looking fixed-point arithmetic that is off by a factor of a million. If AI wrote a pricing path, test it against a real chain before you open the PR.

See [AGENTS.md](AGENTS.md) for instructions aimed at AI coding agents working in this repository.

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+** and npm
- **[Foundry](https://book.getfoundry.sh/getting-started/installation)** (`forge`, `anvil`, `cast`) — only if you're touching contracts or running the local Tectonic chain
- A browser wallet such as MetaMask, for exercising the widget

### Setup

1. **Fork the repository** — use the *Fork* button at the top right

2. **Clone your fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/StablePay.git
   cd StablePay
   ```

3. **Add the upstream remote**

   ```bash
   git remote add upstream https://github.com/DjedAlliance/StablePay.git
   ```

4. **Install dependencies.** This is a multi-package repository without a workspace root, so install per package:

   ```bash
   cd stablepay-sdk  && npm install && cd ..
   cd tectonic-sdk   && npm install && cd ..
   cd stablepay-sdk/example && npm install && cd ../..
   ```

5. **Build the SDK.** The example app resolves `stablepay-sdk` through `main`/`module`, which point at `dist/` — so **every change to `stablepay-sdk/src` needs a rebuild before it shows up**:

   ```bash
   cd stablepay-sdk && npm run build
   ```

   While iterating, skip the rebuild loop by aliasing the package to source:

   ```bash
   cd stablepay-sdk/example
   VITE_SDK_SRC=1 npm run dev
   ```

   Do a final pass *without* `VITE_SDK_SRC` before opening a PR, to confirm the bundled build works too.

See the [README](README.md#building-testing-and-running) for the full build, test and run reference, including the local Tectonic chain.

## 🔄 Development Workflow

### 1. Create a branch

Never work on `main`:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make your changes

- Write clean, readable code
- Explain *why*, not *what*, in comments — the code already says what it does
- Update documentation when behaviour changes

### 3. Test your changes

```bash
cd tectonic-sdk && npm test           # 29 unit tests
cd tectonic-local && forge test       # Solidity tests
cd stablepay-sdk/example && npm run lint
```

If you changed anything in a pricing or minting path, also run the end-to-end smoke test — see [Testing Requirements](#-testing-requirements).

### 4. Commit

```bash
git commit -m "feat: add support for a new network"
```

**Commit message prefixes:** `feat:` `fix:` `docs:` `style:` `refactor:` `test:` `chore:`

### 5. Keep your branch current

```bash
git fetch upstream
git rebase upstream/main
```

### 6. Push

```bash
git push origin feature/your-feature-name
```

## 🧪 Testing Requirements

**New functionality must come with tests.** A PR that adds a code path and no test for it will be asked for one.

| What you changed | What to run |
| ---------------- | ----------- |
| `tectonic-sdk/src` | `cd tectonic-sdk && npm test` |
| `tectonic-local/src` (Solidity) | `cd tectonic-local && forge test` |
| Any pricing, quoting or minting path | the smoke test below, in addition to the above |
| `stablepay-sdk/src` | `npm run build`, then exercise the widget in the example app |

### The smoke test

`tectonic-sdk/scripts/smoke-local.mjs` drives the real contract on a real chain and asserts that off-chain pricing agrees with the on-chain result — including the property the whole integration rests on, that a merchant invoiced for N stablecoins receives at least N.

```bash
# terminal 1
anvil

# terminal 2
cd tectonic-local
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

cd ../tectonic-sdk && npm run smoke
```

Unit tests with stubbed clients cannot catch a scaling error that both the code and the stub share. The smoke test can.

## 📤 Pull Request Guidelines

### Before submitting

- [ ] Code follows the style guidelines below
- [ ] Tests added for new functionality, and the relevant suites pass
- [ ] Documentation updated if behaviour changed
- [ ] `stablepay-sdk` rebuilt if you changed its `src/` (`dist/` is committed)
- [ ] Rebased on the latest upstream `main`
- [ ] AI assistance disclosed, if you used any
- [ ] You've read your own diff as a reviewer would

### PR description template

```markdown
## Description
What this PR does and why.

## Related Issue
Closes #

## AI Assistance
Which tools, for which parts. Write "none" if none.

## Testing
What you ran, and what you observed.

## Screenshots (if UI)
```

### After submitting

- **Post the PR in [#stablepay](https://discord.com/channels/995968619034984528/1283781801751351418)** — important
- Respond to review comments; push fixes as new commits rather than force-pushing mid-review
- Use `[WIP]` for incomplete PRs, but don't use it to reserve territory — finish one change before starting the next
- If a PR sits unattended for 1–2 weeks, tag a maintainer on Discord

### Reviewing others' PRs

Reviewing is a contribution. Rather than opening a competing PR, improve the one that exists. When you review, first ask whether the change is *needed*, then look at how it's implemented.

## 📝 Code Style Guidelines

### General

- Meaningful names; small, focused functions
- Comments explain reasoning and non-obvious constraints, not syntax
- No leftover `console.log`
- Avoid duplication, and avoid speculative abstraction more

### JavaScript / React

- ES modules, `const` over `let`, never `var`
- Follow the ESLint config in `stablepay-sdk/example/eslint.config.js`
- Hooks follow the rules of hooks; keep effects narrow and their dependencies honest
- Widget components stay presentational where possible; protocol logic belongs in an adapter under `stablepay-sdk/src/core/adapters/`

### Adding a protocol

Implement `ProtocolAdapter` (see `stablepay-sdk/src/core/adapters/ProtocolAdapter.js`) and register it in `adapters/index.js`. `Transaction` selects the adapter from the network config, so no widget component should ever branch on which protocol is in use. If you find yourself writing `if (protocol === 'tectonic')` in a component, the abstraction is in the wrong place.

### Solidity

- `tectonic-local/` is a **fork** of [StabilityNexus/Tectonic-EVM-Contracts](https://github.com/StabilityNexus/Tectonic-EVM-Contracts). Keep it diffable against upstream: don't rename things cosmetically, and keep intentional patches small and commented, so they can be handed back as clean PRs
- Renaming a `public` state variable or constant changes the ABI, and the SDK reads it. That's why several lints are suppressed in `foundry.toml` — read the comment there before "fixing" them
- Explicit visibility on everything; no unbounded loops; events for every state change
- Cover success paths, revert paths, and access control

### Documentation

- Sentence case for headings
- Prefer a concrete example over an abstract description
- If you document a command, run it first

## 🌟 Community Guidelines

### Communication

- Be respectful and inclusive
- Give constructive feedback
- Ask questions — no question is too small

### Progress updates

- If your work is taking longer than expected, say so in [#stablepay](https://discord.com/channels/995968619034984528/1283781801751351418)
- Issues should be completed within roughly 5–30 days depending on complexity
- If you can no longer work on an issue, tell a maintainer so it can be reassigned. This is not a failure; silently holding an issue is the problem

### Issue assignment

- One contributor per issue unless stated otherwise
- If an issue has no active PR for 2+ days and nobody is assigned, comment your intent and start
- Don't work on an issue assigned to someone else, even if they look inactive — ask first
- Check for existing PRs before you start; some don't reference their issue

---

Thank you for contributing to StablePay 🚀
