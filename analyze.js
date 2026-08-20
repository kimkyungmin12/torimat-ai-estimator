export default async function handler(req,res){
if(req.method!=="POST") return res.status(405).json({error:"POST only"});
const apiKey=process.env.GEMINI_API_KEY;
if(!apiKey) return res.status(500).json({error:"GEMINI_API_KEY가 설정되지 않았습니다."});
try{
const image=req.body?.image; const m=image?.match(/^data:(image\/[^;]+);base64,(.+)$/);
if(!m) return res.status(400).json({error:"이미지 형식 오류"});
const prompt=`너는 한국 아파트 평면도 치수 판독기다. 도면에 실제로 인쇄된 숫자와 치수선만 근거로 거실, 복도, 주방의 가로/세로를 cm로 추출하라. 도면 숫자는 보통 mm이므로 4720은 472.0cm다. 보이지 않는 치수는 추측하지 말고 null로 반환하라. 침실/욕실/발코니/현관/가구 치수를 섞지 마라. JSON만 반환: {"rooms":[{"name":"거실","width_cm":number|null,"height_cm":number|null,"confidence":"high|medium|low"},{"name":"복도","width_cm":number|null,"height_cm":number|null,"confidence":"high|medium|low"},{"name":"주방","width_cm":number|null,"height_cm":number|null,"confidence":"high|medium|low"}],"notes":"짧은 설명"}`;
const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
const payload={contents:[{parts:[{text:prompt},{inline_data:{mime_type:m[1],data:m[2]}}]}],generationConfig:{responseMimeType:"application/json"}};
const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
const raw=await r.json(); if(!r.ok) return res.status(r.status).json({error:raw?.error?.message||"Gemini API 오류"});
const text=raw?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("").trim();
if(!text) return res.status(500).json({error:"AI 응답이 비어 있습니다."});
return res.status(200).json(JSON.parse(text));
}catch(e){return res.status(500).json({error:e?.message||"서버 오류"})}}