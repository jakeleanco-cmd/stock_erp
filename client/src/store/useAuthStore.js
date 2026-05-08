import { create } from 'zustand';
import { authApi } from '../api';
import { message } from 'antd';

/**
 * 인증 상태 관리 (Zustand)
 * 로그인, 회원가입, 내 정보 조회, 로그아웃 기능 포함
 */
const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  authLoading: false,

  /** 초기화: 로컬 스토리지에 토큰이 있으면 유저 정보 가져오기 */
  initAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    set({ authLoading: true });
    try {
      const res = await authApi.getMe();
      set({ user: res.data, isAuthenticated: true, authLoading: false });
    } catch (err) {
      localStorage.removeItem('token');
      set({ user: null, isAuthenticated: false, authLoading: false });
    }
  },

  /** 로그인 */
  login: async (credentials) => {
    set({ authLoading: true });
    try {
      const res = await authApi.login(credentials);
      localStorage.setItem('token', res.token);
      set({ user: res.user, isAuthenticated: true, authLoading: false });
      message.success(`${res.user.name}님, 환영합니다!`);
      return true;
    } catch (err) {
      message.error(err.message);
      set({ authLoading: false });
      return false;
    }
  },

  /** 회원가입 */
  register: async (userData) => {
    set({ authLoading: true });
    try {
      const res = await authApi.register(userData);
      localStorage.setItem('token', res.token);
      set({ user: res.user, isAuthenticated: true, authLoading: false });
      message.success('회원가입이 완료되었습니다!');
      return true;
    } catch (err) {
      message.error(err.message);
      set({ authLoading: false });
      return false;
    }
  },

  /** 로그아웃 */
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, isAuthenticated: false });
    message.info('로그아웃 되었습니다.');
  },

  /** 프로필 업데이트 */
  updateProfile: async (data) => {
    set({ authLoading: true });
    try {
      const res = await authApi.updateProfile(data);
      set({ user: res.data, authLoading: false });
      message.success('프로필 정보가 저장되었습니다.');
      return true;
    } catch (err) {
      message.error(err.message);
      set({ authLoading: false });
      return false;
    }
  },
}));

export default useAuthStore;
