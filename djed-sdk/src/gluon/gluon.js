import gluonArtifact from "../artifacts/GluonABI.json";
import coinArtifact from "../artifacts/CoinABI.json";
import { convertInt, web3Promise, buildTx } from "../helpers";

export class Gluon {
  constructor(web3, gluonAddress, bondTokenAddress, oracleAddress) {
    this.web3 = web3;
    this.gluonAddress = gluonAddress;
    this.bondTokenAddress = bondTokenAddress;
    this.oracleAddress = oracleAddress;
    this.contract = new web3.eth.Contract(gluonArtifact, gluonAddress);
  }

  async getCoinContracts() {
    const [protonAddress, neutronAddress] = await Promise.all([
      web3Promise(this.contract, "PROTON_TOKEN"),
      web3Promise(this.contract, "NEUTRON_TOKEN"),
    ]);
    const proton = new this.web3.eth.Contract(coinArtifact.abi, protonAddress);
    const neutron = new this.web3.eth.Contract(
      coinArtifact.abi,
      neutronAddress
    );
    return { proton, neutron };
  }

  async getDecimals(proton, neutron) {
    const [protonDecimals, neutronDecimals] = await Promise.all([
      convertInt(web3Promise(proton, "decimals")),
      convertInt(web3Promise(neutron, "decimals")),
    ]);
    return { protonDecimals, neutronDecimals };
  }

  fission(payer, amountIn, to, updateData = []) {
    const data = this.contract.methods
      .fission(amountIn, to, updateData)
      .encodeABI();
    return buildTx(payer, this.gluonAddress, amountIn, data);
  }

  fusion(payer, m, to) {
    const data = this.contract.methods.fusion(m, to).encodeABI();
    return buildTx(payer, this.gluonAddress, 0, data);
  }
}
