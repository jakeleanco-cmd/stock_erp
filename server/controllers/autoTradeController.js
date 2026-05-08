const AutoTradeRule = require('../models/AutoTradeRule');
const Stock = require('../models/Stock');
const Trade = require('../models/Trade');
const SellRecord = require('../models/SellRecord');
const autoTradeEngine = require('../services/autoTradeEngine');

/**
 * GET /api/auto-trade/rules
 * 전체 자동매매 규칙 목록 조회
 */
exports.getRules = async (req, res) => {
  try {
    const { stockId } = req.query;
    const filter = stockId ? { stockId } : {};

    const rules = await AutoTradeRule.find(filter)
      .populate('stockId', 'name ticker currentPrice')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('자동매매 규칙 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

/**
 * POST /api/auto-trade/rules
 * 새 자동매매 규칙 생성
 */
exports.createRule = async (req, res) => {
  try {
    const { stockId, ruleType, targetRate, executionMode, memo } = req.body;

    // 종목 존재 확인
    const stock = await Stock.findById(stockId);
    if (!stock) {
      return res.status(404).json({ success: false, message: '종목을 찾을 수 없습니다.' });
    }

    // 같은 종목 + 같은 유형의 활성 규칙 중복 체크
    const existing = await AutoTradeRule.findOne({
      stockId,
      ruleType,
      isActive: true,
      status: 'watching',
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `이미 ${stock.name}에 대한 ${ruleType === 'target_sell' ? '목표 매도' : '손절'} 규칙이 존재합니다.`,
      });
    }

    const rule = new AutoTradeRule({
      stockId,
      ruleType,
      targetRate,
      executionMode: executionMode || 'manual',
      memo,
    });

    await rule.save();

    // 엔진 캐시 새로고침
    await autoTradeEngine.refreshRules();

    const typeLabel = ruleType === 'target_sell' ? '목표 매도' : '손절';
    res.status(201).json({
      success: true,
      data: rule,
      message: `${stock.name} ${typeLabel} 규칙이 등록되었습니다. (${targetRate}%)`,
    });
  } catch (error) {
    console.error('자동매매 규칙 생성 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

/**
 * PUT /api/auto-trade/rules/:id
 * 자동매매 규칙 수정
 */
exports.updateRule = async (req, res) => {
  try {
    const { targetRate, isActive, executionMode, memo } = req.body;

    const rule = await AutoTradeRule.findByIdAndUpdate(
      req.params.id,
      { targetRate, isActive, executionMode, memo },
      { new: true, runValidators: true }
    ).populate('stockId', 'name ticker');

    if (!rule) {
      return res.status(404).json({ success: false, message: '규칙을 찾을 수 없습니다.' });
    }

    // 엔진 캐시 새로고침
    await autoTradeEngine.refreshRules();

    res.json({ success: true, data: rule, message: '규칙이 수정되었습니다.' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

/**
 * DELETE /api/auto-trade/rules/:id
 * 자동매매 규칙 삭제
 */
exports.deleteRule = async (req, res) => {
  try {
    const rule = await AutoTradeRule.findByIdAndDelete(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: '규칙을 찾을 수 없습니다.' });
    }

    // 엔진 캐시 새로고침
    await autoTradeEngine.refreshRules();

    res.json({ success: true, message: '자동매매 규칙이 삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

/**
 * POST /api/auto-trade/execute/:id
 * 반자동 모드에서 사용자가 수동으로 매도 실행
 * 트리거된 규칙의 매입 건을 현재가로 매도 처리
 */
exports.executeRule = async (req, res) => {
  try {
    const rule = await AutoTradeRule.findById(req.params.id).populate('stockId');
    if (!rule) {
      return res.status(404).json({ success: false, message: '규칙을 찾을 수 없습니다.' });
    }

    if (rule.status !== 'triggered') {
      return res.status(400).json({ success: false, message: '아직 조건이 충족되지 않은 규칙입니다.' });
    }

    const stock = rule.stockId;

    // 보유 중인 매입 건 조회
    const trades = await Trade.find({
      stockId: stock._id,
      status: { $ne: 'sold' },
    });

    if (!trades || trades.length === 0) {
      return res.status(400).json({ success: false, message: '매도할 보유 주식이 없습니다.' });
    }

    // 조건 충족된 매입 건들을 현재가로 매도
    const currentPrice = stock.currentPrice;
    let totalSold = 0;

    for (const trade of trades) {
      const returnRate = ((currentPrice - trade.buyPrice) / trade.buyPrice) * 100;

      // 목표 달성 조건에 맞는 매입 건만 매도
      const shouldSell =
        (rule.ruleType === 'target_sell' && returnRate >= rule.targetRate) ||
        (rule.ruleType === 'stop_loss' && returnRate <= rule.targetRate);

      if (!shouldSell) continue;

      // 매도 기록 생성
      const sellRecord = new SellRecord({
        tradeId: trade._id,
        stockId: stock._id,
        sellDate: new Date(),
        quantity: trade.remainingQuantity,
        sellPrice: currentPrice,
        buyPrice: trade.buyPrice,
        memo: `자동매매 규칙(${rule.ruleType === 'target_sell' ? '목표매도' : '손절'} ${rule.targetRate}%) 실행`,
      });

      await sellRecord.save();

      // 매입 건 수량 차감
      trade.remainingQuantity = 0;
      trade.status = 'sold';
      await trade.save();

      totalSold += sellRecord.quantity;
    }

    // 규칙 상태를 executed로 업데이트
    rule.status = 'executed';
    rule.executedAt = new Date();
    await rule.save();

    // 엔진 캐시 새로고침
    await autoTradeEngine.refreshRules();

    res.json({
      success: true,
      message: `${stock.name} ${totalSold}주 매도 완료 (${rule.ruleType === 'target_sell' ? '목표매도' : '손절'})`,
    });
  } catch (error) {
    console.error('자동매매 실행 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

/**
 * GET /api/auto-trade/alerts
 * 알림 히스토리 조회
 */
exports.getAlerts = (req, res) => {
  res.json({
    success: true,
    data: autoTradeEngine.getAlertHistory(),
  });
};

/**
 * GET /api/auto-trade/status
 * 자동매매 엔진 상태 정보
 */
exports.getEngineStatus = (req, res) => {
  res.json({
    success: true,
    data: autoTradeEngine.getStatus(),
  });
};
