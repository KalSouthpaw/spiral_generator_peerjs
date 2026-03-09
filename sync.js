const peer = new Peer({
    config: {
        'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            // TURN Server credentials
            {
                urls: "turn:global.relay.metered.ca:80",
                username: "71d20b0ab9248c0a20ff82bc",
                credential: "OKmcN8MHkT1DhvFB",
            },
            {
                urls: "turn:global.relay.metered.ca:80?transport=tcp",
                username: "71d20b0ab9248c0a20ff82bc",
                credential: "OKmcN8MHkT1DhvFB",
            },
            {
                urls: "turn:global.relay.metered.ca:443",
                username: "71d20b0ab9248c0a20ff82bc",
                credential: "OKmcN8MHkT1DhvFB",
            },
            {
                urls: "turns:global.relay.metered.ca:443?transport=tcp",
                username: "71d20b0ab9248c0a20ff82bc",
                credential: "OKmcN8MHkT1DhvFB",
            },
        ]
    }
});
let activeConnections = [];

function initHost() {
    peer.on('open', (id) => {
        // Generate a safe URL for GitHub Pages
        let currentUrl = window.location.href.split('?')[0].split('#')[0];
        if (currentUrl.endsWith('index.html')) {
            currentUrl = currentUrl.replace('index.html', 'viewer.html');
        } else if (!currentUrl.endsWith('viewer.html')) {
            currentUrl += currentUrl.endsWith('/') ? 'viewer.html' : '/viewer.html';
        }
        const sessionUrl = `${currentUrl}?host=${id}`;
        
        // Add Host UI to Export Menu
        const exportMenu = document.getElementById('export-menu');
        if (exportMenu) {
            const div = document.createElement('div');
            div.innerHTML = `
                <br><hr><br>
                <h3>Live Session</h3>
                <button onclick="navigator.clipboard.writeText('${sessionUrl}'); this.innerText='Copied!'; setTimeout(()=>this.innerText='Copy Subject Link', 2000)">Copy Subject Link</button>
                <br><br>
                <button id="host-toggle-spiral" class="active">Subject Spiral: VISIBLE</button>
            `;
            exportMenu.appendChild(div);

            document.getElementById('host-toggle-spiral').addEventListener('click', function() {
                this.classList.toggle('active');
                this.innerText = this.classList.contains('active') ? "Subject Spiral: VISIBLE" : "Subject Spiral: HIDDEN";
                sendSyncData();
            });
        }
    });

    peer.on('connection', (conn) => {
        activeConnections.push(conn);
        conn.on('open', () => sendSyncData());
        conn.on('close', () => { activeConnections = activeConnections.filter(c => c !== conn); });
    });

    // Listen to all inputs defined in url-params.js
    setTimeout(() => {
        inputList.forEach(info => {
            let el = document.getElementById(info.inputId);
            if (el) {
                el.addEventListener('input', sendSyncData);
                el.addEventListener('change', sendSyncData);
                if (info.inputType === 'button_toggle') {
                    el.addEventListener('click', () => setTimeout(sendSyncData, 50));
                }
            }
        });
    }, 1000);
}

function sendSyncData() {
    if (activeConnections.length === 0) return;
    let state = {};
    
    // Get standard inputs
    inputList.forEach(info => {
        let el = document.getElementById(info.inputId);
        if (el) {
            state[info.inputId] = info.inputType === 'button_toggle' ? el.classList.contains('active') : el.value;
        }
    });

    // Get spiral visibility state
    const visibilityBtn = document.getElementById('host-toggle-spiral');
    state['spiral_visibility'] = visibilityBtn ? visibilityBtn.classList.contains('active') : true;

    activeConnections.forEach(conn => conn.send(state));
}

function initClient(hostId) {
    // Force hide all UI for the subject
    const style = document.createElement('style');
    style.innerHTML = '#hypnoText-controls, #tab-controls, #spiral-menu, #pend-menu, #embed-menu, #export-menu, #credits, #looping-controls, #fullscreenButton { display: none !important; } #spiralCanvas { transition: opacity 1s ease-in-out; }';
    document.head.appendChild(style);

    peer.on('open', () => {
        const conn = peer.connect(hostId);
        
        conn.on('data', (data) => {
            // 1. Handle Spiral Visibility
            if (data['spiral_visibility'] !== undefined) {
                document.getElementById('spiralCanvas').style.opacity = data['spiral_visibility'] ? '1' : '0';
            }

            // 2. Handle Inputs
            for (let key in data) {
                if (key === 'spiral_visibility') continue;
                
                let el = document.getElementById(key);
                if (el) {
                    let info = inputList.find(i => i.inputId === key);
                    if (info) {
                        if (info.inputType === 'button_toggle') {
                            let isActive = el.classList.contains('active');
                            if (data[key] !== isActive) {
                                if (data[key]) el.classList.add('active');
                                else el.classList.remove('active');
                                el.dispatchEvent(new Event('input'));
                                el.dispatchEvent(new Event('change'));
                            }
                        } else {
                            // FIX: Only dispatch events if the value actually changed!
                            if (el.value != data[key]) { 
                                el.value = data[key];
                                el.dispatchEvent(new Event('input'));
                                el.dispatchEvent(new Event('change'));
                            }
                        }
                    }
                }
            }
        });
        
        conn.on('close', () => {
            document.body.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100vh; width:100vw; background:black; color:rgba(255,255,255,0.5);"><h1>Session Ended by Hypnotist</h1></div>';
        });
    });
}

// Initialize based on URL
const urlParamsPeer = new URLSearchParams(window.location.search);
const hostIdParam = urlParamsPeer.get('host');

if (hostIdParam) {
    initClient(hostIdParam);
} else {
    // Only init host if we are on a page with the export menu (like index.html)
    if (document.getElementById('export-menu')) {
        initHost();
    }
}