# geo-nodes-xyz

## Deployment to Cloudflare Pages

This project is configured for deployment to Cloudflare Pages.

### Prerequisites

- Node.js installed
- Cloudflare account
- Wrangler CLI installed (optional, for local development)

### Local Development

```bash
# Install dependencies
npm install

# Run local development server
npm run dev
```

### Deploy to Cloudflare Pages

#### Option 1: Using Wrangler CLI

```bash
# Install Wrangler globally (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
npm run deploy
```

#### Option 2: Using Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Pages** → **Create a project**
3. Connect your Git repository or upload the project files
4. Set build settings:
   - **Build command**: (leave empty for static sites)
   - **Build output directory**: `/` (root directory)
5. Click **Save and Deploy**

### Project Structure

```
geo-nodes-xyz/
├── index.html          # Main HTML file
├── wrangler.toml       # Cloudflare configuration
├── package.json        # Node.js dependencies
└── README.md          # This file
```