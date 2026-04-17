declare module 'bpmn-js/lib/Modeler' {
  export interface BpmnSaveXMLResult {
    xml?: string;
    error?: Error;
  }

  export interface BpmnBusinessObject {
    $type: string;
    name?: string;
    conditionExpression?: { body: string };
  }

  export interface BpmnElement {
    id: string;
    type: string;
    businessObject: BpmnBusinessObject;
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
    destroy(): void;
  }
}
