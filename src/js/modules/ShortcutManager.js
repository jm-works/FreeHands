export class ShortcutManager {
    constructor(cm) {
        this.cm = cm;
        this._map = new Map();
        this._init();
    }

    register(key, fn) {
        this._map.set(key, fn);
    }

    unregister(key) {
        this._map.delete(key);
    }

    dispatch(e) {
        const key = this._resolve(e);
        const handler = this._map.get(key);
        if (!handler) return false;
        e.preventDefault();
        handler(this.cm);
        return true;
    }

    _resolve(e) {
        const parts = [];
        if (e.ctrlKey || e.metaKey) parts.push('ctrl');
        if (e.shiftKey) parts.push('shift');

        let k;
        if (e.code === 'BracketLeft') k = '[';
        else if (e.code === 'BracketRight') k = ']';
        else k = e.key.length === 1 ? e.key.toLowerCase() : e.key;

        parts.push(k);
        return parts.join('+');
    }

    _init() {
        this.register('b', cm => cm.setTool('brush'));
        this.register('p', cm => cm.setTool('pen'));
        this.register('e', cm => cm.setTool('eraser'));
        this.register('g', cm => cm.setTool('fill'));
        this.register('l', cm => cm.setTool('line'));
        this.register('u', cm => cm.setTool('rectangle'));
        this.register('o', cm => cm.setTool('ellipse'));
        this.register('k', cm => cm.setTool('cutarea'));
        this.register('v', cm => cm.setTool('select'));
        this.register('h', cm => cm.setTool('pan'));
        this.register('i', cm => cm.pickColor());

        this.register(']', cm => cm.setBrushSize(Math.min(cm.brushSize + 2, 100)));
        this.register('[', cm => cm.setBrushSize(Math.max(cm.brushSize - 2, 1)));

        this.register('shift+]', cm => {
            const next = Math.min(Math.round(cm.brushOpacity * 100) + 5, 100);
            cm.setBrushOpacity(next);
        });
        this.register('shift+[', cm => {
            const prev = Math.max(Math.round(cm.brushOpacity * 100) - 5, 0);
            cm.setBrushOpacity(prev);
        });

        this.register('ctrl+z', cm => cm.historyManager.undo());
        this.register('ctrl+shift+z', cm => cm.historyManager.redo());
        this.register('ctrl+y', cm => cm.historyManager.redo());

        this.register('ctrl+c', cm => cm.clipboardCopy());
        this.register('ctrl+x', cm => cm.clipboardCut());
        this.register('ctrl+v', cm => cm.clipboardPaste());
        this.register('ctrl+d', cm => cm.clipboardDuplicate());
    }

    destroy() {
        this._map.clear();
    }
}