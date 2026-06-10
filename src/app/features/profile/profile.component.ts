import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../../core/auth/auth.service';
import { UserResponse } from '../../core/models/responses';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatToolbarModule, MatButtonModule, MatIconModule,
    MatCardModule, MatDividerModule,
    MatProgressBarModule, MatSnackBarModule,
  ],
  template: `
    <mat-toolbar>
      <mat-icon style="margin-right:8px;">account_circle</mat-icon>
      <span>Mi Perfil</span>
    </mat-toolbar>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate"></mat-progress-bar>
    }

    <div style="max-width:600px; margin:0 auto; padding:24px;">

      @if (profile(); as u) {

        <!-- Identidad -->
        <mat-card appearance="outlined" style="margin-bottom:16px;">
          <mat-card-header>
            <mat-icon mat-card-avatar color="primary">person</mat-icon>
            <mat-card-title>{{ u.username }}</mat-card-title>
            <mat-card-subtitle>{{ u.email }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <mat-divider style="margin:8px 0 16px;"></mat-divider>
            <div style="display:flex; flex-direction:column; gap:12px;">
              <div style="display:flex; align-items:center; gap:12px;">
                <mat-icon color="primary">badge</mat-icon>
                <div>
                  <p style="margin:0; font-size:0.8rem; color:var(--mat-sys-on-surface-variant);">Rol</p>
                  <p style="margin:0; font-weight:500;">{{ u.role }}</p>
                </div>
              </div>
              @if (u.departmentId) {
                <div style="display:flex; align-items:center; gap:12px;">
                  <mat-icon color="primary">business</mat-icon>
                  <div>
                    <p style="margin:0; font-size:0.8rem; color:var(--mat-sys-on-surface-variant);">Departamento ID</p>
                    <p style="margin:0; font-weight:500; font-size:0.9rem;">{{ u.departmentId }}</p>
                  </div>
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Fase 0.5 — Firebase / Notificaciones push -->
        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-icon mat-card-avatar color="accent">notifications_active</mat-icon>
            <mat-card-title>Notificaciones Push (Firebase)</mat-card-title>
            <mat-card-subtitle>Fase 0.5 — RF-28 / RF-29 / RF-30</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <mat-divider style="margin:8px 0 16px;"></mat-divider>

            <div style="display:flex; align-items:flex-start; gap:12px; padding:12px;
                        background:var(--mat-sys-surface-variant); border-radius:8px;
                        margin-bottom:16px;">
              <mat-icon style="color:#ff9800; margin-top:2px;">info</mat-icon>
              <div>
                <p style="margin:0 0 4px; font-weight:500;">¿Cómo funciona?</p>
                <p style="margin:0; font-size:0.85rem; color:var(--mat-sys-on-surface-variant);">
                  El token FCM se registra automáticamente desde la <strong>app móvil Flutter</strong>
                  al iniciar sesión (<code>PATCH /profile/fcm-token</code>). Una vez registrado,
                  recibes notificaciones push cuando:
                </p>
                <ul style="margin:8px 0 0; padding-left:20px; font-size:0.85rem;
                           color:var(--mat-sys-on-surface-variant);">
                  <li><strong>RF-29</strong>: Se te asigna una nueva tarea en tu departamento</li>
                  <li><strong>RF-30</strong>: El trámite que iniciaste avanza de estado</li>
                </ul>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:12px;">
              <mat-icon [color]="fcmRegistered() ? 'primary' : undefined"
                        [style.color]="!fcmRegistered() ? '#9e9e9e' : undefined">
                {{ fcmRegistered() ? 'smartphone' : 'phone_disabled' }}
              </mat-icon>
              <div>
                <p style="margin:0; font-weight:500;">
                  {{ fcmRegistered() ? 'Dispositivo móvil registrado' : 'Sin dispositivo registrado' }}
                </p>
                <p style="margin:0; font-size:0.8rem; color:var(--mat-sys-on-surface-variant);">
                  {{ fcmRegistered()
                     ? 'Las notificaciones push están activas en tu móvil'
                     : 'Inicia sesión en la app móvil para activar notificaciones push' }}
                </p>
              </div>
              <mat-icon [style.color]="fcmRegistered() ? '#4caf50' : '#9e9e9e'" style="margin-left:auto;">
                {{ fcmRegistered() ? 'check_circle' : 'radio_button_unchecked' }}
              </mat-icon>
            </div>
          </mat-card-content>
        </mat-card>

      }
    </div>
  `,
})
export class ProfileComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(MatSnackBar);
  private readonly API = environment.apiUrl;

  readonly profile = signal<(UserResponse & { fcmToken?: string }) | null>(null);
  readonly loading = signal(false);
  readonly fcmRegistered = signal(false);

  ngOnInit(): void {
    this.loading.set(true);
    this.http.get<UserResponse & { fcmToken?: string }>(`${this.API}/profile`).subscribe({
      next: u => {
        this.profile.set(u);
        this.fcmRegistered.set(!!u.fcmToken);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
