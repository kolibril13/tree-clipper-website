// Asset detail page

// Asset cache for prefetched data
const assetCache = new Map();

export function title(params) {
  return `Asset - Tree Clipper`;
}

export function template(params) {
  return `
    <a href="/" class="back-button">←</a>
    <h1>
      <span id="asset-title" style="color: #232323;">&nbsp;</span>
    </h1>
    
    <div class="asset-layout">
      <div id="asset-img-container" class="asset-img-container">
        <img id="asset-img" src="" class="asset-img" decoding="async">
      </div>
      <div class="copy-asset">
        <p>Asset data:</p>
        <pre id="asset-data">Loading...</pre>
        <button id="copy-button" class="copy-button">Copy</button>
      </div>
    </div>
    
    <!-- Compatibility info section -->
    <div id="compat-info" class="asset-tags-detail" style="display: none;"></div>
    
    <div id="asset-meta" class="asset-meta"></div>
  `;
}

// Cache DOM elements for faster access
let elements = null;

function getElements() {
  if (!elements) {
    elements = {
      title: document.getElementById("asset-title"),
      data: document.getElementById("asset-data"),
      meta: document.getElementById("asset-meta"),
      compat: document.getElementById("compat-info"),
      img: document.getElementById("asset-img"),
      imgContainer: document.getElementById("asset-img-container"),
      copyBtn: document.getElementById("copy-button")
    };
  }
  return elements;
}

export function init(params) {
  // Reset element cache for new page
  elements = null;
  
  const els = getElements();
  
  // Set up copy button
  if (els.copyBtn) {
    els.copyBtn.addEventListener('click', copyAssetData);
  }
  
  // Start loading asset immediately (don't await - let it render progressively)
  loadAsset(params.username, params.slug);
  
  // Return cleanup function
  return () => {
    if (els.copyBtn) {
      els.copyBtn.removeEventListener('click', copyAssetData);
    }
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

function copyAssetData() {
  const assetData = document.getElementById('asset-data');
  const text = assetData.textContent;
  
  navigator.clipboard.writeText(text).then(() => {
    const button = document.getElementById('copy-button');
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    button.classList.add('copied');
    
    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('copied');
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
}

async function loadAsset(username, slug) {
  const els = getElements();
  
  if (!username || !slug) {
    els.title.textContent = "No Asset";
    els.data.textContent = "Please provide an asset in the URL";
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
          els.data.textContent = "The requested asset does not exist";
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
    
    // Update asset data immediately (most important for user)
    els.data.textContent = asset.asset_data || "No data available";
    
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
        compatHtml += `<span class="asset-tag asset-tag--${asset.node_type}">${nodeTypeIcon} ${nodeTypeLabel}</span>`;
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
    els.data.textContent = "Failed to load: " + err.message;
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
  const labels = {
    'geonodes': 'Geometry Nodes',
    'shader': 'Shader',
    'compositor': 'Compositor'
  };
  return labels[nodeType] || nodeType;
}

function getNodeTypeIcon(nodeType) {
  const icons = {
    'geonodes': '◇',
    'shader': '◐',
    'compositor': '▣'
  };
  return icons[nodeType] || '●';
}
