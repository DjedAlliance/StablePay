# StablePay Best Practices Checklist

> Criteria adapted from the [OpenSSF Best Practices Badge](https://github.com/coreinfrastructure/best-practices-badge)
> (MIT / CC BY 3.0) by OpenSSF contributors. Modified for AOSSIE multi-repo template use.

> **Purpose:** Covers OpenSSF Best Practices criteria that are NOT auto-detected by OpenSSF Scorecard.
> Scorecard already handles: License, SAST tools, CI tests, Security Policy file, Branch Protection,
> Pinned Dependencies, Signed Releases, Maintained status, and Known Vulnerabilities.
>
> **Legend:**
> - 🔴 MUST — Required for passing
> - 🟡 SHOULD — Required unless documented rationale given
> - 🔵 SUGGESTED — Optional but recommended
> - ⚪ N/A — Marked `[~]` with justification

---

## Score Summary

| Category           | Met | Total | Status |
|--------------------|-----|-------|--------|
| Basics             | 8   | 8     | 🟢     |
| Change Control     | 4   | 6     | 🟡     |
| Reporting          | 6   | 8     | 🟡     |
| Quality            | 9   | 11    | 🟡     |
| Security           | 7   | 9     | 🟡     |
| Analysis           | 6   | 7     | 🟢     |
| **Total**          | **40** | **49** | **82%** |

**Outstanding items are listed in [What's left](#-whats-left) at the bottom.** They are recorded rather than quietly ticked; a checklist that claims more than the repository does is worse than one that admits a gap.

---

## 🏗️ Basics

### Project Website & Documentation

- [x] 🔴 **description_good** — The project README/website clearly describes what the software does and what problem it solves.
  - *Evidence URL:* [README.md](README.md) — StablePay is a decentralized payment widget that lets merchants accept crypto and stablecoin payments without centralized fintech infrastructure, converting between the two automatically.

- [x] 🔴 **interact** — The project provides information on how to obtain the software, submit bug reports, and contribute.
  - *Evidence URL:* [README.md](README.md#building-testing-and-running) (install and run), [CONTRIBUTING.md](CONTRIBUTING.md) (bug reports and contribution process).

- [x] 🔴 **contribution** — `CONTRIBUTING.md` explains the contribution process (e.g., PRs are used, how to open one).
  - *Evidence URL:* [CONTRIBUTING.md](CONTRIBUTING.md#-development-workflow)

- [x] 🟡 **contribution_requirements** — `CONTRIBUTING.md` references acceptable contribution standards (coding style, tests required, etc.).
  - *Evidence URL:* [CONTRIBUTING.md](CONTRIBUTING.md#-code-style-guidelines) and [Testing Requirements](CONTRIBUTING.md#-testing-requirements), which state that new functionality must ship with tests.

- [x] 🔴 **documentation_basics** — Basic documentation exists for the software.
  - *Evidence URL:* [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), [brand/Brand.md](brand/Brand.md), plus per-package READMEs in `stablepay-sdk/`.

- [x] 🔴 **documentation_interface** — Reference documentation describes the external interface.
  - *Evidence URL:* [README.md — Code Structure Overview](README.md#code-structure-overview) documents each public module of the widget and the Djed SDK; [stablepay-sdk/README.md](stablepay-sdk/README.md) documents the embedding API (`Config`, `NetworkSelector`, `Widget`, `useLocalTectonic`).

### Other Basics

- [x] 🔴 **discussion** — Project has a searchable, URL-addressable discussion mechanism that doesn't require proprietary client software.
  - *Evidence URL:* [GitHub Issues](https://github.com/DjedAlliance/StablePay/issues). Day-to-day chat happens in the project's Discord channel, but issues and PRs remain the public, searchable archive.

- [x] 🟡 **english** — Documentation is provided in English and English bug reports/comments are accepted.
  - *Note:* All documentation, code comments and issue discussion are in English.

---

## 🔄 Change Control

### Version Control

- [x] 🔵 **repo_distributed** — Project uses a distributed VCS. *(SUGGESTED)*
  - *Evidence URL:* Git, hosted at [DjedAlliance/StablePay](https://github.com/DjedAlliance/StablePay).

### Version Numbering

- [x] 🔴 **version_unique** — Each release has a unique version identifier.
  - *Evidence URL:* `stablepay-sdk` is published to npm with distinct versions (currently `1.0.3`); `djed-sdk` at `1.0.2`; `tectonic-sdk` at `0.1.0`.

- [x] 🔵 **version_semver** — Project uses SemVer or CalVer format. *(SUGGESTED)*
  - *Note:* SemVer, via each package's `package.json`.

- [ ] 🔵 **version_tags** — Releases are tagged in the VCS. *(SUGGESTED)*
  - *Evidence URL:* Not yet. npm versions exist but are not mirrored as git tags, so there is no commit that unambiguously identifies a published build. See [What's left](#-whats-left).

### Release Notes

- [ ] 🔴 **release_notes** — Each release includes human-readable release notes summarizing major changes.
  - *Evidence URL:* Not yet. Changes are currently only discoverable through commit history, which this criterion explicitly does not accept. See [What's left](#-whats-left).

- [~] 🔴 **release_notes_vulns** — Release notes identify every publicly known vulnerability fixed in that release.
  - *N/A — Justification:* No publicly known vulnerabilities have been reported against StablePay to date, so no release has had one to disclose. This becomes applicable the first time a security fix ships; the process for that is in [SECURITY.md](SECURITY.md).

---

## 🐛 Reporting

### Bug Reporting

- [x] 🔴 **report_process** — A bug-reporting process exists.
  - *Evidence URL:* [CONTRIBUTING.md — Reporting Bugs](CONTRIBUTING.md#reporting-bugs), which specifies the required contents of a report, including the network and contract address for on-chain issues.

- [x] 🟡 **report_tracker** — An issue tracker is used to track individual bugs.
  - *Evidence URL:* [GitHub Issues](https://github.com/DjedAlliance/StablePay/issues)

- [ ] 🔴 **report_responses** — A majority of bug reports submitted in the last 2–12 months have been acknowledged.
  - *Self-certification note:* **Awaiting maintainer self-certification.** This is a factual claim about responsiveness that only the maintainers can make; it has deliberately not been ticked on their behalf.

- [ ] 🟡 **enhancement_responses** — More than 50% of enhancement requests in the last 2–12 months have received a response.
  - *Self-certification note:* **Awaiting maintainer self-certification**, as above.

- [x] 🔴 **report_archive** — Reports and responses are publicly archived and searchable.
  - *Evidence URL:* [GitHub Issues](https://github.com/DjedAlliance/StablePay/issues) — public, searchable, and permanently addressable.

### Vulnerability Reporting

- [x] 🔴 **vulnerability_report_process** — A vulnerability reporting process is documented.
  - *Evidence URL:* [SECURITY.md](SECURITY.md)

- [x] 🟡 **vulnerability_report_private** — The method for private submission is documented.
  - *Evidence URL:* [SECURITY.md — Reporting a vulnerability](SECURITY.md#reporting-a-vulnerability). Two private routes: GitHub private security advisories, or a direct message to a maintainer on Discord.

- [~] 🔴 **vulnerability_report_response** — Initial response to any vulnerability report in the last 6 months was within 14 days.
  - *N/A — Justification:* No vulnerability reports have been received. [SECURITY.md](SECURITY.md) commits to a 14-day initial response.

---

## ✅ Quality

### Build System

- [x] 🔴 **build** — A working build system exists that can auto-rebuild from source.
  - *Evidence URL:* `stablepay-sdk` builds with Rollup (`npm run build`, see [rollup.config.mjs](stablepay-sdk/rollup.config.mjs)); the contracts build with Foundry (`forge build`).

- [x] 🔵 **build_common_tools** — Common build tools are used. *(SUGGESTED)*
  - *Evidence URL:* npm and Rollup for JavaScript; Foundry (`forge`) for Solidity; Vite for the demo app.

- [x] 🟡 **build_floss_tools** — The project can be built using only FLOSS tools.
  - *Note:* Node.js, npm, Rollup, Vite and Foundry are all open source. No proprietary toolchain is required at any stage.

### Automated Testing

- [x] 🔵 **test_invocation** — The test suite can be invoked in a standard way for the language. *(SUGGESTED)*
  - *Evidence URL:* `npm test` in `tectonic-sdk` (29 tests, `node:test`); `forge test` in `tectonic-local`.

- [ ] 🔵 **test_most** — The test suite covers most code branches, input fields, and functionality. *(SUGGESTED)*
  - *Estimated coverage %:* Partial. `tectonic-sdk` and the Solidity contracts are covered; `stablepay-sdk`'s widget components and `djed-sdk` have no automated tests. See [What's left](#-whats-left).

### New Functionality Testing Policy

- [x] 🔴 **test_policy** — The project has a general policy that new functionality must include tests.
  - *Evidence:* [CONTRIBUTING.md — Testing Requirements](CONTRIBUTING.md#-testing-requirements): "New functionality must come with tests. A PR that adds a code path and no test for it will be asked for one."

- [x] 🔴 **tests_are_added** — Evidence exists that the test policy has been followed in recent major changes.
  - *Evidence URL:* The Tectonic adapter work shipped with `tectonic-sdk/test/pricing.test.js` and `client.test.js` (29 tests), `tectonic-local/test/Tectonic.t.sol`, and an end-to-end smoke test at `tectonic-sdk/scripts/smoke-local.mjs`. Later fixes to `pricing.js` added corresponding test cases in the same commit.

- [x] 🔵 **tests_documented_added** — The test policy is documented in contribution instructions. *(SUGGESTED)*
  - *Evidence URL:* [CONTRIBUTING.md — Testing Requirements](CONTRIBUTING.md#-testing-requirements), including a table mapping each changed area to the suite that must be run.

### Linting / Warning Flags

- [x] 🔴 **warnings** — At least one linter or compiler warning flag is enabled.
  - *Tool used:* ESLint (`stablepay-sdk/example/eslint.config.js`), `forge lint` for Solidity, and CodeRabbit static review on every PR (see [.coderabbit.yaml](.coderabbit.yaml), which enables eslint, biome, markdownlint, yamllint, shellcheck and gitleaks).

- [x] 🔴 **warnings_fixed** — Warnings from the linter are addressed (not suppressed without reason).
  - *Note:* The only suppressed lints are the `forge lint` exclusions in [tectonic-local/foundry.toml](tectonic-local/foundry.toml), each with a written rationale: the directory is a fork kept diffable against upstream, and the suggested renames would change the ABI that `tectonic-sdk` reads. Commit history shows CodeRabbit findings being fixed rather than dismissed.

- [ ] 🔵 **warnings_strict** — Project uses maximum strictness in linter config where practical. *(SUGGESTED)*
  - *Note:* ESLint currently covers only the example app, not `stablepay-sdk/src` or the SDK packages. See [What's left](#-whats-left).

---

## 🔐 Security

### Secure Development Knowledge

- [ ] 🔴 **know_secure_design** — At least one primary developer knows how to design secure software.
  - *Self-certification note:* **Awaiting maintainer self-certification.** Supporting evidence exists in the repository — validation that rejects the zero address explicitly because it is truthy in JavaScript, gas estimated rather than hardcoded because execution path length is state-dependent, and deliberately unshared scaling constants between protocols — but the assertion is the developer's to make.

- [ ] 🔴 **know_common_errors** — At least one primary developer knows common vulnerability types for this category of software.
  - *Self-certification note:* **Awaiting maintainer self-certification.** Relevant categories here: reentrancy and access control in Solidity, fixed-point scaling and rounding direction in pricing, and transaction-rejection handling in the wallet flow. All three are addressed in code and in [AGENTS.md](AGENTS.md).

### Cryptography

- [x] 🔴 **crypto_published** — Only publicly reviewed cryptographic protocols/algorithms are used by default.
  - *Note:* Only standard EVM primitives: secp256k1 ECDSA for transaction signing and keccak-256 for hashing, both performed by the user's wallet and the chain, not by this codebase.

- [x] 🟡 **crypto_call** — Project calls an established crypto library rather than reimplementing crypto functions.
  - *Library used:* [viem](https://viem.sh) and web3.js on the client side; [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts) in Solidity. No cryptographic primitive is implemented in this repository.

- [x] 🔴 **crypto_working** — No broken algorithms used.
  - *Note:* No MD4, MD5, single DES, RC4 or Dual_EC_DRBG anywhere in the codebase or its direct dependencies.

- [x] 🔴 **crypto_keylength** — Key lengths meet NIST 2030 minimums by default.
  - *Note:* secp256k1 (256-bit, ~128-bit security) as mandated by the EVM. Not a project choice, and not below the minimum.

- [~] 🔴 **crypto_password_storage** — Passwords for external users are stored as iterated salted hashes.
  - *N/A — Justification:* StablePay has no accounts, no passwords and no server. Authentication is by wallet signature.

- [~] 🔴 **crypto_random** — Cryptographic keys and nonces are generated using a CSPRNG.
  - *N/A — Justification:* The project generates no keys or cryptographic nonces. Key management is entirely the user's wallet's responsibility; transaction nonces are sequential account nonces supplied by the chain, not secrets. The private keys visible in this repository are anvil's public, deterministic test accounts.

- [x] 🟡 **delivery_unsigned** — Cryptographic hashes are NOT retrieved over plain HTTP without a signature check.
  - *Note:* All dependencies are fetched over HTTPS from npm with integrity hashes recorded in `package-lock.json`. The only plain-HTTP URL in the codebase is `http://127.0.0.1:8545`, the local development chain.

---

## 🔬 Analysis

### Static Code Analysis

- [x] 🔴 **static_analysis_fixed** — All medium+ severity vulnerabilities found by static analysis are fixed in a timely manner.
  - *Note:* CodeRabbit reviews every PR against `main`. Commit history shows its findings being addressed in follow-up commits rather than dismissed.

- [ ] 🔵 **static_analysis_common_vulnerabilities** — The static analysis tool includes checks for common vulnerabilities in the language/environment. *(SUGGESTED)*
  - *Tool + ruleset:* CodeRabbit is configured with Solidity-specific review instructions and gitleaks secret scanning, but [Slither](https://github.com/crytic/slither) is not yet wired into CI. See [What's left](#-whats-left).

- [x] 🔵 **static_analysis_often** — Static analysis runs on every commit or at least daily. *(SUGGESTED)*
  - *Evidence URL:* [.coderabbit.yaml](.coderabbit.yaml) — `auto_review.enabled: true` on every PR targeting `main`.

### Dynamic Code Analysis

- [x] 🔵 **dynamic_analysis** — At least one dynamic analysis tool is applied before major releases. *(SUGGESTED)*
  - *Tool used:* Foundry property-based fuzzing, configured at 512 runs per property in [tectonic-local/foundry.toml](tectonic-local/foundry.toml). Additionally, `tectonic-sdk/scripts/smoke-local.mjs` exercises the deployed contract on a live local chain and asserts that a merchant is never paid less than the invoiced amount.

- [x] 🔵 **dynamic_analysis_enable_assertions** — Dynamic analysis runs with assertions enabled. *(SUGGESTED)*
  - *Note:* Foundry tests assert on state after every state-changing call; the smoke test asserts on real on-chain balances rather than mocked returns.

- [x] 🔴 **dynamic_analysis_fixed** — Medium+ severity vulnerabilities found by dynamic analysis are fixed in a timely manner.
  - *Note:* No outstanding findings. Fuzz and smoke suites currently pass.

- [~] 🔵 **dynamic_analysis_unsafe** — Memory safety tools are used for memory-unsafe languages. *(SUGGESTED)*
  - *N/A — Justification:* The project uses JavaScript and Solidity. Neither is memory-unsafe in the C/C++ sense; Solidity's analogous risks (reentrancy, unbounded loops) are covered by the Solidity review instructions in [.coderabbit.yaml](.coderabbit.yaml) and by the Foundry test suite.

---

## 📌 What's left

Nine items are unmet. Four are SUGGESTED, two are SHOULD-or-self-certify, and the rest are actionable now.

| Item | Level | What would close it |
| ---- | ----- | ------------------- |
| `release_notes` | 🔴 MUST | Cut a GitHub Release for the current `stablepay-sdk` version with human-written notes. |
| `version_tags` | 🔵 | `git tag v1.0.3 && git push --tags`, mirroring the published npm versions. |
| `report_responses` | 🔴 MUST | Maintainer self-certification — confirm bug reports from the last 2–12 months were acknowledged. |
| `enhancement_responses` | 🟡 | Maintainer self-certification, as above. |
| `know_secure_design` | 🔴 MUST | Maintainer self-certification. |
| `know_common_errors` | 🔴 MUST | Maintainer self-certification. |
| `test_most` | 🔵 | Add component tests for `stablepay-sdk/src/widget`, which currently has none. |
| `warnings_strict` | 🔵 | Extend ESLint from `example/` to `stablepay-sdk/src` and the SDK packages. |
| `static_analysis_common_vulnerabilities` | 🔵 | Add Slither to CI for `tectonic-local/src`. |

---

## 📎 Project-Specific Notes

### Web3 / Solidity

- Scorecard does not audit Solidity-specific security. [Slither](https://github.com/crytic/slither) is the intended tool for `static_analysis` and remains outstanding above.
- Cryptographic primitives relied on are standard EVM ones: secp256k1 ECDSA and keccak-256. None are implemented in this repository.
- `tectonic-local/` is a fork of [StabilityNexus/Tectonic-EVM-Contracts](https://github.com/StabilityNexus/Tectonic-EVM-Contracts), kept deliberately diffable against upstream so that fixes can be handed back as clean PRs. This constrains what refactoring is acceptable — see the rationale in `foundry.toml`.

### Payments-specific

The property this integration rests on is that **a merchant invoiced for N stablecoins receives at least N**. It is asserted end-to-end against a live chain by `tectonic-sdk/scripts/smoke-local.mjs`, not just in unit tests — a stubbed test that shares a scaling assumption with the code it tests proves nothing.

Fixed-point scaling differs by protocol: Djed uses `1e24`, Tectonic uses `1e18`. The two SDKs do not share the constant, deliberately.

---

*This checklist complements [OpenSSF Scorecard](https://scorecard.dev/) (auto-detected checks) and is
inspired by the [OpenSSF Best Practices Badge](https://www.bestpractices.dev/en/criteria/0) passing criteria.*
