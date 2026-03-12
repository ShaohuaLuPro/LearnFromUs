export const TOKEN_KEY = 'lfu_token_v1';

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

export const authStorage = {
  getToken() {
    return getStorage()?.getItem(TOKEN_KEY) || '';
  },
  setToken(token: string) {
    getStorage()?.setItem(TOKEN_KEY, token);
  },
  clearToken() {
    getStorage()?.removeItem(TOKEN_KEY);
  }
};
