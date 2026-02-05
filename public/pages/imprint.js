// Imprint page

export const title = 'Imprint – Tree Clipper';

export function template() {
  return `
    <a href="/" class="back-button" aria-label="Back to home">←</a>

    <h1>Imprint</h1>

    <div class="legal-content">
      <p><strong>Tree Clipper</strong></p>
      <p>A community-driven project for sharing Blender geometry node trees.</p>

      <h2>Contact</h2>
      <p>
        For questions or takedown requests, reach out via
        <a href="https://discord.gg/T8wwzGQ8Ax" target="_blank" rel="noopener">Discord</a>.
      </p>

      <h2>Main Developers</h2>
      <p>
        <strong>Lars</strong> (Tree Clipper extension):<br>
        <a href="https://github.com/Algebraic-UG/tree_clipper" target="_blank" rel="noopener">https://github.com/Algebraic-UG/tree_clipper</a>
      </p>
      <p>
        <strong>Jan-Hendrik</strong> (website &amp; database):<br>
        <a href="https://github.com/kolibril13/tree-clipper-website/" target="_blank" rel="noopener">https://github.com/kolibril13/tree-clipper-website/</a>
      </p>
    </div>

    <p style="margin-top: 2em;">
      <a href="/terms" class="styled-link">Terms &amp; Conditions</a>
    </p>
    <div class="imprint-footnote">
      <small>Early Prototype, data not yet persistent</small>
    </div>
  `;
}

export function init() {
  // Static page; nothing to initialize
}
