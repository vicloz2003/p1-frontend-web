import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FieldType, FieldTypeConfig } from '@ngx-formly/core';
import { GridColumn } from '../../../designer/models/form-schema.models';

type Row = Record<string, string>;

/**
 * Formly custom type 'grid' — renders an editable table whose columns come from
 * the designed GRID field (columns: TEXT/NUMBER/DATE/SELECT). Rows can be added and
 * removed; the value is stored as an array of row objects keyed by column id. Used
 * during process attention for dynamically-designed GRID/table fields.
 */
@Component({
  selector: 'app-grid-field',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  styles: [`
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { border: 1px solid var(--mat-sys-outline-variant); padding: 4px 6px; text-align: left; }
    th { background: var(--mat-sys-surface-container); font-weight: 600; }
    input, select { width: 100%; border: none; background: transparent; font: inherit;
                    padding: 4px; box-sizing: border-box; color: inherit; }
    input:focus, select:focus { outline: 1px solid var(--mat-sys-primary); border-radius: 2px; }
    .actions-col { width: 40px; text-align: center; }
  `],
  template: `
    <div style="margin-bottom:16px;">
      <label style="display:block; font-size:0.85rem; margin-bottom:8px; font-weight:500;">
        {{ props.label }}
        @if (props.required) { <span style="color:red;">*</span> }
      </label>

      @if (columns.length === 0) {
        <p style="font-size:0.8rem; color:var(--mat-sys-on-surface-variant); margin:0;">
          (grid sin columnas definidas)
        </p>
      } @else {
        <table>
          <thead>
            <tr>
              @for (col of columns; track col.id) { <th>{{ col.label }}</th> }
              <th class="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows; track $index; let i = $index) {
              <tr>
                @for (col of columns; track col.id) {
                  <td>
                    @switch (col.type) {
                      @case ('SELECT') {
                        <select [value]="row[col.id] ?? ''"
                                (change)="setCell(i, col.id, $any($event.target).value)">
                          <option value=""></option>
                          @for (opt of col.options ?? []; track opt) {
                            <option [value]="opt">{{ opt }}</option>
                          }
                        </select>
                      }
                      @case ('NUMBER') {
                        <input type="number" [value]="row[col.id] ?? ''"
                               (input)="setCell(i, col.id, $any($event.target).value)" />
                      }
                      @case ('DATE') {
                        <input type="date" [value]="row[col.id] ?? ''"
                               (input)="setCell(i, col.id, $any($event.target).value)" />
                      }
                      @default {
                        <input type="text" [value]="row[col.id] ?? ''"
                               (input)="setCell(i, col.id, $any($event.target).value)" />
                      }
                    }
                  </td>
                }
                <td class="actions-col">
                  <button mat-icon-button type="button" color="warn"
                          style="width:28px;height:28px;"
                          (click)="removeRow(i)" aria-label="Eliminar fila">
                    <mat-icon style="font-size:16px;width:16px;height:16px;">delete_outline</mat-icon>
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td [attr.colspan]="columns.length + 1"
                    style="text-align:center; color:var(--mat-sys-on-surface-variant);">
                  Sin filas — agrega una.
                </td>
              </tr>
            }
          </tbody>
        </table>

        <button mat-stroked-button type="button" style="margin-top:8px;" (click)="addRow()">
          <mat-icon>add</mat-icon> Agregar fila
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridFieldComponent extends FieldType<FieldTypeConfig> {
  get columns(): GridColumn[] {
    return (this.props as { columns?: GridColumn[] }).columns ?? [];
  }

  get rows(): Row[] {
    const v = this.formControl.value;
    return Array.isArray(v) ? (v as Row[]) : [];
  }

  addRow(): void {
    const row: Row = {};
    this.columns.forEach(c => (row[c.id] = ''));
    this.formControl.setValue([...this.rows, row]);
    this.formControl.markAsTouched();
  }

  removeRow(index: number): void {
    const copy = [...this.rows];
    copy.splice(index, 1);
    this.formControl.setValue(copy);
  }

  setCell(rowIndex: number, colId: string, value: string): void {
    const copy = this.rows.map((r, i) => (i === rowIndex ? { ...r, [colId]: value } : r));
    this.formControl.setValue(copy);
  }
}
