import { json, error, bodyJSON, cleanText } from '../../_shared/http.js';
import { requireAdmin, guardOrigin } from '../../_shared/auth.js';

const keys = ['store_name','tagline','about','phone','whatsapp','facebook','instagram','address','email','shipping_fee','payment_bkash','payment_nagad','payment_rocket','payment_card_url','payment_instructions'];
export async function onRequestPut({ request, env }) {
  const blocked=await guardOrigin(request); if(blocked) return blocked;
  const admin=await requireAdmin(request,env); if(admin instanceof Response) return admin;
  let b; try{b=await bodyJSON(request);}catch(e){return error(e.message);}
  const stmts=[];
  for(const key of keys){if(key in b){let value=cleanText(b[key], key==='about'||key==='payment_instructions'?2000:500); if(key==='shipping_fee' && (!/^\d+$/.test(value)||Number(value)>100000)) return error('Delivery charge সঠিক নয়।'); if(['whatsapp','facebook','instagram','payment_card_url'].includes(key) && value && !/^(https:\/\/|\+?\d)/i.test(value)) return error(`${key} value সঠিক নয়।`); stmts.push(env.DB.prepare('INSERT INTO store_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,value));}}
  if(stmts.length) await env.DB.batch(stmts);
  return json({ok:true});
}
