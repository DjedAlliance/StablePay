import { TectonicAdapter } from "./TectonicAdapter.js";
import { DjedAdapter } from "./DjedAdapter.js";

export { ProtocolAdapter } from "./ProtocolAdapter.js";
export { TectonicAdapter, DjedAdapter };

/**
 * Build the adapter for a network config entry.
 *
 * Selection is driven by the config's `protocol` field. It defaults to "djed"
 * so that existing network entries, written before adapters existed, keep
 * working untouched.
 *
 * @param {object} networkConfig entry from utils/config.js
 * @returns {import("./ProtocolAdapter.js").ProtocolAdapter}
 */
export function createAdapter(networkConfig) {
  if (!networkConfig) throw new Error("createAdapter: network config is required");

  const protocol = (networkConfig.protocol ?? "djed").toLowerCase();

  switch (protocol) {
    case "tectonic":
      return new TectonicAdapter(networkConfig);
    case "djed":
      return new DjedAdapter(networkConfig);
    default:
      throw new Error(
        `createAdapter: unknown protocol "${networkConfig.protocol}". ` +
          `Supported values are "tectonic" and "djed".`
      );
  }
}
