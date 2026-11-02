export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Sawargseema Ventures — Open Plots</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2.25rem 2rem; background: #ffffff; border-radius: 1rem; border: 1px solid #e2e8f0; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.07); }
      h1 { font-size: 1.35rem; font-weight: 700; margin: 0 0 0.5rem; color: #064e3b; }
      p { color: #64748b; margin: 0 0 1.5rem; font-size: 0.9rem; line-height: 1.5; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.5rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; font-size: 0.875rem; font-weight: 600; }
      .primary { background: #059669; color: #ffffff; border-color: #059669; }
      .primary:hover { background: #047857; }
      .secondary { background: #ffffff; color: #0f172a; border-color: #cbd5e1; }
      .secondary:hover { background: #f1f5f9; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Sawargseema Ventures</h1>
      <p>A momentary connection or render pause occurred. Tap below to reload the plots and live pricing.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Reload Page</button>
        <a class="secondary" href="/">Home</a>
        <a class="secondary" href="/layout">Visual Layout</a>
      </div>
    </div>
  </body>
</html>`;
}
