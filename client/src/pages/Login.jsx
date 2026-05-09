import React from 'react';
import { Card, Form, Input, Button, Typography, Layout } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';

const { Title, Text } = Typography;

const Login = () => {
  const { login, authLoading } = useAuthStore();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    const success = await login(values);
    if (success) {
      navigate('/');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2}>Stock ERP</Title>
          <Text type="secondary">주식 매매 관리 시스템 로그인</Text>
        </div>
        
        <Form
          name="login"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          size="large"
          layout="vertical"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '이메일을 입력해 주세요!' },
              { type: 'email', message: '유효한 이메일 형식이 아닙니다!' }
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="이메일" />
          </Form.Item>
          
          <Form.Item
            name="password"
            rules={[{ required: true, message: '비밀번호를 입력해 주세요!' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="비밀번호" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={authLoading}>
              로그인
            </Button>
          </Form.Item>
          
          <div style={{ textAlign: 'center' }}>
            계정이 없으신가요? <Link to="/register">회원가입</Link>
            <span style={{ margin: '0 8px', color: '#d9d9d9' }}>|</span>
            <Link to="/reset-password">비밀번호 찾기</Link>
          </div>
        </Form>
      </Card>
    </Layout>
  );
};

export default Login;
