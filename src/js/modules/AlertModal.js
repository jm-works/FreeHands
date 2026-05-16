export class AlertModal {
    constructor() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'custom-modal-overlay';
        this.overlay.style.zIndex = '100001';

        this.modal = document.createElement('div');
        this.modal.className = 'custom-modal';

        this.messageEl = document.createElement('div');
        this.messageEl.className = 'custom-modal-message';

        this.btnContainer = document.createElement('div');
        this.btnContainer.className = 'custom-modal-btns';

        this.btnConfirm = document.createElement('button');
        this.btnConfirm.className = 'custom-modal-btn confirm';
        this.btnConfirm.textContent = 'OK';

        this.btnContainer.appendChild(this.btnConfirm);
        this.modal.appendChild(this.messageEl);
        this.modal.appendChild(this.btnContainer);
        this.overlay.appendChild(this.modal);

        document.body.appendChild(this.overlay);

        this.btnConfirm.onclick = () => this.close();

        window.addEventListener('keydown', (e) => {
            if (this.overlay.style.display === 'flex') {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.close();
                }
            }
        }, { capture: true });
    }

    show(message) {
        this.messageEl.textContent = message;
        setTimeout(() => {
            this.overlay.style.display = 'flex';
            this.btnConfirm.focus();
        }, 10);
    }

    close() {
        this.overlay.style.display = 'none';
    }
}

export const alertModal = new AlertModal();