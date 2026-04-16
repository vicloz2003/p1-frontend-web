import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-designer',
  imports: [MatCardModule],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Diseñador BPMN</mat-card-title>
        <mat-card-subtitle>Editor de diagramas de actividad</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <p>Designer feature — coming soon.</p>
      </mat-card-content>
    </mat-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignerComponent {}
