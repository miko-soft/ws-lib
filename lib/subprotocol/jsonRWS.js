/**
 * Subprotocol name: jsonRWS
 * HTTP header: "Sec-WebSocket-Protocol": "jsonRWS"
 *
 * Subprotocol description:
 *  This subprotocol is created for communication between websocket server and client.
 *
 * Subprotocol definitons:
 *  a) Client have to send message in valid JSON format. Allowed fields: id, from, to, cmd, payload.
 *  b) Server have to send message in valid JSON format. Allowed fields: id, from, to, cmd, payload.
 *  c) The message is converted from string to object.
 *  d) The data type definition of the sent object: {id:string, from:string, to:string, cmd:string, payload?:any}
 */


class JsonRWS {

  constructor() {
    this.delimiter = '\u0003';  // end-of-text unicode character
  }

  /*********** INCOMING MESSAGES ***********/
  /**
   * Execute the jsonRWS subprotocol for incoming messages. Filter and map incoming messages.
   * 1. Test if the message has valid "jsonRWS" format {id:string, from:string, to:string|string[], cmd:string, payload?:any}.
   * 2. Convert the message from string to object.
   * @param {string} msgSTR -incoming message
   * @returns {{id:string, from:string, to:numstringber|string[], cmd:string, payload?:any}}
   */
  incoming(msgSTR) {
    let tf = false;
    let msg;
    try {
      msgSTR = msgSTR.replace(this.delimiter, ''); // remove delimiter
      msg = JSON.parse(msgSTR);
      const msgObjProperties = Object.keys(msg);
      tf = this._testFields(msgObjProperties);
    } catch (err) {
      tf = false;
    }

    if (tf) { return msg; }
    else { throw new Error(`Incoming message doesn\'t have valid "jsonRWS" subprotocol format. msg:: "${msgSTR}"`); }
  }



  /*********** OUTGOING MESSAGES ***********/
  /**
   * Execute the jsonRWS subprotocol for outgoing messages. Filter and map outgoing messages.
   * 1. Test if the message has valid "jsonRWS" format {id:string, from:string, to:string|string[], cmd:string, payload:any}.
   * 2. Convert the message from object to string.
   * @param {{id:string, from:string, to:string|string[], cmd:string, payload?:any}} msg - outgoing message
   * @returns {string}
   */
  outgoing(msg) {
    const msgObjProperties = Object.keys(msg);
    const tf = this._testFields(msgObjProperties);

    if (tf) {
      const msgSTR = JSON.stringify(msg) + this.delimiter;
      return msgSTR;
    } else {
      throw new Error(`Outgoing message doesn\'t have valid "jsonRWS" subprotocol format. msg:: ${JSON.stringify(msg)}`);
    }
  }



  /*********** PROCESS MESSAGES ***********/
  /**
   * Process client messages internally.
   * @param {object} msg - instruction message - {id, from, to, cmd, payload}
   * @param {Socket} socket - client which received the message
   * @param {DataTransfer} dataTransfer - instance of the DataTransfer
   * @param {SocketStorage} socketStorage - instance of the SockketStorage
   * @param {EventEmitter} eventEmitter - event emitter initiated in the RWS.js
   */
  async processing(msg, socket, dataTransfer, socketStorage, eventEmitter) {
    const id = msg.id;
    const from = msg.from;
    const to = msg.to;
    const cmd = msg.cmd;
    const payload = msg.payload;


    /*** socket commands ***/
    if (cmd === 'socket/sendone') {
      // {id: '20210129163129492000', from: '20210129163129492111', to: '20210201164339351900', cmd: 'socket/sendone', payload: 'Some message to another client'}
      const id = msg.to;
      const toSocket = await socketStorage.findOne({ id });
      await dataTransfer.sendOne(msg, toSocket);
    }

    else if (cmd === 'socket/send') {
      // {id: '20210129163129492000', from: '20210129163129492111', to: ['20210201164339351900', '210201164339351901'], cmd: 'socket/send', payload: 'Some message to another client(s)'}
      const socketIDs = to.map(socketID => socketID); // convert to numbers
      const sockets = await socketStorage.find({ id: { $in: socketIDs } });
      await dataTransfer.send(msg, sockets);
    }

    else if (cmd === 'socket/broadcast') {
      // {id: '20210129163129492000', from: '20210129163129492111', to: '0', cmd: 'socket/broadcast', payload: 'Some message to all clients except the sender'}
      await dataTransfer.broadcast(msg, socket);
    }

    else if (cmd === 'socket/sendall') {
      // {id: '20210129163129492000', from: '20210129163129492111', to: '0', cmd: 'socket/sendall', payload: 'Some message to all clients and the sender'}
      await dataTransfer.sendAll(msg);
    }

    else if (cmd === 'socket/sendserver') {
      // {id: '20210129163129492000', from: '20210129163129492111', to: '0', cmd: 'socket/sendserver', payload: 'Some message to server only'}
      await dataTransfer.catchMessage(msg);
    }

    else if (cmd === 'socket/nick') {
      // {id: '20210129163129492000', from: '20210129163129492111', to: '0', cmd: 'socket/nick', payload: 'Peter Pan'}
      const nickname = msg.payload;
      try {
        await socketStorage.setNick(socket, nickname);
        msg.payload = socket.extension.nickname;
      } catch (err) {
        msg.cmd = 'error';
        msg.payload = err.message;
      }
      socket.extension.sendSelf(msg);
    }


    /*** room commands ***/
    else if (cmd === 'room/enter') {
      // {id: '20210129163129492000', from: '20210129163129492111', to: '0', cmd: 'room/enter', payload: 'My Chat Room'}
      const roomName = payload;
      socketStorage.roomEnter(socket, roomName);
      msg.payload = `Entered in the room '${roomName}'`;
      socket.extension.sendSelf(msg);
    }

    else if (cmd === 'room/exit') {
      // {id: '20210129163129492000', from: '20210129163129492111', to: '0', cmd: 'room/exit', payload: 'My Chat Room'}
      const roomName = payload;
      socketStorage.roomExit(socket, payload);
      msg.payload = `Exited from the room '${roomName}'`;
      socket.extension.sendSelf(msg);
    }

    else if (cmd === 'room/exitall') {
      // {id: '20210129163129492000', from: '20210129163129492111', to: '0', cmd: 'room/exitall'}
      socketStorage.roomExitAll(socket);
      msg.payload = 'Exited from all rooms';
      socket.extension.sendSelf(msg);
    }

    else if (cmd === 'room/send') {
      // {id: '20210129163129492000', from: '20210129163129492111', to: 'My Chat Room', cmd: 'room/send', payload: 'Some message to room clients.'}
      const roomName = to;
      await dataTransfer.sendRoom(msg, socket, roomName);
    }


    /*** route command ***/
    else if (cmd === 'route') {
      // {id: '20210129163129492000', from: '20210129163129492111', to: '0', cmd: 'route', payload: {uri: 'shop/login', body: {username:'mark', password:'thG5$#w'}}}
      eventEmitter.emit('route', msg, socket, dataTransfer, socketStorage, eventEmitter);
    }


    /*** question commands ***/
    else if (cmd === 'question/socket/id') {
      // {id: '20210129163129492000', from: '20210129163129492111', to: '20210129163129492111', cmd: 'question/socket/id'}
      msg.payload = socket.extension.id;
      socket.extension.sendSelf(msg);
    }

    else if (cmd === 'question/socket/list') {
      // {id: '20210129163129492000', from: '20210129163129492111', to: '20210129163129492111', cmd: 'question/socket/list'}
      const sockets = await socketStorage.find();
      const socket_ids_nicks = sockets.map(socket => { return { id: socket.extension.id, nickname: socket.extension.nickname }; });
      msg.payload = socket_ids_nicks; // {id:string, nickname:string}
      socket.extension.sendSelf(msg);
    }

    else if (cmd === 'question/room/list') {
      // {id: '20210129163129492000', from: '20210129163129492111', to: '20210129163129492111', cmd: 'question/room/list'}
      const rooms = await socketStorage.roomList();
      msg.payload = rooms;
      socket.extension.sendSelf(msg);
    }

    else if (cmd === 'question/room/listmy') {
      // {id: '20210129163129492000', from: '20210129163129492111', to: '20210129163129492111', cmd: 'question/room/listmy'}
      const rooms = await socketStorage.roomListOf(msg.from);
      msg.payload = rooms;
      socket.extension.sendSelf(msg);
    }

  }



  /******* HELPERS ********/
  /**
   * Helper to test msg properties.
   * @param {string[]} msgObjProperties - properties of the "msg" object
   */
  _testFields(msgObjProperties) {
    const allowedFields = ['id', 'from', 'to', 'cmd', 'payload'];
    const requiredFields = ['id', 'from', 'to', 'cmd'];
    let tf = true;

    // check if every of the msg properties are in allowed fields
    for (const prop of msgObjProperties) {
      if (allowedFields.indexOf(prop) === -1) { tf = false; break; }
    }

    // check if every of required fields is present
    for (const requiredField of requiredFields) {
      if (msgObjProperties.indexOf(requiredField) === -1) { tf = false; break; }
    }

    return tf;
  }


}



module.exports = new JsonRWS();
