import { ShapeManager } from './ShapeManager.js';

export class EllipseManager extends ShapeManager {
    constructor(canvasManager) {
        super(canvasManager, {
            shapeType: 'ellipse',
            finalSizeCheck: shape =>
                shape.rx === 0 && shape.ry === 0
        });
    }
}