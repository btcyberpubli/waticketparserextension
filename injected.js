/**
 * Script inyectable en la página de WhaTicket (world: MAIN)
 * Intercepta descargas de blobs mediante Monkey Patching en document.createElement
 */

(function() {
    console.log('[Extension] 🚀 Iniciando interceptor de descargas...');
    
    const originalCreateElement = document.createElement;

    document.createElement = function(tagName) {
        const element = originalCreateElement.call(document, tagName);

        // Si la app intenta crear un enlace de descarga (etiqueta 'a')
        if (tagName.toLowerCase() === 'a') {
            Object.defineProperty(element, 'href', {
                set: function(value) {
                    // Si el enlace apunta a un archivo binario en memoria (Blob)
                    if (value && value.startsWith('blob:')) {
                        console.log('[Extension] 📦 Enlace Blob detectado:', value.substring(0, 50) + '...');
                        
                        // Extraemos el texto del archivo
                        fetch(value)
                            .then(res => res.text())
                            .then(csvText => {
                                console.log('[Extension] ✅ CSV Capturado con éxito.');
                                console.log('[Extension] 📊 Tamaño:', csvText.length, 'chars');
                                console.log('[Extension] 📄 Primeros 150 chars:', csvText.substring(0, 150));
                                
                                // Enviamos el CSV al Content Script a través de un evento personalizado del DOM
                                window.dispatchEvent(new CustomEvent('WHATICKET_CSV_CAPTURED', { 
                                    detail: { 
                                        csv: csvText,
                                        source: 'blob-fetch',
                                        size: csvText.length
                                    } 
                                }));
                                
                                console.log('[Extension] 📤 Evento enviado a content.js');
                            })
                            .catch(err => {
                                console.error('[Extension] ❌ Error al leer el blob:', err);
                            });
                    }
                    this.setAttribute('href', value);
                },
                configurable: true
            });
        }
        return element;
    };
    
    console.log('[Extension] ✅ Interceptor de descargas inyectado correctamente.');
    console.log('[Extension] 🎯 Esperando que se disparen descargas de blobs...');
    
})();
