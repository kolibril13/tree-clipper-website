// Asset detail page
import { mountGraphView, unmountGraphView } from 'geonodes-web-render/embed';
import 'geonodes-web-render/dist/embed.css';

// Asset cache for prefetched data
const assetCache = new Map();

export function title(params) {
  return `Asset - Tree Clipper`;
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
      <div id="asset-meta" class="asset-meta"></div>
    </div>

    <!-- Node tree viewer comes last; breaks out wider than the page column on desktop -->
    <section id="node-tree-section" class="node-tree-section" hidden>
      <div class="node-tree-panel">
        <div class="node-tree-panel__header">
          <span class="node-tree-panel__title">
            <span class="node-tree-panel__icon">◇</span> Node Tree
          </span>
          <button id="node-tree-fullscreen" class="node-tree-fullscreen" type="button" title="Toggle fullscreen">
            <span class="node-tree-fullscreen__icon">⤢</span>
            <span class="node-tree-fullscreen__label">Fullscreen</span>
          </button>
        </div>
        <div id="node-tree-canvas" class="node-tree-canvas">
          <div class="node-tree-canvas__loading">Loading node tree…</div>
        </div>
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
      fullscreenBtn: document.getElementById("node-tree-fullscreen")
    };
  }
  return elements;
}

// Currently mounted graph payload, so we can re-mount (and re-fit) on resize /
// fullscreen toggles.
let mountedPayload = null;

function renderGraph(payload) {
  const els = getElements();
  if (!els.treeCanvas || !payload) return;
  mountedPayload = payload;
  els.treeCanvas.innerHTML = '';
  mountGraphView(els.treeCanvas, { payload });
}

function toggleFullscreen() {
  const els = getElements();
  if (!els.treeSection) return;
  const entering = !els.treeSection.classList.contains('node-tree-section--fullscreen');
  els.treeSection.classList.toggle('node-tree-section--fullscreen', entering);
  document.body.classList.toggle('node-tree-fullscreen-open', entering);
  if (els.fullscreenBtn) {
    const label = els.fullscreenBtn.querySelector('.node-tree-fullscreen__label');
    if (label) label.textContent = entering ? 'Exit' : 'Fullscreen';
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
  document.addEventListener('keydown', handleFullscreenKey);

  // Start loading asset immediately (don't await - let it render progressively)
  loadAsset(params.username, params.slug);

  // Return cleanup function
  return () => {
    if (els.fullscreenBtn) {
      els.fullscreenBtn.removeEventListener('click', toggleFullscreen);
    }
    document.removeEventListener('keydown', handleFullscreenKey);
    document.body.classList.remove('node-tree-fullscreen-open');
    if (els.treeCanvas) {
      try { unmountGraphView(els.treeCanvas); } catch (e) { /* noop */ }
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
