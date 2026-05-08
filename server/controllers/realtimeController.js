const Stock = require('../models/Stock');
const kisWebSocket = require('../services/kisWebSocket');

/**
 * SSE(Server-Sent Events) 라우트 (사용자별 관리)
 */

// 사용자별 SSE 클라이언트 목록 (userId -> Set of response objects)
const sseClients = new Map();

// 사용자별 알림 SSE 클라이언트 목록 (userId -> Set of response objects)
const alertClients = new Map();

/**
 * GET /api/realtime/prices
 * 실시간 가격 SSE 스트림
 */
exports.priceStream = (req, res) => {
  const userId = req.user.id;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // 해당 사용자의 보유 종목만 초기 가격 전송
  const getInitialPrices = async () => {
    const userStocks = await Stock.find({ userId }, 'ticker');
    const tickers = userStocks.map(s => s.ticker);
    const latestPrices = kisWebSocket.latestPrices;
    
    const userPrices = {};
    tickers.forEach(t => {
      if (latestPrices[t]) userPrices[t] = latestPrices[t];
    });

    if (Object.keys(userPrices).length > 0) {
      res.write(`event: init\ndata: ${JSON.stringify(userPrices)}\n\n`);
    }
  };

  getInitialPrices();

  // WebSocket 연결 상태 전송
  res.write(`event: status\ndata: ${JSON.stringify({ connected: kisWebSocket.isConnected })}\n\n`);

  // 클라이언트 등록
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId).add(res);

  req.on('close', () => {
    const clients = sseClients.get(userId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) sseClients.delete(userId);
    }
  });
};

/**
 * GET /api/realtime/alerts
 * 매매 신호/알림 SSE 스트림
 */
exports.alertStream = (req, res) => {
  const userId = req.user.id;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ message: '알림 스트림 연결됨' })}\n\n`);

  if (!alertClients.has(userId)) {
    alertClients.set(userId, new Set());
  }
  alertClients.get(userId).add(res);

  req.on('close', () => {
    const clients = alertClients.get(userId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) alertClients.delete(userId);
    }
  });
};

/**
 * POST /api/realtime/subscribe
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
 */
exports.getStatus = (req, res) => {
  res.json({
    success: true,
    data: {
      ...kisWebSocket.getStatus(),
      activeUsers: sseClients.size,
    },
  });
};

/**
 * POST /api/realtime/subscribe-all
 */
exports.subscribeAll = async (req, res) => {
  try {
    const stocks = await Stock.find({ userId: req.user.id }, 'ticker');
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

// ─── KIS WebSocket 이벤트 → 사용자별 브로드캐스트 ──────────────────

/**
 * 가격 정보를 해당 종목을 보유한 사용자들에게만 전송
 */
kisWebSocket.on('price', async (priceData) => {
  const { ticker } = priceData;
  const message = `event: price\ndata: ${JSON.stringify(priceData)}\n\n`;

  // 이 종목을 보유한 사용자들 조회 (성능을 위해 인메모리 캐싱 고려 가능)
  // 여기서는 단순하게 매번 DB 조회 또는 sseClients 순회
  for (const [userId, clients] of sseClients.entries()) {
    try {
      const hasStock = await Stock.exists({ userId, ticker });
      if (hasStock) {
        clients.forEach(client => {
          try { client.write(message); } catch (e) { clients.delete(client); }
        });
      }
    } catch (err) {
      console.error('SSE 전송 중 오류:', err);
    }
  }
});

// 상태 변경은 전역 브로드캐스트
kisWebSocket.on('connected', () => broadcastToAll('status', { connected: true }));
kisWebSocket.on('disconnected', () => broadcastToAll('status', { connected: false }));

function broadcastToAll(eventName, data) {
  const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const clients of sseClients.values()) {
    clients.forEach(client => {
      try { client.write(message); } catch (e) { clients.delete(client); }
    });
  }
}

/**
 * 특정 사용자에게 알림 전송
 */
function broadcastAlert(userId, alertData) {
  const message = `event: alert\ndata: ${JSON.stringify(alertData)}\n\n`;
  const clients = alertClients.get(userId.toString());
  if (clients) {
    clients.forEach(client => {
      try { client.write(message); } catch (e) { clients.delete(client); }
    });
  }
}

exports.broadcastAlert = broadcastAlert;
exports.broadcastToAll = broadcastToAll;
