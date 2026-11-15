import { getDB, ensureProofTable } from '../../../../_shared/database.js';
import { error } from '../../../../_shared/http.js';
import { requireAdmin } from '../../../../_shared/auth.js';

export async function onRequestGet({ request, env, params }) {
  const admin=await requireAdmin(request,env); if(admin instanceof Response) return admin;
  await ensureProofTable(env);
  const order=await getDB(env).prepare('SELECT order_no, proof_key FROM orders WHERE id=?').bind(Number(params.id)).first();
  if(!order?.proof_key) return error('এই order-এ proof নেই।',404);
  const proof=await getDB(env).prepare('SELECT content_type, data FROM order_proofs WHERE order_no=?').bind(order.order_no).first();
  if(!proof) return error('Proof image পাওয়া যায়নি।',404);
  const headers=new Headers();
  headers.set('content-type',proof.content_type);
  headers.set('cache-control','private, no-store');
  headers.set('x-content-type-options','nosniff');
  return new Response(new Uint8Array(proof.data),{headers});
}
