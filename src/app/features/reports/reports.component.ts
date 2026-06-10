import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';
import { AgentService } from '../../core/services/agent.service';

interface ReportSpec {
  title: string;
  dataset: string;
  metrics: string[];
  groupBy: string | null;
  filterStatus: string | null;
  format: string;
  interpretedBy: string;
}

interface ReportTable {
  title: string;
  headers: string[];
  rows: string[][];
}

interface ReportScreenResponse {
  spec: ReportSpec;
  table: ReportTable;
}

const FORMAT_OPTIONS = [
  { value: 'SCREEN', label: 'Pantalla', icon: 'monitor' },
  { value: 'EXCEL', label: 'Excel (.xlsx)', icon: 'table_chart' },
  { value: 'PDF',   label: 'PDF',         icon: 'picture_as_pdf' },
  { value: 'WORD',  label: 'Word (.docx)', icon: 'description' },
];

const EXAMPLES = [
  'tareas completadas por departamento',
  'procesos activos con más tiempo de espera',
  'políticas activas y su tasa de abandono',
  'resumen de todos los procesos del último mes',
];

@Component({
  selector: 'app-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatToolbarModule, MatButtonModule, MatIconModule, MatCardModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatChipsModule, MatProgressSpinnerModule, MatTableModule,
    MatTooltipModule, MatSnackBarModule,
  ],
  template: `
    <mat-toolbar color="primary">
      <mat-icon style="margin-right:8px;">auto_awesome</mat-icon>
      <span>Reportes Dinámicos — NL → Gemini → Datos</span>
    </mat-toolbar>

    <div style="max-width:860px; margin:0 auto; padding:24px;">

      <!-- Info banner -->
      <mat-card appearance="outlined" style="margin-bottom:24px;
                background:linear-gradient(135deg,#00695c08,#00897b14);">
        <mat-card-content style="padding:16px; display:flex; align-items:center; gap:16px;">
          <mat-icon style="font-size:36px; width:36px; height:36px; color:#00897b;">
            smart_toy
          </mat-icon>
          <div>
            <p style="margin:0; font-weight:600;">
              Describe en lenguaje natural qué datos necesitas
            </p>
            <p style="margin:4px 0 0; font-size:0.82rem; color:var(--mat-sys-on-surface-variant);">
              Gemini interpreta tu instrucción y genera el reporte automáticamente.
              Puedes pedir el resultado en pantalla o descargar Excel, PDF o Word.
            </p>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Input -->
      <mat-card appearance="outlined" style="margin-bottom:24px;">
        <mat-card-content style="padding:20px;">

          <mat-form-field style="width:100%;" appearance="outline">
            <mat-label>Instrucción en lenguaje natural</mat-label>
            <textarea matInput [(ngModel)]="instruction" rows="3"
                      [placeholder]="recording() ? 'Grabando… habla tu solicitud' : transcribing() ? 'Transcribiendo audio…' : 'Ej: muéstrame las tareas completadas por departamento este mes'"></textarea>
            <button matSuffix mat-icon-button
                    [matTooltip]="recording() ? 'Detener y transcribir' : 'Dictar por voz (Whisper)'"
                    [disabled]="transcribing() || loading()"
                    [style.color]="recording() ? '#f44336' : 'var(--mat-sys-primary)'"
                    (click)="toggleRecording()">
              @if (transcribing()) {
                <mat-progress-spinner diameter="22" mode="indeterminate"></mat-progress-spinner>
              } @else {
                <mat-icon>{{ recording() ? 'stop_circle' : 'mic' }}</mat-icon>
              }
            </button>
          </mat-form-field>
          @if (recording()) {
            <p style="margin:-8px 0 12px; font-size:0.78rem; color:#f44336; display:flex; align-items:center; gap:6px;">
              <mat-icon style="font-size:16px; width:16px; height:16px;">graphic_eq</mat-icon>
              Grabando… vuelve a tocar el micrófono para transcribir con NLP/Deep Learning
            </p>
          }

          <!-- Ejemplos rápidos -->
          <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;">
            <span style="font-size:0.78rem; color:var(--mat-sys-on-surface-variant);
                         align-self:center;">Ejemplos:</span>
            @for (ex of examples; track ex) {
              <mat-chip (click)="instruction = ex" style="cursor:pointer; font-size:0.75rem;">
                {{ ex }}
              </mat-chip>
            }
          </div>

          <!-- Formato -->
          <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
            <mat-form-field appearance="outline" style="min-width:200px;">
              <mat-label>Formato de salida</mat-label>
              <mat-select [(ngModel)]="format">
                @for (f of formats; track f.value) {
                  <mat-option [value]="f.value">
                    <mat-icon style="vertical-align:middle; font-size:18px; margin-right:6px;">
                      {{ f.icon }}
                    </mat-icon>
                    {{ f.label }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            <button mat-flat-button color="primary" style="height:56px; padding:0 24px;"
                    [disabled]="!instruction.trim() || loading()"
                    (click)="generate()">
              @if (loading()) {
                <mat-progress-spinner diameter="22" mode="indeterminate"
                  style="display:inline-block; margin-right:8px;"></mat-progress-spinner>
                Generando…
              } @else {
                <mat-icon>send</mat-icon> Generar reporte
              }
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Spec interpretada por Gemini -->
      @if (lastSpec(); as spec) {
        <mat-card appearance="outlined" style="margin-bottom:16px; border-left:4px solid #00897b;">
          <mat-card-content style="padding:14px 16px;">
            <p style="margin:0; font-size:0.78rem; font-weight:600;
                      color:#00897b; text-transform:uppercase; letter-spacing:.06em;">
              Gemini interpretó tu instrucción como:
            </p>
            <p style="margin:6px 0 0; font-size:0.88rem;">
              <strong>{{ spec.title }}</strong>
              &nbsp;·&nbsp; dataset: <code>{{ spec.dataset }}</code>
              &nbsp;·&nbsp; métricas: <code>{{ spec.metrics.join(', ') }}</code>
              @if (spec.groupBy) {
                &nbsp;·&nbsp; agrupado por: <code>{{ spec.groupBy }}</code>
              }
              @if (spec.filterStatus) {
                &nbsp;·&nbsp; filtro: <code>{{ spec.filterStatus }}</code>
              }
            </p>
          </mat-card-content>
        </mat-card>
      }

      <!-- Resultado en pantalla -->
      @if (screenResult(); as r) {
        <mat-card appearance="outlined">
          <mat-card-header style="padding:16px 16px 0;">
            <mat-card-title>{{ r.table.title }}</mat-card-title>
          </mat-card-header>
          <mat-card-content style="padding:16px; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr style="background:var(--mat-sys-surface-variant);">
                  @for (h of r.table.headers; track h) {
                    <th style="padding:10px 14px; text-align:left; font-size:0.82rem;
                               font-weight:600; white-space:nowrap;">
                      {{ h }}
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of r.table.rows; track $index) {
                  <tr style="border-bottom:1px solid var(--mat-sys-outline-variant);"
                      [style.background]="$index % 2 === 0 ? 'transparent' : 'var(--mat-sys-surface-variant)'">
                    @for (cell of row; track $index) {
                      <td style="padding:10px 14px; font-size:0.85rem;">{{ cell }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
            @if (r.table.rows.length === 0) {
              <p style="text-align:center; color:var(--mat-sys-on-surface-variant);
                        padding:24px 0;">Sin datos para los filtros aplicados.</p>
            }
          </mat-card-content>
        </mat-card>
      }

    </div>
  `,
})
export class ReportsComponent {
  private readonly http = inject(HttpClient);
  private readonly snack = inject(MatSnackBar);
  private readonly agent = inject(AgentService);
  private readonly API = environment.apiUrl;

  instruction = '';
  format = 'SCREEN';

  readonly loading = signal(false);
  readonly screenResult = signal<ReportScreenResponse | null>(null);
  readonly lastSpec = signal<ReportSpec | null>(null);
  readonly recording = signal(false);
  readonly transcribing = signal(false);

  readonly formats = FORMAT_OPTIONS;
  readonly examples = EXAMPLES;

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  /** RF-4.2: el gerente dicta el reporte por voz → Whisper (DL) → texto → NLP (Gemini). */
  async toggleRecording(): Promise<void> {
    if (this.recording()) {
      this.mediaRecorder?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data);
      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.transcribeAudio(blob);
      };
      this.mediaRecorder.start();
      this.recording.set(true);
    } catch {
      this.snack.open('No se pudo acceder al micrófono', 'OK', { duration: 3000 });
    }
  }

  private transcribeAudio(blob: Blob): void {
    this.recording.set(false);
    this.transcribing.set(true);
    this.agent.transcribe(blob).subscribe({
      next: text => {
        this.transcribing.set(false);
        this.instruction = (this.instruction ? this.instruction + ' ' : '') + text;
        if (!text.trim()) {
          this.snack.open('No se detectó voz. Intenta de nuevo.', 'OK', { duration: 3000 });
        }
      },
      error: () => {
        this.transcribing.set(false);
        this.snack.open('No se pudo transcribir el audio', 'OK', { duration: 3000 });
      },
    });
  }

  generate(): void {
    if (!this.instruction.trim()) return;
    this.loading.set(true);
    this.screenResult.set(null);
    this.lastSpec.set(null);

    if (this.format === 'SCREEN') {
      this.http.post<ReportScreenResponse>(`${this.API}/reports/generate`, {
        instruction: this.instruction,
        format: 'SCREEN',
      }).subscribe({
        next: r => {
          this.lastSpec.set(r.spec);
          this.screenResult.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.snack.open('Error al generar el reporte', 'OK', { duration: 3000 });
          this.loading.set(false);
        },
      });
    } else {
      // Descarga de archivo
      this.http.post(`${this.API}/reports/generate`,
        { instruction: this.instruction, format: this.format },
        { responseType: 'blob', observe: 'response' }
      ).subscribe({
        next: resp => {
          this.loading.set(false);
          const cd = resp.headers.get('Content-Disposition') ?? '';
          const match = cd.match(/filename="?([^"]+)"?/);
          const ext = { EXCEL: '.xlsx', PDF: '.pdf', WORD: '.docx' }[this.format] ?? '.bin';
          const fileName = match?.[1] ?? `reporte${ext}`;
          const blob = resp.body!;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = fileName; a.click();
          URL.revokeObjectURL(url);
          this.snack.open(`Descargando ${fileName}`, 'OK', { duration: 3000 });
        },
        error: () => {
          this.snack.open('Error al generar el archivo', 'OK', { duration: 3000 });
          this.loading.set(false);
        },
      });
    }
  }
}
