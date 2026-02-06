// Terms page

export const title = 'Terms – Tree Clipper';

export function template() {
  return `
    <a href="/" class="back-button">←</a>
    
    <h1>Terms & Conditions</h1>
    
    <div class="legal-content">
      <h2>License</h2>
      <p>All node trees shared on this platform are <strong>open source</strong> under <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank">CC0 1.0</a>. By uploading, you release your work into the public domain.</p>
      
      <h2>Code of Conduct</h2>
      <ul>
        <li>Be kind and respectful.</li>
        <li>No spam, malware, or illegal content.</li>
        <li>Give credit when building on others' work (appreciated, not required).</li>
      </ul>
      
      <h2>No Warranty</h2>
      <p>This service is provided as-is, without warranties of any kind. Use at your own risk.</p>
    </div>
    
    <p style="margin-top: 2em;"><a href="/imprint">Imprint</a></p>
  `;
}

export function init() {
  // Static page, nothing to initialize
}
