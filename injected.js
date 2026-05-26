/**
 * Script inyectable en la página de WhaTicket
 * Corre en el contexto de la página para mejor acceso a APIs
 */

console.log('✅ Injected script cargado en WhaTicket');

// Establecer un listener global para que el content script pueda pedir datos
window.__whaticketCSV = null;
window.__downloadInProgress = false;

// Escuchar fetch requests para CSV
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const request = args[0];
    const url = typeof request === 'string' ? request : request.url;
    
    return originalFetch.apply(this, args).then(response => {
        // Si es CSV, guardar el contenido
        if (url && (url.includes('.csv') || url.includes('export'))) {
            const clone = response.clone();
            clone.text().then(text => {
                if (text && text.includes(',')) {
                    window.__whaticketCSV = text;
                    console.log('📥 CSV capturado:', text.substring(0, 100) + '...');
                }
            });
        }
        return response;
    });
};

// También monitorear XMLHttpRequest
const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._url = url;
    return originalOpen.apply(this, [method, url, ...args]);
};

const originalSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(...args) {
    const self = this;
    const originalOnReadyStateChange = this.onreadystatechange;
    
    this.onreadystatechange = function() {
        if (self.readyState === 4 && self._url && (self._url.includes('.csv') || self._url.includes('export'))) {
            const text = self.responseText;
            if (text && text.includes(',')) {
                window.__whaticketCSV = text;
                console.log('📥 CSV capturado de XHR:', text.substring(0, 100) + '...');
            }
        }
        if (originalOnReadyStateChange) originalOnReadyStateChange.apply(this);
    };
    
    return originalSend.apply(this, args);
};

// Comunicación con el content script
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'GET_CSV') {
        window.postMessage(
            { type: 'CSV_RESPONSE', csv: window.__whaticketCSV },
            '*'
        );
    }
    
    if (event.data.type === 'CLICK_EXPORT') {
        // Buscar y hacer clic en el botón Exportar
        const exportBtn = findExportButton();
        if (exportBtn) {
            console.log('👆 Haciendo clic en Exportar');
            exportBtn.click();
            
            // Esperar a que se descargue el CSV
            let waited = 0;
            const checkInterval = setInterval(() => {
                waited += 100;
                if (window.__whaticketCSV || waited > 10000) {
                    clearInterval(checkInterval);
                    window.postMessage(
                        { type: 'EXPORT_DONE', csv: window.__whaticketCSV },
                        '*'
                    );
                }
            }, 100);
        }
    }
});

function findExportButton() {
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
        if (el.innerText === 'Exportar' && 
            getComputedStyle(el).cursor === 'pointer' &&
            el.offsetParent !== null) {
            return el;
        }
    }
    
    const paragraphs = document.querySelectorAll('p[style*="cursor"]');
    for (const p of paragraphs) {
        if (p.textContent.includes('Exportar') && p.offsetParent !== null) {
            return p;
        }
    }
    
    return null;
}

console.log('🚀 Injected script listo');
