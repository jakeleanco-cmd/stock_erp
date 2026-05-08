import React from 'react';
import { Card, Form, Input, Button, Typography, Layout } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';

const { Title, Text } = Typography;

const Register = () => {
  const { register, authLoading } = useAuthStore();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    const success = await register(values);
    if (success) {
      navigate('/');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2}>회원가입</Title>
          <Text type="secondary">Stock ERP 서비스 이용을 위해 가입하세요</Text>
        </div>
        
        <Form
          name="register"
          onFinish={onFinish}
          size="large"
          layout="vertical"
        >
          <Form.Item
            name="name"
            rules={[{ required: true, message: '이름을 입력해 주세요!' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="이름" />
          </Form.Item>

          <Form.Item
            name="email"
            rules={[
              { required: true, message: '이메일을 입력해 주세요!' },
              { type: 'email', message: '유효한 이메일 형식이 아닙니다!' }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="이메일" />
          </Form.Item>

          <Form.Item
            name="registerCode"
            rules={[{ required: true, message: '가입 코드를 입력해 주세요!' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="가입 코드 (stock1234)" />
          </Form.Item>
          
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '비밀번호를 입력해 주세요!' },
              { min: 6, message: '비밀번호는 최소 6자 이상이어야 합니다!' }
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="비밀번호" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '비밀번호 확인을 입력해 주세요!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('비밀번호가 일치하지 않습니다!'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="비밀번호 확인" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={authLoading}>
              가입하기
            </Button>
          </Form.Item>
          
          <div style={{ textAlign: 'center' }}>
            이미 계정이 있으신가요? <Link to="/login">로그인</Link>
          </div>
        </Form>
      </Card>
    </Layout>
  );
};

export default Register;
