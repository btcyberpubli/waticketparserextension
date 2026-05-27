/**
 * Content Script - Ciclo completo: Captura → Procesa → Envía
 * El script inyectado captura el CSV, el content script lo procesa
 */

console.log('✅ Content script listo');

// ============================================
// INYECTAR SCRIPT EN CONTEXTO DE PÁGINA (world: MAIN)
// ============================================
function injectInterceptor() {
    return new Promise((resolve) => {
        try {
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.id = 'whaticket-csv-interceptor';
            
            script.textContent = `
(function() {
    console.log('🔧 [INJECTED] Instalando interceptor de descargas...');
    
    // INTERCEPTAR URL.createObjectURL para Blobs CSV
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = function(blob) {
        if (blob instanceof Blob) {
            console.log('📦 [INJECTED] Blob detectado:', blob.type, blob.size, 'bytes');
            
            if (blob.type.includes('csv') || 
                blob.type.includes('text') ||
                blob.type === 'application/octet-stream') {
                
                try {
                    blob.text().then(text => {
                        if (text && text.length > 100 && (text.includes(',') && text.includes('createdAt'))) {
                            console.log('🎯 [INJECTED] CSV capturado desde Blob');
                            console.log('✅ [INJECTED] Tamaño:', text.length, 'bytes');
                            window.__whaticketCSV = text;
                            window.__csvReady = true;
                            window.__csvSource = 'blob';
                        }
                    }).catch(e => console.error('❌ [INJECTED] Error leyendo blob:', e));
                } catch (e) {
                    console.error('❌ [INJECTED] Error capturando CSV:', e);
                }
            }
        }
        return originalCreateObjectURL.call(this, blob);
    };
    
    console.log('✅ [INJECTED] Interceptor de Blob/ObjectURL instalado');
    
    // INTERCEPTAR FETCH (backup)
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        return originalFetch.apply(this, args).then(async response => {
            const contentType = response.headers.get('content-type') || '';
            const contentDisposition = response.headers.get('content-disposition') || '';
            
            if (contentType.includes('csv') || contentDisposition.includes('.csv')) {
                try {
                    console.log('🎯 [INJECTED] CSV en fetch');
                    const text = await response.clone().text();
                    if (text && text.length > 100) {
                        console.log('✅ [INJECTED] CSV capturado fetch:', text.length, 'bytes');
                        window.__whaticketCSV = text;
                        window.__csvReady = true;
                        window.__csvSource = 'fetch';
                    }
                } catch (e) {}
            }
            return response;
        });
    };
    
    // INTERCEPTAR XHR (backup)
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(m, u, ...r) {
        this._xhrUrl = u;
        return origOpen.apply(this, [m, u, ...r]);
    };
    
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(...a) {
        this.addEventListener('load', function() {
            const ct = this.getResponseHeader('content-type') || '';
            if ((ct.includes('csv') || this._xhrUrl?.includes('export')) && 
                this.responseText?.length > 100 && this.responseText.includes(',')) {
                console.log('✅ [INJECTED] CSV capturado XHR:', this.responseText.length, 'bytes');
                window.__whaticketCSV = this.responseText;
                window.__csvReady = true;
                window.__csvSource = 'xhr';
            }
        });
        return origSend.apply(this, a);
    };
    
    console.log('🚀 [INJECTED] Interceptores activos');
})();
`;
            
            document.documentElement.appendChild(script);
            console.log('✅ Script inyectado en la página');
            
            script.onload = script.onerror = resolve;
            setTimeout(resolve, 100);
        } catch (e) {
            console.error('❌ Error inyectando script:', e);
            resolve();
        }
    });
}

// Inyectar al cargar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectInterceptor);
} else {
    injectInterceptor();
}

// ============================================
// ESCUCHAR MENSAJES DEL POPUP
// ============================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Petición:', request.action);
    
    if (request.action === 'downloadCSV') {
        iniciarDescargaCSV(sendResponse);
        return true;
    }
});

// ============================================
// FUNCIONES DE DESCARGA
// ============================================

function encontrarBotonExportar() {
    const todos = document.querySelectorAll('*');
    const botones = [];
    
    todos.forEach(el => {
        const texto = (el.innerText || el.textContent || '').trim();
        if (texto === 'Exportar') {
            botones.push({
                elemento: el,
                tag: el.tagName,
                clases: el.className,
                padre: el.parentElement.className
            });
        }
    });
    
    console.log('🔍 Botones "Exportar" encontrados:', botones.length);
    return botones;
}

function abrirModalExportar() {
    console.log('📋 Abriendo modal...');
    const botones = encontrarBotonExportar();
    if (botones[1]) {
        botones[1].elemento.click();
        console.log('✅ Modal abierto');
        return true;
    }
    console.error('❌ No encontré el botón');
    return false;
}

function encontrarOpcionCSV() {
    const menuItems = document.querySelectorAll('[role="menuitem"]');
    const opciones = [];
    
    menuItems.forEach((item, i) => {
        const texto = item.innerText.trim();
        if (texto === 'CSV' || texto === 'XLSX') {
            opciones.push({
                texto,
                indice: i,
                elemento: item
            });
        }
    });
    
    console.log('📊 Opciones encontradas:', opciones.length);
    opciones.forEach(opt => console.log(`  → ${opt.texto}`));
    return opciones;
}

function descargarCSV() {
    console.log('⏳ Esperando modal...');
    
    setTimeout(() => {
        const opciones = encontrarOpcionCSV();
        const csvOption = opciones.find(opt => opt.texto === 'CSV');
        
        if (csvOption) {
            console.log('✅ HACIENDO CLICK EN CSV...');
            csvOption.elemento.click();
            console.log('📥 Descarga iniciada');
        } else {
            console.error('❌ No encontré la opción CSV');
        }
    }, 1500);
}

// ============================================
// PROCESAR CSV
// ============================================
function csvToJson(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
        console.error('❌ CSV sin datos');
        return [];
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const obj = {};
        const currentLine = lines[i].split(',');
        
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = currentLine[j] ? currentLine[j].trim() : '';
        }
        
        if (obj.createdAt) data.push(obj);
    }
    
    console.log('📊 CSV convertido a JSON:', data.length, 'registros');
    return data;
}

// ============================================
// ENVIAR A SERVIDOR
// ============================================
async function enviarAlServidor(panelsProcessados) {
    console.log('\n🚀 ENVIANDO A SERVIDOR...');
    console.log('📦 Paneles a enviar:', panelsProcessados.length);
    
    try {
        console.log('\n📤 POST REQUEST:');
        console.log('   URL: https://accountant-services.co.uk/api/paneles');
        console.log('   Body:', JSON.stringify(panelsProcessados, null, 2));
        
        const response = await fetch('https://accountant-services.co.uk/api/paneles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(panelsProcessados)
        });
        
        console.log('✅ RESPUESTA DEL SERVIDOR:');
        console.log('   Status:', response.status);
        
        const apiResult = await response.json();
        console.log('   Body:', apiResult);
        
        if (apiResult.success) {
            console.log(`\n✅ SUCCESS: ${apiResult.paneles_guardados} paneles guardados`);
            return { success: true, result: apiResult };
        } else {
            console.error(`❌ ERROR: ${apiResult.error}`);
            return { success: false, error: apiResult.error };
        }
    } catch (error) {
        console.error('❌ Error enviando:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// FUNCIÓN PRINCIPAL - CICLO COMPLETO
// ============================================
function iniciarDescargaCSV(sendResponse) {
    console.log('\n🚀 ===== INICIANDO CICLO COMPLETO =====\n');
    console.log('📊 Estrategia: Downloads API + Interceptores');
    
    try {
        // Paso 1: Abrir modal
        abrirModalExportar();
        
        // Paso 2: Hacer click en CSV
        descargarCSV();
        
        // Paso 3: Esperar CSV
        let waited = 0;
        let responded = false;
        let intentos = 0;
        
        // Intentar leer CSV cada 1 segundo (muy agresivo)
        const check = setInterval(async () => {
            if (responded) return;
            
            waited += 1000;
            intentos++;
            
            console.log(`\n⏳ Intento #${intentos} (${waited/1000}s)`);
            
            // OPCIÓN 1: Leer del storage (rellenado por background.js)
            console.log('   1️⃣ Verificando storage...');
            chrome.runtime.sendMessage(
                { type: 'GET_CSV_FROM_STORAGE' },
                async (response) => {
                    if (response) {
                        console.log('      ✅ Respuesta recibida:', {
                            hasCsv: !!response.csv,
                            size: response.csv?.length,
                            ready: response.ready,
                            source: response.source
                        });
                        
                        if (response.csv && response.csv.length > 100) {
                            console.log('      ✅✅✅ CSV ENCONTRADO EN STORAGE');
                            procesarYEnviarCSV(response.csv, response.source);
                            return;
                        }
                    } else {
                        console.log('      ❌ Sin respuesta del background');
                    }
                    
                    // OPCIÓN 2: Verificar interceptores
                    console.log('   2️⃣ Verificando interceptores...');
                    if (window.__whaticketCSV && window.__whaticketCSV.length > 100) {
                        console.log('      ✅✅✅ CSV ENCONTRADO EN INTERCEPTOR');
                        procesarYEnviarCSV(window.__whaticketCSV, window.__csvSource);
                        return;
                    }
                    
                    console.log('   ⏳ Aún no disponible, esperando...');
                }
            );
            
            // Timeout: 30 segundos
            if (waited > 30000 && !responded) {
                clearInterval(check);
                responded = true;
                
                console.error('\n❌ TIMEOUT (30 segundos)');
                console.log('   Intentos realizados:', intentos);
                console.log('   Último estado del storage:', window.__whaticketCSV ? 'TIENE CSV' : 'NO TIENE CSV');
                
                sendResponse({ error: 'Timeout esperando CSV' });
            }
        }, 1000);
        
        async function procesarYEnviarCSV(csvText, source) {
            if (responded) return;
            clearInterval(check);
            responded = true;
            
            console.log('\n✅ CSV CAPTURADO EXITOSAMENTE');
            console.log('   Tamaño:', csvText.length, 'bytes');
            console.log('   Fuente:', source);
            console.log('   Primeros 200 chars:', csvText.substring(0, 200));
            
            // ========================================
            // PASO 4: PROCESAR CSV
            // ========================================
            console.log('\n⚙️ PROCESANDO CSV...');
            
            try {
                const jsonData = csvToJson(csvText);
                console.log('   ✅ JSON parseado:', jsonData.length, 'filas');
                
                if (jsonData.length === 0) {
                    throw new Error('No se encontraron datos válidos en el CSV');
                }
                
                const processedResult = processCSV(jsonData);
                console.log('   ✅ Resultado procesamiento:', processedResult);
                
                if (!processedResult.success) {
                    throw new Error(processedResult.error);
                }
                
                console.log('✅ CSV PROCESADO EXITOSAMENTE');
                console.log('   Paneles:', processedResult.data.length);
                console.log('   Conversaciones:', processedResult.statistics.total_conversaciones);
                
                // ========================================
                // PASO 5: ENVIAR A SERVIDOR
                // ========================================
                console.log('\n📤 ENVIANDO A SERVIDOR');
                
                const panelsConId = processedResult.data.map((panel, idx) => ({
                    ...panel,
                    id: `panel_${idx + 1}`
                }));
                
                const envioResult = await enviarAlServidor(panelsConId);
                
                if (envioResult.success) {
                    console.log('\n🎉 ===== CICLO COMPLETO EXITOSO =====\n');
                    
                    // Limpiar storage
                    chrome.runtime.sendMessage({ type: 'CLEAR_CSV_STORAGE' });
                    
                    sendResponse({ 
                        success: true,
                        csvData: csvText,
                        processedData: processedResult,
                        serverResponse: envioResult.result
                    });
                } else {
                    console.error('\n❌ Error en envío:', envioResult.error);
                    sendResponse({ 
                        success: false,
                        error: 'Error enviando a servidor: ' + envioResult.error
                    });
                }
                
            } catch (processingError) {
                console.error('\n❌ Error procesando:', processingError.message);
                console.error('   Stack:', processingError.stack);
                sendResponse({ 
                    success: false,
                    csvData: csvText,
                    error: 'Error: ' + processingError.message
                });
            }
        }
        
        console.log('⏳ Esperando captura de CSV...');
        console.log('   • Intentará cada 1 segundo');
        console.log('   • Máximo 30 segundos');
        console.log('   • Verificará: Storage + Interceptores\n');
        
    } catch (error) {
        console.error('❌ Error fatal:', error);
        console.error('   Stack:', error.stack);
        sendResponse({ error: error.message });
    }
}

console.log('🚀 Content script cargado correctamente');
