# 🚀 WhaTicket Parser Extension - Guía de Uso

## ¿Qué hace la extensión?

La extensión captura automáticamente los reportes CSV de conversaciones de WhaTicket y los analiza en tiempo real, mostrando:

- **📊 Estadísticas**: Total de conversaciones, paneles, campañas y cargas
- **👑 Top 3 Paneles**: Los 3 paneles con más conversaciones
- **📋 Detalles**: Información completa de cada panel y sus campañas
- **🔄 Actualización en vivo**: Se actualiza con cada descarga de CSV

---

## 📁 Estructura de Archivos

```
waticketparserextension/
├── background.js          ← Service Worker principal
├── content.js             ← Script que ejecuta en WhaTicket
├── injected.js            ← Script que intercepta descargas (blob)
├── popup.html             ← Pop-up de la extensión (NO cambiar)
├── popup.js               ← Lógica del pop-up (NO cambiar)
├── results.html           ← Ventana con resultados gráficos ✨ (NUEVO)
├── manifest.json          ← Configuración de la extensión
├── processor.js           ← Helper de procesamiento
├── icons/                 ← Iconos
├── utils/
│   └── parser.js          ← Lógica de procesamiento CSV ✨ (NUEVO)
└── parser/                ← Servidor y ejemplos (NO necesario en extensión)
```

---

## 🔄 Flujo de Funcionamiento

### 1️⃣ **Captura del CSV**
```
Usuario hace clic en "Exportar" → "CSV" en WhaTicket
       ↓
injected.js intercepta el blob mediante Monkey Patching
       ↓
Extrae el CSV y lo envía a content.js
       ↓
content.js guarda el CSV en background.js
```

### 2️⃣ **Procesamiento**
```
content.js recibe el CSV capturado
       ↓
Llama a processCSV() (en utils/parser.js)
       ↓
Procesa datos:
  - Filtra solo datos de HOY (zona Argentina UTC-3)
  - Agrupa por panel (departamento)
  - Cuenta mensajes y cargas
  - Calcula porcentajes
       ↓
Retorna objeto con estadísticas
```

### 3️⃣ **Visualización**
```
content.js obtiene resultado procesado
       ↓
Envía mensaje a background.js para abrir results.html
       ↓
background.js abre nueva pestaña (o actualiza la existente)
       ↓
results.html recibe datos y los muestra gráficamente
```

---

## 🎯 Cómo Usar

### **Instalación**
1. Descarga la extensión
2. Ve a `chrome://extensions/`
3. Activa "Modo de desarrollador" (esquina superior derecha)
4. Haz clic en "Cargar extensión sin empaquetar"
5. Selecciona la carpeta de la extensión

### **Uso**
1. Ve a **WhaTicket** → **Reportes** → **Conversaciones**
2. Haz clic en el **icono de la extensión** en la barra de herramientas
3. Haz clic en **"Analizar"**
4. Espera a que se descargue el CSV automáticamente
5. Se abrirá una **nueva pestaña** con los resultados gráficos

### **Mantener la Ventana Abierta**
- No cierres la ventana de resultados
- Cada vez que descargues un nuevo CSV, se actualizará automáticamente
- Perfecta para monitorear cambios en tiempo real

---

## 📊 Información que se Muestra

### **Estadísticas (4 tarjetas)**
- 💬 **Total Conversaciones**: Suma de todos los mensajes del día
- 📦 **Total Paneles**: Cantidad de departamentos únicos
- 📢 **Total Campañas**: Cantidad de canales/campañas únicas
- 📈 **Total Cargas**: Cantidad de mensajes con tags

### **Top 3 Paneles**
- Panel con ranking (🥇 🥈 🥉)
- Mensajes totales
- Cargas totales

### **Todos los Paneles**
- Nombre del panel
- Porcentaje de carga (cargas/total)
- Listado de campañas:
  - Nombre de la campaña
  - Mensajes
  - Cargas

---

## 🛠️ Funciones Principales (utils/parser.js)

### `processCSV(csvText)`
Función principal que procesa el CSV completo.

**Entrada:**
```javascript
csvText: string // El CSV completo como texto
```

**Salida:**
```javascript
{
  success: boolean,
  data: Array,           // Array de paneles procesados
  statistics: Object,    // Estadísticas calculadas
  today: string,         // Fecha de procesamiento (YYYY-MM-DD)
  allDatesFound: Array,  // Todas las fechas encontradas en el CSV
  hasDataToday: boolean, // Si hay datos para hoy
  total_rows: number     // Total de filas del CSV
}
```

### Estructura de Datos de Panel
```javascript
{
  id: string,
  panel: string,                    // Nombre del panel
  total_mensajes_hoy: number,       // Total de mensajes
  cargas_hoy: number,               // Total de cargas (con tags)
  porcentaje_carga: string,         // Porcentaje formateado (ej: "45.5%")
  campañas: {
    "Campaign Name": {
      mensajes: number,
      cargas: number
    }
  },
  detalle_por_origen: ['whaticket']
}
```

---

## 🔍 Debugging

### **Abrir Consola**
Presiona `F12` en la página de WhaTicket para ver los logs:

```
[Extension] 📦 Enlace Blob detectado: blob:https://...
[Extension] ✅ CSV Capturado con éxito.
✅ EVENTO RECIBIDO DESDE INJECTED.JS:
📤 Enviando CSV a background.js...
⚙️ PROCESANDO CSV...
✅ CSV procesado: X paneles, Y mensajes
📊 Abriendo ventana de resultados...
✅ Ventana de resultados abierta
```

### **Verificar datos en Console**
```javascript
// En la consola de cualquier pestaña de WhaTicket:
window.__receivedCSV        // Ver CSV capturado
window.__csvReady           // Ver si está listo
window.__csvSource          // Ver desde dónde se capturó
```

---

## ⚙️ Configuración Avanzada

### **Cambiar Columnas Procesadas**
En `utils/parser.js`, la función `processCSVToArray()` define qué columnas se leen del CSV. Las principales son:
- `firstSentMessageAt` o `createdAt` - Fecha
- `department` - Panel
- `connection` - Campaña
- `conversationTags` - Tags (para contar cargas)

### **Cambiar Zona Horaria**
En `utils/parser.js`, la función `getArgentinaDate()` usa UTC-3. Para cambiar:
```javascript
// Cambiar esta línea (UTC-3 = -180 minutos):
const offsetMs = 3 * 60 * 60 * 1000;

// Ejemplo para UTC-5:
const offsetMs = 5 * 60 * 60 * 1000;
```

---

## ✅ Checklist de Funcionalidad

- ✅ Captura automática de CSV desde WhaTicket
- ✅ Procesamiento 100% en el navegador (sin servidor)
- ✅ Muestra estadísticas en tiempo real
- ✅ Ventana de resultados expandible
- ✅ Se actualiza con cada descarga
- ✅ No interfiere con el popup original
- ✅ Compatible con Chrome/Chromium v90+
- ✅ Soporte para Argentina UTC-3

---

## 🐛 Troubleshooting

### **La extensión no captura el CSV**
- Verificar que `injected.js` está cargado (F12 → Console)
- Verificar que la URL de WhaTicket está en `manifest.json`
- Intentar recargar la página (Ctrl+F5)
- Abrir nueva ventana de Chrome

### **La ventana de resultados no se abre**
- Verificar que no hay pop-ups bloqueados
- Intentar nuevamente la descarga
- Verificar en chrome://extensions que la extensión está habilitada

### **Los datos se ven vacíos**
- Verificar que el CSV tiene datos de HOY (zona Argentina)
- Abrir F12 y buscar mensajes de error
- Verificar formato del CSV (columnas requeridas)

### **No se actualiza con nuevas descargas**
- No cerrar la ventana de resultados
- Descargar un nuevo CSV
- La ventana debería actualizarse automáticamente

---

## 📝 Notas Importantes

- **NO modificar** `popup.html` ni `popup.js` (ya funcionan correctamente)
- **NO modificar** `parser/` (es solo de referencia, no se usa en extensión)
- **Los datos se procesan localmente** en tu navegador (privado)
- **La ventana de resultados es una pestaña normal** que puedes mantener abierta
- **Compatibilidad**: Solo funciona en Chrome/Chromium con Manifest v3

---

## 🎨 Customización de Interfaz

Para cambiar colores, fuentes o diseño de results.html, edita la sección `<style>` al principio del archivo. Las variables principales son:

```css
:root {
    --primary-color: #667eea;      /* Color principal */
    --secondary-color: #764ba2;    /* Color secundario */
    --success-color: #48bb78;      /* Color de éxito */
    --danger-color: #f56565;       /* Color de error */
}
```

---

¡La extensión está lista para usar! 🎉

Para soporte adicional, abre F12 y revisa los logs en la consola.
