import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Layout, Menu, Typography, Space, Button, Spin } from 'antd';
import {
  DashboardOutlined,
  UnorderedListOutlined,
  LineChartOutlined,
  CalculatorOutlined,
  HistoryOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons';

import Dashboard from './pages/Dashboard';
import Stocks from './pages/Stocks';
import Trades from './pages/Trades';
import Strategy from './pages/Strategy';
import Sells from './pages/Sells';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import Settings from './pages/Settings';
import AlertCenter from './components/AlertCenter';
import useStockStore from './store/useStockStore';
import useAuthStore from './store/useAuthStore';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

/**
 * 인증 보호 라우트 컴포넌트
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, authLoading } = useAuthStore();
  
  if (authLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" tip="인증 정보를 확인 중입니다..." />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

const AppLayout = () => {
  const location = useLocation();
  const { fetchStocks, startRealtimeStream, stopRealtimeStream } = useStockStore();
  const { isAuthenticated, user, logout, initAuth } = useAuthStore();
  
  // 앱 실행 시 인증 초기화
  useEffect(() => {
    initAuth();
  }, []);

  // 인증 완료 후 데이터 로드 + 실시간 SSE 연결
  useEffect(() => {
    if (isAuthenticated) {
      fetchStocks();
      startRealtimeStream();
    } else {
      stopRealtimeStream();
    }

    return () => {
      stopRealtimeStream();
    };
  }, [isAuthenticated]);

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: <Link to="/">대시보드</Link> },
    { key: '/stocks', icon: <UnorderedListOutlined />, label: <Link to="/stocks">종목 관리</Link> },
    { key: '/trades', icon: <LineChartOutlined />, label: <Link to="/trades">매입 이력</Link> },
    { key: '/strategy', icon: <CalculatorOutlined />, label: <Link to="/strategy">매도 전략</Link> },
    { key: '/sells', icon: <HistoryOutlined />, label: <Link to="/sells">매도 기록</Link> },
    { key: '/settings', icon: <SettingOutlined />, label: <Link to="/settings">설정</Link> },
  ];

  // 로그인/회원가입/비밀번호 재설정 페이지는 레이아웃을 다르게 처리
  if (['/login', '/register', '/reset-password'].includes(location.pathname)) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    );
  }

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
          
          <Space size="middle">
            {isAuthenticated && (
              <Space>
                <Text strong>{user?.name}님</Text>
                <Button 
                  type="text" 
                  icon={<LogoutOutlined />} 
                  onClick={logout}
                >
                  로그아웃
                </Button>
              </Space>
            )}
            <AlertCenter />
          </Space>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', borderRadius: 8, overflow: 'initial' }}>
          <Routes>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/stocks" element={<ProtectedRoute><Stocks /></ProtectedRoute>} />
            <Route path="/trades" element={<ProtectedRoute><Trades /></ProtectedRoute>} />
            <Route path="/strategy" element={<ProtectedRoute><Strategy /></ProtectedRoute>} />
            <Route path="/sells" element={<ProtectedRoute><Sells /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
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
