declare module 'bpmn-js/lib/Modeler' {
  export interface BpmnSaveXMLResult {
    xml?: string;
    error?: Error;
  }
  export interface BpmnBusinessObject {
    $type: string;
    name?: string;
    conditionExpression?: { body: string };
    flowNodeRef?: Array<{ id: string }>;
  }
  export interface BpmnElement {
    id: string;
    type: string;
    businessObject: BpmnBusinessObject;
    parent?: BpmnElement;
    source: BpmnElement;
    target: BpmnElement;
    incoming: BpmnElement[];
    outgoing: BpmnElement[];
  }
  export interface ElementRegistry {
    getAll(): BpmnElement[];
    get(id: string): BpmnElement | undefined;
  }
  export interface ModelingService {
    [key: string]: unknown;
  }
  export interface CanvasService {
    addMarker(elementId: string, marker: string): void;
  }
  export default class BpmnModeler {
    constructor(options: { container: HTMLElement });
    saveXML(options?: { format?: boolean }): Promise<BpmnSaveXMLResult>;
    importXML(xml: string): Promise<{ warnings: string[] }>;
    get(serviceName: 'elementRegistry'): ElementRegistry;
    get(serviceName: 'modeling'): ModelingService;
    get(serviceName: 'canvas'): CanvasService;
    on(event: string, callback: (event: { element: BpmnElement }) => void): void;
    destroy(): void;
  }
}
