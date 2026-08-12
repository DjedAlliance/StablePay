<!-- Don't delete it -->
<div name="readme-top"></div>

<!-- Organization Logo -->
<div align="center">
  <img alt="StabilityNexus" src="public/readme-assets/StabilityNexus.svg" width="175">
  <img alt="DjedAlliance" src="public/readme-assets/djed-alliance.png" width="175">
  <img alt="StablePay" src="public/readme-assets/StablePay.svg" width="175" />
</div>

&nbsp;

<!-- Organization Name -->
<div align="center">

[![Static Badge](https://img.shields.io/badge/Stable-Pay-D27728?style=for-the-badge&labelColor=F7941D)](https://stability.nexus/)

</div>

<!-- Organization/Project Social Handles -->
<p align="center">
<!-- Telegram -->
<a href="https://t.me/StabilityNexus">
<img src="https://img.shields.io/badge/Telegram-black?style=flat&logo=telegram&logoColor=white&logoSize=auto&color=24A1DE" alt="Telegram Badge"/></a>
&nbsp;&nbsp;
<!-- X (formerly Twitter) -->
<a href="https://x.com/StabilityNexus">
<img src="https://img.shields.io/twitter/follow/StabilityNexus" alt="X (formerly Twitter) Badge"/></a>
&nbsp;&nbsp;
<!-- Discord -->
<a href="https://discord.gg/YzDKeEfWtS">
<img src="https://img.shields.io/discord/995968619034984528?style=flat&logo=discord&logoColor=white&logoSize=auto&label=Discord&labelColor=5865F2&color=57F287" alt="Discord Badge"/></a>
&nbsp;&nbsp;
<!-- Medium -->
<a href="https://news.stability.nexus/">
  <img src="https://img.shields.io/badge/Medium-black?style=flat&logo=medium&logoColor=black&logoSize=auto&color=white" alt="Medium Badge"></a>
&nbsp;&nbsp;
<!-- LinkedIn -->
<a href="https://linkedin.com/company/stability-nexus">
  <img src="https://img.shields.io/badge/LinkedIn-black?style=flat&logo=LinkedIn&logoColor=white&logoSize=auto&color=0A66C2" alt="LinkedIn Badge"></a>
&nbsp;&nbsp;
<!-- Youtube -->
<a href="https://www.youtube.com/@StabilityNexus">
  <img src="https://img.shields.io/youtube/channel/subscribers/UCZOG4YhFQdlGaLugr_e5BKw?style=flat&logo=youtube&logoColor=white&logoSize=auto&labelColor=FF0000&color=FF0000" alt="Youtube Badge"></a>
</p>

<!-- Project health badges -->
<p align="center">
<a href="https://scorecard.dev/viewer/?uri=github.com/DjedAlliance/StablePay">
  <img src="https://api.scorecard.dev/projects/github.com/DjedAlliance/StablePay/badge" alt="OpenSSF Scorecard"></a>
&nbsp;&nbsp;
<a href="BestPracticesChecklist.md">
  <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FDjedAlliance%2FStablePay%2Fmain%2Fchecklist-status.json&query=%24.percent&suffix=%25&label=Best%20Practices&logo=openssf" alt="Best Practices"></a>
&nbsp;&nbsp;
<a href="LICENSE">
  <img src="https://img.shields.io/badge/License-MIT-D27728" alt="License: MIT"></a>
&nbsp;&nbsp;
<a href="https://github.com/gitleaks/gitleaks">
  <img src="https://img.shields.io/badge/protected%20by-gitleaks-blue" alt="Protected by Gitleaks"></a>
</p>

&nbsp;
<!-- Project core values and objective -->
<p align="center">
  <strong>
  An open-source SDK <br />
  empowering you to directly accept <br />
  cryptocurrency and stablecoin payments
  free from centralized fintech infrastructure  <br /> 
  </strong>
</p>

---

<!-- Project Description (Start from here) -->

StablePay is a fully decentralized solution for online payments. 
When the StablePay widget is embedded in a website, the widget interacts 
directly with smart contracts on blockchains, with no intermediary servers.

StablePay allows payments to be made either via the native cryptocurrency 
of the underlying blockchain or via decentralized stablecoins backed by these native currencies.
StablePay also allows automatic conversion between the two. For example, a consumer may pay using 
a native cryptocurrency, but the merchant receives the payment in a stablecoin backed by that cryptocurrency.
The conversion happens automatically, by interacting with the stablecoin contract to mint stablecoins.

Currently, stablecoins based on the [Djed stablecoin protocol](https://djed.one) deployed on EVM-compatible chains are supported.


## **Code Structure Overview**

The StablePay widget itself is located in the [stablepay-sdk folder](https://github.com/DjedAlliance/StablePay/tree/main/stablepay-sdk). It makes use of the Djed SDK to interact with Djed stablecoin contracts. The Djed SDK is located in the [djed-sdk folder](https://github.com/DjedAlliance/StablePay/tree/main/djed-sdk). 

The main files of the Djed SDK and their purposes are:

* [djed/stableCoin.js](https://github.com/DjedAlliance/StablePay/blob/main/djed-sdk/src/djed/stableCoin.js) - contains functions to build transations that buy and sell stablecoins.
* [djed/reserveCoin.js](https://github.com/DjedAlliance/StablePay/blob/main/djed-sdk/src/djed/reserveCoin.js) - contains functions to build transations that buy and sell reservecoins.
* [djed/djed.js](https://github.com/DjedAlliance/StablePay/blob/main/djed-sdk/src/djed/djed.js) - contains functions to connect to the Djed contracts and to the ERC20 contracts for the stablecoins and reservecoins.
* [djed/system.js](https://github.com/DjedAlliance/StablePay/blob/main/djed-sdk/src/djed/system.js) - contains functions to fetch the parameters and state variables of the Djed contracts and of the user.
* [oracle/oracle.js](https://github.com/DjedAlliance/StablePay/blob/main/djed-sdk/src/oracle/oracle.js) - contains functions to connect to the oracle contract used by a Djed contract.
* [constants.js](https://github.com/DjedAlliance/StablePay/blob/main/djed-sdk/src/constants.js) - contains configuration constants.
* [web3.js](https://github.com/DjedAlliance/StablePay/blob/main/djed-sdk/src/web3.js) - handles wallet connection.

The main files of the StablePay widget and their purposes are:

* [widget/Widget.jsx](https://github.com/DjedAlliance/StablePay/blob/main/stablepay-sdk/src/widget/Widget.jsx) - contains the main widget component.
* [widget/PayButton.jsx](https://github.com/DjedAlliance/StablePay/blob/main/stablepay-sdk/src/widget/PayButton.jsx) - contains the `Pay with StablePay" button component.
* [widget/NetworkDropdown.jsx](https://github.com/DjedAlliance/StablePay/blob/main/stablepay-sdk/src/widget/NetworkDropdown.jsx) - contains the widget's subcomponent that allows customers to select the blockchain network that they would like to use for the payment.
* [widget/TokenDropdown.jsx](https://github.com/DjedAlliance/StablePay/blob/main/stablepay-sdk/src/widget/TokenDropdown.jsx) - contains the widget's subcomponent that allows customers to select the token (native cryptocurrency or stablecoin) that they would like to use for the payment.
* [widget/TransactionReview.jsx](https://github.com/DjedAlliance/StablePay/blob/main/stablepay-sdk/src/widget/TransactionReview.jsx) - contains the widget's subcomponent that constructs the transaction, shows it to costumer and allows the customer to connect a wallet and submit the transaction.


## **Using the StablePay Widget**

A simple example merchant website with the StablePay widget embedded is available in the [StablePay-MerchantWebsiteDemo](https://github.com/DjedAlliance/StablePay-MerchantWebsiteDemo). A second demo lives in this repository at [`stablepay-sdk/example`](stablepay-sdk/example) and is the fastest way to see the widget running locally.


## **Building, Testing and Running**

### Prerequisites

* **Node.js 18+** and npm
* **[Foundry](https://book.getfoundry.sh/getting-started/installation)** (`forge`, `anvil`, `cast`) — only needed for the contracts and the local Tectonic chain
* A browser wallet such as MetaMask, to exercise the widget

### Install

This is a multi-package repository with no workspace root, so dependencies are installed per package:

```bash
git clone https://github.com/DjedAlliance/StablePay.git
cd StablePay

cd stablepay-sdk         && npm install && cd ..
cd tectonic-sdk          && npm install && cd ..
cd stablepay-sdk/example && npm install && cd ../..
```

### Build

```bash
cd stablepay-sdk && npm run build     # Rollup -> dist/esm, dist/umd
cd tectonic-local && forge build      # Solidity
```

`stablepay-sdk/dist/` is committed to the repository, because the example app and merchant integrations resolve the package through `main`/`module`, which point there. **Any change to `stablepay-sdk/src` or `tectonic-sdk/src` needs a rebuild before it takes effect**, and the rebuilt output should be committed with the change.

### Test

```bash
cd tectonic-sdk   && npm test         # 29 unit tests (node:test)
cd tectonic-local && forge test       # Solidity, incl. 512-run fuzzing
cd stablepay-sdk/example && npm run lint
```

### Run the demo site

```bash
cd stablepay-sdk/example
npm run dev
```

Then open the URL Vite prints. The demo offers the live Djed networks by default.

While iterating on the SDK, alias the package to its source to skip the rebuild loop:

```bash
VITE_SDK_SRC=1 npm run dev
```

Do a final run *without* that flag before opening a PR, to confirm the bundled build works too.

### Run against a local Tectonic chain

Tectonic support is in development and is exercised against a local chain rather than a live deployment.

```bash
# terminal 1 — a local chain
anvil

# terminal 2 — deploy Tectonic + a mock oracle, seeded with a reserve
cd tectonic-local
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# verify the SDK's off-chain pricing agrees with the chain
cd ../tectonic-sdk && npm run smoke

# terminal 3 — the demo, pointed at the local deployment
cd stablepay-sdk/example
VITE_TECTONIC_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 npm run dev
```

The deploy script prints the deployed addresses and writes `tectonic-local/deployments/local.json`. On a freshly started `anvil` the addresses are deterministic and match the value above.

`npm run smoke` is the check the unit tests cannot make: it drives the real contract on a real chain and asserts the property the whole integration rests on — that a merchant invoiced for N stablecoins receives at least N.

> The private keys above are anvil's public, deterministic test accounts. They are safe precisely because everyone has them. Never use them on a real network.


## **Contributing**

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first — in particular, all project communication happens in the [#stablepay Discord channel](https://discord.com/channels/995968619034984528/1283781801751351418), and PRs without a Discord update may sit unreviewed.

* [CONTRIBUTING.md](CONTRIBUTING.md) — how to set up, develop, test and submit a change
* [AGENTS.md](AGENTS.md) — instructions for AI coding agents working in this repository
* [MAINTAINERS.md](MAINTAINERS.md) — who maintains and mentors this project
* [BestPracticesChecklist.md](BestPracticesChecklist.md) — project health against the OpenSSF criteria
* [Report a bug](https://github.com/DjedAlliance/StablePay/issues) — via GitHub Issues


## **Security**

Found a vulnerability? **Do not open a public issue.** See [SECURITY.md](SECURITY.md) for private reporting routes and what to expect.


## **License**

Released under the MIT License. See [LICENSE](LICENSE).


## **Brand**

The StablePay visual identity — logo, favicons and icons, colour palette and typography — lives in the [brand folder](brand), documented in [brand/Brand.md](brand/Brand.md).

* [brand/logo/](brand/logo) — primary mark, single-colour mark, and horizontal wordmark, all SVG.
* [brand/favicon/](brand/favicon) — favicons, PWA icons, and the social preview image.
* [brand/color/](brand/color) — palette as a swatch sheet, CSS custom properties, and JSON tokens.
* [brand/typography/](brand/typography) — type specimen, font stacks, and the type scale.

Raster icons are generated from the logo geometry by `brand/scripts/generate-rasters.py`, so they cannot drift from the vector source.



<!-- Use Back Button after each section -->
<div align="right"><kbd><a href="#readme-top">↑ Back to top ↑</a></kbd></div>

---

<!-- Don't delete it -->
<!-- Funding Badge -->
<div align="center" name="fund">
<a href="https://docs.stability.nexus/about-us/fund-us">Fund This Project</a>
</div>
