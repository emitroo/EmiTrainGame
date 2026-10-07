/* Deployment settings. Empty values use the defaults built into src/net.js.
 *   broker:     WebSocket URL of a PeerJS-compatible signalling server, e.g. a self-hosted one on AWS
 *               (wss://signal.example.com/peerjs?key=peerjs). Default: the free public server 0.peerjs.com.
 *   iceServers: RTCIceServer list replacing the built-in TURN relay, e.g. your own coturn on AWS.
 *   site:       public address shown with invite links (no https://). */
window.EMT_CONFIG = { broker: '', iceServers: [], site: 'emitroo.github.io/EmiTrainGame' };
