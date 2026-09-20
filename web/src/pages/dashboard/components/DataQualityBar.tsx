import { InfoCircleOutlined } from '@ant-design/icons';
import type { DashboardViewModel } from '../dashboard-view-model';
import './DataQualityBar.less';

export function DataQualityBar({ quality }: { quality: DashboardViewModel['quality'] }): JSX.Element { return <div className='design-quality'><span><InfoCircleOutlined />缺失 Token 统计的调用：<b className='mono'>{quality.missingTokens.toLocaleString()}</b></span><span><InfoCircleOutlined />未分组调用：<b className='mono'>{quality.ungrouped}</b></span><span className={quality.truncated ? '' : 'quality-ok'}>{quality.truncated ? '最近调用已截断' : '采样完整，未截断'}</span></div>; }
