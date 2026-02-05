// Home page - lists all assets with pagination

export const title = 'Tree Clipper';

const PAGE_SIZE = 10;
let currentOffset = 0;
let hasMore = true;
let isLoading = false;

export function template() {
  return `
    <h1>Gallery</h1>
    
    <div class="section-header">
      <h2>Most Recent</h2>
    </div>
    
    <ul id="assets-list" class="assets-list">
      <li class="loading-item">Loading assets...</li>
    </ul>
    
    <div id="load-more-container" class="load-more-container" style="display: none;">
      <button id="load-more-btn" class="load-more-btn">Load More</button>
    </div>

    <a href="/upload-asset" class="upload-btn">+ Upload Asset</a>
    
    <footer class="site-footer">
      <a href="/terms">Terms</a> · <a href="/imprint">Imprint</a>
    </footer>
  `;
}

export async function init() {
  // Reset pagination state
  currentOffset = 0;
  hasMore = true;
  isLoading = false;
  
  await loadAssets(true);
  
  // Set up load more button
  const loadMoreBtn = document.getElementById("load-more-btn");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => loadAssets(false));
  }
}

async function loadAssets(isInitialLoad = false) {
  if (isLoading || (!isInitialLoad && !hasMore)) return;
  
  const listEl = document.getElementById("assets-list");
  const loadMoreContainer = document.getElementById("load-more-container");
  const loadMoreBtn = document.getElementById("load-more-btn");
  
  if (!listEl) return;
  
  isLoading = true;
  
  if (loadMoreBtn) {
    loadMoreBtn.textContent = "Loading...";
    loadMoreBtn.disabled = true;
  }
  
  try {
    const res = await fetch(`/api/entries?limit=${PAGE_SIZE}&offset=${currentOffset}`);
    const entries = await res.json();
    
    if (isInitialLoad) {
      if (!entries || entries.length === 0) {
        listEl.innerHTML = '<li class="empty-item">No assets yet. Be the first to upload!</li>';
        if (loadMoreContainer) loadMoreContainer.style.display = 'none';
        return;
      }
      listEl.innerHTML = '';
    }
    
    // Check if we have more items to load
    hasMore = entries.length === PAGE_SIZE;
    currentOffset += entries.length;
    
    // Render new entries
    const newItemsHtml = entries.map(entry => {
      const title = entry.title || "Untitled Asset";
      const author = entry.author || "Unknown";
      const imageUrl = entry.image_data;
      const imageHtml = imageUrl 
        ? `<img src="${escapeHtml(imageUrl)}" alt="" class="asset-thumb" loading="lazy">`
        : `<div class="asset-thumb-placeholder">📦</div>`;
      
      // Build tags HTML
      let tagsHtml = '';
      if (entry.node_type || entry.blender_version) {
        tagsHtml = '<div class="asset-tags">';
        if (entry.node_type) {
          const nodeLabel = formatNodeType(entry.node_type);
          const nodeIcon = getNodeTypeIcon(entry.node_type);
          tagsHtml += `<span class="asset-tag asset-tag--${entry.node_type}">${nodeIcon} ${nodeLabel}</span>`;
        }
        if (entry.blender_version) {
          tagsHtml += `<span class="asset-tag asset-tag--blender">Blender ${escapeHtml(entry.blender_version)}</span>`;
        }
        tagsHtml += '</div>';
      }
      
      const assetUrl = `/${encodeURIComponent(author)}/${encodeURIComponent(entry.slug)}`;
      
      return `
        <li>
          <a href="${assetUrl}">
            ${imageHtml}
            <div class="asset-info">
              <span class="asset-title">${escapeHtml(title)}</span>
              <span class="asset-author">by @${escapeHtml(author)}</span>
              ${tagsHtml}
            </div>
          </a>
        </li>
      `;
    }).join('');
    
    listEl.insertAdjacentHTML('beforeend', newItemsHtml);
    
    // Show/hide load more button
    if (loadMoreContainer) {
      loadMoreContainer.style.display = hasMore ? 'flex' : 'none';
    }
    
  } catch (err) {
    console.error("Failed to load assets:", err);
    if (isInitialLoad) {
      listEl.innerHTML = '<li class="error-item">Failed to load assets. Please try again later.</li>';
    }
  } finally {
    isLoading = false;
    if (loadMoreBtn) {
      loadMoreBtn.textContent = "Load More";
      loadMoreBtn.disabled = false;
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatNodeType(nodeType) {
  const labels = {
    'geonodes': 'Geo Nodes',
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
