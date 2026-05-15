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
function guardarEstudiante(estudiante) {
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
        // Si ya existe, verificar que el usuario tuviera acceso al grupo anterior también (opcional pero seguro)
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

