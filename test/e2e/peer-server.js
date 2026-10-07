// Local PeerJS signalling server for room-code tests (same software as 0.peerjs.com). Needs: npm i peer express
const http = require('http'); const express = require('express'); const { ExpressPeerServer } = require('peer');
const app = express(); const server = http.createServer(app);
app.use('/', ExpressPeerServer(server, { path: '/', key: 'peerjs', expire_timeout: 5000, alive_timeout: 60000 }));
server.listen(9000, '127.0.0.1', () => console.log('peer server on 9000'));
