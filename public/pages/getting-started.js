// Getting Started guide page

export const title = 'Getting Started – Tree Clipper';

export function template() {
  return `
    <a href="/" class="back-button">←</a>

    <h1>Getting Started</h1>

    <div class="guide-content">
      <p class="guide-intro">
        Tree Clipper lets you copy and paste Blender node trees, no blend files needed.
        Here's how to use it:
      </p>

      <div class="guide-steps">
        <div class="guide-step">
          <h3>
            <span class="guide-step-number">1</span>
            Get the Extension
          </h3>
          <p>
            Install the <a href="https://extensions.blender.org/add-ons/tree-clipper/" target="_blank" rel="noopener">Tree Clipper extension</a>
            from the Blender Extensions platform. It works with <strong>Blender 5.0 + </strong>.
          </p>
          <img src="/images/tree-clipper-extension.jpeg" alt="Tree Clipper extension illustration" class="guide-screenshot">
        </div>

        <div class="guide-step">
          <h3>
            <span class="guide-step-number">2</span>
            Copy an Asset
          </h3>
          <p>
            Find an asset you like in the <a href="/">Gallery</a>.
            On the asset page, click <strong>Copy</strong> to copy the asset data string
            (it starts with <code>TreeClipper::</code>).
          </p>
          <img src="/images/copy-asset.jpeg" alt="Asset page showing the Copy button next to the asset data string" class="guide-screenshot">
        </div>

        <div class="guide-step">
          <h3>
            <span class="guide-step-number">3</span>
            Paste into Blender
          </h3>
          <p>
            In Blender, open any node editor and go to the <strong>Tree Clipper</strong> panel
            in the N side panel. Click <strong>Import Clipboard</strong> and the node tree
            will appear instantly.
          </p>
          <img src="/images/tree-clipper-panel.jpeg" alt="Tree Clipper side panel in Blender showing Export, Import Clipboard, and Import File buttons" class="guide-screenshot">
        </div>
      </div>

      <section class="guide-section" style="margin-top: 4rem;">
        <h2>Share Your Own Node Trees</h2>
        <p>Want to share your own node setups? Here's how to get started as a contributor.</p>

        <div class="guide-steps">
          <div class="guide-step">
            <h3>
              <span class="guide-step-number">1</span>
              Sign Up
            </h3>
            <p>
              Click <strong>Login</strong> in the top right corner. You can sign in with
              <strong>Discord</strong> or via <strong>email magic link</strong> — no password needed.
              After your first login, you'll choose a username that appears in your asset URLs.
            </p>
          </div>

          <div class="guide-step">
            <h3>
              <span class="guide-step-number">2</span>
              Export Your Node Tree in Blender
            </h3>
            <p>
              In Blender's node editor, open the <strong>Tree Clipper</strong> panel
              in the N side panel and click <strong>Export</strong>.
              This copies the asset data to your clipboard.
            </p>
          </div>

          <div class="guide-step">
            <h3>
              <span class="guide-step-number">3</span>
              Upload
            </h3>
            <p>
              Go to the <a href="/upload-asset">Upload</a> page, paste your asset data,
              give it a title and optional description, add a preview image, and hit publish.
              Your asset will be live and shareable immediately.
            </p>
          </div>
        </div>
      </section>

      <section class="guide-section guide-section--cta">
        <p>
          All assets shared on Tree Clipper are open source under
          <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener">CC0</a>.
          Happy node sharing!
        </p>
      </section>
    </div>
  `;
}

export function init() {
  // Static page, nothing to initialize
}
