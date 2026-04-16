import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-policies',
  imports: [MatCardModule],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Políticas de Negocio</mat-card-title>
        <mat-card-subtitle>Gestión de políticas empresariales</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <p>Policies feature — coming soon.</p>
      </mat-card-content>
    </mat-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoliciesComponent {}
