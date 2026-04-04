import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { buildLocalCoachAnalysis } from '@/lib/ga4/insights';
import type { DatasetSummary, LocalCoachAnalysis, UserAnswers } from '@/lib/ga4/types';
import { getServerEnv, isAiConfigured } from '@/lib/server/env';

const coachSchema = z.object({
  overview: z.string(),
  findings: z.array(
    z.object({
      title: z.string(),
      evidence: z.string(),
      whyItMatters: z.string()
    })
  ),
  reportGuidance: z.array(
    z.object({
      report: z.string(),
      whatToCheck: z.string(),
      why: z.string()
    })
  ),
  nextQuestions: z.array(z.string()),
  nextActions: z.array(z.string()),
  dataQuality: z.array(z.string())
});

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!openaiClient) {
    const env = getServerEnv();
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export async function generateCoachAnalysis(
  datasets: DatasetSummary[],
  answers: UserAnswers
): Promise<{
  mode: 'ai' | 'local';
  analysis: LocalCoachAnalysis;
  warning?: string;
}> {
  const fallback = buildLocalCoachAnalysis(datasets, answers);
  if (!isAiConfigured()) {
    return {
      mode: 'local',
      analysis: fallback
    };
  }

  try {
    const env = getServerEnv();
    const client = getOpenAIClient();
    const response = await client.responses.parse({
      model: env.OPENAI_MODEL,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: [
                'あなたは GA4 初学者向けの分析コーチです。',
                '与えられた CSV サマリーとユーザー回答だけを根拠に、わかりやすく、断定しすぎずに説明してください。',
                '定量分析では数値の偏りや比較ポイントを示し、改善案では「GA4 のどのレポートをどう見るか」を具体的に示してください。',
                '専門用語は平易に言い換え、数字の意味と次の行動をセットで返してください。'
              ].join('\n')
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({
                request: 'GA4 初心者向けに、このデータから見るべき場所と読み方を教えてください。',
                userAnswers: answers,
                datasets: datasets.map(stripRowsForAi),
                localBaseline: fallback
              })
            }
          ]
        }
      ],
      text: {
        format: zodTextFormat(coachSchema, 'ga4_coach_response')
      }
    });

    if (!response.output_parsed) {
      throw new Error('AI response was empty');
    }

    return {
      mode: 'ai',
      analysis: response.output_parsed
    };
  } catch (error) {
    return {
      mode: 'local',
      analysis: fallback,
      warning: `AI API の呼び出しに失敗したためローカル解析を返しました: ${(error as Error).message}`
    };
  }
}

function stripRowsForAi(dataset: DatasetSummary) {
  return {
    ...dataset,
    rows: []
  };
}
