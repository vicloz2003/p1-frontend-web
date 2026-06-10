import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProcessStatusResponse } from '../../core/models/responses';
import { environment } from '../../../environments/environment';

type Filter = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ALL';

@Component({
  selector: 'app-process-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatIconModule, MatTooltipModule],
  template: `
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Trámites</h1>
        <p class="page-subtitle">Seguimiento de todos los trámites en el sistema</p>
      </div>
      <button class="btn-icon" (click)="ngOnInit()" matTooltip="Actualizar">
        <mat-icon>refresh</mat-icon>
      </button>
    </div>

    @if (loading()) {
      <div style="height:3px; overflow:hidden; background:#eff6ff;">
        <div class="loading-bar" style="height:100%;"></div>
      </div>
    }

    <div style="max-width:1000px; margin:0 auto; padding:24px;">

      <!-- Buscador -->
      <div style="position:relative; margin-bottom:16px; max-width:420px;">
        <mat-icon style="position:absolute; left:12px; top:50%; transform:translateY(-50%);
                         color:#94a3b8; font-size:20px; width:20px; height:20px;">search</mat-icon>
        <input [(ngModel)]="searchText" placeholder="Buscar por política o cliente…"
               style="width:100%; padding:10px 12px 10px 40px; border:1px solid var(--card-border);
                      border-radius:10px; font:inherit; font-size:0.9rem; outline:none; background:#fff;"/>
      </div>

      <!-- Chips de filtro -->
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px;">
        @for (f of filterDefs; track f.value) {
          <button (click)="filter.set(f.value)"
            [style.background]="filter() === f.value ? f.bg : '#fff'"
            [style.color]="filter() === f.value ? f.fg : '#475569'"
            [style.border]="'1px solid ' + (filter() === f.value ? f.fg : 'var(--card-border)')"
            style="display:inline-flex; align-items:center; gap:7px; padding:7px 14px;
                   border-radius:20px; font:inherit; font-size:0.82rem; font-weight:600;
                   cursor:pointer; transition:all .15s;">
            @if (f.dot) { <span style="width:7px; height:7px; border-radius:50%;"
                                [style.background]="f.fg"></span> }
            {{ f.label }}
            <span style="opacity:.7; font-weight:700;">{{ countOf(f.value) }}</span>
          </button>
        }
      </div>

      <!-- Lista -->
      @if (!loading() && filtered().length === 0) {
        <div class="card"><div class="card-body" style="text-align:center; padding:48px;">
          <mat-icon style="font-size:52px; width:52px; height:52px; color:#cbd5e1;">inbox</mat-icon>
          <p style="margin:12px 0 0; color:#64748b;">No hay trámites que coincidan.</p>
        </div></div>
      }

      @for (p of filtered(); track p.processInstanceId) {
        @let meta = statusMeta(p.status);
        <div class="card process-row" style="margin-bottom:12px; cursor:pointer;"
             (click)="open(p)">
          <div class="card-body" style="padding:16px 18px;">
            <!-- top row -->
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
              <span class="status-pill" [style.background]="meta.bg" [style.color]="meta.fg">
                <mat-icon style="font-size:14px; width:14px; height:14px;">{{ meta.icon }}</mat-icon>
                {{ meta.label }}
              </span>
              <span style="flex:1;"></span>
              <span style="font-size:0.75rem; color:#94a3b8;">{{ relativeTime(p.startedAt) }}</span>
              <mat-icon style="color:#cbd5e1;">chevron_right</mat-icon>
            </div>

            <!-- title -->
            <p style="margin:0 0 2px; font-family:var(--font-display); font-weight:700;
                      font-size:1.02rem; color:#0f172a;">{{ p.policyName }}</p>
            <p style="margin:0; font-size:0.78rem; color:#94a3b8;">
              <mat-icon style="font-size:13px; width:13px; height:13px; vertical-align:-2px;">badge</mat-icon>
              Cliente: {{ clientName(p.clientId) }}
            </p>

            <!-- active: stage + progress -->
            @if (p.status === 'ACTIVE') {
              <div style="margin-top:12px;">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                  <mat-icon style="font-size:14px; width:14px; height:14px; color:#64748b;">account_tree</mat-icon>
                  <span style="font-size:0.82rem; color:#334155;">Etapa: <strong>{{ p.currentNodeLabel || p.currentNodeId }}</strong></span>
                  @if (p.currentDepartmentName) {
                    <span style="font-size:0.75rem; color:#94a3b8;">· {{ p.currentDepartmentName }}</span>
                  }
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                  <div style="flex:1; height:7px; background:#f1f5f9; border-radius:5px; overflow:hidden;">
                    <div [style.width.%]="p.progressPercent" style="height:100%; background:#f59e0b; border-radius:5px; transition:width .3s;"></div>
                  </div>
                  <span style="font-size:0.78rem; font-weight:700; color:#d97706;">{{ p.progressPercent }}%</span>
                </div>
                @if (p.pendingClientAction) {
                  <div style="margin-top:8px; display:inline-flex; align-items:center; gap:6px;
                              padding:4px 10px; background:#fff7ed; border-radius:6px;">
                    <mat-icon style="font-size:14px; width:14px; height:14px; color:#ea580c;">assignment_late</mat-icon>
                    <span style="font-size:0.76rem; color:#c2410c;">{{ p.pendingClientAction }}</span>
                  </div>
                }
              </div>
            } @else {
              <p style="margin:10px 0 0; font-size:0.8rem; color:#64748b;">
                {{ meta.label }} · {{ formatDate(p.completedAt || p.startedAt) }}
              </p>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .status-pill {
      display:inline-flex; align-items:center; gap:5px;
      padding:3px 10px; border-radius:20px; font-size:0.72rem; font-weight:700;
    }
    .process-row { transition: box-shadow .15s, transform .15s; }
    .process-row:hover { box-shadow: 0 6px 20px rgba(15,23,42,0.08); transform: translateY(-1px); }
  `],
})
export class ProcessListComponent implements OnInit {
  private readonly http = inject(HttpClient);
  protected readonly router = inject(Router);
  private readonly API = environment.apiUrl;

  readonly processes = signal<ProcessStatusResponse[]>([]);
  readonly loading = signal(false);
  readonly filter = signal<Filter>('ACTIVE');
  searchText = '';

  private readonly userNames = signal<Map<string, string>>(new Map());

  readonly filterDefs: { value: Filter; label: string; fg: string; bg: string; dot: boolean }[] = [
    { value: 'ACTIVE',    label: 'En curso',    fg: '#d97706', bg: '#fffbeb', dot: true },
    { value: 'COMPLETED', label: 'Completados', fg: '#16a34a', bg: '#f0fdf4', dot: true },
    { value: 'CANCELLED', label: 'Cancelados',  fg: '#dc2626', bg: '#fef2f2', dot: true },
    { value: 'ALL',       label: 'Todos',       fg: '#2563eb', bg: '#eff6ff', dot: false },
  ];

  readonly filtered = computed(() => {
    const q = this.searchText.trim().toLowerCase();
    const f = this.filter();
    let list = this.processes();
    if (f !== 'ALL') list = list.filter(p => p.status === f);
    if (q) list = list.filter(p =>
      (p.policyName ?? '').toLowerCase().includes(q) ||
      this.clientName(p.clientId).toLowerCase().includes(q));
    return [...list].sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
  });

  countOf(f: Filter): number {
    if (f === 'ALL') return this.processes().length;
    return this.processes().filter(p => p.status === f).length;
  }

  ngOnInit(): void {
    this.loading.set(true);
    this.http.get<{ id: string; username: string; email: string }[]>(`${this.API}/users`).subscribe({
      next: list => {
        const m = new Map<string, string>();
        list.forEach(u => m.set(u.id, u.username || u.email));
        this.userNames.set(m);
      },
    });
    this.http.get<ProcessStatusResponse[]>(`${this.API}/processes`).subscribe({
      next: data => { this.processes.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  clientName(clientId: string | null): string {
    if (!clientId) return '—';
    return this.userNames().get(clientId) ?? `Cliente ${clientId.slice(-6)}`;
  }

  open(p: ProcessStatusResponse): void {
    this.router.navigate(['/processes', p.processInstanceId]);
  }

  statusMeta(s: string): { label: string; icon: string; fg: string; bg: string } {
    switch (s) {
      case 'ACTIVE':    return { label: 'En curso',   icon: 'pending',      fg: '#d97706', bg: '#fffbeb' };
      case 'COMPLETED': return { label: 'Completado', icon: 'check_circle', fg: '#16a34a', bg: '#f0fdf4' };
      default:          return { label: 'Cancelado',  icon: 'cancel',       fg: '#dc2626', bg: '#fef2f2' };
    }
  }

  relativeTime(iso: string): string {
    try {
      const d = Date.now() - new Date(iso).getTime();
      const days = Math.floor(d / 86400000);
      if (days >= 30) return `hace ${Math.floor(days / 30)} mes(es)`;
      if (days >= 1) return `hace ${days} día${days === 1 ? '' : 's'}`;
      const h = Math.floor(d / 3600000);
      if (h >= 1) return `hace ${h} h`;
      return 'recién';
    } catch { return ''; }
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('es', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  }
}
