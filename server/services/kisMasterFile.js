const axios = require('axios');
const AdmZip = require('adm-zip');
const iconv = require('iconv-lite');

class KisMasterFile {
  constructor() {
    this.stocks = []; // 전체 주식 목록을 메모리에 캐싱
    this.isLoaded = false;
  }

  async loadMasterData() {
    if (this.isLoaded) return;
    
    try {
      console.log('⏳ 한국투자증권 종목 마스터 파일 다운로드 중...');
      const [kospi, kosdaq] = await Promise.all([
        this.fetchAndParse('https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip', 'KOSPI'),
        this.fetchAndParse('https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip', 'KOSDAQ')
      ]);

      this.stocks = [...kospi, ...kosdaq];
      this.isLoaded = true;
      console.log(`✅ KIS 종목 마스터 로드 완료! (KOSPI: ${kospi.length}개, KOSDAQ: ${kosdaq.length}개)`);
    } catch (error) {
      console.error('❌ 종목 마스터 로드 실패:', error.message);
    }
  }

  async fetchAndParse(url, market) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const zip = new AdmZip(Buffer.from(response.data));
    const zipEntries = zip.getEntries();
    
    if (zipEntries.length === 0) return [];

    const mstBuffer = zipEntries[0].getData();
    // 한국투자증권 mst 파일은 cp949(euc-kr) 인코딩임
    const text = iconv.decode(mstBuffer, 'cp949');
    const lines = text.split('\n');
    
    const parsedStocks = [];

    lines.forEach(line => {
      // 바이트 단위 슬라이싱을 위해 해당 라인을 다시 버퍼로 변환
      const lineBuffer = iconv.encode(line, 'cp949');
      if (lineBuffer.length < 60) return; // 유효하지 않은 라인 무시
      
      // 한국투자증권 명세에 따른 고정길이(Byte) 파싱
      const shortCode = iconv.decode(lineBuffer.slice(0, 9), 'cp949').trim();      // 단축코드 (9자리, 예: A005930)
      const standardCode = iconv.decode(lineBuffer.slice(9, 21), 'cp949').trim();  // 표준코드 (12자리)
      const name = iconv.decode(lineBuffer.slice(21, 61), 'cp949').trim();         // 한글명 (40자리)
      
      // 단축코드의 앞 'A'나 'J' 등을 제거하여 6자리 티커로 변환
      let ticker = shortCode;
      if (ticker.startsWith('A') || ticker.startsWith('J') || ticker.startsWith('Q')) {
        ticker = ticker.substring(1);
      }
      if (ticker.length > 6) {
        ticker = ticker.substring(0, 6);
      }

      parsedStocks.push({
        ticker: ticker,
        name: name,
        market: market,
        standardCode: standardCode
      });
    });

    return parsedStocks;
  }

  // 종목 검색
  search(keyword) {
    if (!this.isLoaded) return [];
    
    // 키워드가 없으면 빈 배열 반환
    if (!keyword || keyword.trim() === '') return [];
    
    const query = keyword.toLowerCase();
    
    // 티커로 검색하거나 이름으로 검색 (최대 10개만 반환)
    return this.stocks.filter(stock => 
      stock.name.toLowerCase().includes(query) || stock.ticker.includes(query)
    ).slice(0, 10);
  }
}

module.exports = new KisMasterFile();
