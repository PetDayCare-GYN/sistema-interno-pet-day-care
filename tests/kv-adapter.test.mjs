import test from 'node:test';
import assert from 'node:assert/strict';
import { r2OverKv, withKvBucket } from '../lib/kv-r2-adapter.mjs';

// Mock mínimo de KVNamespace com a API que o adaptador usa.
class LocalKV {
  constructor() { this.m = new Map(); }
  async put(key, value, options) {
    let bytes;
    if (typeof value === 'string') bytes = new TextEncoder().encode(value);
    else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
    else bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    this.m.set(key, { bytes: bytes.slice(), metadata: options?.metadata ?? null });
  }
  async getWithMetadata(key, opts) {
    const r = this.m.get(key);
    if (!r) return { value: null, metadata: null };
    const type = typeof opts === 'string' ? opts : opts?.type;
    if (type === 'arrayBuffer') return { value: r.bytes.slice().buffer, metadata: r.metadata };
    if (type === 'stream') {
      return {
        value: new ReadableStream({ start(c) { c.enqueue(r.bytes); c.close(); } }),
        metadata: r.metadata,
      };
    }
    return { value: new TextDecoder().decode(r.bytes), metadata: r.metadata };
  }
  async delete(key) { this.m.delete(key); }
}

const bytesOf = async (object) =>
  new Uint8Array(await new Response(object.body).arrayBuffer());

test('put/get de bytes preserva o conteúdo e o content-type', async () => {
  const bucket = r2OverKv(new LocalKV());
  const data = new Uint8Array([1, 2, 3, 250, 0, 99]);
  await bucket.put('files/a', data, { httpMetadata: { contentType: 'image/png' } });
  const object = await bucket.get('files/a');
  assert.ok(object);
  assert.deepEqual(await bytesOf(object), data);
  assert.equal(object.httpMetadata.contentType, 'image/png');
});

test('put de string e leitura como texto/json', async () => {
  const bucket = r2OverKv(new LocalKV());
  await bucket.put('plan.json', JSON.stringify({ ok: true }), {
    httpMetadata: { contentType: 'application/json' },
  });
  const object = await bucket.get('plan.json');
  assert.deepEqual(JSON.parse(new TextDecoder().decode(await bytesOf(object))), { ok: true });
});

test('leitura-após-escrita no mesmo adaptador (verificação de SHA do backup)', async () => {
  const bucket = r2OverKv(new LocalKV());
  const data = new Uint8Array(1024).fill(7);
  await bucket.put('archive/files/x', data, { httpMetadata: { contentType: 'application/octet-stream' } });
  const copy = await bucket.get('archive/files/x'); // relê imediatamente
  assert.deepEqual(await bytesOf(copy), data);
});

test('head existe sem body; null quando ausente', async () => {
  const bucket = r2OverKv(new LocalKV());
  await bucket.put('files/h', new Uint8Array([9]), {});
  const head = await bucket.head('files/h');
  assert.ok(head);
  assert.equal(head.body, undefined); // pet-identity faz `if(object.body)`
  assert.equal(await bucket.head('files/inexistente'), null);
});

test('get de chave inexistente retorna null', async () => {
  const bucket = r2OverKv(new LocalKV());
  assert.equal(await bucket.get('nao-existe'), null);
});

test('delete remove do cache e do KV', async () => {
  const kv = new LocalKV();
  const bucket = r2OverKv(kv);
  await bucket.put('files/d', new Uint8Array([1]), {});
  await bucket.delete('files/d');
  assert.equal(await bucket.get('files/d'), null);
  assert.equal(kv.m.has('files/d'), false);
});

test('withKvBucket sintetiza BUCKET a partir de FILES_KV e preserva outros bindings', async () => {
  const env = { DB: { tag: 'd1' }, FILES_KV: new LocalKV(), BACKUP_SERVICE_HASH: 'hash' };
  const resolved = withKvBucket(env);
  assert.equal(resolved.DB, env.DB);
  assert.equal(resolved.BACKUP_SERVICE_HASH, 'hash');
  assert.ok(resolved.BUCKET);
  await resolved.BUCKET.put('files/w', new Uint8Array([5, 6]), {});
  assert.deepEqual(await bytesOf(await resolved.BUCKET.get('files/w')), new Uint8Array([5, 6]));
});

test('withKvBucket mantém o R2 real quando presente', () => {
  const realBucket = { tag: 'r2' };
  const env = { BUCKET: realBucket, FILES_KV: new LocalKV() };
  assert.equal(withKvBucket(env).BUCKET, realBucket);
});
