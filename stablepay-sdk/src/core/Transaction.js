import { createPublicClient, createWalletClient, http } from 'viem'
import { getContract } from 'viem'
import { mainnet, sepolia } from 'viem/chains'
import DJED_ABI from '../abi/Djed.json'
import ERC20_ABI from '../abi/ERC20.json'

const BC_DECIMALS = 18n
const SCALING_DECIMALS = 24n
const FEE_UI = 1n // 0.01% scaled later
const UI_ADDRESS = '0x0232556C83791b8291E9b23BfEa7d67405Bd9839'

export class Transaction {
  constructor(networkUri, djedAddress) {
    this.networkUri = networkUri
    this.djedAddress = djedAddress
  }

  async init() {
    const chain = this.networkUri.includes('sepolia') ? sepolia : mainnet

    this.publicClient = createPublicClient({
      chain,
      transport: http(this.networkUri)
    })

    this.djedContract = getContract({
      address: this.djedAddress,
      abi: DJED_ABI,
      client: this.publicClient
    })

    const stableCoinAddress = await this.djedContract.read.stableCoin()
    const reserveCoinAddress = await this.djedContract.read.reserveCoin()

    this.stableCoin = getContract({
      address: stableCoinAddress,
      abi: ERC20_ABI,
      client: this.publicClient
    })

    this.reserveCoin = getContract({
      address: reserveCoinAddress,
      abi: ERC20_ABI,
      client: this.publicClient
    })

    this.scDecimals = BigInt(await this.stableCoin.read.decimals())
    this.rcDecimals = BigInt(await this.reserveCoin.read.decimals())

    this.oracleAddress = await this.djedContract.read.oracle()
  }

  getBlockchainDetails() {
    return {
      clientAvailable: !!this.publicClient,
      djedContractAvailable: !!this.djedContract,
      stableCoinAddress: this.stableCoin?.address || 'N/A',
      reserveCoinAddress: this.reserveCoin?.address || 'N/A',
      stableCoinDecimals: Number(this.scDecimals),
      reserveCoinDecimals: Number(this.rcDecimals),
      oracleAddress: this.oracleAddress || 'N/A'
    }
  }

  async handleTradeDataBuySc(amountScaled) {
    if (!this.djedContract) {
      throw new Error("DJED contract is not initialized")
    }

    if (typeof amountScaled !== 'string') {
      throw new Error("Amount must be a string")
    }

    const amountUnscaled = BigInt(amountScaled)

    const scPrice = await this.djedContract.read.scPrice([0n])
    const treasuryFee = await this.djedContract.read.treasuryFee()
    const fee = await this.djedContract.read.fee()

    const decimalScalingFactor = 10n ** this.scDecimals

    const totalUnscaled =
      (amountUnscaled * scPrice) / decimalScalingFactor

    const scalingFactor = 10n ** SCALING_DECIMALS
    const totalFees = treasuryFee + fee

    const appended =
      (totalUnscaled * scalingFactor) /
      (scalingFactor - totalFees)

    return appended.toString()
  }

  async buyStablecoins(payer, receiver, valueWei) {
    if (!this.djedContract) {
      throw new Error("DJED contract is not initialized")
    }

    const chain = this.networkUri.includes('sepolia') ? sepolia : mainnet

    const walletClient = createWalletClient({
      chain,
      transport: http(this.networkUri),
      account: payer
    })

    return await walletClient.writeContract({
      address: this.djedAddress,
      abi: DJED_ABI,
      functionName: 'buyStableCoins',
      args: [
        receiver,
        0n, // feeUI if needed
        UI_ADDRESS
      ],
      value: BigInt(valueWei)
    })
  }
}