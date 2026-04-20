import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, SlicePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WebSocketService } from '../../core/websocket/websocket.service';
import { ProcessStatusResponse } from '../../core/models/responses';

@Component({
  selector: 'app-process-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    SlicePipe,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressBarModule,
    MatChipsModule,
    MatListModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  template: `
    <mat-toolbar>
      <button mat-icon-button (click)="router.navigate(['/policies'])"
              matTooltip="Volver a políticas">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span>Estado del Trámite</span>
    </mat-toolbar>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate"></mat-progress-bar>
    }

    <div style="padding:24px; max-width:800px; margin:0 auto;">

      @if (status(); as s) {

        <mat-card appearance="outlined" style="margin-bottom:24px;">
          <mat-card-header>
            <mat-icon mat-card-avatar [color]="getStatusColor()">
              {{ getStatusIcon() }}
            </mat-icon>
            <mat-card-title>Trámite {{ s.processInstanceId | slice:0:8 }}…</mat-card-title>
            <mat-card-subtitle>
              Iniciado: {{ s.startedAt | date:'dd/MM/yyyy HH:mm' }}
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content style="padding-top:16px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <mat-chip [color]="getStatusColor()" highlighted>
                {{ s.status }}
              </mat-chip>
              <span style="font-size:0.9rem; color:var(--mat-sys-on-surface-variant);">
                Nodo actual: {{ s.currentNodeId }}
              </span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title style="font-size:1rem;">
              Información del trámite
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-list>
              <mat-list-item>
                <mat-icon matListItemIcon>tag</mat-icon>
                <span matListItemTitle>ID del trámite</span>
                <span matListItemLine>{{ s.processInstanceId }}</span>
              </mat-list-item>
              <mat-divider></mat-divider>
              <mat-list-item>
                <mat-icon matListItemIcon>account_tree</mat-icon>
                <span matListItemTitle>Nodo actual</span>
                <span matListItemLine>{{ s.currentNodeId }}</span>
              </mat-list-item>
              <mat-divider></mat-divider>
              <mat-list-item>
                <mat-icon matListItemIcon>schedule</mat-icon>
                <span matListItemTitle>Fecha de inicio</span>
                <span matListItemLine>
                  {{ s.startedAt | date:'dd/MM/yyyy HH:mm:ss' }}
                </span>
              </mat-list-item>
            </mat-list>
          </mat-card-content>
        </mat-card>

        @if (s.status === 'COMPLETED') {
          <mat-card appearance="outlined"
            style="margin-top:24px; background:var(--mat-sys-primary-container);">
            <mat-card-content style="display:flex; align-items:center;
                                     gap:12px; padding:16px;">
              <mat-icon color="primary">celebration</mat-icon>
              <span>Este trámite ha sido completado exitosamente.</span>
            </mat-card-content>
          </mat-card>
        }

        @if (s.status === 'CANCELLED') {
          <mat-card appearance="outlined"
            style="margin-top:24px; background:var(--mat-sys-error-container);">
            <mat-card-content style="display:flex; align-items:center;
                                     gap:12px; padding:16px;">
              <mat-icon color="warn">info</mat-icon>
              <span>Este trámite fue cancelado.</span>
            </mat-card-content>
          </mat-card>
        }

      }

      @if (!loading() && !status()) {
        <div style="display:flex; flex-direction:column; align-items:center;
                    justify-content:center; padding:64px 0; gap:16px;">
          <mat-icon style="font-size:64px; width:64px; height:64px; color:#9e9e9e;">
            search_off
          </mat-icon>
          <span style="font-size:1.1rem; color:#616161;">
            No se encontró el trámite
          </span>
          <button mat-stroked-button (click)="router.navigate(['/policies'])">
            Volver
          </button>
        </div>
      }

    </div>
  `,
})
export class ProcessStatusComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly ws = inject(WebSocketService);
  readonly router = inject(Router);

  private readonly API = 'http://localhost:3000/api/v1';
  private wsSub?: Subscription;

  readonly processId = signal<string>('');
  readonly status = signal<ProcessStatusResponse | null>(null);
  readonly loading = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.processId.set(id);
    this.loadStatus(id);
    this.subscribeWebSocket(id);
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
  }

  loadStatus(id: string): void {
    this.loading.set(true);
    this.http.get<ProcessStatusResponse>(`${this.API}/processes/${id}/status`).subscribe({
      next: data => {
        this.status.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  subscribeWebSocket(id: string): void {
    this.wsSub = this.ws
      .subscribe<ProcessStatusResponse>(`/topic/process/${id}`)
      .subscribe(update => this.status.set(update));
  }

  getStatusColor(): string {
    switch (this.status()?.status) {
      case 'ACTIVE':    return 'primary';
      case 'COMPLETED': return 'accent';
      case 'CANCELLED': return 'warn';
      default:          return '';
    }
  }

  getStatusIcon(): string {
    switch (this.status()?.status) {
      case 'ACTIVE':    return 'pending';
      case 'COMPLETED': return 'check_circle';
      case 'CANCELLED': return 'cancel';
      default:          return 'help';
    }
  }
}
