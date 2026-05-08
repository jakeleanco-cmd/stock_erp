const mongoose = require('mongoose');

/**
 * Trade 모델 - 매입 이력 (핵심 모델)
 * 같은 종목이라도 매입 시점마다 별도 건으로 관리
 * → 각 건별로 독립적인 수익률 계산 가능
 */
const tradeSchema = new mongoose.Schema(
  {
    // 연결된 종목
    stockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stock',
      required: [true, '종목 정보는 필수입니다.'],
    },
    // 매입 날짜
    tradeDate: {
      type: Date,
      required: [true, '매입 날짜는 필수입니다.'],
    },
    // 매입 수량
    quantity: {
      type: Number,
      required: [true, '매입 수량은 필수입니다.'],
      min: [1, '수량은 1주 이상이어야 합니다.'],
    },
    // 현재 보유 수량 (매도 후 잔여 수량)
    remainingQuantity: {
      type: Number,
      min: 0,
    },
    // 매입 단가 (1주당 가격)
    buyPrice: {
      type: Number,
      required: [true, '매입 단가는 필수입니다.'],
      min: [1, '매입 단가는 1원 이상이어야 합니다.'],
    },
    // 총 매입 금액 (quantity * buyPrice) - 저장 시 자동 계산
    totalCost: {
      type: Number,
    },
    // 메모 (예: "1차 매입", "급락 시 추가 매입")
    memo: {
      type: String,
      default: '',
    },
    // 거래 상태
    status: {
      type: String,
      enum: ['holding', 'partial_sold', 'sold'],
      // holding: 전량 보유 중
      // partial_sold: 일부 매도
      // sold: 전량 매도 완료
      default: 'holding',
    },
  },
  {
    timestamps: true,
  }
);

/**
 * 저장 전 훅: totalCost와 remainingQuantity 자동 계산
 * - totalCost: 최초 등록 시 quantity * buyPrice
 * - remainingQuantity: 최초 등록 시 quantity와 동일
 */
tradeSchema.pre('save', function (next) {
  if (this.isNew) {
    this.totalCost = this.quantity * this.buyPrice;
    this.remainingQuantity = this.quantity;
  }
  next();
});

/**
 * 가상 필드: 현재가 기준 수익률 계산
 * populate 후 stock.currentPrice 사용
 */
tradeSchema.virtual('returnRate').get(function () {
  if (!this._currentPrice || !this.buyPrice) return null;
  return (((this._currentPrice - this.buyPrice) / this.buyPrice) * 100).toFixed(2);
});

module.exports = mongoose.model('Trade', tradeSchema);
