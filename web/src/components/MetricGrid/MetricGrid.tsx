import type { ReactNode } from 'react';
import './MetricGrid.less';

export type MetricItem = {
  key: string;
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  icon: ReactNode;
  tone: string;
  hint?: ReactNode;
};

export function MetricGrid({ items, className = '' }: { items: MetricItem[]; className?: string }): JSX.Element {
  return <div className={`common-metric-grid ${className}`.trim()}>{items.map((item) => <article className={`common-metric-card ${item.tone}`} key={item.key}>
    <span className="metric-icon">{item.icon}</span>
    <div className="metric-content">
      <span className="metric-label">{item.label}</span>
      <div className="metric-value-row"><b className="metric-value mono">{item.value}</b>{item.unit ? <span className="metric-unit">{item.unit}</span> : null}</div>
      {item.hint ? <span className="metric-hint">{item.hint}</span> : null}
    </div>
  </article>)}</div>;
}
