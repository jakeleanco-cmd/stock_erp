const mongoose = require('mongoose');

/**
 * SellRecord 모델 - 실현 매도 기록
 * 어떤 매입 건에서 몇 주를 팔았는지, 실현 수익은 얼마인지 기록
 */
const sellRecordSchema = new mongoose.Schema(
  {
    // 어떤 매입 건에서 판 것인지 (Trade 참조)
    tradeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trade',
      required: [true, '매입 이력 정보는 필수입니다.'],
    },
    // 종목 (조회 편의를 위해 중복 저장)
    stockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stock',
      required: true,
    },
    // 매도 날짜
    sellDate: {
      type: Date,
      required: [true, '매도 날짜는 필수입니다.'],
    },
    // 매도 수량
    quantity: {
      type: Number,
      required: [true, '매도 수량은 필수입니다.'],
      min: [1, '매도 수량은 1주 이상이어야 합니다.'],
    },
    // 매도 단가
    sellPrice: {
      type: Number,
      required: [true, '매도 단가는 필수입니다.'],
    },
    // 매입 단가 (기록 보존용 - Trade 삭제 시에도 내역 유지)
    buyPrice: {
      type: Number,
      required: true,
    },
    // 총 매도 금액
    totalRevenue: {
      type: Number,
    },
    // 세전 수익 (매도금 - 매입금)
    grossProfit: {
      type: Number,
    },
    // 거래세 (0.2%)
    transactionTax: {
      type: Number,
    },
    // 증권사 수수료 (매입 + 매도 합산, 0.015% * 2 = 0.03%)
    commission: {
      type: Number,
    },
    // 실현 순수익 (세후)
    netProfit: {
      type: Number,
    },
    // 해당 건 수익률 (%)
    returnRate: {
      type: Number,
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

/**
 * 저장 전 훅: 수익/세금/수수료 자동 계산
 * - 거래세: 매도 금액의 0.2%
 * - 수수료: 매입금 0.015% + 매도금 0.015%
 */
sellRecordSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('quantity') || this.isModified('sellPrice')) {
    this.totalRevenue = this.quantity * this.sellPrice;
    this.grossProfit = (this.sellPrice - this.buyPrice) * this.quantity;

    // 거래세: 매도 금액의 0.2%
    this.transactionTax = Math.round(this.totalRevenue * 0.002);

    // 수수료: 매입 + 매도 각 0.015%
    const buyCommission = Math.round(this.quantity * this.buyPrice * 0.00015);
    const sellCommission = Math.round(this.totalRevenue * 0.00015);
    this.commission = buyCommission + sellCommission;

    // 순수익 = 세전수익 - 거래세 - 수수료
    this.netProfit = this.grossProfit - this.transactionTax - this.commission;

    // 수익률 = 순수익 / 매입금 * 100
    const totalCost = this.quantity * this.buyPrice;
    this.returnRate = parseFloat(((this.netProfit / totalCost) * 100).toFixed(2));
  }
  next();
});

module.exports = mongoose.model('SellRecord', sellRecordSchema);
