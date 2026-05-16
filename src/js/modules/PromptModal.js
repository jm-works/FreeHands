export class PromptModal {
    constructor() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'custom-modal-overlay';
        this.overlay.style.zIndex = '100000';

        this.modal = document.createElement('div');
        this.modal.className = 'custom-modal';

        this.messageEl = document.createElement('div');
        this.messageEl.className = 'custom-modal-message';

        this.inputEl = document.createElement('input');
        this.inputEl.type = 'text';
        this.inputEl.className = 'custom-modal-input';

        this.btnContainer = document.createElement('div');
        this.btnContainer.className = 'custom-modal-btns';

        this.btnCancel = document.createElement('button');
        this.btnCancel.className = 'custom-modal-btn cancel';
        this.btnCancel.textContent = 'Cancel';

        this.btnConfirm = document.createElement('button');
        this.btnConfirm.className = 'custom-modal-btn confirm';
        this.btnConfirm.textContent = 'Confirm';

        this.btnContainer.appendChild(this.btnCancel);
        this.btnContainer.appendChild(this.btnConfirm);

        this.modal.appendChild(this.messageEl);
        this.modal.appendChild(this.inputEl);
        this.modal.appendChild(this.btnContainer);
        this.overlay.appendChild(this.modal);

        document.body.appendChild(this.overlay);

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
        this.messageEl.textContent = message;
        this.inputEl.value = defaultValue;
        this.callback = callback;
        setTimeout(() => {
            this.overlay.style.display = 'flex';
            this.inputEl.focus();
            this.inputEl.select();
        }, 10);
    }

    close(value) {
        this.overlay.style.display = 'none';
        if (this.callback) {
            setTimeout(() => {
                this.callback(value);
            }, 10);
        }
    }
}

export const promptModal = new PromptModal();