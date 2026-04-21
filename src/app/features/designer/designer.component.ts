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
import { MatToolbarModule } from '@angular/material/toolbar';
import BpmnModeler, { BpmnElement, ElementRegistry } from 'bpmn-js/lib/Modeler';
import { ActivityNode, ActivityPartition, ControlFlow, Department } from '../../core/models/domain';
import { NodeType } from '../../core/models/enums';
import { CreatePolicyRequest, UpdatePolicyRequest } from '../../core/models/requests';
import { PolicyResponse } from '../../core/models/responses';
import { PolicyService } from '../../core/services/policy.service';
import { FormEditorDialogComponent } from './form-editor-dialog/form-editor-dialog.component';
import { INITIAL_BPMN_TEMPLATE } from './initial-template';
import { LanePanelComponent } from './lane-panel/lane-panel.component';
import { FormSchema } from './models/form-schema.models';

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
  imports: [MatToolbarModule, MatButtonModule, MatFormFieldModule, MatInputModule, LanePanelComponent],
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
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly policyService = inject(PolicyService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  constructor() {
    afterNextRender(async () => {
      const container = this.canvas()?.nativeElement;
      if (container) {
        this.modeler = new BpmnModeler({ container });
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
        this.modeler.on('element.dblclick', (event: { element: BpmnElement }) => {
          const el = event.element;
          const type = el.businessObject.$type;
          const isAction =
            type === 'bpmn:Task' ||
            type === 'bpmn:UserTask' ||
            type === 'bpmn:ServiceTask';
          if (!isAction) return;

          const existingSchema = this.nodeFormSchemas.get(el.id) ?? { fields: [] };

          this.dialog
            .open(FormEditorDialogComponent, {
              data: {
                nodeId: el.id,
                nodeLabel: el.businessObject.name || 'Nodo sin nombre',
                schema: existingSchema,
              },
              width: '680px',
              maxHeight: '80vh',
            })
            .afterClosed()
            .subscribe((result: FormSchema | null) => {
              if (result) {
                this.nodeFormSchemas.set(el.id, result);
                this.refreshNodeMarkers();
              }
            });
        });
        this.http
          .get<Department[]>('http://localhost:3000/api/v1/departments')
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
      .filter(el => el.businessObject.$type === 'bpmn:SequenceFlow')
      .map(el => ({
        id: el.id,
        sourceNodeId: el.source.id,
        targetNodeId: el.target.id,
        guardCondition: el.businessObject.conditionExpression?.body ?? null,
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
        error: () => this.snackBar.open('Error al actualizar', 'OK', { duration: 3000 }),
      });
    } else {
      this.policyService.createPolicy(request as CreatePolicyRequest).subscribe({
        next: (response) => {
          this.policyId.set(response.id);
          this.snackBar.open('Política guardada', 'OK', { duration: 3000 });
        },
        error: () => this.snackBar.open('Error al guardar', 'OK', { duration: 3000 }),
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
        this.refreshLanes();
      },
      error: () => {
        this.snackBar.open('Error al cargar la política', 'OK', { duration: 3000 });
      },
    });
  }

  ngOnDestroy(): void {
    this.modeler?.destroy();
  }
}

