import { z } from 'zod';

const metricAliasSchema = z.enum([
  'sessions',
  'activeUsers',
  'newUsers',
  'engagedSessions',
  'engagementRate',
  'eventCount',
  'keyEvents',
  'sessionKeyEventRate',
  'revenue',
  'engagementTime',
  'metric'
]);

export const userAnswersSchema = z.object({
  focus: z.enum(['overview', 'acquisition', 'engagement', 'conversion', 'tech']),
  businessType: z.enum(['lead', 'commerce', 'content', 'service']),
  experience: z.enum(['beginner', 'basic', 'intermediate']),
  concern: z.string().max(400).default('')
});

export const topRowSummarySchema = z.object({
  label: z.string(),
  primaryValue: z.number(),
  share: z.number(),
  engagementRate: z.number().nullable(),
  keyEvents: z.number()
});

export const datasetSummarySchema = z.object({
  fileName: z.string(),
  reportName: z.string(),
  account: z.string(),
  property: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  headers: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.string())).default([]),
  type: z.enum(['acquisition', 'engagement', 'conversion', 'tech', 'general']),
  primaryDimension: z.string(),
  primaryMetric: z.object({
    id: metricAliasSchema,
    label: z.string()
  }),
  avgEngagementRate: z.number().nullable(),
  keyEventsTotal: z.number(),
  revenueTotal: z.number(),
  numericTotals: z.record(
    z.string(),
    z.object({
      total: z.number(),
      average: z.number(),
      min: z.number(),
      max: z.number()
    })
  ),
  topRows: z.array(topRowSummarySchema),
  chart: z.object({
    labels: z.array(z.string()),
    primaryLabel: z.string(),
    primaryValues: z.array(z.number()),
    engagementValues: z.array(z.number().nullable())
  })
});

export const createWorkspaceSchema = z.object({
  answers: userAnswersSchema
});

export const analyzeRequestSchema = z.object({
  answers: userAnswersSchema,
  datasets: z.array(datasetSummarySchema),
  workspaceToken: z.string().optional()
});

export const finalizeSnapshotSchema = z.object({
  answers: userAnswersSchema,
  datasets: z.array(datasetSummarySchema).min(1).max(5),
  uploadedBlobs: z
    .array(
      z.object({
        url: z.string().url(),
        pathname: z.string(),
        originalName: z.string(),
        size: z.number().max(10 * 1024 * 1024),
        contentType: z.string()
      })
    )
    .min(1)
    .max(5)
});

export const noteMutationSchema = z.object({
  id: z.string().optional(),
  snapshotId: z.string().nullable().optional(),
  body: z.string().trim().min(1).max(5000)
});

export const siteCheckRequestSchema = z.object({
  siteUrl: z.string().trim().min(4).max(500)
});
