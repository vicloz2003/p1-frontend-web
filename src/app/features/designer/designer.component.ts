import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import BpmnModeler, { BpmnElement, ElementRegistry } from 'bpmn-js/lib/Modeler';
import { ActivityNode, ActivityPartition, ControlFlow, Department } from '../../core/models/domain';
import { NodeType } from '../../core/models/enums';
import { CreatePolicyRequest, UpdatePolicyRequest } from '../../core/models/requests';
import { PolicyResponse } from '../../core/models/responses';
import { PolicyService } from '../../core/services/policy.service';
import { FormEditorDialogComponent } from './form-editor-dialog/form-editor-dialog.component';
import { GuardConditionDialogComponent } from './guard-condition-dialog/guard-condition-dialog.component';
import { INITIAL_BPMN_TEMPLATE } from './initial-template';
import { CustomParallelGatewayModule } from './custom-parallel-gateway-renderer';
import { LanePanelComponent } from './lane-panel/lane-panel.component';
import { IaDialogComponent, IaDialogData } from './ia-dialog/ia-dialog.component';
import { Subscription } from 'rxjs';
import { FormSchema } from './models/form-schema.models';
import { WebSocketService } from '../../core/websocket/websocket.service';

const SHAPE_TYPES = new Set([
  'bpmn:StartEvent',
  'bpmn:EndEvent',
  'bpmn:Task',
  'bpmn:UserTask',
  'bpmn:ServiceTask',
  'bpmn:ExclusiveGateway',
  'bpmn:ParallelGateway',
]);

function mapNodeType(el: BpmnElement): NodeType {
  switch (el.businessObject.$type) {
    case 'bpmn:StartEvent':
      return 'INITIAL_NODE';
    case 'bpmn:Task':
    case 'bpmn:UserTask':
    case 'bpmn:ServiceTask':
      return 'ACTION';
    case 'bpmn:ExclusiveGateway':
      return (el.incoming?.length ?? 0) > 1 ? 'MERGE' : 'DECISION';
    case 'bpmn:ParallelGateway':
      return (el.incoming?.length ?? 0) > 1 ? 'JOIN' : 'FORK';
    case 'bpmn:EndEvent':
    default:
      return 'ACTIVITY_FINAL';
  }
}

@Component({
  selector: 'app-designer',
  templateUrl: './designer.component.html',
  styleUrl: './designer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatToolbarModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, MatTooltipModule, LanePanelComponent, IaDialogComponent],
})
export class DesignerComponent implements OnDestroy {
  readonly canvas = viewChild<ElementRef<HTMLElement>>('canvas');
  readonly policyName = signal('Nueva Política');
  readonly policyId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.policyId() !== null);
  readonly departments = signal<Department[]>([]);
  readonly lanes = signal<ActivityPartition[]>([]);

  private modeler!: BpmnModeler;
  private readonly laneToDepart = new Map<string, string>();
  private readonly nodeFormSchemas = new Map<string, FormSchema>();
  private readonly flowConditions = new Map<string, string>();
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly policyService = inject(PolicyService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly ws = inject(WebSocketService);

  collaborating = false;
  private readonly collabSubs: Subscription[] = [];

  constructor() {
    afterNextRender(async () => {
      const container = this.canvas()?.nativeElement;
      if (container) {
        this.modeler = new BpmnModeler({ container, additionalModules: [CustomParallelGatewayModule] });
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
          this.policyId.set(id);
          this.loadPolicy(id);
        } else {
          try {
            await this.modeler.importXML(INITIAL_BPMN_TEMPLATE);
            this.refreshLanes();
          } catch (err) {
            console.error('Error inicializando el lienzo BPMN:', err);
          }
        }
        this.modeler.on('commandStack.changed', () => this.refreshLanes());

        this.modeler.on('element.dblclick',
          (event: { element: BpmnElement }) => {
            const el = event.element;

            // CASO 1: Flujo saliente de ExclusiveGateway
            if (el.businessObject.$type === 'bpmn:SequenceFlow') {
              console.log('[FLOW] source type:', el.source?.businessObject?.$type);
              console.log('[FLOW] source name:', el.source?.businessObject?.name);
              const source = el.source;
              if (source?.businessObject?.$type !== 'bpmn:ExclusiveGateway') {
                console.log('[FLOW] Not from gateway — skipping');
                return;
              }
              this.dialog.open(GuardConditionDialogComponent, {
                data: {
                  flowId: el.id,
                  sourceLabel: source.businessObject.name || 'Gateway',
                  targetLabel: el.target?.businessObject?.name
                               || 'Nodo siguiente',
                  currentCondition: this.flowConditions.get(el.id) ?? null,
                },
                width: '560px',
              }).afterClosed().subscribe((result: string | null) => {
                if (result === null) return;
                if (result === '') {
                  this.flowConditions.delete(el.id);
                } else {
                  this.flowConditions.set(el.id, result);
                  // Mostrar condición como label en el canvas
                  const modeling = this.modeler.get('modeling');
                  const registry: ElementRegistry =
                    this.modeler.get('elementRegistry');
                  const flowElement = registry.get(el.id);
                  if (flowElement) {
                    modeling['updateLabel'](flowElement, result);
                  }
                }
              });
              return; // ← CRÍTICO: detener aquí, no continuar
            }

            // CASO 2: Nodo ACTION — lógica existente sin modificar
            const type = el.businessObject.$type;
            const isAction = type === 'bpmn:Task' ||
                             type === 'bpmn:UserTask' ||
                             type === 'bpmn:ServiceTask';
            if (!isAction) return;

            const existingSchema = this.nodeFormSchemas.get(el.id)
                                   ?? { fields: [] };
            this.dialog.open(FormEditorDialogComponent, {
              data: {
                nodeId: el.id,
                nodeLabel: el.businessObject.name || 'Nodo sin nombre',
                schema: existingSchema,
              },
              width: '680px',
              maxHeight: '80vh',
            }).afterClosed().subscribe((result: FormSchema | null) => {
              if (result) {
                this.nodeFormSchemas.set(el.id, result);
                this.refreshNodeMarkers();
              }
            });
          });
        this.http
          .get<Department[]>('http://34.237.109.152:3000/api/v1/departments')
          .subscribe(data => this.departments.set(data));
      }
    });
  }

  private refreshNodeMarkers(): void {
    const registry: ElementRegistry = this.modeler.get('elementRegistry');
    const canvas = this.modeler.get('canvas');
    this.nodeFormSchemas.forEach((schema, nodeId) => {
      if (schema.fields.length > 0) {
        const el = registry.get(nodeId);
        if (el) {
          canvas.addMarker(nodeId, 'has-form');
        }
      }
    });
  }

  private refreshLanes(): void {
    const registry: ElementRegistry = this.modeler.get('elementRegistry');
    const laneElements = registry.getAll().filter(
      el => el.businessObject.$type === 'bpmn:Lane'
    );
    this.lanes.set(
      laneElements.map(el => ({
        id: el.id,
        label: el.businessObject.name ?? 'Carril sin nombre',
        departmentId: this.laneToDepart.get(el.id) ?? '',
      }))
    );
  }

  onNameInput(event: Event): void {
    this.policyName.set((event.target as HTMLInputElement).value);
  }

  onDepartmentAssigned(event: { laneId: string; departmentId: string }): void {
    this.laneToDepart.set(event.laneId, event.departmentId);
  }

  async savePolicy(): Promise<void> {
    if (!this.modeler) return;
    const { xml } = await this.modeler.saveXML({ format: true });

    const elementRegistry: ElementRegistry = this.modeler.get('elementRegistry');
    const elements: BpmnElement[] = elementRegistry.getAll();

    const lanedElements = elements.filter(el => el.businessObject.$type === 'bpmn:Lane');

    const partitions: ActivityPartition[] = lanedElements.map(lane => ({
      id: lane.id,
      label: lane.businessObject.name ?? 'Carril sin nombre',
      departmentId: '',
    }));

    const nodes: ActivityNode[] = elements
      .filter(el => SHAPE_TYPES.has(el.businessObject.$type))
      .map(el => {
        let laneId = '';
        if (el.parent?.businessObject?.$type === 'bpmn:Lane') {
          laneId = el.parent.id;
        } else {
          const matchingLane = lanedElements.find(
            lane => lane.businessObject.flowNodeRef?.some(ref => ref.id === el.id)
          );
          if (matchingLane) {
            laneId = matchingLane.id;
          }
        }
        return {
          id: el.id,
          label: el.businessObject.name ?? '',
          partitionId: laneId,
          type: mapNodeType(el),
          formSchema: (this.nodeFormSchemas.get(el.id) ?? { fields: [] }) as unknown as Record<string, unknown>,
          metadata: {},
        };
      });

    const flows: ControlFlow[] = elements
      .filter(el =>
        el.businessObject.$type === 'bpmn:SequenceFlow' &&
        el.source?.id != null &&
        el.target?.id != null
      )
      .map(el => ({
        id: el.id,
        sourceNodeId: el.source.id,
        targetNodeId: el.target.id,
        guardCondition: this.flowConditions.get(el.id) ?? null,
      }));

    const enrichedPartitions = partitions.map(p => ({
      ...p,
      departmentId: this.laneToDepart.get(p.id) ?? '',
    }));

    const unassigned = enrichedPartitions.filter(p => p.departmentId === '');
    if (unassigned.length > 0) {
      this.snackBar.open(
        'Asigna un departamento a todos los carriles antes de guardar',
        'OK',
        { duration: 4000 }
      );
      return;
    }

    const request: CreatePolicyRequest | UpdatePolicyRequest = {
      name: this.policyName(),
      partitions: enrichedPartitions,
      nodes,
      flows,
      bpmnXml: xml ?? '',
    };

    console.log('NODES:', nodes);
    console.log('FLOWS:', flows);
    console.log('REQUEST:', request);

    if (this.isEditMode()) {
      this.policyService.updatePolicy(this.policyId()!, request as UpdatePolicyRequest).subscribe({
        next: () => this.snackBar.open('Política actualizada', 'OK', { duration: 3000 }),
        error: (err) => this.snackBar.open(err.error?.detail ?? err.error?.message ?? 'Error al actualizar', 'OK', { duration: 5000 }),
      });
    } else {
      this.policyService.createPolicy(request as CreatePolicyRequest).subscribe({
        next: (response) => {
          this.policyId.set(response.id);
          this.snackBar.open('Política guardada', 'OK', { duration: 3000 });
        },
        error: (err) => this.snackBar.open(err.error?.message ?? 'Error al guardar', 'OK', { duration: 3000 }),
      });
    }
  }

  loadPolicy(id: string): void {
    this.policyService.getById(id).subscribe({
      next: async (policy: PolicyResponse) => {
        this.policyName.set(policy.name);
        if (policy.bpmnXml) {
          await this.modeler.importXML(policy.bpmnXml);
        } else {
          await this.modeler.importXML(INITIAL_BPMN_TEMPLATE);
        }
        policy.nodes.forEach(node => {
          if (node.formSchema && (node.formSchema as unknown as FormSchema).fields?.length > 0) {
            this.nodeFormSchemas.set(node.id, node.formSchema as unknown as FormSchema);
          }
        });
        policy.flows.forEach(flow => {
          if (flow.guardCondition) {
            this.flowConditions.set(flow.id, flow.guardCondition);
          }
        });
        policy.partitions.forEach(partition => {
          this.laneToDepart.set(partition.id, partition.departmentId);
        });
        this.refreshLanes();
        this.refreshNodeMarkers();
        if (this.departments().length === 0) {
          this.http
            .get<Department[]>('http://34.237.109.152:3000/api/v1/departments')
            .subscribe(data => this.departments.set(data));
        }
      },
      error: () => {
        this.snackBar.open('Error al cargar la política', 'OK', { duration: 3000 });
      },
    });
  }

  openIaDialog(): void {
    this.dialog.open(IaDialogComponent, {
      data: { departments: this.departments() } satisfies IaDialogData,
      width: '560px',
    }).afterClosed().subscribe(async (result) => {
      if (!result) return;

      const confirmed = confirm(
        '¿Reemplazar el diagrama actual con el generado por IA?\n' +
        'Esta acción no se puede deshacer.'
      );
      if (!confirmed) return;

      // Actualizar nombre
      this.policyName.set(result.name ?? 'Nueva Política IA');

      // Limpiar estado previo
      this.nodeFormSchemas.clear();
      this.flowConditions.clear();
      this.laneToDepart.clear();

      // Restaurar formSchemas
      result.nodes?.forEach((node: any) => {
        if (node.formSchema?.fields?.length > 0) {
          this.nodeFormSchemas.set(node.id, node.formSchema);
        }
      });

      // Restaurar flowConditions
      result.flows?.forEach((flow: any) => {
        if (flow.guardCondition) {
          this.flowConditions.set(flow.id, flow.guardCondition);
        }
      });

      // Restaurar laneToDepart
      result.partitions?.forEach((partition: any) => {
        if (partition.departmentId) {
          this.laneToDepart.set(partition.id, partition.departmentId);
        }
      });

      // Importar template vacío y refrescar lanes
      if (result.suggestedBpmnXml) {
        await this.modeler.importXML(result.suggestedBpmnXml);
      } else {
        await this.modeler.importXML(INITIAL_BPMN_TEMPLATE);
      }

      // Sincronizar lanes desde el modelo BPMN (usa laneToDepart para departmentId)
      this.refreshLanes();

      this.snackBar.open(
        `Diagrama generado: ${result.nodes?.length} nodos, ` +
        `${result.flows?.length} flujos. ` +
        `Guarda la política para continuar.`,
        'OK',
        { duration: 6000 }
      );
    });
  }

  startCollaboration(): void {
    const policyId = this.policyId();
    if (!policyId || this.collaborating) return;
    this.collaborating = true;

    const sub = this.ws.subscribe<{
      sessionId: string;
      policyId: string;
      bpmnXml: string;
    }>(`/topic/colaboracion/${policyId}`)
    .subscribe(async payload => {
      if (payload.sessionId === this.ws.getSessionId()) return;
      try {
        await this.modeler.importXML(payload.bpmnXml);
        this.refreshLanes();
        console.log('[COLLAB] Diagrama actualizado desde otro participante');
      } catch (err) {
        console.error('[COLLAB] Error importando XML:', err);
      }
    });

    this.collabSubs.push(sub);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    this.modeler.on('commandStack.changed', async () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const { xml } = await this.modeler.saveXML({ format: false });
          if (xml) {
            this.ws.publish(`/app/colaboracion/${policyId}`, {
              sessionId: this.ws.getSessionId(),
              policyId,
              bpmnXml: xml,
            });
          }
        } catch (err) {
          console.error('[COLLAB] Error publicando cambio:', err);
        }
      }, 500);
    });

    this.snackBar.open(
      'Modo colaborativo activo — los cambios se sincronizan en tiempo real',
      'OK',
      { duration: 4000 }
    );
  }

  ngOnDestroy(): void {
    this.collabSubs.forEach(s => s.unsubscribe());
    this.modeler?.destroy();
  }
}

