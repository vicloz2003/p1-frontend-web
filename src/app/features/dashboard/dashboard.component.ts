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
import { DatePipe, SlicePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
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
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    MatBadgeModule,
    DatePipe,
    SlicePipe,
  ],
  template: `
    <div style="display:flex; align-items:center;
                justify-content:space-between; padding:24px 24px 0;">
      <div>
        <h1 style="margin:0; font-size:1.75rem; font-weight:600;">
          Mis Tareas
        </h1>
        <p style="margin:4px 0 0;
                  color:var(--mat-sys-on-surface-variant);">
          {{ auth.currentUser()?.username }} —
          {{ auth.currentUser()?.role }}
        </p>
      </div>
      <button mat-icon-button (click)="onRefresh()"
              [disabled]="loading()"
              matTooltip="Actualizar"
              [matBadge]="hasNewTask() ? '!' : null"
              matBadgeColor="warn">
        <mat-icon>refresh</mat-icon>
      </button>
    </div>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate"
        style="margin: 8px 24px 0;" />
    }

    <div style="display:grid; grid-template-columns:1fr 1fr 1fr;
                gap:24px; padding:24px;">

      <!-- COLUMNA IZQUIERDA — Tareas PENDING -->
      <div>
        <div style="display:flex; align-items:center;
                    gap:8px; margin-bottom:16px;">
          <mat-icon color="warn">inbox</mat-icon>
          <h2 style="margin:0; font-size:1.1rem;">
            Disponibles para reclamar
          </h2>
          @if (pendingTasks().length > 0) {
            <mat-chip color="warn" highlighted>
              {{ pendingTasks().length }}
            </mat-chip>
          }
        </div>

        @for (task of pendingTasks(); track task.id) {
          <mat-card appearance="outlined"
                    style="margin-bottom:12px;
                           border-left:4px solid #f44336;">
            <mat-card-header>
              <mat-card-title style="font-size:1rem;">
                {{ task.nodeLabel || task.nodeId }}
              </mat-card-title>
              <mat-card-subtitle>
                Trámite: {{ task.processInstanceId | slice:0:8 }}…
              </mat-card-subtitle>
              <mat-chip-set>
                <mat-chip color="warn">Pendiente</mat-chip>
              </mat-chip-set>
            </mat-card-header>
            <mat-card-content style="padding-top:8px;">
              <p style="margin:0; font-size:0.85rem;
                        color:var(--mat-sys-on-surface-variant);">
                Asignado: {{ task.assignedAt | date:'dd/MM/yyyy HH:mm' }}
              </p>
            </mat-card-content>
            <mat-card-actions align="end">
              <button mat-flat-button color="primary"
                      (click)="claimTask(task)"
                      [disabled]="claiming() === task.id">
                @if (claiming() === task.id) {
                  Reclamando…
                } @else {
                  <mat-icon>assignment_ind</mat-icon> Reclamar
                }
              </button>
            </mat-card-actions>
          </mat-card>
        }

        @if (!loading() && pendingTasks().length === 0) {
          <mat-card appearance="outlined">
            <mat-card-content style="text-align:center; padding:32px;">
              <mat-icon style="font-size:48px; width:48px; height:48px;
                        color:var(--mat-sys-on-surface-variant);">
                done_all
              </mat-icon>
              <p style="color:var(--mat-sys-on-surface-variant);
                        margin:8px 0 0;">
                Sin tareas disponibles
              </p>
            </mat-card-content>
          </mat-card>
        }
      </div>

      <!-- COLUMNA DERECHA — Tareas IN_PROGRESS -->
      <div>
        <div style="display:flex; align-items:center;
                    gap:8px; margin-bottom:16px;">
          <mat-icon color="primary">pending_actions</mat-icon>
          <h2 style="margin:0; font-size:1.1rem;">En progreso</h2>
          @if (inProgressTasks().length > 0) {
            <mat-chip color="primary" highlighted>
              {{ inProgressTasks().length }}
            </mat-chip>
          }
        </div>

        @for (task of inProgressTasks(); track task.id) {
          <mat-card appearance="outlined"
            style="margin-bottom:12px;
                   border-left:4px solid #ff9800;">
            <mat-card-header>
              <mat-card-title style="font-size:1rem;">
                {{ task.nodeLabel || task.nodeId }}
              </mat-card-title>
              <mat-card-subtitle>
                Trámite: {{ task.processInstanceId | slice:0:8 }}…
              </mat-card-subtitle>
              <mat-chip-set>
                <mat-chip color="primary" highlighted>En progreso</mat-chip>
              </mat-chip-set>
            </mat-card-header>
            <mat-card-actions align="end">
              <button mat-stroked-button color="primary"
                      (click)="router.navigate(['/task', task.id], { state: { task } })">
                <mat-icon>edit_note</mat-icon> Completar
              </button>
            </mat-card-actions>
          </mat-card>
        }

        @if (!loading() && inProgressTasks().length === 0) {
          <mat-card appearance="outlined">
            <mat-card-content style="text-align:center; padding:32px;">
              <mat-icon style="font-size:48px; width:48px; height:48px;
                        color:var(--mat-sys-on-surface-variant);">
                task_alt
              </mat-icon>
              <p style="color:var(--mat-sys-on-surface-variant);
                        margin:8px 0 0;">
                Sin tareas en progreso
              </p>
            </mat-card-content>
          </mat-card>
        }
      </div>

      <!-- COLUMNA DERECHA — Tareas COMPLETED -->
      <div>
        <div style="display:flex; align-items:center;
                    gap:8px; margin-bottom:16px;">
          <mat-icon style="color:#4caf50">task_alt</mat-icon>
          <h2 style="margin:0; font-size:1.1rem;">Completadas</h2>
          @if (completedTasks().length > 0) {
            <mat-chip style="background:#4caf50; color:white;" highlighted>
              {{ completedTasks().length }}
            </mat-chip>
          }
        </div>

        @for (task of completedTasks(); track task.id) {
          <mat-card appearance="outlined"
            style="margin-bottom:12px;
                   border-left:4px solid #4caf50;
                   opacity:0.8;">
            <mat-card-header>
              <mat-card-title style="font-size:1rem;">
                {{ task.nodeLabel || task.nodeId }}
              </mat-card-title>
              <mat-card-subtitle>
                Trámite: {{ task.processInstanceId | slice:0:8 }}…
              </mat-card-subtitle>
              <mat-chip-set>
                <mat-chip style="background:#4caf50; color:white;">
                  Completado
                </mat-chip>
              </mat-chip-set>
            </mat-card-header>
            <mat-card-content style="padding-top:8px;">
              <p style="margin:0; font-size:0.85rem;
                        color:var(--mat-sys-on-surface-variant);">
                Completado: {{ task.assignedAt | date:'dd/MM/yyyy HH:mm' }}
              </p>
            </mat-card-content>
          </mat-card>
        }

        @if (!loading() && completedTasks().length === 0) {
          <mat-card appearance="outlined">
            <mat-card-content style="text-align:center; padding:32px;">
              <mat-icon style="font-size:48px; width:48px; height:48px;
                        color:var(--mat-sys-on-surface-variant);">
                hourglass_empty
              </mat-icon>
              <p style="color:var(--mat-sys-on-surface-variant);
                        margin:8px 0 0;">
                Sin tareas completadas
              </p>
            </mat-card-content>
          </mat-card>
        }
      </div>

    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Default,
})
export class DashboardComponent implements OnInit, OnDestroy {
  protected readonly http = inject(HttpClient);
  protected readonly ws = inject(WebSocketService);
  protected readonly auth = inject(AuthService);
  protected readonly snack = inject(MatSnackBar);
  protected readonly dialog = inject(MatDialog);
  protected readonly router = inject(Router);

  private readonly API = 'http://localhost:3000/api/v1';
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
