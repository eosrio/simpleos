const fs = require('node:fs');
const source = fs.readFileSync('src-tauri/src/antelope/chain_config.rs','utf8').split('pub fn default_chains()')[1].split('pub fn default_testnets()')[0];
const chains = [...source.matchAll(/id: "([a-f0-9]+)"\.into\(\),\s*name: "([^"]+)"[\s\S]*?endpoints: vec!\[([\s\S]*?)\],/g)].map(m=>({id:m[1],name:m[2],urls:[...m[3].matchAll(/url: "([^"]+)"/g)].map(x=>x[1])}));
(async()=>{
const results=await Promise.all(chains.map(async c=>{
 const endpoints=await Promise.all(c.urls.map(async url=>{
  const start=Date.now();
  try {const res=await fetch(url+'/v1/chain/get_info',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(8000),redirect:'error'});if(!res.ok)return {url,status:res.status}; const info=await res.json();return {url,status:res.status,chainMatches:info.chain_id===c.id,headLagSeconds:Math.round((Date.now()-Date.parse(info.head_block_time+'Z'))/1000),latencyMs:Date.now()-start};}
  catch(e){return {url,error:e.message};}
 }));
 return {name:c.name,chainId:c.id,endpoints};
}));
fs.writeFileSync('tmp/readiness-endpoints.json',JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));console.log(JSON.stringify(results,null,2));
})();
