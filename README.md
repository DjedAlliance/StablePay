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

A simple example merchant website with the StablePay widget embedded is available in the [StablePay-MerchantWebsiteDemo](https://github.com/DjedAlliance/StablePay-MerchantWebsiteDemo).



<!-- Use Back Button after each section -->
<div align="right"><kbd><a href="#readme-top">↑ Back to top ↑</a></kbd></div>

---

<!-- Don't delete it -->
<!-- Funding Badge -->
<div align="center" name="fund">
<a href="https://docs.stability.nexus/about-us/fund-us">Fund This Project</a>
</div>
