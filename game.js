const namespace = 'chatapp_1';
const peer = new Peer({
  host: '0.peerjs.com',
  port: 443,
  path: '/',
  secure: true,
  config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
});
const peerCount = document.getElementById('peerCount');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const peerIdInput = document.getElementById('peerIdInput');
const peerInfoDiv = document.getElementById('peerInfo');
const connectionStatusDiv = document.getElementById('connectionStatus');
let peers = new Set();
let messagesArray = [];
let connections = new Map();
let isInitialized = false;
let myPeerId = null;

function init() {
  peer.on('open', (id) => {
    isInitialized = true;
    myPeerId = id;
    console.log('My peer ID:', id);
    peerInfoDiv.textContent = `My peer ID: ${id} (share this with others to connect)`;
    updateUI();
  });

  peer.on('connection', (conn) => {
    console.log('Incoming connection from:', conn.peer);
    setupConnection(conn);
  });

  peer.on('error', (err) => {
    connectionStatusDiv.textContent = 'PeerJS error: ' + err.message;
    console.error('PeerJS error:', err);
  });
}

function setupConnection(conn) {
  conn.on('open', () => {
    peers.add(conn.peer);
    connections.set(conn.peer, conn);
    console.log('Connection open with:', conn.peer);
    // Send current message history to the new peer
    conn.send({ type: 'sync', messages: messagesArray });
    
    // Send init message to ensure bidirectional connection
    conn.send({ type: 'init', peerId: myPeerId });

    conn.on('data', (data) => {
      console.log('Received data from:', conn.peer, data);
      if (data.type === 'init' && data.peerId && !connections.has(data.peerId)) {
        console.log('Initiating back-connection to:', data.peerId);
        const backConn = peer.connect(data.peerId);
        backConn.on('open', () => {
          console.log('Back-connection open to:', data.peerId);
          connections.set(data.peerId, backConn);
          backConn.send({ type: 'sync', messages: messagesArray });
          updateUI();
        });
        backConn.on('error', (err) => {
          connectionStatusDiv.textContent = 'Back-connection error: ' + err.message;
          console.error('Back-connection error:', err);
        });
      } else if (data.type === 'sync' || data.type === 'message') {
        console.log('Received messages:', data.messages.length);
        // Merge incoming messages, avoiding duplicates
        data.messages.forEach((m) => {
          if (!messagesArray.some((existing) => existing.id === m.id)) {
            messagesArray.push(m);
          }
        });
        messagesArray.sort((a, b) => a.timestamp - b.timestamp);
        updateUI();
      }
    });

    conn.on('close', () => {
      console.log('Connection closed with:', conn.peer);
      peers.delete(conn.peer);
      connections.delete(conn.peer);
      updateUI();
    });

    conn.on('error', (err) => {
      connectionStatusDiv.textContent = 'Connection error: ' + err.message;
      console.error('Connection error:', err);
    });

    updateUI();
  });
}

function connectToPeer() {
  if (!isInitialized) {
    connectionStatusDiv.textContent = 'Error: Peer not initialized. Wait a moment and try again.';
    return;
  }
  const peerId = peerIdInput.value.trim();
  if (!peerId || peerId === myPeerId) {
    connectionStatusDiv.textContent = 'Error: Invalid peer ID.';
    return;
  }
  if (peers.has(peerId)) {
    connectionStatusDiv.textContent = 'Error: Already connected to this peer.';
    return;
  }
  const conn = peer.connect(peerId);
  console.log('Attempting to connect to:', peerId);
  setupConnection(conn);
  peerIdInput.value = '';
}

function sendMessage() {
  if (!isInitialized) {
    connectionStatusDiv.textContent = 'Error: Peer not initialized. Wait a moment and try again.';
    return;
  }
  const text = messageInput.value.trim();
  if (!text) {
    connectionStatusDiv.textContent = 'Error: Message cannot be empty.';
    return;
  }
  const message = {
    id: `${myPeerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    peerId: myPeerId,
    text: text,
    timestamp: Date.now(),
  };
  messagesArray.push(message);
  messagesArray.sort((a, b) => a.timestamp - b.timestamp);
  broadcastMessage({ type: 'message', messages: [message] });
  messageInput.value = '';
  updateUI();
}

function broadcastMessage(data) {
  console.log('Broadcasting message to connections:', connections.size);
  connections.forEach((conn, peerId) => {
    if (conn.open) {
      console.log('Sending to:', peerId);
      conn.send(data);
    } else {
      console.log('Connection to', peerId, 'is closed, removing');
      peers.delete(peerId);
      connections.delete(peerId);
    }
  });
  updateUI();
}

function updateUI() {
  peerCount.textContent = peers.size + (myPeerId ? 1 : 0);
  chatMessages.innerHTML = messagesArray
    .map((m) => {
      const isMyMessage = m.peerId === myPeerId;
      return `<li${isMyMessage ? ' class="my-message"' : ''}>${m.peerId}: ${m.text}</li>`;
    })
    .join('');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.sendMessage = sendMessage;
window.connectToPeer = connectToPeer;
init();