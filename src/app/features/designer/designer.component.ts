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
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import BpmnModeler, { BpmnElement, ElementRegistry } from 'bpmn-js/lib/Modeler';
import { ActivityNode, ControlFlow } from '../../core/models/domain';
import { NodeType } from '../../core/models/enums';
import { CreatePolicyRequest } from '../../core/models/requests';
import { PolicyService } from '../../core/services/policy.service';

const EMPTY_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="156" y="81" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

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
      return (el.outgoing?.length ?? 0) > 1 ? 'DECISION' : 'MERGE';
    case 'bpmn:ParallelGateway':
      return (el.outgoing?.length ?? 0) > 1 ? 'FORK' : 'JOIN';
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
  imports: [MatToolbarModule, MatButtonModule, MatFormFieldModule, MatInputModule],
})
export class DesignerComponent implements OnDestroy {
  readonly canvas = viewChild<ElementRef<HTMLElement>>('canvas');
  readonly policyName = signal('Nueva Política');

  private modeler!: BpmnModeler;
  private readonly policyService = inject(PolicyService);
  private readonly snackBar = inject(MatSnackBar);

  constructor() {
    afterNextRender(async () => {
      const container = this.canvas()?.nativeElement;
      if (container) {
        this.modeler = new BpmnModeler({ container });
        try {
          await this.modeler.importXML(EMPTY_BPMN_XML);
        } catch (err) {
          console.error('Error inicializando el lienzo BPMN:', err);
        }
      }
    });
  }

  onNameInput(event: Event): void {
    this.policyName.set((event.target as HTMLInputElement).value);
  }

  savePolicy(): void {
    if (!this.modeler) return;

    const elementRegistry: ElementRegistry = this.modeler.get('elementRegistry');
    const elements: BpmnElement[] = elementRegistry.getAll();

    const nodes: ActivityNode[] = elements
      .filter(el => SHAPE_TYPES.has(el.businessObject.$type))
      .map(el => ({
        id: el.id,
        label: el.businessObject.name ?? '',
        partitionId: '',
        type: mapNodeType(el),
        formSchema: {},
        metadata: {},
      }));

    const flows: ControlFlow[] = elements
      .filter(el => el.businessObject.$type === 'bpmn:SequenceFlow')
      .map(el => ({
        id: el.id,
        sourceNodeId: el.source.id,
        targetNodeId: el.target.id,
        guardCondition: el.businessObject.conditionExpression?.body ?? null,
      }));

    const request: CreatePolicyRequest = {
      name: this.policyName(),
      partitions: [],
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

