import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-bg">
      <div class="login-card">
        <!-- Brand header -->
        <div style="text-align:center; margin-bottom:28px;">
          <div style="display:inline-flex; align-items:center; justify-content:center;
                      width:64px; height:64px; border-radius:18px;
                      background:linear-gradient(135deg,#1976d2,#42a5f5);
                      box-shadow:0 6px 20px rgba(25,118,210,.35); margin-bottom:12px;">
            <mat-icon style="color:white; font-size:34px; width:34px; height:34px;">
              account_tree
            </mat-icon>
          </div>
          <h1 style="margin:0; font-size:1.6rem; font-weight:700; letter-spacing:-.02em;">iBPMS</h1>
          <p style="margin:4px 0 0; color:#5f6368; font-size:.9rem;">
            Sistema de Gestión de Procesos de Negocio
          </p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline" style="width: 100%;">
            <mat-label>Correo electrónico</mat-label>
            <mat-icon matPrefix style="margin-right:8px; color:#5f6368;">mail</mat-icon>
            <input matInput type="email" formControlName="email" autocomplete="email" />
            @if (form.controls.email.hasError('required')) {
              <mat-error>El correo es obligatorio.</mat-error>
            }
            @if (form.controls.email.hasError('email')) {
              <mat-error>Introduce un correo válido.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" style="width: 100%;">
            <mat-label>Contraseña</mat-label>
            <mat-icon matPrefix style="margin-right:8px; color:#5f6368;">lock</mat-icon>
            <input matInput type="password" formControlName="password" autocomplete="current-password" />
            @if (form.controls.password.hasError('required')) {
              <mat-error>La contraseña es obligatoria.</mat-error>
            }
            @if (form.controls.password.hasError('minlength')) {
              <mat-error>Mínimo 6 caracteres.</mat-error>
            }
          </mat-form-field>

          @if (isLoading()) {
            <mat-spinner diameter="36" style="margin: 8px auto 16px;" />
          } @else {
            <button mat-raised-button color="primary" type="submit"
                    [disabled]="form.invalid"
                    style="width: 100%; height:48px; font-size:1rem;">
              <mat-icon>login</mat-icon>
              Entrar
            </button>
          }
        </form>

        <div style="text-align:center; margin-top:16px;">
          <a mat-button routerLink="/register">¿No tienes cuenta? Regístrate</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-bg {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 50%, #e8eaf6 100%);
    }
    .login-card {
      width: 100%;
      max-width: 420px;
      background: #fff;
      border-radius: 20px;
      padding: 40px 32px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly isLoading = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.isLoading.set(true);

    this.authService.login(this.form.getRawValue()).subscribe({
      next: () => {
        const role = this.authService.currentUser()?.role;
        this.router.navigate([role === 'ADMIN_DESIGNER' ? '/policies' : '/dashboard']);
      },
      error: (err: { error?: { message?: string } }) => {
        this.isLoading.set(false);
        this.snackBar.open(err.error?.message ?? 'Error al iniciar sesión.', 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }
}
