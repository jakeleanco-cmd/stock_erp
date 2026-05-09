import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Layout, Result } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { authApi } from '../api';
import { message } from 'antd';

const { Title, Text } = Typography;

/**
 * 비밀번호 재설정 페이지
 * 이메일 + 가입 코드로 본인 인증 후 새 비밀번호 설정
 * 왜 가입 코드를 사용하는가: 별도 이메일 발송 시스템 없이 관리자가 공유한 코드로 본인 확인
 */
const ResetPassword = () => {
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const res = await authApi.resetPassword({
        email: values.email,
        registerCode: values.registerCode,
        newPassword: values.newPassword,
      });
      setIsSuccess(true);
      message.success(res.message || '비밀번호가 변경되었습니다.');
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 변경 완료 화면
  if (isSuccess) {
    return (
      <Layout style={{ minHeight: '100vh', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
        <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <Result
            status="success"
            title="비밀번호 변경 완료"
            subTitle="새 비밀번호로 로그인해 주세요."
            extra={
              <Link to="/login">
                <Button type="primary" size="large">로그인하기</Button>
              </Link>
            }
          />
        </Card>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2}>비밀번호 재설정</Title>
          <Text type="secondary">가입 코드 인증 후 새 비밀번호를 설정하세요</Text>
        </div>

        <Form
          name="resetPassword"
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
            <Input prefix={<UserOutlined />} placeholder="가입한 이메일" />
          </Form.Item>

          <Form.Item
            name="registerCode"
            rules={[{ required: true, message: '가입 코드를 입력해 주세요!' }]}
          >
            <Input.Password prefix={<SafetyOutlined />} placeholder="가입 코드" />
          </Form.Item>

          <Form.Item
            name="newPassword"
            rules={[
              { required: true, message: '새 비밀번호를 입력해 주세요!' },
              { min: 6, message: '비밀번호는 최소 6자 이상이어야 합니다!' }
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="새 비밀번호" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '비밀번호 확인을 입력해 주세요!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('비밀번호가 일치하지 않습니다!'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="새 비밀번호 확인" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={loading}>
              비밀번호 변경
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Link to="/login">로그인으로 돌아가기</Link>
          </div>
        </Form>
      </Card>
    </Layout>
  );
};

export default ResetPassword;
