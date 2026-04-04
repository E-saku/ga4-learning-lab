import type {
  DatasetSummary,
  LocalCoachAnalysis,
  LocalWorkspaceAnalysis,
  QuantitativeFinding,
  ReportGuidance,
  UserAnswers,
  WorkspaceSummary
} from '@/lib/ga4/types';
import { formatMetricValue } from '@/lib/ga4/parser';

const FOCUS_LABELS = {
  overview: '全体像',
  acquisition: '集客',
  engagement: '行動',
  conversion: '成果導線',
  tech: '技術面'
} as const;

export function buildWorkspaceSummary(datasets: DatasetSummary[], answers: UserAnswers): WorkspaceSummary {
  const totals = collectTotals(datasets);
  const reportTypes = [...new Set(datasets.map((dataset) => dataset.type))];
  const cards = [
    {
      label: '読み込んだレポート',
      value: `${datasets.length} 件`,
      help: datasets.map((dataset) => dataset.reportName).join(' / ')
    }
  ];

  if (totals.sessions != null) {
    cards.push({
      label: 'セッション合計',
      value: formatMetricValue(totals.sessions, { compact: true }),
      help: '流入全体の大きさ'
    });
  }

  if (totals.activeUsers != null) {
    cards.push({
      label: 'アクティブユーザー',
      value: formatMetricValue(totals.activeUsers, { compact: true }),
      help: '実際に行動した人の規模'
    });
  }

  if (totals.engagementRate != null) {
    cards.push({
      label: '平均エンゲージメント率',
      value: formatMetricValue(totals.engagementRate, { percent: true }),
      help: '訪問の質の目安'
    });
  }

  if (totals.keyEvents != null) {
    cards.push({
      label: 'キーイベント',
      value: formatMetricValue(totals.keyEvents),
      help: '成果地点の総数'
    });
  }

  if (totals.revenue != null && totals.revenue > 0) {
    cards.push({
      label: '合計収益',
      value: formatMetricValue(totals.revenue, { currency: true }),
      help: '売上系の指標'
    });
  }

  return {
    cards: cards.slice(0, 5),
    caption: `${FOCUS_LABELS[answers.focus]}を中心に ${reportTypes.length} 種類のレポートを横断しています。`
  };
}

export function buildQuantitativeFindings(datasets: DatasetSummary[]): QuantitativeFinding[] {
  const findings: QuantitativeFinding[] = [];

  datasets.forEach((dataset) => {
    const topRow = dataset.topRows[0];
    if (topRow && topRow.share >= 0.55) {
      findings.push({
        title: `${dataset.reportName} は上位 1 項目への依存が高いです`,
        evidence: `${topRow.label} が ${dataset.primaryMetric.label} の ${formatMetricValue(topRow.share, {
          percent: true
        })} を占めています。`,
        action: '2位以下との差が大きいので、変化が起きたときの影響を受けやすい状態です。'
      });
    }

    if (dataset.avgEngagementRate != null) {
      const weakRow = dataset.topRows.find(
        (row) =>
          row.engagementRate != null &&
          row.share >= 0.12 &&
          row.engagementRate < dataset.avgEngagementRate! - 0.12
      );
      if (weakRow) {
        findings.push({
          title: `${weakRow.label} は量に対して反応が弱めです`,
          evidence: `エンゲージメント率 ${formatMetricValue(weakRow.engagementRate, {
            percent: true
          })}。全体平均は ${formatMetricValue(dataset.avgEngagementRate, { percent: true })} です。`,
          action: '入口ページ、訴求文、技術面の問題を順に点検する候補です。'
        });
      }
    }

    if (dataset.type === 'tech') {
      const lowBrowser = dataset.topRows.find(
        (row) => row.engagementRate != null && row.engagementRate < 0.2
      );
      if (lowBrowser) {
        findings.push({
          title: 'ブラウザ差分の確認が必要そうです',
          evidence: `${lowBrowser.label} のエンゲージメント率が ${formatMetricValue(lowBrowser.engagementRate, {
            percent: true
          })} です。`,
          action: '実機での表示崩れ、Cookie同意、CTAクリックを優先確認してください。'
        });
      }
    }

    if (dataset.keyEventsTotal === 0) {
      findings.push({
        title: `${dataset.reportName} ではキーイベントが見えていません`,
        evidence: '成果地点が0のため、良い流入と悪い流入を切り分けづらい状態です。',
        action: '管理 > イベント / キーイベント設定、または出力レポートの種類を確認してください。'
      });
    }
  });

  return dedupe(findings, 'title').slice(0, 6);
}

export function buildReportGuidance(datasets: DatasetSummary[], answers: UserAnswers): ReportGuidance[] {
  const items: ReportGuidance[] = [];
  items.push(...focusRoutes(answers.focus));

  if (datasets.some((dataset) => dataset.type === 'acquisition')) {
    items.push({
      report: 'レポート > 集客 > トラフィック獲得',
      whatToCheck: 'セッション数が多いチャネルと、エンゲージメント率が高いチャネルが同じかを見る',
      why: '量と質の両方が揃う流入源を見つけやすくなります。'
    });
  }

  if (datasets.some((dataset) => dataset.type === 'engagement')) {
    items.push({
      report: 'レポート > エンゲージメント > ページとスクリーン',
      whatToCheck: '表示回数の多いページの平均エンゲージメント時間やイベント数を比較する',
      why: '流入後の読み進めやすさや導線の弱点が見えます。'
    });
  }

  if (datasets.some((dataset) => dataset.type === 'conversion')) {
    items.push({
      report: 'レポート > エンゲージメント > イベント',
      whatToCheck: '問い合わせ完了や購入完了などのイベントが、どこから来たユーザーで多いかを見る',
      why: '成果につながる経路の切り分けがしやすくなります。'
    });
  }

  if (datasets.some((dataset) => dataset.type === 'tech')) {
    items.push({
      report: 'レポート > ユーザー属性 > 技術',
      whatToCheck: 'ブラウザ別にエンゲージメント率とキーイベント数を比較する',
      why: '特定環境だけで起きているUX / 計測トラブルを見つけやすいです。'
    });
  }

  items.push({
    report: '探索 > 自由形式',
    whatToCheck: 'チャネル × ランディングページ × キーイベントで表を作り、どこで落ちるかを見る',
    why: '標準レポートだけで掴みにくい組み合わせ分析ができます。'
  });

  return dedupe(items, 'report').slice(0, 6);
}

export function buildLocalCoachAnalysis(
  datasets: DatasetSummary[],
  answers: UserAnswers,
  reportGuidance = buildReportGuidance(datasets, answers)
): LocalCoachAnalysis {
  const findings: LocalCoachAnalysis['findings'] = [];
  const nextActions: string[] = [];
  const nextQuestions: string[] = [];
  const dataQuality: string[] = [];

  datasets.forEach((dataset) => {
    const primaryMetric = dataset.primaryMetric.label || '主要指標';
    const topRow = dataset.topRows[0];
    const weakRow = dataset.topRows.find((row) => {
      if (row.engagementRate == null || dataset.avgEngagementRate == null) return false;
      return row.share >= 0.12 && row.engagementRate < dataset.avgEngagementRate - 0.12;
    });

    if (topRow?.share >= 0.55) {
      findings.push({
        title: `${dataset.reportName} は上位項目への依存が強い状態です`,
        evidence: `${topRow.label} が ${primaryMetric} の ${formatMetricValue(topRow.share, { percent: true })} を占めています。`,
        whyItMatters: '1つの流入元やブラウザに偏ると、急な変化が起きたときに全体の数字が大きく揺れます。'
      });
    }

    if (weakRow) {
      findings.push({
        title: `${weakRow.label} は量があるのに質が弱めです`,
        evidence: `${weakRow.label} のエンゲージメント率は ${formatMetricValue(weakRow.engagementRate, {
          percent: true
        })} で、全体平均 ${formatMetricValue(dataset.avgEngagementRate, { percent: true })} を下回っています。`,
        whyItMatters: '流入は確保できていても、訪問後の体験が期待とずれている可能性があります。'
      });
    }

    if (dataset.type === 'tech') {
      const browserGap = dataset.topRows.find(
        (row) => row.label !== 'Chrome' && row.engagementRate != null && row.engagementRate < 0.25
      );
      if (browserGap) {
        findings.push({
          title: 'ブラウザ別の体験差を点検した方がよさそうです',
          evidence: `${browserGap.label} のエンゲージメント率が ${formatMetricValue(browserGap.engagementRate, {
            percent: true
          })} でした。`,
          whyItMatters: '計測漏れや表示崩れがあると、流入や広告以前に技術面がボトルネックになります。'
        });
      }
    }

    if (dataset.keyEventsTotal === 0) {
      dataQuality.push(
        `${dataset.reportName}: キーイベントが0のため、成果地点の設定またはCSVの対象レポートを確認してください。`
      );
    }
  });

  nextActions.push(
    '最初の15分は、流入量が多い項目とエンゲージメント率が低い項目を1つずつ特定する',
    'キーイベントが0の場合は、管理 > イベント / キーイベント設定を確認する',
    '改善対象を1つだけ決め、次回CSVで同じレポートを比較する'
  );

  nextQuestions.push(
    '流入は多いのに、その後の行動が弱いチャネルはどれですか？',
    'ブラウザやデバイスによって極端に数字が悪い組み合わせはありますか？',
    'キーイベントを増やしたいなら、どの入口ページから見直すべきですか？'
  );

  return {
    overview: buildOverview(datasets, answers),
    findings: dedupe(findings, 'title').slice(0, 6),
    reportGuidance,
    nextQuestions: dedupe(nextQuestions, ''),
    nextActions: dedupe(nextActions, ''),
    dataQuality: dataQuality.length ? dedupe(dataQuality, '') : ['大きなデータ品質アラートは見つかりませんでした。']
  };
}

export function buildLocalWorkspaceAnalysis(
  datasets: DatasetSummary[],
  answers: UserAnswers
): LocalWorkspaceAnalysis {
  const workspaceSummary = buildWorkspaceSummary(datasets, answers);
  const quantitativeFindings = buildQuantitativeFindings(datasets);
  const reportGuidance = buildReportGuidance(datasets, answers);
  const localCoach = buildLocalCoachAnalysis(datasets, answers, reportGuidance);

  return {
    workspaceSummary,
    quantitativeFindings,
    reportGuidance,
    localCoach
  };
}

function buildOverview(datasets: DatasetSummary[], answers: UserAnswers): string {
  if (!datasets.length) {
    return 'CSV がまだ読み込まれていないため、まずは見たい GA4 レポートを 1 つ以上アップロードしてください。';
  }

  const datasetNames = datasets.map((dataset) => dataset.reportName).join(' / ');
  return `${FOCUS_LABELS[answers.focus]} を軸に ${datasets.length} 件のCSVを整理しました。今回のアップロードには「${datasetNames}」が含まれているため、量の大きい項目と、量に対して質が弱い項目を両方見ると全体像をつかみやすいです。`;
}

function collectTotals(datasets: DatasetSummary[]) {
  const result: {
    sessions: number | null;
    activeUsers: number | null;
    engagementRate: number | null;
    keyEvents: number | null;
    revenue: number | null;
  } = {
    sessions: null,
    activeUsers: null,
    engagementRate: null,
    keyEvents: null,
    revenue: null
  };

  const sessions = sumMetric(datasets, /セッション|sessions/i);
  if (sessions > 0) result.sessions = sessions;

  const activeUsers = sumMetric(datasets, /アクティブ ユーザー|アクティブユーザー|active users/i);
  if (activeUsers > 0) result.activeUsers = activeUsers;

  const keyEvents = sumMetric(datasets, /キーイベント|key events|conversions/i);
  if (keyEvents >= 0) result.keyEvents = keyEvents;

  const revenue = sumMetric(datasets, /合計収益|total revenue|purchase revenue/i);
  if (revenue > 0) result.revenue = revenue;

  const rates = datasets.map((dataset) => dataset.avgEngagementRate).filter((value): value is number => value != null);
  if (rates.length) {
    result.engagementRate = rates.reduce((sum, value) => sum + value, 0) / rates.length;
  }

  return result;
}

function focusRoutes(focus: UserAnswers['focus']): ReportGuidance[] {
  switch (focus) {
    case 'acquisition':
      return [
        {
          report: 'レポート > 集客 > トラフィック獲得',
          whatToCheck: '量が多いチャネルと、質が高いチャネルが一致しているか',
          why: '広告やSEOの改善優先順位を決めやすいからです。'
        }
      ];
    case 'engagement':
      return [
        {
          report: 'レポート > エンゲージメント > ページとスクリーン',
          whatToCheck: '入口ページごとの表示回数、エンゲージメント時間、イベント数',
          why: 'コンテンツ改善や導線改善の候補を先に絞れます。'
        }
      ];
    case 'conversion':
      return [
        {
          report: 'レポート > エンゲージメント > イベント',
          whatToCheck: 'キーイベントの多い経路と少ない経路を比べる',
          why: '成果地点の前後でどこが弱いか判断しやすいからです。'
        }
      ];
    case 'tech':
      return [
        {
          report: 'レポート > ユーザー属性 > 技術',
          whatToCheck: 'ブラウザ・デバイス別に、極端に悪い数値がないか',
          why: '実装不具合の切り分けがしやすいからです。'
        }
      ];
    default:
      return [
        {
          report: 'ホーム > レポートのスナップショット',
          whatToCheck: 'ユーザー数、セッション、エンゲージメント率、キーイベントを順に確認する',
          why: '最初に全体像を見てから深掘りすると迷いが減るからです。'
        }
      ];
  }
}

function sumMetric(datasets: DatasetSummary[], matcher: RegExp): number {
  return datasets.reduce((sum, dataset) => {
    const entry = Object.entries(dataset.numericTotals).find(([header]) => matcher.test(header));
    return sum + (entry ? entry[1].total : 0);
  }, 0);
}

function dedupe<T extends Record<string, unknown> | string>(items: T[], key: string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = typeof item === 'string' ? item : String(item[key] ?? '');
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
