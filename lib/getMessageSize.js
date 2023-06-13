/**
   * Get message size in bytes (for NODEJS platform)
   * For example: A -> 1 , Š -> 2 , ABC -> 3
   * @param {string} msg - message sent to server
   * @returns {number}
   */
module.exports = (msg) => {
  const bytes = Buffer.byteLength(msg, 'utf8');
  return +bytes;
};
