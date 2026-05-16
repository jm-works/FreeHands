export class MenuManager {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        this.menus = {};

        this.initEvents();
    }

    initEvents() {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.menu-item')) {
                this.closeAllMenus();
            }
        });
    }

    registerMenu(triggerId, menuItems) {
        const triggerEl = document.getElementById(triggerId);
        if (!triggerEl) return;

        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown-menu';

        menuItems.forEach(item => {
            if (item.type === 'separator') {
                const sep = document.createElement('div');
                sep.className = 'dropdown-separator';
                dropdown.appendChild(sep);
            } else {
                const el = document.createElement('div');
                el.className = 'dropdown-item';
                el.textContent = item.label;
                el.onclick = (e) => {
                    e.stopPropagation();
                    this.closeAllMenus();
                    if (item.action) item.action();
                };
                dropdown.appendChild(el);
            }
        });

        triggerEl.appendChild(dropdown);

        triggerEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const isShowing = dropdown.classList.contains('show');
            this.closeAllMenus();
            if (!isShowing) {
                dropdown.classList.add('show');
            }
        });

        this.menus[triggerId] = dropdown;
    }

    closeAllMenus() {
        Object.values(this.menus).forEach(menu => {
            menu.classList.remove('show');
        });
    }
}