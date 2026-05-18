import { ShapeManager } from './ShapeManager.js';

export class RectangleManager extends ShapeManager {
    constructor(canvasManager) {
        super(canvasManager, {
            shapeType: 'rect',
            finalSizeCheck: shape =>
                shape.width === 0 && shape.height === 0
        });
    }
}