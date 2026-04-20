import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, EMPTY, Observable, tap } from 'rxjs';
import { LoginRequest, LogoutRequest, RefreshTokenRequest, RegisterRequest } from '../models/requests';
import { LoginResponse, RefreshResponse, RegisterResponse } from '../models/responses';
import { SystemRole } from '../models/enums';

export interface JwtPayload {
  sub: string;
  role: SystemRole;
  departmentId: string | null;
  email: string;
  username: string;
  exp?: number;
}

const ACCESS_TOKEN_KEY = 'ibpms_access_token';
const REFRESH_TOKEN_KEY = 'ibpms_refresh_token';
const API_BASE = 'http://localhost:3000/api/v1';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly currentUser = signal<LoginResponse | null>(this.#restoreSession());

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_BASE}/auth/login`, credentials).pipe(
      tap(response => this.#storeSession(response))
    );
  }

  register(credentials: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${API_BASE}/auth/register`, credentials).pipe(
      tap(response => this.#storeSession(response))
    );
  }

  refresh(): Observable<RefreshResponse> {
    const body: RefreshTokenRequest = { refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) ?? '' };
    return this.http.post<RefreshResponse>(`${API_BASE}/auth/refresh`, body).pipe(
      tap(response => {
        localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
        const current = this.currentUser();
        if (current) {
          this.currentUser.set({ ...current, accessToken: response.accessToken, refreshToken: response.refreshToken });
        }
      })
    );
  }

  logout(): Observable<void> {
    const body: LogoutRequest = { refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) ?? '' };
    return this.http.post<void>(`${API_BASE}/auth/logout`, body).pipe(
      tap({ next: () => this.clearSession(), error: () => this.clearSession() }),
      catchError(() => EMPTY)
    );
  }

  /** Immediately clears local session without a backend call. Used by the error interceptor. */
  clearSession(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getAccessToken(): string {
    return localStorage.getItem(ACCESS_TOKEN_KEY) ?? '';
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    const payload = this.decodeToken(token);
    if (!payload) return false;
    if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) {
      this.clearSession();
      return false;
    }
    return true;
  }

  decodeToken(token: string): JwtPayload | null {
    try {
      const payloadBase64 = token.split('.')[1];
      const decoded = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded) as JwtPayload;
    } catch {
      return null;
    }
  }

  #storeSession(response: LoginResponse | RegisterResponse): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    this.currentUser.set(response as LoginResponse);
  }

  #restoreSession(): LoginResponse | null {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return null;
    const payload = this.decodeToken(token);
    if (!payload) return null;
    if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      return null;
    }
    return {
      accessToken: token,
      refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) ?? '',
      userId: payload.sub,
      username: payload.username,
      email: payload.email,
      role: payload.role,
      departmentId: payload.departmentId,
      expiresIn: 0,
    };
  }
}
