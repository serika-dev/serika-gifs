import axios from 'axios'

const ACCOUNTS_URL = process.env.ACCOUNTS_URL || 'https://accounts.serika.dev'
const AUTH_INTERNAL_KEY = process.env.AUTH_INTERNAL_KEY!

const accountsApi = axios.create({
  baseURL: ACCOUNTS_URL,
  headers: {
    'X-Internal-Key': AUTH_INTERNAL_KEY,
    'Content-Type': 'application/json',
  },
})

export interface AccountUser {
  id: string
  username: string
  email: string
  avatar?: string
  createdAt: string
}

export interface LoginResponse {
  success: boolean
  user?: AccountUser
  token?: string
  refreshToken?: string
  error?: string
}

export interface RegisterResponse {
  success: boolean
  user?: AccountUser
  token?: string
  refreshToken?: string
  error?: string
}

export interface ValidateTokenResponse {
  valid: boolean
  user?: AccountUser
  error?: string
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  try {
    const response = await accountsApi.post('/api/auth/login', { 
      email, 
      password,
      rememberMe: true, // Always remember for 30 days
    })
    return response.data
  } catch (error: any) {
    console.error('Login error:', error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.error || 'Login failed',
    }
  }
}

export async function register(
  username: string,
  email: string,
  password: string
): Promise<RegisterResponse> {
  try {
    const response = await accountsApi.post('/api/auth/register', {
      username,
      email,
      password,
    })
    return response.data
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || 'Registration failed',
    }
  }
}

export async function validateToken(token: string): Promise<ValidateTokenResponse> {
  try {
    // Use the /api/user/me endpoint which validates token and returns user
    const response = await accountsApi.get('/api/user/me', {
      headers: {
        'X-Auth-Token': token,
      },
    })
    
    const userData = response.data
    
    return {
      valid: true,
      user: {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        avatar: userData.avatar,
        createdAt: userData.joinDate,
      },
    }
  } catch (error: any) {
    console.error('Token validation error:', error.response?.status, error.response?.data || error.message)
    return {
      valid: false,
      error: error.response?.data?.error || 'Token validation failed',
    }
  }
}

export async function getUser(userId: string): Promise<AccountUser | null> {
  try {
    const response = await accountsApi.get(`/api/users/${userId}`)
    return response.data.user
  } catch {
    return null
  }
}

export async function logout(token: string): Promise<boolean> {
  try {
    await accountsApi.post('/api/auth/logout', {}, {
      headers: {
        'X-Auth-Token': token,
      },
    })
    return true
  } catch {
    return false
  }
}
