const express = require('express');
const router = express.Router();
const {
  getSellRecords,
  createSellRecord,
  deleteSellRecord,
  getSellSummary,
  getStrategyByStock,
} = require('../controllers/sellController');

// 매도 기록 조회 / 매도 실행
router.route('/').get(getSellRecords).post(createSellRecord);

// 월별 수익 통계
router.get('/summary', getSellSummary);

// 매도 전략 계산기 (종목별)
router.get('/strategy/:stockId', getStrategyByStock);

// 매도 기록 삭제 (취소)
router.delete('/:id', deleteSellRecord);

module.exports = router;
