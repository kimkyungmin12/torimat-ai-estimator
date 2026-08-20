export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"POST only"});

  const apiKey=process.env.GEMINI_API_KEY;
  if(!apiKey) return res.status(500).json({error:"GEMINI_API_KEY가 설정되지 않았습니다."});

  try{
    const image=req.body?.image;
    const m=image?.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if(!m) return res.status(400).json({error:"이미지 형식 오류"});

    const prompt = `
너는 한국 아파트 평면도 기반 토리매트 자동견적 분석기다.

목표:
1) 도면에 적힌 모든 치수 숫자를 가능한 한 많이 읽는다.
2) 거실/복도/주방의 시공영역 치수를 만든다.
3) 직접 표기되지 않은 값은 아래 우선순위로 복원한다.
4) 최종 계산은 별도 프론트엔드가 수행하므로 너는 치수와 근거만 반환한다.

치수 복원 우선순위:
A. direct = 도면에 직접 표기된 치수선을 그대로 사용
B. derived = 전체 치수 - 다른 구간 합, 또는 여러 표기치수의 합/차로 정확하게 계산 가능한 값
C. scale = 도면에서 직접 표기된 확정 치수를 기준 스케일로 삼아 같은 축 픽셀 비율로 환산한 값
D. ai = 위 3개로도 불가능할 때만 구조적 추정. 이 경우 confidence는 반드시 low

중요:
- direct > derived > scale > ai 순서로 우선한다.
- 보이지 않는 값을 바로 ai로 만들지 말고, 반드시 derived 가능 여부를 먼저 검토한다.
- 도면 치수는 보통 mm. 4500 = 450.0cm.
- 침실, 욕실, 발코니, 현관, 팬트리, 가구 크기를 거실/복도/주방 치수로 오인하지 않는다.
- 하나의 연결 시공영역을 직사각형 여러 개로 나누는 것이 더 정확하면 extra_regions에 추가해도 된다.
- 겹치는 직사각형을 만들지 않는다.
- 같은 면적을 중복 계산하지 않는다.
- 치수선의 위치와 벽 경계를 함께 해석한다.
- confidence:
  high = 직접표기 또는 명확한 합/차
  medium = 픽셀 비례 환산
  low = AI 구조 추정

반드시 JSON만 반환:
{
  "dimensions":[
    {
      "value_mm": number,
      "orientation":"horizontal|vertical|unknown",
      "location":"도면에서의 위치를 짧게 설명"
    }
  ],
  "rooms":[
    {
      "name":"거실",
      "width_cm":number|null,
      "height_cm":number|null,
      "width_source":"direct|derived|scale|ai|unknown",
      "height_source":"direct|derived|scale|ai|unknown",
      "width_confidence":"high|medium|low",
      "height_confidence":"high|medium|low",
      "reason":"어떤 치수/계산/비율을 썼는지 짧게 설명"
    },
    {
      "name":"복도",
      "width_cm":number|null,
      "height_cm":number|null,
      "width_source":"direct|derived|scale|ai|unknown",
      "height_source":"direct|derived|scale|ai|unknown",
      "width_confidence":"high|medium|low",
      "height_confidence":"high|medium|low",
      "reason":"짧게"
    },
    {
      "name":"주방",
      "width_cm":number|null,
      "height_cm":number|null,
      "width_source":"direct|derived|scale|ai|unknown",
      "height_source":"direct|derived|scale|ai|unknown",
      "width_confidence":"high|medium|low",
      "height_confidence":"high|medium|low",
      "reason":"짧게"
    }
  ],
  "extra_regions":[
    {
      "name":"추가 구간 이름",
      "width_cm":number,
      "height_cm":number,
      "width_source":"direct|derived|scale|ai",
      "height_source":"direct|derived|scale|ai",
      "width_confidence":"high|medium|low",
      "height_confidence":"high|medium|low",
      "reason":"왜 별도 직사각형으로 분할했는지"
    }
  ],
  "notes":"전체 분석 요약과 특히 주의할 추정값"
}`;

    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    const payload={
      contents:[{
        parts:[
          {text:prompt},
          {inline_data:{mime_type:m[1],data:m[2]}}
        ]
      }],
      generationConfig:{responseMimeType:"application/json"}
    };

    const r=await fetch(url,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });

    const raw=await r.json();
    if(!r.ok) return res.status(r.status).json({error:raw?.error?.message||"Gemini API 오류"});

    const text=raw?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("").trim();
    if(!text) return res.status(500).json({error:"AI 응답이 비어 있습니다."});

    let parsed;
    try{ parsed=JSON.parse(text); }
    catch{ return res.status(500).json({error:"AI JSON 파싱 실패",raw:text.slice(0,1000)}); }

    return res.status(200).json(parsed);
  }catch(e){
    return res.status(500).json({error:e?.message||"서버 오류"});
  }
}