'use client';

/**
 * Phase 5b — 리포트 본문 (A4 세로형).
 *
 * 페이지 분할:
 *   1. 표지/요약
 *   2. 입력 요약
 *   3. 에너지 산출 (월별)
 *   4. 수익 (월별)
 *   5. 경제성 (연도별 + Summary)
 *   6. AI 검토 의견
 */
import type { ReportSnapshot } from '@/lib/schemas/report';
import { fmtWon, fmtWonPerKWh, fmtYears, fmtPct, fmtKW, fmtKWh, fmtInt } from '@/lib/format';
import { ReportCharts } from '@/components/charts/ReportCharts';

interface Props {
  snapshot: ReportSnapshot;
  aiReview: string | null;
  aiLoading: boolean;
  aiSkipped: boolean;
}

export function ReportDocument({ snapshot, aiReview, aiLoading, aiSkipped }: Props) {
  const { inputs, settings, results, meta } = snapshot;
  const e = results.economics;
  const summary20 = e.summary.데이터.find((r) => r.기간_년 === 20);
  const createdAt = new Date(meta.createdAt).toLocaleString('ko-KR');

  return (
    <div className="report-root">
      {/* 1. 표지/요약 */}
      <section className="report-page">
        <h1>연료전지 경제성 분석 리포트</h1>
        <div className="report-meta">작성일시: {createdAt}</div>

        <h2>핵심 지표</h2>
        <div className="report-cards">
          <div className="report-card">
            <div className="label">초기투자비 (CAPEX)</div>
            <div className="value">{fmtWon(e.capex)}</div>
          </div>
          <div className="report-card">
            <div className="label">LCOE (전기)</div>
            <div className="value">{fmtWonPerKWh(e.lcoe_원per_kWh)}</div>
          </div>
          <div className="report-card">
            <div className="label">회수기간 (단순)</div>
            <div className="value">
              {results.paybackYears == null ? '회수 불가' : fmtYears(results.paybackYears)}
            </div>
          </div>
          <div className="report-card">
            <div className="label">기준 연간 유지보수비</div>
            <div className="value">{fmtWon(e.baseAnnualMaintenance)}</div>
          </div>
          <div className="report-card">
            <div className="label">20년 NPV</div>
            <div className="value">{fmtWon(summary20?.NPV_원)}</div>
          </div>
          <div className="report-card">
            <div className="label">20년 IRR</div>
            <div className="value">{fmtPct(summary20?.IRR)}</div>
          </div>
        </div>

        <h3>분석 조건</h3>
        <table>
          <tbody>
            <tr>
              <th>분석기간</th>
              <td>{settings.lifetime} 년</td>
              <th>할인율 (명목)</th>
              <td>{fmtPct(settings.discountRate)}</td>
            </tr>
            <tr>
              <th>유지보수 모드</th>
              <td>{settings.maintenanceMode === 'fixedCost' ? '라이브러리 단가' : '비율'}</td>
              <th>유지보수 비율</th>
              <td>{fmtPct(settings.maintenanceRatio)}</td>
            </tr>
            <tr>
              <th>전기 상승률</th>
              <td>{fmtPct(settings.electricityEscalation)}</td>
              <th>가스 상승률</th>
              <td>{fmtPct(settings.gasEscalation)}</td>
            </tr>
            <tr>
              <th>유지비 상승률</th>
              <td>{fmtPct(settings.maintenanceEscalation)}</td>
              <th>보일러 효율</th>
              <td>{fmtPct(settings.boilerEfficiency)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 2. 입력 요약 */}
      <section className="report-page">
        <h2>1. 입력 정보</h2>

        <h3>연료전지 세트 ({inputs.fuelCell.총설치용량_kW} kW 총 설치)</h3>
        <table>
          <thead>
            <tr>
              <th>형식</th>
              <th>제조사</th>
              <th>모델</th>
              <th>발전용량</th>
              <th>열생산용량</th>
              <th>수량</th>
            </tr>
          </thead>
          <tbody>
            {inputs.fuelCell.sets.map((s) => (
              <tr key={s.set_id}>
                <td>{s.형식 ?? '-'}</td>
                <td>{s.제조사 ?? '-'}</td>
                <td>{s.모델 ?? '-'}</td>
                <td>{fmtKW(s.발전용량_kW)}</td>
                <td>{fmtKW(s.열생산용량_kW)}</td>
                <td>{s.설치수량 ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>운전 프로파일</h3>
        <table>
          <tbody>
            <tr>
              <th>연간 운전유형</th>
              <td>{inputs.operation.연간운전유형 ?? '-'}</td>
              <th>연간 가동일</th>
              <td>{inputs.operation.연간운전일수 ?? '-'} 일</td>
            </tr>
            <tr>
              <th>일일 중간부하</th>
              <td>{inputs.operation.일일_중간부하_운전시간} h</td>
              <th>일일 최대부하</th>
              <td>{inputs.operation.일일_최대부하_운전시간} h</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 3. 에너지 산출 */}
      <section className="report-page">
        <h2>2. 에너지 생산량 / 사용량 (월별)</h2>
        <table>
          <thead>
            <tr>
              <th>월</th>
              <th>일수</th>
              <th>중간부하 발전</th>
              <th>최대부하 발전</th>
              <th>열 생산</th>
              <th>가스 사용</th>
            </tr>
          </thead>
          <tbody>
            {results.production.데이터.map((r) => (
              <tr key={r.월}>
                <td>{r.월}월</td>
                <td>{fmtInt(r.일수)}</td>
                <td>{fmtKWh(r.월간_중간부하시간_전력생산량_kWh)}</td>
                <td>{fmtKWh(r.월간_최대부하시간_전력생산량_kWh)}</td>
                <td>{fmtKWh(r.월간_연료전지_열생산량_kWh)}</td>
                <td>{fmtKWh(r.월간_도시가스사용량_kWh)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>합계</td>
              <td>{fmtInt(results.production.합계.일수)}</td>
              <td>{fmtKWh(results.production.합계.월간_중간부하시간_전력생산량_kWh)}</td>
              <td>{fmtKWh(results.production.합계.월간_최대부하시간_전력생산량_kWh)}</td>
              <td>{fmtKWh(results.production.합계.월간_연료전지_열생산량_kWh)}</td>
              <td>{fmtKWh(results.production.합계.월간_도시가스사용량_kWh)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* 4. 수익 */}
      <section className="report-page">
        <h2>3. 에너지 생산 수익 (월별)</h2>
        <table>
          <thead>
            <tr>
              <th>월</th>
              <th>일수</th>
              <th>발전 수익</th>
              <th>열 수익</th>
              <th>가스 요금</th>
              <th>최종 수익</th>
            </tr>
          </thead>
          <tbody>
            {results.revenue.데이터.map((r) => (
              <tr key={r.월}>
                <td>{r.월}월</td>
                <td>{fmtInt(r.일수)}</td>
                <td>{fmtWon(r.발전_월간총수익_원)}</td>
                <td>{fmtWon(r.열생산_월간총수익_원)}</td>
                <td>{fmtWon(r.도시가스사용요금_원)}</td>
                <td>{fmtWon(r.에너지생산_최종수익_원)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>합계</td>
              <td>{fmtInt(results.revenue.합계.일수)}</td>
              <td>{fmtWon(results.revenue.합계.발전_월간총수익_원)}</td>
              <td>{fmtWon(results.revenue.합계.열생산_월간총수익_원)}</td>
              <td>{fmtWon(results.revenue.합계.도시가스사용요금_원)}</td>
              <td>{fmtWon(results.revenue.합계.에너지생산_최종수익_원)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* 5. 경제성 */}
      <section className="report-page">
        <h2>4. 경제성 분석</h2>

        <h3>연도별 현금흐름 ({settings.lifetime}년)</h3>
        <table>
          <thead>
            <tr>
              <th>연도</th>
              <th>총수익</th>
              <th>유지비</th>
              <th>순현금흐름</th>
              <th>누적</th>
              <th>할인</th>
            </tr>
          </thead>
          <tbody>
            {e.annual.데이터.map((r) => (
              <tr key={r.연도}>
                <td>{r.연도}년</td>
                <td>{fmtWon(r.총수익_원)}</td>
                <td>{fmtWon(r.유지보수비용_원)}</td>
                <td>{fmtWon(r.순현금흐름_원)}</td>
                <td>{fmtWon(r.누적순현금흐름_원)}</td>
                <td>{fmtWon(r.할인순현금흐름_원)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>기간별 요약</h3>
        <table>
          <thead>
            <tr>
              <th>기간</th>
              <th>누적수익</th>
              <th>총비용</th>
              <th>ROI(투자)</th>
              <th>NPV</th>
              <th>IRR</th>
            </tr>
          </thead>
          <tbody>
            {e.summary.데이터.map((r) => (
              <tr key={r.기간_년}>
                <td>{r.기간_년}년</td>
                <td>{fmtWon(r.누적수익_원)}</td>
                <td>{fmtWon(r.총비용_원)}</td>
                <td>{fmtPct(r.ROI_초기투자)}</td>
                <td>{fmtWon(r.NPV_원)}</td>
                <td>{fmtPct(r.IRR)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 6. 차트 */}
      <section className="report-page">
        <h2>5. 시각화</h2>
        <ReportCharts snapshot={snapshot} />
      </section>

      {/* 7. AI 검토 */}
      <section className="report-page">
        <h2>6. AI 검토 의견</h2>
        {aiLoading && <p className="text-zinc-500">AI 검토 의견 생성 중...</p>}
        {aiReview && <p style={{ whiteSpace: 'pre-wrap' }}>{aiReview}</p>}
        {aiSkipped && !aiReview && (
          <p className="report-meta">
            AI 검토 기능이 비활성화되어 있습니다. (GEMINI_API_KEY 미설정 또는 API 오류)
          </p>
        )}
        {!aiLoading && !aiReview && !aiSkipped && (
          <p className="report-meta">
            AI 검토는 리포트를 서버에 저장한 경우에만 자동 생성됩니다. 임시 미리보기 모드에서는
            생략됩니다.
          </p>
        )}
      </section>
    </div>
  );
}
