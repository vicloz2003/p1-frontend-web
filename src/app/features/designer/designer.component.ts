import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import BpmnModeler, { BpmnElement, ElementRegistry } from 'bpmn-js/lib/Modeler';
import { ActivityNode, ActivityPartition, ControlFlow, Department } from '../../core/models/domain';
import { NodeType } from '../../core/models/enums';
import { CreatePolicyRequest } from '../../core/models/requests';
import { PolicyService } from '../../core/services/policy.service';
import { INITIAL_BPMN_TEMPLATE } from './initial-template';
import { LanePanelComponent } from './lane-panel/lane-panel.component';

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
  readonly departments = signal<Department[]>([]);
  readonly lanes = signal<ActivityPartition[]>([]);

  private modeler!: BpmnModeler;
  private readonly laneToDepart = new Map<string, string>();
  private readonly http = inject(HttpClient);
  private readonly policyService = inject(PolicyService);
  private readonly snackBar = inject(MatSnackBar);

  constructor() {
    afterNextRender(async () => {
      const container = this.canvas()?.nativeElement;
      if (container) {
        this.modeler = new BpmnModeler({ container });
        try {
          await this.modeler.importXML(INITIAL_BPMN_TEMPLATE);
          this.refreshLanes();
        } catch (err) {
          console.error('Error inicializando el lienzo BPMN:', err);
        }
        this.modeler.on('commandStack.changed', () => this.refreshLanes());
        this.http
          .get<Department[]>('http://localhost:3000/api/v1/departments')
          .subscribe(data => this.departments.set(data));
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

  savePolicy(): void {
    if (!this.modeler) return;

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
          formSchema: {},
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

    const request: CreatePolicyRequest = {
      name: this.policyName(),
      partitions: enrichedPartitions,
      nodes,
      flows,
    };

    console.log('NODES:', nodes);
    console.log('FLOWS:', flows);
    console.log('REQUEST:', request);

    this.policyService.createPolicy(request).subscribe({
      next: () => this.snackBar.open('Policy saved', 'OK', { duration: 3000 }),
      error: (err: { message?: string }) =>
        this.snackBar.open(err.message ?? 'Error saving policy', 'OK', { duration: 5000 }),
    });
  }

  ngOnDestroy(): void {
    this.modeler?.destroy();
  }
}

