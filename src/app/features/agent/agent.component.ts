import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../../core/auth/auth.service';
import {
  AgentClassifyResult,
  AgentDocRequirement,
  AgentService,
} from '../../core/services/agent.service';

interface ChatMessage { isUser: boolean; text: string; }
interface DocState { status: 'PENDING' | 'UPLOADING' | 'CONFIRMED'; documentId: string | null; error: string | null; }

@Component({
  selector: 'app-agent',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    FormsModule,
    MatToolbarModule, MatButtonModule, MatIconModule, MatCardModule,
    MatChipsModule, MatDividerModule, MatFormFieldModule, MatInputModule,
    MatProgressBarModule, MatProgressSpinnerModule, MatSnackBarModule,
  ],
  template: `
    <mat-toolbar color="primary">
      <mat-icon style="margin-right:8px;">smart_toy</mat-icon>
      <span>Asistente de Trámites</span>
    </mat-toolbar>

    <div style="max-width:720px; margin:0 auto; display:flex; flex-direction:column;
                height:calc(100vh - 64px);">

      <!-- Chat area -->
      <div #chatArea style="flex:1; overflow-y:auto; padding:24px;">
        @for (m of messages(); track $index) {
          <div [style.text-align]="m.isUser ? 'right' : 'left'" style="margin-bottom:10px;">
            <span [style.background]="m.isUser ? 'var(--mat-sys-primary)' : 'var(--mat-sys-surface-variant)'"
                  [style.color]="m.isUser ? 'white' : 'var(--mat-sys-on-surface)'"
                  style="display:inline-block; padding:10px 14px; border-radius:14px;
                         max-width:75%; text-align:left;">
              {{ m.text }}
            </span>
          </div>
        }

        @if (classifying()) {
          <mat-spinner diameter="24" style="margin:8px 0;"></mat-spinner>
        }

        <!-- Recommendation -->
        @if (result(); as r) {
          @if (r.confident) {
            <mat-card appearance="outlined" style="margin-top:12px;">
              <mat-card-header>
                <mat-icon mat-card-avatar style="color:#4caf50;">verified</mat-icon>
                <mat-card-title>{{ r.policyName }}</mat-card-title>
                <mat-card-subtitle>
                  Confianza: {{ (r.confidence * 100) | number:'1.0-0' }}%
                </mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                @if (mandatoryDocs(r).length > 0) {
                  <mat-divider style="margin:8px 0 16px;"></mat-divider>
                  <p style="font-weight:600; margin:0 0 8px;">Documentos requeridos</p>
                  @for (doc of mandatoryDocs(r); track doc.id) {
                    @let st = docStates().get(doc.id);
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                      @if (st?.status === 'CONFIRMED') {
                        <mat-icon style="color:#4caf50;">check_circle</mat-icon>
                      } @else if (st?.status === 'UPLOADING') {
                        <mat-spinner diameter="20"></mat-spinner>
                      } @else {
                        <mat-icon style="color:#ff9800;">error_outline</mat-icon>
                      }
                      <div style="flex:1;">
                        <span style="font-weight:500;">{{ doc.name }}</span>
                        @if (st?.error) {
                          <p style="margin:0; color:var(--mat-sys-error); font-size:0.78rem;">{{ st!.error }}</p>
                        }
                      </div>
                      @if (st?.status === 'CONFIRMED') {
                        <span style="color:#4caf50; font-size:0.8rem;">Cargado</span>
                      } @else if (st?.status !== 'UPLOADING') {
                        <button mat-stroked-button (click)="fileInput.click(); pendingDoc.set(doc);">
                          <mat-icon>upload</mat-icon> Cargar
                        </button>
                      }
                    </div>
                  }
                }
                <button mat-flat-button color="primary" style="margin-top:12px; width:100%;"
                        [disabled]="starting() || !allMandatoryDone(r)"
                        (click)="startProcess(r)">
                  @if (starting()) { Iniciando… }
                  @else if (!allMandatoryDone(r)) { Carga los documentos obligatorios }
                  @else { <mat-icon>play_arrow</mat-icon> Iniciar este trámite }
                </button>
              </mat-card-content>
            </mat-card>
          }
        }
      </div>

      <!-- Input bar -->
      <div style="display:flex; align-items:center; gap:8px; padding:12px 16px;
                  border-top:1px solid var(--mat-sys-outline-variant);">
        <button mat-icon-button
                [style.color]="recording() ? 'red' : 'var(--mat-sys-primary)'"
                [disabled]="transcribing()"
                (click)="toggleRecording()">
          <mat-icon>{{ recording() ? 'stop_circle' : 'mic' }}</mat-icon>
        </button>
        <mat-form-field appearance="outline" style="flex:1;" subscriptSizing="dynamic">
          <input matInput
                 [(ngModel)]="inputText"
                 [placeholder]="recording() ? 'Grabando…' : transcribing() ? 'Transcribiendo…' : 'Escribe tu solicitud…'"
                 (keyup.enter)="send()">
        </mat-form-field>
        <button mat-icon-button color="primary" [disabled]="classifying()" (click)="send()">
          <mat-icon>send</mat-icon>
        </button>
      </div>
    </div>

    <input #fileInput type="file" style="display:none;" (change)="onFileSelected($event)">
  `,
})
export class AgentComponent {
  private readonly agent = inject(AgentService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  private readonly chatArea = viewChild<ElementRef<HTMLElement>>('chatArea');

  readonly messages = signal<ChatMessage[]>([
    { isUser: false, text: 'Hola, soy tu asistente. Cuéntame qué trámite necesitas — escribe o usa el micrófono.' },
  ]);
  readonly result = signal<AgentClassifyResult | null>(null);
  readonly docStates = signal<Map<string, DocState>>(new Map());
  readonly pendingDoc = signal<AgentDocRequirement | null>(null);

  readonly classifying = signal(false);
  readonly recording = signal(false);
  readonly transcribing = signal(false);
  readonly starting = signal(false);

  inputText = '';

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  mandatoryDocs(r: AgentClassifyResult): AgentDocRequirement[] {
    return r.requiredDocuments.filter(d => d.mandatory);
  }

  allMandatoryDone(r: AgentClassifyResult): boolean {
    const mandatory = this.mandatoryDocs(r);
    if (mandatory.length === 0) return true;
    const states = this.docStates();
    return mandatory.every(d => states.get(d.id)?.status === 'CONFIRMED');
  }

  private addMessage(isUser: boolean, text: string): void {
    this.messages.update(m => [...m, { isUser, text }]);
    setTimeout(() => {
      const el = this.chatArea()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  send(): void {
    const text = this.inputText.trim();
    if (!text) return;
    this.inputText = '';
    this.addMessage(true, text);
    this.classifying.set(true);
    this.result.set(null);
    this.docStates.set(new Map());

    this.agent.classify(text).subscribe({
      next: r => {
        this.addMessage(false, r.message);
        const map = new Map<string, DocState>();
        r.requiredDocuments.filter(d => d.mandatory).forEach(d =>
          map.set(d.id, { status: 'PENDING', documentId: null, error: null }));
        this.docStates.set(map);
        this.result.set(r);
        this.classifying.set(false);
      },
      error: () => {
        this.addMessage(false, 'Ocurrió un error al procesar tu solicitud.');
        this.classifying.set(false);
      },
    });
  }

  async toggleRecording(): Promise<void> {
    if (this.recording()) {
      this.mediaRecorder?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data);
      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.transcribeAudio(blob);
      };
      this.mediaRecorder.start();
      this.recording.set(true);
    } catch {
      this.snack.open('No se pudo acceder al micrófono', 'OK', { duration: 3000 });
    }
  }

  private transcribeAudio(blob: Blob): void {
    this.recording.set(false);
    this.transcribing.set(true);
    this.agent.transcribe(blob).subscribe({
      next: text => {
        this.transcribing.set(false);
        this.inputText = text;
        if (text.trim()) this.send();
      },
      error: () => {
        this.transcribing.set(false);
        this.snack.open('No se pudo transcribir el audio', 'OK', { duration: 3000 });
      },
    });
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    const doc = this.pendingDoc();
    const r = this.result();
    if (!file || !doc || !r?.policyId) return;
    (event.target as HTMLInputElement).value = '';

    this.updateDoc(doc.id, { status: 'UPLOADING', error: null });
    const clientId = this.auth.currentUser()?.userId ?? null;

    this.agent.uploadRequiredDocument(r.policyId, doc.id, clientId, file).subscribe({
      next: docId => this.updateDoc(doc.id, { status: 'CONFIRMED', documentId: docId, error: null }),
      error: () => this.updateDoc(doc.id, { status: 'PENDING', documentId: null, error: 'Error al subir. Reintenta.' }),
    });
  }

  private updateDoc(reqId: string, partial: Partial<DocState>): void {
    const map = new Map(this.docStates());
    const current = map.get(reqId) ?? { status: 'PENDING', documentId: null, error: null };
    map.set(reqId, { ...current, ...partial });
    this.docStates.set(map);
  }

  startProcess(r: AgentClassifyResult): void {
    if (!r.policyId) return;
    this.starting.set(true);
    const clientId = this.auth.currentUser()?.userId ?? null;
    const ids = [...this.docStates().values()]
      .map(d => d.documentId)
      .filter((id): id is string => id !== null);

    this.agent.startProcess(r.policyId, clientId, ids).subscribe({
      next: () => {
        this.starting.set(false);
        this.snack.open('¡Trámite iniciado correctamente!', 'OK', { duration: 4000 });
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.starting.set(false);
        this.snack.open('No se pudo iniciar el trámite', 'OK', { duration: 4000 });
      },
    });
  }
}
