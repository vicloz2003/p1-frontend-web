import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { PolicyResponse } from '../../core/models/responses';
import { environment } from '../../../environments/environment';
import { ModelMetricsPanelComponent } from './model-metrics-panel.component';

interface RiskInstance {
  processInstanceId: string;
  clientId: string;
  currentNodeId: string;
  currentNodeLabel?: string;
  elapsedHours: number;
  riskScore: number;
  delayProbability: number;
  anomaly: boolean;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  priorityScore: number;
  drivers: string[];
  recommendation: string;
}

interface PolicyRiskResponse {
  policyId: string;
  policyName: string;
  assessedCount: number;
  anomalies: number;
  threshold: number;
  modelInfo: string;
  instances: RiskInstance[];
}

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: '#f44336',
  MEDIUM: '#ff9800',
  LOW: '#4caf50',
};

const DRIVER_LABELS: Record<string, string> = {
  elapsedRatio: 'Tiempo excedido',
  progressRatio: 'Avance lento',
  avgTaskRatio: 'Tareas largas',
  maxQueueRatio: 'Cola alta',
  reassignmentRatio: 'Reasignaciones',
  bottleneckPressure: 'Cuello botella',
  reworkRatio: 'Retrabajo',
};

@Component({
  selector: 'app-risk',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, SlicePipe, FormsModule,
    MatToolbarModule, MatButtonModule, MatIconModule, MatCardModule,
    MatChipsModule, MatFormFieldModule, MatSelectModule, MatSlideToggleModule,
    MatProgressBarModule, MatProgressSpinnerModule,
    MatTooltipModule, MatDividerModule,
    ModelMetricsPanelComponent,
  ],
  template: `
    <!-- ── Page header ── -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Motor de Riesgos</h1>
        <p class="page-subtitle">Detección de anomalías · PyTorch Autoencoder · DL no supervisado</p>
      </div>
      <span class="badge badge-dl" style="font-size:0.68rem;">7→3→7 · MSE · p97.5</span>
    </div>

    <div style="max-width:900px; margin:0 auto; padding:24px;">

      <!-- ── Selector de política ── -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-body" style="display:flex; gap:16px; align-items:center;">
          <mat-form-field style="flex:1;" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Selecciona una política</mat-label>
            <mat-select [(ngModel)]="selectedPolicyId">
              @for (p of policies(); track p.id) {
                <mat-option [value]="p.id">{{ p.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button class="btn btn-primary"
                  [disabled]="!selectedPolicyId || loading()"
                  (click)="analyze()"
                  style="flex-shrink:0;">
            @if (loading()) {
              <mat-progress-spinner diameter="18" mode="indeterminate"
                style="display:inline-block; --mdc-circular-progress-active-indicator-color:white;">
              </mat-progress-spinner>
            } @else {
              <mat-icon>radar</mat-icon>
            }
            Analizar riesgos
          </button>
        </div>
      </div>

      <!-- ── Métricas de los modelos DL (transparencia) ── -->
      <app-model-metrics-panel />

      <!-- ── Resultados ── -->
      @if (result(); as r) {

        <!-- KPI resumen -->
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr); margin-bottom:20px;">
          <div class="kpi-card">
            <div class="kpi-icon" style="background:#eff6ff;">
              <mat-icon style="color:#2563eb;">assignment</mat-icon>
            </div>
            <span class="kpi-value" style="color:#2563eb;">{{ r.assessedCount }}</span>
            <span class="kpi-label">Instancias evaluadas</span>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon" style="background:#fef2f2;">
              <mat-icon style="color:#dc2626;">warning</mat-icon>
            </div>
            <span class="kpi-value" style="color:#dc2626;">{{ r.anomalies }}</span>
            <span class="kpi-label">Anomalías detectadas</span>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon" style="background:#fffbeb;">
              <mat-icon style="color:#d97706;">percent</mat-icon>
            </div>
            <span class="kpi-value" style="color:#d97706;">
              {{ r.assessedCount > 0 ? (r.anomalies / r.assessedCount * 100 | number:'1.0-0') : 0 }}%
            </span>
            <span class="kpi-label">Tasa de riesgo</span>
          </div>
        </div>

        <!-- Lista de instancias -->
        <div class="card">
          <div style="padding:16px 20px; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h3 style="margin:0; font-family:'Sora',sans-serif; font-size:0.95rem; font-weight:700; color:#0f172a;">
              Instancias — ordenadas por prioridad
            </h3>
            <span style="font-size:0.75rem; color:#64748b; flex:1;">{{ r.modelInfo }}</span>
            <mat-slide-toggle [ngModel]="onlyAnomalies()"
                              (ngModelChange)="onlyAnomalies.set($event)" color="warn"
                              [matTooltip]="'Mostrar solo instancias marcadas como anomalía'">
              <span style="font-size:0.8rem;">Solo anomalías</span>
            </mat-slide-toggle>
          </div>
          <div style="padding:16px; display:flex; flex-direction:column; gap:10px;">
            @if (visibleInstances().length === 0) {
              <p style="margin:0; padding:12px; font-size:0.82rem; color:#64748b; text-align:center;">
                No hay instancias que coincidan con el filtro.
              </p>
            }
            @for (inst of visibleInstances(); track inst.processInstanceId) {
              <div style="border:1px solid #e2e8f0; border-left:4px solid {{ priorityColor(inst.priority) }};
                          border-radius:10px; padding:14px 16px; background:#fff;">

                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
                  <span class="badge-priority {{ inst.priority }}">{{ inst.priority }}</span>

                  @if (inst.anomaly) {
                    <span style="display:inline-flex; align-items:center; gap:3px; padding:2px 9px;
                                 border-radius:5px; font-size:0.68rem; font-weight:700;
                                 background:#fef2f2; color:#dc2626; border:1px solid #fecaca;"
                          matTooltip="Error de reconstrucción por encima del umbral aprendido">
                      <mat-icon style="font-size:13px; width:13px; height:13px;">priority_high</mat-icon>
                      ANOMALÍA
                    </span>
                  }

                  <span style="font-family:monospace; font-size:0.78rem; color:#475569; flex:1; min-width:120px;"
                        [matTooltip]="inst.processInstanceId">
                    {{ inst.currentNodeLabel || (inst.processInstanceId | slice:0:18) }}…
                  </span>

                  <span style="font-size:0.78rem; color:#94a3b8;">
                    {{ inst.elapsedHours | number:'1.0-1' }} h
                  </span>
                </div>

                <!-- Barra de riesgo -->
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                  <span style="font-size:0.75rem; color:#64748b; min-width:80px;">
                    Score {{ inst.riskScore | number:'1.2-2' }}
                  </span>
                  <div class="risk-bar" style="flex:1;">
                    <div class="risk-bar-fill priority-{{ inst.priority }}"
                         style="width:{{ (inst.riskScore * 100) | number:'1.0-0' }}%;">
                    </div>
                  </div>
                  <span style="font-size:0.75rem; color:#475569; min-width:32px; text-align:right;">
                    {{ (inst.riskScore * 100) | number:'1.0-0' }}%
                  </span>
                </div>

                <!-- Probabilidad de demora (predictor supervisado #2) -->
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;"
                     matTooltip="Probabilidad de incumplir SLA — clasificador supervisado (AUC 0.87)">
                  <span style="font-size:0.75rem; color:#64748b; min-width:80px;">
                    Demora P
                  </span>
                  <div class="risk-bar" style="flex:1; background:#eef2ff;">
                    <div style="height:100%; border-radius:inherit; background:#6366f1;
                                width:{{ (inst.delayProbability * 100) | number:'1.0-0' }}%;">
                    </div>
                  </div>
                  <span style="font-size:0.75rem; color:#475569; min-width:32px; text-align:right;">
                    {{ (inst.delayProbability * 100) | number:'1.0-0' }}%
                  </span>
                </div>

                <!-- Drivers -->
                @if (inst.drivers.length > 0) {
                  <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px;">
                    @for (d of inst.drivers; track d) {
                      <span style="padding:2px 9px; border-radius:5px; font-size:0.7rem;
                                   font-weight:600; background:#f1f5f9; color:#475569;
                                   border:1px solid #e2e8f0;">
                        {{ driverLabel(d) }}
                      </span>
                    }
                  </div>
                }

                <!-- Recomendación -->
                <p style="margin:0; font-size:0.8rem; color:#64748b; font-style:italic; line-height:1.4;">
                  {{ inst.recommendation }}
                </p>
              </div>
            }
          </div>
        </div>
      }

    </div>
  `,
})
export class RiskComponent {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  readonly policies = signal<PolicyResponse[]>([]);
  readonly result = signal<PolicyRiskResponse | null>(null);
  readonly loading = signal(false);
  readonly onlyAnomalies = signal(false);
  selectedPolicyId = '';

  /** Instances after applying the "only anomalies" filter. */
  readonly visibleInstances = computed(() => {
    const r = this.result();
    if (!r) return [] as RiskInstance[];
    return this.onlyAnomalies() ? r.instances.filter(i => i.anomaly) : r.instances;
  });

  constructor() {
    this.http.get<PolicyResponse[]>(`${this.API}/policies`).subscribe({
      next: list => this.policies.set(list.filter(p => p.status === 'ACTIVE')),
    });
  }

  analyze(): void {
    if (!this.selectedPolicyId) return;
    this.loading.set(true);
    this.result.set(null);
    this.http.get<PolicyRiskResponse>(`${this.API}/risk/policy/${this.selectedPolicyId}`)
      .subscribe({
        next: r => { this.result.set(r); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  priorityColor(p: string): string {
    return PRIORITY_COLOR[p] ?? '#9e9e9e';
  }

  driverLabel(d: string): string {
    return DRIVER_LABELS[d] ?? d;
  }
}
