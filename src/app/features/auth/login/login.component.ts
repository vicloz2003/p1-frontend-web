import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
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
    MatProgressSpinnerModule,
  ],
  template: `
    <mat-card style="margin: auto; margin-top: 10vh; max-width: 420px;">
      <mat-card-header>
        <mat-card-title>Iniciar sesión</mat-card-title>
      </mat-card-header>

      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline" style="width: 100%;">
            <mat-label>Correo electrónico</mat-label>
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
            <input matInput type="password" formControlName="password" autocomplete="current-password" />
            @if (form.controls.password.hasError('required')) {
              <mat-error>La contraseña es obligatoria.</mat-error>
            }
            @if (form.controls.password.hasError('minlength')) {
              <mat-error>Mínimo 6 caracteres.</mat-error>
            }
          </mat-form-field>

          @if (isLoading()) {
            <mat-spinner diameter="36" style="margin: 0 auto 16px;" />
          } @else {
            <button
              mat-raised-button
              color="primary"
              type="submit"
              [disabled]="form.invalid"
              style="width: 100%;"
            >
              Entrar
            </button>
          }
        </form>
      </mat-card-content>

      <mat-card-actions>
        <a mat-button routerLink="/register">¿No tienes cuenta? Regístrate</a>
      </mat-card-actions>
    </mat-card>
  `,
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
