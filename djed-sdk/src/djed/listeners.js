/**
 * Utility to listen for Djed contract events
 * @param {Object} djedContract - The Web3 contract instance
 * @param {Object} callbacks - Object containing callback functions for different events
 */
export const subscribeToDjedEvents = (djedContract, callbacks) => {
  const events = [
    { name: "BoughtStableCoins", cb: callbacks.onBoughtStableCoins },
    { name: "SoldStableCoins", cb: callbacks.onSoldStableCoins },
    { name: "BoughtReserveCoins", cb: callbacks.onBoughtReserveCoins },
    { name: "SoldReserveCoins", cb: callbacks.onSoldReserveCoins },
    { name: "SoldBothCoins", cb: callbacks.onSoldBothCoins },
  ];

  const subscriptions = [];

  events.forEach((event) => {
    if (event.cb) {
      const sub = djedContract.events[event.name]({
        fromBlock: "latest",
      })
        .on("data", (data) => {
          event.cb(data.returnValues);
        })
        .on("error", (err) => {
          if (callbacks.onError) callbacks.onError(err);
          else console.error(`Error in ${event.name} subscription:`, err);
        });
      subscriptions.push(sub);
    }
  });

  return {
    unsubscribe: () => {
      subscriptions.forEach((sub) => {
        if (sub.unsubscribe) sub.unsubscribe();
      });
    },
  };
};

/**
 * Utility to fetch past events from the Djed contract
 * @param {Object} djedContract - The Web3 contract instance
 * @param {string} eventName - Name of the event
 * @param {Object} filter - Web3 filter object (e.g., { buyer: '0x...' })
 * @param {number|string} fromBlock - Starting block
 * @returns {Promise<Array>} - Array of past events
 */
export const getPastDjedEvents = async (
  djedContract,
  eventName,
  filter = {},
  fromBlock = 0
) => {
  try {
    return await djedContract.getPastEvents(eventName, {
      filter,
      fromBlock,
      toBlock: "latest",
    });
  } catch (error) {
    console.error(`Error fetching past events for ${eventName}:`, error);
    throw error;
  }
};