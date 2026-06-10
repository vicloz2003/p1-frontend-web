import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { ActivityPartition, Department } from '../../../core/models/domain';

@Component({
  selector: 'app-lane-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatSelectModule, MatFormFieldModule, MatIconModule],
  template: `
    <!-- Panel header -->
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;
                padding-bottom:10px;
                border-bottom:2px solid var(--mat-sys-primary, #1976d2);">
      <mat-icon color="primary" style="font-size:18px; width:18px; height:18px;">
        view_week
      </mat-icon>
      <span style="font-size:0.85rem; font-weight:600; letter-spacing:.04em;
                   color:var(--mat-sys-on-surface); text-transform:uppercase;">
        Carriles
      </span>
    </div>

    @if (lanes().length === 0) {
      <p style="font-size:0.8rem; color:var(--mat-sys-on-surface-variant);
                text-align:center; margin-top:24px;">
        Agrega carriles (lanes) al diagrama para asignarles departamentos.
      </p>
    }

    @for (lane of lanes(); track lane.id) {
      <div style="margin-bottom:12px; padding:10px 10px 4px;
                  border-radius:8px;
                  background:var(--mat-sys-surface-variant, #f5f5f5);">
        <p style="margin: 0 0 8px; font-size: 0.85rem; font-weight: 600;
                  color:var(--mat-sys-on-surface); white-space:nowrap;
                  overflow:hidden; text-overflow:ellipsis;"
           [title]="lane.label">
          {{ lane.label || 'Carril sin nombre' }}
        </p>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width: 100%;">
          <mat-label>Departamento</mat-label>
          <mat-select
            [value]="lane.departmentId || ''"
            (selectionChange)="departmentAssigned.emit({ laneId: lane.id, departmentId: $event.value })"
          >
            @for (dept of departments(); track dept.id) {
              <mat-option [value]="dept.id">{{ dept.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>
    }
  `,
})
export class LanePanelComponent {
  readonly lanes = input<ActivityPartition[]>([]);
  readonly departments = input<Department[]>([]);
  readonly departmentAssigned = output<{ laneId: string; departmentId: string }>();
}
