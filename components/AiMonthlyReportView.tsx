import React from 'react';
import Badge from './ui/Badge';
import {
  AiMonthlyReport,
  AiReportChapter,
  AiReportParagraph,
  AiReportMetric,
} from '../types';

interface AiMonthlyReportViewProps {
  report: AiMonthlyReport;
}

const AiMonthlyReportView: React.FC<AiMonthlyReportViewProps> = ({ report }) => {
  const {
    period,
    departmentName,
    reportType,
    mode,
    generatedAt,
    summaryKeywords,
    chapters,
    metrics,
  } = report;

  const renderMetric = (metricId: string) => {
    const metric: AiReportMetric | undefined = metrics[metricId];
    if (!metric) {
      return null;
    }

    return (
      <div key={metricId} className="flex items-baseline gap-2 text-sm text-slate-600">
        <span className="text-slate-400">{metric.label}</span>
        <span className="font-semibold text-slate-900">
          {metric.value}
          {metric.unit ? (
            <span className="ml-1 text-xs text-slate-400">{metric.unit}</span>
          ) : null}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              {departmentName || '部门'} {period} 月度报告
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              生成时间：{new Date(generatedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{reportType}</Badge>
            <Badge variant={mode === 'rule' ? 'success' : 'warning'}>
              {mode === 'rule' ? '规则生成' : '大模型生成'}
            </Badge>
          </div>
        </div>
        {summaryKeywords && summaryKeywords.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {summaryKeywords.map((keyword) => (
              <Badge
                key={keyword}
                variant="default"
                className="bg-blue-50 text-blue-700 border border-blue-100"
              >
                {keyword}
              </Badge>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        {chapters.map((chapter: AiReportChapter) => (
          <article
            key={chapter.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
          >
            <h2 className="text-lg font-bold text-slate-900 mb-3">{chapter.title}</h2>
            <div className="space-y-3">
              {chapter.paragraphs.map((paragraph: AiReportParagraph) => (
                <div key={paragraph.id} className="space-y-2">
                  <p className="text-sm md:text-base text-slate-700 leading-relaxed">
                    {paragraph.text}
                  </p>
                  {paragraph.highlightMetricIds &&
                    paragraph.highlightMetricIds.length > 0 && (
                      <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {paragraph.highlightMetricIds.map(renderMetric)}
                      </div>
                    )}
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};

export default AiMonthlyReportView;
