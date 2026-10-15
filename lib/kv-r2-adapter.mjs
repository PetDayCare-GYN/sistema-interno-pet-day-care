// Adaptador que expõe uma API compatível com R2 (get/put/head/delete) sobre um
// namespace KV do Cloudflare. É usado quando o R2 não está disponível na conta
// (ex.: sem cartão cadastrado). Cobre exatamente os métodos que o restante do
// código usa através de `env.BUCKET` (ver lib/business.mjs, lib/backups.mjs,
// lib/recovery.mjs, lib/report-pdf.mjs, lib/privacy.mjs, lib/pet-identity.mjs).
//
// KV é eventualmente consistente entre regiões. Para garantir leitura-após-escrita
// no MESMO request — necessária porque o upload e o backup gravam e logo releem
// para conferir o SHA-256 — mantemos um cache em memória por adaptador (criado por
// request), limitado por tamanho total. A escrita mais recente nunca é despejada
// antes da sua própria releitura, então a verificação imediata sempre acerta.
//
// Limites do KV a considerar: valor máximo de 25 MB por chave e 1 GB no plano
// gratuito. Os uploads do app são limitados a 5 MB e o backup lógico a ~20 MB.

const CACHE_BUDGET_BYTES = 32 * 1024 * 1024;

function createCache() {
  const map = new Map(); // key -> { bytes: Uint8Array, contentType?: string }
  let total = 0;
  return {
    get(key) {
      return map.get(key) || null;
    },
    set(key, bytes, contentType) {
      const existing = map.get(key);
      if (existing) total -= existing.bytes.byteLength;
      map.set(key, { bytes, contentType });
      total += bytes.byteLength;
      // Despeja as entradas mais antigas (FIFO) até caber no orçamento, mas nunca
      // a que acabou de ser gravada (sua releitura imediata precisa acertar).
      for (const olderKey of map.keys()) {
        if (total <= CACHE_BUDGET_BYTES) break;
        if (olderKey === key) continue;
        total -= map.get(olderKey).bytes.byteLength;
        map.delete(olderKey);
      }
    },
    delete(key) {
      const existing = map.get(key);
      if (existing) {
        total -= existing.bytes.byteLength;
        map.delete(key);
      }
    },
  };
}

function toBytes(value) {
  if (typeof value === "string") return new TextEncoder().encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function tighten(bytes) {
  const whole =
    bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength;
  return whole ? bytes : bytes.slice();
}

function streamFrom(bytes) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

// Objeto no formato que o código espera de um R2Object: `.body` é um
// ReadableStream novo a cada acesso (consumido via `new Response(obj.body)`),
// mais `httpMetadata.contentType` e auxiliares.
function makeObject(key, bytes, contentType) {
  return {
    key,
    size: bytes.byteLength,
    httpMetadata: { contentType },
    customMetadata: {},
    get body() {
      return streamFrom(bytes);
    },
    async arrayBuffer() {
      return bytes.slice().buffer;
    },
    async text() {
      return new TextDecoder().decode(bytes);
    },
    async json() {
      return JSON.parse(new TextDecoder().decode(bytes));
    },
  };
}

// Envolve um KVNamespace numa API compatível com R2 (subconjunto usado pelo app).
export function r2OverKv(kv) {
  if (!kv) return undefined;
  const cache = createCache();
  return {
    async put(key, value, options) {
      const contentType = options?.httpMetadata?.contentType;
      const raw = toBytes(value);
      const metadata = contentType ? { metadata: { contentType } } : undefined;
      if (raw) {
        const bytes = tighten(raw);
        cache.set(key, bytes, contentType);
        await kv.put(key, bytes, metadata);
      } else {
        // Tipos inesperados (ex.: stream) passam direto, sem cache.
        cache.delete(key);
        await kv.put(key, value, metadata);
      }
      return { key };
    },
    async get(key) {
      const cached = cache.get(key);
      if (cached) return makeObject(key, cached.bytes, cached.contentType);
      const res = await kv.getWithMetadata(key, { type: "arrayBuffer" });
      if (!res || res.value == null) return null;
      return makeObject(key, new Uint8Array(res.value), res.metadata?.contentType);
    },
    async head(key) {
      const cached = cache.get(key);
      if (cached) {
        return {
          key,
          size: cached.bytes.byteLength,
          httpMetadata: { contentType: cached.contentType },
          customMetadata: {},
        };
      }
      const res = await kv.getWithMetadata(key, { type: "stream" });
      if (!res || res.value == null) return null;
      try {
        await res.value.cancel();
      } catch {
        // stream já encerrado; ignorar.
      }
      return {
        key,
        httpMetadata: { contentType: res.metadata?.contentType },
        customMetadata: {},
      };
    },
    async delete(key) {
      cache.delete(key);
      await kv.delete(key);
    },
  };
}

// Retorna o `env` com `BUCKET` resolvido: se já houver R2 real, usa-o; senão,
// sintetiza um BUCKET compatível sobre `env.FILES_KV`. Um Proxy evita copiar o
// objeto de bindings e preserva todos os demais (DB, FILES_KV, segredos, etc.).
// Deve ser chamado POR REQUEST (nunca no escopo global do Worker, onde o acesso
// a bindings é proibido).
// Lê um binding possivelmente ausente sem lançar: o `env` de cloudflare:workers
// pode lançar ao acessar um binding NÃO declarado (ex.: BUCKET, quando não há R2
// na configuração). Sem isto, o acesso a env.BUCKET derrubaria todo request.
function readBinding(env, name) {
  try {
    return env[name];
  } catch {
    return undefined;
  }
}

export function withKvBucket(env) {
  if (!env) return env;
  if (readBinding(env, "BUCKET")) return env; // R2 real disponível
  const kv = readBinding(env, "FILES_KV");
  if (!kv) return env;
  const bucket = r2OverKv(kv);
  return new Proxy(env, {
    get(target, prop) {
      if (prop === "BUCKET") return bucket;
      try {
        return target[prop];
      } catch {
        return undefined;
      }
    },
    has(target, prop) {
      if (prop === "BUCKET") return true;
      try {
        return prop in target;
      } catch {
        return false;
      }
    },
  });
}
