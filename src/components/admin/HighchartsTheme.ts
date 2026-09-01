/**
 * Highcharts 主题配置（适配 VSCode 高对比度暗色风格）
 */
import Highcharts from 'highcharts';

export const CHART_COLORS = ['#3794FF', '#4EC9B0', '#F38518', '#CE9178', '#6FC3DF', '#C586C0'];

export function applyChartTheme() {
  Highcharts.setOptions({
    chart: {
      backgroundColor: 'transparent',
      style: { fontFamily: 'inherit' },
      spacing: [16, 16, 16, 16],
    },
    title: { style: { color: '#FFFFFF', fontWeight: '600' } },
    subtitle: { style: { color: '#C5C5C5' } },
    colors: CHART_COLORS,
    legend: {
      itemStyle: { color: '#C5C5C5' },
      itemHoverStyle: { color: '#FFFFFF' },
    },
    xAxis: {
      labels: { style: { color: '#C5C5C5' } },
      lineColor: '#6FC3DF',
      tickColor: '#6FC3DF',
      gridLineColor: '#262626',
    },
    yAxis: {
      labels: { style: { color: '#C5C5C5' } },
      gridLineColor: '#262626',
      title: { style: { color: '#FFFFFF' } },
    },
    tooltip: {
      backgroundColor: '#0D0D0D',
      borderColor: '#6FC3DF',
      style: { color: '#FFFFFF' },
    },
    plotOptions: {
      series: {
        borderColor: '#000000',
        dataLabels: { style: { color: '#FFFFFF', textOutline: 'none' } },
      },
    },
    credits: { enabled: false },
  });
}
