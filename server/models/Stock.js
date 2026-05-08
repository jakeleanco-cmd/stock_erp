const mongoose = require('mongoose');

/**
 * Stock 모델 - 보유 종목 기본 정보
 * 종목 코드를 기준으로 현재가, 목표 수익률 등을 관리
 */
const stockSchema = new mongoose.Schema(
  {
    // 종목 코드 (예: 005930 = 삼성전자)
    ticker: {
      type: String,
      required: [true, '종목 코드는 필수입니다.'],
      unique: true,
      trim: true,
    },
    // 종목명
    name: {
      type: String,
      required: [true, '종목명은 필수입니다.'],
      trim: true,
    },
    // 시장 구분
    market: {
      type: String,
      enum: ['KOSPI', 'KOSDAQ', 'KONEX', '기타'],
      default: 'KOSPI',
    },
    // 현재가 (수동 업데이트)
    currentPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    // 목표 수익률 (%) - 이 비율 달성 시 매도 신호
    targetReturnRate: {
      type: Number,
      default: 10,
      min: 0,
    },
    // 메모
    memo: {
      type: String,
      default: '',
    },
    // 현재가 마지막 업데이트 시각
    priceUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt 자동 생성
  }
);

module.exports = mongoose.model('Stock', stockSchema);
