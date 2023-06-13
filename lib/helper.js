class Helper {

  /**
   * Create unique id. It's combination of timestamp and random number 'r'
   * in format: YYYYMMDDHHmmssSSSrrr ---> YYYY year, MM month, DD day, HH hour, mm min, ss sec, SSS ms, rrr 3 random digits
   * 20 digits in total, for example: '20210129163129492100'
   * @returns {string}
   */
  generateID() {
    const rnd = Math.random().toString();
    const rrr = rnd.replace('0.', '').substring(0, 3);

    const timestamp = new Date(); // UTC (Greenwich time)
    const tsp = timestamp.toISOString()
      .replace(/\-/g, '')
      .replace(/\:/g, '')
      .replace('T', '')
      .replace('Z', '')
      .replace('.', '');

    const id = tsp + rrr;
    return id;
  }


  /**
   * Gives now time in nice format -> Friday, 1/29/2021, 16:31:29.801
   * @returns {string}
   */
  nowTime() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-us', {
      weekday: 'long',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      fractionalSecondDigits: 3,
      hour12: false,
      timeZone: 'UTC'
    });
    return formatter.format(now);
  }


  /**
   * Pause the code execution
   * @param {number} ms - miliseconds
   * @returns {Promise}
   */
  async sleep(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }



  /**
   * Print all buffer values as string. The bytes are printed separately, for example byte 81, byte 7e ...etc
   * For example: 81 7e 00 8b 7b 22 69 64 22 3a 32 31 30 32 31 34 31 30
   * @param {Buffer} buff
   * @returns {void}
   */
  printBuffer(buff) {
    console.log(buff.toString('hex').match(/../g).join(' '));
  }


  /**
   * Print buffer in nice table of bytes.
   * @param {Buffer} buff - bytes
   * @param {number} perRow - how many bytes present per row (per line)
   */
  tableOfBytes(buff, perRow) {
    let bytes = buff.toString('hex').match(/../g);

    // add new line
    bytes = bytes.map((byte, key) => {
      if (key === 0) { byte = '\n ' + byte; }
      if ((key + 1) % perRow === 0) { byte += '\n'; }
      return byte;
    });

    const str = bytes.join(' ');
    return str;
  }


}




module.exports = new Helper();
