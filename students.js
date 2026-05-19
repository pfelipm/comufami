/**
 * Lista los estudiantes visibles para el usuario actual.
 */
function listarEstudiantes() {
  try {
    const user = obtenerUsuarioActual_();
    if (!user) throw new Error('No autorizado.');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Cargar familias para obtener PINs
    const hojaFamilias = ss.getSheetByName(APP_CONFIG.TABLAS.FAMILIAS);
    const datosFamilias = hojaFamilias.getDataRange().getValues();
    const familiasMap = {};
    for (let i = 1; i < datosFamilias.length; i++) {
      familiasMap[datosFamilias[i][0].toString().toLowerCase().trim()] = datosFamilias[i][2].toString(); // PIN
    }

    const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.ESTUDIANTES);
    const datos = hoja.getDataRange().getValues();
    const estudiantes = [];

    for (let i = 1; i < datos.length; i++) {
      const grupoEstudiante = datos[i][2].toString();
      if (verificarAccesoGrupo_(user, grupoEstudiante)) {
        const p1Email = datos[i][4].toString().toLowerCase().trim();
        const p2Email = datos[i][6].toString().toLowerCase().trim();
        estudiantes.push({
          id: datos[i][0],
          nombre: datos[i][1],
          grupo: datos[i][2],
          p1_nombre: datos[i][3],
          p1_email: datos[i][4],
          p1_pin: familiasMap[p1Email] || '',
          p2_nombre: datos[i][5],
          p2_email: datos[i][6],
          p2_pin: familiasMap[p2Email] || '',
          independientes: datos[i][7] === true || datos[i][7] === 'TRUE'
        });
      }
    }

    // Ordenar alfabéticamente por Apellidos, Nombre
    estudiantes.sort((a, b) => a.nombre.localeCompare(b.nombre));

    return { success: true, data: estudiantes };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Guarda o actualiza un estudiante. Los supervisores no tienen permiso de escritura.
 */
function guardarEstudiante(estudiante, esNuevo) {
  try {
    const user = obtenerUsuarioActual_();
    if (!user || user.rol === 'Supervisor') throw new Error('No tiene permisos para guardar estudiantes.');
    
    // Verificar si tiene acceso al grupo del estudiante (especialmente para docentes)
    if (!verificarAccesoGrupo_(user, estudiante.grupo)) {
      throw new Error('No tiene permiso para gestionar estudiantes de este grupo.');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.ESTUDIANTES);
    const datos = hoja.getDataRange().getValues();
    let filaEncontrada = -1;

    const idBuscado = estudiante.id.toString().trim();
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0].toString().trim() === idBuscado) {
        // Si estamos creando uno nuevo y ya existe el ID, lanzamos error
        if (esNuevo) throw new Error('El NIA / ID ya existe en la base de datos.');

        // Si ya existe (estamos editando), verificar que el usuario tuviera acceso al grupo anterior también
        const grupoAnterior = datos[i][2].toString();
        if (!verificarAccesoGrupo_(user, grupoAnterior)) {
          throw new Error('No tiene permiso para modificar este estudiante (pertenece a un grupo no autorizado).');
        }
        filaEncontrada = i + 1;
        break;
      }
    }

    const valores = [
      estudiante.id,
      estudiante.nombre,
      estudiante.grupo,
      estudiante.p1_nombre,
      estudiante.p1_email,
      estudiante.p2_nombre,
      estudiante.p2_email,
      estudiante.independientes || false
    ];

    if (filaEncontrada !== -1) {
      hoja.getRange(filaEncontrada, 1, 1, 8).setValues([valores]);
    } else {
      hoja.appendRow(valores);
    }

    // Procesar progenitores en la tabla Familias
    actualizarFamilia_(estudiante.p1_email, estudiante.p1_nombre, estudiante.p1_pin);
    if (estudiante.p2_email) {
      actualizarFamilia_(estudiante.p2_email, estudiante.p2_nombre, estudiante.p2_pin);
    }

    registrarActividad_(user.email, 'GUARDAR_ESTUDIANTE', `Estudiante ${estudiante.id} guardado/actualizado.`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Asegura que un progenitor exista en la tabla Familias y actualiza su PIN si se proporciona.
 */
function actualizarFamilia_(email, nombre, pinPropuesto) {
  if (!email) return;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(APP_CONFIG.TABLAS.FAMILIAS);
  const datos = hoja.getDataRange().getValues();
  const emailNorm = email.toLowerCase().trim();
  
  let filaEncontrada = -1;
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][0].toString().toLowerCase().trim() === emailNorm) {
      filaEncontrada = i + 1;
      break;
    }
  }
  
  // Si no se propone PIN, generamos uno nuevo si es una familia nueva
  let finalPin = pinPropuesto ? pinPropuesto.toString() : Math.floor(100000 + Math.random() * 900000).toString();
  
  if (filaEncontrada !== -1) {
    // Si la familia existe, actualizamos nombre y PIN (si se proporcionó uno específico)
    hoja.getRange(filaEncontrada, 2).setValue(nombre);
    if (pinPropuesto) {
      hoja.getRange(filaEncontrada, 3).setValue(finalPin);
    }
  } else {
    // Familia nueva
    hoja.appendRow([emailNorm, nombre, finalPin, 'Activo']);
  }
}


/**
 * Elimina un estudiante si no tiene registros asociados.
 */
function eliminarEstudiante(id) {
  try {
    const user = obtenerUsuarioActual_();
    if (!user || user.rol === 'Supervisor') throw new Error('No tiene permisos para eliminar estudiantes.');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Verificar si tiene registros asociados
    const hojaRegistros = ss.getSheetByName(APP_CONFIG.TABLAS.REGISTROS);
    const datosRegistros = hojaRegistros.getDataRange().getValues();
    const idStr = id.toString().trim();
    
    for (let i = 1; i < datosRegistros.length; i++) {
      if (datosRegistros[i][1].toString().trim() === idStr) {
        throw new Error('No se puede eliminar el estudiante porque tiene anotaciones de seguimiento asociadas.');
      }
    }

    // 2. Buscar y eliminar al estudiante
    const hojaEstudiantes = ss.getSheetByName(APP_CONFIG.TABLAS.ESTUDIANTES);
    const datosEstudiantes = hojaEstudiantes.getDataRange().getValues();
    let filaEstudiante = -1;
    let grupoEstudiante = '';

    for (let i = 1; i < datosEstudiantes.length; i++) {
      if (datosEstudiantes[i][0].toString().trim() === idStr) {
        filaEstudiante = i + 1;
        grupoEstudiante = datosEstudiantes[i][2].toString();
        break;
      }
    }

    if (filaEstudiante === -1) throw new Error('Estudiante no encontrado.');

    // Verificar permisos sobre el grupo
    if (!verificarAccesoGrupo_(user, grupoEstudiante)) {
      throw new Error('No tiene permiso para eliminar estudiantes de este grupo.');
    }

    hojaEstudiantes.deleteRow(filaEstudiante);
    registrarActividad_(user.email, 'ELIMINAR_ESTUDIANTE', `Estudiante ${idStr} eliminado.`);
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}
