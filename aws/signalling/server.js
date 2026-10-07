// Private signalling server for Emi Train Game: the same open-source PeerJS server as 0.peerjs.com.
// It only introduces phones to each other; game traffic still goes phone to phone.
// Run: npm i peer && PORT=9000 node server.js   (put it behind TLS, e.g. the Caddyfile here, so phones can use wss://)
const { PeerServer } = require('peer');
const port = +(process.env.PORT || 9000);
PeerServer({ port, path: '/peerjs', key: process.env.PEER_KEY || 'peerjs', allow_discovery: false, alive_timeout: 60000, expire_timeout: 5000 });
console.log(`signalling on :${port}/peerjs`);
