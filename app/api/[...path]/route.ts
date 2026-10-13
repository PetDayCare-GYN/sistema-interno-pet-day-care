import { env } from 'cloudflare:workers';
import { handleApi } from '../../../lib/business.mjs';
export const dynamic='force-dynamic';
export function GET(request:Request){return handleApi(request,env);}
export function POST(request:Request){return handleApi(request,env);}
export function PATCH(request:Request){return handleApi(request,env);}
