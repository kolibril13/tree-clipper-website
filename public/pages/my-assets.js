// My Assets page
import { supabase, ensureUsername } from '../auth.js';
import { users, entries, APIError } from '../api.js';
import Cropper from 'cropperjs';

export const title = 'My Assets – Tree Clipper';

// Cropper.js v2 template: square (1:1) selection covering the full image.
const CROPPER_TEMPLATE = `
  <cropper-canvas background>
    <cropper-image rotatable scalable translatable></cropper-image>
    <cropper-shade hidden></cropper-shade>
    <cropper-handle action="select" plain></cropper-handle>
    <cropper-selection initial-coverage="1" movable resizable aspect-ratio="1" outlined>
      <cropper-grid role="grid" covered></cropper-grid>
      <cropper-crosshair centered></cropper-crosshair>
      <cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)"></cropper-handle>
      <cropper-handle action="n-resize"></cropper-handle>
      <cropper-handle action="e-resize"></cropper-handle>
      <cropper-handle action="s-resize"></cropper-handle>
      <cropper-handle action="w-resize"></cropper-handle>
      <cropper-handle action="ne-resize"></cropper-handle>
      <cropper-handle action="nw-resize"></cropper-handle>
      <cropper-handle action="se-resize"></cropper-handle>
      <cropper-handle action="sw-resize"></cropper-handle>
    </cropper-selection>
  </cropper-canvas>
`;

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
            <div class="label-row">
              <label for="edit-asset-data">Asset Data *</label>
              <button type="button" id="toggle-json-view" class="json-toggle-btn">Show as JSON</button>
            </div>
            <textarea id="edit-asset-data" rows="4" required placeholder="TreeClipper::H4sIALGFY2kC/+1aW2/iOBT..."></textarea>
            <small style="color: #6b7280; font-size: 0.85em;">Paste a TreeClipper string or raw JSON — JSON is converted to base64 on save</small>
            <div id="edit-data-warning" class="edit-data-warning" style="display: none;">⚠️ This asset data can't be decoded — paste a fresh TreeClipper string from Blender or valid JSON.</div>
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

    <!-- Image Cropper Modal (Cropper.js) -->
    <div id="cropper-modal" class="cropper-overlay" style="display: none;">
      <div class="crop-dialog">
        <div class="cropper-header">
          <div>
            <h3>Crop Thumbnail</h3>
            <p>Drag to move, drag corners to resize. Thumbnail will be square.</p>
          </div>
        </div>
        <div class="cropper-wrap" id="cropper-container">
          <img id="cropper-image" alt="Crop preview" />
        </div>
        <div class="cropper-actions">
          <button type="button" class="btn-secondary" id="cancel-crop">Cancel</button>
          <button type="button" class="btn-primary" id="confirm-crop">Crop & Use</button>
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
// 'base64' shows the TreeClipper:: string, 'json' shows the decoded JSON
let editDataMode = 'base64';

let cropperInstance = null;

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

  // Auto-open the edit modal when arriving from an asset page's edit button.
  // openEditModal fetches the asset itself, so it doesn't need the list loaded.
  const editAuthor = sessionStorage.getItem('editAssetAuthor');
  const editSlug = sessionStorage.getItem('editAssetSlug');
  if (editAuthor && editSlug) {
    sessionStorage.removeItem('editAssetAuthor');
    sessionStorage.removeItem('editAssetSlug');
    openEditModal(editAuthor, editSlug);
  }

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

  handlers.modalClose = () => closeEditModal();
  handlers.cancelEdit = () => closeEditModal();
  handlers.modalOverlayClick = (e) => { if (e.target === editModal) closeEditModal(); };
  handlers.assetDataInput = () => updateEditAssetMeta();
  // A pasted TreeClipper:: string is always a complete payload — replace the
  // whole field so it can't merge with the old value into invalid base64.
  handlers.assetDataPaste = (e) => {
    const pasted = e.clipboardData?.getData("text")?.trim();
    if (pasted?.startsWith("TreeClipper::")) {
      e.preventDefault();
      editAssetData.value = pasted;
      updateEditAssetMeta();
    }
  };
  handlers.formSubmit = handleEditSubmit;
  handlers.toggleJsonView = handleToggleJsonView;
  
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
  editAssetData.addEventListener("paste", handlers.assetDataPaste);
  editForm.addEventListener("submit", handlers.formSubmit);
  document.getElementById("toggle-json-view").addEventListener("click", handlers.toggleJsonView);

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

  document.getElementById("cancel-crop").addEventListener("click", handlers.cancelCrop);
  document.getElementById("confirm-crop").addEventListener("click", handlers.confirmCrop);

  document.addEventListener("keydown", handlers.keydown);
  document.addEventListener("paste", handlers.paste);
}

function cleanupEventListeners() {
  closeCropper();
  const editModal = document.getElementById("edit-modal");
  const editAssetData = document.getElementById("edit-asset-data");
  const editImageDropzone = document.getElementById("edit-image-dropzone");
  const editImageInput = document.getElementById("edit-image-input");
  const editRemoveImage = document.getElementById("edit-remove-image");
  const removeCurrentImageBtn = document.getElementById("remove-current-image");
  const deleteModal = document.getElementById("delete-modal");

  document.getElementById("modal-close")?.removeEventListener("click", handlers.modalClose);
  document.getElementById("cancel-edit")?.removeEventListener("click", handlers.cancelEdit);
  editModal?.removeEventListener("click", handlers.modalOverlayClick);
  editAssetData?.removeEventListener("input", handlers.assetDataInput);
  editAssetData?.removeEventListener("paste", handlers.assetDataPaste);
  document.getElementById("edit-form")?.removeEventListener("submit", handlers.formSubmit);
  document.getElementById("toggle-json-view")?.removeEventListener("click", handlers.toggleJsonView);

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
    const results = await entries.listMine();

    if (!results || results.length === 0) {
      assetsList.innerHTML = '<li class="empty-item">You haven\'t uploaded any assets yet.</li>';
      return;
    }

    assetsList.innerHTML = results.map(entry => {
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
    const asset = await entries.get(author, slug);
    
    document.getElementById("edit-author").value = asset.author;
    document.getElementById("edit-slug").value = asset.slug;
    document.getElementById("edit-title").value = asset.title || "";
    document.getElementById("edit-description").value = asset.description || "";
    document.getElementById("edit-asset-data").value = asset.asset_data || "";
    setEditDataMode('base64');

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
  setEditDataMode('base64');
  document.getElementById("edit-asset-meta").style.display = "none";
  document.getElementById("edit-data-warning").style.display = "none";
}

function setEditDataMode(mode) {
  editDataMode = mode;
  const btn = document.getElementById("toggle-json-view");
  const textarea = document.getElementById("edit-asset-data");
  btn.textContent = mode === 'json' ? "Show as Base64" : "Show as JSON";
  textarea.rows = mode === 'json' ? 14 : 4;
}

async function handleToggleJsonView() {
  const textarea = document.getElementById("edit-asset-data");
  const raw = textarea.value.trim();

  if (editDataMode === 'base64') {
    if (!raw) {
      showStatus("error", "No asset data to show");
      return;
    }
    let jsonText;
    if (looksLikeJson(raw)) {
      jsonText = raw;
    } else {
      try {
        jsonText = await decodePayloadToJson(raw);
      } catch (e) {
        showStatus("error", "Could not decode asset data — copy a fresh TreeClipper string from Blender");
        return;
      }
    }
    try {
      textarea.value = JSON.stringify(JSON.parse(jsonText), null, 2);
    } catch (e) {
      showStatus("error", "Asset data is not valid JSON");
      return;
    }
    setEditDataMode('json');
  } else {
    if (raw && looksLikeJson(raw)) {
      try {
        textarea.value = await encodeTreeClipperData(raw);
      } catch (e) {
        showStatus("error", "Invalid JSON: " + e.message);
        return;
      }
    }
    setEditDataMode('base64');
  }
  updateEditAssetMeta();
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
    await entries.update(author, slug, { imageData: null });
    currentImageUrl = null;
    document.getElementById("current-image-container").style.display = "none";
    showStatus("success", "Image removed");
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

  // Pasted/edited JSON is stored in the compressed TreeClipper:: format.
  let assetData = document.getElementById("edit-asset-data").value.trim();
  if (looksLikeJson(assetData)) {
    try {
      assetData = await encodeTreeClipperData(assetData);
    } catch (e) {
      showStatus("error", "Asset data is not valid JSON");
      return;
    }
  } else if (assetData.startsWith('TreeClipper::')) {
    // Refuse to store an undecodable string — a truncated or mangled payload
    // would save fine as base64 but permanently brick the asset page.
    try {
      JSON.parse(await decodePayloadToJson(assetData));
    } catch (e) {
      showStatus("error", "Asset data can't be decoded — copy a fresh TreeClipper string from Blender");
      return;
    }
  }

  if (selectedNewImage) {
    let profile;
    try {
      profile = await users.getMe();
    } catch {
      profile = null;
    }
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
    assetData,
    nodeType: parsedAssetMeta?.nodeType || null,
    blenderVersion: parsedAssetMeta?.blenderVersion || null,
    treeclipperVersion: parsedAssetMeta?.treeclipperVersion || null
  };

  if (imageUrl !== undefined) {
    payload.imageData = imageUrl;
  }

  try {
    await entries.update(author, slug, payload);
    showStatus("success", "Asset updated!");
    closeEditModal();
    loadMyAssets();
  } catch (err) {
    showStatus("error", err instanceof APIError ? err.message : "Failed to update asset");
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
    await entries.delete(deleteAuthor, deleteSlug);
    showStatus("success", "Asset deleted");
    closeDeleteModal();
    loadMyAssets();
  } catch (err) {
    showStatus("error", err instanceof APIError ? err.message : "Failed to delete asset");
  }
}

// Cropper.js
function openCropper(file) {
  pendingImageFile = file;
  const cropperImage = document.getElementById("cropper-image");
  const cropperModal = document.getElementById("cropper-modal");
  const url = URL.createObjectURL(file);
  cropperImage.onload = () => {
    destroyCropper();
    cropperInstance = new Cropper(cropperImage, { template: CROPPER_TEMPLATE });
  };
  cropperImage.src = url;
  cropperModal.style.display = "flex";
}

// Cropper.js v2 has no destroy(); tear down by removing the injected <cropper-canvas>.
function destroyCropper() {
  if (cropperInstance) {
    cropperInstance.getCropperCanvas()?.remove();
    cropperInstance = null;
  }
}

function closeCropper() {
  destroyCropper();
  const cropperImage = document.getElementById("cropper-image");
  if (cropperImage?.src?.startsWith("blob:")) URL.revokeObjectURL(cropperImage.src);
  document.getElementById("cropper-modal").style.display = "none";
  pendingImageFile = null;
}

async function handleConfirmCrop() {
  if (!cropperInstance || !pendingImageFile) return;
  const editImagePreview = document.getElementById("edit-image-preview");
  const editImageDropzone = document.getElementById("edit-image-dropzone");
  const currentImageContainer = document.getElementById("current-image-container");
  const canvas = await cropperInstance.getCropperSelection().$toCanvas({
    width: 512,
    height: 512,
    beforeDraw: (ctx, c) => {
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
    }
  });
  const croppedBlob = await new Promise(resolve => {
    canvas.toBlob(resolve, "image/jpeg", 0.92);
  });
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
  
  const editDataWarning = document.getElementById("edit-data-warning");

  const raw = editAssetData.value.trim();
  if (!raw) {
    editAssetMeta.style.display = "none";
    editDataWarning.style.display = "none";
    parsedAssetMeta = null;
    return;
  }

  const meta = await decodeTreeClipperData(raw);
  parsedAssetMeta = meta;

  // A TreeClipper:: string or JSON that fails to decode would brick the
  // asset page if saved — surface that instead of failing silently. Plain
  // base64 (legacy format) isn't decodable here and is fine, so no warning.
  const shouldDecode = raw.startsWith('TreeClipper::') || looksLikeJson(raw);
  editDataWarning.style.display = shouldDecode && meta === null ? "" : "none";

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

function looksLikeJson(raw) {
  return raw.startsWith('{');
}

// Extract the JSON text from a "TreeClipper::<gzip+base64>" string.
async function decodePayloadToJson(raw) {
  if (!raw.startsWith('TreeClipper::')) throw new Error("Not a TreeClipper string");
  const parts = raw.split('::');
  if (parts.length !== 2) throw new Error("Malformed TreeClipper string");
  const bytes = base64ToUint8Array(parts[1]);
  return ungzip(bytes);
}

// Compress JSON text into the "TreeClipper::<gzip+base64>" format.
// Throws if the text is not valid JSON.
async function encodeTreeClipperData(jsonText) {
  const minified = JSON.stringify(JSON.parse(jsonText));
  const cs = new CompressionStream('gzip');
  const stream = new Blob([minified]).stream().pipeThrough(cs);
  const buffer = await new Response(stream).arrayBuffer();
  return 'TreeClipper::' + uint8ArrayToBase64(new Uint8Array(buffer));
}

function uint8ArrayToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Accepts either a TreeClipper:: string or raw JSON text.
async function decodeTreeClipperData(raw) {
  if (!looksLikeJson(raw) && !raw.startsWith('TreeClipper::')) return null;
  try {
    const json = looksLikeJson(raw) ? raw : await decodePayloadToJson(raw);
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
    // Fires on every keystroke while the data is mid-edit, so no console
    // logging — the edit modal shows a visible warning instead.
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
