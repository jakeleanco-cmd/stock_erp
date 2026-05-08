const Trade = require('../models/Trade');
const Stock = require('../models/Stock');

/**
 * GET /api/trades?stockId=xxx
 * 특정 종목의 전체 매입 이력 조회
 * 현재가 기준 수익률 계산 포함
 */
exports.getTradesByStock = async (req, res) => {
  try {
    const { stockId } = req.query;

    const filter = { userId: req.user.id };
    if (stockId) filter.stockId = stockId;

    const trades = await Trade.find(filter)
      .populate('stockId', 'name ticker currentPrice targetReturnRate')
      .sort({ tradeDate: -1 });

    // 각 매입 건마다 수익률 계산 추가
    const tradesWithMetrics = trades.map((trade) => {
      const currentPrice = trade.stockId?.currentPrice || 0;
      const returnRate = buyPrice => currentPrice > 0
        ? parseFloat((((currentPrice - buyPrice) / buyPrice) * 100).toFixed(2))
        : null;

      const rate = returnRate(trade.buyPrice);
      const unrealizedProfit = currentPrice > 0
        ? (currentPrice - trade.buyPrice) * trade.remainingQuantity
        : null;
      const currentValue = currentPrice * trade.remainingQuantity;
      const targetReturnRate = trade.stockId?.targetReturnRate || 10;

      return {
        ...trade.toObject(),
        metrics: {
          returnRate: rate,
          unrealizedProfit,
          currentValue,
          // 목표 수익률 달성 여부
          isTargetAchieved: rate !== null && rate >= targetReturnRate,
          targetReturnRate,
        },
      };
    });

    res.json({ success: true, data: tradesWithMetrics });
  } catch (error) {
    console.error('매입 이력 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: error.message });
  }
};

/**
 * GET /api/trades/:id
 * 특정 매입 건 상세 조회
 */
exports.getTradeById = async (req, res) => {
  try {
    const trade = await Trade.findOne({ _id: req.params.id, userId: req.user.id })
      .populate('stockId', 'name ticker currentPrice targetReturnRate');

    if (!trade) {
      return res.status(404).json({ success: false, message: '매입 이력을 찾을 수 없습니다.' });
    }

    res.json({ success: true, data: trade });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: error.message });
  }
};

/**
 * POST /api/trades
 * 새 매입 이력 등록
 */
exports.createTrade = async (req, res) => {
  try {
    const { stockId, tradeDate, quantity, buyPrice, memo } = req.body;

    // 종목 존재 및 소유 여부 확인
    const stock = await Stock.findOne({ _id: stockId, userId: req.user.id });
    if (!stock) {
      return res.status(404).json({ success: false, message: '종목을 찾을 수 없습니다.' });
    }

    const trade = new Trade({
      userId: req.user.id,
      stockId,
      tradeDate,
      quantity: Number(quantity),
      buyPrice: Number(buyPrice),
      memo,
    });

    await trade.save();

    res.status(201).json({
      success: true,
      data: trade,
      message: `${stock.name} 매입 이력이 등록되었습니다.`,
    });
  } catch (error) {
    console.error('매입 이력 등록 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: error.message });
  }
};

/**
 * PUT /api/trades/:id
 * 매입 이력 수정 (수량/단가/날짜/메모)
 */
exports.updateTrade = async (req, res) => {
  try {
    const { quantity, buyPrice, tradeDate, memo } = req.body;

    const trade = await Trade.findOne({ _id: req.params.id, userId: req.user.id });
    if (!trade) {
      return res.status(404).json({ success: false, message: '매입 이력을 찾을 수 없습니다.' });
    }

    // 전량 매도 완료된 건은 수정 불가
    if (trade.status === 'sold') {
      return res.status(400).json({ success: false, message: '전량 매도 완료된 이력은 수정할 수 없습니다.' });
    }

    if (tradeDate) trade.tradeDate = tradeDate;
    if (memo !== undefined) trade.memo = memo;

    // 수량/단가 변경 시 총 매입금도 재계산
    if (quantity) {
      trade.quantity = Number(quantity);
      trade.remainingQuantity = Number(quantity); // 부분 매도 없는 경우만 허용
      trade.totalCost = trade.quantity * trade.buyPrice;
    }
    if (buyPrice) {
      trade.buyPrice = Number(buyPrice);
      trade.totalCost = trade.quantity * trade.buyPrice;
    }

    await trade.save();
    res.json({ success: true, data: trade, message: '매입 이력이 수정되었습니다.' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: error.message });
  }
};

/**
 * DELETE /api/trades/:id
 * 매입 이력 삭제
 */
exports.deleteTrade = async (req, res) => {
  try {
    const trade = await Trade.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!trade) {
      return res.status(404).json({ success: false, message: '매입 이력을 찾을 수 없습니다.' });
    }
    res.json({ success: true, message: '매입 이력이 삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: error.message });
  }
};
