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
    if (element.type !== 'bpmn:ParallelGateway') return;

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
  });
}

(CustomParallelGatewayRenderer as unknown as { $inject: string[] }).$inject = ['eventBus'];

export const CustomParallelGatewayModule = {
  __init__: ['customParallelGatewayRenderer'],
  customParallelGatewayRenderer: ['type', CustomParallelGatewayRenderer],
};
