import { create } from 'zustand';
import { stockApi, tradeApi, sellApi, autoTradeApi } from '../api';
import { message } from 'antd';

/**
 * 전역 상태 관리 (Zustand)
 * 종목, 매입 이력, 매도 기록, 실시간 시세, 자동매매 데이터와
 * 각각의 로딩/에러 상태를 통합 관리
 */
const useStockStore = create((set, get) => ({
  // ─── 종목 상태 ───────────────────────────────────────────────
  stocks: [],
  stocksLoading: false,
  selectedStockId: null, // 현재 선택된 종목 ID

  // ─── 매입 이력 상태 ──────────────────────────────────────────
  trades: [],
  tradesLoading: false,

  // ─── 매도 기록 상태 ──────────────────────────────────────────
  sellRecords: [],
  sellsLoading: false,

  // ─── 전략 계산 결과 ──────────────────────────────────────────
  strategyResult: null,
  strategyLoading: false,

  // ─── 실시간 시세 상태 ────────────────────────────────────────
  realtimePrices: {},         // { ticker: { currentPrice, change, changeRate, volume, time } }
  wsConnected: false,         // KIS WebSocket 연결 상태
  sseSource: null,            // EventSource 인스턴스 참조 (정리용)
  alertSseSource: null,       // 알림 SSE 인스턴스 참조

  // ─── 알림 상태 ──────────────────────────────────────────────
  alerts: [],                 // 매매 신호 알림 목록
  unreadAlertCount: 0,        // 미확인 알림 수

  // ─── 자동매매 규칙 상태 ─────────────────────────────────────
  autoTradeRules: [],
  rulesLoading: false,

  // ════════════════════════════════════════════════════════════
  // 종목 액션
  // ════════════════════════════════════════════════════════════

  /** 전체 종목 목록 불러오기 */
  fetchStocks: async () => {
    set({ stocksLoading: true });
    try {
      const res = await stockApi.getAll();
      set({ stocks: res.data, stocksLoading: false });
    } catch (err) {
      message.error(err.message);
      set({ stocksLoading: false });
    }
  },

  /** 종목 선택 (매입 이력 화면 이동 시 사용) */
  setSelectedStockId: (id) => set({ selectedStockId: id }),

  /** 새 종목 등록 */
  createStock: async (data) => {
    try {
      const res = await stockApi.create(data);
      message.success(res.message);
      await get().fetchStocks();
      return true;
    } catch (err) {
      message.error(err.message);
      return false;
    }
  },

  /** 종목 정보 수정 (현재가 업데이트 포함) */
  updateStock: async (id, data) => {
    try {
      const res = await stockApi.update(id, data);
      message.success(res.message);
      await get().fetchStocks();
      return true;
    } catch (err) {
      message.error(err.message);
      return false;
    }
  },

  /** 종목 삭제 */
  deleteStock: async (id) => {
    try {
      const res = await stockApi.delete(id);
      message.success(res.message);
      await get().fetchStocks();
    } catch (err) {
      message.error(err.message);
    }
  },

  /** 어제 종가 기준으로 모든 종목 일괄 업데이트 */
  syncPrices: async () => {
    set({ stocksLoading: true });
    try {
      const res = await stockApi.sync();
      message.success(res.message);
      await get().fetchStocks();
    } catch (err) {
      message.error(err.message);
      set({ stocksLoading: false });
    }
  },

  // ════════════════════════════════════════════════════════════
  // 매입 이력 액션
  // ════════════════════════════════════════════════════════════

  /** 매입 이력 불러오기 (종목 필터 가능) */
  fetchTrades: async (stockId) => {
    set({ tradesLoading: true });
    try {
      const res = await tradeApi.getAll(stockId);
      set({ trades: res.data, tradesLoading: false });
    } catch (err) {
      message.error(err.message);
      set({ tradesLoading: false });
    }
  },

  /** 새 매입 이력 등록 */
  createTrade: async (data) => {
    try {
      const res = await tradeApi.create(data);
      message.success(res.message);
      await get().fetchTrades(data.stockId);
      await get().fetchStocks(); // 종목 요약 갱신
      return true;
    } catch (err) {
      message.error(err.message);
      return false;
    }
  },

  /** 매입 이력 삭제 */
  deleteTrade: async (id, stockId) => {
    try {
      const res = await tradeApi.delete(id);
      message.success(res.message);
      await get().fetchTrades(stockId);
      await get().fetchStocks();
    } catch (err) {
      message.error(err.message);
    }
  },

  /** 매입 이력 수정 */
  updateTrade: async (id, data) => {
    try {
      const res = await tradeApi.update(id, data);
      message.success(res.message);
      await get().fetchTrades(data.stockId);
      await get().fetchStocks();
      return true;
    } catch (err) {
      message.error(err.message);
      return false;
    }
  },

  // ════════════════════════════════════════════════════════════
  // 매도 기록 액션
  // ════════════════════════════════════════════════════════════

  /** 매도 기록 불러오기 */
  fetchSellRecords: async (stockId) => {
    set({ sellsLoading: true });
    try {
      const res = await sellApi.getAll(stockId);
      set({ sellRecords: res.data, sellsLoading: false });
    } catch (err) {
      message.error(err.message);
      set({ sellsLoading: false });
    }
  },

  /** 매도 실행 */
  createSellRecord: async (data) => {
    try {
      const res = await sellApi.create(data);
      message.success(res.message);
      // 매도 후 연관 데이터 모두 갱신
      await get().fetchTrades(data.stockId);
      await get().fetchSellRecords(data.stockId);
      await get().fetchStocks();
      return true;
    } catch (err) {
      message.error(err.message);
      return false;
    }
  },

  /** 매도 기록 삭제(취소) */
  deleteSellRecord: async (id, stockId) => {
    try {
      const res = await sellApi.delete(id);
      message.success(res.message);
      await get().fetchSellRecords(stockId);
      await get().fetchTrades(stockId);
      await get().fetchStocks();
    } catch (err) {
      message.error(err.message);
    }
  },

  // ════════════════════════════════════════════════════════════
  // 전략 계산기 액션
  // ════════════════════════════════════════════════════════════

  /** 매도 전략 계산 */
  calcStrategy: async (stockId, targetRate) => {
    set({ strategyLoading: true });
    try {
      const res = await sellApi.getStrategy(stockId, targetRate);
      set({ strategyResult: res.data, strategyLoading: false });
    } catch (err) {
      message.error(err.message);
      set({ strategyLoading: false });
    }
  },

  /** 전략 결과 초기화 */
  clearStrategy: () => set({ strategyResult: null }),

  // ════════════════════════════════════════════════════════════
  // 실시간 시세 액션 (SSE)
  // ════════════════════════════════════════════════════════════

  /**
   * SSE 실시간 가격 스트림 연결
   * 왜 SSE인가: 가격은 서버→클라이언트 단방향 Push만 필요.
   * EventSource는 자동 재연결 기능이 내장되어 있어 안정적.
   */
  startRealtimeStream: () => {
    // 이미 연결 중이면 무시
    if (get().sseSource) return;

    const priceSource = new EventSource('/api/realtime/prices');

    // 초기 연결 시 캐시된 전체 가격 수신
    priceSource.addEventListener('init', (e) => {
      try {
        const prices = JSON.parse(e.data);
        set({ realtimePrices: prices });
      } catch (err) {
        console.error('SSE init 파싱 오류:', err);
      }
    });

    // 개별 종목 실시간 가격 업데이트
    priceSource.addEventListener('price', (e) => {
      try {
        const priceData = JSON.parse(e.data);
        set((state) => ({
          realtimePrices: {
            ...state.realtimePrices,
            [priceData.ticker]: priceData,
          },
        }));
      } catch (err) {
        console.error('SSE price 파싱 오류:', err);
      }
    });

    // WebSocket 연결 상태 변경
    priceSource.addEventListener('status', (e) => {
      try {
        const { connected } = JSON.parse(e.data);
        set({ wsConnected: connected });
      } catch (err) {
        console.error('SSE status 파싱 오류:', err);
      }
    });

    priceSource.onerror = () => {
      console.warn('⚠️ SSE 가격 스트림 연결 끊김, 자동 재연결 시도...');
    };

    // ─── 알림 SSE 스트림 ──────────────────────────────────────
    const alertSource = new EventSource('/api/realtime/alerts');

    alertSource.addEventListener('alert', (e) => {
      try {
        const alertData = JSON.parse(e.data);
        set((state) => ({
          alerts: [alertData, ...state.alerts].slice(0, 50),
          unreadAlertCount: state.unreadAlertCount + 1,
        }));

        // 토스트 알림 표시
        const typeLabel = alertData.type === 'target_sell' ? '🎯 목표 달성' : '🛑 손절 경고';
        message.warning({
          content: `${typeLabel}: ${alertData.stockName} (${alertData.returnRate}%)`,
          duration: 5,
        });
      } catch (err) {
        console.error('SSE alert 파싱 오류:', err);
      }
    });

    set({ sseSource: priceSource, alertSseSource: alertSource });
  },

  /** SSE 스트림 해제 */
  stopRealtimeStream: () => {
    const { sseSource, alertSseSource } = get();
    if (sseSource) {
      sseSource.close();
    }
    if (alertSseSource) {
      alertSseSource.close();
    }
    set({ sseSource: null, alertSseSource: null });
  },

  /** 알림 읽음 처리 (배지 카운트 초기화) */
  markAlertsRead: () => set({ unreadAlertCount: 0 }),

  // ════════════════════════════════════════════════════════════
  // 자동매매 규칙 액션
  // ════════════════════════════════════════════════════════════

  /** 자동매매 규칙 목록 불러오기 */
  fetchAutoTradeRules: async (stockId) => {
    set({ rulesLoading: true });
    try {
      const res = await autoTradeApi.getRules(stockId);
      set({ autoTradeRules: res.data, rulesLoading: false });
    } catch (err) {
      message.error(err.message);
      set({ rulesLoading: false });
    }
  },

  /** 새 자동매매 규칙 생성 */
  createAutoTradeRule: async (data) => {
    try {
      const res = await autoTradeApi.createRule(data);
      message.success(res.message);
      await get().fetchAutoTradeRules();
      return true;
    } catch (err) {
      message.error(err.message);
      return false;
    }
  },

  /** 자동매매 규칙 수정 */
  updateAutoTradeRule: async (id, data) => {
    try {
      const res = await autoTradeApi.updateRule(id, data);
      message.success(res.message);
      await get().fetchAutoTradeRules();
      return true;
    } catch (err) {
      message.error(err.message);
      return false;
    }
  },

  /** 자동매매 규칙 삭제 */
  deleteAutoTradeRule: async (id) => {
    try {
      const res = await autoTradeApi.deleteRule(id);
      message.success(res.message);
      await get().fetchAutoTradeRules();
    } catch (err) {
      message.error(err.message);
    }
  },

  /** 수동 매매 실행 (반자동 모드) */
  executeAutoTrade: async (ruleId) => {
    try {
      const res = await autoTradeApi.executeRule(ruleId);
      message.success(res.message);
      await get().fetchAutoTradeRules();
      await get().fetchStocks();
      return true;
    } catch (err) {
      message.error(err.message);
      return false;
    }
  },
}));

export default useStockStore;
