import { Typography } from 'antd';

export function DeviceTrafficPage() {
  return (
    <section>
      <div className='dashboard-header'>
        <div>
          <Typography.Title level={1}>流量监控</Typography.Title>
          <Typography.Paragraph type='secondary'>
            实时监控推理流量、请求延迟和错误率。
          </Typography.Paragraph>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Typography.Text type='secondary' style={{ fontSize: 18 }}>
          即将上线，敬请期待
        </Typography.Text>
      </div>
    </section>
  );
}
