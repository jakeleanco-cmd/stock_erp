const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, '이름을 입력해 주세요.'],
    },
    email: {
      type: String,
      required: [true, '이메일을 입력해 주세요.'],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        '유효한 이메일 형식이 아닙니다.',
      ],
    },
    password: {
      type: String,
      required: [true, '비밀번호를 입력해 주세요.'],
      minlength: 6,
      select: false, // 조회 시 기본적으로 제외
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    // 한국투자증권 API 설정 (개인별)
    kisAppKey: {
      type: String,
      default: '',
    },
    kisAppSecret: {
      type: String,
      default: '',
      select: false,
    },
    kisAccountNo: {
      type: String,
      default: '',
    },
    kisAccountProduct: {
      type: String,
      default: '01',
    },
  },
  {
    timestamps: true,
  }
);

// 비밀번호 암호화 (저장 전)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// JWT 서명 및 반환
userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// 비밀번호 일치 여부 확인
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
