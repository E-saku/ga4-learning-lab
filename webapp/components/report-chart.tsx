'use client';

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import type { DatasetSummary } from '@/lib/ga4/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

type ReportChartProps = {
  dataset: DatasetSummary;
};

export function ReportChart({ dataset }: ReportChartProps) {
  const hasEngagementLine = dataset.chart.engagementValues.some((value) => value != null);

  return (
    <div className="chart-card">
      <p className="small-label">Chart</p>
      <h3>{dataset.reportName}</h3>
      <p className="muted-copy">
        {dataset.primaryDimension} ごとの {dataset.primaryMetric.label}
      </p>
      <div className="chart-area">
        <Chart
          type="bar"
          data={{
            labels: dataset.chart.labels,
            datasets: [
              {
                type: 'bar' as const,
                label: dataset.chart.primaryLabel,
                data: dataset.chart.primaryValues,
                backgroundColor: 'rgba(17, 119, 99, 0.78)',
                borderRadius: 10,
                borderSkipped: false
              },
              ...(hasEngagementLine
                ? [
                    {
                      type: 'line' as const,
                      label: 'エンゲージメント率',
                      data: dataset.chart.engagementValues,
                      borderColor: '#cb6c3a',
                      backgroundColor: '#cb6c3a',
                      yAxisID: 'y1',
                      tension: 0.35,
                      pointRadius: 4
                    }
                  ]
                : [])
            ]
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: {
                  color: '#425049'
                }
              }
            },
            scales: {
              x: {
                ticks: { color: '#6f7c75' },
                grid: { display: false }
              },
              y: {
                ticks: { color: '#6f7c75' },
                grid: { color: 'rgba(25, 33, 30, 0.08)' }
              },
              ...(hasEngagementLine
                ? {
                    y1: {
                      position: 'right' as const,
                      ticks: {
                        color: '#cb6c3a',
                        callback: (value: string | number) => `${value}%`
                      },
                      grid: {
                        drawOnChartArea: false
                      }
                    }
                  }
                : {})
            }
          }}
        />
      </div>
    </div>
  );
}
