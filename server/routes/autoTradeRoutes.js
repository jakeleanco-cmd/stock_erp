const express = require('express');
const router = express.Router();
const {
  getRules,
  createRule,
  updateRule,
  deleteRule,
  executeRule,
  getAlerts,
  getEngineStatus,
} = require('../controllers/autoTradeController');

// 자동매매 엔진 상태 조회
router.get('/status', getEngineStatus);

// 알림 히스토리 조회
router.get('/alerts', getAlerts);

// 자동매매 규칙 CRUD
router.route('/rules').get(getRules).post(createRule);
router.route('/rules/:id').put(updateRule).delete(deleteRule);

// 수동 매매 실행 (반자동 모드)
router.post('/execute/:id', executeRule);

module.exports = router;
