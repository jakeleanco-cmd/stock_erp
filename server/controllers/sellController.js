const SellRecord = require('../models/SellRecord');
const Trade = require('../models/Trade');
const Stock = require('../models/Stock');

/**
 * GET /api/sells?stockId=xxx
 * 매도 기록 조회 (종목별 필터 가능)
 */
exports.getSellRecords = async (req, res) => {
  try {
    const { stockId } = req.query;
    const filter = { userId: req.user.id };
    if (stockId) filter.stockId = stockId;

    const records = await SellRecord.find(filter)
      .populate('stockId', 'name ticker')
      .populate('tradeId', 'tradeDate memo')
      .sort({ sellDate: -1 });

    res.json({ success: true, data: records });
  } catch (error) {
    console.error('매도 기록 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: error.message });
  }
};

/**
 * POST /api/sells
 * 매도 실행 - 매입 건에서 수량만큼 차감하고 매도 기록 생성
 */
exports.createSellRecord = async (req, res) => {
  try {
    const { tradeId, sellDate, quantity, sellPrice, memo } = req.body;

    // 매입 건 조회 (사용자 소유 확인)
    const trade = await Trade.findOne({ _id: tradeId, userId: req.user.id }).populate('stockId');
    if (!trade) {
      return res.status(404).json({ success: false, message: '매입 이력을 찾을 수 없습니다.' });
    }

    // 매도 수량 유효성 체크
    if (quantity > trade.remainingQuantity) {
      return res.status(400).json({
        success: false,
        message: `매도 수량(${quantity}주)이 보유 수량(${trade.remainingQuantity}주)을 초과합니다.`,
      });
    }

    // 매도 기록 생성 (pre save 훅에서 수익/세금/수수료 자동 계산)
    const sellRecord = new SellRecord({
      userId: req.user.id,
      tradeId,
      stockId: trade.stockId._id,
      sellDate,
      quantity: Number(quantity),
      sellPrice: Number(sellPrice),
      buyPrice: trade.buyPrice, // 매입 단가 스냅샷 보존
      memo,
    });

    await sellRecord.save();

    // 매입 건의 남은 수량 차감 및 상태 업데이트
    trade.remainingQuantity -= Number(quantity);

    if (trade.remainingQuantity === 0) {
      trade.status = 'sold'; // 전량 매도 완료
    } else {
      trade.status = 'partial_sold'; // 부분 매도
    }

    await trade.save();

    res.status(201).json({
      success: true,
      data: sellRecord,
      message: `${trade.stockId.name} ${quantity}주 매도가 기록되었습니다. 실현 순수익: ${sellRecord.netProfit.toLocaleString()}원`,
    });
  } catch (error) {
    console.error('매도 기록 등록 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: error.message });
  }
};

/**
 * DELETE /api/sells/:id
 * 매도 기록 취소 (보유 수량 복구)
 */
exports.deleteSellRecord = async (req, res) => {
  try {
    const record = await SellRecord.findOne({ _id: req.params.id, userId: req.user.id });
    if (!record) {
      return res.status(404).json({ success: false, message: '매도 기록을 찾을 수 없습니다.' });
    }

    // 원래 매입 건의 수량 복구
    const trade = await Trade.findOne({ _id: record.tradeId, userId: req.user.id });
    if (trade) {
      trade.remainingQuantity += record.quantity;
      // 상태 재계산
      if (trade.remainingQuantity === trade.quantity) {
        trade.status = 'holding';
      } else {
        trade.status = 'partial_sold';
      }
      await trade.save();
    }

    await record.deleteOne();
    res.json({ success: true, message: '매도 기록이 취소되었습니다. 보유 수량이 복구되었습니다.' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: error.message });
  }
};

/**
 * GET /api/sells/summary
 * 월별/종목별 실현 수익 통계
 */
exports.getSellSummary = async (req, res) => {
  try {
    const summary = await SellRecord.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: {
            year: { $year: '$sellDate' },
            month: { $month: '$sellDate' },
            stockId: '$stockId',
          },
          totalNetProfit: { $sum: '$netProfit' },
          totalQuantity: { $sum: '$quantity' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
    ]);

    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: error.message });
  }
};

/**
 * GET /api/sells/strategy/:stockId
 * 매도 전략 계산기 - 목표 수익률 달성 가능한 매입 건 목록 반환
 * query: targetRate (목표 수익률 %)
 */
exports.getStrategyByStock = async (req, res) => {
  try {
    const { stockId } = req.params;
    const targetRate = parseFloat(req.query.targetRate) || 10;

    const stock = await Stock.findOne({ _id: stockId, userId: req.user.id });
    if (!stock) {
      return res.status(404).json({ success: false, message: '종목을 찾을 수 없습니다.' });
    }

    const currentPrice = stock.currentPrice;

    // 보유 중인 매입 건 목록
    const trades = await Trade.find({
      userId: req.user.id,
      stockId,
      status: { $ne: 'sold' },
    }).sort({ buyPrice: 1 }); // 매입단가 낮은 순 (수익률 높은 순)

    // 각 매입 건의 현재 수익률 계산
    const tradesWithStrategy = trades.map((trade) => {
      const returnRate = currentPrice > 0
        ? parseFloat((((currentPrice - trade.buyPrice) / trade.buyPrice) * 100).toFixed(2))
        : null;

      // 세후 순수익 계산
      const grossProfit = (currentPrice - trade.buyPrice) * trade.remainingQuantity;
      const transactionTax = Math.round(currentPrice * trade.remainingQuantity * 0.002);
      const commission = Math.round(
        trade.buyPrice * trade.remainingQuantity * 0.00015 +
        currentPrice * trade.remainingQuantity * 0.00015
      );
      const netProfit = grossProfit - transactionTax - commission;
      const netReturnRate = trade.buyPrice > 0
        ? parseFloat(((netProfit / (trade.buyPrice * trade.remainingQuantity)) * 100).toFixed(2))
        : null;

      return {
        ...trade.toObject(),
        strategy: {
          currentPrice,
          returnRate,           // 세전 수익률
          netReturnRate,        // 세후 순수익률
          netProfit,            // 예상 순수익
          transactionTax,       // 예상 거래세
          commission,           // 예상 수수료
          isTargetAchieved: returnRate !== null && returnRate >= targetRate,
          // 목표 수익률 달성을 위한 최소 매도가
          targetSellPrice: Math.ceil(trade.buyPrice * (1 + targetRate / 100)),
        },
      };
    });

    // 목표 달성 건과 미달성 건 분리
    const achieved = tradesWithStrategy.filter((t) => t.strategy.isTargetAchieved);
    const notAchieved = tradesWithStrategy.filter((t) => !t.strategy.isTargetAchieved);

    // 목표 달성 건 전체 매도 시 총 예상 수익
    const totalNetProfit = achieved.reduce((sum, t) => sum + t.strategy.netProfit, 0);

    res.json({
      success: true,
      data: {
        stock,
        targetRate,
        currentPrice,
        achieved,
        notAchieved,
        totalNetProfit,
        achievedCount: achieved.length,
      },
    });
  } catch (error) {
    console.error('전략 계산 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: error.message });
  }
};
