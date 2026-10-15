import { env } from 'cloudflare:workers';
import { handleApi } from '../../../lib/business.mjs';
import { withKvBucket } from '../../../lib/kv-r2-adapter.mjs';
import { authenticate } from '../../../lib/auth.mjs';
export const dynamic='force-dynamic';
// Por request: (a) autentica via cookie de sessão, descartando headers de
// identidade do cliente (lib/auth.mjs); (b) resolve env.BUCKET sobre o KV quando
// não há R2 (lib/kv-r2-adapter.mjs). Ambos precisam rodar por request — bindings
// não podem ser lidos no escopo global do Worker.
async function handle(request:Request){return handleApi(await authenticate(request,env),withKvBucket(env));}
export function GET(request:Request){return handle(request);}
export function POST(request:Request){return handle(request);}
export function PATCH(request:Request){return handle(request);}
