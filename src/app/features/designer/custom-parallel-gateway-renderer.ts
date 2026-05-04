import { append, attr, create } from 'tiny-svg';

const HIGH_PRIORITY = 1500;
const BAR_HEIGHT = 8;

interface RenderContext {
  element: { type: string; width: number; height: number };
  gfx: SVGElement;
}

interface DiagramEvent {
  stopPropagation(): void;
}

function CustomParallelGatewayRenderer(eventBus: { on: (event: string, priority: number, handler: (evt: DiagramEvent, context: RenderContext) => void) => void }) {
  eventBus.on('render.shape', HIGH_PRIORITY, function (evt, context) {
    const { element, gfx } = context;

    // Fork/Join → barra negra UML
    if (element.type === 'bpmn:ParallelGateway') {
      evt.stopPropagation();
      const { width, height } = element;
      const rect = create('rect');
      attr(rect, {
        x: 0,
        y: (height - BAR_HEIGHT) / 2,
        width: width,
        height: BAR_HEIGHT,
        fill: '#000000',
        stroke: 'none',
        rx: 2,
        ry: 2,
      });
      append(gfx, rect);
      return rect;
    }

    // Decision/Merge → rombo vacío UML (sin X interior)
    if (element.type === 'bpmn:ExclusiveGateway') {
      evt.stopPropagation();
      const { width, height } = element;
      const cx = width / 2;
      const cy = height / 2;
      const diamond = create('polygon');
      attr(diamond, {
        points: `${cx},0 ${width},${cy} ${cx},${height} 0,${cy}`,
        fill: '#ffffff',
        stroke: '#000000',
        'stroke-width': 2,
      });
      append(gfx, diamond);
      return diamond;
    }

    return undefined;
  });
}

(CustomParallelGatewayRenderer as unknown as { $inject: string[] }).$inject = ['eventBus'];

export const CustomParallelGatewayModule = {
  __init__: ['customParallelGatewayRenderer'],
  customParallelGatewayRenderer: ['type', CustomParallelGatewayRenderer],
};
