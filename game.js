const namespace = 'chatapp_1'; // Static communication object
const peer = new Peer({
  host: '0.peerjs.com', // Public signaling server for testing
  port: 443,
  path: '/',
  secure: true,
  config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } // Public STUN
});
const peerCount = document.getElementById('peerCount');
const messages = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const peerIdInput = document.getElementById('peerIdInput');
const errorDiv = document.getElementById('error');
let peers = new Set();
let messagesArray = [];
let connections = [];
let isInitialized = false;

function init() {
  peer.on('open', (id) => {
    isInitialized = true;
    console.log('My peer ID:', id);
    errorDiv.textContent = `My peer ID: ${id} (share this with others to connect)`;
    updateUI();
  });

  peer.on('connection', (conn) => {
    connections.push(conn);
    conn.on('open', () => {
      peers.add(conn.peer);
      conn.send({ type: 'messages', messages: messagesArray });
      updateUI();
    });
    conn.on('data', (data) => {
      if (data.type === 'messages') {
        data.messages.forEach((m) => {
          if (!messagesArray.some((existing) => existing.id === m.id)) {
            messagesArray.push(m);
          }
        });
        updateUI();
      }
    });
    conn.on('close', () => {
      peers.delete(conn.peer);
      connections = connections.filter((c) => c !== conn);
      updateUI();
    });
    conn.on('error', (err) => {
      errorDiv.textContent = 'Connection error: ' + err.message;
      console.error('Connection error:', err);
    });
  });

  peer.on('error', (err) => {
    errorDiv.textContent = 'PeerJS error: ' + err.message;
    console.error('PeerJS error:', err);
  });
}

function connectToPeer() {
  if (!isInitialized) {
    errorDiv.textContent = 'Error: Peer not initialized. Wait a moment and try again.';
    return;
  }
  const peerId = peerIdInput.value.trim();
  if (!peerId || peerId === peer.id || peers.has(peerId)) {
    errorDiv.textContent = 'Error: Invalid or duplicate peer ID.';
    return;
  }
  const conn = peer.connect(peerId);
  conn.on('open', () => {
    connections.push(conn);
    peers.add(peerId);
    conn.send({ type: 'messages', messages: messagesArray });
    updateUI();
  });
  conn.on('error', (err) => {
    errorDiv.textContent = 'Connection error: ' + err.message;
    console.error('Connection error:', err);
  });
  peerIdInput.value = '';
}

function sendMessage() {
  if (!isInitialized) {
    errorDiv.textContent = 'Error: Peer not initialized. Wait a moment and try again.';
    return;
  }
  const message = {
    id: `${peer.id}_${Date.now()}`,
    text: messageInput.value.trim(),
    timestamp: Date.now(),
  };
  if (!message.text) {
    errorDiv.textContent = 'Error: Message cannot be empty.';
    return;
  }
  messagesArray.push(message);
  connections.forEach((conn) => {
    if (conn.open) conn.send({ type: 'messages', messages: [message] });
  });
  messageInput.value = '';
  updateUI();
}

function updateUI() {
  peerCount.textContent = peers.size + (peer.id ? 1 : 0); // Include self
  messages.innerHTML = messagesArray
    .map((m) => `<li>${m.text} (from ${m.id.split('_')[0]})</li>`)
    .join('');
}

window.sendMessage = sendMessage; // Expose for onclick
window.connectToPeer = connectToPeer; // Expose for onclick
init();