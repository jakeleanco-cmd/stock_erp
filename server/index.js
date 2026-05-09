const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const stockRoutes = require('./routes/stockRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const sellRoutes = require('./routes/sellRoutes');
const realtimeRoutes = require('./routes/realtimeRoutes');
const autoTradeRoutes = require('./routes/autoTradeRoutes');
const authRoutes = require('./routes/authRoutes');
const { protect } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 5001;

// ─── 미들웨어 설정 ───────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── API 라우터 등록 ─────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/stocks', protect, stockRoutes);
app.use('/api/trades', protect, tradeRoutes);
app.use('/api/sells', protect, sellRoutes);
app.use('/api/realtime', protect, realtimeRoutes);
app.use('/api/auto-trade', protect, autoTradeRoutes);

// ─── 헬스 체크 ───────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Stock ERP Server is running!', time: new Date() });
});

// ─── 존재하지 않는 라우트 처리 ───────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `경로를 찾을 수 없습니다: ${req.path}` });
});

// ─── 전역 에러 핸들러 ────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('서버 에러:', err.stack);
  res.status(500).json({ success: false, message: '서버 내부 오류가 발생했습니다.', error: err.message });
});

const kisMasterFile = require('./services/kisMasterFile');
const kisWebSocket = require('./services/kisWebSocket');
const autoTradeEngine = require('./services/autoTradeEngine');
const Stock = require('./models/Stock');

// ─── MongoDB 연결 후 서버 시작 ───────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB 연결 성공');
    
    // KIS 종목 마스터 데이터 메모리 로드
    await kisMasterFile.loadMasterData();

    // 실시간 시세 WebSocket 시작
    await kisWebSocket.start();

    // 보유 종목 자동 구독 (DB에 등록된 종목들)
    try {
      const stocks = await Stock.find({}, 'ticker');
      if (stocks.length > 0) {
        const tickers = stocks.map(s => s.ticker);
        kisWebSocket.subscribeAll(tickers);
        console.log(`📡 보유 종목 ${tickers.length}개 실시간 구독 시작`);
      }
    } catch (err) {
      console.warn('⚠️ 보유 종목 자동 구독 실패:', err.message);
    }

    // 자동매매 엔진 초기화
    await autoTradeEngine.init();

    // Vercel 환경이 아닐 때만 listen 실행
    if (process.env.NODE_ENV !== 'production') {
      app.listen(PORT, () => {
        console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
      });
    }
  })
  .catch((err) => {
    console.error('❌ MongoDB 연결 실패:', err.message);
    process.exit(1);
  });

// Vercel Serverless Function을 위해 app 수출
module.exports = app;

