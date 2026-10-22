// Minimal Chrome DevTools Protocol helper for localhost QA evidence.
// Launch a dedicated branded Chrome with --remote-debugging-port first.
// This helper does not launch, kill or reuse the user's normal Chrome profile.
import { writeFile } from 'node:fs/promises';

const port = process.env.CDP_PORT || '9333';
const base = `http://127.0.0.1:${port}`;

export async function newPage(url = 'about:blank') {
  const res = await fetch(`${base}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!res.ok) throw new Error(`new page failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function closePage(id) {
  await fetch(`${base}/json/close/${id}`);
}

export class Cdp {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${msg.error.code}: ${msg.error.message}`));
        else p.resolve(msg.result);
      } else {
        this.events.push(msg);
      }
    });
    return this;
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression, { awaitPromise = true, returnByValue = true } = {}) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue,
      userGesture: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result?.value;
  }
  async navigate(url) {
    await this.send('Page.enable');
    await this.send('Page.navigate', { url });
    await this.waitFor('Page.loadEventFired', 20000).catch(() => {});
  }
  async waitFor(method, timeout = 10000) {
    const existing = this.events.find((e) => e.method === method);
    if (existing) return existing.params;
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.ws.removeEventListener('message', handler);
        reject(new Error(`timeout waiting for ${method}`));
      }, timeout);
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.method === method) {
          clearTimeout(timer);
          this.ws.removeEventListener('message', handler);
          resolve(msg.params);
        }
      };
      this.ws.addEventListener('message', handler);
    });
  }
  async setViewport(width, height, deviceScaleFactor = 1) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor,
      mobile: false,
      screenWidth: width,
      screenHeight: height,
    });
  }
  async screenshot(path) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(path, Buffer.from(data, 'base64'));
  }
  close() {
    try { this.ws.close(); } catch {}
  }
}

export async function openCdp(url) {
  const page = await newPage(url);
  const cdp = await new Cdp(page.webSocketDebuggerUrl).connect();
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  return { page, cdp };
}
