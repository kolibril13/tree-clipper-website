// Asset detail page
import { mountGraphView, unmountGraphView } from 'geonodes-web-render/embed';
import 'geonodes-web-render/dist/embed.css';
import { supabase } from '/auth.js';

// Asset cache for prefetched data
const assetCache = new Map();

const TREECLIPPER_PREFIX = "TreeClipper::";

// Mirrors geonodes-web-render's decodeTreeClipperPayload: strip the magic
// prefix, base64-decode, gunzip if the bytes look gzipped, then UTF-8 decode.
async function decodeTreeClipperPayload(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;

  const b64 = trimmed.startsWith(TREECLIPPER_PREFIX) ? trimmed.slice(TREECLIPPER_PREFIX.length) : trimmed;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const isGzip = bytes.length >= 2 && bytes[0] === 31 && bytes[1] === 139;
  const finalBytes = isGzip
    ? new Uint8Array(await (await new Response(
        new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))
      ).blob()).arrayBuffer())
    : bytes;

  return new TextDecoder().decode(finalBytes);
}

// The root tree is whichever node tree isn't referenced as a sub-group by
// another tree (same rule geonodes-web-render uses to pick what to display).
function findRootTree(data) {
  if (!data || !Array.isArray(data.node_trees) || data.node_trees.length === 0) return null;

  const referenced = new Set();
  for (const tree of data.node_trees) {
    const items = tree?.data?.nodes?.data?.items ?? [];
    for (const node of items) {
      const groupTreeId = node?.data?.node_tree;
      if (groupTreeId != null) referenced.add(String(groupTreeId));
    }
  }

  const topLevel = data.node_trees.filter(tree => !referenced.has(String(tree.id)));
  return topLevel.find(tree => tree.data?.is_modifier) ?? topLevel[0] ?? data.node_trees[0];
}

// A socket item is a "real" exposed parameter, not the blank trailing "+"
// socket Blender adds so you can drag out a new one.
function hasSocketName(socket) {
  return !!socket?.data?.name;
}

// Builds a synthetic single-node payload representing this asset as it would
// appear collapsed into a single "Group" node if used inside another node
// tree: header = the asset's name, inputs = the root tree's Group Input
// outputs, outputs = the root tree's Group Output inputs. Reusing the actual
// socket objects (name/type/default_value/etc. straight from the export)
// means the same rendering code geonodes-web-render already uses for the
// full graph draws this preview identically - same colors, same layout.
function buildPackedNodePayload(rootTree, title) {
  const items = rootTree?.data?.nodes?.data?.items ?? [];
  const groupInputNode = items.find(node => node?.data?.bl_idname === "NodeGroupInput");
  const groupOutputNode = items.find(node => node?.data?.bl_idname === "NodeGroupOutput");

  // Group Input's outputs are what flow INTO the rest of the tree, i.e. what
  // you'd plug values into from outside - so they become this node's inputs.
  // Group Output's inputs are what the tree produces - so they become this
  // node's (single) output.
  const inputs = (groupInputNode?.data?.outputs?.data?.items ?? []).filter(hasSocketName);
  const outputs = (groupOutputNode?.data?.inputs?.data?.items ?? []).filter(hasSocketName);
  if (inputs.length === 0 && outputs.length === 0) return null;

  return JSON.stringify({
    node_trees: [{
      id: 0,
      data: {
        name: title,
        nodes: {
          data: {
            items: [{
              id: 0,
              data: {
                location: [0, 0],
                location_absolute: [0, 0],
                width: 160,
                name: title,
                label: "",
                bl_idname: "NodeGroup",
                inputs: { data: { items: inputs } },
                outputs: { data: { items: outputs } },
                parent: null
              }
            }]
          }
        },
        links: { data: { items: [] } }
      }
    }]
  });
}

async function loadPackedNodePayload(rawPayload, title) {
  try {
    const jsonText = await decodeTreeClipperPayload(rawPayload);
    const data = JSON.parse(jsonText);
    return buildPackedNodePayload(findRootTree(data), title);
  } catch (err) {
    console.error("Failed to build packed-node preview:", err);
    return null;
  }
}

export function title(params) {
  return `Asset - Tree Clipper`;
}

// Tree Clipper add-on icon, inlined so the copy button matches the one the
// embed renders (same SVG as geonodes-web-render's TreeClipperLogo).
function treeClipperLogoSvg(className) {
  return `
    <svg viewBox="0 0 256 256" class="${className}" role="img" aria-label="Tree Clipper" xmlns="http://www.w3.org/2000/svg">
      <rect width="256" height="256" rx="64" fill="#ffffff"/>
      <g transform="matrix(2.1731124,0,0,2.1731124,32.653222,9.9999992)">
        <g transform="translate(-2.9743217,-2)">
          <path fill="#ff7a00" d="M 59.9,62.1 C 59.2,57.9 55.5,55 51.4,55 c -0.5,0 -1,0 -1.5,0.1 -4.7,0.8 -7.8,5.3 -7,9.9 0.7,4.2 4.4,7.1 8.5,7.1 4.1,0 1,0 1.5,-0.1 4.7,-0.8 7.8,-5.3 7,-9.9 z"/>
          <path fill="#000099" d="M 50.4,96.4 C 52.8,90.6 54.5,83 55,75.2 c -0.5,0.1 -1,0.3 -1.5,0.4 -0.7,0.1 -1.4,0.2 -2.1,0.2 -1.7,0 -3.3,-0.3 -4.8,-1 -0.7,7.7 -2.9,14.5 -5.2,18.9 0,0 -0.1,0 -0.2,0 -9.3,0 -16.9,7.5 -16.9,16.9 H 58 c 0,-5.9 -3.1,-11.2 -7.7,-14.2 z"/>
        </g>
        <g transform="translate(-2.9743217,-2)">
          <path fill="#000099" d="m 20.1,44.4 c -0.7,-4.2 -4.4,-7.1 -8.5,-7.1 -0.6,0 -1,0 -1.5,0.1 -4.7,0.8 -7.8,5.3 -7,9.9 0.7,4.2 4.4,7.1 8.5,7.1 0.10349,0 1,0 1.5,-0.1 4.7,-0.8 7.8,-5.3 7,-9.9 z"/>
          <path fill="#000099" d="m 40.4,58.4 c -7.5,-1.4 -15,-5.3 -18.1,-8.1 -0.3,0.8 -0.7,1.5 -1.2,2.2 -0.9,1.3 -2,2.3 -3.3,3.1 3.3,3 9,6.7 14.3,8.7 2.2,0.8 4.8,1.6 7.5,2.2 0,-0.3 -0.2,-0.7 -0.2,-1 -0.4,-2.5 0,-5 1,-7.2 z"/>
        </g>
        <g transform="translate(-2.9743217,-2)">
          <path fill="#000099" d="M 52.9,12.1 C 51.9,6.2 46.7,2 40.9,2 c -0.7,0 -1.4,0 -2.1,0.2 -6.7,1.2 -11.1,7.5 -10,14.1 1,5.9 6.2,10.1 12,10.1 0.601361,0 1.4,0 2.1,-0.2 6.7,-1.2 11.1,-7.5 10,-14.1 z"/>
          <path fill="#000099" d="m 50.4,26.1 c -1.9,1.5 -4.1,2.5 -6.5,3 1.8,2.8 3.1,7.4 4.1,12.5 0.7,3.3 0.9,6.7 0.9,9.9 0.2,0 0.3,0 0.5,0 0.7,-0.1 1.4,-0.2 2.1,-0.2 v 0 c 2.1,0 4.1,0.5 5.9,1.5 0,-10.1 -2.9,-20.4 -7,-26.7 z"/>
        </g>
        <g transform="translate(-2.9743217,-2)">
          <path fill="#000099" d="m 90.6,26.7 c -0.7,-4.2 -4.400023,-7.113594 -8.5,-7.1 -0.658419,0.0022 -1,0 -1.5,0.1 -4.7,0.8 -7.8,5.3 -7,9.9 0.7,4.2 4.4,7.1 8.5,7.1 0.228046,0 1,0 1.5,-0.1 4.7,-0.8 7.8,-5.3 7,-9.9 z"/>
          <path fill="#000099" d="m 66.6,50.9 c -1.8,1.8 -3.9,3.3 -6,4.6 1.5,1.6 2.5,3.7 2.9,6 0.1,0.7 0.2,1.4 0.2,2 2.5,-1.7 5,-3.7 7.3,-5.9 5.4,-5.3 9.1,-12 10.6,-17.8 -2.5,-0.1 -4.8,-1 -6.6,-2.4 -1.1,4.6 -3.7,9 -8.4,13.5 z"/>
        </g>
      </g>
    </svg>`;
}

export function template(params) {
  return `
    <a href="/" class="back-button">←</a>
    <h1>
      <span id="asset-title">&nbsp;</span>
    </h1>

    <!-- Compatibility info section -->
    <div id="compat-info" class="asset-tags-detail" style="display: none;"></div>

    <div class="asset-layout">
      <div id="asset-img-container" class="asset-img-container">
        <img id="asset-img" src="" class="asset-img" decoding="async">
      </div>
      <!-- Borderless preview of this asset collapsed into a single "Group" node,
           as it would appear if used inside another node tree (Group Input/
           Output only). Sits inline with the image, no panel chrome. -->
      <div id="packed-node-inline" class="packed-node-inline" hidden></div>
      <div class="asset-meta-col">
        <div id="asset-meta" class="asset-meta"></div>
        <!-- Copy button lives here, outside the node-tree frame below.
             It always copies the whole tree's magic string. -->
        <button id="asset-copy-btn" class="asset-copy-btn" type="button" hidden
                title="Copy the Tree Clipper magic string — paste into Blender with the Tree Clipper add-on">
          ${treeClipperLogoSvg('asset-copy-btn__logo')}
          <svg class="asset-copy-btn__check" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="asset-copy-btn__label">Copy TreeClipper Magic String</span>
          <span class="asset-copy-btn__label-copied">Copied!</span>
        </button>
        <a id="asset-edit-link" class="asset-edit-link" href="/my-assets" hidden title="Edit this asset">✏️ Edit</a>
        <div id="asset-copy-toast" class="asset-copy-toast" role="status" hidden>
          Now, you can use this magic string in Blender with the
          <a href="https://extensions.blender.org/add-ons/tree-clipper/" target="_blank" rel="noopener noreferrer" class="asset-copy-toast__link">Tree Clipper Extension</a>
          installed.
        </div>
      </div>
    </div>

    <!-- Node tree viewer comes last; breaks out wider than the page column on desktop -->
    <section id="node-tree-section" class="node-tree-section" hidden>
      <div class="node-tree-panel">
        <div id="node-tree-canvas" class="node-tree-canvas">
          <div class="node-tree-canvas__loading">Loading node tree…</div>
        </div>
        <button id="node-tree-fullscreen" class="node-tree-fullscreen" type="button" title="Toggle fullscreen" aria-label="Toggle fullscreen" aria-pressed="false">
          <span class="node-tree-fullscreen__icon">⤢</span>
        </button>
      </div>
    </section>
  `;
}

// Cache DOM elements for faster access
let elements = null;

function getElements() {
  if (!elements) {
    elements = {
      title: document.getElementById("asset-title"),
      meta: document.getElementById("asset-meta"),
      compat: document.getElementById("compat-info"),
      img: document.getElementById("asset-img"),
      imgContainer: document.getElementById("asset-img-container"),
      treeSection: document.getElementById("node-tree-section"),
      treeCanvas: document.getElementById("node-tree-canvas"),
      fullscreenBtn: document.getElementById("node-tree-fullscreen"),
      packedNodeInline: document.getElementById("packed-node-inline"),
      copyBtn: document.getElementById("asset-copy-btn"),
      copyToast: document.getElementById("asset-copy-toast"),
      editLink: document.getElementById("asset-edit-link")
    };
  }
  return elements;
}

// Currently mounted graph payload, so we can re-mount (and re-fit) on resize /
// fullscreen toggles.
let mountedPayload = null;

// Current session/user info for ownership checks
let currentSession = null;

async function checkUserSession() {
  const { data: { session } } = await supabase.auth.getSession();
  currentSession = session;
  return session;
}

async function handleEditClick(username, slug) {
  // Store the asset info in sessionStorage so my-assets can retrieve and auto-open the modal
  sessionStorage.setItem('editAssetAuthor', username);
  sessionStorage.setItem('editAssetSlug', slug);
  // Navigate to my-assets page
  if (window.spaNavigate) {
    window.spaNavigate('/my-assets');
  } else {
    window.location.href = '/my-assets';
  }
}

function renderGraph(payload) {
  const els = getElements();
  if (!els.treeCanvas || !payload) return;
  mountedPayload = payload;
  els.treeCanvas.innerHTML = '';
  // Read-only viewer: no selection, and the page's own copy button (outside
  // the frame, under the meta card) copies the whole tree. Only in fullscreen
  // — where that button is off-screen — show the embed's overlay button.
  const isFullscreen = els.treeSection?.classList.contains('node-tree-section--fullscreen');
  mountGraphView(els.treeCanvas, { payload, showCopyButton: !!isFullscreen, allowSelection: false });
}

// Timers for the copy button's "Copied!" state and toast fade-out.
let copyResetTimer = null;
let copyFadeTimer = null;

async function copyMagicString() {
  const els = getElements();
  if (!mountedPayload || !els.copyBtn) return;
  try {
    await navigator.clipboard.writeText(mountedPayload);
  } catch (e) {
    // Clipboard can be blocked (no gesture / insecure context); ignore.
    return;
  }
  if (copyResetTimer) clearTimeout(copyResetTimer);
  if (copyFadeTimer) clearTimeout(copyFadeTimer);
  els.copyBtn.classList.add('asset-copy-btn--copied');
  if (els.copyToast) {
    els.copyToast.hidden = false;
    els.copyToast.classList.remove('asset-copy-toast--leaving');
  }
  copyResetTimer = setTimeout(() => {
    els.copyBtn.classList.remove('asset-copy-btn--copied');
    if (els.copyToast) els.copyToast.classList.add('asset-copy-toast--leaving');
    copyFadeTimer = setTimeout(() => {
      if (els.copyToast) {
        els.copyToast.hidden = true;
        els.copyToast.classList.remove('asset-copy-toast--leaving');
      }
    }, 500);
  }, 3000);
}

async function renderPackedNodePreview(rawPayload, title) {
  const els = getElements();
  if (!els.packedNodeInline) return;

  const payload = await loadPackedNodePayload(rawPayload, title);
  if (!payload) {
    els.packedNodeInline.hidden = true;
    return;
  }

  els.packedNodeInline.innerHTML = '';
  // Static preview: no copy button (nothing to copy), no selection needed.
  mountGraphView(els.packedNodeInline, { payload, showCopyButton: false, allowSelection: false });
  els.packedNodeInline.hidden = false;
}

function toggleFullscreen() {
  const els = getElements();
  if (!els.treeSection) return;
  const entering = !els.treeSection.classList.contains('node-tree-section--fullscreen');
  els.treeSection.classList.toggle('node-tree-section--fullscreen', entering);
  document.body.classList.toggle('node-tree-fullscreen-open', entering);
  if (els.fullscreenBtn) {
    els.fullscreenBtn.title = entering ? 'Exit fullscreen' : 'Toggle fullscreen';
    els.fullscreenBtn.setAttribute('aria-label', els.fullscreenBtn.title);
    els.fullscreenBtn.setAttribute('aria-pressed', entering ? 'true' : 'false');
  }
  // React Flow only auto-fits on mount, so re-mount to re-fit the new size.
  if (mountedPayload) renderGraph(mountedPayload);
}

function handleFullscreenKey(e) {
  if (e.key !== 'Escape') return;
  const els = getElements();
  if (els.treeSection && els.treeSection.classList.contains('node-tree-section--fullscreen')) {
    toggleFullscreen();
  }
}

export function init(params) {
  // Reset element cache for new page
  elements = null;

  const els = getElements();
  mountedPayload = null;

  // Set up node-tree fullscreen toggle
  if (els.fullscreenBtn) {
    els.fullscreenBtn.addEventListener('click', toggleFullscreen);
  }
  if (els.copyBtn) {
    els.copyBtn.addEventListener('click', copyMagicString);
  }
  if (els.editLink) {
    els.editLink.addEventListener('click', (e) => {
      e.preventDefault();
      handleEditClick(params.username, params.slug);
    });
  }
  document.addEventListener('keydown', handleFullscreenKey);

  // Start loading asset immediately (don't await - let it render progressively)
  loadAsset(params.username, params.slug);

  // Return cleanup function
  return () => {
    if (els.fullscreenBtn) {
      els.fullscreenBtn.removeEventListener('click', toggleFullscreen);
    }
    if (els.copyBtn) {
      els.copyBtn.removeEventListener('click', copyMagicString);
    }
    if (copyResetTimer) clearTimeout(copyResetTimer);
    if (copyFadeTimer) clearTimeout(copyFadeTimer);
    document.removeEventListener('keydown', handleFullscreenKey);
    document.body.classList.remove('node-tree-fullscreen-open');
    if (els.treeCanvas) {
      try { unmountGraphView(els.treeCanvas); } catch (e) { /* noop */ }
    }
    if (els.packedNodeInline) {
      try { unmountGraphView(els.packedNodeInline); } catch (e) { /* noop */ }
    }
    mountedPayload = null;
    elements = null;
  };
}

// Prefetch asset data (called on hover from router)
export function prefetch(username, slug) {
  const cacheKey = `${username}/${slug}`;
  if (assetCache.has(cacheKey)) return;
  
  const apiUrl = `/api/asset/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;
  
  // Start fetch and cache the promise
  const fetchPromise = fetch(apiUrl)
    .then(res => res.ok ? res.json() : null)
    .catch(() => null);
  
  assetCache.set(cacheKey, fetchPromise);
}

async function loadAsset(username, slug) {
  const els = getElements();

  if (!username || !slug) {
    els.title.textContent = "No Asset";
    return;
  }

  const cacheKey = `${username}/${slug}`;
  const apiUrl = `/api/asset/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;

  // Check user session for edit button visibility
  await checkUserSession();

  try {
    // Check cache first (from prefetch), otherwise fetch
    let asset;
    if (assetCache.has(cacheKey)) {
      asset = await assetCache.get(cacheKey);
      assetCache.delete(cacheKey); // Clear after use
      if (!asset) throw new Error("Prefetch failed");
    } else {
      const res = await fetch(apiUrl);

      if (!res.ok) {
        if (res.status === 404) {
          els.title.textContent = "Asset Not Found";
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      asset = await res.json();
    }

    // Check if current user is the owner - show edit button if so
    if (currentSession && asset.author) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('username')
        .eq('id', currentSession.user.id)
        .single();

      if (userProfile?.username === asset.author && els.editLink) {
        els.editLink.hidden = false;
      }
    }
    
    // Batch DOM updates for better performance
    // Update page title
    document.title = `${asset.title || "Asset"} - Tree Clipper`;
    
    // Update title
    els.title.textContent = asset.title || "Untitled Asset";

    // Render the interactive node tree from the payload. The component handles
    // both "TreeClipper::" payloads and raw JSON, and shows its own decode
    // error if the data is unreadable.
    if (asset.asset_data && els.treeSection) {
      els.treeSection.hidden = false;
      renderGraph(asset.asset_data);
      renderPackedNodePreview(asset.asset_data, asset.title || "Untitled Asset");
      if (els.copyBtn) els.copyBtn.hidden = false;
    }
    
    // Update meta info (author, description, dates)
    const author = asset.author || "Unknown";
    const description = asset.description || "";
    const authorUrl = `/${encodeURIComponent(author)}`;
    
    // Format dates
    const createdDate = asset.creation_date ? formatDate(asset.creation_date) : null;
    const updatedDate = asset.last_update ? formatDate(asset.last_update) : null;
    
    let metaHtml = `by <a href="${authorUrl}" class="author-link"><strong>@${escapeHtml(author)}</strong></a>`;
    if (description) metaHtml += `<br><span class="asset-description">${escapeHtml(description)}</span>`;
    if (createdDate) {
      metaHtml += `<br><span class="date-info">Created: ${createdDate}`;
      if (updatedDate && updatedDate !== createdDate) {
        metaHtml += ` · Updated: ${updatedDate}`;
      }
      metaHtml += `</span>`;
    }
    els.meta.innerHTML = metaHtml;
    
    // Update compatibility info (node type, Blender version, TreeClipper version)
    const hasCompatInfo = asset.node_type || asset.blender_version || asset.treeclipper_version;
    
    if (hasCompatInfo) {
      let compatHtml = '';
      
      if (asset.node_type) {
        const nodeTypeLabel = formatNodeType(asset.node_type);
        const nodeTypeIcon = getNodeTypeIcon(asset.node_type);
        const nodeTypeClass = getNodeTypeClass(asset.node_type);
        compatHtml += `<span class="asset-tag ${nodeTypeClass}">${nodeTypeIcon} ${escapeHtml(nodeTypeLabel)}</span>`;
      }
      
      if (asset.blender_version) {
        compatHtml += `<span class="asset-tag asset-tag--blender">Blender ${escapeHtml(asset.blender_version)}</span>`;
      }
      
      if (asset.treeclipper_version) {
        compatHtml += `<span class="asset-tag asset-tag--treeclipper">TreeClipper ${escapeHtml(asset.treeclipper_version)}</span>`;
      }
      
      els.compat.innerHTML = compatHtml;
      els.compat.style.display = 'flex';
    }
    
    // Update image if available
    const imageUrl = asset.image_data;
    
    if (imageUrl) {
      // Set src directly and let browser handle loading with decoding="async"
      els.img.onload = () => els.imgContainer.classList.add("loaded");
      els.img.onerror = () => els.imgContainer.classList.add("hidden");
      els.img.src = imageUrl;
    } else {
      // No image for this asset - hide the container
      els.imgContainer.classList.add("hidden");
    }
  } catch (err) {
    console.error("Failed to load asset:", err);
    els.title.textContent = "Error";
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatNodeType(nodeType) {
  const normalized = typeof nodeType === "string" ? nodeType.toLowerCase() : "";
  const labels = {
    'geonodes': 'Geometry Nodes',
    'shader': 'Shader',
    'compositor': 'Compositor'
  };
  return labels[normalized] || 'Unknown';
}

function getNodeTypeIcon(nodeType) {
  const normalized = typeof nodeType === "string" ? nodeType.toLowerCase() : "";
  const icons = {
    'geonodes': '◇',
    'shader': '◐',
    'compositor': '▣'
  };
  return icons[normalized] || '●';
}

function getNodeTypeClass(nodeType) {
  const normalized = typeof nodeType === "string" ? nodeType.toLowerCase() : "";
  const classes = {
    'geonodes': 'asset-tag--geonodes',
    'shader': 'asset-tag--shader',
    'compositor': 'asset-tag--compositor'
  };
  return classes[normalized] || 'asset-tag--unknown';
}
