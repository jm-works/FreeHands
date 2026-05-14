export class HistoryManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.undoStack = [];
        this.redoStack = [];
        this.isProcessing = false;

        this.saveState();
    }

    saveState() {
        if (this.isProcessing) return;
        this.undoStack.push(JSON.stringify(this.canvas));
        this.redoStack = [];
    }

    undo() {
        if (this.undoStack.length > 1) {
            this.isProcessing = true;
            this.redoStack.push(this.undoStack.pop());
            const prevState = this.undoStack[this.undoStack.length - 1];
            this.canvas.loadFromJSON(prevState, () => {
                this.canvas.renderAll();
                this.isProcessing = false;
            });
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            this.isProcessing = true;
            const nextState = this.redoStack.pop();
            this.undoStack.push(nextState);
            this.canvas.loadFromJSON(nextState, () => {
                this.canvas.renderAll();
                this.isProcessing = false;
            });
        }
    }
}