// API配置文件
export const API_CONFIG = {
  BASE_URL: 'http://localhost:8000',
  API_PREFIX: '/api/v1',
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/auth/login',
      CALLBACK: '/auth/callback'
    },
    CKG: {
      ADD_SESSIONS: '/ckg/add-sessions',
      VISUALIZE_MVG: '/ckg/visualize-mvg',
      GET_SESSIONS: '/ckg/get-sessions'
    }
  }
} as const;

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'sys2path_auth_token',
  USER_INFO: 'sys2path_user_info'
} as const;

