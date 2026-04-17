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
  }

  export default class BpmnModeler {
    constructor(options: { container: HTMLElement });
    saveXML(options?: { format?: boolean }): Promise<BpmnSaveXMLResult>;
    importXML(xml: string): Promise<{ warnings: string[] }>;
    get(serviceName: 'elementRegistry'): ElementRegistry;
    on(event: string, callback: (...args: unknown[]) => void): void;
    destroy(): void;
  }
}
