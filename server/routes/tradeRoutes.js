const express = require('express');
const router = express.Router();
const {
  getTradesByStock,
  getTradeById,
  createTrade,
  updateTrade,
  deleteTrade,
} = require('../controllers/tradeController');

// 매입 이력 목록 조회 (쿼리: ?stockId=xxx) / 새 매입 등록
router.route('/').get(getTradesByStock).post(createTrade);

// 특정 매입 건 조회 / 수정 / 삭제
router.route('/:id').get(getTradeById).put(updateTrade).delete(deleteTrade);

module.exports = router;
