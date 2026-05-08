const axios = require('axios');

/**
 * KISTokenManager - 여러 사용자의 KIS API 토큰을 관리
 * 
 * AppKey와 AppSecret 쌍을 키로 하여 토큰을 캐싱
 */
class KISTokenManager {
  constructor() {
    // 토큰 저장소: { "appKey_appSecret": { token, expiredAt } }
    this.tokenCache = new Map();
  }

  /**
   * 토큰 가져오기
   * @param {string} appKey 
   * @param {string} appSecret 
   */
  async getToken(appKey, appSecret) {
    const key = appKey || process.env.KIS_APP_KEY;
    const secret = appSecret || process.env.KIS_APP_SECRET;
    const domain = process.env.KIS_DOMAIN || 'https://openapi.koreainvestment.com:9443';

    if (!key || !secret) {
      throw new Error('KIS API 키(AppKey, AppSecret)가 설정되지 않았습니다.');
    }

    const cacheKey = `${key}_${secret}`;
    const cached = this.tokenCache.get(cacheKey);

    // 이미 유효한 토큰이 있으면 그대로 반환
    if (cached && cached.token && cached.expiredAt && new Date() < cached.expiredAt) {
      return cached.token;
    }

    try {
      const response = await axios.post(`${domain}/oauth2/tokenP`, {
        grant_type: 'client_credentials',
        appkey: key,
        appsecret: secret
      });

      const accessToken = response.data.access_token;
      const expiresIn = response.data.expires_in;

      // 여유 시간(1시간)을 두고 만료 시간 설정
      const expiredDate = new Date();
      expiredDate.setSeconds(expiredDate.getSeconds() + expiresIn - 3600);

      this.tokenCache.set(cacheKey, {
        token: accessToken,
        expiredAt: expiredDate
      });

      console.log(`✅ KIS 토큰 발급 성공 (Key: ${key.substring(0, 5)}...)`);
      return accessToken;

    } catch (error) {
      console.error('❌ KIS 토큰 발급 실패:', error.response ? error.response.data : error.message);
      throw new Error('한국투자증권 API 인증에 실패했습니다.');
    }
  }
}

// 싱글톤으로 내보내기
module.exports = new KISTokenManager();
