import * as createLibp2pApp from 'https://cdn.jsdelivr.net/npm/create-libp2p-app@1.1.0/+esm';
import { kadDHT } from 'https://cdn.jsdelivr.net/npm/@libp2p/kad-dht@10.0.0/dist/index.min.js';

// Initialize libp2p node
async function initGame() {
  // Check if modules loaded
  const { createLibp2p, webSockets } = createLibp2pApp;
  if (!createLibp2p || !webSockets) {
    const errorMsg = 'Failed to load libp2p or webSockets from create-libp2p-app';
    console.error(errorMsg);
    document.getElementById('errorStatus').textContent = errorMsg;
    return;
  }
  if (!kadDHT) {
    const errorMsg = 'Failed to load kadDHT from @libp2p/kad-dht';
    console.error(errorMsg);
    document.getElementById('errorStatus').textContent = errorMsg;
    return;
  }

  // Load cached peers from localStorage
  const cachedPeers = JSON.parse(localStorage.getItem('knownPeers') || '[]');

  try {
    const libp2p = await createLibp2p({
      transports: [webSockets()],
      peerDiscovery: [kadDHT()],
      dht: kadDHT(),
      // Use cached peers and fallback to public bootstrap
      peerDiscovery: [
        ...cachedPeers.map(peer => ({ addresses: peer.multiaddrs, id: peer.peerId })),
        {
          addresses: ['/dns4/bootstrap.libp2p.io/tcp/443/wss/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN'],
          id: 'QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
        },
      ],
    });

    await libp2p.start();
    const myPeerId = libp2p.peerId.toString();
    console.log('libp2p started with ID:', myPeerId);
    document.getElementById('peerList').innerHTML = `<li>My Peer ID: ${myPeerId}</li>`;
    document.getElementById('errorStatus').textContent = '';

    // Namespace for peer discovery
    const namespaceKey = '/techno-dungeon-multiverse/2025-07-20';

    // Advertise availability
    async function advertiseAvailability() {
      const peerData = {
        peerId: myPeerId,
        multiaddrs: libp2p.multiaddrs.map(addr => addr.toString()),
        timestamp: Date.now(),
      };
      try {
        await libp2p.contentRouting.put(`${namespaceKey}/${myPeerId}`, JSON.stringify(peerData));
        console.log('Advertised availability in DHT');
        // Advertise as bootstrap candidate
        await libp2p.contentRouting.put('/techno-dungeon-bootstrap', JSON.stringify(peerData));
        console.log('Advertised as bootstrap candidate');
      } catch (e) {
        console.error('Error advertising in DHT:', e);
        document.getElementById('errorStatus').textContent = `Error advertising: ${e.message}`;
      }
    }

    // Initial advertisement
    await advertiseAvailability();
    // Re-advertise every minute
    setInterval(advertiseAvailability, 60000);

    // Query for peers
    async function queryPeers() {
      const peers = [];
      try {
        // Query game namespace
        for await (const provider of libp2p.contentRouting.findProviders(namespaceKey)) {
          try {
            const value = await libp2p.contentRouting.get(provider.key);
            const peerData = JSON.parse(value.toString());
            // Filter out stale entries (older than 5 minutes)
            if (Date.now() - peerData.timestamp < 5 * 60 * 1000) {
              peers.push(peerData);
            }
          } catch (e) {
            console.error('Error retrieving peer data:', e);
          }
        }

        // Query bootstrap namespace
        for await (const provider of libp2p.contentRouting.findProviders('/techno-dungeon-bootstrap')) {
          try {
            const value = await libp2p.contentRouting.get(provider.key);
            const peerData = JSON.parse(value.toString());
            if (Date.now() - peerData.timestamp < 5 * 60 * 1000 && peerData.peerId !== myPeerId) {
              peers.push(peerData);
            }
          } catch (e) {
            console.error('Error retrieving bootstrap peer:', e);
          }
        }

        // Cache peers (limit to 20)
        localStorage.setItem('knownPeers', JSON.stringify(peers.slice(0, 20)));

        // Update UI
        const peerList = document.getElementById('peerList');
        peerList.innerHTML = `<li>My Peer ID: ${myPeerId}</li>`;
        peers.forEach(peer => {
          peerList.innerHTML += `<li>Peer: ${peer.peerId} (Last seen: ${new Date(peer.timestamp).toLocaleTimeString()})</li>`;
        });
        console.log('Found peers:', peers);
        document.getElementById('errorStatus').textContent = '';
      } catch (e) {
        console.error('Error querying DHT:', e);
        document.getElementById('errorStatus').textContent = `Error querying DHT: ${e.message}`;
      }
    }

    // Query peers every 15 seconds
    setInterval(queryPeers, 15000);
    await queryPeers();
  } catch (e) {
    console.error('Error initializing libp2p:', e);
    document.getElementById('errorStatus').textContent = `Initialization error: ${e.message}`;
  }
}

// Start game
initGame().catch(e => {
  console.error('Error initializing game:', e);
  document.getElementById('errorStatus').textContent = `Initialization error: ${e.message}`;
});