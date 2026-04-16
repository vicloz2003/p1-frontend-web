import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-process-status',
  imports: [MatCardModule],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Estado del Proceso</mat-card-title>
        <mat-card-subtitle>ID: {{ id() }}</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <p>Process status feature — coming soon.</p>
      </mat-card-content>
    </mat-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessStatusComponent {
  readonly id = input<string>('');
}
