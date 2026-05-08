import React, { useState, useEffect } from 'react';
import { Card, Select, Slider, Table, Tag, Typography, Space, Button, Statistic, Row, Col, Alert, Divider } from 'antd';
import { RocketOutlined, DollarOutlined } from '@ant-design/icons';
import useStockStore from '../store/useStockStore';
import { formatKRW, formatRate, getReturnColor } from '../utils/calcUtils';

const { Title, Text } = Typography;

const Strategy = () => {
  const { stocks, strategyResult, strategyLoading, calcStrategy, clearStrategy, createSellRecord } = useStockStore();
  const [selectedStockId, setSelectedStockId] = useState(null);
  const [targetRate, setTargetRate] = useState(10);

  useEffect(() => {
    if (selectedStockId) {
      calcStrategy(selectedStockId, targetRate);
    } else {
      clearStrategy();
    }
  }, [selectedStockId, targetRate]);

  const handleSell = async (tradeId, quantity, sellPrice) => {
    const success = await createSellRecord({
      tradeId,
      stockId: selectedStockId,
      sellDate: new Date(),
      quantity,
      sellPrice,
      memo: `${targetRate}% 목표 달성 매도`
    });
    if (success) calcStrategy(selectedStockId, targetRate);
  };

  const columns = [
    { title: '매입일', dataIndex: 'tradeDate', key: 'tradeDate', render: d => d.substring(0, 10) },
    { title: '수량', dataIndex: 'remainingQuantity', key: 'quantity', render: q => `${q}주` },
    { title: '매입가', dataIndex: 'buyPrice', key: 'buyPrice', render: v => formatKRW(v) },
    { 
      title: '수익률(세전)', 
      key: 'returnRate', 
      render: (_, record) => (
        <Tag color={getReturnColor(record.strategy.returnRate)}>{formatRate(record.strategy.returnRate)}</Tag>
      ) 
    },
    { 
      title: '순수익(세후)', 
      key: 'netProfit', 
      render: (_, record) => (
        <Text strong style={{ color: getReturnColor(record.strategy.netProfit) }}>{formatKRW(record.strategy.netProfit)}</Text>
      ) 
    },
    {
      title: '매매',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="primary" 
          danger={record.strategy.isTargetAchieved} 
          onClick={() => handleSell(record._id, record.remainingQuantity, record.strategy.currentPrice)}
        >
          전량 매도
        </Button>
      )
    }
  ];

  return (
    <div>
      <Title level={3}>매도 전략 계산기</Title>
      <Card>
        <Row gutter={24} align="middle">
          <Col span={12}>
            <Text strong>종목 선택</Text>
            <Select
              placeholder="종목을 선택하세요"
              style={{ width: '100%', marginTop: 8 }}
              onChange={setSelectedStockId}
              options={stocks.map(s => ({ label: `${s.name} (${s.ticker})`, value: s._id }))}
            />
          </Col>
          <Col span={12}>
            <Text strong>목표 수익률 설정 (%)</Text>
            <Slider
              min={0}
              max={50}
              value={targetRate}
              onChange={setTargetRate}
              marks={{ 0: '0%', 10: '10%', 20: '20%', 30: '30%', 50: '50%' }}
            />
          </Col>
        </Row>
      </Card>

      {strategyResult && (
        <div style={{ marginTop: 24 }}>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Card bordered={false} style={{ background: '#f6ffed' }}>
                <Statistic
                  title="목표 달성 건수"
                  value={strategyResult.achievedCount}
                  suffix="건"
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<RocketOutlined />}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card bordered={false} style={{ background: '#fff7e6' }}>
                <Statistic
                  title="전체 매도 시 예상 순수익 (세후)"
                  value={strategyResult.totalNetProfit}
                  formatter={v => formatKRW(v)}
                  valueStyle={{ color: '#fa8c16' }}
                  prefix={<DollarOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Alert
            message={`현재가 ${formatKRW(strategyResult.currentPrice)} 기준으로 목표 수익률 ${targetRate}%를 달성한 매입 건들입니다.`}
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Table
            dataSource={strategyResult.achieved}
            columns={columns}
            rowKey="_id"
            loading={strategyLoading}
            title={() => <b>🎯 목표 달성 매입 건</b>}
            pagination={false}
          />

          <Divider />

          <Table
            dataSource={strategyResult.notAchieved}
            columns={columns}
            rowKey="_id"
            loading={strategyLoading}
            title={() => <b>⏳ 아직 대기 중인 매입 건</b>}
            pagination={false}
          />
        </div>
      )}
    </div>
  );
};

export default Strategy;
