const User = require('../models/User');

/**
 * @desc    회원가입
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, registerCode } = req.body;

    // 가입 코드 확인
    if (registerCode !== process.env.REGISTRATION_CODE) {
      return res.status(400).json({ success: false, message: '유효하지 않은 가입 코드입니다.' });
    }

    // 사용자 생성
    const user = await User.create({
      name,
      email,
      password,
      role,
    });

    sendTokenResponse(user, 201, res);
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * @desc    로그인
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 이메일/비밀번호 확인
    if (!email || !password) {
      return res.status(400).json({ success: false, message: '이메일과 비밀번호를 입력해 주세요.' });
    }

    // 사용자 조회 (비밀번호 포함)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: '유효하지 않은 자격 증명입니다.' });
    }

    // 비밀번호 일치 확인
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: '유효하지 않은 자격 증명입니다.' });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
    });
  }
};

/**
 * @desc    현재 사용자 정보 조회
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
    });
  }
};

/**
 * @desc    사용자 프로필(KIS 설정 포함) 수정
 * @route   PUT /api/auth/profile
 * @access  Private
 */
exports.updateProfile = async (req, res) => {
  try {
    const { name, kisAppKey, kisAppSecret, kisAccountNo, kisAccountProduct } = req.body;

    const updateData = { name, kisAppKey, kisAccountNo, kisAccountProduct };
    if (kisAppSecret) updateData.kisAppSecret = kisAppSecret;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: user,
      message: '프로필 정보가 업데이트되었습니다.',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * @desc    비밀번호 재설정 (가입 코드로 본인 인증)
 * @route   POST /api/auth/reset-password
 * @access  Public
 * 왜 가입 코드를 사용하는가: 별도 이메일 서비스 없이 관리자가 발급한 코드로 본인 인증
 */
exports.resetPassword = async (req, res) => {
  try {
    const { email, registerCode, newPassword } = req.body;

    // 필수 값 검증
    if (!email || !registerCode || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '이메일, 가입 코드, 새 비밀번호를 모두 입력해 주세요.',
      });
    }

    // 가입 코드 확인 (관리자만 아는 코드로 권한 검증)
    if (registerCode !== process.env.REGISTRATION_CODE) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 가입 코드입니다.',
      });
    }

    // 새 비밀번호 길이 검증
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '비밀번호는 최소 6자 이상이어야 합니다.',
      });
    }

    // 해당 이메일의 사용자 조회
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '해당 이메일로 등록된 계정이 없습니다.',
      });
    }

    // 비밀번호 변경 (pre-save 훅에서 자동 암호화)
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해 주세요.',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
    });
  }
};

// 토큰 생성 및 응답 전송 헬퍼
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      kisAppKey: user.kisAppKey,
      kisAccountNo: user.kisAccountNo,
      kisAccountProduct: user.kisAccountProduct,
    },
  });
};
