/**
 * Data parser according to RFC6455 ( https://tools.ietf.org/html/rfc6455#section-5 )
 */
class DataParser {

  constructor(debug) {
    this.debug = debug || false;
  }


  /**
   * Parse incoming message.
   * Convert buffer to string according to RFC6455 standard https://tools.ietf.org/html/rfc6455#section-5.2 .
   * @param {Buffer} msgBUF - the websocket message buffer
   * @return {String} - unmasked payload string message
   */
  incoming(msgBUF) {
    // 1.st byte
    const byte_1 = msgBUF.readUInt8(0);
    const fin = byte_1 >>> 7; // is final fragment
    const rsv1 = (byte_1 & 0b01000000) >>> 6; // reserved
    const rsv2 = (byte_1 & 0b00100000) >>> 5; // reserved
    const rsv3 = (byte_1 & 0b00010000) >>> 4; // reserved
    const opcode = (byte_1 & 0b00001111); // operational code (non-control or control frame) - https://tools.ietf.org/html/rfc6455#section-5.2

    // 2.nd byte
    const byte_2 = msgBUF.readUInt8(1);
    const mask = byte_2 >>> 7; // messages sent from client mask=1. messages sent from server mask=0
    const plen_byte2 = byte_2 & 0b01111111; // payload length defined in the second byte


    /* OPCODES https://tools.ietf.org/html/rfc6455#section-5.1
     * %x0 denotes a continuation frame
     * %x1 denotes a text frame
     * %x2 denotes a binary frame
     * %x3-7 are reserved for further non-control frames
     * %x8 denotes a connection close
     * %x9 denotes a ping
     * %xA denotes a pong
     * %xB-F are reserved for further control frames
     */
    if (opcode === 0x8) {
      return 'OPCODE 0x8 CLOSE';
    } else if (opcode === 0x9) {
      return 'OPCODE 0x9 PING';
    } else if (opcode === 0xA) {
      return 'OPCODE 0xA PONG';
    }


    /* Extract payload length, masking keys and payload buffer.
     * Notice 1: If plen_byte2=126 then extend plen with 2 bytes (16bits). If plen=127 extend plen with 8 bytes (64bits).
     * Notice 2: Masking keys are always 4 bytes and after payload length.
     * Notice 3: Masked messages are always sent from client to server. Messages sent from server to client are not masked.
     * Notice 4: Payload bytes are always after mask keys.
     */
    let dbg;
    let plen; // payload length in bytes
    let mask_keys; // masking keys exists only when message is sent from client to server
    let payload_buff; // sliced mesage buffer to get only payload buffer part
    let payload_buff_unmasked; // unmasked paylod as buffer
    let payload_str; // unmasked payload as string
    let byte_34, byte_3_10;

    ///// SMALL messages (0 <= bytes < 126 ~ 0b1111110) /////
    if (plen_byte2 < 126) {
      dbg = 'Small message';
      plen = plen_byte2;
      payload_buff = msgBUF.slice(2, 2 + plen);

      if (mask === 1) {
        const byte_3 = msgBUF.readUInt8(2);
        const byte_4 = msgBUF.readUInt8(3);
        const byte_5 = msgBUF.readUInt8(4);
        const byte_6 = msgBUF.readUInt8(5);
        mask_keys = [byte_3, byte_4, byte_5, byte_6];
        payload_buff = msgBUF.slice(6, 6 + plen);
        const payload_nums_unmasked = this.masking(payload_buff, mask_keys); // unmask the payload
        payload_buff_unmasked = Buffer.from(payload_nums_unmasked); // get buffer from array of bytes (numbers)
        payload_str = payload_buff_unmasked.toString('utf8'); // convert unmasked payload buffer to string
      } else {
        payload_str = payload_buff.toString('utf8');
      }

      ///// MEDIUM messages (126 <= bytes <= 2^16 ~ 65536) /////
    } else if (plen_byte2 === 126) {
      dbg = 'Medium message';
      byte_34 = msgBUF.readUInt16BE(2); // byte 3 and 4
      plen = byte_34;
      payload_buff = msgBUF.slice(4, 4 + plen);

      // get mask keys (mask keys are always 4 bytes -      console.log('byte_34::', typeof byte_34, byte_34); after payload length)
      if (mask === 1) { // only for messages from the client to the server
        const byte_5 = msgBUF.readUInt8(4);
        const byte_6 = msgBUF.readUInt8(5);
        const byte_7 = msgBUF.readUInt8(6);
        const byte_8 = msgBUF.readUInt8(7);
        mask_keys = [byte_5, byte_6, byte_7, byte_8];
        payload_buff = msgBUF.slice(8, 8 + plen);
        const payload_nums_unmasked = this.masking(payload_buff, mask_keys); // unmask the payload
        payload_buff_unmasked = Buffer.from(payload_nums_unmasked); // get buffer from array of bytes (numbers)
        payload_str = payload_buff_unmasked.toString('utf8'); // convert unmasked payload buffer to string
      } else {
        payload_str = payload_buff.toString('utf8');
      }

      ///// LARGE messages (2^16 < bytes <= 2^64) /////
    } else if (plen_byte2 === 127) {
      dbg = 'Large message';
      byte_3_10 = msgBUF.readBigUInt64BE(2);
      plen = Number(byte_3_10); // convert BigInt to Number
      if (plen > Number.MAX_SAFE_INTEGER) { // Number.MAX_SAFE_INTEGER is 2^53-1
        throw new Error(`The max payload size of ${Number.MAX_SAFE_INTEGER} bytes is reached.`);
      }
      payload_buff = msgBUF.slice(10, 10 + plen);

      // get mask keys (mask keys are always 4 bytes - after payload length)
      if (mask === 1) { // only for messages from the client to the server
        const byte_11 = msgBUF.readUInt8(10);
        const byte_12 = msgBUF.readUInt8(11);
        const byte_13 = msgBUF.readUInt8(12);
        const byte_14 = msgBUF.readUInt8(13);
        mask_keys = [byte_11, byte_12, byte_13, byte_14];
        payload_buff = msgBUF.slice(14, 14 + plen);
        const payload_nums_unmasked = this.masking(payload_buff, mask_keys); // unmask the payload
        payload_buff_unmasked = Buffer.from(payload_nums_unmasked); // get buffer from array of bytes (numbers)
        payload_str = payload_buff_unmasked.toString('utf8'); // convert unmasked payload buffer to string
      } else {
        payload_str = payload_buff.toString('utf8');
      }

    }



    if (this.debug) {
      console.log('\n\n--------------------- DataParser.incoming ------------------------');
      console.log(`RECEIVED ${msgBUF.length} BYTES IN TOTAL.`);
      console.log('\nmsgBUF::', msgBUF.length, this.tableOfBytes(msgBUF, 50));
      console.log();
      console.log(`byte_1::: 0b${this.toBinStr(byte_1)} -- 0x${this.toHexStr(byte_1)} -- ${byte_1} ---> fin:${fin} rsv1:${rsv1} rsv2:${rsv2} rsv3:${rsv3} opcode:0x${this.toHexStr(opcode)}`);
      console.log(`byte_2::: 0b${this.toBinStr(byte_2)} -- 0x${this.toHexStr(byte_2)} -- ${byte_2} ---> mask:${mask} plen_byte2:0b${this.toBinStr(plen_byte2)} -- 0x${this.toHexStr(plen_byte2)} -- ${plen_byte2} (${dbg})`);
      if (!!byte_34) console.log(`byte_34::: 0b${this.toBinStr(byte_34, 2)} -- 0x${this.toHexStr(byte_34, 2)} -- ${byte_34}`); // msglen >= 126 && msglen <= 0xFFFF
      if (!!byte_3_10) console.log(`byte_3_10::: 0b${this.toBinStr(byte_3_10, 8)} -- 0x${this.toHexStr(byte_3_10, 8)} -- ${byte_3_10}`); // msglen > 0xFFFF && msglen <= 0xFFFFFFFFFFFFFFFF
      console.log();
      console.log(`plen: 0b${this.toBinStr(plen)} -- 0x${this.toHexStr(plen)} -- ${plen}`);
      console.log(`mask: ${mask}`);
      if (mask === 1) console.log(`mask_keys: 0x${this.toHexStr(mask_keys[0])} 0x${this.toHexStr(mask_keys[1])} 0x${this.toHexStr(mask_keys[1])} 0x${this.toHexStr(mask_keys[2])}`);
      console.log();
      console.log('payload_buff:', payload_buff.length, payload_buff);
      if (mask === 1) console.log('payload_buff_unmasked:', payload_buff_unmasked.length, payload_buff_unmasked);
      console.log('payload_str:', payload_str.length, payload_str);
      console.log('--------------------- DataParser.incoming END ------------------------\n\n');
    }


    return payload_str;

  }



  /**
   * Parse outgoing message.
   * Convert string to buffer according to RFC6455 standard https://tools.ietf.org/html/rfc6455#section-5.2 .
   * @param {String} msgSTR - message string (payload)
   * @param {0|1} mask - mask 0 if message is sent from server to client or 1 in opposite direction
   * @return {ArrayBuffer} - buffer
   */
  outgoing(msgSTR, mask) {
    if (mask !== 0 && mask !== 1) { throw new Error('mask must be 0 or 1'); }

    const payload_buff = Buffer.from(msgSTR);
    const msglen = payload_buff.length; // payload message length in bytes

    // 1.st byte
    const fin = 1; // final message fragment
    const rsv1 = 0;
    const rsv2 = 0;
    const rsv3 = 0;
    const opcode = 0x1; // 0x1 is text frame (or 0b0001)
    const byte_1 = (((((((fin << 1) | rsv1) << 1) | rsv2) << 1) | rsv3) << 4) | opcode;

    // 2. nd byte
    let dbg, plen_byte2;
    if (msglen < 126) {
      dbg = 'Small message';
      plen_byte2 = msglen;
    } else if (msglen >= 126 && msglen <= 0xFFFF) { // 0xFFFF = 65535
      dbg = 'Medium message';
      plen_byte2 = 126;
    } else if (msglen > 0xFFFF && msglen <= 0xFFFFFFFFFFFFFFFF) { // 0xFFFFFFFFFFFFFFFF = 18 446 744 073 709 551 615 = 18,446774*10^18 = 2^64-1
      dbg = 'Large message';
      plen_byte2 = 127;
    }
    const byte_2 = (mask << 7) | plen_byte2;


    // convert 1.st and 2.nd byte numbers to buffer
    const buff_12 = Buffer.from([byte_1, byte_2]);


    /*** create frame buffer which will be sent ***/
    let frame_buff; // frame buffer which will be sent via websocket connection
    let payload_buff_masked;
    let byte_34;
    let byte_3_10;

    ///// SMALL messages (0 <= bytes < 126 ~ 0b1111110) /////
    if (plen_byte2 < 126) {
      if (mask === 1) {
        const mask_keys = this.randomMaskingKeys();
        const payload_nums_masked = this.masking(payload_buff, mask_keys); // mask the payload
        payload_buff_masked = Buffer.from(payload_nums_masked); // get buffer from array of bytes (numbers)
        const mask_keys_buff = Buffer.from(mask_keys);
        frame_buff = Buffer.concat([buff_12, mask_keys_buff, payload_buff_masked]);
      } else {
        frame_buff = Buffer.concat([buff_12, payload_buff]);
      }

      ///// MEDIUM messages (126 <= bytes <= 2^16 ~ 65536) /////
    } else if (plen_byte2 === 126) {
      byte_34 = msglen; // bits for 3.rd and 4.th byte (16bit)
      const buff_34 = Buffer.alloc(2); // write bits into 2 bytes
      buff_34.writeUInt16BE(byte_34); // write bits into allocated memory
      if (mask === 1) { // when client is sending to server
        const mask_keys = this.randomMaskingKeys();
        const payload_nums_masked = this.masking(payload_buff, mask_keys); // mask the payload
        payload_buff_masked = Buffer.from(payload_nums_masked); // get buffer from array of bytes (numbers)
        const mask_keys_buff = Buffer.from(mask_keys);
        frame_buff = Buffer.concat([buff_12, buff_34, mask_keys_buff, payload_buff_masked]);
      } else { // when server is sending to client
        frame_buff = Buffer.concat([buff_12, buff_34, payload_buff]);
      }

      ///// LARGE messages (2^16 < bytes <= 2^64) /////
    } else if (plen_byte2 === 127) {
      if (msglen > Number.MAX_SAFE_INTEGER) { // Number.MAX_SAFE_INTEGER is 2^53-1
        throw new Error(`The max payload size of ${Number.MAX_SAFE_INTEGER} bytes is reached.`);
      }
      byte_3_10 = BigInt(msglen); // bits for 3,4,5,6,7,8,9 and 10.th byte (8bytes or 64bit)
      const buff_3_10 = Buffer.alloc(8); // write bits into 8 bytes
      buff_3_10.writeBigUInt64BE(byte_3_10);
      if (mask === 1) { // when client is sending to server
        const mask_keys = this.randomMaskingKeys();
        const payload_nums_masked = this.masking(payload_buff, mask_keys); // mask the payload
        payload_buff_masked = Buffer.from(payload_nums_masked); // get buffer from array of bytes (numbers)
        const mask_keys_buff = Buffer.from(mask_keys);
        frame_buff = Buffer.concat([buff_12, buff_3_10, mask_keys_buff, payload_buff_masked]);
      } else { // when server is sending to client
        frame_buff = Buffer.concat([buff_12, buff_3_10, payload_buff]);
      }


    }


    if (this.debug) {
      console.log('\n\n--------------------- DataParser.outgoing ------------------------');
      console.log(dbg + ` with ${msglen} bytes`);
      console.log('msgSTR::', msgSTR);
      console.log();
      console.log(`msglen::: ${msglen}`);
      console.log(`byte_1::: 0b${this.toBinStr(byte_1)} -- 0x${this.toHexStr(byte_1)} -- ${byte_1} ---> fin:${fin} rsv1:${rsv1} rsv2:${rsv2} rsv3:${rsv3} opcode:0x${this.toHexStr(opcode)}`);
      console.log(`byte_2::: 0b${this.toBinStr(byte_2)} -- 0x${this.toHexStr(byte_2)} -- ${byte_2} ---> mask:${mask} plen_byte2:0b${this.toBinStr(plen_byte2)} -- 0x${this.toHexStr(plen_byte2)} -- ${plen_byte2} (${dbg})`);
      if (!!byte_34) console.log(`byte_34::: 0b${this.toBinStr(byte_34, 2)} -- 0x${this.toHexStr(byte_34, 2)} -- ${byte_34}`); // msglen >= 126 && msglen <= 0xFFFF
      if (!!byte_3_10) console.log(`byte_3_10::: 0b${this.toBinStr(byte_3_10, 8)} -- 0x${this.toHexStr(byte_3_10, 8)} -- ${byte_3_10}`); // msglen > 0xFFFF && msglen <= 0xFFFFFFFFFFFFFFFF
      console.log('payload_buff::', payload_buff.length, payload_buff);
      if (mask === 1) console.log('payload_buff_masked::', payload_buff_masked.length, payload_buff_masked);
      console.log('\nframe_buff (msgBUF)::', frame_buff.length, this.tableOfBytes(frame_buff, 50));
      console.log(`\nSENT ${frame_buff.length} BYTES IN TOTAL.`);
      console.log('--------------------- DataParser.outgoing END ------------------------\n\n');
    }

    const msgBUF = frame_buff;
    return msgBUF;

  }



  /********************* CONTROL FRAMES ******************/
  /*** https://tools.ietf.org/html/rfc6455#section-5.5 ***/

  /**
   * Send close frame which contains (opcode: 0x8).
   * @param {0|1} mask - mask 0 if message is sent from server to client or 1 in opposite direction
   */
  ctrlClose(mask) {
    // 1.st byte
    const fin = 1; // final message fragment
    const rsv1 = 0;
    const rsv2 = 0;
    const rsv3 = 0;
    const opcode = 0x8; // 0x8 is close frame (or 0b1000)
    const byte_1 = (((((((fin << 1) | rsv1) << 1) | rsv2) << 1) | rsv3) << 4) | opcode;

    // 2.nd byte
    const plen_byte2 = 0;
    const byte_2 = (mask << 7) | plen_byte2;

    let frame_buff = Buffer.from([byte_1, byte_2]);

    // 3, 4, 5 and 6 bytes are masking key
    if (mask === 1) {
      const mask_keys = this.randomMaskingKeys();
      const buff_3456 = Buffer.from(mask_keys);
      frame_buff = Buffer.concat([frame_buff, buff_3456]);
    }

    const closeBUF = frame_buff;
    return closeBUF;
  }


  /**
   * Send ping frame contains (opcode: 0x9).
   */
  ctrlPing() {
    // 1.st byte
    const fin = 1; // final message fragment
    const rsv1 = 0;
    const rsv2 = 0;
    const rsv3 = 0;
    const opcode = 0x9; // 0x9 is ping frame (or 0b1001)
    const byte_1 = (((((((fin << 1) | rsv1) << 1) | rsv2) << 1) | rsv3) << 4) | opcode;

    // 2.nd byte
    const byte_2 = 0;

    const frame_buff = Buffer.from([byte_1, byte_2]);

    const pingBUF = frame_buff;
    return pingBUF;
  }


  /**
   * Send pong frame contains (opcode: 0xA).
   */
  ctrlPong() {
    // 1.st byte
    const fin = 1; // final message fragment
    const rsv1 = 0;
    const rsv2 = 0;
    const rsv3 = 0;
    const opcode = 0xA; // 0xA is ping frame (or 0b1010)
    const byte_1 = (((((((fin << 1) | rsv1) << 1) | rsv2) << 1) | rsv3) << 4) | opcode;

    // 2.nd byte
    const byte_2 = 0;

    const frame_buff = Buffer.from([byte_1, byte_2]);

    const pongBUF = frame_buff;
    return pongBUF;
  }




  /********* HELPERS  *********/
  /**
   * Convert number to readable binary string (showing leading zeros).
   * @param {number} num - number to be converted
   * @param {number} bytes - number of bytes contained in the num
   */
  toBinStr(num, bytes = 1) {
    if (!num) return;
    const n = num.toString(2);
    let str;
    if (bytes === 1) { str = '00000000'.substr(n.length) + n; }
    if (bytes === 2) { str = '0000000000000000'.substr(n.length) + n; }
    if (bytes === 8) { str = '0000000000000000000000000000000000000000000000000000000000000000'.substr(n.length) + n; }
    return str;
  }


  /**
   * Convert number to readable hex string (showing leading zeros).
   * @param {number} num - number to be converted
   * @param {number} bytes - number of bytes contained in the num
   */
  toHexStr(num, bytes = 1) {
    if (!num) return;
    const n = num.toString(16);
    let str;
    if (bytes === 1) { str = '00'.substr(n.length) + n; }
    else if (bytes === 2) str = '0000'.substr(n.length) + n;
    else if (bytes === 8) str = '0000000000000000'.substr(n.length) + n;
    return str;
  }


  /**
   * Generate 4 masking keys (numbers) randomly
   * 0 <= n <= 255  or  0x00 <= n <= 0xFF
   * @returns {[number, number, number, number]}
   */
  randomMaskingKeys() {
    const digits = '0123456789ABCDEF';
    const mask_keys = [];
    for (let i = 0; i < 4; i++) {
      const digit1 = digits.charAt(Math.floor(Math.random() * digits.length));
      const digit2 = digits.charAt(Math.floor(Math.random() * digits.length));
      const str = `0x${digit1}${digit2}`;
      mask_keys.push(+str);
    }
    return mask_keys;
  }


  /**
   * Masking/unmasking the payload according to https://tools.ietf.org/html/rfc6455#section-5.3
   * Every payload byte value (number) should be XOR-ed with the masking key (number).
   * As the XOR is inverse math function it can be used both for masking (on the client side) or for unmasking (on the server side).
   * inversibility: x = (x ^ y) ^ y
   *
   * PAYLOAD UNMASKING PROCESS
   * iteration        -->   0      1      2      3      4      5      6      7      8      9
   * payload_num      --> byte0  byte1  byte2  byte3  byte4  byte5  byte6  byte7  byte8  byte9
   * mask_key index   -->   0      1      2      3      0      1      2      3      0      1
   * @param {Buffer} payload_buff - payload buffer
   * @param {[number, number, number, number]} mask_keys - 4 random number
   */
  masking(payload_buff, mask_keys) {
    const payload_nums_masked = [];
    let i = 0;
    for (const payload_num of payload_buff.values()) {
      const mask_key = mask_keys[i % 4]; // get next mask key on every next iteration (0%4=0, 1%4=1, 2%4=2, 3%4=3, 4%4=0, 5%4=1, 6%4=2, 7%4=3, 8%4=0)
      const payload_num_masked = payload_num ^ mask_key; // decode every payload byte value
      payload_nums_masked.push(payload_num_masked);
      i++;
    }
    return payload_nums_masked;
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

module.exports = DataParser;
