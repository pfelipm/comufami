# Especificaciones técnicas: ComuFami

## 1. Objetivo del sistema
Desarrollar una aplicación web (SPA) con Google Apps Script para la gestión y seguimiento del alumnado. El sistema permitirá al profesorado registrar anotaciones y a las familias recibir notificaciones y realizar el seguimiento de sus hijos/as.

## 2. Modelo de datos (Google Sheets)
La hoja de cálculo centralizada contendrá las siguientes pestañas:

### `Usuarios`
Control de acceso para personal del centro.
- **Columnas**: `Email`, `Nombre`, `Rol` (Administrador, Supervisor, Docente), `Estado` (Activo/Inactivo), `Grupos` (Códigos de grupos asignados sep. por comas).

### `Estudiantes`
Base de datos del alumnado.
- **Columnas**: `ID_Estudiante`, `Alumno_Apellidos_Nombre`, `Grupo`, `Progenitor_1_Apellidos_Nombre`, `Email_Progenitor_1`, `Progenitor_2_Apellidos_Nombre`, `Email_Progenitor_2`.

### `Registros`
Anotaciones de seguimiento.
- **Columnas**: `ID_Registro`, `ID_Estudiante`, `Fecha`, `Tipo`, `Descripcion`, `Docente_Email`, `Vista_Progenitor_1`, `Vista_Progenitor_2`, `Comentario_Familia`, `Fecha_Comentario`, `Token_Registro`.

### `Familias`
Base de datos de progenitores para acceso al Dashboard.
- **Columnas**: `Email`, `Apellidos_Nombre`, `PIN`, `Estado` (Activo/Inactivo).

### `Grupos`
Catálogo de grupos del centro.
- **Columnas**: `Codigo`, `Nombre`.

### `Ajustes`
Configuración dinámica de la aplicación.
- **Columnas**: `Parametro`, `Valor`.
- **Parámetros iniciales**: `MAINTENANCE_MODE`, `DEBUG_USER`, `APP_NAME`.

### `Auditoria`
Registro de actividad.
- **Columnas**: `Timestamp`, `Usuario_Email`, `Accion`, `Detalles`.

## 3. Matriz de permisos (RBAC)
| Acción | Administrador | Supervisor | Docente | Familia |
| :--- | :---: | :---: | :---: | :---: |
| Crear Registros | ✅ | ❌ | ✅ (Sus grupos) | ❌ |
| Editar/Borrar Registros | ✅ | ❌ | ✅ (Propios) | ❌ |
| Ver Dashboard Global | ✅ | ✅ (Sus grupos) | ❌ | ❌ |
| Gestionar Usuarios | ✅ | ❌ | ❌ | ❌ |
| Gestionar Grupos | ✅ | ❌ | ❌ | ❌ |
| Comentar Registros | ✅ | ❌ | ❌ | ✅ (Propios) |
| Ver Dashboard Alumno | ❌ | ❌ | ❌ | ✅ |

## 4. Acceso para familias
Dada la naturaleza externa de las familias (cuentas no Workspace):
1.  **Acceso directo (Token)**: El email de notificación contendrá un enlace con un `Token_Registro`. Este token permitirá visualizar y comentar la anotación específica sin inicio de sesión.
2.  **Dashboard Familiar**: Acceso mediante `Email` y un `Pin/Token de Acceso` persistente para ver el histórico de todos sus hijos/as.

## 5. Arquitectura técnica
- **Backend**: Google Apps Script (.gs) con funciones privadas (`_`).
- **Frontend**: HTML5/JavaScript (SPA) con **Tailwind CSS**.
- **Notificaciones**: GmailApp para envío automático de alertas.
- **Despliegue**: Uso de `clasp` para gestión de código local.

## 6. Plan de implementación
1.  **Fase 1**: Inicialización de la infraestructura (Sheets y Scripts base).
2.  **Fase 2**: Desarrollo del módulo de autenticación y RBAC.
3.  **Fase 3**: Interfaz de docente (Creación de registros).
4.  **Fase 4**: Sistema de tokens y vista para familias.
5.  **Fase 5**: Auditoría y ajustes finales.
