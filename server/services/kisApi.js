const axios = require('axios');
const kisTokenManager = require('./kisTokenManager');

/**
 * KisApi - 한국투자증권 Open API 통신 모듈
 * 
 * 이제 각 메서드는 사용자별 인증 정보를 인자로 받을 수 있습니다.
 */
class KisApi {
  constructor() {
    this.domain = process.env.KIS_DOMAIN || 'https://openapi.koreainvestment.com:9443';
  }

  /**
   * 공통 헤더 생성 유틸리티
   */
  async _getHeaders(credentials, trId) {
    const appKey = credentials?.appKey || process.env.KIS_APP_KEY;
    const appSecret = credentials?.appSecret || process.env.KIS_APP_SECRET;

    if (!appKey || !appSecret) {
      throw new Error('KIS API 인증 정보(AppKey, AppSecret)가 없습니다.');
    }

    const token = await kisTokenManager.getToken(appKey, appSecret);

    return {
      'Content-Type': 'application/json',
      'authorization': `Bearer ${token}`,
      'appkey': appKey,
      'appsecret': appSecret,
      'tr_id': trId,
      'custtype': 'P',
    };
  }

  /**
   * 한국투자증권 주식현재가 시세 API (FHKST01010100) 호출
   * @param {string} ticker 6자리 종목코드 (예: '005930')
   * @param {Object} credentials - { appKey, appSecret } (옵션)
   * @returns {Object} 종목 정보 및 현재가 데이터
   */
  async getStockPrice(ticker, credentials = null) {
    try {
      const headers = await this._getHeaders(credentials, 'FHKST01010100');
      
      const response = await axios.get(`${this.domain}/uapi/domestic-stock/v1/quotations/inquire-price`, {
        headers,
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
        market: output.bstp_kor_isnm,                 // 업종/시장명
        yesterdayPrice: parseInt(output.prdy_vrss, 10),
        volume: parseInt(output.acml_vol, 10)
      };

    } catch (error) {
      console.error(`❌ 종목코드 ${ticker} KIS API 조회 실패:`, error.response ? error.response.data : error.message);
      throw error;
    }
  }

  /**
   * 국내주식 매도 주문 (TTTC0801U)
   */
  async sellOrder(ticker, quantity, price = 0, orderType = '01', credentials = null) {
    return this._placeOrder('TTTC0801U', ticker, quantity, price, orderType, credentials);
  }

  /**
   * 국내주식 매수 주문 (TTTC0802U)
   */
  async buyOrder(ticker, quantity, price = 0, orderType = '01', credentials = null) {
    return this._placeOrder('TTTC0802U', ticker, quantity, price, orderType, credentials);
  }

  /**
   * 주문 공통 로직
   */
  async _placeOrder(trId, ticker, quantity, price, orderType, credentials) {
    const accountNo = credentials?.accountNo || process.env.KIS_ACCOUNT_NO;
    const accountProduct = credentials?.accountProduct || process.env.KIS_ACCOUNT_PRODUCT || '01';

    if (!accountNo) {
      throw new Error('KIS 계좌번호가 설정되지 않았습니다.');
    }

    try {
      const headers = await this._getHeaders(credentials, trId);

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
        { headers }
      );

      if (response.data.rt_cd !== '0') {
        throw new Error(response.data.msg1);
      }

      const orderLabel = trId === 'TTTC0801U' ? '매도' : '매수';
      console.log(`✅ ${orderLabel} 주문 성공: ${ticker} ${quantity}주`);

      return {
        success: true,
        orderNo: response.data.output?.ODNO,
        orderTime: response.data.output?.ORD_TMD,
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
