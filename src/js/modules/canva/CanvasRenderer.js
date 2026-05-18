export class CanvasRenderer {
    constructor(cm) {
        this.cm = cm;
        this.layerCanvas = document.createElement('canvas');
        this.layerCtx = this.layerCanvas.getContext('2d');
        this.cm.layerCanvas = this.layerCanvas;
        this.cm.layerCtx = this.layerCtx;
    }

    overrideRender() {
        this.cm.canvas._renderObjects = (ctx, objects) => {
            if (!this.cm.layerManager) {
                for (let i = 0, len = objects.length; i < len; ++i) {
                    objects[i].render(ctx);
                }
                return;
            }

            const layerObjects = {};
            const topLevelObjects = [];

            for (let i = 0, len = objects.length; i < len; ++i) {
                const obj = objects[i];
                const layerId = obj.layerId;

                if (!layerId) {
                    topLevelObjects.push(obj);
                    continue;
                }

                if (!layerObjects[layerId]) layerObjects[layerId] = [];
                layerObjects[layerId].push(obj);
            }

            const layersReversed = [...this.cm.layerManager.layers].reverse();
            const v = this.cm.canvas.viewportTransform;
            const retina = this.cm.canvas.getRetinaScaling();

            this.layerCanvas.width = this.cm.canvas.lowerCanvasEl.width;
            this.layerCanvas.height = this.cm.canvas.lowerCanvasEl.height;

            for (let i = 0; i < layersReversed.length; i++) {
                const layer = layersReversed[i];
                if (!layer.visible) continue;

                const objs = layerObjects[layer.id];
                if (!objs || objs.length === 0) continue;

                this.layerCtx.clearRect(0, 0, this.layerCanvas.width, this.layerCanvas.height);
                this.layerCtx.save();
                this.layerCtx.scale(retina, retina);
                this.layerCtx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);

                for (let j = 0; j < objs.length; j++) {
                    objs[j].render(this.layerCtx);
                }
                this.layerCtx.restore();

                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.globalAlpha = layer.opacity / 100;
                ctx.globalCompositeOperation = layer.blendMode || 'source-over';
                ctx.drawImage(this.layerCanvas, 0, 0);
                ctx.restore();
            }

            for (let i = 0; i < topLevelObjects.length; i++) {
                topLevelObjects[i].render(ctx);
            }
        };
    }
}