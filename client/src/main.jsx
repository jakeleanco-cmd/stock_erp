import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import koKR from 'antd/locale/ko_KR';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import './index.css';
import App from './App.jsx';

// dayjs 한국어 로케일 설정
dayjs.locale('ko');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Ant Design 전역 설정 - 한국어 로케일 및 테마 */}
    <ConfigProvider
      locale={koKR}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
          borderRadius: 8,
        },
      }}
    >
      <App />
    </ConfigProvider>
  </StrictMode>
);
