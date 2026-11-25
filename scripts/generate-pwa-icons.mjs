import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const SVG_PATH = resolve('public/app-logo.svg');
const PWA_OUTPUTS = [
  { size: 192, path: resolve('public/icons/icon-192.png') },
  { size: 512, path: resolve('public/icons/icon-512.png') },
];
const ICO_OUTPUTS = [
  resolve('electron/icon.ico'),
  resolve('public/favicon.ico'),
];
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPngDimensions(buffer) {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('无效的 PNG 文件头');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function buildIco(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);

  const entries = [];
  let offset = 6 + frames.length * 16;
  for (const { size, png } of frames) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...frames.map((frame) => frame.png)]);
}

function verifyStaticIcons() {
  if (!existsSync(SVG_PATH)) {
    throw new Error('缺少主图标源文件：public/app-logo.svg');
  }
  const svgText = readFileSync(SVG_PATH, 'utf8');
  if (!svgText.includes('<svg')) {
    throw new Error('public/app-logo.svg 不是有效的 SVG 文件');
  }

  for (const { size, path } of PWA_OUTPUTS) {
    if (!existsSync(path)) {
      throw new Error(`缺少 PWA 图标：${path}（请运行 node scripts/generate-pwa-icons.mjs --regenerate）`);
    }
    const { width, height } = readPngDimensions(readFileSync(path));
    if (width !== size || height !== size) {
      throw new Error(`PWA 图标尺寸异常：${path} 为 ${width}x${height}，期望 ${size}x${size}`);
    }
  }

  for (const icoPath of ICO_OUTPUTS) {
    if (!existsSync(icoPath)) {
      throw new Error(`缺少 ICO 图标：${icoPath}（请运行 node scripts/generate-pwa-icons.mjs --regenerate）`);
    }
    const ico = readFileSync(icoPath);
    if (ico.length < 22 || ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1 || ico.readUInt16LE(4) < 1) {
      throw new Error(`不是有效的 ICO 文件：${icoPath}`);
    }
    const count = ico.readUInt16LE(4);
    if (count !== ICO_SIZES.length || ico.length < 6 + count * 16) {
      throw new Error(`ICO 缺少预期尺寸帧：${icoPath}`);
    }
    for (let index = 0; index < count; index += 1) {
      const entry = 6 + index * 16;
      const size = ICO_SIZES[index];
      const length = ico.readUInt32LE(entry + 8);
      const offset = ico.readUInt32LE(entry + 12);
      if ((ico[entry] || 256) !== size || (ico[entry + 1] || 256) !== size
        || offset < 6 + count * 16 || length < 24 || offset + length > ico.length) {
        throw new Error(`ICO 帧尺寸或数据范围无效：${icoPath}`);
      }
      const dimensions = readPngDimensions(ico.subarray(offset, offset + length));
      if (dimensions.width !== size || dimensions.height !== size) {
        throw new Error(`ICO 内嵌 PNG 尺寸不匹配：${icoPath}`);
      }
    }
  }
}

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('未找到可用的 Chrome / Edge 可执行文件，可通过环境变量 CHROME_PATH 指定。');
}

async function regenerateIcons() {
  const browserPath = findBrowserExecutable();
  const svgContent = readFileSync(SVG_PATH, 'utf8');
  const allSizes = [...new Set([...ICO_SIZES, ...PWA_OUTPUTS.map((item) => item.size)])].sort((a, b) => a - b);

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<script>
const SIZES = ${JSON.stringify(allSizes)};
async function run() {
  try {
    const svgRes = await fetch('/logo.svg');
    const svgText = await svgRes.text();
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('SVG 加载失败'));
      img.src = url;
    });

    const outputs = {};
    for (const size of SIZES) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, size, size);
      outputs[String(size)] = canvas.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
    }
    URL.revokeObjectURL(url);
    await fetch('/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, outputs }),
    });
  } catch (error) {
    await fetch('/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: String(error) }),
    });
  }
}
run();
</script>
</body>
</html>`;

  let resolveResult;
  let rejectResult;
  const resultPromise = new Promise((res, rej) => {
    resolveResult = res;
    rejectResult = rej;
  });

  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    if (req.method === 'GET' && req.url === '/logo.svg') {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8' });
      res.end(svgContent);
      return;
    }
    if (req.method === 'POST' && req.url === '/result') {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"received":true}');
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!payload.ok) {
            rejectResult(new Error(payload.error || '浏览器渲染失败'));
            return;
          }
          resolveResult(payload.outputs);
        } catch (error) {
          rejectResult(error);
        }
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const cacheRoot = resolve('node_modules/.cache');
  mkdirSync(cacheRoot, { recursive: true });
  const profile = mkdtempSync(resolve(cacheRoot, 'icon-render-'));
  await new Promise((res, rej) => {
    server.once('error', rej);
    server.listen(0, '127.0.0.1', res);
  });
  const { port } = server.address();
  const child = spawn(
    browserPath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${profile}`,
      '--virtual-time-budget=5000',
      `http://127.0.0.1:${port}/`,
    ],
    { stdio: 'ignore' },
  );

  child.once('error', (error) => rejectResult(new Error(`无法启动图标渲染浏览器：${error.message}`)));
  child.once('exit', (code) => rejectResult(new Error(`图标渲染浏览器已退出，未完成结果（退出码 ${code}）`)));

  const timeout = setTimeout(() => {
    rejectResult(new Error('生成图标超时'));
  }, 20000);

  try {
    const outputs = await resultPromise;
    mkdirSync(resolve('public/icons'), { recursive: true });
    for (const { size, path } of PWA_OUTPUTS) {
      const png = Buffer.from(outputs[String(size)], 'base64');
      writeFileSync(path, png);
    }

    const icoFrames = ICO_SIZES.map((size) => ({
      size,
      png: Buffer.from(outputs[String(size)], 'base64'),
    }));
    const icoBuffer = buildIco(icoFrames);
    for (const icoPath of ICO_OUTPUTS) {
      writeFileSync(icoPath, icoBuffer);
    }
    verifyStaticIcons();
    console.log(`已重新生成 PWA 图标（192/512）与多尺寸 ICO（electron/icon.ico、public/favicon.ico，${ICO_SIZES.join('/')}px）。`);
  } finally {
    clearTimeout(timeout);
    server.closeAllConnections();
    await new Promise((res) => server.close(res));
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      if (process.platform === 'win32') {
        await new Promise((res) => {
          const cleanup = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
          cleanup.once('error', () => { child.kill(); res(); });
          cleanup.once('exit', res);
        });
      } else {
        child.kill();
      }
    }
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

if (process.argv.includes('--regenerate')) {
  await regenerateIcons();
} else {
  verifyStaticIcons();
}
