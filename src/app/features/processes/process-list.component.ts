import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'app-process-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatToolbarModule, MatButtonModule],
  template: `
    <mat-toolbar>
      <span>Trámites</span>
    </mat-toolbar>
    <p style="padding:24px;">
      Lista de trámites — próximamente
    </p>
  `,
})
export class ProcessListComponent {}
