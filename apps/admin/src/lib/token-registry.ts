let _token: string | null = null;
let _clearAuth: (() => void) | null = null;

export const tokenRegistry = {
  getToken: () => _token,
  setToken: (t: string | null) => {
    _token = t;
  },
  setClearAuth: (fn: () => void) => {
    _clearAuth = fn;
  },
  clearAuth: () => _clearAuth?.(),
};
