import React, { useEffect } from 'react';
import { Table, Card, Typography, Tag, Button, Popconfirm, Space } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import useStockStore from '../store/useStockStore';
import { formatKRW, formatRate, getReturnColor } from '../utils/calcUtils';

const { Title, Text } = Typography;

const Sells = () => {
  const { sellRecords, sellsLoading, fetchSellRecords, deleteSellRecord } = useStockStore();

  useEffect(() => {
    fetchSellRecords();
  }, []);

  const columns = [
    {
      title: '매도일',
      dataIndex: 'sellDate',
      key: 'sellDate',
      render: d => dayjs(d).format('YYYY-MM-DD'),
      sorter: (a, b) => dayjs(a.sellDate).unix() - dayjs(b.sellDate).unix(),
    },
    {
      title: '종목',
      dataIndex: ['stockId', 'name'],
      key: 'stockName',
      render: (text, record) => (
        <span>
          <b>{text}</b> <small style={{ color: '#999' }}>{record.stockId?.ticker}</small>
        </span>
      ),
    },
    { title: '수량', dataIndex: 'quantity', key: 'quantity', render: q => `${q}주` },
    { title: '매도가', dataIndex: 'sellPrice', key: 'sellPrice', render: v => formatKRW(v) },
    { 
      title: '실현수익(세후)', 
      dataIndex: 'netProfit', 
      key: 'netProfit', 
      render: v => <Text strong style={{ color: getReturnColor(v) }}>{formatKRW(v)}</Text> 
    },
    { 
      title: '수익률(세후)', 
      dataIndex: 'returnRate', 
      key: 'returnRate', 
      render: v => <Tag color={getReturnColor(v)}>{formatRate(v)}</Tag> 
    },
    {
      title: '취소',
      key: 'action',
      render: (_, record) => (
        <Popconfirm title="매도 기록을 취소하시겠습니까? 보유 수량이 복구됩니다." onConfirm={() => deleteSellRecord(record._id)}>
          <Button danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>매도 기록 (실현 수익)</Title>
      <Card>
        <Table
          dataSource={sellRecords}
          columns={columns}
          rowKey="_id"
          loading={sellsLoading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default Sells;
