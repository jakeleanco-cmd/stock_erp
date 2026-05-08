import React, { useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Divider, Space } from 'antd';
import { SafetyCertificateOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import useAuthStore from '../store/useAuthStore';

const { Title, Text } = Typography;

/**
 * Settings 페이지 - KIS API 개인 설정 관리
 */
const Settings = () => {
  const { user, updateProfile, authLoading } = useAuthStore();
  const [form] = Form.useForm();

  // 사용자 정보가 있으면 폼 초기값 설정
  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        name: user.name,
        kisAppKey: user.kisAppKey,
        kisAccountNo: user.kisAccountNo,
        kisAccountProduct: user.kisAccountProduct || '01',
      });
    }
  }, [user, form]);

  const onFinish = async (values) => {
    await updateProfile(values);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px' }}>
      <Title level={2}>
        <SettingOutlined /> 설정
      </Title>
      <Text type="secondary">개인 프로필 및 한국투자증권 API 연동 정보를 관리합니다.</Text>
      
      <Divider />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 기본 정보 */}
        <Card title={<span><UserOutlined /> 기본 정보</span>} bordered={false}>
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
          >
            <Form.Item
              label="이름"
              name="name"
              rules={[{ required: true, message: '이름을 입력해 주세요.' }]}
            >
              <Input placeholder="이름" />
            </Form.Item>

            <Divider orientation="left">
              <SafetyCertificateOutlined /> 한국투자증권(KIS) API 연동
            </Divider>
            
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              개인별 한국투자증권 API 키를 입력하면 본인의 계좌로 자동매매 및 시세 조회가 가능합니다.
              <br />
              <Text type="danger">* KIS_APP_SECRET은 보안을 위해 별도로 입력할 때만 업데이트됩니다.</Text>
            </Text>

            <Form.Item
              label="KIS App Key"
              name="kisAppKey"
            >
              <Input placeholder="한국투자증권에서 발급받은 App Key" />
            </Form.Item>

            <Form.Item
              label="KIS App Secret"
              name="kisAppSecret"
            >
              <Input.Password placeholder="새로운 App Secret을 입력할 때만 변경됩니다." />
            </Form.Item>

            <div style={{ display: 'flex', gap: '16px' }}>
              <Form.Item
                label="종합계좌번호 (8자리)"
                name="kisAccountNo"
                style={{ flex: 1 }}
              >
                <Input placeholder="예: 12345678" maxLength={8} />
              </Form.Item>

              <Form.Item
                label="계좌상품코드 (2자리)"
                name="kisAccountProduct"
                style={{ flex: 1 }}
              >
                <Input placeholder="예: 01" maxLength={2} />
              </Form.Item>
            </div>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={authLoading} block size="large">
                설정 저장하기
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Space>
    </div>
  );
};

export default Settings;
