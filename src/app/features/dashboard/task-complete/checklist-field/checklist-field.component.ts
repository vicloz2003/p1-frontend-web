import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FieldType, FieldTypeConfig } from '@ngx-formly/core';

interface Option { label: string; value: string; }

/**
 * Formly custom type 'checklist' — renders one Material checkbox per option and
 * stores the selected values as a string[]. Used during process attention for
 * dynamically-designed CHECKLIST fields. An empty selection fails `required`
 * (Angular treats an empty array as empty).
 */
@Component({
  selector: 'app-checklist-field',
  standalone: true,
  imports: [MatCheckboxModule],
  template: `
    <div style="margin-bottom:16px;">
      <label style="display:block; font-size:0.85rem; margin-bottom:8px; font-weight:500;">
        {{ props.label }}
        @if (props.required) { <span style="color:red;">*</span> }
      </label>
      <div style="display:flex; flex-direction:column; gap:4px;">
        @for (opt of checklistOptions; track opt.value) {
          <mat-checkbox [checked]="isChecked(opt.value)"
                        (change)="toggle(opt.value, $event.checked)">
            {{ opt.label }}
          </mat-checkbox>
        } @empty {
          <span style="font-size:0.8rem; color:var(--mat-sys-on-surface-variant);">
            (sin opciones definidas)
          </span>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistFieldComponent extends FieldType<FieldTypeConfig> {
  get checklistOptions(): Option[] {
    return (this.props as { options?: Option[] }).options ?? [];
  }

  private get current(): string[] {
    const v = this.formControl.value;
    return Array.isArray(v) ? (v as string[]) : [];
  }

  isChecked(value: string): boolean {
    return this.current.includes(value);
  }

  toggle(value: string, checked: boolean): void {
    const set = new Set(this.current);
    if (checked) {
      set.add(value);
    } else {
      set.delete(value);
    }
    this.formControl.setValue([...set]);
    this.formControl.markAsTouched();
  }
}
