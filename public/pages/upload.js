// Upload asset page
import { supabase, ensureUsername } from '/auth.js';
import Cropper from 'cropperjs';
import { mountGraphView, unmountGraphView } from 'geonodes-web-render/embed';
import 'geonodes-web-render/dist/embed.css';

export const title = 'Upload Asset – Tree Clipper';

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

    <h1>Upload Asset</h1>

    <div id="login-prompt" class="login-prompt">
      <p>Please log in to upload assets.</p>
    </div>

    <form id="asset-form" class="asset-form" style="display: none;">
      <div class="form-group">
        <label for="asset-data">Asset Data *</label>
        <textarea
          id="asset-data"
          placeholder="TreeClipper::H4sIALGFY2kC/+1aW2/iOBT..."
          rows="5"
          required
        ></textarea>
      </div>

      <div id="more-fields" style="display: none;">
        <div id="asset-meta" class="asset-meta" style="display: none;">
          <div class="meta-row">
            <span class="meta-label">Type</span>
            <span id="meta-node-type" class="meta-value"></span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Blender</span>
            <span id="meta-blender-version" class="meta-value"></span>
          </div>
          <div class="meta-row">
            <span class="meta-label">TreeClipper</span>
            <span id="meta-treeclipper-version" class="meta-value"></span>
          </div>
        </div>

        <div class="form-group">
          <label for="title">Title *</label>
          <input type="text" id="title" placeholder="Ring Arrangement" required />
          <small id="slug-status" style="font-size: 0.85em; color: #a3a9b4;">Cannot be changed later (used in URL)</small>
        </div>

        <div class="form-group">
          <label for="description">Description</label>
          <textarea id="description" rows="3" placeholder="Brief description (optional)"></textarea>
        </div>

        <div class="form-group">
          <label>Preview Image</label>
          <div class="image-dropzone" id="image-dropzone">
            <input type="file" id="image-input" accept="image/*" hidden />
            <div class="dropzone-content">
              <span class="dropzone-icon">📷</span>
              <span class="dropzone-text">Drag & drop an image here<br />or click to select</span>
            </div>
            <img id="image-preview" class="image-preview" alt="Preview" />
            <button type="button" id="remove-image" class="remove-image">×</button>
          </div>
          <small id="compression-note" class="compression-note" style="display: none;">Image will be slightly compressed for faster loading</small>
        </div>

        <!-- Live node-tree preview, rendered from the pasted asset data -->
        <section id="node-tree-section" class="node-tree-section" hidden>
          <div class="node-tree-panel">
            <div class="node-tree-panel__header">
              <span class="node-tree-panel__title">
                <span class="node-tree-panel__icon">◇</span> Node Tree Preview
              </span>
            </div>
            <div id="node-tree-canvas" class="node-tree-canvas">
              <div class="node-tree-canvas__loading">Loading node tree…</div>
            </div>
          </div>
        </section>

        <button type="submit">Submit Asset</button>
      </div>
    </form>

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

let statusTimeout;
let slugCheckTimeout;
let hasAssetDataBeenTouched = false;
let isSubmitting = false;
let selectedImageFile = null;
let parsedAssetMeta = null;
let pendingImageFile = null;

let cropperInstance = null;

// Raw payload currently mounted in the node-tree preview, so we don't re-mount
// the (expensive) graph view on every keystroke when the data hasn't changed.
let renderedGraphPayload = null;

// Event handlers stored for cleanup
let handlers = {};

// Mount/refresh/clear the live node-tree preview from the pasted asset data.
function renderGraphPreview(raw) {
  const section = document.getElementById("node-tree-section");
  const canvas = document.getElementById("node-tree-canvas");
  if (!section || !canvas) return;

  if (!raw) {
    if (renderedGraphPayload !== null) {
      try { unmountGraphView(canvas); } catch (e) { /* noop */ }
      renderedGraphPayload = null;
    }
    section.hidden = true;
    return;
  }

  if (raw === renderedGraphPayload) return;
  renderedGraphPayload = raw;
  section.hidden = false;
  canvas.innerHTML = '';
  mountGraphView(canvas, { payload: raw });
}

export async function init() {
  // Ensure user has a username - if this returns false, user was redirected
  const hasUsername = await ensureUsername();
  if (!hasUsername) {
    // User was redirected to claim-username page, stop initialization
    return;
  }
  
  const form = document.getElementById("asset-form");
  const loginPrompt = document.getElementById("login-prompt");
  const assetDataInput = document.getElementById("asset-data");
  const titleInput = document.getElementById("title");
  const imageDropzone = document.getElementById("image-dropzone");
  const imageInput = document.getElementById("image-input");
  const removeImageBtn = document.getElementById("remove-image");
  const cancelCropBtn = document.getElementById("cancel-crop");
  const confirmCropBtn = document.getElementById("confirm-crop");
  
  // Reset state
  hasAssetDataBeenTouched = false;
  isSubmitting = false;
  selectedImageFile = null;
  parsedAssetMeta = null;
  renderedGraphPayload = null;
  
  // Auth state handlers
  async function updateAuthUI(user) {
    if (user) {
      form.style.display = "";
      loginPrompt.style.display = "none";
    } else {
      form.style.display = "none";
      loginPrompt.style.display = "";
    }
  }
  
  // Get initial state
  const { data: { user } } = await supabase.auth.getUser();
  updateAuthUI(user);
  
  // Listen for changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    updateAuthUI(session?.user ?? null);
  });
  
  // Asset data input handler
  handlers.assetDataInput = () => {
    updateMoreFieldsVisibility();
    updateAssetMeta();
  };
  assetDataInput.addEventListener("input", handlers.assetDataInput);
  
  // Title input handler
  handlers.titleInput = () => {
    clearTimeout(slugCheckTimeout);
    slugCheckTimeout = setTimeout(() => {
      checkSlugAvailability(titleInput.value);
    }, 300);
  };
  titleInput.addEventListener("input", handlers.titleInput);
  
  // Image dropzone handlers
  handlers.dropzoneClick = () => imageInput.click();
  handlers.dropzoneDragover = (e) => {
    e.preventDefault();
    imageDropzone.classList.add("dragover");
  };
  handlers.dropzoneDragleave = () => imageDropzone.classList.remove("dragover");
  handlers.dropzoneDrop = (e) => {
    e.preventDefault();
    imageDropzone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) openCropper(file);
  };
  handlers.imageInputChange = (e) => {
    const file = e.target.files[0];
    if (file) openCropper(file);
  };
  handlers.removeImage = (e) => {
    e.stopPropagation();
    selectedImageFile = null;
    imageInput.value = "";
    document.getElementById("image-preview").src = "";
    imageDropzone.classList.remove("has-image");
    document.getElementById("compression-note").style.display = "none";
  };
  
  imageDropzone.addEventListener("click", handlers.dropzoneClick);
  imageDropzone.addEventListener("dragover", handlers.dropzoneDragover);
  imageDropzone.addEventListener("dragleave", handlers.dropzoneDragleave);
  imageDropzone.addEventListener("drop", handlers.dropzoneDrop);
  imageInput.addEventListener("change", handlers.imageInputChange);
  removeImageBtn.addEventListener("click", handlers.removeImage);
  
  handlers.cancelCrop = closeCropper;
  handlers.confirmCrop = handleConfirmCrop;
  handlers.keydown = (e) => {
    if (e.key === "Escape" && document.getElementById("cropper-modal").style.display === "flex") {
      closeCropper();
    }
  };

  cancelCropBtn.addEventListener("click", handlers.cancelCrop);
  confirmCropBtn.addEventListener("click", handlers.confirmCrop);
  document.addEventListener("keydown", handlers.keydown);
  
  // Paste handler
  handlers.paste = (e) => {
    const moreFields = document.getElementById("more-fields");
    const cropperModal = document.getElementById("cropper-modal");
    if (moreFields.style.display === "none") return;
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
  document.addEventListener("paste", handlers.paste);
  
  // Form submit
  handlers.formSubmit = handleFormSubmit;
  form.addEventListener("submit", handlers.formSubmit);
  
  // Return cleanup function
  return () => {
    subscription.unsubscribe();
    clearTimeout(statusTimeout);
    clearTimeout(slugCheckTimeout);
    closeCropper();
    renderGraphPreview(null);
    assetDataInput.removeEventListener("input", handlers.assetDataInput);
    titleInput.removeEventListener("input", handlers.titleInput);
    imageDropzone.removeEventListener("click", handlers.dropzoneClick);
    imageDropzone.removeEventListener("dragover", handlers.dropzoneDragover);
    imageDropzone.removeEventListener("dragleave", handlers.dropzoneDragleave);
    imageDropzone.removeEventListener("drop", handlers.dropzoneDrop);
    imageInput.removeEventListener("change", handlers.imageInputChange);
    removeImageBtn.removeEventListener("click", handlers.removeImage);
    cancelCropBtn.removeEventListener("click", handlers.cancelCrop);
    confirmCropBtn.removeEventListener("click", handlers.confirmCrop);
    document.removeEventListener("keydown", handlers.keydown);
    document.removeEventListener("paste", handlers.paste);
    form.removeEventListener("submit", handlers.formSubmit);
  };
}

function updateMoreFieldsVisibility() {
  const assetDataInput = document.getElementById("asset-data");
  const moreFields = document.getElementById("more-fields");
  const val = assetDataInput.value.trim();
  if (!hasAssetDataBeenTouched && val.length >= 1) {
    hasAssetDataBeenTouched = true;
  }
  if (hasAssetDataBeenTouched) {
    moreFields.style.display = "";
  } else {
    moreFields.style.display = "none";
  }
}

async function checkSlugAvailability(title) {
  const slugStatus = document.getElementById("slug-status");
  
  if (!title.trim()) {
    slugStatus.textContent = "Cannot be changed later (used in URL)";
    slugStatus.style.color = "#6b7280";
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    slugStatus.textContent = "Log in to check availability";
    slugStatus.style.color = "#6b7280";
    return;
  }

  slugStatus.textContent = "Checking...";
  slugStatus.style.color = "#6b7280";

  try {
    const res = await fetch(`/api/slug/check?title=${encodeURIComponent(title)}`, {
      headers: { "Authorization": `Bearer ${session.access_token}` }
    });
    const data = await res.json();

    if (data.error) {
      slugStatus.textContent = data.error;
      slugStatus.style.color = "#dc2626";
    } else if (data.available) {
      slugStatus.innerHTML = `✓ URL: <strong>https://tree-clipper.com/${data.author}/${data.slug}</strong>`;
      slugStatus.style.color = "#16a34a";
    } else {
      slugStatus.innerHTML = `⚠ <strong>https://tree-clipper.com/${data.author}/${data.slug}</strong> exists — will be saved as <strong>https://tree-clipper.com/${data.author}/${data.availableSlug}</strong>`;
      slugStatus.style.color = "#d97706";
    }
  } catch (err) {
    slugStatus.textContent = "Failed to check availability";
    slugStatus.style.color = "#dc2626";
  }
}

async function updateAssetMeta() {
  const assetDataInput = document.getElementById("asset-data");
  const assetMeta = document.getElementById("asset-meta");
  const metaNodeType = document.getElementById("meta-node-type");
  const metaBlenderVersion = document.getElementById("meta-blender-version");
  const metaTreeclipperVersion = document.getElementById("meta-treeclipper-version");
  const titleInput = document.getElementById("title");
  
  const raw = assetDataInput.value.trim();
  if (!raw) {
    assetMeta.style.display = "none";
    parsedAssetMeta = null;
    renderGraphPreview(null);
    return;
  }

  const meta = await decodeTreeClipperData(raw);
  parsedAssetMeta = meta;

  if (meta && (meta.nodeType || meta.blenderVersion || meta.treeclipperVersion)) {
    metaNodeType.textContent = meta.nodeType ? getNodeTypeLabel(meta.nodeType) : '—';
    metaBlenderVersion.textContent = meta.blenderVersion || '—';
    metaTreeclipperVersion.textContent = meta.treeclipperVersion || '—';
    assetMeta.style.display = "";
  } else {
    assetMeta.style.display = "none";
  }

  // Render the live node-tree preview once the payload decodes; clear it
  // otherwise so partial/invalid input doesn't leave a stale graph behind.
  renderGraphPreview(meta ? raw : null);
  
  // Auto-fill title from asset name if title is empty
  if (meta?.name && !titleInput.value.trim()) {
    titleInput.value = meta.name;
    checkSlugAvailability(meta.name);
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

function getNodeTypeLabel(nodeType) {
  const labels = {
    'geonodes': 'Geometry Nodes',
    'shader': 'Shader',
    'compositor': 'Compositor'
  };
  return labels[nodeType] || nodeType;
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
    let name = null;
    if (Array.isArray(obj.node_trees) && obj.node_trees.length > 0) {
      const lastTree = obj.node_trees[obj.node_trees.length - 1];
      const blIdname = lastTree?.data?.bl_idname;
      nodeType = mapBlIdnameToType(blIdname);
      name = lastTree?.data?.name || null;
    }
    
    return { blenderVersion, treeclipperVersion, nodeType, name };
  } catch (e) {
    console.error("Failed to decode TreeClipper data:", e);
    return null;
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
  const imagePreview = document.getElementById("image-preview");
  const imageDropzone = document.getElementById("image-dropzone");
  const compressionNote = document.getElementById("compression-note");
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
  selectedImageFile = croppedBlob;
  imagePreview.src = URL.createObjectURL(croppedBlob);
  imageDropzone.classList.add("has-image");
  compressionNote.style.display = "";
  closeCropper();
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const moreFields = document.getElementById("more-fields");
  if (moreFields.style.display === "none") return;

  // Guard against double-clicks / repeated Enter while the upload is in flight
  if (isSubmitting) return;
  isSubmitting = true;

  const submitBtn = document.querySelector("#asset-form button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.textContent = "Uploading…";

  let redirecting = false;
  try {
    redirecting = await submitAsset();
  } catch (err) {
    showStatus("error", "Upload failed: " + (err?.message || err));
  } finally {
    if (!redirecting) {
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Asset";
    }
  }
}

// Returns true if the upload succeeded and a redirect is pending.
async function submitAsset() {
  const titleInput = document.getElementById("title");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    showStatus("error", "Please log in to upload assets.");
    return;
  }

  const title = titleInput.value.trim();
  if (!title) {
    showStatus("error", "Title is required");
    return;
  }

  // Re-check slug availability
  const slugRes = await fetch(`/api/slug/check?title=${encodeURIComponent(title)}`, {
    headers: { "Authorization": `Bearer ${session.access_token}` }
  });
  const slugData = await slugRes.json();

  if (slugData.error) {
    showStatus("error", slugData.error);
    return;
  }

  let imageUrl = null;

  if (selectedImageFile) {
    const profileRes = await fetch("/api/users/me", {
      headers: { "Authorization": `Bearer ${session.access_token}` }
    });
    const profile = await profileRes.json();
    if (!profile?.username) {
      showStatus("error", "Please set a username first");
      return;
    }
    
    const filePath = `${profile.username}/asset-${Date.now()}.jpg`;

    const { error } = await supabase.storage
      .from("asset-images")
      .upload(filePath, selectedImageFile, {
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
    assetData: document.getElementById("asset-data").value.trim(),
    title: title,
    description: document.getElementById("description").value.trim() || null,
    imageData: imageUrl,
    nodeType: parsedAssetMeta?.nodeType || null,
    blenderVersion: parsedAssetMeta?.blenderVersion || null,
    treeclipperVersion: parsedAssetMeta?.treeclipperVersion || null
  };

  const res = await fetch("/api/entries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`
    },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    const result = await res.json();
    showStatus("success", "Upload complete! Redirecting...");

    setTimeout(() => {
      window.spaNavigate(`/${result.author}/${result.slug}`);
    }, 1000);
    return true;
  }

  showStatus("error", await res.text());
  return false;
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
  }, 1000);
}
