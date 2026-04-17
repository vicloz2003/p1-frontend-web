import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { ActivityPartition, Department } from '../../../core/models/domain';

@Component({
  selector: 'app-lane-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatListModule, MatSelectModule, MatFormFieldModule],
  template: `
    <mat-list>
      @for (lane of lanes(); track lane.id) {
        <mat-list-item>
          <span matListItemTitle>{{ lane.label }}</span>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" matListItemMeta>
            <mat-label>Departamento</mat-label>
            <mat-select
              (selectionChange)="departmentAssigned.emit({ laneId: lane.id, departmentId: $event.value })"
            >
              @for (dept of departments(); track dept.id) {
                <mat-option [value]="dept.id">{{ dept.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </mat-list-item>
      }
    </mat-list>
  `,
})
export class LanePanelComponent {
  readonly lanes = input<ActivityPartition[]>([]);
  readonly departments = input<Department[]>([]);
  readonly departmentAssigned = output<{ laneId: string; departmentId: string }>();
}
