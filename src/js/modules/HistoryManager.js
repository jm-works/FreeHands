export class HistoryManager {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        this.canvas = canvasManager.canvas;
        this.undoStack = [];
        this.redoStack = [];
        this.isProcessing = false;
    }

    saveState() {
        if (this.isProcessing || !this.canvasManager.layerManager || !this.canvas) return;

        const state = {
            canvas: this.canvas.toJSON(['layerId', 'isBg']),
            layers: this.canvasManager.layerManager.getLayersState()
        };

        this.undoStack.push(JSON.stringify(state));
        if (this.undoStack.length > 20) {
            this.undoStack.shift();
        }

        this.redoStack = [];
    }

    undo() {
        if (this.undoStack.length > 1) {
            this.isProcessing = true;
            const currentState = this.undoStack.pop();
            this.redoStack.push(currentState);

            const prevStateJSON = this.undoStack[this.undoStack.length - 1];
            const prevState = JSON.parse(prevStateJSON);

            this.canvas.loadFromJSON(prevState.canvas, () => {
                this.canvasManager.layerManager.restoreLayersState(prevState.layers);
                if (this.canvasManager.textureHandler) {
                    const orig = this.canvasManager.textureHandler.setPaperTexture.bind(this.canvasManager.textureHandler);
                    const textureId = this.canvasManager.textureHandler.currentTextureId;
                    if (textureId && textureId !== 'none') {
                        this.canvasManager.textureHandler.setPaperTexture(textureId, true);
                        setTimeout(() => {
                            this.canvas.renderAll();
                            this.isProcessing = false;
                        }, 50);
                        return;
                    }
                }
                this.canvas.renderAll();
                this.isProcessing = false;
            });
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            this.isProcessing = true;
            const nextStateJSON = this.redoStack.pop();
            const nextState = JSON.parse(nextStateJSON);

            this.undoStack.push(nextStateJSON);

            this.canvas.loadFromJSON(nextState.canvas, () => {
                this.canvasManager.layerManager.restoreLayersState(nextState.layers);
                if (this.canvasManager.textureHandler) {
                    const textureId = this.canvasManager.textureHandler.currentTextureId;
                    if (textureId && textureId !== 'none') {
                        this.canvasManager.textureHandler.setPaperTexture(textureId, true);
                        setTimeout(() => {
                            this.canvas.renderAll();
                            this.isProcessing = false;
                        }, 50);
                        return;
                    }
                }
                this.canvas.renderAll();
                this.isProcessing = false;
            });
        }
    }
}