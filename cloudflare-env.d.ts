declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    // R2 opcional: quando ausente, env.BUCKET é sintetizado sobre FILES_KV
    // (ver lib/kv-r2-adapter.mjs).
    BUCKET?: R2Bucket;
    FILES_KV?: KVNamespace;
  }
}
