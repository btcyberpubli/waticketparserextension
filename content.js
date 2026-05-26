/**
 * Content Script - NO simula clicks, solo captura lo que el usuario hace
 */

console.log('✅ Content script listo');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Petición:', request.action);
    
    if (request.action === 'downloadCSV') {
        checkForCSV(sendResponse);
        return true;
    }
});

/**
 * Verifica si el CSV ya fue capturado
 */
function checkForCSV(sendResponse) {
    console.log('🔍 Buscando CSV capturado...');
    
    let waited = 0;
    const check = setInterval(() => {
        waited += 200;
        
        // Si ya existe el CSV
        if (window.__capturedCSV && window.__capturedCSV.length > 10) {
            clearInterval(check);
            console.log('✅ CSV encontrado');
            sendResponse({ csvData: window.__capturedCSV });
            return;
        }
        
        // Timeout después de 20 segundos
        if (waited > 20000) {
            clearInterval(check);
            console.error('❌ Timeout');
            sendResponse({ error: 'No se detectó descarga de CSV en 20 segundos' });
        }
    }, 200);
}

console.log('🚀 Escuchando...');




        return {
            headers: headers,
            rows: rows,
            rowCount: rows.length
        };
    } catch (error) {
        console.error('Error extrayendo datos:', error);
        return null;
    }
}

/**
 * Intenta detectar botones de descarga de CSV
 */
function findDownloadButton() {
    const buttons = document.querySelectorAll('button, a');
    
    for (let btn of buttons) {
        const text = btn.textContent.toLowerCase();
        if (text.includes('descargar') || text.includes('export') || text.includes('csv')) {
            return btn;
        }
    }
    
    return null;
}

console.log('✅ Content script de WhaTicket cargado');
