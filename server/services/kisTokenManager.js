const axios = require('axios');

class KISTokenManager {
  constructor() {
    this.accessToken = null;
    this.tokenExpiredAt = null;
  }

  async getToken() {
    // 이미 유효한 토큰이 있으면 그대로 반환
    if (this.accessToken && this.tokenExpiredAt && new Date() < this.tokenExpiredAt) {
      return this.accessToken;
    }

    // 환경변수 확인
    const appKey = process.env.KIS_APP_KEY;
    const appSecret = process.env.KIS_APP_SECRET;
    const domain = process.env.KIS_DOMAIN || 'https://openapi.koreainvestment.com:9443';

    if (!appKey || !appSecret) {
      throw new Error('KIS_APP_KEY 또는 KIS_APP_SECRET 환경변수가 누락되었습니다.');
    }

    try {
      const response = await axios.post(`${domain}/oauth2/tokenP`, {
        grant_type: 'client_credentials',
        appkey: appKey,
        appsecret: appSecret
      });

      this.accessToken = response.data.access_token;
      const expiresIn = response.data.expires_in; // 보통 86400 (24시간)

      // 여유 시간(1시간)을 두고 만료 시간 설정
      const expiredDate = new Date();
      expiredDate.setSeconds(expiredDate.getSeconds() + expiresIn - 3600);
      this.tokenExpiredAt = expiredDate;

      console.log('✅ 한국투자증권(KIS) 접근 토큰 발급 성공');
      return this.accessToken;

    } catch (error) {
      console.error('❌ 한국투자증권(KIS) 토큰 발급 실패:', error.response ? error.response.data : error.message);
      throw new Error('한국투자증권 API 인증에 실패했습니다.');
    }
  }
}

// 싱글톤으로 내보내기
module.exports = new KISTokenManager();
