export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." });

  try {
    const image = req.body?.image;
    if (!image || !image.startsWith("data:image/")) {
      return res.status(400).json({ error: "이미지 데이터가 없습니다." });
    }

    const match = image.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: "이미지 형식 오류" });
    const mimeType = match[1];
    const base64 = match[2];

    const prompt = `
너는 한국 아파트 평면도 치수 판독기다.
목표는 토리매트 견적 계산기에 넣을 '거실, 복도, 주방'의 가로/세로 치수를 추출하는 것이다.

규칙:
1) 도면에 실제로 인쇄된 치수 숫자와 치수선만 근거로 사용한다.
2) 숫자를 추측하거나 벽 비율만 보고 새 치수를 만들어내지 않는다.
3) 도면 숫자는 보통 mm이다. 예: 4720 -> 472.0cm.
4) 거실, 복도, 주방이 서로 연결되어 있어도 회사 계산기는 각 구간 가로/세로를 따로 입력한다.
5) 어느 숫자가 어느 공간에 해당하는지 불확실하면 width_cm 또는 height_cm를 null로 두고 confidence를 "low"로 한다.
6) 현관, 침실, 욕실, 발코니 등의 치수는 요청 대상이 아니면 제외한다.
7) 같은 공간에 여러 후보가 있으면 가장 직접적인 내부 유효 치수선을 우선한다.
8) 주방 아일랜드/가구 크기를 방 전체 치수로 착각하지 않는다.

반드시 아래 JSON 형식만 반환:
{
  "rooms":[
    {"name":"거실","width_cm":number|null,"height_cm":number|null,"source_dimensions_mm":[number],"confidence":"high|medium|low"},
    {"name":"복도","width_cm":number|null,"height_cm":number|null,"source_dimensions_mm":[number],"confidence":"high|medium|low"},
    {"name":"주방","width_cm":number|null,"height_cm":number|null,"source_dimensions_mm":[number],"confidence":"high|medium|low"}
  ],
  "all_dimension_candidates_mm":[number],
  "notes":"짧은 설명"
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const raw = await r.json();
    if (!r.ok) {
      return res.status(500).json({ error: raw?.error?.message || "Gemini API 오류" });
    }

    const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: "AI 응답이 비어 있습니다." });

    let parsed;
    try { parsed = JSON.parse(text); }
    catch { return res.status(500).json({ error: "AI JSON 파싱 실패", raw: text }); }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message || "서버 오류" });
  }
}
