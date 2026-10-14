import { env } from 'cloudflare:workers';
import { handleApi } from '../../../lib/business.mjs';
import { withKvBucket } from '../../../lib/kv-r2-adapter.mjs';
export const dynamic='force-dynamic';
// Resolve `env.BUCKET` por request: usa o R2 se existir, senão sintetiza um
// BUCKET compatível sobre o KV (env.FILES_KV). Precisa ser por request porque
// bindings não podem ser lidos no escopo global do Worker.
export function GET(request:Request){return handleApi(request,withKvBucket(env));}
export function POST(request:Request){return handleApi(request,withKvBucket(env));}
export function PATCH(request:Request){return handleApi(request,withKvBucket(env));}
