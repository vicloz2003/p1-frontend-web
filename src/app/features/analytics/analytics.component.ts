import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-analytics',
  imports: [MatCardModule],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Analítica</mat-card-title>
        <mat-card-subtitle>Cuellos de botella y métricas de procesos</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <p>Analytics feature — coming soon.</p>
      </mat-card-content>
    </mat-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsComponent {}
