import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Space, Modal, Form, Input, InputNumber, Select,
  Popconfirm, Card, Typography, AutoComplete, Tag, Switch, Radio, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, RobotOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import useStockStore from '../store/useStockStore';
import { formatKRW } from '../utils/calcUtils';
import { stockApi } from '../api';

const { Title, Text } = Typography;

const Stocks = () => {
  const navigate = useNavigate();
  const {
    stocks, stocksLoading, realtimePrices,
    createStock, updateStock, deleteStock, syncPrices, setSelectedStockId,
    autoTradeRules, fetchAutoTradeRules, createAutoTradeRule, updateAutoTradeRule, deleteAutoTradeRule,
  } = useStockStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState(null);
  const [searchOptions, setSearchOptions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTimer, setSearchTimer] = useState(null);

  // 자동매매 설정 모달
  const [isAutoTradeModalOpen, setIsAutoTradeModalOpen] = useState(false);
  const [autoTradeForm] = Form.useForm();
  const [autoTradeStockId, setAutoTradeStockId] = useState(null);
  const [autoTradeStockName, setAutoTradeStockName] = useState('');

  // 자동매매 규칙 로드
  useEffect(() => {
    fetchAutoTradeRules();
  }, []);

  // 종목 검색 핸들러 (디바운스 적용)
  const handleSearch = (value) => {
    if (searchTimer) clearTimeout(searchTimer);

    if (value && value.length >= 1) {
      setSearchLoading(true);
      const timer = setTimeout(async () => {
        try {
          const res = await stockApi.search(value);
          setSearchOptions(
            res.data.map(item => ({
              label: `${item.name} (${item.ticker} / ${item.market})`,
              value: item.name,
              ticker: item.ticker,
              market: item.market
            }))
          );
        } catch (err) {
          console.error(err);
        } finally {
          setSearchLoading(false);
        }
      }, 300);
      setSearchTimer(timer);
    } else {
      setSearchOptions([]);
      setSearchLoading(false);
    }
  };

  // 종목 선택 시 티커 및 시장 정보 자동 입력
  const onSelect = (value, option) => {
    form.setFieldsValue({ 
      ticker: option.ticker,
      market: option.market 
    });
  };

  const showModal = (record = null) => {
    if (record) {
      setEditingId(record._id);
      form.setFieldsValue(record);
    } else {
      setEditingId(null);
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      let success;
      if (editingId) {
        success = await updateStock(editingId, values);
      } else {
        success = await createStock(values);
      }
      if (success) setIsModalOpen(false);
    } catch (err) {
      console.error('Validation failed:', err);
    }
  };

  // ─── 자동매매 설정 모달 ──────────────────────────────────────

  const showAutoTradeModal = (record) => {
    setAutoTradeStockId(record._id);
    setAutoTradeStockName(record.name);
    // 해당 종목의 기존 규칙이 있으면 불러오기
    const existingRule = autoTradeRules.find(
      (r) => r.stockId?._id === record._id && r.status === 'watching'
    );
    if (existingRule) {
      autoTradeForm.setFieldsValue({
        ruleType: existingRule.ruleType,
        targetRate: existingRule.targetRate,
        executionMode: existingRule.executionMode,
        isActive: existingRule.isActive,
        _existingRuleId: existingRule._id,
      });
    } else {
      autoTradeForm.resetFields();
      autoTradeForm.setFieldsValue({
        ruleType: 'target_sell',
        targetRate: record.targetReturnRate || 10,
        executionMode: 'manual',
        isActive: true,
      });
    }
    setIsAutoTradeModalOpen(true);
  };

  const handleAutoTradeOk = async () => {
    try {
      const values = await autoTradeForm.validateFields();
      const existingRuleId = autoTradeForm.getFieldValue('_existingRuleId');

      let success;
      if (existingRuleId) {
        // 기존 규칙 수정
        success = await updateAutoTradeRule(existingRuleId, {
          targetRate: values.targetRate,
          executionMode: values.executionMode,
          isActive: values.isActive,
        });
      } else {
        // 새 규칙 생성
        success = await createAutoTradeRule({
          stockId: autoTradeStockId,
          ruleType: values.ruleType,
          targetRate: values.targetRate,
          executionMode: values.executionMode,
        });
      }
      if (success) setIsAutoTradeModalOpen(false);
    } catch (err) {
      console.error('AutoTrade form error:', err);
    }
  };

  const handleAutoTradeDelete = async () => {
    const existingRuleId = autoTradeForm.getFieldValue('_existingRuleId');
    if (existingRuleId) {
      await deleteAutoTradeRule(existingRuleId);
      setIsAutoTradeModalOpen(false);
    }
  };

  // 해당 종목에 활성화된 자동매매 규칙이 있는지 확인
  const getActiveRule = (stockId) => {
    return autoTradeRules.find(
      (r) => r.stockId?._id === stockId && r.isActive && r.status === 'watching'
    );
  };

  // 실시간 가격 표시 헬퍼
  const getDisplayPrice = (stock) => {
    const realtimeData = realtimePrices[stock.ticker];
    return realtimeData?.currentPrice || stock.currentPrice;
  };

  const columns = [
    { title: '종목명', dataIndex: 'name', key: 'name' },
    { title: '티커', dataIndex: 'ticker', key: 'ticker' },
    { title: '시장', dataIndex: 'market', key: 'market' },
    { 
      title: '현재가', 
      dataIndex: 'currentPrice', 
      key: 'currentPrice',
      render: (val, record) => {
        const displayPrice = getDisplayPrice(record);
        const isRealtime = !!realtimePrices[record.ticker];
        return (
          <span>
            <b>{formatKRW(displayPrice)}</b>
            {isRealtime && <Tag color="green" style={{ marginLeft: 4, fontSize: 10 }}>LIVE</Tag>}
          </span>
        );
      },
    },
    {
      title: '목표수익률(%)',
      dataIndex: 'targetReturnRate',
      key: 'targetReturnRate',
      render: (val) => `${val}%`,
    },
    {
      title: '자동매매',
      key: 'autoTrade',
      render: (_, record) => {
        const rule = getActiveRule(record._id);
        if (rule) {
          return (
            <Tag
              icon={<ThunderboltOutlined />}
              color="blue"
              style={{ cursor: 'pointer' }}
              onClick={() => showAutoTradeModal(record)}
            >
              {rule.ruleType === 'target_sell' ? '목표매도' : '손절'} {rule.targetRate}%
            </Tag>
          );
        }
        return (
          <Button
            size="small"
            type="dashed"
            icon={<RobotOutlined />}
            onClick={() => showAutoTradeModal(record)}
          >
            설정
          </Button>
        );
      },
    },
    {
      title: '관리',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="primary" 
            ghost 
            icon={<PlusOutlined />} 
            onClick={() => {
              setSelectedStockId(record._id);
              navigate('/trades');
            }}
          >
            매입 등록
          </Button>
          <Button icon={<EditOutlined />} onClick={() => showModal(record)}>수정</Button>
          <Popconfirm title="정말 삭제하시겠습니까? 연결된 모든 매입 이력이 사라집니다." onConfirm={() => deleteStock(record._id)}>
            <Button danger icon={<DeleteOutlined />}>삭제</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card 
      title={<Title level={4} style={{ margin: 0 }}>보유 종목 관리</Title>} 
      extra={
        <Space>
          <Button 
            onClick={() => syncPrices()} 
            loading={stocksLoading}
          >
            어제 종가로 일괄 업데이트
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
            종목 추가
          </Button>
        </Space>
      }
    >
      <Table 
        dataSource={stocks} 
        columns={columns} 
        rowKey="_id" 
        loading={stocksLoading}
        scroll={{ x: 'max-content' }}
      />

      {/* 종목 등록/수정 모달 */}
      <Modal
        title={editingId ? "종목 수정" : "새 종목 등록"}
        open={isModalOpen}
        onOk={handleOk}
        onCancel={() => setIsModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="종목명" rules={[{ required: true, message: '종목명을 입력하세요' }]}>
            <AutoComplete
              options={searchOptions}
              onSearch={handleSearch}
              onSelect={onSelect}
              placeholder="예: 삼성전자"
              loading={searchLoading}
            />
          </Form.Item>
          <Form.Item name="ticker" label="종목코드(티커)" rules={[{ required: true, message: '티커를 입력하세요' }]}>
            <Input placeholder="예: 005930" />
          </Form.Item>
          <Form.Item name="market" label="시장" initialValue="KOSPI">
            <Select>
              <Select.Option value="KOSPI">KOSPI</Select.Option>
              <Select.Option value="KOSDAQ">KOSDAQ</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="currentPrice" label="현재가" rules={[{ required: true, message: '현재가를 입력하세요' }]}>
            <InputNumber style={{ width: '100%' }} formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={value => value.replace(/\$\s?|(,*)/g, '')} />
          </Form.Item>
          <Form.Item name="targetReturnRate" label="목표 수익률(%)" initialValue={10}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="memo" label="메모">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>

      {/* 자동매매 설정 모달 */}
      <Modal
        title={
          <Space>
            <RobotOutlined />
            <span>{autoTradeStockName} 자동매매 설정</span>
          </Space>
        }
        open={isAutoTradeModalOpen}
        onOk={handleAutoTradeOk}
        onCancel={() => setIsAutoTradeModalOpen(false)}
        destroyOnClose
        footer={[
          autoTradeForm.getFieldValue('_existingRuleId') && (
            <Popconfirm
              key="delete"
              title="이 자동매매 규칙을 삭제하시겠습니까?"
              onConfirm={handleAutoTradeDelete}
            >
              <Button danger>규칙 삭제</Button>
            </Popconfirm>
          ),
          <Button key="cancel" onClick={() => setIsAutoTradeModalOpen(false)}>
            취소
          </Button>,
          <Button key="save" type="primary" onClick={handleAutoTradeOk}>
            저장
          </Button>,
        ]}
      >
        <Form form={autoTradeForm} layout="vertical">
          <Form.Item name="ruleType" label="규칙 유형" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio.Button value="target_sell">🎯 목표 매도</Radio.Button>
              <Radio.Button value="stop_loss">🛑 손절</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="targetRate"
            label="목표 비율 (%)"
            rules={[{ required: true, message: '비율을 입력하세요' }]}
            extra="목표 매도: 양수 (예: 10%), 손절: 음수 (예: -5%)"
          >
            <InputNumber style={{ width: '100%' }} step={0.5} />
          </Form.Item>

          <Form.Item name="executionMode" label="실행 방식">
            <Radio.Group>
              <Radio value="manual">📢 알림만 (반자동)</Radio>
              <Radio value="auto" disabled>
                ⚡ 자동 매도 (준비 중)
              </Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="isActive" label="활성화" valuePropName="checked">
            <Switch checkedChildren="ON" unCheckedChildren="OFF" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default Stocks;
