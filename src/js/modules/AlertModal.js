import { BaseModal } from './BaseModal.js';

export class AlertModal extends BaseModal {
    constructor() {
        super(100001);

        this.btnConfirm = this._createButton('OK', 'confirm');
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

    _onShow() {
        this.btnConfirm.focus();
    }
}

export const alertModal = new AlertModal();