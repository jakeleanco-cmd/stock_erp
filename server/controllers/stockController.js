const Stock = require('../models/Stock');
const Trade = require('../models/Trade');
const axios = require('axios');

const kisMasterFile = require('../services/kisMasterFile');
const kisApi = require('../services/kisApi');

/**
 * GET /api/stocks/search?q=삼성
 * 한국투자증권 마스터 파일을 활용한 종목 검색
 */
exports.searchStocks = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) {
      return res.json({ success: true, data: [] });
    }

    // 메모리에 로드된 KIS 마스터 파일에서 직접 검색 (속도 매우 빠름)
    const results = kisMasterFile.search(q);
    
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('종목 검색 오류 (KIS Master):', error);
    res.status(500).json({ success: false, message: '검색 서비스 일시 장애' });
  }
};

/**
 * 현재가와 매입단가를 기반으로 각 매입 건의 수익률 정보를 계산
 */
const calcTradeMetrics = (trade, currentPrice) => {
  const returnRate = (((currentPrice - trade.buyPrice) / trade.buyPrice) * 100).toFixed(2);
  const unrealizedProfit = (currentPrice - trade.buyPrice) * trade.remainingQuantity;
  const currentValue = currentPrice * trade.remainingQuantity;
  return {
    returnRate: parseFloat(returnRate),
    unrealizedProfit,
    currentValue,
  };
};

/**
 * GET /api/stocks
 * 전체 보유 종목 목록 조회
 * 각 종목에 연결된 매입 이력과 수익률 요약 포함
 */
exports.getStocks = async (req, res) => {
  try {
    const stocks = await Stock.find({ userId: req.user.id }).sort({ createdAt: -1 });

    // 각 종목마다 매입 이력 요약 데이터 계산
    const stocksWithSummary = await Promise.all(
      stocks.map(async (stock) => {
        const trades = await Trade.find({
          userId: req.user.id,
          stockId: stock._id,
          status: { $ne: 'sold' }, // 전량 매도 완료된 건 제외
        });

        // 총 보유 수량 및 총 투자금 합산
        const totalQuantity = trades.reduce((sum, t) => sum + t.remainingQuantity, 0);
        const totalCost = trades.reduce((sum, t) => sum + t.buyPrice * t.remainingQuantity, 0);
        const currentValue = stock.currentPrice * totalQuantity;
        const totalUnrealizedProfit = currentValue - totalCost;
        const avgReturnRate = totalCost > 0
          ? parseFloat((((currentValue - totalCost) / totalCost) * 100).toFixed(2))
          : 0;

        return {
          ...stock.toObject(),
          summary: {
            totalQuantity,
            totalCost,
            currentValue,
            totalUnrealizedProfit,
            avgReturnRate,
            tradeCount: trades.length,
          },
        };
      })
    );

    res.json({ success: true, data: stocksWithSummary });
  } catch (error) {
    console.error('종목 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: error.message });
  }
};

/**
 * GET /api/stocks/:id
 * 특정 종목 상세 조회
 */
exports.getStockById = async (req, res) => {
  try {
    const stock = await Stock.findOne({ _id: req.params.id, userId: req.user.id });
    if (!stock) {
      return res.status(404).json({ success: false, message: '종목을 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: stock });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: error.message });
  }
};

/**
 * POST /api/stocks
 * 새 종목 등록
 */
exports.createStock = async (req, res) => {
  try {
    const { ticker, name, market, currentPrice, targetReturnRate, memo } = req.body;

    // 사용자별 중복 종목 코드 체크
    const existing = await Stock.findOne({ userId: req.user.id, ticker: ticker.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: `이미 등록된 종목 코드입니다: ${ticker}` });
    }

    const stock = new Stock({
      userId: req.user.id,
      ticker: ticker.trim(),
      name: name.trim(),
      market,
      currentPrice: currentPrice || 0,
      targetReturnRate: targetReturnRate || 10,
      memo,
      priceUpdatedAt: currentPrice ? new Date() : null,
    });

    await stock.save();
    res.status(201).json({ success: true, data: stock, message: '종목이 등록되었습니다.' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: error.message });
  }
};

/**
 * PUT /api/stocks/:id
 * 종목 정보 수정 (현재가 업데이트 포함)
 */
exports.updateStock = async (req, res) => {
  try {
    const { currentPrice, ...otherFields } = req.body;

    const updateData = { ...otherFields };

    // 현재가가 변경되면 업데이트 시각도 기록
    if (currentPrice !== undefined) {
      updateData.currentPrice = currentPrice;
      updateData.priceUpdatedAt = new Date();
    }

    const stock = await Stock.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!stock) {
      return res.status(404).json({ success: false, message: '종목을 찾을 수 없습니다.' });
    }

    res.json({ success: true, data: stock, message: '종목 정보가 수정되었습니다.' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: error.message });
  }
};

/**
 * DELETE /api/stocks/:id
 * 종목 삭제 (연결된 매입 이력도 함께 삭제)
 */
exports.deleteStock = async (req, res) => {
  try {
    const stock = await Stock.findOne({ _id: req.params.id, userId: req.user.id });
    if (!stock) {
      return res.status(404).json({ success: false, message: '종목을 찾을 수 없습니다.' });
    }

    // 연결된 매입 이력도 함께 삭제
    await Trade.deleteMany({ userId: req.user.id, stockId: req.params.id });
    await stock.deleteOne();

    res.json({ success: true, message: '종목과 관련 매입 이력이 삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: error.message });
  }
};

// calcTradeMetrics를 다른 컨트롤러에서도 사용할 수 있도록 내보내기
exports.calcTradeMetrics = calcTradeMetrics;

// 지연 시간 유틸리티 (ms)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * PUT /api/stocks/sync
 * 등록된 모든 보유 종목의 가격을 KIS API의 "전일 종가(어제 종가)" 기준으로 일괄 업데이트
 */
exports.syncPrices = async (req, res) => {
  try {
    const stocks = await Stock.find({ userId: req.user.id });
    if (!stocks || stocks.length === 0) {
      return res.json({ success: true, message: '등록된 종목이 없습니다.' });
    }

    const user = await require('../models/User').findById(req.user.id).select('+kisAppSecret');
    const credentials = {
      appKey: user.kisAppKey,
      appSecret: user.kisAppSecret,
    };

    let updatedCount = 0;
    for (const stock of stocks) {
      try {
        // KIS API 속도 제한(TPS)을 안전하게 피하기 위해 1초 간격으로 호출
        await sleep(1000); 

        const priceData = await kisApi.getStockPrice(stock.ticker, credentials);
        // yesterdayClosePrice 필드가 있다면 이를 이용 (없으면 currentPrice fallback)
        const targetPrice = priceData.yesterdayClosePrice || priceData.currentPrice;

        stock.currentPrice = targetPrice;
        stock.priceUpdatedAt = new Date();
        await stock.save();
        updatedCount++;
      } catch (err) {
        console.error(`[종목 업데이트 실패] ${stock.name}(${stock.ticker}):`, err.message);
      }
    }

    res.json({ success: true, message: `총 ${updatedCount}개 종목의 가격을 어제 종가 기준으로 업데이트 완료했습니다.` });
  } catch (error) {
    console.error('종목 가격 일괄 업데이트 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: error.message });
  }
};
