// api/index.js — Root endpoint for AGV API

export default function handler(req, res) {
  // Return JSON for programmatic access
  if (req.headers.accept && req.headers.accept.includes("application/json")) {
    return res.status(200).json({
      name: "AGV NEXRUR API",
      version: "1.0.0",
      status: "ok",
      endpoints: [
        "GET  /api/verify-wallet?address=<wallet>",
        "POST /api/verify-content",
        "POST /api/verify-share-nft",
        "POST /api/verify-agent-application",
      ],
    });
  }

  // Return HTML landing page for browsers
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AGV NEXRUR API</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0e17;
      color: #e0e6ed;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      max-width: 640px;
      width: 90%;
      text-align: center;
    }
    .logo {
      font-size: 3rem;
      font-weight: 800;
      background: linear-gradient(135deg, #00c896, #00a3ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.25rem;
    }
    .subtitle {
      font-size: 0.95rem;
      color: #6b7a90;
      margin-bottom: 2.5rem;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(0, 200, 150, 0.1);
      border: 1px solid rgba(0, 200, 150, 0.25);
      border-radius: 24px;
      padding: 6px 18px;
      font-size: 0.85rem;
      color: #00c896;
      margin-bottom: 2.5rem;
    }
    .dot {
      width: 8px; height: 8px;
      background: #00c896;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .endpoints {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 1.5rem;
      text-align: left;
      margin-bottom: 2rem;
    }
    .endpoints h3 {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #6b7a90;
      margin-bottom: 1rem;
    }
    .endpoint {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      font-size: 0.9rem;
    }
    .endpoint:last-child { border-bottom: none; }
    .method {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      min-width: 42px;
      text-align: center;
    }
    .get { background: rgba(0,163,255,0.15); color: #00a3ff; }
    .post { background: rgba(0,200,150,0.15); color: #00c896; }
    .path { color: #c8d1db; font-family: 'SF Mono', Consolas, monospace; font-size: 0.85rem; }
    .links {
      display: flex;
      gap: 1.5rem;
      justify-content: center;
    }
    .links a {
      color: #6b7a90;
      text-decoration: none;
      font-size: 0.85rem;
      transition: color 0.2s;
    }
    .links a:hover { color: #00c896; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">AGV NEXRUR</div>
    <div class="subtitle">Verification API Gateway</div>
    <div class="status-badge"><span class="dot"></span> Operational</div>
    <div class="endpoints">
      <h3>Endpoints</h3>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/verify-wallet</span>
      </div>
      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/api/verify-content</span>
      </div>
      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/api/verify-share-nft</span>
      </div>
      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/api/verify-agent-application</span>
      </div>
    </div>
    <div class="links">
      <a href="https://www.agvnexrur.ai">Main Site</a>
      <a href="https://docs.agvnexrur.ai">Documentation</a>
      <a href="https://buy.agvnexrur.ai">Buy NFT</a>
    </div>
  </div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
