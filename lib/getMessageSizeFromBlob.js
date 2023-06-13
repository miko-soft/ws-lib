/**
   * Get message size in bytes (for BROWSER platform).
   * For example: A -> 1 , Š -> 2 , ABC -> 3
   * @param {string} msg - message sent to server
   * @returns {number}
   */
module.exports = (msg) => {
  const bytes = new Blob([msg]).size;
  return +bytes;
};
