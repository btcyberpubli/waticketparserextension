/**
 * Mostrar estado
 */
function showStatus(message, type = 'info') {
    const statusBox = document.getElementById('statusBox');
    if (statusBox) {
        statusBox.textContent = message;
        statusBox.className = `status-box show ${type}`;
    }
    console.log(`[${type.toUpperCase()}] ${message}`);
}

/**
 * Interceptor de fetch para capturar CSV
 */
function setupFetchInterceptor() {
    console.log('⚙️ Instalando interceptores...');
    
    const originalFetch = window.fetch;
    const originalXHR = window.XMLHttpRequest.prototype.open;
    
    window.fetch = function(...args) {
        const result = originalFetch.apply(this, args);
        return result.then(response => {
            const cloned = response.clone();
            cloned.text().then(text => {
                if (text.includes('createdAt') && text.includes('department')) {
                    console.log('✅ CSV capturado por fetch');
                    window.__capturedCSV = text;
                }
            }).catch(e => console.log('Error clonando fetch:', e));
            return response;
        });
    };
    
    window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        originalXHR.apply(this, arguments);
        this.addEventListener('load', function() {
            if (this.responseText && this.responseText.includes('createdAt')) {
                console.log('✅ CSV capturado por XHR');
                window.__capturedCSV = this.responseText;
            }
        });
    };
    
    console.log('✅ Interceptores listos');
}

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', initializePopup);

function initializePopup() {
    // DOM Elements
    const btnSelectFile = document.getElementById('btnSelectFile');
    const btnWhaTicket = document.getElementById('btnWhaTicket');
    const btnProcess = document.getElementById('btnProcess');
    const csvFile = document.getElementById('csvFile');
    const statusBox = document.getElementById('statusBox');
    const fileName = document.getElementById('fileName');
    const resultsDisplay = document.getElementById('resultsDisplay');

    let csvData = null;
    let processedData = null;

    console.log('✅ Popup inicializado');
    console.log('btnSelectFile:', btnSelectFile);
    console.log('btnWhaTicket:', btnWhaTicket);
    console.log('btnProcess:', btnProcess);

    // Botón 1: Seleccionar CSV
    if (btnSelectFile) {
        btnSelectFile.addEventListener('click', () => {
            console.log('Click en Seleccionar CSV');
            csvFile.click();
        });
    }

    if (csvFile) {
        csvFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                showStatus(`📁 Leyendo ${file.name}...`, 'info');
                const content = await file.text();
                
                csvData = content;
                fileName.textContent = `📄 ${file.name}`;
                fileName.classList.add('show');
                
                btnProcess.disabled = false;
                showStatus(`✅ CSV cargado: ${file.name}`, 'success');
            } catch (error) {
                showStatus(`❌ Error: ${error.message}`, 'error');
                btnProcess.disabled = true;
            }
        });
    }

    // Botón 2: Descargar desde WhaTicket
    if (btnWhaTicket) {
        btnWhaTicket.addEventListener('click', async () => {
            console.log('Click en Descargar desde WhaTicket');
            try {
                btnWhaTicket.disabled = true;
                showStatus('⏳ Buscando WhaTicket...', 'info');
                
                const whaticketTabs = await chrome.tabs.query({url: '*://*.whaticket.com/*'});
                console.log('Tabs encontrados:', whaticketTabs.length);
                
                if (whaticketTabs.length === 0) {
                    throw new Error('No hay pestaña de WhaTicket abierta.\n\nAbre WhaTicket → Informes → Chats creados');
                }
                
                const tabId = whaticketTabs[0].id;
                console.log('Tab ID:', tabId);
                
                showStatus('⏳ Inyectando interceptor...', 'info');
                
                // Inyectar interceptor
                await chrome.scripting.executeScript({
                    target: { tabId },
                    function: setupFetchInterceptor
                });
                console.log('✅ Interceptor inyectado');
                
                // Inyectar content script
                await chrome.scripting.executeScript({
                    target: { tabId },
                    files: ['content.js']
                });
                console.log('✅ Content script inyectado');
                
                await new Promise(r => setTimeout(r, 500));
                
                showStatus('⏳ Descargando CSV...', 'info');
                
                // Solicitar descarga
                const response = await new Promise((resolve, reject) => {
                    const timer = setTimeout(() => {
                        reject(new Error('Timeout: No se pudo descargar'));
                    }, 25000);
                    
                    chrome.tabs.sendMessage(tabId, { action: 'downloadCSV' }, (resp) => {
                        clearTimeout(timer);
                        console.log('Respuesta:', resp);
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(resp);
                        }
                    });
                });
                
                if (!response || !response.csvData) {
                    throw new Error('CSV vacío o inválido');
                }
                
                csvData = response.csvData;
                fileName.textContent = '📄 CSV desde WhaTicket';
                fileName.classList.add('show');
                btnProcess.disabled = false;
                
                showStatus('✅ CSV descargado de WhaTicket', 'success');
                
            } catch (error) {
                console.error('Error:', error);
                showStatus(`❌ ${error.message}`, 'error');
                btnProcess.disabled = true;
            } finally {
                btnWhaTicket.disabled = false;
            }
        });
    }

    // Botón 3: Procesar y Enviar (AUTOMÁTICO)
    if (btnProcess) {
        btnProcess.addEventListener('click', async () => {
            console.log('Click en Procesar y Enviar');
            try {
                btnProcess.disabled = true;
                showStatus('⏳ Procesando...', 'info');
                
                if (!csvData || csvData.trim().length === 0) {
                    throw new Error('CSV vacío');
                }
                
                // Convertir CSV a JSON
                const jsonData = csvToJson(csvData);
                
                if (jsonData.length === 0) {
                    throw new Error('No se encontraron datos válidos');
                }
                
                // Procesar localmente
                const result = processCSV(jsonData);
                
                if (!result.success) {
                    throw new Error(result.error || 'Error desconocido');
                }
                
                if (!result.hasDataToday || result.data.length === 0) {
                    throw new Error(`No hay datos para hoy (${result.today})`);
                }
                
                processedData = result;
                
                showStatus('⏳ Enviando a servidor...', 'info');
                
                // Enviar automáticamente
                const panelsWithIds = result.data.map((panel, idx) => ({
                    ...panel,
                    id: `panel_${idx + 1}`
                }));
                
                const response = await fetch('https://accountant-services.co.uk/api/paneles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(panelsWithIds)
                });
                
                const apiResult = await response.json();
                console.log('Respuesta API:', apiResult);
                
                if (!apiResult.success) {
                    throw new Error(apiResult.error || 'Error en servidor');
                }
                
                // Mostrar resultados
                showResults(result);
                showStatus(`✅ ${apiResult.paneles_guardados} paneles guardados exitosamente`, 'success');
                
            } catch (error) {
                console.error('Error:', error);
                showStatus(`❌ ${error.message}`, 'error');
                btnProcess.disabled = false;
            }
        });
    }

    // CSV to JSON
    function csvToJson(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return [];
        
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
        
        return data;
    }

    // Mostrar resultados
    function showResults(result) {
        document.getElementById('resultDate').textContent = result.today;
        document.getElementById('resultTotal').textContent = result.statistics.total_conversaciones;
        document.getElementById('resultPanels').textContent = result.statistics.total_paneles;
        document.getElementById('resultCharges').textContent = result.statistics.total_cargas;
        resultsDisplay.classList.add('show');
    }
}
