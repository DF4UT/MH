'use client';

/**
 * 后台数据分析：Highcharts 趋势图 + 标签分布饼图
 */
import { useEffect, useMemo, useState } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { applyChartTheme, CHART_COLORS } from './HighchartsTheme';

interface AnalyticsData {
  days: string[];
  posts: number[];
  comments: number[];
  users: number[];
  tags: { name: string; value: number }[];
}

export default function AnalyticsClient() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    applyChartTheme();
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/admin/analytics?days=${days}`)
      .then((r) => r.json())
      .then((d: AnalyticsData & { error?: string }) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [days]);

  const trendOptions = useMemo(
    () => ({
      title: { text: '内容发布趋势' },
      xAxis: { categories: data?.days ?? [] },
      yAxis: { title: { text: '数量' }, allowDecimals: false },
      series: [
        { name: '帖子', data: data?.posts ?? [] },
        { name: '评论', data: data?.comments ?? [] },
      ],
    }),
    [data]
  );

  const userOptions = useMemo(
    () => ({
      title: { text: '用户注册趋势' },
      xAxis: { categories: data?.days ?? [] },
      yAxis: { title: { text: '新增用户' }, allowDecimals: false },
      series: [{ name: '新用户', data: data?.users ?? [] }],
    }),
    [data]
  );

  const tagOptions = useMemo(
    () => ({
      title: { text: '标签使用分布' },
      chart: { type: 'pie' },
      tooltip: { pointFormat: '{series.name}: <b>{point.y}</b>（{point.percentage:.1f}%）' },
      plotOptions: {
        pie: {
          allowPointSelect: true,
          cursor: 'pointer',
          dataLabels: {
            enabled: true,
            format: '{point.name}: {point.y}',
            style: { color: '#FFFFFF', textOutline: 'none' },
          },
        },
      },
      colors: CHART_COLORS,
      series: [
        {
          name: '使用次数',
          data: data?.tags ?? [],
        },
      ],
    }),
    [data]
  );

  return (
    <div>
      <div className="admin-page-header">
        <h1>数据分析</h1>
        <div className="admin-toolbar">
          <label className="label-inline" htmlFor="range">
            时间范围：
          </label>
          <select
            id="range"
            className="select"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>近 7 天</option>
            <option value={30}>近 30 天</option>
            <option value={90}>近 90 天</option>
          </select>
        </div>
      </div>

      {loading && <p className="empty-text">加载中…</p>}
      {error && <p className="form-error">{error}</p>}
      {!loading && !error && data && (
        <div className="chart-grid">
          <div className="card chart-card">
            <HighchartsReact highcharts={Highcharts} options={trendOptions} />
          </div>
          <div className="card chart-card">
            <HighchartsReact highcharts={Highcharts} options={userOptions} />
          </div>
          <div className="card chart-card chart-card-wide">
            <HighchartsReact highcharts={Highcharts} options={tagOptions} />
          </div>
        </div>
      )}
    </div>
  );
}
