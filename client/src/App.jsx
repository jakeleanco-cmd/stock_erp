import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, Space } from 'antd';
import {
  DashboardOutlined,
  UnorderedListOutlined,
  LineChartOutlined,
  CalculatorOutlined,
  HistoryOutlined,
} from '@ant-design/icons';

import Dashboard from './pages/Dashboard';
import Stocks from './pages/Stocks';
import Trades from './pages/Trades';
import Strategy from './pages/Strategy';
import Sells from './pages/Sells';
import AlertCenter from './components/AlertCenter';
import useStockStore from './store/useStockStore';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const AppLayout = () => {
  const location = useLocation();
  const { fetchStocks, startRealtimeStream, stopRealtimeStream } = useStockStore();
  
  // 앱 실행 시 기본 데이터 로드 + 실시간 SSE 연결
  useEffect(() => {
    fetchStocks();
    startRealtimeStream();

    // 언마운트 시 SSE 정리
    return () => {
      stopRealtimeStream();
    };
  }, []);

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: <Link to="/">대시보드</Link> },
    { key: '/stocks', icon: <UnorderedListOutlined />, label: <Link to="/stocks">종목 관리</Link> },
    { key: '/trades', icon: <LineChartOutlined />, label: <Link to="/trades">매입 이력</Link> },
    { key: '/strategy', icon: <CalculatorOutlined />, label: <Link to="/strategy">매도 전략</Link> },
    { key: '/sells', icon: <HistoryOutlined />, label: <Link to="/sells">매도 기록</Link> },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'white', fontWeight: 'bold' }}>Stock ERP</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }}>주식 매매 관리 시스템</Title>
          {/* 알림 센터 (헤더 우측) */}
          <Space size="middle">
            <AlertCenter />
          </Space>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', borderRadius: 8, overflow: 'initial' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stocks" element={<Stocks />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/strategy" element={<Strategy />} />
            <Route path="/sells" element={<Sells />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

const App = () => (
  <Router>
    <AppLayout />
  </Router>
);

export default App;
