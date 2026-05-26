// Elementos del DOM
const csvFileInput = document.getElementById('csvFile');
const csvDataInput = document.getElementById('csvData');
const parseBtn = document.getElementById('parseBtn');
const clearBtn = document.getElementById('clearBtn');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const errorDiv = document.getElementById('errorDiv');
const successDiv = document.getElementById('successDiv');
const tabs = document.querySelectorAll('.tab');
const tabManualBtn = document.getElementById('tabManual');
const tabWhaTicketBtn = document.getElementById('tabWhaTicket');
const manualTab = document.getElementById('manualTab');
const whaticketTab = document.getElementById('whaticketTab');
const autoDownloadBtn = document.getElementById('autoDownloadBtn');

// Event Listeners
parseBtn.addEventListener('click', handleParse);
clearBtn.addEventListener('click', handleClear);

// Tabs de entrada
tabManualBtn.addEventListener('click', () => {
    manualTab.style.display = 'block';
    whaticketTab.style.display = 'none';
    tabManualBtn.style.borderBottomColor = '#667eea';
    tabManualBtn.style.color = '#333';
    tabWhaTicketBtn.style.borderBottomColor = 'transparent';
    tabWhaTicketBtn.style.color = '#999';
});

tabWhaTicketBtn.addEventListener('click', () => {
    manualTab.style.display = 'none';
    whaticketTab.style.display = 'block';
    tabManualBtn.style.borderBottomColor = 'transparent';
    tabManualBtn.style.color = '#999';
    tabWhaTicketBtn.style.borderBottomColor = '#667eea';
    tabWhaTicketBtn.style.color = '#333';
});

// Botón de auto-download desde WhaTicket
autoDownloadBtn.addEventListener('click', async () => {
    try {
        autoDownloadBtn.disabled = true;
        autoDownloadBtn.textContent = '⏳ Preparando...';
        
        // Obtener la pestaña activa de WhaTicket
        const whaticketTabs = await chrome.tabs.query({url: '*://*.whaticket.com/*'});
        
        if (whaticketTabs.length === 0) {
            throw new Error('❌ No hay pestaña de WhaTicket abierta.\n\n📋 Instrucciones:\n1. Abre WhaTicket en una pestaña\n2. Ve a Informes → Chats creados\n3. Presiona el botón azul de aquí\n4. Luego haz CLICK en "Exportar" en WhaTicket');
        }
        
        const whaticketTab = whaticketTabs[0];
        
        // Inyectar los interceptores
        autoDownloadBtn.textContent = '⏳ Activando captura...';
        
        await chrome.scripting.executeScript({
            target: { tabId: whaticketTab.id },
            function: setupFetchInterceptor
        });
        
        // Inyectar content script
        await chrome.scripting.executeScript({
            target: { tabId: whaticketTab.id },
            files: ['content.js']
        });
        
        // Esperar a que se cargue
        await new Promise(r => setTimeout(r, 500));
        
        autoDownloadBtn.textContent = '⏳ Esperando CSV...';
        showSuccess('🎯 Ahora:\n1. Ve a WhaTicket\n2. Haz CLICK en el botón "Exportar"\n3. La extensión capturará automáticamente el CSV');
        
        // Esperar a que el usuario exporte
        const response = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('⏱️ No se detectó descarga en 25 segundos. Asegúrate de:\n- Estar en "Informes → Chats creados"\n- Hacer click en "Exportar"'));
            }, 25000);
            
            chrome.tabs.sendMessage(whaticketTab.id, 
                { action: 'downloadCSV' },
                (response) => {
                    clearTimeout(timer);
                    
                    if (chrome.runtime.lastError) {
                        reject(new Error(`Error: ${chrome.runtime.lastError.message}`));
                        return;
                    }
                    
                    if (!response) {
                        reject(new Error('Sin respuesta'));
                        return;
                    }
                    
                    resolve(response);
                }
            );
        });
        
        // Verificar respuesta
        if (response.error) {
            throw new Error(response.error);
        }
        
        if (!response.csvData || response.csvData.trim().length < 20) {
            throw new Error('CSV vacío o inválido');
        }
        
        // Cargar CSV
        csvDataInput.value = response.csvData;
        tabManualBtn.click();
        showSuccess('✅ CSV descargado exitosamente');
        
    } catch (error) {
        console.error('❌ Error:', error);
        showError(`${error.message}`);
    } finally {
        autoDownloadBtn.disabled = false;
        autoDownloadBtn.textContent = '⬇️ Descargar desde WhaTicket';
    }
});

/**
 * Función inyectada en WhaTicket para interceptar fetch Y XMLHttpRequest
 */
function setupFetchInterceptor() {
    console.log('⚙️ Instalando interceptores...');
    
    // Interceptar FETCH
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        
        return originalFetch.apply(this, args).then(async (response) => {
            const contentType = response.headers.get('content-type') || '';
            const isCSV = contentType.includes('csv') || 
                         contentType.includes('text') ||
                         url.includes('csv') || 
                         url.includes('export') ||
                         url.includes('report');
            
            if (isCSV && response.ok) {
                try {
                    const text = await response.clone().text();
                    if (text && (text.includes(',') || text.includes('createdAt'))) {
                        window.__capturedCSV = text;
                        console.log('✅ CSV capturado (fetch)');
                    }
                } catch(e) {
                    console.log('⚠️ Error clonando:', e.message);
                }
            }
            
            return response;
        });
    };
    
    // Interceptar XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return originalOpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function() {
        const self = this;
        const originalOnReadyStateChange = this.onreadystatechange;
        
        this.onreadystatechange = function() {
            if (self.readyState === 4 && self.status === 200) {
                const url = self._url || '';
                const isCSV = url.includes('csv') || 
                             url.includes('export') ||
                             url.includes('report') ||
                             self.responseText?.includes('createdAt');
                
                if (isCSV && self.responseText) {
                    if (self.responseText.includes(',')) {
                        window.__capturedCSV = self.responseText;
                        console.log('✅ CSV capturado (XHR)');
                    }
                }
            }
            
            if (originalOnReadyStateChange) {
                originalOnReadyStateChange.apply(this);
            }
        };
        
        return originalSend.apply(this, arguments);
    };
    
    console.log('✅ Interceptores listos');
}

// Manejar selección de archivo CSV
csvFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const content = await file.text();
        csvDataInput.value = content;
        hideError();
    } catch (error) {
        showError(`Error al leer archivo: ${error.message}`);
    }
});
// Tabs
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        switchTab(tabName);
    });
});

// Procesar datos
async function handleParse() {
    const csvText = csvDataInput.value.trim();

    // Validar input
    if (!csvText) {
        showError('Por favor pega datos CSV');
        return;
    }

    // Limpiar errores
    hideError();
    hideSuccess();

    // Mostrar loading
    loading.style.display = 'block';
    results.style.display = 'none';
    parseBtn.disabled = true;

    try {
        // Convertir CSV a JSON
        const jsonData = csvToJson(csvText);

        if (jsonData.length === 0) {
            throw new Error('No se encontraron datos válidos en el CSV');
        }

        console.log('📊 Procesando localmente:', jsonData.length, 'registros');

        // Procesar CSV localmente (SIN servidor)
        const result = processCSV(jsonData);

        if (!result.success) {
            throw new Error(result.error || 'Error desconocido');
        }

        console.log('✅ Datos procesados:', result);

        // Validar que hay datos de HOY
        if (!result.hasDataToday || !result.data || result.data.length === 0) {
            throw new Error(`⚠️ No hay datos para HOY (${result.today}). Fechas encontradas: ${result.allDatesFound.join(', ')}`);
        }

        // Guardar datos para envío posterior
        window.processedData = result.data;
        window.processingResult = result;

        // Mostrar resultados
        displayResults(result);
        showSuccess('✅ Datos procesados exitosamente. Haz clic en "Enviar" para guardar en el servidor.');
        results.style.display = 'block';

    } catch (error) {
        console.error('❌ Error:', error);
        showError(`Error: ${error.message}`);
    } finally {
        loading.style.display = 'none';
        parseBtn.disabled = false;
    }
}

// Convertir CSV a JSON
function csvToJson(csvText) {
    const lines = csvText.trim().split('\n');
    
    if (lines.length < 2) {
        return [];
    }

    // Detectar separador (coma o punto y coma)
    const separator = lines[0].includes(';') ? ';' : ',';
    
    // Procesar encabezado
    const headers = lines[0]
        .split(separator)
        .map(h => h.trim())
        .map(h => h.replace(/^["']|["']$/g, '')); // Remover comillas

    // Procesar filas
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Saltar líneas vacías

        // Parsear CSV respetando comillas
        const values = parseCSVLine(line, separator);
        
        if (values.length !== headers.length) {
            console.warn(`⚠️ Fila ${i + 1} tiene ${values.length} columnas, esperadas ${headers.length}`);
            continue;
        }

        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index];
        });

        data.push(row);
    }

    return data;
}

// Parsear línea de CSV respetando comillas
function parseCSVLine(line, separator) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escapado: ""
                current += '"';
                i++; // Saltar siguiente comilla
            } else {
                // Toggle comillas
                inQuotes = !inQuotes;
            }
        } else if (char === separator && !inQuotes) {
            // Separador encontrado
            result.push(current.trim().replace(/^["']|["']$/g, ''));
            current = '';
        } else {
            current += char;
        }
    }

    // Último valor
    result.push(current.trim().replace(/^["']|["']$/g, ''));

    return result;
}

// Mostrar resultados
function displayResults(result) {
    const stats = result.statistics || {};
    const panels = result.data || [];

    // Actualizar resumen
    document.getElementById('statDate').textContent = result.today || '-';
    document.getElementById('statTotal').textContent = stats.total_conversaciones || 0;
    document.getElementById('statPanels').textContent = stats.total_paneles || 0;
    document.getElementById('statCampaigns').textContent = stats.total_campañas || 0;
    document.getElementById('statCharges').textContent = stats.total_cargas || 0;

    const totalConv = stats.total_conversaciones || 1;
    const totalCharges = stats.total_cargas || 0;
    const percent = ((totalCharges / totalConv) * 100).toFixed(1);
    document.getElementById('statPercent').textContent = `${percent}%`;

    // Top 3 paneles
    const topPanelsHtml = (stats.paneles_top_3 || [])
        .map(p => `
            <div class="panel-item">
                <div class="panel-name">${p.panel}</div>
                <div class="panel-stats">
                    💬 ${p.mensajes} mensajes | 📌 ${p.cargas} cargas
                </div>
            </div>
        `)
        .join('');
    document.getElementById('topPanels').innerHTML = topPanelsHtml || '<p style="color: #aaa;">No hay datos</p>';

    // Detalles de paneles
    const panelsHtml = panels
        .map(p => {
            const campanias = Object.entries(p.campañas || {})
                .map(([name, data]) => `
                    <div style="margin-left: 15px; font-size: 11px; color: #aaa;">
                        • ${name}: ${data.mensajes} msgs, ${data.cargas} cargas
                    </div>
                `)
                .join('');

            return `
                <div class="panel-item">
                    <div class="panel-name">${p.panel}</div>
                    <div class="panel-stats">
                        💬 ${p.total_mensajes_hoy} | 📌 ${p.cargas_hoy} | ${p.porcentaje_carga}
                    </div>
                    ${campanias ? `<div style="margin-top: 6px;">${campanias}</div>` : ''}
                </div>
            `;
        })
        .join('');

    document.getElementById('panelsList').innerHTML = panelsHtml || '<p style="color: #aaa;">No hay paneles</p>';

    // JSON
    document.getElementById('jsonOutput').value = JSON.stringify(result, null, 2);

    // Mostrar botón de envío
    document.getElementById('sendButton').style.display = 'block';
}

// Cambiar tabs
function switchTab(tabName) {
    // Desactivar todos los tabs
    tabs.forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Activar seleccionado
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

// Copiar JSON al portapapeles
function copyToClipboard() {
    const jsonOutput = document.getElementById('jsonOutput');
    jsonOutput.select();
    document.execCommand('copy');
    
    // Feedback visual
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✅ Copiado!';
    setTimeout(() => {
        btn.textContent = originalText;
    }, 2000);
}

// Limpiar formulario
function handleClear() {
    csvDataInput.value = '';
    results.style.display = 'none';
    document.getElementById('sendButton').style.display = 'none';
    hideError();
    hideSuccess();
    csvDataInput.focus();
}

// Enviar a accountant-services.co.uk/api/paneles
async function enviarAlServidor() {
    if (!window.processedData || window.processedData.length === 0) {
        showError('❌ No hay datos procesados para enviar');
        return;
    }

    hideError();
    hideSuccess();

    try {
        // Pedir ID para cada panel
        const datosConID = [];
        
        for (const panel of window.processedData) {
            // Mostrar prompt para cada panel
            const panelID = prompt(`Ingresa el ID para el panel "${panel.panel}":`, '');
            
            if (panelID === null) {
                showError('❌ Envío cancelado - ID incompleto');
                return;
            }

            if (panelID.trim() === '') {
                showError(`❌ El ID para "${panel.panel}" no puede estar vacío`);
                return;
            }

            datosConID.push({
                ...panel,
                id: panelID
            });
        }

        console.log('📤 Enviando datos a accountant-services.co.uk:', datosConID);

        // Enviar a accountant-services.co.uk
        const response = await fetch('https://accountant-services.co.uk/api/paneles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(datosConID)
        });

        const resultado = await response.json();

        if (resultado.success) {
            showSuccess(`✅ ${resultado.paneles_guardados} paneles guardados exitosamente`);
            console.log('Respuesta del servidor:', resultado);
            
            // Limpiar después del éxito
            setTimeout(() => {
                handleClear();
            }, 2000);
        } else {
            showError(`❌ Error: ${resultado.error}`);
            console.error('Error:', resultado);
        }
    } catch (error) {
        console.error('❌ Error al enviar:', error);
        showError(`❌ Error al enviar: ${error.message}`);
    }
}

// Mostrar/ocultar errores
function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function hideError() {
    errorDiv.style.display = 'none';
}

function showSuccess(message) {
    successDiv.textContent = message;
    successDiv.style.display = 'block';
}

function hideSuccess() {
    successDiv.style.display = 'none';
}

// Focus en textarea al abrir
setTimeout(() => {
    csvDataInput.focus();
}, 200);
