# 토리매트 AI 자동견적

## 기능
- 이미지 파일 업로드
- Ctrl+V 이미지 붙여넣기
- 드래그앤드롭
- Gemini 비전 API로 거실/복도/주방 치수 추출
- AI 결과 직접 수정
- 회사 계산기와 동일한 80매트 계산식
  - 각 구간: ceil(가로cm / 50) × ceil(세로cm / 50)
  - 합산 후: floor(totalUnits / 2.56)

## Vercel 배포
1. 이 폴더를 GitHub 저장소에 올립니다.
2. Vercel에서 해당 저장소를 Import 합니다.
3. Vercel 프로젝트 > Settings > Environment Variables
4. 이름: GEMINI_API_KEY
5. 값: Google AI Studio에서 발급한 API Key
6. Redeploy

API 키는 index.html에 절대 넣지 않습니다.
