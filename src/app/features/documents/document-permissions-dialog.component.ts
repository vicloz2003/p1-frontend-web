import {
  ChangeDetectionStrategy, Component, DestroyRef, inject, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, forkJoin, of } from 'rxjs';
import {
  catchError, debounceTime, distinctUntilChanged, filter, switchMap,
} from 'rxjs/operators';
import { DocumentResponse, DocumentPermissions } from '../../core/models/responses';
import { DocumentService } from '../../core/services/document.service';
import { environment } from '../../../environments/environment';

const ROLES = ['ADMIN_DESIGNER', 'EMPLOYEE', 'CLIENT'] as const;
type Perm = 'canRead' | 'canWrite' | 'canDelete';

interface PermRow { key: Perm; label: string; icon: string; hint: string; }
interface UserSuggestion { id: string; username: string; email: string; }

const PERM_ROWS: PermRow[] = [
  { key: 'canRead',   label: 'Lectura / descarga',   icon: 'visibility', hint: 'Quién puede ver y descargar el documento' },
  { key: 'canWrite',  label: 'Escritura / versiones', icon: 'edit',       hint: 'Quién puede subir nuevas versiones o editarlo' },
  { key: 'canDelete', label: 'Eliminación',           icon: 'delete',     hint: 'Quién puede eliminar (borrado lógico) el documento' },
];

@Component({
  selector: 'app-document-permissions-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule,
    MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressSpinnerModule, MatAutocompleteModule,
  ],
  template: `
    <h2 mat-dialog-title style="display:flex; align-items:center; gap:8px;">
      <mat-icon style="color:#1976d2;">admin_panel_settings</mat-icon>
      Privilegios del documento
    </h2>

    <mat-dialog-content>
      <p style="margin:0 0 4px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
        {{ data.fileName }}
      </p>
      <p style="margin:0 0 16px; font-size:0.78rem; color:var(--mat-sys-on-surface-variant);">
        Asigna por <strong>rol</strong>, busca un <strong>usuario</strong> por nombre o correo,
        o selecciona un <strong>departamento</strong>.
      </p>

      @for (row of permRows; track row.key) {
        <div style="border:1px solid var(--mat-sys-outline-variant); border-radius:10px;
                    padding:14px 16px; margin-bottom:14px;">

          <!-- Encabezado del permiso -->
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <mat-icon style="color:#1976d2; font-size:20px; width:20px; height:20px;">{{ row.icon }}</mat-icon>
            <span style="font-weight:600;">{{ row.label }}</span>
          </div>
          <p style="margin:0 0 10px; font-size:0.75rem; color:var(--mat-sys-on-surface-variant);">
            {{ row.hint }}
          </p>

          <!-- Roles (checkboxes) -->
          <div style="display:flex; flex-wrap:wrap; gap:14px; margin-bottom:10px;">
            @for (r of roles; track r) {
              <mat-checkbox
                [checked]="hasRole(row.key, r)"
                [disabled]="r === 'ADMIN_DESIGNER'"
                (change)="toggleRole(row.key, r, $event.checked)">
                {{ roleLabel(r) }}
                @if (r === 'ADMIN_DESIGNER') {
                  <span style="font-size:0.7rem; color:var(--mat-sys-on-surface-variant);"> (siempre)</span>
                }
              </mat-checkbox>
            }
          </div>

          <!-- Chips de entradas específicas (usuarios / departamentos) -->
          <mat-chip-set>
            @for (e of extras(row.key); track e) {
              <mat-chip (removed)="removeExtra(row.key, e)">
                {{ labelFor(e) }}
                <button matChipRemove aria-label="Quitar"><mat-icon>cancel</mat-icon></button>
              </mat-chip>
            }
          </mat-chip-set>

          <!-- Buscador de usuarios con autocomplete -->
          <mat-form-field appearance="outline" subscriptSizing="dynamic"
                          style="width:100%; margin-top:8px;">
            <mat-label>Buscar usuario por nombre o correo</mat-label>
            <input matInput
                   [matAutocomplete]="userAuto"
                   [(ngModel)]="userQuery[row.key]"
                   (ngModelChange)="onUserSearch($event)"
                   (focus)="activeKey = row.key"
                   placeholder="ej. Carlos o carlos@elecsur.com">
            <mat-icon matSuffix style="color:var(--mat-sys-on-surface-variant);">person_search</mat-icon>
            <mat-autocomplete #userAuto="matAutocomplete"
                              (optionSelected)="selectUser($event, row.key)">
              @for (u of userResults(); track u.id) {
                <mat-option [value]="u.id">
                  <div style="display:flex; flex-direction:column; line-height:1.4;">
                    <span style="font-weight:500;">{{ u.username }}</span>
                    <small style="color:var(--mat-sys-on-surface-variant);">{{ u.email }}</small>
                  </div>
                </mat-option>
              }
              @if (userResults().length === 0 && userQuery[row.key].length >= 2) {
                <mat-option disabled>Sin resultados</mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>

          <!-- Acceso rápido por departamento -->
          @if (departments().length > 0) {
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; align-items:center;">
              <span style="font-size:0.72rem; color:var(--mat-sys-on-surface-variant);">
                Departamentos:
              </span>
              @for (d of departments(); track d.id) {
                <mat-chip (click)="addDept(row.key, d)"
                          style="cursor:pointer; font-size:0.72rem; height:24px;">
                  + {{ d.name }}
                </mat-chip>
              }
            </div>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button [disabled]="saving()" (click)="ref.close(false)">Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="saving()" (click)="save()">
        @if (saving()) {
          <mat-progress-spinner diameter="18" mode="indeterminate"
            style="display:inline-block; margin-right:6px;"></mat-progress-spinner>
        }
        Guardar privilegios
      </button>
    </mat-dialog-actions>
  `,
})
export class DocumentPermissionsDialogComponent {

  readonly data        = inject<DocumentResponse>(MAT_DIALOG_DATA);
  readonly ref         = inject(MatDialogRef<DocumentPermissionsDialogComponent>);
  private readonly docService   = inject(DocumentService);
  private readonly snack        = inject(MatSnackBar);
  private readonly http         = inject(HttpClient);
  private readonly destroyRef   = inject(DestroyRef);

  readonly roles    = ROLES;
  readonly permRows = PERM_ROWS;
  readonly saving   = signal(false);
  readonly departments = signal<{ id: string; name: string }[]>([]);

  // ── user search ──────────────────────────────────────────────────────────
  readonly userResults = signal<UserSuggestion[]>([]);
  /** One query string per permission type. */
  userQuery: Record<Perm, string> = { canRead: '', canWrite: '', canDelete: '' };
  activeKey: Perm = 'canRead';

  /** Cache: id → human-readable label (populated when user is selected). */
  private readonly labels = new Map<string, string>();
  private readonly search$ = new Subject<string>();

  // ── permission lists ─────────────────────────────────────────────────────
  private readonly lists = signal<Record<Perm, string[]>>({
    canRead:   this.seed(this.data.permissions?.canRead),
    canWrite:  this.seed(this.data.permissions?.canWrite),
    canDelete: this.seed(this.data.permissions?.canDelete),
  });

  constructor() {
    // Resolve in parallel: departments + any user IDs already stored in this document's permissions.
    // Both are cached in `labels` before the first render — no chip ever shows a raw ID.
    const existingUserIds = this.existingExtras();
    forkJoin({
      depts: this.http.get<{ id: string; name: string }[]>(`${environment.apiUrl}/departments`),
      users: existingUserIds.length > 0
        ? this.http.post<UserSuggestion[]>(`${environment.apiUrl}/users/batch`, existingUserIds)
            .pipe(catchError(() => of([])))
        : of([]),
    }).subscribe(({ depts, users }) => {
      this.departments.set(depts ?? []);
      (depts ?? []).forEach(d => this.labels.set(d.id, d.name));
      users.forEach(u => this.labels.set(u.id, `${u.username} (${u.email})`));
    });

    // User search: debounce 300ms, min 2 chars, max 10 results
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(q => q.length >= 2),
      switchMap(q =>
        this.http.get<UserSuggestion[]>(
          `${environment.apiUrl}/users/suggest?q=${encodeURIComponent(q)}`
        ).pipe(catchError(() => of([])))
      ),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(results => this.userResults.set(results));
  }

  onUserSearch(q: string): void {
    if (!q || q.length < 2) { this.userResults.set([]); return; }
    this.search$.next(q);
  }

  selectUser(event: MatAutocompleteSelectedEvent, key: Perm): void {
    const userId = event.option.value as string;
    const user   = this.userResults().find(u => u.id === userId);
    if (user) {
      this.labels.set(userId, `${user.username} (${user.email})`);
      this.addValue(key, userId);
    }
    this.userQuery[key] = '';
    this.userResults.set([]);
  }

  addDept(key: Perm, dept: { id: string; name: string }): void {
    this.labels.set(dept.id, dept.name);
    this.addValue(key, dept.id);
  }

  /** Human-readable label for a chip entry. Always resolved — no raw IDs shown to the user. */
  labelFor(id: string): string {
    return this.labels.get(id) ?? id;
  }

  /** Deduplicated non-role entries already stored in this document's permissions. */
  private existingExtras(): string[] {
    const all = [
      ...(this.data.permissions?.canRead   ?? []),
      ...(this.data.permissions?.canWrite  ?? []),
      ...(this.data.permissions?.canDelete ?? []),
    ].filter(e => !ROLES.includes(e as typeof ROLES[number]));
    return [...new Set(all)];
  }

  // ── role helpers ─────────────────────────────────────────────────────────
  private seed(list: string[] | null | undefined): string[] {
    const arr = [...(list ?? [])];
    if (!arr.includes('ADMIN_DESIGNER')) arr.push('ADMIN_DESIGNER');
    return arr;
  }

  hasRole(key: Perm, role: string): boolean {
    return this.lists()[key].includes(role);
  }

  toggleRole(key: Perm, role: string, checked: boolean): void {
    const map  = { ...this.lists() };
    const set  = new Set(map[key]);
    checked ? set.add(role) : set.delete(role);
    set.add('ADMIN_DESIGNER');
    map[key] = [...set];
    this.lists.set(map);
  }

  extras(key: Perm): string[] {
    return this.lists()[key].filter(e => !ROLES.includes(e as typeof ROLES[number]));
  }

  addValue(key: Perm, value: string): void {
    if (!value) return;
    const map = { ...this.lists() };
    if (!map[key].includes(value)) map[key] = [...map[key], value];
    this.lists.set(map);
  }

  removeExtra(key: Perm, entry: string): void {
    const map = { ...this.lists() };
    map[key] = map[key].filter(e => e !== entry);
    this.lists.set(map);
  }

  roleLabel(role: string): string {
    return role === 'ADMIN_DESIGNER' ? 'Administrador'
      : role === 'EMPLOYEE' ? 'Empleados'
      : role === 'CLIENT' ? 'Cliente' : role;
  }

  // ── save ─────────────────────────────────────────────────────────────────
  save(): void {
    this.saving.set(true);
    const payload: DocumentPermissions = {
      canRead:   this.lists().canRead,
      canWrite:  this.lists().canWrite,
      canDelete: this.lists().canDelete,
    };
    this.docService.updatePermissions(this.data.id, payload).subscribe({
      next: () => {
        this.snack.open('Privilegios actualizados', 'OK', { duration: 3000 });
        this.ref.close(true);
      },
      error: () => {
        this.snack.open('No se pudieron actualizar los privilegios', 'OK', { duration: 3000 });
        this.saving.set(false);
      },
    });
  }
}
