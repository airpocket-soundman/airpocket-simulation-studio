import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { buildCoiServiceworker } from '../scripts/build-coi-serviceworker.mjs';

const upstreamPath = new URL('../node_modules/coi-serviceworker/coi-serviceworker.js', import.meta.url);

async function runFetch(source, url, mode = 'cors', origin = 'https://studio.example') {
    const listener = { fetch: null };
    const workerFetches = [];
    const response = url.endsWith('/opaque')
        ? new Response(null, { status: 200 })
        : new Response('ok', { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.endsWith('/opaque')) Object.defineProperty(response, 'status', { value: 0 });
    const context = {
        URL,
        Headers,
        Request,
        Response,
        console,
        fetch: async (request) => {
            workerFetches.push(request);
            return response;
        },
        self: {
            location: { origin },
            addEventListener(type, callback) {
                if (type === 'fetch') listener.fetch = callback;
            },
        },
    };
    vm.runInNewContext(source, context);
    const event = {
        request: { url, cache: 'default', mode },
        respondWith(promise) { this.responsePromise = promise; },
    };
    listener.fetch(event);
    const result = event.responsePromise ? await event.responsePromise : undefined;
    return { event, result, workerFetches };
}

test('upstream worker source keeps its copyright header and is not mutated', async () => {
    const original = await readFile(upstreamPath, 'utf8');
    const generated = buildCoiServiceworker(original);
    assert.equal(await readFile(upstreamPath, 'utf8'), original);
    assert.ok(generated.startsWith('/*! coi-serviceworker v0.1.7'));
});

test('builder rejects a missing or ambiguous upstream insertion anchor', () => {
    const anchor = '        const r = event.request;';
    assert.throws(() => buildCoiServiceworker('no anchor'), /found 0/);
    assert.throws(() => buildCoiServiceworker(`${anchor}\n${anchor}`), /found 2/);
});

test('HTTP 127.0.0.1 requests bypass service-worker response handling', async () => {
    const source = buildCoiServiceworker(await readFile(upstreamPath, 'utf8'));
    for (const path of ['/health', '/pair', '/poll']) {
        const { event, workerFetches } = await runFetch(source, `http://127.0.0.1:43123${path}`);
        assert.equal(event.responsePromise, undefined, path);
        assert.equal(workerFetches.length, 0, path);
    }
});

test('same-origin HTTP loopback app assets retain isolation headers while another port bypasses', async () => {
    const source = buildCoiServiceworker(await readFile(upstreamPath, 'utf8'));
    const appOrigin = 'http://127.0.0.1:43122';
    const sameOrigin = await runFetch(source, `${appOrigin}/assets/app.js`, 'same-origin', appOrigin);
    assert.ok(sameOrigin.event.responsePromise);
    assert.equal(sameOrigin.workerFetches.length, 1);
    assert.equal(sameOrigin.result.headers.get('Cross-Origin-Embedder-Policy'), 'require-corp');
    assert.equal(sameOrigin.result.headers.get('Cross-Origin-Opener-Policy'), 'same-origin');

    const connector = await runFetch(source, 'http://127.0.0.1:43123/health', 'cors', appOrigin);
    assert.equal(connector.event.responsePromise, undefined);
    assert.equal(connector.workerFetches.length, 0);
});

test('ordinary same-origin assets retain upstream isolation headers', async () => {
    const { result, workerFetches } = await runFetch(
        buildCoiServiceworker(await readFile(upstreamPath, 'utf8')),
        'https://studio.example/assets/app.js',
        'same-origin',
    );
    assert.equal(workerFetches.length, 1);
    assert.equal(result.headers.get('Cross-Origin-Embedder-Policy'), 'require-corp');
    assert.equal(result.headers.get('Cross-Origin-Resource-Policy'), 'cross-origin');
    assert.equal(result.headers.get('Cross-Origin-Opener-Policy'), 'same-origin');
});

test('other hosts, IPv4 forms, and HTTPS loopback lookalikes retain upstream handling', async () => {
    const source = buildCoiServiceworker(await readFile(upstreamPath, 'utf8'));
    for (const url of [
        'http://127.0.0.2:43123/health',
        'http://127.1:43123/health',
        'http://2130706433:43123/health',
        'http://localhost:43123/health',
        'http://127.0.0.1.evil.example/health',
        'https://127.0.0.1:43123/health',
        'http://[::1]:43123/health',
    ]) {
        const { event, workerFetches } = await runFetch(source, url);
        assert.ok(event.responsePromise, url);
        assert.equal(workerFetches.length, 1, url);
    }
});

test('opaque responses pass through unchanged', async () => {
    const { result } = await runFetch(
        buildCoiServiceworker(await readFile(upstreamPath, 'utf8')),
        'https://cdn.example/opaque',
        'no-cors',
    );
    assert.equal(result.status, 0);
    assert.equal(result.headers.get('Cross-Origin-Opener-Policy'), null);
});
