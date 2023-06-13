/**
 * Subprotocol name: raw
 * HTTP header: "Sec-WebSocket-Protocol": "raw"
 *
 * Subprotocol description:
 *  The simplest subprotocol.
 */


class Raw {

  constructor() {
    this.delimiter = '\u0003'; // end-of-text unicode character
  }

  /*********** INCOMING MESSAGES ***********/
  /**
   * Execute the subprotocol for incoming messages.
   * @param {string} msgSTR -incoming message
   * @returns {string}
   */
  incoming(msgSTR) {
    msgSTR = msgSTR.replace(this.delimiter, ''); // remove delimiter
    const msg = msgSTR;
    return msg;
  }



  /*********** OUTGOING MESSAGES ***********/
  /**
   * Execute the subprotocol for outgoing messages.
   * @param {any} msg - outgoing message
   * @returns {string}
   */
  outgoing(msg) {
    let msgSTR = msg;
    if (typeof msg === 'object') { msgSTR = JSON.stringify(msg); }
    msgSTR += this.delimiter;
    return msgSTR;
  }



  /*********** PROCESS MESSAGES ***********/
  /**
   * Process client messages internally.
   * @returns {void}
   */
  async process() { }


}


module.exports = new Raw();
