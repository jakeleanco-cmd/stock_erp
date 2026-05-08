const axios = require('axios');
const kisTokenManager = require('./kisTokenManager');

class KisApi {
  constructor() {
    this.domain = process.env.KIS_DOMAIN || 'https://openapi.koreainvestment.com:9443';
    this.appKey = process.env.KIS_APP_KEY;
    this.appSecret = process.env.KIS_APP_SECRET;
  }

  /**
   * 한국투자증권 주식현재가 시세 API (FHKST01010100) 호출
   * @param {string} ticker 6자리 종목코드 (예: '005930')
   * @returns {Object} 종목 정보 및 현재가 데이터
   */
  async getStockPrice(ticker) {
    if (!this.appKey || !this.appSecret) {
      throw new Error('KIS API 환경변수가 설정되지 않았습니다.');
    }

    try {
      const token = await kisTokenManager.getToken();
      
      const response = await axios.get(`${this.domain}/uapi/domestic-stock/v1/quotations/inquire-price`, {
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`,
          'appkey': this.appKey,
          'appsecret': this.appSecret,
          'tr_id': 'FHKST01010100' // 주식현재가 시세 TR ID
        },
        params: {
          fid_cond_mrkt_div_code: 'J', // 시장 분류 (J: 주식/ETF/ETN)
          fid_input_iscd: ticker       // 종목코드 (6자리)
        }
      });

      if (response.data.rt_cd !== '0') {
        throw new Error(response.data.msg1);
      }

      const output = response.data.output;
      return {
        ticker: ticker,
        currentPrice: parseInt(output.stck_prpr, 10), // 주식 현재가
        yesterdayClosePrice: parseInt(output.stck_prdy_clpr, 10), // 전일 종가
        market: output.bstp_kor_isnm,                 // 업종/시장명 (대략적인 파악용)
        yesterdayPrice: parseInt(output.prdy_vrss, 10), // 전일 대비
        volume: parseInt(output.acml_vol, 10)         // 누적 거래량
      };

    } catch (error) {
      console.error(`❌ 종목코드 ${ticker} KIS API 조회 실패:`, error.response ? error.response.data : error.message);
      throw error;
    }
  }

  /**
   * 국내주식 매도 주문 (TTTC0801U)
   * @param {string} ticker - 종목코드 6자리
   * @param {number} quantity - 주문 수량
   * @param {number} price - 주문 단가 (시장가일 경우 0)
   * @param {string} orderType - '00': 지정가, '01': 시장가
   * @returns {Object} 주문 결과
   */
  async sellOrder(ticker, quantity, price = 0, orderType = '01') {
    return this._placeOrder('TTTC0801U', ticker, quantity, price, orderType);
  }

  /**
   * 국내주식 매수 주문 (TTTC0802U)
   * @param {string} ticker - 종목코드 6자리
   * @param {number} quantity - 주문 수량
   * @param {number} price - 주문 단가 (시장가일 경우 0)
   * @param {string} orderType - '00': 지정가, '01': 시장가
   * @returns {Object} 주문 결과
   */
  async buyOrder(ticker, quantity, price = 0, orderType = '01') {
    return this._placeOrder('TTTC0802U', ticker, quantity, price, orderType);
  }

  /**
   * 주문 공통 로직
   * 왜 분리했는가: 매수/매도는 tr_id만 다르고 나머지 로직은 동일
   */
  async _placeOrder(trId, ticker, quantity, price, orderType) {
    if (!this.appKey || !this.appSecret) {
      throw new Error('KIS API 환경변수가 설정되지 않았습니다.');
    }

    const accountNo = process.env.KIS_ACCOUNT_NO;
    const accountProduct = process.env.KIS_ACCOUNT_PRODUCT || '01';

    if (!accountNo) {
      throw new Error('KIS_ACCOUNT_NO 환경변수가 설정되지 않았습니다.');
    }

    try {
      const token = await kisTokenManager.getToken();

      const response = await axios.post(
        `${this.domain}/uapi/domestic-stock/v1/trading/order-cash`,
        {
          CANO: accountNo,                    // 종합계좌번호 (8자리)
          ACNT_PRDT_CD: accountProduct,       // 계좌상품코드 (2자리)
          PDNO: ticker,                       // 종목코드 (6자리)
          ORD_DVSN: orderType,                // 주문구분 (00:지정가, 01:시장가)
          ORD_QTY: String(quantity),           // 주문수량
          ORD_UNPR: String(price),            // 주문단가 (시장가면 0)
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${token}`,
            'appkey': this.appKey,
            'appsecret': this.appSecret,
            'tr_id': trId,
            'custtype': 'P',                  // 개인
          },
        }
      );

      if (response.data.rt_cd !== '0') {
        throw new Error(response.data.msg1);
      }

      const orderLabel = trId === 'TTTC0801U' ? '매도' : '매수';
      console.log(`✅ ${orderLabel} 주문 성공: ${ticker} ${quantity}주`);

      return {
        success: true,
        orderNo: response.data.output?.ODNO,         // 주문번호
        orderTime: response.data.output?.ORD_TMD,     // 주문시각
        message: response.data.msg1,
      };
    } catch (error) {
      const orderLabel = trId === 'TTTC0801U' ? '매도' : '매수';
      console.error(`❌ ${orderLabel} 주문 실패 (${ticker}):`, error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new KisApi();
