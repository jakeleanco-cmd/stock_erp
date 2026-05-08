const express = require('express');
const router = express.Router();
const {
  priceStream,
  alertStream,
  subscribe,
  unsubscribe,
  getStatus,
  subscribeAll,
} = require('../controllers/realtimeController');

// 실시간 가격 SSE 스트림
router.get('/prices', priceStream);

// 매매 신호 알림 SSE 스트림
router.get('/alerts', alertStream);

// WebSocket 연결 상태 조회
router.get('/status', getStatus);

// 개별 종목 구독/해제
router.post('/subscribe', subscribe);
router.delete('/subscribe/:ticker', unsubscribe);

// 보유 종목 일괄 구독
router.post('/subscribe-all', subscribeAll);

module.exports = router;
