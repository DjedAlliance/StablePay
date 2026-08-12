# Security Policy

StablePay handles payments. A vulnerability here can cost real people real money, so we would much rather hear about a suspected issue that turns out to be nothing than miss a real one.

## Reporting a vulnerability

**Do not open a public GitHub issue for a security vulnerability.**

Report it privately, by either route:

1. **GitHub private vulnerability reporting** — go to the [Security tab](https://github.com/DjedAlliance/StablePay/security/advisories/new) and open a draft advisory. This is preferred: it keeps the report, the discussion and the fix in one place.
2. **Discord** — send a direct message to a maintainer listed in [MAINTAINERS.md](MAINTAINERS.md). Do not post the details in a public channel.

### What to include

- What the issue is, and which component (widget, `stablepay-sdk`, `djed-sdk`, `tectonic-sdk`, contracts)
- Steps to reproduce, or a proof of concept
- The network and contract address, for on-chain issues
- What an attacker could achieve — funds at risk, incorrect amounts, denial of service
- Anything you know about the affected versions

### What to expect

- **Initial response within 14 days.** If you don't hear back, ping a maintainer on Discord — assume the report was missed, not ignored.
- We'll confirm whether we can reproduce it, and tell you what we think the severity is.
- We'll agree a disclosure timeline with you. We won't ask you to stay quiet indefinitely.
- We'll credit you in the advisory unless you'd rather we didn't.

## Scope

**In scope**

- The widget and SDKs in this repository
- The contracts in `tectonic-local/src/` as deployed by this project
- Anything that lets an attacker take funds, misprice a payment, redirect a payment, or make a merchant receive less than they invoiced

**Out of scope**

- The upstream Djed contracts — report those to the [Djed Alliance](https://djed.one)
- Third-party wallets, RPC providers, and merchant sites
- Vulnerabilities requiring a compromised user device or a malicious wallet extension
- The deterministic test keys in this repository (`0xac09…ff80` and the other anvil accounts). These are public by design and hold nothing on any real network.

## A note on the local development chain

`tectonic-local/` and the `tectonic-local` network entry in `stablepay-sdk/src/utils/config.js` exist for development against `anvil`. The entry points at `http://127.0.0.1:8545`, which no end user can reach, and its contract address is `null` until `useLocalTectonic()` is called.

It is nonetheless development scaffolding shipped in a payments library. Merchants who want to be certain it can never be offered should blacklist chain `31337` in their `Config`. If you find a way to make that entry reachable in a production embed, we want to hear about it.

## Supported versions

StablePay is pre-1.0 and under active development. Security fixes land on `main` and in the next release; there are no long-term support branches yet.
