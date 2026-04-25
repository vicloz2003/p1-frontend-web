import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FileUploadService } from '../../../../core/services/file-upload.service';
import { FieldType, FieldTypeConfig } from '@ngx-formly/core';

@Component({
  selector: 'app-file-field',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatProgressBarModule],
  template: `
    <div style="margin-bottom:16px;">
      <label style="display:block; font-size:0.85rem; margin-bottom:8px; font-weight:500;">
        {{ label() }}
        @if (required()) { <span style="color:red;">*</span> }
      </label>

      @if (!uploaded()) {
        <div style="border:2px dashed #ccc; border-radius:8px; padding:24px; text-align:center; cursor:pointer;"
             (click)="fileInput.click()">
          @if (uploading()) {
            <mat-progress-bar mode="indeterminate" style="margin-bottom:8px;"/>
            <p style="margin:0; color:#666;">Subiendo archivo...</p>
          } @else {
            <mat-icon style="font-size:48px; width:48px; height:48px; color:#ccc;">upload_file</mat-icon>
            <p style="margin:8px 0 0; color:#666;">Haz clic para seleccionar un archivo</p>
            <p style="margin:4px 0 0; font-size:0.75rem; color:#999;">JPG, PNG, PDF — máx. 10MB</p>
          }
        </div>
      } @else {
        <div style="border:2px solid #4caf50; border-radius:8px; padding:16px; display:flex; align-items:center; gap:12px;">
          @if (previewUrl()) {
            <img [src]="previewUrl()" alt="preview" style="width:60px; height:60px; object-fit:cover; border-radius:4px;">
          } @else {
            <mat-icon style="color:#4caf50;">description</mat-icon>
          }
          <div style="flex:1; min-width:0;">
            <p style="margin:0; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ fileName() }}</p>
            <p style="margin:4px 0 0; font-size:0.75rem; color:#4caf50;">✓ Subido correctamente</p>
          </div>
          <button mat-icon-button (click)="reset()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }

      @if (error()) {
        <p style="color:red; font-size:0.8rem; margin:4px 0 0;">{{ error() }}</p>
      }

      <input #fileInput type="file"
             accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
             style="display:none"
             (change)="onFileSelected($event)">
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileFieldComponent extends FieldType<FieldTypeConfig> {
  @Input() label = signal('Archivo');
  @Input() required = signal(false);
  @Output() fileUploaded = new EventEmitter<string>();

  readonly uploading = signal(false);
  readonly uploaded = signal(false);
  readonly fileName = signal('');
  readonly error = signal('');
  readonly previewUrl = signal<string | null>(null);

  private readonly fileUpload = inject(FileUploadService);

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      this.error.set('El archivo no debe superar 10MB');
      return;
    }
    this.uploading.set(true);
    this.error.set('');
    this.fileName.set(file.name);

    // Preview para imágenes
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => this.previewUrl.set(e.target?.result as string);
      reader.readAsDataURL(file);
    }

    this.fileUpload.uploadFile(file).subscribe({
      next: (url) => {
        this.uploading.set(false);
        this.uploaded.set(true);
        this.fileUploaded.emit(url);
        this.formControl?.setValue(url);
      },
      error: () => {
        this.uploading.set(false);
        this.error.set('Error al subir el archivo. Intenta de nuevo.');
      },
    });
  }

  reset(): void {
    this.uploaded.set(false);
    this.fileName.set('');
    this.previewUrl.set(null);
    this.error.set('');
    this.formControl?.setValue(null);
  }

  
 
}
