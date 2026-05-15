/**
 * Valida las credenciales de una familia (Email + PIN).
 */
function loginFamilia(email, pin) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.FAMILIAS);
    const datos = hoja.getDataRange().getValues();
    
    const emailNormalizado = email.toLowerCase().trim();
    
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0].toLowerCase().trim() === emailNormalizado && datos[i][2].toString() === pin.toString()) {
        if (datos[i][3] !== 'Activo') {
          return { success: false, error: 'La cuenta de familia no está activa.' };
        }
        
        return {
          success: true,
          data: {
            email: datos[i][0],
            nombre: datos[i][1],
            rol: 'Familia'
          }
        };
      }
    }
    
    return { success: false, error: 'Email o PIN incorrectos.' };
  } catch (e) {
    console.error('Error en loginFamilia:', e);
    return { success: false, error: 'Error en el servidor al intentar iniciar sesión.' };
  }
}

/**
 * Obtiene los hijos asociados a un email de familia.
 */
function obtenerHijosFamilia(email) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.ESTUDIANTES);
    const datos = hoja.getDataRange().getValues();
    const hijos = [];
    
    const emailNormalizado = email.toLowerCase().trim();
    
    for (let i = 1; i < datos.length; i++) {
      const emailP1 = datos[i][4].toLowerCase().trim();
      const emailP2 = datos[i][6].toLowerCase().trim();
      
      if (emailP1 === emailNormalizado || emailP2 === emailNormalizado) {
        hijos.push({
          id: datos[i][0],
          nombre: datos[i][1],
          grupo: datos[i][2]
        });
      }
    }
    
    return { success: true, data: hijos };
  } catch (e) {
    console.error('Error en obtenerHijosFamilia:', e);
    return { success: false, error: 'Error al obtener la lista de hijos.' };
  }
}
