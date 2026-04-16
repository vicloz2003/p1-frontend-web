import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  imports: [MatCardModule, MatButtonModule, RouterLink],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Acceso no autorizado</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>No tienes permisos para acceder a esta página.</p>
      </mat-card-content>
      <mat-card-actions>
        <a mat-button routerLink="/login">Volver al inicio</a>
      </mat-card-actions>
    </mat-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnauthorizedComponent {}
