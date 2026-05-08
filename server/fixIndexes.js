const mongoose = require('mongoose');
require('dotenv').config();

const fixIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB 연결 성공');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    if (collections.find(c => c.name === 'stocks')) {
      console.log('🔍 stocks 컬렉션 인덱스 확인 중...');
      const indexes = await db.collection('stocks').indexes();
      console.log('현재 인덱스:', JSON.stringify(indexes, null, 2));

      // ticker_1 유니크 인덱스가 있으면 삭제
      if (indexes.find(i => i.name === 'ticker_1')) {
        await db.collection('stocks').dropIndex('ticker_1');
        console.log('🗑️ 기존 ticker_1 단일 유니크 인덱스 삭제 완료');
      } else {
        console.log('✅ ticker_1 인덱스가 이미 없거나 단일 유니크가 아닙니다.');
      }
    }

    console.log('✨ 인덱스 수정 작업 완료');
    process.exit();
  } catch (err) {
    console.error('❌ 작업 실패:', err.message);
    process.exit(1);
  }
};

fixIndexes();
