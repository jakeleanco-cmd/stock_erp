import React, { useMemo, useEffect, useRef } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Typography, Badge } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, WifiOutlined, DisconnectOutlined } from '@ant-design/icons';
import useStockStore from '../store/useStockStore';
import { formatKRW, formatRate, getReturnColor } from '../utils/calcUtils';

const { Title, Text } = Typography;

/**
 * 대시보드 - 자산 현황 + 실시간 시세 표시
 * 
 * SSE를 통해 실시간 체결가를 수신하고,
 * 가격 변동 시 깜빡임 애니메이션으로 시각적 피드백 제공
 */
const Dashboard = () => {
  const { stocks, stocksLoading, realtimePrices, wsConnected } = useStockStore();

  // 이전 가격을 추적하여 변동 방향 감지
  const prevPricesRef = useRef({});

  // 실시간 가격 또는 DB 현재가를 통합하여 표시
  const getDisplayPrice = (stock) => {
    const realtimeData = realtimePrices[stock.ticker];
    if (realtimeData?.currentPrice) {
      return realtimeData.currentPrice;
    }
    return stock.currentPrice;
  };

  // 가격 변동 방향 ('up', 'down', null)
  const getPriceDirection = (ticker, currentPrice) => {
    const prevPrice = prevPricesRef.current[ticker];
    if (!prevPrice || prevPrice === currentPrice) return null;
    return currentPrice > prevPrice ? 'up' : 'down';
  };

  // 이전 가격 기록 업데이트
  useEffect(() => {
    const newPrevPrices = {};
    stocks.forEach((s) => {
      newPrevPrices[s.ticker] = getDisplayPrice(s);
    });
    // 약간의 딜레이 후 업데이트 (애니메이션이 보이도록)
    const timer = setTimeout(() => {
      prevPricesRef.current = newPrevPrices;
    }, 1000);
    return () => clearTimeout(timer);
  }, [realtimePrices]);

  // 전체 요약 데이터 계산 (실시간 가격 반영)
  const summary = useMemo(() => {
    let totalCost = 0;
    let totalValue = 0;
    
    stocks.forEach(s => {
      const displayPrice = getDisplayPrice(s);
      totalCost += s.summary.totalCost;
      totalValue += displayPrice * s.summary.totalQuantity;
    });

    const totalProfit = totalValue - totalCost;
    const totalRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    return { totalCost, totalValue, totalProfit, totalRate };
  }, [stocks, realtimePrices]);

  const columns = [
    {
      title: '종목명',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <span>
          <b>{text}</b> <small style={{ color: '#999' }}>{record.ticker}</small>
        </span>
      ),
    },
    {
      title: () => (
        <span>
          현재가{' '}
          {wsConnected ? (
            <Badge status="success" text={<Text type="secondary" style={{ fontSize: 11 }}>LIVE</Text>} />
          ) : (
            <Badge status="default" text={<Text type="secondary" style={{ fontSize: 11 }}>OFF</Text>} />
          )}
        </span>
      ),
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      render: (val, record) => {
        const displayPrice = getDisplayPrice(record);
        const direction = getPriceDirection(record.ticker, displayPrice);
        const realtimeData = realtimePrices[record.ticker];

        return (
          <div>
            <span
              style={{
                fontWeight: 'bold',
                fontSize: 15,
                color: direction === 'up' ? '#f5222d' : direction === 'down' ? '#096dd9' : 'inherit',
                transition: 'color 0.3s ease',
                // 가격 변동 시 깜빡임 효과
                animation: direction ? 'priceFlash 0.6s ease-out' : 'none',
              }}
            >
              {formatKRW(displayPrice)}
            </span>
            {/* 실시간 전일대비 정보 */}
            {realtimeData && (
              <div style={{ fontSize: 11, marginTop: 2 }}>
                <span style={{ color: getReturnColor(realtimeData.change) }}>
                  {realtimeData.change > 0 ? '+' : ''}{realtimeData.change?.toLocaleString()}
                  ({realtimeData.changeRate > 0 ? '+' : ''}{realtimeData.changeRate?.toFixed(2)}%)
                </span>
                <span style={{ color: '#999', marginLeft: 6 }}>
                  {realtimeData.time ? `${realtimeData.time.substring(0,2)}:${realtimeData.time.substring(2,4)}:${realtimeData.time.substring(4,6)}` : ''}
                </span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: '수익률(세전)',
      key: 'returnRate',
      render: (_, record) => {
        const displayPrice = getDisplayPrice(record);
        const totalCost = record.summary.totalCost;
        const totalQuantity = record.summary.totalQuantity;
        // 실시간 가격 기반 수익률 재계산
        const currentValue = displayPrice * totalQuantity;
        const rate = totalCost > 0
          ? parseFloat((((currentValue - totalCost) / totalCost) * 100).toFixed(2))
          : 0;
        return (
          <Tag color={getReturnColor(rate)} style={{ fontWeight: 'bold' }}>
            {formatRate(rate)}
          </Tag>
        );
      },
      sorter: (a, b) => a.summary.avgReturnRate - b.summary.avgReturnRate,
    },
    {
      title: '평가손익',
      key: 'profit',
      render: (_, record) => {
        const displayPrice = getDisplayPrice(record);
        const totalCost = record.summary.totalCost;
        const totalQuantity = record.summary.totalQuantity;
        const profit = (displayPrice * totalQuantity) - totalCost;
        return (
          <span style={{ color: getReturnColor(profit), fontWeight: 'bold' }}>
            {formatKRW(profit)}
          </span>
        );
      },
    },
    {
      title: '거래량',
      key: 'volume',
      render: (_, record) => {
        const realtimeData = realtimePrices[record.ticker];
        return realtimeData?.volume
          ? <Text type="secondary">{realtimeData.volume.toLocaleString()}</Text>
          : <Text type="secondary">-</Text>;
      },
    },
  ];

  return (
    <div>
      {/* 헤더: 제목 + 연결 상태 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>자산 현황</Title>
        <Tag
          icon={wsConnected ? <WifiOutlined /> : <DisconnectOutlined />}
          color={wsConnected ? 'success' : 'default'}
        >
          {wsConnected ? '실시간 시세 연결됨' : '실시간 시세 꺼짐'}
        </Tag>
      </div>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="summary-card">
            <Statistic
              title="총 매입금액"
              value={summary.totalCost}
              formatter={(val) => formatKRW(val)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="summary-card">
            <Statistic
              title="총 평가금액"
              value={summary.totalValue}
              formatter={(val) => formatKRW(val)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="summary-card">
            <Statistic
              title="총 평가손익"
              value={summary.totalProfit}
              valueStyle={{ color: getReturnColor(summary.totalProfit) }}
              prefix={summary.totalProfit >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              formatter={(val) => formatKRW(val)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className="summary-card">
            <Statistic
              title="전체 수익률"
              value={summary.totalRate}
              precision={2}
              valueStyle={{ color: getReturnColor(summary.totalRate) }}
              prefix={summary.totalRate >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="종목별 요약 (실시간)" bordered={false}>
            <Table
              dataSource={stocks}
              columns={columns}
              rowKey="_id"
              loading={stocksLoading}
              pagination={false}
            />
          </Card>
        </Col>
      </Row>

      {/* 가격 변동 깜빡임 애니메이션 CSS */}
      <style>{`
        @keyframes priceFlash {
          0% { opacity: 1; }
          25% { opacity: 0.4; }
          50% { opacity: 1; }
          75% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
