import { getDB } from '../../../../_shared/database.js';
import { error } from '../../../../_shared/http.js';
import { requireAdmin } from '../../../../_shared/auth.js';

export async function onRequestGet({ request, env, params }) {
  const admin=await requireAdmin(request,env); if(admin instanceof Response) return admin;
  if(!env.PROOFS) return error('Proof storage is not configured',503);
  const order=await getDB(env).prepare('SELECT proof_key FROM orders WHERE id=?').bind(Number(params.id)).first();
  if(!order?.proof_key) return error('এই order-এ proof নেই।',404);
  const object=await env.PROOFS.get(order.proof_key); if(!object) return error('Proof image পাওয়া যায়নি।',404);
  const headers=new Headers(); object.writeHttpMetadata(headers); headers.set('cache-control','private, no-store'); headers.set('x-content-type-options','nosniff');
  return new Response(object.body,{headers});
}
