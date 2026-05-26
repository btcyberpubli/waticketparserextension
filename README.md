# 🚀 WhaTicket CSV Parser - Extensión de Chrome

Una extensión de Chrome que permite procesar reportes CSV de WhaTicket instantáneamente sin salir del navegador.

## 📦 Características

- ✅ **Interfaz intuitiva** - Popup moderno y fácil de usar
- 📋 **Pega y analiza** - Solo pega los datos CSV y haz clic
- 📊 **Resultados en tiempo real** - Estadísticas instantáneas
- 💾 **Exporta JSON** - Descarga los resultados en formato JSON
- 🔧 **Servidor flexible** - Conecta a localhost o Vercel
- 🎨 **Dark mode** - Interfaz moderna y oscura

## 📥 Instalación

### Paso 1: Clonar o descargar el proyecto
```bash
git clone https://github.com/TU_USUARIO/whaticket-parser.git
cd whaticket-parser/extension
```

### Paso 2: Cargar en Chrome
1. Abre Chrome y ve a `chrome://extensions/`
2. Activa el **"Modo de desarrollador"** (esquina superior derecha)
3. Haz clic en **"Cargar extensión sin empaquetar"**
4. Selecciona la carpeta `extension/`
5. ¡Listo! La extensión aparecerá en tu barra de herramientas

## 🎯 Uso

### Opción 1: Manual (Copiar-Pegar)
1. En WhaTicket, ve a **Reportes** → **Conversaciones**
2. **Copia** el CSV o la tabla (Ctrl+C)
3. Haz clic en el icono de la extensión
4. **Pega** los datos en el textarea
5. Haz clic en **"Analizar"**
6. ¡Listo! Verás los resultados

### Opción 2: Automática (Scraping - En desarrollo)
En futuras versiones, la extensión podrá extraer automáticamente los datos de WhaTicket.

## ⚙️ Configuración

### Cambiar servidor
1. En el popup, ve al campo **"URL del Servidor"**
2. Cambia la URL según necesites:
   - **Local**: `http://localhost:5000`
   - **Vercel**: `https://whaticket-parser.vercel.app`
   - **Otra**: Tu servidor personalizado

La URL se guarda automáticamente en el almacenamiento local.

## 📋 Formato esperado del CSV

El CSV debe tener estas 4 columnas **exactamente**:

```
createdAt,department,connection,conversationTags
2026-05-25 10:00:00,Panel Royal,Campaign 1,tag1;tag2
2026-05-25 10:15:00,Panel Sales,Campaign 2,
2026-05-25 10:30:00,Panel Royal,Campaign 1,tag3
```

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| `createdAt` | Fecha y hora | `2026-05-25 10:00:00` |
| `department` | Panel/Departamento | `Panel Royal` |
| `connection` | Campaña/Canal | `Campaign 1` |
| `conversationTags` | Tags (pueden estar vacíos) | `tag1;tag2` |

## 📊 Resultados

La extensión te muestra:
- **Resumen**: Estadísticas generales
- **Detalles**: Panel por panel con desglose de campañas
- **JSON**: Datos completos en formato JSON

## 🔗 Requisitos

- ✅ Chrome/Chromium v90+
- ✅ Acceso a un servidor con el endpoint `/process-json`
- ✅ Conexión de red activa

## 🐛 Troubleshooting

### "Error: conexión rechazada"
- Verifica que el servidor esté corriendo: `node server.js`
- Comprueba que la URL sea correcta en el popup

### "Columnas faltantes"
- Asegúrate de que el CSV tenga exactamente estas 4 columnas:
  - `createdAt`
  - `department`
  - `connection`
  - `conversationTags`

### "Error al leer CSV"
- Verifica que uses **coma (`,`)** como separador
- Elimina filas vacías
- Asegúrate de que no haya saltos de línea extraños

## 📝 Estructura de archivos

```
extension/
├── manifest.json       # Configuración de la extensión
├── popup.html          # Interfaz del popup
├── popup.js            # Lógica del popup
├── content.js          # Script inyectado en la página
├── background.js       # Service Worker
├── icons/              # Iconos de la extensión
└── README.md           # Este archivo
```

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/mejora`)
3. Commit cambios (`git commit -am 'Agrega mejora'`)
4. Push a la rama (`git push origin feature/mejora`)
5. Abre un Pull Request

## 📄 Licencia

ISC

## 👤 Autor

Creado para procesar reportes de WhaTicket de forma eficiente

## 🚀 Versión Actual

**v1.0.0** - Análisis básico de CSV

### Próximas características:
- 🔄 Scraping automático de WhaTicket
- 📈 Gráficos en tiempo real
- 🔔 Notificaciones de cambios
- 💾 Historial de análisis
- 🌐 Sincronización en la nube
