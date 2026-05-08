const mongoose = require('mongoose');

/**
 * AutoTradeRule 모델 - 자동매매 규칙
 * 
 * 종목별로 매매 조건을 설정하고, 조건 충족 시 알림 또는 자동 주문 실행
 * 
 * 규칙 유형:
 * - target_sell: 목표 수익률 달성 시 매도
 * - stop_loss: 손절 라인 도달 시 매도
 */
const autoTradeRuleSchema = new mongoose.Schema(
  {
    // 소유 사용자
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // 대상 종목
    stockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stock',
      required: [true, '대상 종목은 필수입니다.'],
    },
    // 규칙 유형
    ruleType: {
      type: String,
      enum: ['target_sell', 'stop_loss'],
      required: [true, '규칙 유형은 필수입니다.'],
    },
    // 목표 수익률(%) 또는 손절률(%)
    // target_sell: 양수 (예: 10 → 10% 수익 시 매도)
    // stop_loss: 음수 (예: -5 → 5% 손실 시 매도)
    targetRate: {
      type: Number,
      required: [true, '목표 비율은 필수입니다.'],
    },
    // 활성화 여부 (false면 감시 중단)
    isActive: {
      type: Boolean,
      default: true,
    },
    // 실행 방식
    // manual: 조건 충족 시 알림만 (사용자가 수동 매도)
    // auto: 조건 충족 시 자동으로 KIS API 매도 주문
    executionMode: {
      type: String,
      enum: ['manual', 'auto'],
      default: 'manual',
    },
    // 조건 충족 시각 (가장 최근)
    triggeredAt: {
      type: Date,
      default: null,
    },
    // 실제 주문 실행 시각
    executedAt: {
      type: Date,
      default: null,
    },
    // 규칙 상태
    status: {
      type: String,
      enum: ['watching', 'triggered', 'executed', 'cancelled'],
      default: 'watching',
    },
    // 메모
    memo: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AutoTradeRule', autoTradeRuleSchema);
