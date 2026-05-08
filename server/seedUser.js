const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const seedUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB 연결 성공');

    // 기존 테스트 유저 삭제 (중복 방지)
    await User.findOneAndDelete({ email: 'test@test.com' });

    // 새 유저 생성
    const user = await User.create({
      name: '테스트 유저',
      email: 'test@test.com',
      password: 'test1234',
      role: 'admin'
    });

    console.log('✨ 초기 유저 생성 완료:');
    console.log(`- 이메일: ${user.email}`);
    console.log(`- 비밀번호: test1234`);
    
    process.exit();
  } catch (err) {
    console.error('❌ 유저 생성 실패:', err.message);
    process.exit(1);
  }
};

seedUser();
