import {
  ChangeDetectionStrategy, Component, OnInit, inject, signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';

interface ModelMetrics {
  name: string;
  task: string;
  architecture: string;
  trainSamples: number;
  testSamples: number;
  metrics: Record<string, unknown>;
  notes: string;
}
interface MetricsResponse { models: ModelMetrics[]; }

/**
 * Transparency panel for the DL engine: shows each model's architecture, train/test split and
 * evaluation metrics (accuracy, AUC, detection rate). Fail-silent — hidden if ML is unreachable.
 * Removable: delete this file and its usage in the risk view.
 */
@Component({
  selector: 'app-model-metrics-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    @if (models(); as list) {
      <div class="card" style="margin-bottom:20px;">
        <div style="padding:14px 20px; border-bottom:1px solid #e2e8f0; display:flex;
                    align-items:center; gap:8px; cursor:pointer;" (click)="expanded.set(!expanded())">
          <mat-icon style="color:#4f46e5;">model_training</mat-icon>
          <span style="font-family:'Sora',sans-serif; font-weight:700; font-size:0.92rem; color:#0f172a;">
            Métricas de los modelos DL
          </span>
          <span style="font-size:0.7rem; color:#64748b;">evaluación sobre test set</span>
          <mat-icon style="margin-left:auto; color:#94a3b8;">
            {{ expanded() ? 'expand_less' : 'expand_more' }}
          </mat-icon>
        </div>

        @if (expanded()) {
          <div style="padding:16px; display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px;">
            @for (m of list; track m.name) {
              <div style="border:1px solid #e2e8f0; border-radius:10px; padding:14px;">
                <div style="font-weight:700; font-size:0.86rem; color:#1e1b4b; margin-bottom:2px;">
                  {{ m.name }}
                </div>
                <div style="font-size:0.68rem; color:#6366f1; margin-bottom:8px;">{{ m.task }}</div>
                <div style="font-family:monospace; font-size:0.68rem; color:#64748b; margin-bottom:8px;">
                  {{ m.architecture }}
                </div>

                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
                  @for (kv of primaryMetrics(m); track kv[0]) {
                    <span style="padding:3px 9px; border-radius:6px; font-size:0.72rem; font-weight:700;
                                 background:#eef2ff; color:#4338ca;">
                      {{ kv[0] }}: {{ kv[1] }}
                    </span>
                  }
                </div>

                <div style="font-size:0.66rem; color:#94a3b8;">
                  train {{ m.trainSamples }} · test {{ m.testSamples }}
                </div>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
})
export class ModelMetricsPanelComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  readonly models = signal<ModelMetrics[] | null>(null);
  readonly expanded = signal(false);

  ngOnInit(): void {
    this.http.get<MetricsResponse>(`${this.API}/route/metrics`).subscribe({
      next: r => this.models.set(r?.models ?? null),
      error: () => this.models.set(null),
    });
  }

  /** Pick the headline metrics per model, formatted for display. */
  primaryMetrics(m: ModelMetrics): [string, string][] {
    const keys = ['accuracy', 'macroF1', 'auc', 'detectionRate', 'falsePositiveRate'];
    const out: [string, string][] = [];
    for (const k of keys) {
      const v = m.metrics[k];
      if (typeof v === 'number') out.push([k, v.toFixed(2)]);
    }
    return out;
  }
}
