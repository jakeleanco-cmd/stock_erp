const Stock = require('../models/Stock');
const kisWebSocket = require('../services/kisWebSocket');

/**
 * SSE(Server-Sent Events) 라우트
 * 
 * 왜 SSE인가:
 * - 클라이언트는 가격을 "수신만" 하면 됨 (단방향)
 * - Socket.io 같은 양방향 라이브러리 불필요
 * - 브라우저 내장 EventSource API로 바로 사용 가능
 * - 자동 재연결 기능 내장
 */

// SSE 클라이언트 목록 (연결된 모든 브라우저 세션)
const sseClients = new Set();

// 자동매매 알림용 SSE 클라이언트 목록
const alertClients = new Set();

/**
 * GET /api/realtime/prices
 * 실시간 가격 SSE 스트림
 * 
 * 클라이언트가 EventSource로 연결하면,
 * KIS WebSocket에서 수신되는 가격을 실시간으로 Push
 */
exports.priceStream = (req, res) => {
  // SSE 헤더 설정
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Nginx 프록시 버퍼링 비활성화
  });

  // 초기 연결 시 현재 캐시된 가격 전체 전송
  const latestPrices = kisWebSocket.latestPrices;
  if (Object.keys(latestPrices).length > 0) {
    res.write(`event: init\ndata: ${JSON.stringify(latestPrices)}\n\n`);
  }

  // WebSocket 연결 상태 전송
  res.write(`event: status\ndata: ${JSON.stringify({ connected: kisWebSocket.isConnected })}\n\n`);

  // 클라이언트 등록
  sseClients.add(res);
  console.log(`📺 SSE 클라이언트 연결 (총 ${sseClients.size}명)`);

  // 연결 종료 시 정리
  req.on('close', () => {
    sseClients.delete(res);
    console.log(`📺 SSE 클라이언트 해제 (총 ${sseClients.size}명)`);
  });
};

/**
 * GET /api/realtime/alerts
 * 매매 신호/알림 SSE 스트림
 */
exports.alertStream = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // 연결 확인 메시지
  res.write(`event: connected\ndata: ${JSON.stringify({ message: '알림 스트림 연결됨' })}\n\n`);

  alertClients.add(res);

  req.on('close', () => {
    alertClients.delete(res);
  });
};

/**
 * POST /api/realtime/subscribe
 * 특정 종목 실시간 구독 추가
 */
exports.subscribe = (req, res) => {
  try {
    const { ticker } = req.body;
    if (!ticker) {
      return res.status(400).json({ success: false, message: '종목코드(ticker)가 필요합니다.' });
    }

    kisWebSocket.subscribe(ticker);
    res.json({ success: true, message: `종목 ${ticker} 실시간 구독 시작` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/realtime/subscribe/:ticker
 * 특정 종목 실시간 구독 해제
 */
exports.unsubscribe = (req, res) => {
  try {
    const { ticker } = req.params;
    kisWebSocket.unsubscribe(ticker);
    res.json({ success: true, message: `종목 ${ticker} 실시간 구독 해제` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/realtime/status
 * WebSocket 연결 상태 및 구독 정보 조회
 */
exports.getStatus = (req, res) => {
  res.json({
    success: true,
    data: {
      ...kisWebSocket.getStatus(),
      sseClientCount: sseClients.size,
    },
  });
};

/**
 * POST /api/realtime/subscribe-all
 * DB에 등록된 모든 보유 종목을 일괄 구독
 */
exports.subscribeAll = async (req, res) => {
  try {
    const stocks = await Stock.find({}, 'ticker');
    const tickers = stocks.map(s => s.ticker);

    kisWebSocket.subscribeAll(tickers);

    res.json({
      success: true,
      message: `${tickers.length}개 종목 일괄 구독 완료`,
      data: tickers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── KIS WebSocket 이벤트 → SSE 브로드캐스트 ──────────────────

/**
 * KIS WebSocket에서 가격 이벤트를 수신하면
 * 연결된 모든 SSE 클라이언트에게 브로드캐스트
 */
kisWebSocket.on('price', (priceData) => {
  const message = `event: price\ndata: ${JSON.stringify(priceData)}\n\n`;

  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (err) {
      // 끊어진 클라이언트 정리
      sseClients.delete(client);
    }
  }
});

// WebSocket 연결 상태 변경 시 SSE로 알림
kisWebSocket.on('connected', () => {
  broadcastToSSE('status', { connected: true });
});

kisWebSocket.on('disconnected', () => {
  broadcastToSSE('status', { connected: false });
});

/**
 * SSE 클라이언트들에게 이벤트 브로드캐스트 유틸리티
 */
function broadcastToSSE(eventName, data) {
  const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

/**
 * 알림 SSE 클라이언트들에게 알림 브로드캐스트
 * autoTradeEngine에서 호출하기 위해 export
 */
function broadcastAlert(alertData) {
  const message = `event: alert\ndata: ${JSON.stringify(alertData)}\n\n`;
  for (const client of alertClients) {
    try {
      client.write(message);
    } catch (err) {
      alertClients.delete(client);
    }
  }
}

exports.broadcastAlert = broadcastAlert;
exports.broadcastToSSE = broadcastToSSE;
