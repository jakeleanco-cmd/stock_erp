const mongoose = require('mongoose');
const User = require('./models/User');
const Stock = require('./models/Stock');
const Trade = require('./models/Trade');
const SellRecord = require('./models/SellRecord');
const AutoTradeRule = require('./models/AutoTradeRule');
require('dotenv').config();

const migrateData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB 연결 성공');

    const testUser = await User.findOne({ email: 'test@test.com' });
    if (!testUser) {
      console.error('❌ 테스트 유저(test@test.com)를 먼저 생성해 주세요.');
      process.exit(1);
    }

    const userId = testUser._id;

    // 각 컬렉션에 userId가 없는 문서들을 찾아 업데이트
    const resultStock = await Stock.updateMany({ userId: { $exists: false } }, { userId });
    const resultTrade = await Trade.updateMany({ userId: { $exists: false } }, { userId });
    const resultSell = await SellRecord.updateMany({ userId: { $exists: false } }, { userId });
    const resultRule = await AutoTradeRule.updateMany({ userId: { $exists: false } }, { userId });

    console.log('✨ 데이터 마이그레이션 완료:');
    console.log(`- Stocks: ${resultStock.modifiedCount}개 업데이트`);
    console.log(`- Trades: ${resultTrade.modifiedCount}개 업데이트`);
    console.log(`- SellRecords: ${resultSell.modifiedCount}개 업데이트`);
    console.log(`- AutoTradeRules: ${resultRule.modifiedCount}개 업데이트`);
    
    process.exit();
  } catch (err) {
    console.error('❌ 마이그레이션 실패:', err.message);
    process.exit(1);
  }
};

migrateData();
