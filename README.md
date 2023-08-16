# ws-lib
> A mutual library files for @mikosoft/ws-server and @mikosoft/ws-client-browser, @mikosoft/ws-client-nodejs, ...

## Installation
```bash
npm install --save @mikosoft/ws-lib
```

### Library parts:
- subprotocol: jsonRWS, raw
- websocket13: DataParser, handshake
- getMessageSize
- getMessageSizeFromBlob
- helper
- StringExt


### Exported object
```javascript
const wsLib = require('@mikosoft/ws-lib');

/*
wsLib:
{
  subprotocol,
  raw,
  jsonRWS,
  websocket13,
  helper,
  getMessageSize,
  getMessageSizeFromBlob,
  StringExt
}
*/
```


## Website
[http://libs.mikosoft.info/websocket/ws-lib](http://libs.mikosoft.info/websocket/ws-lib)


### Licence
Copyright (c) 2021 MikoSoft licensed under [MIT](./LICENSE) .
