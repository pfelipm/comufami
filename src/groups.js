/**
 * Módulo de gestión de Grupos.
 */

function listarGrupos() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.GRUPOS);
    if (!hoja) return { success: true, data: [] };
    
    const datos = hoja.getDataRange().getValues();
    const grupos = [];
    for (let i = 1; i < datos.length; i++) {
      grupos.push({
        codigo: datos[i][0],
        nombre: datos[i][1]
      });
    }

    // Ordenar alfabéticamente por código
    grupos.sort((a, b) => a.codigo.localeCompare(b.codigo));

    return { success: true, data: grupos };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function guardarGrupo(grupo) {
  if (!esAdministrador_()) return { success: false, error: 'Sin permisos.' };
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.GRUPOS);
    const datos = hoja.getDataRange().getValues();
    let fila = -1;
    const codBuscado = grupo.codigo.toString().trim().toUpperCase();
    
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0].toString().trim().toUpperCase() === codBuscado) {
        fila = i + 1;
        break;
      }
    }
    
    const valores = [codBuscado, grupo.nombre];
    if (fila !== -1) {
      hoja.getRange(fila, 1, 1, 2).setValues([valores]);
    } else {
      hoja.appendRow(valores);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function eliminarGrupo(codigo) {
  if (!esAdministrador_()) return { success: false, error: 'Sin permisos.' };
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.GRUPOS);
    const datos = hoja.getDataRange().getValues();
    const codBuscado = codigo.toString().trim().toUpperCase();
    
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0].toString().trim().toUpperCase() === codBuscado) {
        hoja.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, error: 'Grupo no encontrado.' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}
