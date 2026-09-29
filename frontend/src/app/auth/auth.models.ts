export interface User {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  bio: string | null;
  reputationScore: number;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  tokenType: 'Bearer';
  accessToken: string;
  expiresIn: number;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  firstName: string;
  lastName: string;
  displayName: string;
}
