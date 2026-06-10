import {
  ChangeDetectionStrategy, Component, OnInit, inject, input, signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';

interface BranchScore { branchId: string; label: string; probability: number; }
interface RouteAdvisory {
  processInstanceId: string;
  decisionNodeId: string;
  decisionNodeLabel: string;
  recommendedBranchId: string | null;
  recommendedLabel: string | null;
  confidence: number;
  confident: boolean;
  ranking: BranchScore[];
  rationale: string;
  modelInfo: string | null;
}

/**
 * Advisory "best route" card backed by the DL route predictor (RF-3.1). Self-loading and
 * fail-silent: if the node is not a decision point, or the user lacks the role, or the ML
 * service is down, the card simply renders nothing — it never blocks the page.
 *
 * Fully removable: delete this file and its single usage in process-status.
 */
@Component({
  selector: 'app-route-advisory-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatIconModule, MatTooltipModule],
  template: `
    @if (advice(); as a) {
      @if (a.ranking.length > 0) {
        <div style="border:1px solid #c7d2fe; border-radius:12px; overflow:hidden;
                    margin-bottom:24px; background:#f5f7ff;">

          <!-- Header -->
          <div style="display:flex; align-items:center; gap:8px; padding:12px 16px;
                      background:#eef2ff; border-bottom:1px solid #c7d2fe;">
            <mat-icon style="color:#4f46e5;">psychology</mat-icon>
            <span style="font-weight:700; color:#3730a3; font-size:0.92rem;">
              Sugerencia del motor inteligente
            </span>
            <span style="margin-left:auto; font-size:0.62rem; font-weight:700; letter-spacing:0.04em;
                         padding:2px 7px; border-radius:5px; background:#4f46e5; color:#fff;">
              DEEP LEARNING
            </span>
          </div>

          <div style="padding:16px;">
            <div style="font-size:0.72rem; color:#6366f1; margin-bottom:10px;">
              Decisión: {{ a.decisionNodeLabel }}
            </div>

            @if (a.confident && a.recommendedLabel) {
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                <mat-icon style="color:#4f46e5;">arrow_circle_right</mat-icon>
                <span style="font-weight:700; font-size:1.05rem; color:#1e1b4b;">
                  {{ a.recommendedLabel }}
                </span>
                <span style="margin-left:auto; font-weight:700; color:#4f46e5;">
                  {{ a.confidence * 100 | number:'1.0-0' }}%
                </span>
              </div>
            } @else {
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; color:#92400e;">
                <mat-icon style="color:#d97706;">help_outline</mat-icon>
                <span style="font-weight:600;">Sin recomendación clara</span>
              </div>
            }

            <p style="margin:0 0 14px; font-size:0.8rem; color:#475569; font-style:italic; line-height:1.4;">
              {{ a.rationale }}
            </p>

            <!-- Ranking de ramas -->
            <div style="display:flex; flex-direction:column; gap:7px;">
              @for (b of a.ranking; track b.branchId) {
                <div style="display:flex; align-items:center; gap:10px;">
                  <span style="font-size:0.76rem; min-width:140px; color:#334155;
                               font-weight:{{ b.branchId === a.recommendedBranchId ? '700' : '400' }};">
                    {{ b.label }}
                  </span>
                  <div style="flex:1; height:8px; border-radius:4px; background:#e0e7ff; overflow:hidden;">
                    <div style="height:100%; border-radius:4px; background:#6366f1;
                                width:{{ b.probability * 100 | number:'1.0-0' }}%;"></div>
                  </div>
                  <span style="font-size:0.74rem; min-width:34px; text-align:right; color:#475569;">
                    {{ b.probability * 100 | number:'1.0-0' }}%
                  </span>
                </div>
              }
            </div>

            <div style="display:flex; align-items:center; gap:6px; margin-top:14px;
                        padding-top:10px; border-top:1px dashed #c7d2fe;">
              <mat-icon style="font-size:15px; width:15px; height:15px; color:#94a3b8;">info</mat-icon>
              <span style="font-size:0.7rem; color:#94a3b8;">
                Orientativo — el funcionario decide la ruta. {{ a.modelInfo }}
              </span>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class RouteAdvisoryCardComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  /** The process instance to advise on. */
  readonly instanceId = input.required<string>();

  readonly advice = signal<RouteAdvisory | null>(null);

  ngOnInit(): void {
    const id = this.instanceId();
    if (!id) return;
    // Fail-silent: any error (403, not-a-decision, ML down) just leaves the card empty.
    this.http.get<RouteAdvisory>(`${this.API}/route/advise/${id}`).subscribe({
      next: a => this.advice.set(a),
      error: () => this.advice.set(null),
    });
  }
}
