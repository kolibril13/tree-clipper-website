// My Assets page
import { supabase, ensureUsername } from '/auth.js';

export const title = 'My Assets – Tree Clipper';

export function template() {
  return `
    <a href="/" class="back-button">←</a>

    <h1>My Assets</h1>

    <div id="login-prompt" class="login-prompt">
      <p>Please log in to view your assets.</p>
    </div>

    <div id="page-content" style="display: none;">
      <nav class="nav-links">
        <a href="/my-assets" class="active">My Assets</a>
        <a href="/settings">Settings</a>
      </nav>

      <ul id="my-assets-list" class="assets-list my-assets-list">
        <li class="loading-item">Loading your assets...</li>
      </ul>

      <a href="/upload-asset" class="upload-btn">+ Upload New Asset</a>
    </div>

    <!-- Edit Modal -->
    <div id="edit-modal" class="modal-overlay" style="display: none;">
      <div class="modal-content">
        <button class="modal-close" id="modal-close">×</button>
        <h2>Edit Asset</h2>
        
        <form id="edit-form" class="asset-form">
          <input type="hidden" id="edit-author" />
          <input type="hidden" id="edit-slug" />
          
          <div class="form-group">
            <label>Title</label>
            <input type="text" id="edit-title" disabled style="background: #f3f4f6; cursor: not-allowed;" />
            <small style="color: #6b7280; font-size: 0.85em;">Title cannot be changed (used in URL)</small>
          </div>

          <div class="form-group">
            <label for="edit-description">Description</label>
            <textarea id="edit-description" rows="3" placeholder="Brief description"></textarea>
          </div>

          <div class="form-group">
            <label for="edit-asset-data">Asset Data *</label>
            <textarea id="edit-asset-data" rows="4" required placeholder="TreeClipper::H4sIALGFY2kC/+1aW2/iOBT..."></textarea>
          </div>

          <div id="edit-asset-meta" class="asset-meta" style="display: none;">
            <div class="meta-row">
              <span class="meta-label">Type</span>
              <span id="edit-meta-node-type" class="meta-value"></span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Blender</span>
              <span id="edit-meta-blender-version" class="meta-value"></span>
            </div>
            <div class="meta-row">
              <span class="meta-label">TreeClipper</span>
              <span id="edit-meta-treeclipper-version" class="meta-value"></span>
            </div>
          </div>

          <div class="form-group">
            <label>Preview Image</label>
            <div class="current-image-preview" id="current-image-container">
              <img id="current-image" src="" alt="Current preview" />
              <button type="button" id="remove-current-image" class="remove-image-btn">Remove Image</button>
            </div>
            <div class="image-dropzone" id="edit-image-dropzone">
              <input type="file" id="edit-image-input" accept="image/*" hidden />
              <div class="dropzone-content">
                <span class="dropzone-icon">📷</span>
                <span class="dropzone-text">Click, drag, or paste a new image</span>
              </div>
              <img id="edit-image-preview" class="image-preview" alt="Preview" />
              <button type="button" id="edit-remove-image" class="remove-image">×</button>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" id="cancel-edit" class="btn-secondary">Cancel</button>
            <button type="submit" class="btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div id="delete-modal" class="modal-overlay" style="display: none;">
      <div class="modal-content modal-small">
        <h2>Delete Asset?</h2>
        <p id="delete-asset-name" class="delete-warning"></p>
        <p class="delete-warning-sub">This action cannot be undone.</p>
        <div class="modal-actions">
          <button type="button" id="cancel-delete" class="btn-secondary">Cancel</button>
          <button type="button" id="confirm-delete" class="btn-danger">Delete</button>
        </div>
      </div>
    </div>

    <div id="output" class="status-message">
      <span class="status-icon"></span>
      <span class="status-text"></span>
    </div>

    <!-- Image Cropper Modal -->
    <div id="cropper-modal" class="cropper-overlay" style="display: none;">
      <div class="cropper-modal">
        <div class="cropper-header">
          <div>
            <h3>Crop Thumbnail</h3>
            <p>Drag to move, drag corners to resize. Thumbnail will be square.</p>
          </div>
        </div>
        <div class="cropper-container" id="cropper-container">
          <img id="cropper-image" class="cropper-image" alt="Crop preview" />
          <div class="crop-area" id="crop-area">
            <div class="crop-handle crop-handle--nw" data-handle="nw"></div>
            <div class="crop-handle crop-handle--ne" data-handle="ne"></div>
            <div class="crop-handle crop-handle--sw" data-handle="sw"></div>
            <div class="crop-handle crop-handle--se" data-handle="se"></div>
          </div>
          <div class="crop-size-indicator" id="crop-size-indicator"></div>
        </div>
        <div class="cropper-actions">
          <button type="button" class="btn-cancel-crop" id="cancel-crop">Cancel</button>
          <button type="button" class="btn-crop" id="confirm-crop">Crop & Use</button>
        </div>
      </div>
    </div>
  `;
}

let currentSession = null;
let statusTimeout;
let selectedNewImage = null;
let currentImageUrl = null;
let parsedAssetMeta = null;
let deleteAuthor = null;
let deleteSlug = null;
let pendingImageFile = null;

let cropState = {
  imageWidth: 0,
  imageHeight: 0,
  containerWidth: 0,
  containerHeight: 0,
  offsetX: 0,
  offsetY: 0,
  cropX: 0,
  cropY: 0,
  cropSize: 100,
  dragging: false,
  resizing: false,
  resizeHandle: null,
  startX: 0,
  startY: 0,
  startCropX: 0,
  startCropY: 0,
  startCropSize: 0
};

let handlers = {};

export async function init() {
  // Ensure user has a username - if this returns false, user was redirected
  const hasUsername = await ensureUsername();
  if (!hasUsername) {
    // User was redirected to claim-username page, stop initialization
    return;
  }
  
  const loginPrompt = document.getElementById("login-prompt");
  const pageContent = document.getElementById("page-content");
  
  // Auth state handlers
  function updateAuthUI(user) {
    if (user) {
      loginPrompt.style.display = "none";
      pageContent.style.display = "";
      loadMyAssets();
    } else {
      loginPrompt.style.display = "";
      pageContent.style.display = "none";
    }
  }
  
  const { data: { session } } = await supabase.auth.getSession();
  currentSession = session;
  updateAuthUI(session?.user ?? null);
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    currentSession = session;
    updateAuthUI(session?.user ?? null);
  });
  
  // Set up event listeners
  setupEventListeners();
  
  // Return cleanup function
  return () => {
    subscription.unsubscribe();
    clearTimeout(statusTimeout);
    cleanupEventListeners();
  };
}

function setupEventListeners() {
  const editModal = document.getElementById("edit-modal");
  const editForm = document.getElementById("edit-form");
  const editAssetData = document.getElementById("edit-asset-data");
  const editImageDropzone = document.getElementById("edit-image-dropzone");
  const editImageInput = document.getElementById("edit-image-input");
  const editRemoveImage = document.getElementById("edit-remove-image");
  const removeCurrentImageBtn = document.getElementById("remove-current-image");
  const deleteModal = document.getElementById("delete-modal");
  const cropArea = document.getElementById("crop-area");
  
  handlers.modalClose = () => closeEditModal();
  handlers.cancelEdit = () => closeEditModal();
  handlers.modalOverlayClick = (e) => { if (e.target === editModal) closeEditModal(); };
  handlers.assetDataInput = () => updateEditAssetMeta();
  handlers.formSubmit = handleEditSubmit;
  
  handlers.removeCurrentImage = handleRemoveCurrentImage;
  handlers.dropzoneClick = () => editImageInput.click();
  handlers.dropzoneDragover = (e) => { e.preventDefault(); editImageDropzone.classList.add("dragover"); };
  handlers.dropzoneDragleave = () => editImageDropzone.classList.remove("dragover");
  handlers.dropzoneDrop = (e) => {
    e.preventDefault();
    editImageDropzone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) openCropper(file);
  };
  handlers.imageInputChange = (e) => {
    const file = e.target.files[0];
    if (file) openCropper(file);
  };
  handlers.removeNewImage = (e) => {
    e.stopPropagation();
    selectedNewImage = null;
    editImageInput.value = "";
    document.getElementById("edit-image-preview").src = "";
    editImageDropzone.classList.remove("has-image");
    if (currentImageUrl) {
      document.getElementById("current-image-container").style.display = "block";
    }
  };
  
  handlers.cancelDelete = () => closeDeleteModal();
  handlers.deleteModalClick = (e) => { if (e.target === deleteModal) closeDeleteModal(); };
  handlers.confirmDelete = handleConfirmDelete;
  
  handlers.cropStart = handleCropStart;
  handlers.cropMove = handleCropMove;
  handlers.cropEnd = handleCropEnd;
  handlers.cancelCrop = closeCropper;
  handlers.confirmCrop = handleConfirmCrop;
  
  handlers.keydown = (e) => {
    if (e.key === "Escape") {
      const cropperModal = document.getElementById("cropper-modal");
      if (cropperModal.style.display === "flex") {
        closeCropper();
      } else if (editModal.style.display === "flex") {
        closeEditModal();
      } else if (deleteModal.style.display === "flex") {
        closeDeleteModal();
      }
    }
  };
  
  handlers.paste = (e) => {
    const editModal = document.getElementById("edit-modal");
    const cropperModal = document.getElementById("cropper-modal");
    if (editModal.style.display !== "flex") return;
    if (cropperModal.style.display === "flex") return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) openCropper(file);
        break;
      }
    }
  };
  
  document.getElementById("modal-close").addEventListener("click", handlers.modalClose);
  document.getElementById("cancel-edit").addEventListener("click", handlers.cancelEdit);
  editModal.addEventListener("click", handlers.modalOverlayClick);
  editAssetData.addEventListener("input", handlers.assetDataInput);
  editForm.addEventListener("submit", handlers.formSubmit);
  
  removeCurrentImageBtn.addEventListener("click", handlers.removeCurrentImage);
  editImageDropzone.addEventListener("click", handlers.dropzoneClick);
  editImageDropzone.addEventListener("dragover", handlers.dropzoneDragover);
  editImageDropzone.addEventListener("dragleave", handlers.dropzoneDragleave);
  editImageDropzone.addEventListener("drop", handlers.dropzoneDrop);
  editImageInput.addEventListener("change", handlers.imageInputChange);
  editRemoveImage.addEventListener("click", handlers.removeNewImage);
  
  document.getElementById("cancel-delete").addEventListener("click", handlers.cancelDelete);
  deleteModal.addEventListener("click", handlers.deleteModalClick);
  document.getElementById("confirm-delete").addEventListener("click", handlers.confirmDelete);
  
  cropArea.addEventListener("mousedown", handlers.cropStart);
  cropArea.addEventListener("touchstart", handlers.cropStart, { passive: false });
  document.addEventListener("mousemove", handlers.cropMove);
  document.addEventListener("touchmove", handlers.cropMove, { passive: false });
  document.addEventListener("mouseup", handlers.cropEnd);
  document.addEventListener("touchend", handlers.cropEnd);
  document.getElementById("cancel-crop").addEventListener("click", handlers.cancelCrop);
  document.getElementById("confirm-crop").addEventListener("click", handlers.confirmCrop);
  
  document.addEventListener("keydown", handlers.keydown);
  document.addEventListener("paste", handlers.paste);
}

function cleanupEventListeners() {
  const editModal = document.getElementById("edit-modal");
  const editAssetData = document.getElementById("edit-asset-data");
  const editImageDropzone = document.getElementById("edit-image-dropzone");
  const editImageInput = document.getElementById("edit-image-input");
  const editRemoveImage = document.getElementById("edit-remove-image");
  const removeCurrentImageBtn = document.getElementById("remove-current-image");
  const deleteModal = document.getElementById("delete-modal");
  const cropArea = document.getElementById("crop-area");
  
  document.getElementById("modal-close")?.removeEventListener("click", handlers.modalClose);
  document.getElementById("cancel-edit")?.removeEventListener("click", handlers.cancelEdit);
  editModal?.removeEventListener("click", handlers.modalOverlayClick);
  editAssetData?.removeEventListener("input", handlers.assetDataInput);
  document.getElementById("edit-form")?.removeEventListener("submit", handlers.formSubmit);
  
  removeCurrentImageBtn?.removeEventListener("click", handlers.removeCurrentImage);
  editImageDropzone?.removeEventListener("click", handlers.dropzoneClick);
  editImageDropzone?.removeEventListener("dragover", handlers.dropzoneDragover);
  editImageDropzone?.removeEventListener("dragleave", handlers.dropzoneDragleave);
  editImageDropzone?.removeEventListener("drop", handlers.dropzoneDrop);
  editImageInput?.removeEventListener("change", handlers.imageInputChange);
  editRemoveImage?.removeEventListener("click", handlers.removeNewImage);
  
  document.getElementById("cancel-delete")?.removeEventListener("click", handlers.cancelDelete);
  deleteModal?.removeEventListener("click", handlers.deleteModalClick);
  document.getElementById("confirm-delete")?.removeEventListener("click", handlers.confirmDelete);
  
  cropArea?.removeEventListener("mousedown", handlers.cropStart);
  cropArea?.removeEventListener("touchstart", handlers.cropStart);
  document.removeEventListener("mousemove", handlers.cropMove);
  document.removeEventListener("touchmove", handlers.cropMove);
  document.removeEventListener("mouseup", handlers.cropEnd);
  document.removeEventListener("touchend", handlers.cropEnd);
  document.getElementById("cancel-crop")?.removeEventListener("click", handlers.cancelCrop);
  document.getElementById("confirm-crop")?.removeEventListener("click", handlers.confirmCrop);
  
  document.removeEventListener("keydown", handlers.keydown);
  document.removeEventListener("paste", handlers.paste);
}

async function loadMyAssets() {
  if (!currentSession) return;

  const assetsList = document.getElementById("my-assets-list");
  assetsList.innerHTML = '<li class="loading-item">Loading your assets...</li>';

  try {
    const res = await fetch("/api/entries?mine=true", {
      headers: {
        "Authorization": `Bearer ${currentSession.access_token}`
      }
    });

    if (!res.ok) throw new Error("Failed to fetch");

    const entries = await res.json();

    if (!entries || entries.length === 0) {
      assetsList.innerHTML = '<li class="empty-item">You haven\'t uploaded any assets yet.</li>';
      return;
    }

    assetsList.innerHTML = entries.map(entry => {
      const title = entry.title || "Untitled Asset";
      const imageUrl = entry.image_data;
      const imageHtml = imageUrl 
        ? `<img src="${escapeHtml(imageUrl)}" alt="" class="asset-thumb" loading="lazy">`
        : `<div class="asset-thumb-placeholder">📦</div>`;
      
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
        <li data-slug="${escapeHtml(entry.slug || '')}" data-author="${escapeHtml(entry.author || '')}">
          <div class="my-assets-row">
            <a href="${assetUrl}" class="asset-link">
              ${imageHtml}
              <div class="asset-info">
                <span class="asset-title">${escapeHtml(title)}</span>
                <span class="asset-date">${formatDate(entry.creation_date)}</span>
                ${tagsHtml}
              </div>
            </a>
            <div class="asset-actions">
              <button class="btn-edit" data-author="${escapeHtml(entry.author || '')}" data-slug="${escapeHtml(entry.slug || '')}" title="Edit">✏️</button>
              <button class="btn-delete" data-author="${escapeHtml(entry.author || '')}" data-slug="${escapeHtml(entry.slug || '')}" data-title="${escapeHtml(title)}" title="Delete">🗑️</button>
            </div>
          </div>
        </li>
      `;
    }).join('');

    // Attach event listeners
    assetsList.querySelectorAll(".btn-edit").forEach(btn => {
      btn.addEventListener("click", () => openEditModal(btn.dataset.author, btn.dataset.slug));
    });

    assetsList.querySelectorAll(".btn-delete").forEach(btn => {
      btn.addEventListener("click", () => openDeleteModal(btn.dataset.author, btn.dataset.slug, btn.dataset.title));
    });

  } catch (err) {
    console.error("Failed to load assets:", err);
    assetsList.innerHTML = '<li class="error-item">Failed to load your assets. Please try again.</li>';
  }
}

async function openEditModal(author, slug) {
  try {
    const res = await fetch(`/api/asset/${encodeURIComponent(author)}/${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error("Asset not found");
    
    const asset = await res.json();
    
    document.getElementById("edit-author").value = asset.author;
    document.getElementById("edit-slug").value = asset.slug;
    document.getElementById("edit-title").value = asset.title || "";
    document.getElementById("edit-description").value = asset.description || "";
    document.getElementById("edit-asset-data").value = asset.asset_data || "";
    
    currentImageUrl = asset.image_data;
    selectedNewImage = null;
    
    const currentImageContainer = document.getElementById("current-image-container");
    const currentImage = document.getElementById("current-image");
    
    if (currentImageUrl) {
      currentImage.src = currentImageUrl;
      currentImageContainer.style.display = "block";
    } else {
      currentImageContainer.style.display = "none";
    }
    
    document.getElementById("edit-image-preview").src = "";
    document.getElementById("edit-image-dropzone").classList.remove("has-image");
    document.getElementById("edit-image-input").value = "";
    
    await updateEditAssetMeta();
    
    document.getElementById("edit-modal").style.display = "flex";
  } catch (err) {
    showStatus("error", "Failed to load asset details");
  }
}

function closeEditModal() {
  document.getElementById("edit-modal").style.display = "none";
  document.getElementById("edit-form").reset();
  selectedNewImage = null;
  parsedAssetMeta = null;
  document.getElementById("edit-asset-meta").style.display = "none";
}

function openDeleteModal(author, slug, title) {
  deleteAuthor = author;
  deleteSlug = slug;
  document.getElementById("delete-asset-name").textContent = `"${title}"`;
  document.getElementById("delete-modal").style.display = "flex";
}

function closeDeleteModal() {
  document.getElementById("delete-modal").style.display = "none";
  deleteAuthor = null;
  deleteSlug = null;
}

async function handleRemoveCurrentImage() {
  if (!currentSession || !currentImageUrl) return;

  const author = document.getElementById("edit-author").value;
  const slug = document.getElementById("edit-slug").value;
  const btn = document.getElementById("remove-current-image");
  btn.disabled = true;
  btn.textContent = "Removing...";

  try {
    const res = await fetch(`/api/entries?author=${encodeURIComponent(author)}&slug=${encodeURIComponent(slug)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentSession.access_token}`
      },
      body: JSON.stringify({ imageData: null })
    });

    if (res.ok) {
      currentImageUrl = null;
      document.getElementById("current-image-container").style.display = "none";
      showStatus("success", "Image removed");
    } else {
      showStatus("error", "Failed to remove image");
    }
  } catch (err) {
    showStatus("error", "Failed to remove image");
  } finally {
    btn.disabled = false;
    btn.textContent = "Remove Image";
  }
}

async function handleEditSubmit(e) {
  e.preventDefault();

  if (!currentSession) {
    showStatus("error", "Please log in to edit assets");
    return;
  }

  const author = document.getElementById("edit-author").value;
  const slug = document.getElementById("edit-slug").value;
  let imageUrl = undefined;

  if (selectedNewImage) {
    const profileRes = await fetch("/api/users/me", {
      headers: { "Authorization": `Bearer ${currentSession.access_token}` }
    });
    const profile = await profileRes.json();
    if (!profile?.username) {
      showStatus("error", "Please set a username first");
      return;
    }
    
    const filePath = `${profile.username}/asset-${Date.now()}.jpg`;

    const { error } = await supabase.storage
      .from("asset-images")
      .upload(filePath, selectedNewImage, {
        contentType: "image/jpeg"
      });

    if (error) {
      showStatus("error", "Image upload failed: " + error.message);
      return;
    }

    imageUrl = supabase.storage
      .from("asset-images")
      .getPublicUrl(filePath).data.publicUrl;
  }

  const payload = {
    description: document.getElementById("edit-description").value.trim() || null,
    assetData: document.getElementById("edit-asset-data").value.trim(),
    nodeType: parsedAssetMeta?.nodeType || null,
    blenderVersion: parsedAssetMeta?.blenderVersion || null,
    treeclipperVersion: parsedAssetMeta?.treeclipperVersion || null
  };

  if (imageUrl !== undefined) {
    payload.imageData = imageUrl;
  }

  try {
    const res = await fetch(`/api/entries?author=${encodeURIComponent(author)}&slug=${encodeURIComponent(slug)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentSession.access_token}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showStatus("success", "Asset updated!");
      closeEditModal();
      loadMyAssets();
    } else {
      showStatus("error", await res.text());
    }
  } catch (err) {
    showStatus("error", "Failed to update asset");
  }
}

async function handleConfirmDelete() {
  if (!currentSession) {
    showStatus("error", "Please log in to delete assets");
    return;
  }

  if (!deleteAuthor || !deleteSlug) {
    showStatus("error", "Missing asset information");
    return;
  }

  try {
    const res = await fetch(`/api/entries?author=${encodeURIComponent(deleteAuthor)}&slug=${encodeURIComponent(deleteSlug)}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${currentSession.access_token}`
      }
    });

    if (res.ok) {
      showStatus("success", "Asset deleted");
      closeDeleteModal();
      loadMyAssets();
    } else {
      showStatus("error", await res.text());
    }
  } catch (err) {
    showStatus("error", "Failed to delete asset");
  }
}

// Cropper functions
function openCropper(file) {
  pendingImageFile = file;
  const cropperImage = document.getElementById("cropper-image");
  const cropperModal = document.getElementById("cropper-modal");
  const url = URL.createObjectURL(file);
  cropperImage.onload = () => {
    initCropArea();
    URL.revokeObjectURL(url);
  };
  cropperImage.src = url;
  cropperModal.style.display = "flex";
}

function closeCropper() {
  document.getElementById("cropper-modal").style.display = "none";
  pendingImageFile = null;
}

function initCropArea() {
  const cropperImage = document.getElementById("cropper-image");
  const cropperContainer = document.getElementById("cropper-container");
  const rect = cropperImage.getBoundingClientRect();
  const containerRect = cropperContainer.getBoundingClientRect();
  
  cropState.imageWidth = rect.width;
  cropState.imageHeight = rect.height;
  cropState.containerWidth = containerRect.width;
  cropState.containerHeight = containerRect.height;
  cropState.offsetX = rect.left - containerRect.left;
  cropState.offsetY = rect.top - containerRect.top;
  
  const minDim = Math.min(rect.width, rect.height);
  cropState.cropSize = Math.min(minDim * 0.8, 300);
  cropState.cropX = cropState.offsetX + (rect.width - cropState.cropSize) / 2;
  cropState.cropY = cropState.offsetY + (rect.height - cropState.cropSize) / 2;
  
  updateCropAreaDisplay();
}

function updateCropAreaDisplay() {
  const cropArea = document.getElementById("crop-area");
  const cropperImage = document.getElementById("cropper-image");
  const cropSizeIndicator = document.getElementById("crop-size-indicator");
  
  cropArea.style.left = cropState.cropX + "px";
  cropArea.style.top = cropState.cropY + "px";
  cropArea.style.width = cropState.cropSize + "px";
  cropArea.style.height = cropState.cropSize + "px";
  
  const scaleX = cropperImage.naturalWidth / cropState.imageWidth;
  const actualSize = Math.round(cropState.cropSize * scaleX);
  cropSizeIndicator.textContent = `${actualSize} × ${actualSize}px`;
}

function constrainCrop() {
  const minSize = 50;
  const maxSize = Math.min(cropState.imageWidth, cropState.imageHeight);
  
  cropState.cropSize = Math.max(minSize, Math.min(cropState.cropSize, maxSize));
  cropState.cropX = Math.max(cropState.offsetX, Math.min(cropState.cropX, cropState.offsetX + cropState.imageWidth - cropState.cropSize));
  cropState.cropY = Math.max(cropState.offsetY, Math.min(cropState.cropY, cropState.offsetY + cropState.imageHeight - cropState.cropSize));
}

function getEventPos(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function handleCropStart(e) {
  e.preventDefault();
  const pos = getEventPos(e);
  const handle = e.target.dataset?.handle;
  const cropArea = document.getElementById("crop-area");
  
  cropState.startX = pos.x;
  cropState.startY = pos.y;
  cropState.startCropX = cropState.cropX;
  cropState.startCropY = cropState.cropY;
  cropState.startCropSize = cropState.cropSize;
  
  if (handle) {
    cropState.resizing = true;
    cropState.resizeHandle = handle;
  } else if (e.target === cropArea || e.target.closest("#crop-area")) {
    cropState.dragging = true;
  }
}

function handleCropMove(e) {
  if (!cropState.dragging && !cropState.resizing) return;
  e.preventDefault();
  
  const pos = getEventPos(e);
  const dx = pos.x - cropState.startX;
  const dy = pos.y - cropState.startY;
  
  if (cropState.dragging) {
    cropState.cropX = cropState.startCropX + dx;
    cropState.cropY = cropState.startCropY + dy;
  } else if (cropState.resizing) {
    const handle = cropState.resizeHandle;
    let sizeDelta = 0;
    
    if (handle === "se") {
      sizeDelta = Math.max(dx, dy);
    } else if (handle === "sw") {
      sizeDelta = Math.max(-dx, dy);
      cropState.cropX = cropState.startCropX - (cropState.startCropSize + sizeDelta - cropState.startCropSize);
    } else if (handle === "ne") {
      sizeDelta = Math.max(dx, -dy);
      cropState.cropY = cropState.startCropY - (cropState.startCropSize + sizeDelta - cropState.startCropSize);
    } else if (handle === "nw") {
      sizeDelta = Math.max(-dx, -dy);
      cropState.cropX = cropState.startCropX - sizeDelta;
      cropState.cropY = cropState.startCropY - sizeDelta;
    }
    
    cropState.cropSize = cropState.startCropSize + sizeDelta;
  }
  
  constrainCrop();
  updateCropAreaDisplay();
}

function handleCropEnd() {
  cropState.dragging = false;
  cropState.resizing = false;
  cropState.resizeHandle = null;
}

async function handleConfirmCrop() {
  if (!pendingImageFile) return;
  
  const cropperImage = document.getElementById("cropper-image");
  const editImagePreview = document.getElementById("edit-image-preview");
  const editImageDropzone = document.getElementById("edit-image-dropzone");
  const currentImageContainer = document.getElementById("current-image-container");
  
  const scaleX = cropperImage.naturalWidth / cropState.imageWidth;
  
  const sourceX = (cropState.cropX - cropState.offsetX) * scaleX;
  const sourceY = (cropState.cropY - cropState.offsetY) * scaleX;
  const sourceSize = cropState.cropSize * scaleX;
  
  const canvas = document.createElement("canvas");
  const outputSize = Math.min(512, Math.round(sourceSize));
  canvas.width = outputSize;
  canvas.height = outputSize;
  
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    cropperImage,
    sourceX, sourceY, sourceSize, sourceSize,
    0, 0, outputSize, outputSize
  );
  
  const croppedBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.92));
  
  selectedNewImage = croppedBlob;
  editImagePreview.src = URL.createObjectURL(croppedBlob);
  editImageDropzone.classList.add("has-image");
  currentImageContainer.style.display = "none";
  
  closeCropper();
}

async function updateEditAssetMeta() {
  const editAssetData = document.getElementById("edit-asset-data");
  const editAssetMeta = document.getElementById("edit-asset-meta");
  const editMetaNodeType = document.getElementById("edit-meta-node-type");
  const editMetaBlenderVersion = document.getElementById("edit-meta-blender-version");
  const editMetaTreeclipperVersion = document.getElementById("edit-meta-treeclipper-version");
  
  const raw = editAssetData.value.trim();
  if (!raw) {
    editAssetMeta.style.display = "none";
    parsedAssetMeta = null;
    return;
  }
  
  const meta = await decodeTreeClipperData(raw);
  parsedAssetMeta = meta;
  
  if (meta && (meta.nodeType || meta.blenderVersion || meta.treeclipperVersion)) {
    editMetaNodeType.textContent = meta.nodeType ? getNodeTypeLabel(meta.nodeType) : '—';
    editMetaBlenderVersion.textContent = meta.blenderVersion || '—';
    editMetaTreeclipperVersion.textContent = meta.treeclipperVersion || '—';
    editAssetMeta.style.display = "";
  } else {
    editAssetMeta.style.display = "none";
  }
}

// TreeClipper decoding
function base64ToUint8Array(b64) {
  b64 = b64.replace(/\s/g, '');
  const binaryString = atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function ungzip(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Browser does not support DecompressionStream");
  }
  const cs = new DecompressionStream('gzip');
  const blob = new Blob([bytes]);
  const decompressedStream = blob.stream().pipeThrough(cs);
  const decompressed = await new Response(decompressedStream).arrayBuffer();
  return new TextDecoder().decode(decompressed);
}

function mapBlIdnameToType(blIdname) {
  const mapping = {
    'GeometryNodeTree': 'geonodes',
    'ShaderNodeTree': 'shader',
    'CompositorNodeTree': 'compositor'
  };
  return mapping[blIdname] || blIdname || 'unknown';
}

async function decodeTreeClipperData(raw) {
  if (!raw.startsWith('TreeClipper::')) return null;
  const parts = raw.split('::');
  if (parts.length !== 2) return null;
  
  try {
    const bytes = base64ToUint8Array(parts[1]);
    const json = await ungzip(bytes);
    const obj = JSON.parse(json);
    
    const blenderVersion = obj.blender_version || null;
    const treeclipperVersion = obj.tree_clipper_version || null;
    
    let nodeType = null;
    if (Array.isArray(obj.node_trees) && obj.node_trees.length > 0) {
      const lastTree = obj.node_trees[obj.node_trees.length - 1];
      const blIdname = lastTree?.data?.bl_idname;
      nodeType = mapBlIdnameToType(blIdname);
    }
    
    return { blenderVersion, treeclipperVersion, nodeType };
  } catch (e) {
    console.error("Failed to decode TreeClipper data:", e);
    return null;
  }
}

function getNodeTypeLabel(nodeType) {
  const labels = {
    'geonodes': 'Geometry Nodes',
    'shader': 'Shader',
    'compositor': 'Compositor'
  };
  return labels[nodeType] || nodeType;
}

function showStatus(type, message) {
  const output = document.getElementById("output");
  const statusIcon = output.querySelector(".status-icon");
  const statusText = output.querySelector(".status-text");
  
  clearTimeout(statusTimeout);
  output.classList.remove("fade-out");
  output.className = "status-message visible " + type;
  statusIcon.textContent = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
  statusText.textContent = message;
  
  statusTimeout = setTimeout(() => {
    output.classList.add("fade-out");
    setTimeout(() => {
      output.classList.remove("visible", "fade-out");
    }, 400);
  }, 2000);
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
