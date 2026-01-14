// --- Pure JS, no external libraries required! ---
// Helper: Base64 decode to Uint8Array (browser, no atob)
function base64ToUint8Array(b64) {
    // Remove whitespace
    b64 = b64.replace(/\s/g, '');
    // modern browsers: atob
    const binaryString = atob(b64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Gzip (RFC 1952) decompress using DecompressionStream (Chrome, Edge, Firefox 117+)
async function ungzip(bytes) {
    if (typeof DecompressionStream === "undefined") {
        throw new Error("This browser does not support DecompressionStream (required for gzip decompression). Try Chromium/Edge/Firefox 117+.");
    }
    const cs = new DecompressionStream('gzip');
    const blob = new Blob([bytes]);
    const decompressedStream = blob.stream().pipeThrough(cs);
    const decompressed = await new Response(decompressedStream).arrayBuffer();
    // Decode ArrayBuffer → string
    const dec = new TextDecoder();
    return dec.decode(decompressed);
}

function getTreeClipperData() {
    const el = document.getElementById('asset-data');
    let raw = el.textContent.trim();
    if (!raw.startsWith('TreeClipper::')) return null;
    let arr = raw.split('::');
    if (arr.length !== 2) return null;
    return arr[1];
}

// Returns the unique node names used in the object (across all node_trees)
function getNodeNames(data) {
    const names = [];

    const trees = Array.isArray(data?.node_trees) ? data.node_trees : [];
    for (const tree of trees) {
        const items = tree?.data?.nodes?.data?.items;
        if (!Array.isArray(items)) continue;

        for (const node of items) {
            const name = node?.data?.name;
            if (typeof name === "string" && name.trim()) names.push(name.trim());
        }
    }

    return [...new Set(names)];
}

// Async show function due to ungzip
async function showDecodedAsset() {
    const b64 = getTreeClipperData();
    const statsEl = document.getElementById('node-stats');
    const decodedEl = document.getElementById('decoded-asset');
    
    if (!b64) {
        if (decodedEl) decodedEl.textContent = "Could not find TreeClipper asset data.";
        if (statsEl) statsEl.innerHTML = "<p>Could not find TreeClipper asset data.</p>";
        return;
    }
    try {
        const bytes = base64ToUint8Array(b64);
        const json = await ungzip(bytes);
        const obj = JSON.parse(json);
        
        // Display node stats
        const nodeNames = getNodeNames(obj);
        if (statsEl) {
            if (nodeNames.length === 0) {
                statsEl.innerHTML = `
                    <p><strong>Node Statistics:</strong></p>
                    <p>No nodes found in the asset data.</p>
                `;
            } else {
                statsEl.innerHTML = `
                    <p><strong>Node Statistics:</strong></p>
                    <p>Total unique nodes: <strong>${nodeNames.length}</strong></p>
                    <p>Nodes used:</p>
                    <ul style="margin-top: 0.5em; padding-left: 1.5em;">
                        ${nodeNames.map(name => `<li>${name}</li>`).join('')}
                    </ul>
                `;
            }
        }
        
        if (decodedEl) decodedEl.textContent = JSON.stringify(obj, null, 2);
    } catch (e) {
        if (decodedEl) decodedEl.textContent = "Failed to decode asset: " + e;
        if (statsEl) statsEl.innerHTML = `<p>Failed to load node statistics: ${e}</p>`;
    }
}
// Load and then decode (async/await version)
window.addEventListener('DOMContentLoaded', function() {
    showDecodedAsset();
});
