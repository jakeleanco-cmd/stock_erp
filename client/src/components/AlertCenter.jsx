import React, { useState } from 'react';
import { Badge, Popover, List, Button, Tag, Typography, Empty, Space } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import useStockStore from '../store/useStockStore';
import { formatKRW, formatRate, getReturnColor } from '../utils/calcUtils';

const { Text } = Typography;

/**
 * 알림 센터 컴포넌트
 * 
 * 헤더에 위치하는 벨 아이콘 + 배지(미확인 알림 수)
 * 클릭하면 팝오버로 알림 목록 표시
 * 자동매매 엔진에서 발생한 매매 신호를 SSE로 수신하여 표시
 */
const AlertCenter = () => {
  const { alerts, unreadAlertCount, markAlertsRead, executeAutoTrade } = useStockStore();
  const [open, setOpen] = useState(false);

  // 팝오버 열릴 때 읽음 처리
  const handleOpenChange = (visible) => {
    setOpen(visible);
    if (visible && unreadAlertCount > 0) {
      markAlertsRead();
    }
  };

  // 수동 매도 실행 (반자동 모드)
  const handleExecute = async (ruleId) => {
    await executeAutoTrade(ruleId);
  };

  const content = (
    <div style={{ width: 380, maxHeight: 450, overflowY: 'auto' }}>
      {alerts.length === 0 ? (
        <Empty description="알림이 없습니다" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          size="small"
          dataSource={alerts}
          renderItem={(item) => {
            const isTargetSell = item.type === 'target_sell';
            return (
              <List.Item
                style={{
                  background: item.read ? 'transparent' : '#fafafa',
                  padding: '8px 12px',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <div style={{ width: '100%' }}>
                  <Space style={{ marginBottom: 4 }}>
                    <Tag color={isTargetSell ? 'green' : 'red'}>
                      {isTargetSell ? '🎯 목표 달성' : '🛑 손절 경고'}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {new Date(item.timestamp).toLocaleTimeString('ko-KR')}
                    </Text>
                  </Space>
                  <div style={{ marginBottom: 4 }}>
                    <Text strong>{item.stockName}</Text>
                    <Text type="secondary" style={{ marginLeft: 4 }}>({item.ticker})</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size="small">
                      <Text>현재가: {formatKRW(item.currentPrice)}</Text>
                      <Tag color={getReturnColor(item.returnRate)}>
                        {formatRate(item.returnRate)}
                      </Tag>
                    </Space>
                    {item.executionMode === 'manual' && item.ruleId && (
                      <Button
                        type="primary"
                        danger
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={() => handleExecute(item.ruleId)}
                      >
                        매도
                      </Button>
                    )}
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      title="매매 신호 알림"
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
      placement="bottomRight"
    >
      <Badge count={unreadAlertCount} size="small" offset={[-2, 2]}>
        <BellOutlined
          style={{
            fontSize: 20,
            cursor: 'pointer',
            color: unreadAlertCount > 0 ? '#ff4d4f' : '#595959',
          }}
        />
      </Badge>
    </Popover>
  );
};

export default AlertCenter;
