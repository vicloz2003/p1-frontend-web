import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ActivityPartition, Department } from '../../../core/models/domain';

@Component({
  selector: 'app-lane-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatSelectModule, MatFormFieldModule],
  template: `
    @for (lane of lanes(); track lane.id) {
      <div style="padding: 8px 0; border-bottom: 1px solid var(--mat-sys-outline-variant);">
        <p style="margin: 0 0 8px; font-size: 0.9rem; font-weight: 500;">
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
