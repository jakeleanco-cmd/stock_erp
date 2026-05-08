import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, DatePicker, Select, Card, Tag, Typography, Popconfirm, Divider, Radio, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import useStockStore from '../store/useStockStore';
import { formatKRW, formatRate, getReturnColor, calcNetMetrics } from '../utils/calcUtils';

const { Title, Text } = Typography;

const Trades = () => {
  const { 
    stocks, trades, tradesLoading, fetchTrades, createTrade, updateTrade, deleteTrade, 
    selectedStockId, setSelectedStockId, realtimePrices 
  } = useStockStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form] = Form.useForm();

  // 필터 변경 시 또는 초기 로드 시 데이터 호출
  useEffect(() => {
    fetchTrades(selectedStockId);
  }, [selectedStockId]);

  const handleStockChange = (e) => {
    setSelectedStockId(e.target.value);
  };

  const openModal = (record = null) => {
    if (record) {
      setEditingId(record._id);
      form.setFieldsValue({
        ...record,
        stockId: record.stockId?._id,
        tradeDate: dayjs(record.tradeDate),
      });
    } else {
      setEditingId(null);
      form.resetFields();
      form.setFieldsValue({ tradeDate: dayjs() });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const targetStockId = selectedStockId || values.stockId;
      
      if (!targetStockId) {
        message.error('종목을 선택해주세요.');
        return;
      }

      const payload = {
        ...values,
        stockId: targetStockId,
        tradeDate: values.tradeDate.toDate(),
      };

      let success;
      if (editingId) {
        success = await updateTrade(editingId, payload);
      } else {
        success = await createTrade(payload);
      }

      if (success) setIsModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  // 실시간 현재가 가져오기 헬퍼 (개별 레코드 기준)
  const getLivePrice = (stock) => {
    if (!stock) return 0;
    const realtimeData = realtimePrices[stock.ticker];
    return realtimeData?.currentPrice || stock.currentPrice || 0;
  };

  const columns = [
    { 
      title: '종목명', 
      dataIndex: ['stockId', 'name'], 
      key: 'stockName',
      render: (name, record) => (
        <span>
          <b>{name}</b> <small style={{ color: '#999' }}>{record.stockId?.ticker}</small>
        </span>
      )
    },
    { title: '매입일', dataIndex: 'tradeDate', key: 'tradeDate', render: (date) => dayjs(date).format('YYYY-MM-DD') },
    { title: '수량', dataIndex: 'remainingQuantity', key: 'quantity', render: (q) => `${q}주` },
    { title: '매입가', dataIndex: 'buyPrice', key: 'buyPrice', render: (val) => formatKRW(val) },
    {
      title: '현재가',
      key: 'currentPrice',
      render: (_, record) => {
        const stock = record.stockId;
        if (!stock) return '-';
        const livePrice = getLivePrice(stock);
        const isRealtime = !!realtimePrices[stock.ticker];
        return (
          <span>
            {formatKRW(livePrice)}
            {isRealtime && <Tag color="green" style={{ marginLeft: 4, fontSize: 10 }}>LIVE</Tag>}
          </span>
        );
      }
    },
    {
      title: '수익률(세후)',
      key: 'rates',
      render: (_, record) => {
        const stock = record.stockId;
        if (!stock) return '-';
        const livePrice = getLivePrice(stock);
        const metrics = calcNetMetrics(record.remainingQuantity, record.buyPrice, livePrice);
        return (
          <Tag color={getReturnColor(metrics.netReturnRate)}>{formatRate(metrics.netReturnRate)}</Tag>
        );
      }
    },
    {
      title: '평가손익(세후)',
      key: 'profit',
      render: (_, record) => {
        const stock = record.stockId;
        if (!stock) return '-';
        const livePrice = getLivePrice(stock);
        const metrics = calcNetMetrics(record.remainingQuantity, record.buyPrice, livePrice);
        return (
          <Text strong style={{ color: getReturnColor(metrics.netProfit) }}>
            {formatKRW(metrics.netProfit)}
          </Text>
        );
      }
    },
    { title: '메모', dataIndex: 'memo', key: 'memo' },
    {
      title: '관리',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openModal(record)} />
          <Popconfirm title="이 매입 건을 삭제하시겠습니까?" onConfirm={() => deleteTrade(record._id, selectedStockId)}>
            <Button danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card 
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>매입 이력 상세 관리</span>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              매입 추가
            </Button>
          </div>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 종목별 필터 버튼 */}
          <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '8px' }}>
            <Text strong style={{ marginRight: 12 }}>종목 필터:</Text>
            <Radio.Group value={selectedStockId} onChange={handleStockChange} optionType="button" buttonStyle="solid">
              <Radio.Button value={null}>전체보기</Radio.Button>
              {stocks.map(s => (
                <Radio.Button key={s._id} value={s._id}>
                  {s.name}
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>

          <Table
            dataSource={trades}
            columns={columns}
            rowKey="_id"
            loading={tradesLoading}
            pagination={{ pageSize: 15 }}
            scroll={{ x: 'max-content' }}
          />
        </Space>
      </Card>

      <Modal
        title={editingId ? "매입 정보 수정" : "새 매입 등록"}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {(!selectedStockId || editingId) && (
            <Form.Item name="stockId" label="종목 선택" rules={[{ required: true, message: '종목을 선택해주세요.' }]}>
              <Select placeholder="매입한 종목을 선택하세요" disabled={!!editingId}>
                {stocks.map(s => (
                  <Select.Option key={s._id} value={s._id}>{s.name} ({s.ticker})</Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}
          <Form.Item name="tradeDate" label="매입 날짜" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="buyPrice" label="매입 단가" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={val => val.replace(/\$\s?|(,*)/g, '')} />
          </Form.Item>
          <Form.Item name="quantity" label="매입 수량" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="memo" label="메모">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Trades;
