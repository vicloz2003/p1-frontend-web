import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BottleneckResponse } from '../../core/models/responses';

@Component({
  selector: 'app-analytics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatCardModule,
    MatTooltipModule,
  ],
  template: `
    <mat-toolbar>
      <span>Analítica — Cuellos de Botella</span>
      <span style="flex:1"></span>
      <button mat-icon-button (click)="ngOnInit()" matTooltip="Actualizar">
        <mat-icon>refresh</mat-icon>
      </button>
    </mat-toolbar>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate"></mat-progress-bar>
    }

    <div style="padding:24px;">

      <div style="display:flex; align-items:center; gap:8px; margin-bottom:24px;">
        <mat-icon>info</mat-icon>
        <span>Nodos ordenados por tiempo promedio de ejecución (mayor a menor)</span>
      </div>

      @if (!loading() && bottlenecks().length === 0) {
        <div style="display:flex; flex-direction:column; align-items:center;
                    justify-content:center; padding:64px 0; gap:16px;">
          <mat-icon style="font-size:64px; width:64px; height:64px; color:#9e9e9e;">
            bar_chart
          </mat-icon>
          <span style="font-size:1.1rem; color:#616161;">
            No hay datos de analítica disponibles
          </span>
          <span style="color:#9e9e9e;">
            Los datos aparecen cuando hay trámites completados
          </span>
        </div>
      }

      @for (item of bottlenecks(); track item.nodeId) {
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px;">
          <span style="min-width:180px; text-align:right; font-size:0.9rem;">
            {{ item.nodeLabel || item.nodeId }}
          </span>
          <mat-progress-bar
            mode="determinate"
            [value]="getBarValue(item.averageDurationSeconds)"
            style="flex:1; height:24px;">
          </mat-progress-bar>
          <span style="min-width:80px; font-size:0.9rem; font-weight:500;">
            {{ formatDuration(item.averageDurationSeconds) }}
          </span>
        </div>
      }

      @if (bottlenecks().length > 0) {
        <div style="display:flex; gap:16px; margin-top:32px; flex-wrap:wrap;">

          <mat-card style="flex:1; min-width:200px;">
            <mat-card-header>
              <mat-icon mat-card-avatar color="warn">slow_motion_video</mat-icon>
              <mat-card-title>Nodo más lento</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <p style="font-size:1.1rem; font-weight:500; margin:8px 0 4px;">
                {{ bottlenecks()[0].nodeLabel || bottlenecks()[0].nodeId }}
              </p>
              <p style="color:#616161; margin:0;">
                {{ formatDuration(bottlenecks()[0].averageDurationSeconds) }}
              </p>
            </mat-card-content>
          </mat-card>

          <mat-card style="flex:1; min-width:200px;">
            <mat-card-header>
              <mat-icon mat-card-avatar color="primary">account_tree</mat-icon>
              <mat-card-title>Total de nodos analizados</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <p style="font-size:2rem; font-weight:700; margin:8px 0 0;">
                {{ bottlenecks().length }}
              </p>
            </mat-card-content>
          </mat-card>

          <mat-card style="flex:1; min-width:200px;">
            <mat-card-header>
              <mat-icon mat-card-avatar color="primary">timer</mat-icon>
              <mat-card-title>Tiempo promedio general</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <p style="font-size:1.1rem; font-weight:500; margin:8px 0 0;">
                {{ formatDuration(Math.round(bottlenecks().reduce((a, b) => a + b.averageDurationSeconds, 0) / bottlenecks().length)) }}
              </p>
            </mat-card-content>
          </mat-card>

        </div>
      }

    </div>
  `,
})
export class AnalyticsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly API = 'http://localhost:3000/api/v1';

  readonly bottlenecks = signal<BottleneckResponse[]>([]);
  readonly loading = signal(false);

  protected readonly Math = Math;

  ngOnInit(): void {
    this.loading.set(true);
    this.http.get<BottleneckResponse[]>(`${this.API}/analytics/bottlenecks`).subscribe({
      next: data => {
        this.bottlenecks.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  getBarValue(seconds: number): number {
    const max = Math.max(...this.bottlenecks().map(b => b.averageDurationSeconds), 1);
    return (seconds / max) * 100;
  }
}
