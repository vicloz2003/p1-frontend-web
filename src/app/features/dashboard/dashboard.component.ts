import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../core/auth/auth.service';
import { WebSocketService } from '../../core/websocket/websocket.service';
import { TaskResponse, TaskNotificationDto } from '../../core/models/responses';

@Component({
  selector: 'app-dashboard',
  imports: [
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    MatBadgeModule,
    DatePipe,
  ],
  template: `
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Mis Tareas</h1>
        <p class="page-subtitle">{{ auth.currentUser()?.username }} · Funcionario</p>
      </div>
      <button class="btn-icon" (click)="onRefresh()" [disabled]="loading()" matTooltip="Actualizar"
              [matBadge]="hasNewTask() ? '!' : null" matBadgeColor="warn">
        <mat-icon>refresh</mat-icon>
      </button>
    </div>

    @if (loading()) {
      <div style="height:3px; overflow:hidden; background:#eff6ff;">
        <div class="loading-bar" style="height:100%;"></div>
      </div>
    }

    <div style="padding:24px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; align-items:start;">

      <!-- ══ DISPONIBLES ══ -->
      <div>
        <div class="col-head">
          <span class="col-dot" style="background:#2563eb;"></span>
          <mat-icon style="color:#2563eb;">inbox</mat-icon>
          <h2>Disponibles</h2>
          <span class="col-count" style="background:#eff6ff; color:#2563eb;">{{ pendingTasks().length }}</span>
        </div>

        @for (task of pendingTasks(); track task.id) {
          <div class="task-card" style="border-left:3px solid #2563eb;">
            <p class="task-node">{{ task.nodeLabel || task.nodeId }}</p>
            <p class="task-policy">{{ task.policyName || 'Trámite' }}</p>
            @if (task.clientName) {
              <p class="task-meta" style="color:#475569;">
                <mat-icon class="meta-ic">person</mat-icon>
                {{ task.clientName }}
              </p>
            }
            <p class="task-meta">
              <mat-icon class="meta-ic">schedule</mat-icon>
              {{ task.assignedAt | date:'dd/MM HH:mm' }}
            </p>
            <button class="btn btn-primary" style="width:100%; margin-top:10px; justify-content:center;"
                    (click)="claimTask(task)" [disabled]="claiming() === task.id">
              @if (claiming() === task.id) { Reclamando… }
              @else { <mat-icon>assignment_ind</mat-icon> Reclamar }
            </button>
          </div>
        }
        @if (!loading() && pendingTasks().length === 0) {
          <div class="empty-col"><mat-icon>done_all</mat-icon><span>Nada por reclamar</span></div>
        }
      </div>

      <!-- ══ EN PROGRESO ══ -->
      <div>
        <div class="col-head">
          <span class="col-dot" style="background:#f59e0b;"></span>
          <mat-icon style="color:#f59e0b;">pending_actions</mat-icon>
          <h2>En progreso</h2>
          <span class="col-count" style="background:#fffbeb; color:#d97706;">{{ inProgressTasks().length }}</span>
        </div>

        @for (task of inProgressTasks(); track task.id) {
          <div class="task-card task-active" style="border-left:3px solid #f59e0b;">
            <p class="task-node">{{ task.nodeLabel || task.nodeId }}</p>
            <p class="task-policy">{{ task.policyName || 'Trámite' }}</p>
            @if (task.clientName) {
              <p class="task-meta" style="color:#475569;">
                <mat-icon class="meta-ic">person</mat-icon>
                {{ task.clientName }}
              </p>
            }
            <p class="task-meta">
              <mat-icon class="meta-ic">schedule</mat-icon>
              Asignado: {{ task.assignedAt | date:'dd/MM HH:mm' }}
            </p>
            @if (task.claimedAt) {
              <p class="task-meta" style="color:#c2410c;">
                <mat-icon class="meta-ic">person_pin</mat-icon>
                Reclamado: {{ task.claimedAt | date:'dd/MM HH:mm' }}
              </p>
            }
            <button class="btn btn-complete" style="width:100%; margin-top:10px; justify-content:center;"
                    (click)="router.navigate(['/task', task.id], { state: { task } })">
              <mat-icon>edit_note</mat-icon> Completar
            </button>
          </div>
        }
        @if (!loading() && inProgressTasks().length === 0) {
          <div class="empty-col"><mat-icon>task_alt</mat-icon><span>Nada en progreso</span></div>
        }
      </div>

      <!-- ══ COMPLETADAS (colapsada) ══ -->
      <div>
        <div class="col-head">
          <span class="col-dot" style="background:#16a34a;"></span>
          <mat-icon style="color:#16a34a;">task_alt</mat-icon>
          <h2>Completadas</h2>
          <span class="col-count" style="background:#f0fdf4; color:#16a34a;">{{ completedTasks().length }}</span>
        </div>

        @for (task of visibleCompleted(); track task.id) {
          <div class="task-card task-done">
            <div style="display:flex; align-items:center; gap:8px;">
              <mat-icon style="color:#16a34a; font-size:18px; width:18px; height:18px;">check_circle</mat-icon>
              <div style="flex:1; min-width:0;">
                <p class="task-node" style="font-size:0.9rem; margin:0;">{{ task.nodeLabel || task.nodeId }}</p>
                <p class="task-policy" style="margin:1px 0 0;">{{ task.policyName }}</p>
                @if (task.clientName) {
                  <p class="task-meta" style="font-size:0.75rem; margin:2px 0 0; color:#64748b;">
                    <mat-icon class="meta-ic" style="font-size:12px; width:12px; height:12px;">person</mat-icon>
                    {{ task.clientName }}
                  </p>
                }
              </div>
              <span style="font-size:0.72rem; color:#94a3b8; white-space:nowrap;">
                {{ task.assignedAt | date:'dd/MM' }}
              </span>
            </div>
          </div>
        }

        @if (completedTasks().length > collapsedLimit) {
          <button class="btn btn-ghost" style="width:100%; justify-content:center; margin-top:4px;"
                  (click)="showAllCompleted.set(!showAllCompleted())">
            @if (showAllCompleted()) {
              <mat-icon>expand_less</mat-icon> Ver menos
            } @else {
              <mat-icon>expand_more</mat-icon> Ver todas ({{ completedTasks().length }})
            }
          </button>
        }
        @if (!loading() && completedTasks().length === 0) {
          <div class="empty-col"><mat-icon>hourglass_empty</mat-icon><span>Aún sin completar</span></div>
        }
      </div>

    </div>
  `,
  styles: [`
    .col-head { display:flex; align-items:center; gap:8px; margin-bottom:14px; }
    .col-head h2 { margin:0; font-family:var(--font-display); font-size:1.02rem; font-weight:700; color:#0f172a; }
    .col-head mat-icon { font-size:20px; width:20px; height:20px; }
    .col-dot { width:8px; height:8px; border-radius:50%; }
    .col-count { margin-left:auto; font-size:0.78rem; font-weight:700; padding:2px 9px; border-radius:20px; }
    .task-card { background:#fff; border:1px solid var(--card-border); border-radius:10px;
                 padding:14px; margin-bottom:10px; }
    .task-active { box-shadow:0 2px 10px rgba(245,158,11,0.10); }
    .task-done { padding:10px 12px; background:#fafdfb; }
    .task-node { margin:0; font-weight:700; font-size:0.95rem; color:#0f172a;
                 font-family:var(--font-display); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .task-policy { margin:2px 0 0; font-size:0.8rem; color:#2563eb; font-weight:600;
                   overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .task-meta { margin:8px 0 0; font-size:0.78rem; color:#64748b; display:flex; align-items:center; gap:5px; }
    .meta-ic { font-size:14px !important; width:14px !important; height:14px !important; }
    .btn-complete { background:#f59e0b; color:#fff; }
    .btn-complete:hover { background:#d97706; }
    .empty-col { text-align:center; padding:36px 16px; color:#94a3b8;
                 border:1px dashed var(--card-border); border-radius:10px; }
    .empty-col mat-icon { font-size:40px; width:40px; height:40px; color:#cbd5e1; }
    .empty-col span { display:block; margin-top:8px; font-size:0.85rem; }
  `],
  changeDetection: ChangeDetectionStrategy.Default,
})
export class DashboardComponent implements OnInit, OnDestroy {
  protected readonly http = inject(HttpClient);
  protected readonly ws = inject(WebSocketService);
  protected readonly auth = inject(AuthService);
  protected readonly snack = inject(MatSnackBar);
  protected readonly dialog = inject(MatDialog);
  protected readonly router = inject(Router);

  private readonly API = environment.apiUrl;
  private subs: Subscription[] = [];

  readonly tasks = signal<TaskResponse[]>([]);
  readonly loading = signal(false);
  readonly claiming = signal<string | null>(null);

  readonly pendingTasks = computed(() =>
    this.tasks().filter(t => t.status === 'PENDING')
  );
  readonly inProgressTasks = computed(() =>
    this.tasks().filter(t => t.status === 'IN_PROGRESS')
  );
  readonly completedTasks = computed(() =>
    this.tasks().filter(t => t.status === 'COMPLETED')
  );
  readonly hasNewTask = signal(false);

  // Completed column starts collapsed so it never buries the actionable columns.
  readonly collapsedLimit = 5;
  readonly showAllCompleted = signal(false);
  readonly visibleCompleted = computed(() => {
    const all = this.completedTasks();
    return this.showAllCompleted() ? all : all.slice(0, this.collapsedLimit);
  });

  ngOnInit(): void {
    this.loadTasks();
    this.subscribeWebSocket();
  }

  onRefresh(): void {
    this.hasNewTask.set(false);
    this.loadTasks();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  loadTasks(): void {
    this.loading.set(true);
    this.http.get<TaskResponse[]>(`${this.API}/tasks/my`).subscribe({
      next: data => {
        this.tasks.set([...data]); // nueva referencia fuerza re-render
        this.loading.set(false);
        this.hasNewTask.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  claimTask(task: TaskResponse): void {
    this.claiming.set(task.id);
    this.http.post<TaskResponse>(`${this.API}/tasks/${task.id}/claim`, {}).subscribe({
      next: response => {
        this.tasks.update(list =>
          list.map(t => (t.id === task.id ? response : t))
        );
        this.claiming.set(null);
        this.snack.open('Tarea reclamada', 'OK', { duration: 3000 });
      },
      error: () => {
        this.claiming.set(null);
        this.snack.open('Error al reclamar la tarea', 'OK', { duration: 3000 });
      },
    });
  }

  private subscribeWebSocket(): void {
    const user = this.auth.currentUser();
    if (!user) return;

    if (user.departmentId) {
      const s1 = this.ws
        .subscribe<TaskNotificationDto>(`/topic/department/${user.departmentId}`)
        .subscribe(notification => {
          this.hasNewTask.set(true);
          this.snack.open(
            `Nueva tarea: ${notification.nodeLabel} — ${notification.policyName}`,
            'OK',
            { duration: 5000 }
          );
          this.loadTasks();
        });
      this.subs.push(s1);
    }

    const s2 = this.ws
      .subscribe<TaskNotificationDto>(`/queue/user/${user.userId}`)
      .subscribe(() => this.loadTasks());
    this.subs.push(s2);
  }
}
