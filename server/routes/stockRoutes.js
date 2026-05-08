const express = require('express');
const router = express.Router();
const {
  getStocks,
  getStockById,
  createStock,
  updateStock,
  deleteStock,
  searchStocks,
  syncPrices,
} = require('../controllers/stockController');

// 종목 검색 (네이버 API 연동 -> 마스터파일로 변경됨)
router.get('/search', searchStocks);

// 어제 종가 기준으로 일괄 가격 업데이트
router.put('/sync', syncPrices);

// 전체 종목 조회 / 새 종목 등록
router.route('/').get(getStocks).post(createStock);

// 특정 종목 조회 / 수정 / 삭제
router.route('/:id').get(getStockById).put(updateStock).delete(deleteStock);

module.exports = router;
