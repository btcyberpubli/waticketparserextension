/**
 * Script inyectable en la página de WhaTicket (world: MAIN)
 * TODAS las formas de capturar CSV
 */

(function() {
    console.log('🔧 [INJECTED] ========================================');
    console.log('🔧 [INJECTED] Inicializando interceptor TOTAL...');
    console.log('🔧 [INJECTED] ========================================');
    
    // Variables globales para captura
    window.__whaticketCSV = null;
    window.__csvReady = false;
    window.__csvSource = null;
    
    // ============================================
    // 1️⃣ INTERCEPTAR URL.createObjectURL (Blobs)
    // ============================================
    console.log('📍 Instalando interceptor #1: Blob/createObjectURL');
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = function(blob) {
        if (blob instanceof Blob) {
            console.log('  📦 Blob detectado:', {
                type: blob.type,
                size: blob.size,
                timestamp: new Date().toLocaleTimeString()
            });
            
            // Intentar leer el blob para detectar CSV
            if (blob.size > 50 && blob.size < 10485760) {
                blob.text().then(text => {
                    console.log('  📄 Contenido (primeros 150 chars):', text.substring(0, 150));
                    
                    // Verificar si es CSV
                    if (text && text.includes(',') && (text.includes('createdAt') || text.includes('id,'))) {
                        console.log('  ✅✅✅ ¡CSV ENCONTRADO EN BLOB! ✅✅✅');
                        console.log('  📊 Tamaño:', text.length, 'bytes');
                        window.__whaticketCSV = text;
                        window.__csvReady = true;
                        window.__csvSource = 'blob-createobjecturl';
                    } else {
                        console.log('  ⚠️ Blob detectado pero NO es CSV');
                    }
                }).catch(e => {
                    console.error('  ❌ Error leyendo blob:', e.message);
                });
            }
        }
        
        const url = originalCreateObjectURL.call(this, blob);
        console.log('  📍 URL generada:', url.substring(0, 40) + '...');
        return url;
    };
    console.log('✅ Interceptor #1 instalado\n');
    
    // ============================================
    // 2️⃣ INTERCEPTAR FETCH
    // ============================================
    console.log('📍 Instalando interceptor #2: Fetch');
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        console.log('  🌐 Fetch URL:', url);
        
        return originalFetch.apply(this, args).then(async response => {
            const contentType = response.headers.get('content-type') || '';
            const contentDisposition = response.headers.get('content-disposition') || '';
            
            console.log('  📦 Response:', {
                status: response.status,
                contentType: contentType,
                contentDisposition: contentDisposition
            });
            
            if (contentType.includes('csv') || 
                contentType.includes('text') ||
                contentType.includes('octet-stream') ||
                contentDisposition.includes('.csv')) {
                
                try {
                    const text = await response.clone().text();
                    console.log('  📄 Contenido CSV (primeros 150 chars):', text.substring(0, 150));
                    
                    if (text && text.length > 100 && text.includes(',')) {
                        if (text.includes('createdAt') || text.includes('id,')) {
                            console.log('  ✅✅✅ ¡CSV ENCONTRADO EN FETCH! ✅✅✅');
                            console.log('  📊 Tamaño:', text.length, 'bytes');
                            window.__whaticketCSV = text;
                            window.__csvReady = true;
                            window.__csvSource = 'fetch';
                        }
                    }
                } catch (e) {
                    console.error('  ❌ Error leyendo fetch:', e.message);
                }
            }
            return response;
        });
    };
    console.log('✅ Interceptor #2 instalado\n');
    
    // ============================================
    // 3️⃣ INTERCEPTAR XMLHttpRequest
    // ============================================
    console.log('📍 Instalando interceptor #3: XMLHttpRequest');
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(m, u, ...r) {
        this._xhrUrl = u;
        this._xhrMethod = m;
        return origOpen.apply(this, [m, u, ...r]);
    };
    
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(...a) {
        const self = this;
        this.addEventListener('load', function() {
            const ct = self.getResponseHeader('content-type') || '';
            const cd = self.getResponseHeader('content-disposition') || '';
            
            console.log('  🔄 XHR Response:', {
                url: self._xhrUrl,
                status: self.status,
                contentType: ct,
                contentDisposition: cd,
                responseLength: self.responseText?.length
            });
            
            if ((ct.includes('csv') || cd.includes('.csv') || self._xhrUrl?.includes('export')) &&
                self.responseText?.length > 100 &&
                self.responseText.includes(',')) {
                
                if (self.responseText.includes('createdAt') || self.responseText.includes('id,')) {
                    console.log('  ✅✅✅ ¡CSV ENCONTRADO EN XHR! ✅✅✅');
                    console.log('  📊 Tamaño:', self.responseText.length, 'bytes');
                    window.__whaticketCSV = self.responseText;
                    window.__csvReady = true;
                    window.__csvSource = 'xhr';
                }
            }
        });
        return origSend.apply(this, a);
    };
    console.log('✅ Interceptor #3 instalado\n');
    
    // ============================================
    // 4️⃣ INTERCEPTAR CLICKS EN LINKS
    // ============================================
    console.log('📍 Instalando interceptor #4: Clicks en links');
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'A') {
            console.log('  🔗 Link clickeado:', e.target.href);
            
            if (e.target.href && e.target.href.startsWith('blob:')) {
                console.log('  🎯 ¡Blob URL detectada!');
                
                fetch(e.target.href)
                    .then(r => r.blob())
                    .then(blob => blob.text())
                    .then(text => {
                        console.log('  📄 Contenido blob link (primeros 150 chars):', text.substring(0, 150));
                        
                        if (text && text.includes(',') && (text.includes('createdAt') || text.includes('id,'))) {
                            console.log('  ✅✅✅ ¡CSV ENCONTRADO EN BLOB LINK! ✅✅✅');
                            console.log('  📊 Tamaño:', text.length, 'bytes');
                            window.__whaticketCSV = text;
                            window.__csvReady = true;
                            window.__csvSource = 'blob-link-click';
                        }
                    })
                    .catch(e => console.error('  ❌ Error descargando blob link:', e.message));
            }
        }
    }, true);
    console.log('✅ Interceptor #4 instalado\n');
    
    // ============================================
    // 5️⃣ INTERCEPTAR window.location CHANGES
    // ============================================
    console.log('📍 Instalando interceptor #5: window.location changes');
    let lastLocation = window.location.href;
    
    setInterval(() => {
        if (window.location.href !== lastLocation) {
            console.log('  🔄 Navegación detectada:', window.location.href);
            lastLocation = window.location.href;
        }
    }, 500);
    console.log('✅ Interceptor #5 instalado\n');
    
    // ============================================
    // 6️⃣ INTERCEPTAR Blob CONSTRUCTOR
    // ============================================
    console.log('📍 Instalando interceptor #6: Blob constructor');
    const OriginalBlob = window.Blob;
    window.Blob = function(...args) {
        const blob = new OriginalBlob(...args);
        
        if (blob.size > 100 && blob.size < 10485760) {
            console.log('  🧬 Blob creado via constructor:', {
                type: blob.type,
                size: blob.size
            });
            
            blob.text().then(text => {
                if (text && text.length > 100 && text.includes(',')) {
                    console.log('  📄 Contenido (primeros 150 chars):', text.substring(0, 150));
                    
                    if (text.includes('createdAt') || text.includes('id,')) {
                        console.log('  ✅✅✅ ¡CSV ENCONTRADO EN BLOB CONSTRUCTOR! ✅✅✅');
                        console.log('  📊 Tamaño:', text.length, 'bytes');
                        window.__whaticketCSV = text;
                        window.__csvReady = true;
                        window.__csvSource = 'blob-constructor';
                    }
                }
            }).catch(() => {});
        }
        
        return blob;
    };
    console.log('✅ Interceptor #6 instalado\n');
    
    // ============================================
    // RESUMEN
    // ============================================
    console.log('🚀 [INJECTED] ========================================');
    console.log('🚀 [INJECTED] 6 INTERCEPTORES ACTIVOS:');
    console.log('🚀 [INJECTED] ✅ #1 - URL.createObjectURL (Blobs)');
    console.log('🚀 [INJECTED] ✅ #2 - Fetch');
    console.log('🚀 [INJECTED] ✅ #3 - XMLHttpRequest');
    console.log('🚀 [INJECTED] ✅ #4 - Click en Links');
    console.log('🚀 [INJECTED] ✅ #5 - window.location changes');
    console.log('🚀 [INJECTED] ✅ #6 - Blob Constructor');
    console.log('🚀 [INJECTED] ========================================');
    console.log('🚀 [INJECTED] Esperando captura de CSV...');
    console.log('🚀 [INJECTED] ========================================\n');
    
})();
