const WebSocket = require('ws');
const axios = require('axios');
const EventEmitter = require('events');

/**
 * KIS WebSocket 실시간 체결가 수신 서비스
 * 
 * 역할:
 * 1. approval_key 발급 (REST)
 * 2. WebSocket 연결 (ws://ops.koreainvestment.com:21000)
 * 3. 보유 종목 실시간 체결가 구독 (H0STCNT0)
 * 4. 수신 데이터 파싱 후 이벤트 발행
 * 
 * 왜 EventEmitter인가:
 * - SSE 라우트, 자동매매 엔진 등 여러 소비자가 같은 가격 이벤트를 구독해야 함
 * - 느슨한 결합(Loose Coupling)으로 모듈 간 의존성 최소화
 */
class KisWebSocket extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.approvalKey = null;
    this.domain = process.env.KIS_DOMAIN || 'https://openapi.koreainvestment.com:9443';
    this.appKey = process.env.KIS_APP_KEY;
    this.appSecret = process.env.KIS_APP_SECRET;

    // WebSocket 주소 동적 결정 (환경변수 우선, 없으면 REST 도메인 기반 유추)
    if (process.env.KIS_WS_URL) {
      this.wsUrl = process.env.KIS_WS_URL;
    } else if (this.domain.includes('openapivts')) {
      // 모의투자 WebSocket
      this.wsUrl = 'ws://ops.koreainvestment.com:31000';
    } else {
      // 실전투자 WebSocket
      this.wsUrl = 'ws://ops.koreainvestment.com:21000';
    }

    // 현재 구독 중인 종목 코드 목록
    this.subscribedTickers = new Set();

    // 최신 가격 캐시 (종목코드 → 가격 데이터)
    this.latestPrices = {};

    // 재연결 관련 설정
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000; // 5초
    this.isManualClose = false; // 수동 종료 여부 (재연결 방지)
    this.isConnected = false;
  }

  /**
   * WebSocket 접속키(approval_key) 발급
   * REST API로 한 번 발급받으면 WebSocket 세션 동안 유효
   */
  async getApprovalKey() {
    try {
      const response = await axios.post(`${this.domain}/oauth2/Approval`, {
        grant_type: 'client_credentials',
        appkey: this.appKey,
        secretkey: this.appSecret,
      });

      this.approvalKey = response.data.approval_key;
      console.log('✅ KIS WebSocket approval_key 발급 성공');
      return this.approvalKey;
    } catch (error) {
      console.error('❌ KIS approval_key 발급 실패:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * WebSocket 연결 시작
   * 서버 기동 시 한 번 호출하면, 이후 자동 재연결 처리
   */
  async start() {
    if (!this.appKey || !this.appSecret) {
      console.warn('⚠️ KIS API 키가 설정되지 않아 실시간 시세를 사용할 수 없습니다.');
      return;
    }

    try {
      await this.getApprovalKey();
      this.connect();
    } catch (error) {
      console.error('❌ KIS WebSocket 시작 실패:', error.message);
    }
  }

  /**
   * 실제 WebSocket 연결 수립
   */
  connect() {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
    }

    this.ws = new WebSocket(this.wsUrl);
    this.isManualClose = false;

    this.ws.on('open', () => {
      console.log('✅ KIS WebSocket 연결 성공');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');

      // 이전에 구독했던 종목들 재구독 (재연결 시)
      if (this.subscribedTickers.size > 0) {
        console.log(`🔄 ${this.subscribedTickers.size}개 종목 재구독 시작...`);
        for (const ticker of this.subscribedTickers) {
          this._sendSubscribe(ticker);
        }
      }
    });

    this.ws.on('message', (rawData) => {
      this._handleMessage(rawData.toString());
    });

    this.ws.on('close', (code, reason) => {
      this.isConnected = false;
      console.log(`⚠️ KIS WebSocket 연결 종료 (code: ${code})`);
      this.emit('disconnected');

      // 수동 종료가 아닌 경우 자동 재연결
      if (!this.isManualClose) {
        this._scheduleReconnect();
      }
    });

    this.ws.on('error', (error) => {
      console.error('❌ KIS WebSocket 에러:', error.message);
    });
  }

  /**
   * 수신 메시지 처리
   * 
   * KIS WebSocket 메시지 형식:
   * - 구독 응답: JSON 형태 (header.tr_id 포함)
   * - 실시간 데이터: "암호화여부|TR_ID|건수|데이터" (파이프 구분)
   * - PINGPONG: 서버에서 보내는 핑에 대해 퐁 응답 필요
   */
  _handleMessage(data) {
    try {
      // PINGPONG 처리 (연결 유지용)
      if (data === 'PINGPONG') {
        // 서버로부터 PING 수신 시 동일한 PINGPONG 응답
        // 실제로는 KIS가 데이터 그대로 돌려보내라고 함
        return;
      }

      // JSON 형태 메시지 (구독 응답 등)
      if (data.startsWith('{')) {
        const json = JSON.parse(data);
        if (json.header) {
          const trId = json.header.tr_id;
          const msg = json.body?.msg1 || '';
          console.log(`📨 KIS 응답 [${trId}]: ${msg}`);
        }
        return;
      }

      // 실시간 데이터 메시지 파싱 ("암호화여부|TR_ID|건수|데이터")
      const parts = data.split('|');
      if (parts.length < 4) return;

      const [encrypted, trId, count, body] = parts;

      // 국내주식 실시간 체결가 (H0STCNT0)
      if (trId === 'H0STCNT0') {
        this._parseRealtimePrice(body);
      }
    } catch (error) {
      // JSON 파싱 실패 등은 무시 (비정상 메시지)
      console.error('⚠️ 메시지 파싱 오류:', error.message);
    }
  }

  /**
   * 실시간 체결가 데이터 파싱 (H0STCNT0)
   * 
   * 데이터는 '^' 구분자로 구분된 필드 리스트
   * 주요 필드 인덱스 (0-based):
   *  0: 종목코드
   *  1: 체결시간 (HHMMSS)
   *  2: 현재가 (stck_prpr)
   *  3: 전일대비부호 (1:상한, 2:상승, 3:보합, 4:하한, 5:하락)
   *  4: 전일대비
   *  5: 전일대비율
   *  7: 누적거래량
   */
  _parseRealtimePrice(body) {
    const fields = body.split('^');
    if (fields.length < 8) return;

    const ticker = fields[0];
    const priceData = {
      ticker,
      time: fields[1],                           // 체결시간 (HHMMSS)
      currentPrice: parseInt(fields[2], 10),      // 현재가
      changeSign: fields[3],                      // 전일대비부호
      change: parseInt(fields[4], 10),            // 전일대비
      changeRate: parseFloat(fields[5]),           // 전일대비율(%)
      volume: parseInt(fields[7], 10),            // 누적거래량
      updatedAt: new Date(),
    };

    // 가격 캐시 업데이트
    this.latestPrices[ticker] = priceData;

    // 가격 변동 이벤트 발행 → SSE, 자동매매 엔진 등에서 구독
    this.emit('price', priceData);
  }

  /**
   * 종목 실시간 체결가 구독 등록
   * @param {string} ticker - 종목코드 6자리 (예: '005930')
   */
  subscribe(ticker) {
    if (!ticker) return;
    this.subscribedTickers.add(ticker);

    if (this.isConnected) {
      this._sendSubscribe(ticker);
    }
  }

  /**
   * 종목 실시간 체결가 구독 해제
   * @param {string} ticker - 종목코드 6자리
   */
  unsubscribe(ticker) {
    this.subscribedTickers.delete(ticker);

    if (this.isConnected) {
      this._sendUnsubscribe(ticker);
    }

    // 가격 캐시에서도 제거
    delete this.latestPrices[ticker];
  }

  /**
   * 구독 요청 메시지 전송
   */
  _sendSubscribe(ticker) {
    const message = {
      header: {
        approval_key: this.approvalKey,
        custtype: 'P',           // P: 개인
        tr_type: '1',            // 1: 등록
        'content-type': 'utf-8',
      },
      body: {
        input: {
          tr_id: 'H0STCNT0',    // 국내주식 실시간 체결가
          tr_key: ticker,
        },
      },
    };

    this.ws.send(JSON.stringify(message));
    console.log(`📡 종목 ${ticker} 실시간 체결가 구독 요청`);
  }

  /**
   * 구독 해제 메시지 전송
   */
  _sendUnsubscribe(ticker) {
    const message = {
      header: {
        approval_key: this.approvalKey,
        custtype: 'P',
        tr_type: '2',            // 2: 해제
        'content-type': 'utf-8',
      },
      body: {
        input: {
          tr_id: 'H0STCNT0',
          tr_key: ticker,
        },
      },
    };

    this.ws.send(JSON.stringify(message));
    console.log(`🔕 종목 ${ticker} 실시간 체결가 구독 해제`);
  }

  /**
   * 여러 종목 일괄 구독
   * @param {string[]} tickers - 종목코드 배열
   */
  subscribeAll(tickers) {
    for (const ticker of tickers) {
      this.subscribe(ticker);
    }
  }

  /**
   * 자동 재연결 스케줄링
   * 지수 백오프(Exponential Backoff)로 재연결 간격 점진적 증가
   */
  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ KIS WebSocket 최대 재연결 시도 횟수 초과');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    console.log(`🔄 ${delay / 1000}초 후 재연결 시도 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(async () => {
      try {
        // approval_key 재발급 후 재연결
        await this.getApprovalKey();
        this.connect();
      } catch (error) {
        console.error('❌ 재연결 실패:', error.message);
        this._scheduleReconnect();
      }
    }, delay);
  }

  /**
   * WebSocket 수동 종료
   */
  stop() {
    this.isManualClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.subscribedTickers.clear();
    this.latestPrices = {};
    console.log('🛑 KIS WebSocket 수동 종료');
  }

  /**
   * 현재 연결 상태 정보 반환
   */
  getStatus() {
    return {
      connected: this.isConnected,
      subscribedTickers: Array.from(this.subscribedTickers),
      subscribedCount: this.subscribedTickers.size,
      latestPrices: this.latestPrices,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// 싱글톤으로 내보내기
module.exports = new KisWebSocket();
