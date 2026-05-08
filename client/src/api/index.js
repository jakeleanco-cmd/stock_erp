import axios from 'axios';

/**
 * axios 기본 설정
 * - baseURL: Vite 프록시 설정으로 /api → http://localhost:5001/api로 자동 연결
 * - 에러 발생 시 콘솔에 상세 로그 출력
 */
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// 응답 인터셉터: 에러 발생 시 서버 메시지 추출
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || '서버와의 통신에 실패했습니다.';
    console.error('[API 오류]', message);
    return Promise.reject(new Error(message));
  }
);

// ─── 종목 관련 API ────────────────────────────────────────────
export const stockApi = {
  /** 전체 종목 목록 조회 (수익률 요약 포함) */
  getAll: () => api.get('/stocks'),
  /** 종목 검색 (네이버 API 프록시) */
  search: (q) => api.get('/stocks/search', { params: { q } }),
  /** 특정 종목 상세 조회 */
  getById: (id) => api.get(`/stocks/${id}`),
  /** 새 종목 등록 */
  create: (data) => api.post('/stocks', data),
  /** 종목 정보 수정 (현재가 업데이트 포함) */
  update: (id, data) => api.put(`/stocks/${id}`, data),
  /** 종목 삭제 (관련 매입 이력 함께 삭제) */
  delete: (id) => api.delete(`/stocks/${id}`),
  /** 전체 종목 가격 일괄 업데이트 (어제 종가 기준) */
  sync: () => api.put('/stocks/sync'),
};

// ─── 매입 이력 관련 API ───────────────────────────────────────
export const tradeApi = {
  /** 매입 이력 목록 조회 (종목 필터 가능) */
  getAll: (stockId) =>
    api.get('/trades', { params: stockId ? { stockId } : {} }),
  /** 특정 매입 건 조회 */
  getById: (id) => api.get(`/trades/${id}`),
  /** 새 매입 이력 등록 */
  create: (data) => api.post('/trades', data),
  /** 매입 이력 수정 */
  update: (id, data) => api.put(`/trades/${id}`, data),
  /** 매입 이력 삭제 */
  delete: (id) => api.delete(`/trades/${id}`),
};

// ─── 매도 기록 및 전략 관련 API ───────────────────────────────
export const sellApi = {
  /** 매도 기록 조회 (종목 필터 가능) */
  getAll: (stockId) =>
    api.get('/sells', { params: stockId ? { stockId } : {} }),
  /** 매도 실행 */
  create: (data) => api.post('/sells', data),
  /** 매도 기록 삭제(취소) */
  delete: (id) => api.delete(`/sells/${id}`),
  /** 월별 수익 통계 */
  getSummary: () => api.get('/sells/summary'),
  /** 매도 전략 계산기 */
  getStrategy: (stockId, targetRate) =>
    api.get(`/sells/strategy/${stockId}`, { params: { targetRate } }),
};

// ─── 실시간 시세 관련 API ─────────────────────────────────────
export const realtimeApi = {
  /** WebSocket 연결 상태 및 구독 정보 조회 */
  getStatus: () => api.get('/realtime/status'),
  /** 특정 종목 실시간 구독 추가 */
  subscribe: (ticker) => api.post('/realtime/subscribe', { ticker }),
  /** 특정 종목 실시간 구독 해제 */
  unsubscribe: (ticker) => api.delete(`/realtime/subscribe/${ticker}`),
  /** 보유 종목 일괄 구독 */
  subscribeAll: () => api.post('/realtime/subscribe-all'),
};

// ─── 자동매매 규칙 관련 API ───────────────────────────────────
export const autoTradeApi = {
  /** 자동매매 규칙 목록 조회 */
  getRules: (stockId) =>
    api.get('/auto-trade/rules', { params: stockId ? { stockId } : {} }),
  /** 새 규칙 생성 */
  createRule: (data) => api.post('/auto-trade/rules', data),
  /** 규칙 수정 */
  updateRule: (id, data) => api.put(`/auto-trade/rules/${id}`, data),
  /** 규칙 삭제 */
  deleteRule: (id) => api.delete(`/auto-trade/rules/${id}`),
  /** 수동 매매 실행 (반자동 모드) */
  executeRule: (id) => api.post(`/auto-trade/execute/${id}`),
  /** 알림 히스토리 조회 */
  getAlerts: () => api.get('/auto-trade/alerts'),
  /** 자동매매 엔진 상태 */
  getEngineStatus: () => api.get('/auto-trade/status'),
};

export default api;
