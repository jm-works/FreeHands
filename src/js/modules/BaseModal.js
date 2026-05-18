export class BaseModal {
    constructor(zIndex = 100000) {
        this.overlay = document.createElement('div');
        this.overlay.className = 'custom-modal-overlay';
        this.overlay.style.zIndex = String(zIndex);

        this.modal = document.createElement('div');
        this.modal.className = 'custom-modal';

        this.messageEl = document.createElement('div');
        this.messageEl.className = 'custom-modal-message';

        this.btnContainer = document.createElement('div');
        this.btnContainer.className = 'custom-modal-btns';

        this.modal.appendChild(this.messageEl);
        this.modal.appendChild(this.btnContainer);
        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);
    }

    _createButton(label, className) {
        const btn = document.createElement('button');
        btn.className = `custom-modal-btn ${className}`.trim();
        btn.textContent = label;
        this.btnContainer.appendChild(btn);
        return btn;
    }

    show(message) {
        this.messageEl.textContent = message;
        setTimeout(() => {
            this.overlay.style.display = 'flex';
            this._onShow();
        }, 10);
    }

    _onShow() { }

    close() {
        this.overlay.style.display = 'none';
    }
}