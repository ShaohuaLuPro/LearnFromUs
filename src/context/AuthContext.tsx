import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  apiConfirmPasswordReset,
  apiDeleteAccount,
  apiLogin,
  apiMe,
  apiRegister,
  apiRequestPasswordReset,
  apiUpdatePassword,
  apiUpdateProfile
} from '../api';
import { authStorage } from '../lib/authStorage';
import type { User } from '../types';

type ActionResult = {
  ok: boolean;
  message?: string;
  resetUrl?: string;
  user?: User;
};

type AuthContextValue = {
  authLoading: boolean;
  currentUser: User | null;
  getToken: () => string;
  login: (input: { email: string; password: string }) => Promise<ActionResult>;
  register: (input: { name: string; email: string; password: string }) => Promise<ActionResult>;
  logout: () => void;
  requestPasswordReset: (input: { email: string }) => Promise<ActionResult>;
  confirmPasswordReset: (input: { token: string; newPassword: string }) => Promise<ActionResult>;
  updateProfile: (input: { name: string; bio?: string; avatarAssetId?: string; removeAvatar?: boolean }) => Promise<ActionResult>;
  updatePassword: (input: { currentPassword: string; newPassword: string }) => Promise<ActionResult>;
  deleteAccount: () => Promise<ActionResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const token = authStorage.getToken();
      if (!token) {
        if (!cancelled) {
          setAuthLoading(false);
        }
        return;
      }

      try {
        const data = await apiMe(token);
        if (!cancelled) {
          setCurrentUser(data.user);
        }
      } catch {
        authStorage.clearToken();
        if (!cancelled) {
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const register = useCallback(async ({ name, email, password }: { name: string; email: string; password: string }) => {
    try {
      const data = await apiRegister({ name, email, password });
      authStorage.setToken(data.token);
      setCurrentUser(data.user);
      return { ok: true, user: data.user };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Registration failed.' };
    }
  }, []);

  const login = useCallback(async ({ email, password }: { email: string; password: string }) => {
    try {
      const data = await apiLogin({ email, password });
      authStorage.setToken(data.token);
      setCurrentUser(data.user);
      return { ok: true, user: data.user };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Login failed.' };
    }
  }, []);

  const requestPasswordReset = useCallback(async ({ email }: { email: string }) => {
    try {
      const data = await apiRequestPasswordReset({ email });
      return { ok: true, message: data.message, resetUrl: data.resetUrl };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to request reset.' };
    }
  }, []);

  const confirmPasswordReset = useCallback(async ({ token, newPassword }: { token: string; newPassword: string }) => {
    try {
      const data = await apiConfirmPasswordReset({ token, newPassword });
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to reset password.' };
    }
  }, []);

  const logout = useCallback(() => {
    authStorage.clearToken();
    setCurrentUser(null);
  }, []);

  const updateProfile = useCallback(async (
    { name, bio, avatarAssetId, removeAvatar }: { name: string; bio?: string; avatarAssetId?: string; removeAvatar?: boolean }
  ) => {
    const token = authStorage.getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiUpdateProfile({ name, bio, avatarAssetId, removeAvatar }, token);
      authStorage.setToken(data.token);
      setCurrentUser(data.user);
      return { ok: true, user: data.user };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to update profile.' };
    }
  }, []);

  const updatePassword = useCallback(async (input: { currentPassword: string; newPassword: string }) => {
    const token = authStorage.getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      await apiUpdatePassword(input, token);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to update password.' };
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    const token = authStorage.getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      await apiDeleteAccount(token);
      authStorage.clearToken();
      setCurrentUser(null);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to delete account.' };
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    authLoading,
    currentUser,
    getToken: authStorage.getToken,
    login,
    register,
    logout,
    requestPasswordReset,
    confirmPasswordReset,
    updateProfile,
    updatePassword,
    deleteAccount
  }), [
    authLoading,
    currentUser,
    login,
    register,
    logout,
    requestPasswordReset,
    confirmPasswordReset,
    updateProfile,
    updatePassword,
    deleteAccount
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return value;
}
