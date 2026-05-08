const Trade = require('../models/Trade');
const Stock = require('../models/Stock');
const AutoTradeRule = require('../models/AutoTradeRule');
const kisWebSocket = require('./kisWebSocket');
const { broadcastAlert } = require('../controllers/realtimeController');

/**
 * 자동매매 엔진
 * 
 * 역할:
 * 1. KIS WebSocket의 실시간 가격 이벤트를 구독
 * 2. 보유 종목별 매입 건(Trade)의 수익률을 실시간 계산
 * 3. AutoTradeRule의 조건 충족 여부 확인
 * 4. 조건 충족 시 → 알림(SSE) 발송 또는 자동 주문 실행
 * 
 * 왜 별도 서비스인가:
 * - 매매 로직은 WebSocket이나 SSE와 독립적으로 관리되어야 함
 * - 향후 복잡한 전략(볼린저밴드, 이평선 등) 추가 시 확장 가능
 */
class AutoTradeEngine {
  constructor() {
    // 활성 규칙 캐시 (DB 부하 줄이기 위해 메모리에 로드)
    this.activeRules = [];
    // 중복 알림 방지: 이미 트리거된 규칙 ID Set
    this.triggeredRuleIds = new Set();
    // 최근 알림 히스토리 (프론트엔드 표시용, 최대 50개)
    this.alertHistory = [];
    this.isInitialized = false;
  }

  /**
   * 엔진 초기화 - 서버 시작 시 1회 호출
   * DB에서 활성 규칙을 로드하고, 가격 이벤트 구독 시작
   */
  async init() {
    try {
      await this.loadActiveRules();

      // KIS WebSocket의 가격 변동 이벤트 구독
      kisWebSocket.on('price', (priceData) => {
        this._onPriceUpdate(priceData);
      });

      this.isInitialized = true;
      console.log(`✅ 자동매매 엔진 초기화 완료 (활성 규칙: ${this.activeRules.length}개)`);
    } catch (error) {
      console.error('❌ 자동매매 엔진 초기화 실패:', error.message);
    }
  }

  /**
   * DB에서 활성 규칙 로드 (상태가 watching인 것만)
   */
  async loadActiveRules() {
    this.activeRules = await AutoTradeRule.find({
      isActive: true,
      status: 'watching',
    }).populate('stockId', 'ticker name currentPrice');

    console.log(`📋 활성 자동매매 규칙 ${this.activeRules.length}개 로드`);
  }

  /**
   * 실시간 가격 업데이트 시 호출되는 콜백
   * 해당 종목의 활성 규칙들을 검사
   */
  async _onPriceUpdate(priceData) {
    const { ticker, currentPrice } = priceData;

    // 해당 종목에 대한 활성 규칙 필터링
    const relevantRules = this.activeRules.filter(
      (rule) => rule.stockId?.ticker === ticker
    );

    if (relevantRules.length === 0) return;

    // 해당 종목의 보유 중인 매입 건 조회
    const stock = relevantRules[0].stockId;
    let trades;
    try {
      trades = await Trade.find({
        stockId: stock._id,
        status: { $ne: 'sold' },
      });
    } catch (err) {
      return; // DB 조회 실패 시 무시
    }

    if (!trades || trades.length === 0) return;

    // 각 규칙별 조건 검사
    for (const rule of relevantRules) {
      // 이미 트리거된 규칙은 중복 처리하지 않음
      if (this.triggeredRuleIds.has(rule._id.toString())) continue;

      this._checkRule(rule, trades, currentPrice, stock);
    }

    // 종목 현재가 DB 업데이트 (5초에 한 번만, 과도한 DB 쓰기 방지)
    this._throttledPriceUpdate(stock._id, currentPrice);
  }

  /**
   * 개별 규칙 조건 검사
   */
  async _checkRule(rule, trades, currentPrice, stock) {
    const { ruleType, targetRate } = rule;

    // 각 매입 건의 수익률 계산
    for (const trade of trades) {
      const returnRate = ((currentPrice - trade.buyPrice) / trade.buyPrice) * 100;

      let isTriggered = false;

      if (ruleType === 'target_sell' && returnRate >= targetRate) {
        // 목표 수익률 달성
        isTriggered = true;
      } else if (ruleType === 'stop_loss' && returnRate <= targetRate) {
        // 손절 라인 도달 (targetRate가 음수)
        isTriggered = true;
      }

      if (isTriggered) {
        await this._triggerRule(rule, trade, currentPrice, returnRate, stock);
        break; // 하나라도 트리거되면 규칙 처리 완료
      }
    }
  }

  /**
   * 규칙 조건 충족 시 처리
   * - DB 상태 업데이트
   * - SSE 알림 발송
   * - (auto 모드일 경우) 매도 주문 실행
   */
  async _triggerRule(rule, trade, currentPrice, returnRate, stock) {
    const ruleId = rule._id.toString();
    this.triggeredRuleIds.add(ruleId);

    // DB 상태 업데이트
    await AutoTradeRule.findByIdAndUpdate(rule._id, {
      status: 'triggered',
      triggeredAt: new Date(),
    });

    // 알림 데이터 구성
    const alertData = {
      id: `alert_${Date.now()}_${ruleId}`,
      ruleId: rule._id,
      type: rule.ruleType,
      stockName: stock.name,
      ticker: stock.ticker,
      currentPrice,
      returnRate: parseFloat(returnRate.toFixed(2)),
      targetRate: rule.targetRate,
      tradeId: trade._id,
      quantity: trade.remainingQuantity,
      buyPrice: trade.buyPrice,
      executionMode: rule.executionMode,
      timestamp: new Date(),
      read: false,
    };

    // 알림 히스토리에 추가 (최대 50개 유지)
    this.alertHistory.unshift(alertData);
    if (this.alertHistory.length > 50) {
      this.alertHistory = this.alertHistory.slice(0, 50);
    }

    // SSE로 알림 브로드캐스트
    broadcastAlert(alertData);

    const typeLabel = rule.ruleType === 'target_sell' ? '🎯 목표 달성' : '🛑 손절 경고';
    console.log(`${typeLabel}: ${stock.name}(${stock.ticker}) | 현재가: ${currentPrice} | 수익률: ${returnRate.toFixed(2)}%`);

    // auto 모드일 경우 자동 매도 실행 (향후 구현)
    if (rule.executionMode === 'auto') {
      console.log(`⚡ 자동 매도 모드 - 매도 주문 준비 중...`);
      // TODO: kisApi.sellOrder 호출 후 SellRecord 생성
      // 현재는 알림만 보내고 수동 매도 유도
    }

    // 활성 규칙 캐시에서 제거
    this.activeRules = this.activeRules.filter(
      (r) => r._id.toString() !== ruleId
    );
  }

  // ─── DB 현재가 업데이트 쓰로틀링 ─────────────────────────────
  // 종목별 마지막 업데이트 시각 추적
  _lastPriceUpdateMap = {};

  /**
   * 종목 현재가를 DB에 저장 (5초에 1회 제한)
   * 실시간 가격이 초당 수십 건 들어오므로 DB 부하 방지
   */
  async _throttledPriceUpdate(stockId, currentPrice) {
    const key = stockId.toString();
    const now = Date.now();
    const lastUpdate = this._lastPriceUpdateMap[key] || 0;

    // 5초 이내 업데이트 건너뜀
    if (now - lastUpdate < 5000) return;

    this._lastPriceUpdateMap[key] = now;

    try {
      await Stock.findByIdAndUpdate(stockId, {
        currentPrice,
        priceUpdatedAt: new Date(),
      });
    } catch (err) {
      // DB 업데이트 실패는 무시 (실시간 캐시에는 반영되어 있음)
    }
  }

  /**
   * 규칙이 추가/수정/삭제될 때 캐시 새로고침
   */
  async refreshRules() {
    await this.loadActiveRules();
    // 트리거 이력 초기화 (재활성화된 규칙이 다시 감시되도록)
    this.triggeredRuleIds.clear();
  }

  /**
   * 알림 히스토리 조회
   */
  getAlertHistory() {
    return this.alertHistory;
  }

  /**
   * 엔진 상태 정보
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      activeRulesCount: this.activeRules.length,
      triggeredCount: this.triggeredRuleIds.size,
      alertCount: this.alertHistory.length,
    };
  }
}

// 싱글톤
module.exports = new AutoTradeEngine();
