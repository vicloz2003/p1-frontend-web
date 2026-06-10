import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  Chart,
  ArcElement, BarElement, CategoryScale, LinearScale,
  LineElement, PointElement, Legend, Tooltip, Title,
  DoughnutController, BarController, LineController,
} from 'chart.js';
import { BottleneckResponse, PolicyResponse, ProcessStatusResponse } from '../../core/models/responses';
import { environment } from '../../../environments/environment';

/**
 * Convierte horas (double) a una cadena legible para KPIs.
 *   < 1 min  →  "< 1 min"
 *   < 1 h    →  "45 min"
 *   < 24 h   →  "3.5 h"
 *   ≥ 24 h   →  "3 d"  ó  "3 d 4 h"  (si residuo ≥ 30 min)
 */
function formatDuration(hours: number): string {
  if (hours < 1 / 60) return '< 1 min';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  const days = Math.floor(hours / 24);
  const remaining = hours % 24;
  return remaining < 0.5 ? `${days} d` : `${days} d ${remaining.toFixed(0)} h`;
}

// Register only the Chart.js modules we need (tree-shaking friendly)
Chart.register(
  ArcElement, BarElement, CategoryScale, LinearScale,
  LineElement, PointElement, Legend, Tooltip, Title,
  DoughnutController, BarController, LineController,
);

// ── Interfaces ─────────────────────────────────────────────────────────────
interface EmployeePerf {
  userId: string; username: string; departmentId: string | null;
  avgCompletionSeconds: number; performanceRatio: number;
  taskCount: number; performanceLevel: string;
}
interface Throughput {
  period: string; initiated: number; completed: number; cancelled: number; completionRate: number;
}
interface SlaCompliance {
  nodeId: string; nodeLabel: string; slaSeconds: number;
  totalTasks: number; withinSla: number; complianceRate: number;
}
interface Abandonment {
  policyName: string; totalInitiated: number; completed: number; cancelled: number; abandonmentRate: number;
}
interface Dashboard {
  policyName: string; activeInstances: number; completedInstances: number;
  cancelledInstances: number; abandonmentRate: number; avgCompletionTimeHours: number;
  topBottlenecks: BottleneckResponse[]; poorPerformers: EmployeePerf[];
}
interface RiskInstance {
  processInstanceId: string; currentNodeId: string; currentNodeLabel: string; riskScore: number;
  anomaly: boolean; priority: string; drivers: string[];
}
interface PolicyRisk {
  policyId: string; policyName: string; assessedCount: number;
  anomalies: number; modelInfo: string; instances: RiskInstance[];
}

const DRIVER_LABELS: Record<string, string> = {
  elapsedRatio: 'Tiempo excedido', progressRatio: 'Avance lento',
  avgTaskRatio: 'Tareas largas', maxQueueRatio: 'Cola alta',
  reassignmentRatio: 'Reasignaciones', bottleneckPressure: 'Cuello botella',
  reworkRatio: 'Retrabajo',
};

// ── Component ───────────────────────────────────────────────────────────────
@Component({
  selector: 'app-analytics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, FormsModule, RouterLink,
    MatToolbarModule, MatButtonModule, MatIconModule, MatCardModule,
    MatProgressBarModule, MatTooltipModule, MatSelectModule,
    MatFormFieldModule, MatChipsModule,
  ],
  template: `
    <!-- ── Page header ── -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Analítica e Inteligencia</h1>
        <p class="page-subtitle">KPIs, desempeño y motor DL de riesgos</p>
      </div>
      <button class="btn-icon" (click)="reload()" matTooltip="Actualizar datos">
        <mat-icon>refresh</mat-icon>
      </button>
    </div>

    @if (loading()) {
      <div style="height:3px; overflow:hidden; background:#eff6ff;">
        <div class="loading-bar" style="height:100%;"></div>
      </div>
    }

    <div style="max-width:1100px; margin:0 auto; padding:24px;">

      <!-- ── Selector de política ── -->
      <div class="card" style="margin-bottom:24px;">
        <div class="card-body" style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
          <mat-form-field appearance="outline" subscriptSizing="dynamic"
                          style="flex:1; min-width:260px; max-width:440px;">
            <mat-label>Política para análisis</mat-label>
            <mat-select [(ngModel)]="selectedPolicyId" (ngModelChange)="onPolicyChange($event)">
              <mat-option value="">— Global (todos) —</mat-option>
              @for (p of policies(); track p.id) {
                <mat-option [value]="p.id">{{ p.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          @if (selectedPolicyId) {
            <span class="badge badge-active">Análisis activo: {{ policyName() }}</span>
          }
        </div>
      </div>

      <!-- ══ Resumen GLOBAL (sin política seleccionada) ══ -->
      @if (!selectedPolicyId) {
        <div class="section-header">
          <h2>Resumen global</h2>
          <span style="font-size:0.78rem; color:#64748b;">todos los trámites</span>
        </div>
        <div class="kpi-grid" style="margin-bottom:24px;">
          <div class="kpi-card">
            <div class="kpi-icon" style="background:#f1f5f9;">
              <mat-icon style="color:#475569;">account_tree</mat-icon>
            </div>
            <span class="kpi-value">{{ globalTotal() }}</span>
            <span class="kpi-label">Total trámites</span>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon" style="background:#fffbeb;">
              <mat-icon style="color:#d97706;">pending</mat-icon>
            </div>
            <span class="kpi-value" style="color:#d97706;">{{ globalActive() }}</span>
            <span class="kpi-label">En curso</span>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon" style="background:#f0fdf4;">
              <mat-icon style="color:#16a34a;">check_circle</mat-icon>
            </div>
            <span class="kpi-value" style="color:#16a34a;">{{ globalCompleted() }}</span>
            <span class="kpi-label">Completados</span>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon" style="background:#fef2f2;">
              <mat-icon style="color:#dc2626;">cancel</mat-icon>
            </div>
            <span class="kpi-value" style="color:#dc2626;">{{ globalCancelled() }}</span>
            <span class="kpi-label">Cancelados</span>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon" style="background:#eff6ff;">
              <mat-icon style="color:#2563eb;">policy</mat-icon>
            </div>
            <span class="kpi-value" style="color:#2563eb;">{{ policies().length }}</span>
            <span class="kpi-label">Políticas activas</span>
          </div>
        </div>

        @if (globalTotal() > 0) {
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:28px;">
            <div class="card">
              <div style="padding:14px 16px 0; border-bottom:1px solid #f1f5f9;">
                <p style="margin:0 0 10px; font-family:'Sora',sans-serif; font-size:0.88rem; font-weight:700; color:#0f172a;">
                  Distribución por estado
                </p>
              </div>
              <div class="card-body">
                <div style="width:200px; height:200px; margin:0 auto;">
                  <canvas id="ibpms-chartGlobalDist"></canvas>
                </div>
              </div>
            </div>
            <div class="card">
              <div style="padding:14px 16px 0; border-bottom:1px solid #f1f5f9;">
                <p style="margin:0 0 10px; font-family:'Sora',sans-serif; font-size:0.88rem; font-weight:700; color:#0f172a;">
                  Trámites por política
                </p>
              </div>
              <div class="card-body">
                <div style="position:relative; height:{{ chartHeightByPolicy() }}px;">
                  <canvas id="ibpms-chartByPolicy"></canvas>
                </div>
              </div>
            </div>
          </div>
        }
      }

      <!-- ══ KPI Cards (por política) ══ -->
      @if (dashboard(); as d) {
        <div class="section-header">
          <h2>Indicadores clave</h2>
        </div>
        <div class="kpi-grid" style="margin-bottom:28px;">
          <div class="kpi-card">
            <div class="kpi-icon" style="background:#fffbeb;">
              <mat-icon style="color:#d97706;">pending</mat-icon>
            </div>
            <span class="kpi-value" style="color:#d97706;">{{ d.activeInstances }}</span>
            <span class="kpi-label">En curso</span>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon" style="background:#f0fdf4;">
              <mat-icon style="color:#16a34a;">check_circle</mat-icon>
            </div>
            <span class="kpi-value" style="color:#16a34a;">{{ d.completedInstances }}</span>
            <span class="kpi-label">Completados</span>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon" style="background:#fef2f2;">
              <mat-icon style="color:#dc2626;">cancel</mat-icon>
            </div>
            <span class="kpi-value" style="color:#dc2626;">{{ d.cancelledInstances }}</span>
            <span class="kpi-label">Cancelados</span>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon" style="background:#faf5ff;">
              <mat-icon style="color:#7c3aed;">schedule</mat-icon>
            </div>
            <span class="kpi-value" style="color:#7c3aed;">{{ d.avgCompletionTimeHours | number:'1.1-1' }}h</span>
            <span class="kpi-label">Tiempo promedio</span>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon" [style.background]="d.abandonmentRate > 20 ? '#fef2f2' : '#f0fdf4'">
              <mat-icon [style.color]="d.abandonmentRate > 20 ? '#dc2626' : '#16a34a'">trending_down</mat-icon>
            </div>
            <span class="kpi-value" [style.color]="d.abandonmentRate > 20 ? '#dc2626' : '#16a34a'">
              {{ d.abandonmentRate | number:'1.0-1' }}%
            </span>
            <span class="kpi-label">Abandono</span>
          </div>
        </div>
      }

      <!-- ══ Cuellos de botella ══ -->
      <div class="section-header">
        <h2>Cuellos de botella</h2>
        <span style="font-size:0.75rem; color:#64748b;">duración promedio por nodo (histórico)</span>
      </div>
      <div class="card" style="margin-bottom:28px;">
        <div class="card-body">
          @if (bottlenecks().length === 0) {
            <p style="text-align:center; color:#94a3b8; padding:24px 0; margin:0;">
              No hay tareas completadas aún.
            </p>
          } @else {
            <div style="position:relative; height:{{ chartHeightBottleneck() }}px;">
              <canvas id="ibpms-chartBottleneck"></canvas>
            </div>
          }
        </div>
      </div>

      <!-- ══ Desempeño empleados ══ -->
      <div class="section-header">
        <h2>Desempeño de empleados</h2>
        <span style="font-size:0.75rem; color:#64748b;">verde ≤ 0.85 · naranja ≤ 1.15 · rojo > 1.15 vs global</span>
      </div>
      <div class="card" style="margin-bottom:28px;">
        <div class="card-body">
          @if (employeePerf().length === 0) {
            <p style="text-align:center; color:#94a3b8; padding:24px 0; margin:0;">
              Sin datos de desempeño.
            </p>
          } @else {
            <div style="position:relative; height:{{ chartHeightEmployees() }}px;">
              <canvas id="ibpms-chartEmployees"></canvas>
            </div>
          }
        </div>
      </div>

      <!-- ══ Throughput ══ -->
      @if (selectedPolicyId) {
        <div class="section-header">
          <h2>Throughput</h2>
        </div>
        <div class="card" style="margin-bottom:28px;">
          <div class="card-body">
            <div style="display:flex; gap:6px; margin-bottom:16px;">
              @for (period of periods; track period.value) {
                <button class="btn" style="padding:6px 14px; font-size:0.82rem;"
                        [class.btn-primary]="throughputPeriod() === period.value"
                        [class.btn-ghost]="throughputPeriod() !== period.value"
                        (click)="loadThroughput(period.value)">
                  {{ period.label }}
                </button>
              }
            </div>
            @if (throughput(); as t) {
              <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:12px; margin-bottom:20px;">
                <div style="text-align:center; padding:12px; background:#f8fafc; border-radius:8px;">
                  <p style="font-family:'Sora',sans-serif; font-size:1.6rem; font-weight:700; margin:0; color:#0f172a;">{{ t.initiated }}</p>
                  <p style="margin:4px 0 0; font-size:0.75rem; color:#64748b;">Iniciados</p>
                </div>
                <div style="text-align:center; padding:12px; background:#f0fdf4; border-radius:8px;">
                  <p style="font-family:'Sora',sans-serif; font-size:1.6rem; font-weight:700; margin:0; color:#16a34a;">{{ t.completed }}</p>
                  <p style="margin:4px 0 0; font-size:0.75rem; color:#64748b;">Completados</p>
                </div>
                <div style="text-align:center; padding:12px; background:#fef2f2; border-radius:8px;">
                  <p style="font-family:'Sora',sans-serif; font-size:1.6rem; font-weight:700; margin:0; color:#dc2626;">{{ t.cancelled }}</p>
                  <p style="margin:4px 0 0; font-size:0.75rem; color:#64748b;">Cancelados</p>
                </div>
                <div style="text-align:center; padding:12px; background:#eff6ff; border-radius:8px;">
                  <p style="font-family:'Sora',sans-serif; font-size:1.6rem; font-weight:700; margin:0; color:#2563eb;">
                    {{ t.completionRate | number:'1.0-1' }}%
                  </p>
                  <p style="margin:4px 0 0; font-size:0.75rem; color:#64748b;">Tasa completados</p>
                </div>
              </div>
              <div style="position:relative; height:200px;">
                <canvas id="ibpms-chartThroughput"></canvas>
              </div>
            }
          </div>
        </div>
      }

      <!-- ══ SLA ══ -->
      @if (selectedPolicyId && sla().length > 0) {
        <div class="section-header">
          <h2>Cumplimiento de SLA</h2>
          <span style="font-size:0.75rem; color:#64748b;">línea roja = umbral 80%</span>
        </div>
        <div class="card" style="margin-bottom:28px;">
          <div class="card-body">
            <div style="position:relative; height:240px;">
              <canvas id="ibpms-chartSla"></canvas>
            </div>
          </div>
        </div>
      }

      <!-- ══ Abandono ══ -->
      @if (selectedPolicyId && abandonment(); as ab) {
        <div class="section-header">
          <h2>Tasa de abandono</h2>
        </div>
        <div class="card" style="margin-bottom:28px;">
          <div class="card-body" style="display:flex; gap:32px; align-items:center; flex-wrap:wrap;">
            <div style="width:200px; height:200px; flex-shrink:0;">
              <canvas id="ibpms-chartAbandonment"></canvas>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; gap:24px;">
                <span style="font-size:0.875rem; color:#64748b;">Total iniciados</span>
                <strong style="font-size:0.875rem; color:#0f172a;">{{ ab.totalInitiated }}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; gap:24px;">
                <span style="font-size:0.875rem; color:#64748b;">Completados</span>
                <strong style="font-size:0.875rem; color:#16a34a;">{{ ab.completed }}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; gap:24px;">
                <span style="font-size:0.875rem; color:#64748b;">Cancelados</span>
                <strong style="font-size:0.875rem; color:#dc2626;">{{ ab.cancelled }}</strong>
              </div>
              <div style="margin-top:8px; padding-top:8px; border-top:1px solid #e2e8f0;">
                <span style="font-family:'Sora',sans-serif; font-size:1.4rem; font-weight:700;"
                      [style.color]="ab.abandonmentRate > 20 ? '#dc2626' : '#16a34a'">
                  {{ ab.abandonmentRate | number:'1.1-1' }}%
                </span>
                <span style="font-size:0.8rem; color:#64748b; margin-left:6px;">tasa abandono</span>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- ══ MOTOR DL — Deep Learning ══ -->
      @if (selectedPolicyId) {
        <div class="section-header" style="margin-top:4px;">
          <h2>Motor Inteligente de Riesgos</h2>
          <span class="badge badge-dl">PyTorch Autoencoder · DL</span>
        </div>

        @if (!dlAvailable()) {
          <div class="card" style="margin-bottom:28px; border-left:4px solid #f59e0b;">
            <div class="card-body" style="display:flex; align-items:center; gap:12px;">
              <mat-icon style="color:#d97706;">warning</mat-icon>
              <span style="font-size:0.875rem; color:#78350f;">
                Servicio ML no disponible — levanta ibpms_ml en :8001 para ver las métricas de Deep Learning.
              </span>
            </div>
          </div>
        } @else if (riskData(); as r) {
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">

            <!-- Doughnut anomalías -->
            <div class="card">
              <div style="padding:14px 16px 0; border-bottom:1px solid #f1f5f9;">
                <p style="margin:0; font-family:'Sora',sans-serif; font-size:0.88rem; font-weight:700; color:#0f172a;">
                  Detección de anomalías
                </p>
                <p style="margin:2px 0 10px; font-size:0.75rem; color:#64748b;">
                  {{ r.assessedCount }} instancias evaluadas
                </p>
              </div>
              <div class="card-body">
                <div style="width:180px; height:180px; margin:0 auto;">
                  <canvas id="ibpms-chartDlAnomaly"></canvas>
                </div>
                <p style="text-align:center; margin:10px 0 0; font-size:0.85rem; color:#64748b;">
                  <strong [style.color]="r.anomalies > 0 ? '#dc2626' : '#16a34a'">
                    {{ r.anomalies }} anomalías
                  </strong>
                  ({{ r.assessedCount > 0 ? (r.anomalies / r.assessedCount * 100 | number:'1.0-0') : 0 }}%)
                </p>
              </div>
            </div>

            <!-- Distribución de prioridades -->
            <div class="card">
              <div style="padding:14px 16px 0; border-bottom:1px solid #f1f5f9;">
                <p style="margin:0; font-family:'Sora',sans-serif; font-size:0.88rem; font-weight:700; color:#0f172a;">
                  Distribución de riesgo
                </p>
                <p style="margin:2px 0 10px; font-size:0.75rem; color:#64748b;">
                  Score promedio: {{ dlAvgScore() | number:'1.2-2' }}
                </p>
              </div>
              <div class="card-body">
                <div style="position:relative; height:180px;">
                  <canvas id="ibpms-chartDlPriority"></canvas>
                </div>
              </div>
            </div>
          </div>

          <!-- Drivers más frecuentes -->
          @if (dlTopDrivers().length > 0) {
            <div class="card" style="margin-bottom:24px;">
              <div style="padding:14px 16px 0; border-bottom:1px solid #f1f5f9;">
                <p style="margin:0; font-family:'Sora',sans-serif; font-size:0.88rem; font-weight:700; color:#0f172a;">
                  Factores de riesgo más frecuentes
                </p>
                <p style="margin:2px 0 10px; font-size:0.75rem; color:#64748b;">
                  En instancias con anomalía detectada por el autoencoder
                </p>
              </div>
              <div class="card-body">
                <div style="position:relative; height:180px;">
                  <canvas id="ibpms-chartDlDrivers"></canvas>
                </div>
              </div>
            </div>
          }

          <!-- Nodos críticos detectados por el modelo (cuellos de botella en tiempo real) -->
          @if (dlCriticalNodes().length > 0) {
            <div class="card" style="margin-bottom:24px; border-left:4px solid #dc2626;">
              <div style="padding:14px 16px 0; border-bottom:1px solid #f1f5f9;">
                <p style="margin:0; font-family:'Sora',sans-serif; font-size:0.88rem; font-weight:700; color:#0f172a;">
                  Nodos críticos detectados por el modelo
                </p>
                <p style="margin:2px 0 10px; font-size:0.75rem; color:#64748b;">
                  Trámites en riesgo (anomalía) atascados en cada nodo <strong>ahora mismo</strong> — no es promedio histórico
                </p>
              </div>
              <div class="card-body">
                <div style="position:relative; height:{{ chartHeightCriticalNodes() }}px;">
                  <canvas id="ibpms-chartDlCriticalNodes"></canvas>
                </div>
              </div>
            </div>
          }

          <div style="text-align:right; margin-bottom:28px;">
            <a class="btn btn-ghost" routerLink="/risk" style="text-decoration:none;">
              <mat-icon>open_in_new</mat-icon>
              Ver detalle completo → Motor de Riesgos
            </a>
          </div>
        }
      }

    </div>
  `,
})
export class AnalyticsComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly API = environment.apiUrl;

  private charts: Chart[] = [];

  readonly loading = signal(false);
  readonly policies = signal<PolicyResponse[]>([]);
  readonly bottlenecks = signal<BottleneckResponse[]>([]);
  readonly employeePerf = signal<EmployeePerf[]>([]);
  readonly dashboard = signal<Dashboard | null>(null);
  readonly throughput = signal<Throughput | null>(null);
  readonly throughputPeriod = signal('MONTHLY');
  readonly sla = signal<SlaCompliance[]>([]);
  readonly abandonment = signal<Abandonment | null>(null);
  readonly riskData = signal<PolicyRisk | null>(null);
  readonly dlAvailable = signal(false);
  readonly allProcesses = signal<ProcessStatusResponse[]>([]);

  selectedPolicyId = '';

  // Global aggregates (no policy selected)
  globalTotal(): number { return this.allProcesses().length; }
  globalActive(): number { return this.allProcesses().filter(p => p.status === 'ACTIVE').length; }
  globalCompleted(): number { return this.allProcesses().filter(p => p.status === 'COMPLETED').length; }
  globalCancelled(): number { return this.allProcesses().filter(p => p.status === 'CANCELLED').length; }

  private processesByPolicy(): { name: string; count: number }[] {
    const map = new Map<string, number>();
    for (const p of this.allProcesses()) {
      const name = p.policyName || 'Sin nombre';
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }
  chartHeightByPolicy(): number { return Math.max(180, this.processesByPolicy().length * 32 + 40); }

  readonly periods = [
    { value: 'DAILY', label: 'Hoy' },
    { value: 'WEEKLY', label: 'Semana' },
    { value: 'MONTHLY', label: 'Mes' },
  ];

  policyName(): string {
    return this.policies().find(p => p.id === this.selectedPolicyId)?.name ?? '';
  }
  chartHeightBottleneck(): number { return Math.max(200, this.bottlenecks().length * 36 + 40); }
  chartHeightEmployees(): number { return Math.max(200, this.employeePerf().length * 32 + 40); }
  chartHeightCriticalNodes(): number { return Math.max(160, this.dlCriticalNodes().length * 34 + 40); }

  dlAvgScore(): number {
    const instances = this.riskData()?.instances ?? [];
    if (!instances.length) return 0;
    return instances.reduce((s, i) => s + i.riskScore, 0) / instances.length;
  }

  dlTopDrivers(): { label: string; count: number }[] {
    const freq: Record<string, number> = {};
    const anomalous = (this.riskData()?.instances ?? []).filter(i => i.anomaly);
    for (const inst of anomalous) {
      for (const d of inst.drivers) { freq[d] = (freq[d] ?? 0) + 1; }
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({ label: DRIVER_LABELS[key] ?? key, count }));
  }

  /** Nodes where the model detects risk RIGHT NOW: anomalous active instances grouped by node. */
  dlCriticalNodes(): { label: string; count: number }[] {
    const freq: Record<string, number> = {};
    for (const i of (this.riskData()?.instances ?? [])) {
      if (i.anomaly) {
        const label = i.currentNodeLabel || i.currentNodeId || '—';
        freq[label] = (freq[label] ?? 0) + 1;
      }
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, count]) => ({ label, count }));
  }

  ngOnInit(): void { this.reload(); }
  ngAfterViewInit(): void { /* charts are built after data loads */ }

  ngOnDestroy(): void {
    this.charts.forEach(c => { try { c.destroy(); } catch { /* ignore */ } });
  }

  reload(): void {
    this.loading.set(true);
    this.http.get<PolicyResponse[]>(`${this.API}/policies/active`).subscribe({ next: p => this.policies.set(p) });
    this.http.get<BottleneckResponse[]>(`${this.API}/analytics/bottlenecks`).subscribe({
      next: d => { this.bottlenecks.set(d); this.loading.set(false); this.rebuildCharts(); },
      error: () => this.loading.set(false),
    });
    this.http.get<EmployeePerf[]>(`${this.API}/analytics/employee-performance`).subscribe({
      next: d => { this.employeePerf.set(d); this.rebuildCharts(); },
    });
    // Global process distribution (all trámites)
    this.http.get<ProcessStatusResponse[]>(`${this.API}/processes`).subscribe({
      next: d => { this.allProcesses.set(d); this.rebuildCharts(); },
    });
  }

  onPolicyChange(policyId: string): void {
    if (!policyId) {
      this.dashboard.set(null); this.throughput.set(null);
      this.sla.set([]); this.abandonment.set(null);
      this.riskData.set(null); this.dlAvailable.set(false);
      return;
    }
    this.loading.set(true);
    this.http.get<Dashboard>(`${this.API}/analytics/dashboard/${policyId}`).subscribe({
      next: d => { this.dashboard.set(d); this.loading.set(false); this.rebuildCharts(); },
      error: () => this.loading.set(false),
    });
    this.http.get<SlaCompliance[]>(`${this.API}/analytics/sla/${policyId}`).subscribe({
      next: d => { this.sla.set(d); this.rebuildCharts(); },
    });
    this.http.get<Abandonment>(`${this.API}/analytics/abandonment/${policyId}`).subscribe({
      next: d => { this.abandonment.set(d); this.rebuildCharts(); },
    });
    this.loadThroughput(this.throughputPeriod());
    // DL: call risk engine
    this.http.get<PolicyRisk>(`${this.API}/risk/policy/${policyId}`).subscribe({
      next: r => { this.riskData.set(r); this.dlAvailable.set(true); this.rebuildCharts(); },
      error: () => { this.riskData.set(null); this.dlAvailable.set(false); },
    });
  }

  loadThroughput(period: string): void {
    if (!this.selectedPolicyId) return;
    this.throughputPeriod.set(period);
    this.http.get<Throughput>(`${this.API}/analytics/throughput/${this.selectedPolicyId}?period=${period}`)
      .subscribe({ next: d => { this.throughput.set(d); this.rebuildCharts(); } });
  }

  private canvas(id: string): HTMLCanvasElement | null {
    return document.getElementById(`ibpms-${id}`) as HTMLCanvasElement | null;
  }

  private destroyCharts(): void {
    this.charts.forEach(c => { try { c.destroy(); } catch { /**/ } });
    this.charts = [];
  }

  private rebuildCharts(): void {
    this.cdr.detectChanges();   // flush signal changes to DOM
    setTimeout(() => {
      this.destroyCharts();
      this.buildGlobalDistChart();
      this.buildByPolicyChart();
      this.buildBottleneckChart();
      this.buildEmployeeChart();
      this.buildThroughputChart();
      this.buildSlaChart();
      this.buildAbandonmentChart();
      this.buildDlAnomalyChart();
      this.buildDlPriorityChart();
      this.buildDlDriversChart();
      this.buildDlCriticalNodesChart();
    }, 60);
  }

  // ── Chart builders ────────────────────────────────────────────────────────

  private buildGlobalDistChart(): void {
    if (this.selectedPolicyId || this.globalTotal() === 0) return;
    const el = this.canvas('chartGlobalDist');
    if (!el) return;
    this.charts.push(new Chart(el, {
      type: 'doughnut',
      data: {
        labels: ['En curso', 'Completados', 'Cancelados'],
        datasets: [{
          data: [this.globalActive(), this.globalCompleted(), this.globalCancelled()],
          backgroundColor: ['rgba(255,152,0,0.8)', 'rgba(76,175,80,0.8)', 'rgba(244,67,54,0.8)'],
          borderWidth: 1,
        }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
    }));
  }

  private buildByPolicyChart(): void {
    if (this.selectedPolicyId || this.globalTotal() === 0) return;
    const el = this.canvas('chartByPolicy');
    if (!el) return;
    const data = this.processesByPolicy();
    this.charts.push(new Chart(el, {
      type: 'bar',
      data: {
        labels: data.map(d => d.name),
        datasets: [{
          label: 'Trámites',
          data: data.map(d => d.count),
          backgroundColor: 'rgba(25,118,210,0.75)',
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    }));
  }

  private buildBottleneckChart(): void {
    const data = this.bottlenecks().slice(0, 10);
    if (!data.length) return;
    const el = this.canvas('chartBottleneck');
    if (!el) return;

    // Inline plugin: dibuja la duración humanizada al final de cada barra
    const durationLabelPlugin = {
      id: 'durationLabels',
      afterDatasetsDraw(chart: Chart) {
        const ctx = chart.ctx;
        ctx.save();
        chart.data.datasets.forEach((dataset, i) => {
          const meta = chart.getDatasetMeta(i);
          meta.data.forEach((bar, index) => {
            const value = dataset.data[index] as number;
            if (value == null) return;
            const label = formatDuration(value);
            ctx.fillStyle = '#1e293b';
            ctx.font = '600 11px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            // bar.x = extremo derecho de la barra; bar.y = centro vertical
            ctx.fillText(label, bar.x + 5, (bar as any).y);
          });
        });
        ctx.restore();
      },
    };

    this.charts.push(new Chart(el, {
      type: 'bar',
      data: {
        labels: data.map(b => b.nodeLabel || b.nodeId),
        datasets: [{
          label: 'Duración promedio',
          data: data.map(b => b.averageDurationHours),
          backgroundColor: 'rgba(25,118,210,0.7)',
          borderColor: '#1976d2', borderWidth: 1,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 70 } },   // espacio para la etiqueta humanizada
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const hours = ctx.parsed.x as number;
                return ` ${formatDuration(hours)}  (${hours.toFixed(2)} h)`;
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            title: { display: true, text: 'horas' },
            ticks: {
              callback: (value) => `${value} h`,
            },
          },
        },
      },
      plugins: [durationLabelPlugin],
    }));
  }

  private buildEmployeeChart(): void {
    const data = this.employeePerf().slice(0, 12);
    if (!data.length) return;
    const el = this.canvas('chartEmployees');
    if (!el) return;
    const colors = data.map(e =>
      e.performanceLevel === 'GOOD' ? 'rgba(76,175,80,0.8)'
        : e.performanceLevel === 'POOR' ? 'rgba(244,67,54,0.8)'
        : 'rgba(255,152,0,0.8)'
    );
    this.charts.push(new Chart(el, {
      type: 'bar',
      data: {
        labels: data.map(e => e.username),
        datasets: [{ label: 'Ratio vs global', data: data.map(e => e.performanceRatio), backgroundColor: colors }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } },
      },
    }));
  }

  private buildThroughputChart(): void {
    const t = this.throughput();
    if (!t) return;
    const el = this.canvas('chartThroughput');
    if (!el) return;
    this.charts.push(new Chart(el, {
      type: 'bar',
      data: {
        labels: ['Iniciados', 'Completados', 'Cancelados'],
        datasets: [{
          label: 'Trámites',
          data: [t.initiated, t.completed, t.cancelled],
          backgroundColor: ['rgba(33,150,243,0.7)', 'rgba(76,175,80,0.7)', 'rgba(244,67,54,0.7)'],
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    }));
  }

  private buildSlaChart(): void {
    const data = this.sla();
    if (!data.length) return;
    const el = this.canvas('chartSla');
    if (!el) return;
    this.charts.push(new Chart(el, {
      type: 'bar',
      data: {
        labels: data.map(s => s.nodeLabel),
        datasets: [
          {
            label: '% Cumplimiento SLA',
            data: data.map(s => s.complianceRate),
            backgroundColor: data.map(s => s.complianceRate >= 80 ? 'rgba(76,175,80,0.7)' : 'rgba(244,67,54,0.7)'),
          },
          {
            label: 'Umbral 80%',
            data: data.map(() => 80),
            type: 'line' as const,
            borderColor: '#f44336',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          } as never,
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true, max: 100 } },
      },
    }));
  }

  private buildAbandonmentChart(): void {
    const ab = this.abandonment();
    if (!ab) return;
    const el = this.canvas('chartAbandonment');
    if (!el) return;
    this.charts.push(new Chart(el, {
      type: 'doughnut',
      data: {
        labels: ['Completados', 'Cancelados'],
        datasets: [{
          data: [ab.completed, ab.cancelled],
          backgroundColor: ['rgba(76,175,80,0.8)', 'rgba(244,67,54,0.8)'],
          borderWidth: 1,
        }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
    }));
  }

  private buildDlAnomalyChart(): void {
    const r = this.riskData();
    if (!r || !this.dlAvailable()) return;
    const el = this.canvas('chartDlAnomaly');
    if (!el) return;
    const normal = r.assessedCount - r.anomalies;
    this.charts.push(new Chart(el, {
      type: 'doughnut',
      data: {
        labels: ['Normal', 'Anomalía detectada'],
        datasets: [{
          data: [normal, r.anomalies],
          backgroundColor: ['rgba(76,175,80,0.8)', 'rgba(244,67,54,0.8)'],
          borderWidth: 1,
        }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
    }));
  }

  private buildDlPriorityChart(): void {
    const r = this.riskData();
    if (!r || !this.dlAvailable()) return;
    const el = this.canvas('chartDlPriority');
    if (!el) return;
    const high = r.instances.filter(i => i.priority === 'HIGH').length;
    const medium = r.instances.filter(i => i.priority === 'MEDIUM').length;
    const low = r.instances.filter(i => i.priority === 'LOW').length;
    this.charts.push(new Chart(el, {
      type: 'bar',
      data: {
        labels: ['🔴 HIGH', '🟡 MEDIUM', '🟢 LOW'],
        datasets: [{
          label: 'Instancias',
          data: [high, medium, low],
          backgroundColor: ['rgba(244,67,54,0.8)', 'rgba(255,152,0,0.8)', 'rgba(76,175,80,0.8)'],
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    }));
  }

  private buildDlCriticalNodesChart(): void {
    const data = this.dlCriticalNodes();
    if (!data.length || !this.dlAvailable()) return;
    const el = this.canvas('chartDlCriticalNodes');
    if (!el) return;
    this.charts.push(new Chart(el, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          label: 'Trámites en riesgo ahora',
          data: data.map(d => d.count),
          backgroundColor: 'rgba(220,38,38,0.75)',
          borderColor: '#dc2626', borderWidth: 1,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    }));
  }

  private buildDlDriversChart(): void {
    const drivers = this.dlTopDrivers();
    if (!drivers.length || !this.dlAvailable()) return;
    const el = this.canvas('chartDlDrivers');
    if (!el) return;
    this.charts.push(new Chart(el, {
      type: 'bar',
      data: {
        labels: drivers.map(d => d.label),
        datasets: [{
          label: 'Frecuencia en anomalías',
          data: drivers.map(d => d.count),
          backgroundColor: 'rgba(25,118,210,0.75)',
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    }));
  }
}
