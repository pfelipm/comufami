/**
 * @OnlyCurrentDoc
 *
 * Configuración global y constantes de la aplicación.
 */
const APP_CONFIG = {
  NOMBRE: 'ComuFami',
  VERSION: '1.0.0',
  TABLAS: {
    USUARIOS: 'Usuarios',
    ESTUDIANTES: 'Estudiantes',
    REGISTROS: 'Registros',
    FAMILIAS: 'Familias',
    GRUPOS: 'Grupos',
    AJUSTES: 'Ajustes',
    AUDITORIA: 'Auditoria'
  }
};

/**
 * Función de entrada para la Web App.
 */
function doGet(e) {
  const appName = obtenerAjuste_('APP_NAME') || APP_CONFIG.NOMBRE;
  const accentColor = obtenerAjuste_('APP_ACCENT_COLOR') || '#1d4ed8'; // blue-700 default
  const logoUrl = obtenerAjuste_('APP_LOGO_URL') || '';
  const footerText = obtenerAjuste_('APP_FOOTER_TEXT') || '';
  
  // Verificación de modo mantenimiento antes de cargar la interfaz
  const modoMantenimiento = obtenerAjuste_('MAINTENANCE_MODE') === 'true';
  
  if (modoMantenimiento && !esAdministrador_()) {
    return HtmlService.createHtmlOutput('<h1>Modo Mantenimiento</h1><p>La aplicación está siendo actualizada. Por favor, vuelve a intentarlo más tarde.</p>');
  }

  const template = HtmlService.createTemplateFromFile('index');
  template.appName = appName;
  template.accentColor = accentColor;
  template.logoUrl = logoUrl;
  template.footerLogoUrl = obtenerAjuste_('APP_FOOTER_LOGO_URL') || '';
  template.appFooterLogoLinkUrl = obtenerAjuste_('APP_FOOTER_LOGO_LINK_URL') || '';
  template.footerText = footerText;
  template.token = e.parameter.token || null;
  
  return template
    .evaluate()
    .setTitle(appName)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Función estándar para incluir archivos HTML (CSS/JS) en la plantilla.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Verifica si el usuario actual es administrador.
 */
function esAdministrador_() {
  const email = obtenerEmailUsuarioActivo_();
  const usuario = obtenerUsuarioPorEmail_(email);
  return usuario && usuario.rol === 'Administrador';
}

/**
 * Centraliza la obtención del email del usuario, considerando la impersonación (DEBUG_USER).
 */
function obtenerEmailUsuarioActivo_() {
  const emailReal = Session.getActiveUser().getEmail().toLowerCase().trim();
  
  // 1. Buscamos al usuario real directamente en la hoja para evitar recursión
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.USUARIOS);
  if (!hoja) return emailReal;

  const datos = hoja.getDataRange().getValues();
  let esAdminReal = false;
  for (let i = 1; i < datos.length; i++) {
    const emailFila = datos[i][0].toString().toLowerCase().trim();
    const rolFila = datos[i][2].toString().trim();
    const estadoFila = datos[i][3].toString().trim();

    if (emailFila === emailReal && rolFila === 'Administrador' && estadoFila === 'Activo') {
      esAdminReal = true;
      break;
    }
  }

  // 2. Si es admin real, comprobamos si quiere impersonar
  if (esAdminReal) {
    const debugEmail = obtenerAjuste_('DEBUG_USER');
    if (debugEmail && debugEmail.trim() !== '') {
      return debugEmail.toLowerCase().trim();
    }
  }
  
  return emailReal;
}

/**
 * Obtiene el objeto de usuario actual (personal) considerando impersonación.
 */
function obtenerUsuarioActual_() {
  const email = obtenerEmailUsuarioActivo_();
  return obtenerUsuarioPorEmail_(email);
}

/**
 * Función interna para buscar un usuario por email.
 */
function obtenerUsuarioPorEmail_(email) {
  if (!email) return null;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.USUARIOS);
    if (!hoja) return null;

    const datos = hoja.getDataRange().getValues();
    const emailBuscado = email.toLowerCase().trim();
    
    for (let i = 1; i < datos.length; i++) {
      const emailFila = datos[i][0].toString().toLowerCase().trim();
      const estadoFila = datos[i][3].toString().toLowerCase().trim();
      
      if (emailFila === emailBuscado && estadoFila === 'activo') {
        return {
          email: datos[i][0].toString().trim(),
          nombre: datos[i][1].toString().trim(),
          rol: datos[i][2].toString().trim(),
          grupos: datos[i][4] ? datos[i][4].toString().trim() : ''
        };
      }
    }
    return null;
  } catch (e) {
    console.error('Error en obtenerUsuarioPorEmail_:', e);
    return null;
  }
}

/**
 * Obtiene un ajuste desde la pestaña de Ajustes.
 */
function obtenerAjuste_(parametro) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.AJUSTES);
    if (!hoja) return null;
    
    const datos = hoja.getDataRange().getValues();
    const fila = datos.find(r => r[0] === parametro);
    return fila ? fila[1] : null;
  } catch (e) {
    console.error('Error al obtener ajuste:', e);
    return null;
  }
}

/**
 * Obtiene los datos iniciales para el cliente (usuario y configuración).
 */
function obtenerDatosIniciales() {
  try {
    const emailReal = Session.getActiveUser().getEmail().toLowerCase().trim();
    const modoMantenimiento = obtenerAjuste_('MAINTENANCE_MODE') === 'true';
    
    // 1. Verificar si el usuario real es Administrador
    const usuarioReal = obtenerUsuarioPorEmail_(emailReal);
    const esAdminReal = usuarioReal && usuarioReal.rol === 'Administrador';

    // Bloqueo por mantenimiento (solo si no es admin real)
    if (modoMantenimiento && !esAdminReal) {
      return {
        success: true,
        tipo: 'MANTENIMIENTO',
        appName: obtenerAjuste_('APP_NAME') || APP_CONFIG.NOMBRE,
        accentColor: obtenerAjuste_('APP_ACCENT_COLOR') || '#1d4ed8'
      };
    }

    let emailAVisualizar = emailReal;
    
    // 2. Si es admin real, comprobamos si hay alguien en DEBUG_USER
    if (esAdminReal) {
      const debugEmail = obtenerAjuste_('DEBUG_USER');
      if (debugEmail && debugEmail.trim() !== '') {
        emailAVisualizar = debugEmail.toLowerCase().trim();
      }
    }

    // 3. Intentar buscar el email (real o impersonado) en la tabla de Usuarios (Personal)
    const usuarioPersonal = obtenerUsuarioPorEmail_(emailAVisualizar);

    const appName = obtenerAjuste_('APP_NAME') || APP_CONFIG.NOMBRE;
    const accentColor = obtenerAjuste_('APP_ACCENT_COLOR') || '#1d4ed8';
    const logoUrl = obtenerAjuste_('APP_LOGO_URL') || '';
    const footerLogoUrl = obtenerAjuste_('APP_FOOTER_LOGO_URL') || '';
    const appFooterLogoLinkUrl = obtenerAjuste_('APP_FOOTER_LOGO_LINK_URL') || '';
    const footerText = obtenerAjuste_('APP_FOOTER_TEXT') || '';

    if (usuarioPersonal) {
      return {
        success: true,
        tipo: 'PERSONAL',
        data: usuarioPersonal,
        appName,
        accentColor,
        logoUrl,
        footerLogoUrl,
        appFooterLogoLinkUrl,
        footerText
      };
    }

    // 4. Si no es personal, es un usuario externo (Familia)
    const datosFamilia = obtenerDatosFamiliaPorEmail_(emailAVisualizar);

    return {
      success: true,
      tipo: 'EXTERNO',
      data: {
        email: emailAVisualizar,
        nombre: datosFamilia ? datosFamilia.nombre : 'Usuario Externo',
        rol: 'Familia'
      },
      appName,
      accentColor,
      logoUrl,
      footerLogoUrl,
      appFooterLogoLinkUrl,
      footerText
    };
  } catch (e) {
    console.error('Error en obtenerDatosIniciales:', e);
    return { success: false, error: e.toString() };
  }
}

/**
 * Función auxiliar para buscar una familia por email.
 */
function obtenerDatosFamiliaPorEmail_(email) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.FAMILIAS);
    if (!hoja) return null;
    const datos = hoja.getDataRange().getValues();
    const emailBuscado = email.toLowerCase().trim();
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0].toLowerCase().trim() === emailBuscado) {
        return { email: datos[i][0], nombre: datos[i][1] };
      }
    }
  } catch (e) { return null; }
  return null;
}

/**
 * Verifica si un usuario tiene acceso a un grupo específico.
 */
function verificarAccesoGrupo_(user, codigoGrupo) {
  if (!user) return false;
  
  // 1. Administradores siempre tienen acceso a todo
  if (user.rol === 'Administrador') return true;
  
  const gruposAsignados = (user.grupos || '').split(',')
    .map(g => g.trim().toLowerCase())
    .filter(g => g !== '');
  
  // 2. Supervisores
  if (user.rol === 'Supervisor') {
    // Si es supervisor y NO tiene grupos asignados, ve todos.
    if (gruposAsignados.length === 0) return true;
    // Si tiene grupos, solo ve los suyos.
    return gruposAsignados.includes(codigoGrupo.toLowerCase());
  }
  
  // 3. Docentes: Solo sus grupos
  if (user.rol === 'Docente') {
    return gruposAsignados.includes(codigoGrupo.toLowerCase());
  }
  
  return false;
}

/**
 * Registra una acción en la pestaña de Auditoría.
 */
function registrarActividad_(email, accion, detalles) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.AUDITORIA);
    if (!hoja) return;
    hoja.appendRow([new Date(), email, accion, detalles]);
  } catch (e) {
    console.error('Error al registrar actividad:', e);
  }
}

/**
 * Lista todos los ajustes disponibles en la pestaña de Ajustes.
 */
function listarAjustes() {
  if (!esAdministrador_()) throw new Error('No tiene permisos para acceder a los ajustes.');
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.AJUSTES);
    if (!hoja) return { success: false, error: 'No se encontró la hoja de ajustes.' };
    
    const datos = hoja.getDataRange().getValues();
    const ajustes = [];
    
    // Saltamos la cabecera e ignoramos filas vacías
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0]) {
        ajustes.push({
          parametro: datos[i][0].toString(),
          valor: datos[i][1].toString()
        });
      }
    }
    
    return { success: true, data: ajustes };
  } catch (e) {
    console.error('Error en listarAjustes:', e);
    return { success: false, error: e.toString() };
  }
}

/**
 * Guarda o actualiza un ajuste específico.
 */
function guardarAjuste(parametro, valor) {
  const user = obtenerUsuarioActual_();
  if (!user || user.rol !== 'Administrador') throw new Error('No tiene permisos para modificar ajustes.');
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.AJUSTES);
    if (!hoja) return { success: false, error: 'No se encontró la hoja de ajustes.' };
    
    const datos = hoja.getDataRange().getValues();
    let filaEncontrada = -1;
    
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0].toString() === parametro) {
        filaEncontrada = i + 1;
        break;
      }
    }
    
    if (filaEncontrada !== -1) {
      hoja.getRange(filaEncontrada, 2).setValue(valor);
    } else {
      hoja.appendRow([parametro, valor]);
    }
    
    registrarActividad_(user.email, 'MODIFICAR_AJUSTE', `Ajuste ${parametro} actualizado a: ${valor}`);
    return { success: true };
  } catch (e) {
    console.error('Error en guardarAjuste:', e);
    return { success: false, error: e.toString() };
  }
}
