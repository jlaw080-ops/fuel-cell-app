'use server';

/**
 * Phase 5e — Gemini 검토 의견 생성.
 *
 * GEMINI_API_KEY 환경변수가 없으면 graceful skip (null 반환).
 * API 호출은 서버 측에서만. 출력은 한국어 ~500자.
 */
import type { ReportSnapshot } from '@/lib/schemas/report';

export type AiReviewResult =
  | { ok: true; review: string }
  | { ok: false; reason: 'no_key' | 'api_error'; error?: string };

const MODEL = 'gemini-2.0-flash';

export async function generateAiReview(snapshot: ReportSnapshot): Promise<AiReviewResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, reason: 'no_key' };

  const prompt = buildPrompt(snapshot);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 800,
          },
        }),
      },
    );
    if (!res.ok) {
      return { ok: false, reason: 'api_error', error: `HTTP ${res.status}` };
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ok: false, reason: 'api_error', error: '응답 텍스트 없음' };
    return { ok: true, review: text.trim() };
  } catch (e) {
    return { ok: false, reason: 'api_error', error: String(e) };
  }
}

function buildPrompt(s: ReportSnapshot): string {
  const e = s.results.economics;
  const summary20 = e.summary.데이터.find((r) => r.기간_년 === 20);
  const totalCapacity = s.inputs.fuelCell.총설치용량_kW;

  return `다음 연료전지 경제성 분석 결과를 전문 엔지니어 관점에서 검토해주세요.
A4 한 페이지 이내(약 400~500자)의 한국어 검토 의견을 작성하세요.

## 분석 개요
- 총 설치용량: ${totalCapacity} kW
- 연간 운전 유형: ${s.inputs.operation.연간운전유형}
- 일일 운전시간: 중간부하 ${s.inputs.operation.일일_중간부하_운전시간}h, 최대부하 ${s.inputs.operation.일일_최대부하_운전시간}h
- 분석기간: ${s.settings.lifetime}년, 할인율: ${(s.settings.discountRate * 100).toFixed(1)}%

## 주요 결과
- 초기투자비(CAPEX): ${fmt(e.capex)} 원
- LCOE: ${fmt(e.lcoe_원per_kWh)} 원/kWh
- 회수기간: ${s.results.paybackYears == null ? '회수 불가' : s.results.paybackYears.toFixed(2) + '년'}
- 20년 NPV: ${fmt(summary20?.NPV_원)} 원
- 20년 IRR: ${summary20?.IRR == null ? '산정 불가' : (summary20.IRR * 100).toFixed(2) + '%'}
- 20년 ROI(투자): ${summary20?.ROI_초기투자 == null ? '-' : (summary20.ROI_초기투자 * 100).toFixed(1) + '%'}

다음 관점에서 의견을 제시하세요:
1. 경제성 판단 (투자 타당성)
2. 주요 리스크/민감도
3. 개선 방향 제안

장황한 수식 설명은 피하고, 실무적이고 객관적인 톤으로 작성하세요.`;
}

function fmt(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-';
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(n);
}
