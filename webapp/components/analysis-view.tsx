import { GLOSSARY_ORDER, GA4_GLOSSARY } from '@/lib/ga4/glossary';
import { formatMetricValue } from '@/lib/ga4/parser';
import type {
  DatasetSummary,
  LocalCoachAnalysis,
  LocalWorkspaceAnalysis,
  SnapshotComparison
} from '@/lib/ga4/types';
import { ReportChart } from '@/components/report-chart';

type AnalysisViewProps = {
  analysis: LocalWorkspaceAnalysis;
  datasets: DatasetSummary[];
  coachAnalysis?: LocalCoachAnalysis | null;
  comparison?: SnapshotComparison | null;
};

export function AnalysisView({
  analysis,
  datasets,
  coachAnalysis,
  comparison
}: AnalysisViewProps) {
  const coach = coachAnalysis ?? analysis.localCoach;

  return (
    <div className="stack-18">
      <section className="section-block">
        <div className="section-head">
          <div>
            <p className="section-kicker">Summary</p>
            <h2 className="section-title">まず押さえる数字</h2>
          </div>
          <p className="muted-copy">{analysis.workspaceSummary.caption}</p>
        </div>
        <div className="summary-grid">
          {analysis.workspaceSummary.cards.map((card) => (
            <article className="summary-card" key={card.label}>
              <p className="metric-label">{card.label}</p>
              <strong>{card.value}</strong>
              <p className="muted">{card.help}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="card-grid-2">
          <div className="stack-18">
            <div className="section-head">
              <div>
                <p className="section-kicker">Quantitative</p>
                <h2 className="section-title">定量的に見えたこと</h2>
              </div>
            </div>
            {analysis.quantitativeFindings.length ? (
              analysis.quantitativeFindings.map((finding) => (
                <article className="insight-card" key={finding.title}>
                  <h3>{finding.title}</h3>
                  <p>{finding.evidence}</p>
                  <p className="muted">{finding.action}</p>
                </article>
              ))
            ) : (
              <div className="center-empty">大きな偏りは見つかりませんでした。</div>
            )}
          </div>

          <div className="stack-18">
            <div className="section-head">
              <div>
                <p className="section-kicker">Where To Look</p>
                <h2 className="section-title">次に開く GA4 レポート</h2>
              </div>
            </div>
            {analysis.reportGuidance.map((guide) => (
              <article className="route-card" key={guide.report}>
                <h3>{guide.report}</h3>
                <p>{guide.whatToCheck}</p>
                <p className="muted">{guide.why}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <div>
            <p className="section-kicker">Coach</p>
            <h2 className="section-title">初心者向けの読み方ガイド</h2>
          </div>
        </div>

        <div className="stack-18">
          <article className="glass-panel">
            <p className="muted-copy">{coach.overview}</p>
          </article>

          <div className="card-grid-2">
            <div className="stack-18">
              {coach.findings.map((finding) => (
                <article className="insight-card" key={finding.title}>
                  <h3>{finding.title}</h3>
                  <p>{finding.evidence}</p>
                  <p className="muted">{finding.whyItMatters}</p>
                </article>
              ))}
            </div>

            <div className="stack-18">
              <article className="glass-panel">
                <p className="small-label">Next Questions</p>
                <h3 className="panel-title">次に自分へ投げる質問</h3>
                <div className="question-chip-grid" style={{ marginTop: 14 }}>
                  {coach.nextQuestions.map((question) => (
                    <div className="pill-button" key={question}>
                      {question}
                    </div>
                  ))}
                </div>
              </article>

              <article className="glass-panel">
                <p className="small-label">Next Actions</p>
                <h3 className="panel-title">次のアクション</h3>
                <ul className="bullet-list" style={{ marginTop: 14 }}>
                  {coach.nextActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </article>

              <article className="glass-panel">
                <p className="small-label">Data Quality</p>
                <h3 className="panel-title">データ品質メモ</h3>
                <ul className="bullet-list" style={{ marginTop: 14 }}>
                  {coach.dataQuality.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </div>
      </section>

      {comparison ? (
        <section className="section-block">
          <div className="section-head">
            <div>
              <p className="section-kicker">Comparison</p>
              <h2 className="section-title">前回スナップショットとの差分</h2>
            </div>
          </div>

          <div className="card-grid-2">
            {comparison.datasets.map((datasetComparison) => (
              <article className="comparison-card" key={datasetComparison.reportName}>
                <p className="small-label">{datasetComparison.primaryDimension}</p>
                <h3>{datasetComparison.reportName}</h3>
                <p className="muted">{datasetComparison.note}</p>
                {datasetComparison.comparable ? (
                  <div className="stack-18">
                    {datasetComparison.metrics.map((metric) => (
                      <div key={`${datasetComparison.reportName}-${metric.rowLabel}-${metric.key}`}>
                        <p>
                          {metric.rowLabel} / {metric.label}: {formatMetricValue(metric.currentValue)}
                        </p>
                        <p className="muted">
                          前回 {formatMetricValue(metric.previousValue)} / 差分{' '}
                          {metric.relativeDelta == null
                            ? formatMetricValue(metric.absoluteDelta)
                            : `${formatMetricValue(metric.absoluteDelta)} (${formatMetricValue(metric.relativeDelta, {
                                percent: true
                              })})`}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="section-block">
        <div className="section-head">
          <div>
            <p className="section-kicker">Reports</p>
            <h2 className="section-title">アップロードしたレポートの内訳</h2>
          </div>
        </div>
        <div className="dataset-grid">
          {datasets.map((dataset) => {
            const topRow = dataset.topRows[0];
            return (
              <article className="dataset-card" key={`${dataset.fileName}-${dataset.reportName}`}>
                <p className="small-label">{dataset.type}</p>
                <h3>{dataset.reportName}</h3>
                <p>{dataset.fileName}</p>
                <div className="divider" />
                <p className="muted-copy">主要指標: {dataset.primaryMetric.label}</p>
                <p className="muted-copy">
                  上位項目:{' '}
                  {topRow
                    ? `${topRow.label} (${formatMetricValue(topRow.share, { percent: true })})`
                    : '—'}
                </p>
                <p className="muted-copy">
                  期間: {dataset.startDate || '—'} 〜 {dataset.endDate || '—'}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section-block">
        <div className="card-grid-2">
          {datasets.map((dataset) => (
            <ReportChart dataset={dataset} key={`chart-${dataset.fileName}-${dataset.reportName}`} />
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <div>
            <p className="section-kicker">Glossary</p>
            <h2 className="section-title">GA4 用語の早見表</h2>
          </div>
        </div>
        <div className="glossary-grid">
          {GLOSSARY_ORDER.map((term) => {
            const item = GA4_GLOSSARY[term];
            return (
              <article className="glossary-card" key={item.term}>
                <h3>{item.term}</h3>
                <p>{item.summary}</p>
                <p className="muted">{item.tip}</p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
