/**
 * Obtiene la lista completa de usuarios para la administración.
 * Solo accesible por administradores.
 */
function listarUsuarios() {
  if (!esAdministrador_()) {
    return { success: false, error: 'No tienes permisos para realizar esta acción.' };
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.USUARIOS);
    const datos = hoja.getDataRange().getValues();
    const usuarios = [];

    // Omitir cabeceras
    for (let i = 1; i < datos.length; i++) {
      usuarios.push({
        email: datos[i][0],
        nombre: datos[i][1],
        rol: datos[i][2],
        estado: datos[i][3],
        grupos: datos[i][4] || ''
      });
    }

    // Ordenar alfabéticamente por nombre
    usuarios.sort((a, b) => a.nombre.localeCompare(b.nombre));

    return { success: true, data: usuarios };
  } catch (e) {
    console.error('Error en listarUsuarios:', e);
    return { success: false, error: e.toString() };
  }
}

/**
 * Guarda o actualiza un usuario en la base de datos.
 */
function guardarUsuario(usuario, esNuevo) {
  if (!esAdministrador_()) {
    return { success: false, error: 'No tienes permisos.' };
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.USUARIOS);
    const datos = hoja.getDataRange().getValues();
    let filaEncontrada = -1;

    const emailBuscado = usuario.email.toLowerCase().trim();
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0].toString().toLowerCase().trim() === emailBuscado) {
        if (esNuevo) throw new Error('El correo electrónico ya está registrado para otro usuario.');
        filaEncontrada = i + 1;
        break;
      }
    }

    const valores = [usuario.email, usuario.nombre, usuario.rol, usuario.estado, usuario.grupos || ''];

    if (filaEncontrada !== -1) {
      hoja.getRange(filaEncontrada, 1, 1, 5).setValues([valores]);
      registrarAuditoria_('Actualizar Usuario', `Usuario ${usuario.email} actualizado.`);
    } else {
      hoja.appendRow(valores);
      registrarAuditoria_('Crear Usuario', `Usuario ${usuario.email} creado.`);
    }

    return { success: true };
  } catch (e) {
    console.error('Error en guardarUsuario:', e);
    return { success: false, error: e.toString() };
  }
}

/**
 * Registra una acción en la pestaña de Auditoría.
 */
function registrarAuditoria_(accion, detalles) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.AUDITORIA);
    const email = Session.getActiveUser().getEmail();
    hoja.appendRow([new Date(), email, accion, detalles]);
  } catch (e) {
    console.error('Error en registrarAuditoria_:', e);
  }
}
