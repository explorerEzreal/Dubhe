import { BarChartOutlined } from '@ant-design/icons';
import { Card } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useChartTheme } from '../../../hooks/useChartTheme';
import type { DashboardTrend } from '../dashboard-view-model';
import './TrendCard.less';

export function TrendCard({
  trend,
  granularity,
}: {
  trend: DashboardTrend[];
  granularity: 'hour' | 'day';
}): JSX.Element {
  const chart = useChartTheme();
  const option = {
    color: chart.palette,
    tooltip: {
      trigger: 'axis',
      backgroundColor: chart.tooltipBg,
      borderColor: chart.tooltipBorder,
      textStyle: { color: chart.tooltipText },
    },
    grid: { left: 54, right: 58, top: 24, bottom: 30 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trend.map((item) =>
        new Date(item.date).toLocaleDateString('zh-CN', {
          month: 'numeric',
          day: 'numeric',
        }),
      ),
      axisLine: { lineStyle: { color: chart.axisLine } },
      axisLabel: { color: chart.axisLabel },
    },
    yAxis: [
      {
        type: 'value',
        axisLabel: { color: chart.axisLabel },
        splitLine: { lineStyle: { color: chart.splitLine } },
      },
      {
        type: 'value',
        axisLabel: { color: chart.axisLabel, formatter: '{value}%' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Token',
        type: 'line',
        smooth: true,
        symbol: 'none',
        color: chart.palette[0],
        areaStyle: { opacity: 0.14 },
        data: trend.map((item) => item.tokens),
      },
      {
        name: '请求数',
        type: 'line',
        smooth: true,
        symbol: 'none',
        color: chart.palette[1],
        data: trend.map((item) => item.calls),
      },
      {
        name: '错误率',
        type: 'line',
        smooth: true,
        symbol: 'none',
        color: chart.error,
        yAxisIndex: 1,
        data: trend.map((item) => item.errorRate * 100),
      },
    ],
  };
  return (
    <Card
      className='design-card design-trend'
      title={
        <span className='design-card-title'>
          <BarChartOutlined />
          调用与用量趋势 <small>按{granularity === 'hour' ? '小时' : '天'}</small>
        </span>
      }
      extra={
        <div className='design-legend'>
          <span>
            <i className='teal' />
            Token
          </span>
          <span>
            <i className='cyan' />
            请求数
          </span>
          <span>
            <i className='red' />
            错误率
          </span>
        </div>
      }
    >
      {trend.length ? (
        <ReactECharts option={option} style={{ height: 268 }} />
      ) : (
        <div className='dashboard-empty'>暂无趋势数据</div>
      )}
    </Card>
  );
}
