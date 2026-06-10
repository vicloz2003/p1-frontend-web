import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { OnlyOfficeService } from '../../core/services/onlyoffice.service';

/** OnlyOffice's `DocsAPI`, present once the Document Server `api.js` has loaded. */
interface DocsAPILike {
  DocEditor: new (containerId: string, config: Record<string, unknown>) => { destroyEditor(): void };
}

/**
 * Collaborative Office editor (RF-1.10). Fetches the signed config from the backend, loads the
 * Document Server `api.js`, and mounts `DocsAPI.DocEditor`. Edits are saved by the DS calling the
 * backend callback — this component does not POST the content itself.
 *
 * Route: `documents/:id/edit`.
 */
@Component({
  selector: 'app-onlyoffice-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatToolbarModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <mat-toolbar color="primary">
      <button mat-icon-button (click)="back()" aria-label="Volver">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <mat-icon style="margin:0 8px;">edit_document</mat-icon>
      <span>Edición colaborativa</span>
    </mat-toolbar>

    <!-- The editor host must keep a real, non-collapsing height at all times: OnlyOffice
         sizes its iframe to the host's height at construction. Loader/error are overlays so
         the host is never display:none (which would give the iframe height 0). -->
    <div style="position:relative; height:calc(100vh - 64px);">

      @if (loading()) {
        <div style="position:absolute; inset:0; z-index:2; display:flex; flex-direction:column;
                    align-items:center; justify-content:center; gap:12px;
                    background:var(--mat-sys-surface);">
          <mat-spinner diameter="40"></mat-spinner>
          <span>Cargando editor…</span>
        </div>
      }

      @if (error(); as e) {
        <div role="alert" style="position:absolute; inset:0; z-index:2; display:flex;
                    flex-direction:column; align-items:center; justify-content:center; gap:12px;
                    text-align:center; color:var(--mat-sys-error); background:var(--mat-sys-surface);">
          <mat-icon style="font-size:48px; height:48px; width:48px;">error_outline</mat-icon>
          <p>{{ e }}</p>
          <button mat-stroked-button (click)="back()">Volver</button>
        </div>
      }

      <!-- DocsAPI replaces the contents of this element with a full-size iframe -->
      <div id="onlyoffice-editor" style="width:100%; height:100%;"></div>
    </div>
  `,
})
export class OnlyOfficeEditorComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly onlyOffice = inject(OnlyOfficeService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly ready = computed(() => !this.loading() && !this.error());

  private editor: { destroyEditor(): void } | null = null;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Documento no especificado');
      this.loading.set(false);
    } else {
      this.open(id);
    }
  }

  private open(id: string): void {
    this.onlyOffice.getConfig(id).subscribe({
      next: async (res) => {
        try {
          await this.onlyOffice.loadApiScript(res.documentServerUrl);
          const docsApi = (window as unknown as { DocsAPI?: DocsAPILike }).DocsAPI;
          if (!docsApi) throw new Error('El editor OnlyOffice no está disponible');
          this.loading.set(false);
          // Mount after two animation frames so the host element has its final laid-out
          // height — OnlyOffice sizes its iframe from the host at construction time.
          requestAnimationFrame(() => requestAnimationFrame(() => {
            this.editor = new docsApi.DocEditor('onlyoffice-editor', res.config);
          }));
        } catch (err) {
          this.error.set(err instanceof Error ? err.message : 'Error al abrir el editor');
          this.loading.set(false);
        }
      },
      error: (err) => {
        this.error.set(
          err?.status === 404 ? 'Documento no encontrado' : 'No se pudo obtener la configuración del editor'
        );
        this.loading.set(false);
      },
    });
  }

  protected back(): void {
    this.location.back();
  }

  ngOnDestroy(): void {
    try {
      this.editor?.destroyEditor();
    } catch {
      /* DocsAPI may already have torn down the iframe */
    }
  }
}
