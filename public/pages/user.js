// User profile page

export function title(params) {
  return `@${params.username} - Tree Clipper`;
}

export function template(params) {
  return `
    <a href="/" class="back-button">←</a>
    
    <div id="user-header" class="user-header">
      <h1 id="username-display" style="color: #232323;">@${escapeHtml(params.username)}</h1>
      <p id="user-meta" class="user-meta"></p>
    </div>
    
    <div id="user-stats" class="user-stats" style="display: none;">
      <span id="asset-count" class="stat-badge"></span>
    </div>
    
    <ul id="user-assets-list" class="assets-list">
      <li class="loading-item">Loading assets...</li>
    </ul>
  `;
}

export async function init(params) {
  await loadUserProfile(params.username);
}

async function loadUserProfile(username) {
  // Fetch user info
  try {
    const userRes = await fetch(`/api/users/${encodeURIComponent(username)}`);
    
    if (!userRes.ok) {
      if (userRes.status === 404) {
        showError("User not found");
        return;
      }
      throw new Error(`HTTP ${userRes.status}`);
    }
    
    const user = await userRes.json();
    
    // Update page title and header
    document.title = `@${user.username} - Tree Clipper`;
    const usernameDisplay = document.getElementById("username-display");
    if (usernameDisplay) {
      usernameDisplay.textContent = `@${user.username}`;
    }
    
    // Show member since date
    const userMeta = document.getElementById("user-meta");
    if (user.created_at && userMeta) {
      const memberSince = formatDate(user.created_at);
      userMeta.textContent = `Member since ${memberSince}`;
    }
    
  } catch (err) {
    console.error("Failed to load user:", err);
    // Still try to load assets even if user info fails
    const usernameDisplay = document.getElementById("username-display");
    if (usernameDisplay) {
      usernameDisplay.textContent = `@${username}`;
    }
  }
  
  // Fetch user's assets
  try {
    const assetsRes = await fetch(`/api/entries?author=${encodeURIComponent(username)}`);
    
    if (!assetsRes.ok) {
      throw new Error(`HTTP ${assetsRes.status}`);
    }
    
    const entries = await assetsRes.json();
    const listEl = document.getElementById("user-assets-list");
    const statsEl = document.getElementById("user-stats");
    const countEl = document.getElementById("asset-count");
    
    if (!listEl) return;
    
    if (!entries || entries.length === 0) {
      listEl.innerHTML = '<li class="empty-item">No assets yet.</li>';
      return;
    }
    
    // Show stats
    if (statsEl) statsEl.style.display = "flex";
    if (countEl) {
      const assetWord = entries.length === 1 ? 'asset' : 'assets';
      countEl.textContent = `${entries.length} ${assetWord}`;
    }
    
    listEl.innerHTML = entries.map(entry => {
      const title = entry.title || "Untitled Asset";
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
          const nodeClass = getNodeTypeClass(entry.node_type);
          tagsHtml += `<span class="asset-tag ${nodeClass}">${nodeIcon} ${escapeHtml(nodeLabel)}</span>`;
        }
        if (entry.blender_version) {
          tagsHtml += `<span class="asset-tag asset-tag--blender">Blender ${escapeHtml(entry.blender_version)}</span>`;
        }
        tagsHtml += '</div>';
      }
      
      const assetUrl = `/${encodeURIComponent(entry.author)}/${encodeURIComponent(entry.slug)}`;
      
      return `
        <li>
          <a href="${assetUrl}">
            ${imageHtml}
            <div class="asset-info">
              <span class="asset-title">${escapeHtml(title)}</span>
              <span class="asset-date">${formatDate(entry.creation_date)}</span>
              ${tagsHtml}
            </div>
          </a>
        </li>
      `;
    }).join('');
    
  } catch (err) {
    console.error("Failed to load assets:", err);
    const listEl = document.getElementById("user-assets-list");
    if (listEl) {
      listEl.innerHTML = '<li class="error-item">Failed to load assets. Please try again later.</li>';
    }
  }
}

function showError(message) {
  const usernameDisplay = document.getElementById("username-display");
  const userMeta = document.getElementById("user-meta");
  const listEl = document.getElementById("user-assets-list");
  
  if (usernameDisplay) usernameDisplay.textContent = message;
  if (userMeta) userMeta.textContent = "";
  if (listEl) listEl.innerHTML = '';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(isoString) {
  if (!isoString) return "";
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
    'geonodes': 'Geo Nodes',
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
