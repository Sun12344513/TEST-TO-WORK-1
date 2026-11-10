import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import multer from 'multer';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/screen' });

const PORT = 3000;
const KT_PORT = 4000;
const KT_BASE = `http://127.0.0.1:${KT_PORT}`;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup multer for APK uploads
const uploadDir = '/tmp/android-vm/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Ensure Kotlin daemon is running
function ensureKotlinDaemon() {
  fetch(`${KT_BASE}/api/kt/vms`)
    .catch(() => {
      console.log('[Server] Starting Kotlin VM Engine Daemon on port 4000...');
      const proc = spawn(
        'java',
        [
          '-cp',
          '/usr/share/kotlin/kotlinc/lib/*:/opt/android-vm/classes',
          'com.androidvm.Main',
          'server',
          `${KT_PORT}`
        ],
        { detached: true, stdio: 'ignore' }
      );
      proc.unref();
    });
}
ensureKotlinDaemon();

// Proxy helper
async function proxyToKotlin(req: express.Request, res: express.Response, endpoint: string, method: string = 'GET', body?: any) {
  try {
    const url = new URL(`${KT_BASE}${endpoint}`);
    if (method === 'GET' && req.query) {
      Object.entries(req.query).forEach(([k, v]) => {
        if (v) url.searchParams.set(k, String(v));
      });
    }

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);
    const contentType = response.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', contentType);

    if (contentType.includes('image/')) {
      const buffer = await response.arrayBuffer();
      res.status(response.status).send(Buffer.from(buffer));
    } else if (contentType.includes('text/plain')) {
      const text = await response.text();
      res.status(response.status).send(text);
    } else {
      const data = await response.json();
      res.status(response.status).json(data);
    }
  } catch (err: any) {
    res.status(502).json({
      error: 'Kotlin VM Engine daemon communication error',
      details: err?.message || String(err)
    });
  }
}

// REST Endpoints
app.get('/api/metrics', (req, res) => proxyToKotlin(req, res, '/api/kt/metrics'));
app.get('/api/vms', (req, res) => proxyToKotlin(req, res, '/api/kt/vms'));
app.get('/api/images', (req, res) => proxyToKotlin(req, res, '/api/kt/images'));
app.get('/api/logs', (req, res) => proxyToKotlin(req, res, '/api/kt/logs'));
app.get('/api/logs/export', (req, res) => proxyToKotlin(req, res, '/api/kt/logs/export'));
app.post('/api/logs/clear', (req, res) => proxyToKotlin(req, res, '/api/kt/logs/clear', 'POST', req.body));
app.post('/api/vm/control', (req, res) => proxyToKotlin(req, res, '/api/kt/vm/control', 'POST', req.body));
app.post('/api/vm/input', (req, res) => proxyToKotlin(req, res, '/api/kt/vm/input', 'POST', req.body));
app.post('/api/bulk', (req, res) => proxyToKotlin(req, res, '/api/kt/bulk', 'POST', req.body));

// Screen frame capture
app.get('/api/vm/screen', async (req, res) => {
  const vmId = String(req.query.vmId || 'vm-1');
  try {
    const response = await fetch(`${KT_BASE}/api/kt/screen?vmId=${vmId}`);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(Buffer.from(buffer));
    } else {
      res.status(404).json({ error: 'No frame available from QEMU framebuffer' });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to capture frame', details: err?.message });
  }
});

// APK Upload & Installation
app.post('/api/upload-apk', upload.single('apk'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Chưa có tệp nào được tải lên.' });
    }

    const vmId = req.body.vmId || 'vm-1';
    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const size = req.file.size;

    console.log(`[Upload] Received APK: ${originalName} (${size} bytes) for VM ${vmId}`);

    // Call Kotlin CLI to validate and install APK via ApkInstaller
    const proc = spawn('java', [
      '-cp',
      '/usr/share/kotlin/kotlinc/lib/*:/opt/android-vm/classes',
      'com.androidvm.Main',
      'install-apk',
      vmId,
      filePath
    ]);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());

    proc.on('close', code => {
      const success = code === 0 && stdout.includes('success=true');
      const pkgMatch = stdout.match(/Package:\s*([^\s)]+)/i);
      const pkg = pkgMatch ? pkgMatch[1] : null;

      res.json({
        success,
        fileName: originalName,
        fileSize: size,
        packageName: pkg,
        exitCode: code,
        output: (stdout + '\n' + stderr).trim(),
        error: success ? null : (stdout + '\n' + stderr).trim() || 'Cài đặt APK thất bại'
      });
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Server upload error' });
  }
});

// Launch installed app
app.post('/api/launch-app', (req, res) => {
  const { vmId = 'vm-1', packageName } = req.body;
  if (!packageName) {
    return res.status(400).json({ success: false, error: 'Missing packageName' });
  }

  const proc = spawn('adb', [
    '-s',
    `127.0.0.1:5555`,
    'shell',
    'monkey',
    '-p',
    packageName,
    '-c',
    'android.intent.category.LAUNCHER',
    '1'
  ]);

  let out = '';
  proc.stdout.on('data', d => out += d.toString());
  proc.stderr.on('data', d => out += d.toString());

  proc.on('close', code => {
    const success = code === 0 && !out.includes('No activities found');
    res.json({ success, output: out.trim(), exitCode: code });
  });
});

// WebSocket Server for live screen frames
wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const vmId = url.searchParams.get('vmId') || 'vm-1';
  let isAlive = true;

  const interval = setInterval(async () => {
    if (!isAlive || ws.readyState !== WebSocket.OPEN) {
      clearInterval(interval);
      return;
    }

    try {
      const response = await fetch(`${KT_BASE}/api/kt/screen?vmId=${vmId}`);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(Buffer.from(buffer));
        }
      }
    } catch (_err) {}
  }, 600);

  ws.on('close', () => {
    isAlive = false;
    clearInterval(interval);
  });
});

// Vite middleware in dev or static files in prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true }
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[FullStack] Android VM Control Panel server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
