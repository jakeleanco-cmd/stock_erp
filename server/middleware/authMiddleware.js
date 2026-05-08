const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * JWT 인증 미들웨어
 * 헤더의 Authorization: Bearer <token> 확인
 */
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // 헤더에서 토큰 추출
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    // 쿼리 파라미터에서 토큰 추출 (SSE 등 헤더 지원이 어려운 경우)
    token = req.query.token;
  }

  // 토큰 존재 여부 확인
  if (!token) {
    return res.status(401).json({
      success: false,
      message: '이 라우트에 접근하기 위한 권한이 없습니다.',
    });
  }

  try {
    // 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 사용자 정보를 요청 객체에 저장
    req.user = await User.findById(decoded.id);

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: '유효하지 않은 토큰입니다.',
    });
  }
};

/**
 * 역할(Role) 기반 권한 미들웨어
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `사용자 역할(${req.user.role})은 이 작업을 수행할 권한이 없습니다.`,
      });
    }
    next();
  };
};
