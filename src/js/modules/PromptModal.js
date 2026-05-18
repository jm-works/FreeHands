import { BaseModal } from './BaseModal.js';

export class PromptModal extends BaseModal {
    constructor() {
        super(100000);

        this.inputEl = document.createElement('input');
        this.inputEl.type = 'text';
        this.inputEl.className = 'custom-modal-input';
        this.modal.insertBefore(this.inputEl, this.btnContainer);

        this.btnCancel = this._createButton('Cancel', 'cancel');
        this.btnConfirm = this._createButton('Confirm', 'confirm');

        this.btnCancel.onclick = () => this.close(null);
        this.btnConfirm.onclick = () => this.close(this.inputEl.value);

        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                this.close(this.inputEl.value);
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.close(null);
            }
        });
    }

    show(message, defaultValue, callback) {
        this.inputEl.value = defaultValue;
        this.callback = callback;
        super.show(message);
    }

    _onShow() {
        this.inputEl.focus();
        this.inputEl.select();
    }

    close(value) {
        this.overlay.style.display = 'none';
        if (this.callback) {
            setTimeout(() => this.callback(value), 10);
        }
    }
}

export const promptModal = new PromptModal();