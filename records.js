/**
 * Gestión de registros de seguimiento.
 */

/**
 * Obtiene los registros visibles para el usuario actual.
 */
function listarRegistros() {
  try {
    const user = obtenerUsuarioActual_();
    if (!user) throw new Error('No autorizado.');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Cargar mapa de estudiantes (ID -> {nombre, grupo}) para enriquecer registros y filtrar
    const studentSheet = ss.getSheetByName(APP_CONFIG.TABLAS.ESTUDIANTES);
    const studentData = studentSheet.getDataRange().getValues();
    const studentMap = {};
    for (let i = 1; i < studentData.length; i++) {
      studentMap[studentData[i][0].toString()] = {
        nombre: studentData[i][1].toString(),
        grupo: studentData[i][2].toString()
      };
    }

    const sheet = ss.getSheetByName(APP_CONFIG.TABLAS.REGISTROS);
    const datos = sheet.getDataRange().getValues();
    const registros = [];

    for (let i = 1; i < datos.length; i++) {
      const idEst = datos[i][1].toString();
      const studentInfo = studentMap[idEst] || { nombre: 'Estudiante desconocido', grupo: '' };
      
      if (verificarAccesoGrupo_(user, studentInfo.grupo)) {
        registros.push({
          id: datos[i][0],
          id_estudiante: datos[i][1],
          estudiante_nombre: studentInfo.nombre,
          grupo: studentInfo.grupo,
          fecha: datos[i][2] instanceof Date ? datos[i][2].toISOString() : datos[i][2],
          tipo: datos[i][3],
          descripcion: datos[i][4],
          docente_email: datos[i][5],
          vista_p1: datos[i][6] instanceof Date ? datos[i][6].toISOString() : datos[i][6],
          vista_p2: datos[i][7] instanceof Date ? datos[i][7].toISOString() : datos[i][7],
          comentario_p1: datos[i][8],
          comentario_p2: datos[i][9],
          fecha_p1: datos[i][10] instanceof Date ? datos[i][10].toISOString() : datos[i][10],
          fecha_p2: datos[i][11] instanceof Date ? datos[i][11].toISOString() : datos[i][11],
          token: datos[i][12]
        });
      }
    }

    console.log(`listarRegistros: retornando ${registros.length} registros para ${user.email} (${user.rol})`);
    return { success: true, data: registros.reverse() }; // Más recientes primero
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Obtiene los estudiantes de los grupos asignados al docente.
 */
function obtenerEstudiantesDocente() {
  try {
    const user = obtenerUsuarioActual_();
    if (!user) throw new Error('No autorizado.');
    
    // Los supervisores no tienen acceso a registrar anotaciones
    if (user.rol === 'Supervisor') throw new Error('Los supervisores no tienen permiso para registrar anotaciones.');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(APP_CONFIG.TABLAS.ESTUDIANTES);
    const datos = sheet.getDataRange().getValues();
    const estudiantes = [];

    for (let i = 1; i < datos.length; i++) {
      const grupoEstudiante = datos[i][2].toString();
      if (verificarAccesoGrupo_(user, grupoEstudiante)) {
        estudiantes.push({
          id: datos[i][0],
          nombre: datos[i][1],
          grupo: datos[i][2],
          independientes: datos[i][7] === true || datos[i][7] === 'TRUE'
        });
      }
    }

    // Ordenar por grupo y luego por nombre
    estudiantes.sort((a, b) => {
      if (a.grupo !== b.grupo) return a.grupo.localeCompare(b.grupo);
      return a.nombre.localeCompare(b.nombre);
    });

    return { success: true, data: estudiantes };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Genera el contenido de la notificación para previsualización.
 */
function generarPrevisualizacionNotificacion(datos) {
  console.log('Generando previsualización para:', datos.id_estudiante);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const appName = obtenerAjuste_('APP_NAME') || 'ComuFami';
    
    // Obtener datos del estudiante
    const studentSheet = ss.getSheetByName('Estudiantes');
    const studentData = studentSheet.getDataRange().getValues();
    let student = null;
    for (let i = 1; i < studentData.length; i++) {
      if (studentData[i][0].toString() === datos.id_estudiante.toString()) {
        student = {
          nombre: studentData[i][1],
          p1_nombre: studentData[i][3],
          p2_nombre: studentData[i][5]
        };
        break;
      }
    }

    if (!student) throw new Error('Estudiante no encontrado.');

    const user = obtenerUsuarioActual_();
    console.log('Docente detectado para previsualización:', user);

    // Fallback: si el usuario existe pero el nombre está vacío, usar su email. Si no, 'Equipo docente'.
    let docenteNombre = 'Equipo docente';
    if (user) {
      docenteNombre = user.nombre || user.email || 'Equipo docente';
    }
    
    const fechaStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
    const asunto = `Seguimiento Alumnado: ${student.nombre} (${fechaStr})`;
    
    // Plantilla HTML refinada con espaciado mínimo para evitar saltos dobles en Quill
    const quoteStyle = 'margin: 5px 0; padding: 10px 15px; border-left: 4px solid #3b82f6; color: #374151; font-style: italic; background-color: #f9fafb;';
    
    let cuerpoHtml = `<p>Hola,</p>
<p>Se ha registrado una nueva anotación de seguimiento para <strong>${student.nombre}</strong>:</p>
<blockquote style="${quoteStyle}">${datos.descripcion.replace(/\n/g, '<br>')}</blockquote>
<p>Puede consultar los detalles completos y dejar comentarios para el docente pulsando en <a href="[ENLACE_TOKEN]" style="color: #2563eb; font-weight: bold; text-decoration: underline;">este enlace</a>.</p>
<p>Atentamente,</p>
<p><strong>${docenteNombre}</strong></p>`;

    return { 
      success: true, 
      data: { 
        asunto: asunto, 
        cuerpo: cuerpoHtml,
        destinatarios: student.p1_nombre + (student.p2_nombre ? ' y ' + student.p2_nombre : '')
      } 
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Guarda el registro y envía la notificación.
 */
function guardarRegistroYNotificar(datos) {
  console.log('--- EJECUTANDO GUARDADO REAL ---');
  try {
    const user = obtenerUsuarioActual_();
    if (!user) throw new Error('Usuario no identificado en la tabla Usuarios.');
    if (user.rol === 'Supervisor') throw new Error('Los supervisores no tienen permiso para registrar anotaciones.');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Registros');
    const studentSheet = ss.getSheetByName('Estudiantes');
    
    // Obtener emails de los padres y verificar grupo
    const studentData = studentSheet.getDataRange().getValues();
    let parentEmails = [];
    let grupoEstudiante = '';
    for (let i = 1; i < studentData.length; i++) {
      if (studentData[i][0].toString() === datos.id_estudiante.toString()) {
        grupoEstudiante = studentData[i][2].toString();
        if (studentData[i][4]) parentEmails.push(studentData[i][4]);
        if (studentData[i][6]) parentEmails.push(studentData[i][6]);
        break;
      }
    }

    if (!verificarAccesoGrupo_(user, grupoEstudiante)) {
      throw new Error('No tiene permiso para registrar anotaciones en este grupo.');
    }

    if (parentEmails.length === 0) throw new Error('No se encontraron emails de progenitores.');

    const idRegistro = Utilities.getUuid();
    const token = Utilities.getUuid();
    const fecha = new Date();
    
    const nuevaFila = [
      idRegistro,
      datos.id_estudiante,
      fecha,
      datos.tipo,
      datos.descripcion,
      user.email,
      '', // Vista_Progenitor_1
      '', // Vista_Progenitor_2
      '', // Comentario_Progenitor_1
      '', // Comentario_Progenitor_2
      '', // Fecha_Comentario_Progenitor_1
      '', // Fecha_Comentario_Progenitor_2
      token
    ];

    sheet.appendRow(nuevaFila);

    // Enviar notificación HTML
    const urlApp = ScriptApp.getService().getUrl();
    const enlaceUnico = `${urlApp}?token=${token}`;
    const htmlFinal = datos.notificacion_cuerpo.replace(/\[ENLACE_TOKEN\]/g, enlaceUnico);
    const textoPlano = htmlFinal.replace(/<[^>]*>?/gm, ''); // Fallback básico a texto plano

    // Preparar opciones de envío
    const emailOptions = {
      subject: datos.notificacion_asunto,
      htmlBody: htmlFinal,
      body: textoPlano,
      replyTo: user.email,
      name: obtenerAjuste_('APP_NAME') || 'ComuFami'
    };

    // Lógica de envío dinámica
    if (datos.notificacion_cco) {
      emailOptions.bcc = parentEmails.join(',');
      // Con MailApp podemos omitir el 'to' si hay 'bcc'
      if (datos.notificacion_copia) {
        emailOptions.to = user.email;
      }
      MailApp.sendEmail(emailOptions);
    } else {
      emailOptions.to = parentEmails.join(',');
      if (datos.notificacion_copia) {
        emailOptions.cc = user.email;
      }
      MailApp.sendEmail(emailOptions);
    }

    registrarActividad_(user.email, 'CREAR_REGISTRO', `Registro HTML creado por ${user.nombre} para ID_Estudiante: ${datos.id_estudiante}${datos.notificacion_copia ? ' (con copia)' : ''}`);

    return { success: true, data: idRegistro };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Valida el acceso de un progenitor a un registro específico mediante Token y PIN.
 */
function validarTokenYPin(token, pin) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetRegistros = ss.getSheetByName(APP_CONFIG.TABLAS.REGISTROS);
    const datosRegistros = sheetRegistros.getDataRange().getValues();
    
    let registro = null;
    let filaIndex = -1;
    for (let i = 1; i < datosRegistros.length; i++) {
      if (datosRegistros[i][12] && datosRegistros[i][12].toString() === token) {
        registro = {
          id: datosRegistros[i][0],
          id_estudiante: datosRegistros[i][1],
          fecha: datosRegistros[i][2] instanceof Date ? datosRegistros[i][2].toISOString() : datosRegistros[i][2],
          tipo: datosRegistros[i][3],
          descripcion: datosRegistros[i][4],
          docente_email: datosRegistros[i][5],
          vista_p1: datosRegistros[i][6] instanceof Date ? datosRegistros[i][6].toISOString() : datosRegistros[i][6],
          vista_p2: datosRegistros[i][7] instanceof Date ? datosRegistros[i][7].toISOString() : datosRegistros[i][7],
          comentario_p1: datosRegistros[i][8],
          comentario_p2: datosRegistros[i][9],
          fecha_p1: datosRegistros[i][10] instanceof Date ? datosRegistros[i][10].toISOString() : datosRegistros[i][10],
          fecha_p2: datosRegistros[i][11] instanceof Date ? datosRegistros[i][11].toISOString() : datosRegistros[i][11]
        };
        filaIndex = i + 1;
        break;
      }
    }

    if (!registro) throw new Error('Enlace no válido o caducado.');

    // Obtener datos del estudiante y sus progenitores
    const sheetEstudiantes = ss.getSheetByName(APP_CONFIG.TABLAS.ESTUDIANTES);
    const datosEstudiantes = sheetEstudiantes.getDataRange().getValues();
    let estudiante = null;
    for (let i = 1; i < datosEstudiantes.length; i++) {
      if (datosEstudiantes[i][0].toString() === registro.id_estudiante.toString()) {
        estudiante = {
          nombre: datosEstudiantes[i][1],
          grupo: datosEstudiantes[i][2], // Corregido: añadir grupo
          p1_nombre: datosEstudiantes[i][3],
          p1_email: datosEstudiantes[i][4].toString().toLowerCase().trim(),
          p2_nombre: datosEstudiantes[i][5],
          p2_email: datosEstudiantes[i][6].toString().toLowerCase().trim(),
          independientes: datosEstudiantes[i][7] === true || datosEstudiantes[i][7] === 'TRUE'
        };
        break;
      }
    }

    if (!estudiante) throw new Error('Estudiante no encontrado.');

    // Validar el PIN contra la tabla Familias para los emails vinculados
    const sheetFamilias = ss.getSheetByName(APP_CONFIG.TABLAS.FAMILIAS);
    const datosFamilias = sheetFamilias.getDataRange().getValues();
    let parentIndex = null; // 1 o 2

    for (let i = 1; i < datosFamilias.length; i++) {
      const emailFam = datosFamilias[i][0].toLowerCase().trim();
      const pinFam = datosFamilias[i][2].toString();
      
      if (pinFam === pin.toString()) {
        if (emailFam === estudiante.p1_email) {
          parentIndex = 1;
          break;
        } else if (emailFam === estudiante.p2_email) {
          parentIndex = 2;
          break;
        }
      }
    }

    if (!parentIndex) throw new Error('PIN incorrecto para este registro.');

    // Registrar visualización si es la primera vez
    const colVista = parentIndex === 1 ? 7 : 8; // G o H
    if (!datosRegistros[filaIndex-1][colVista-1]) {
      sheetRegistros.getRange(filaIndex, colVista).setValue(new Date());
    }

    // Filtrar comentarios según privacidad
    const resultado = {
      registro: registro,
      estudiante: estudiante,
      parentIndex: parentIndex,
      nombrePadre: parentIndex === 1 ? estudiante.p1_nombre : estudiante.p2_nombre
    };

    if (estudiante.independientes) {
      // Si son independientes, solo ve su propio comentario
      if (parentIndex === 1) {
        resultado.registro.comentario_p2 = null;
        resultado.registro.fecha_p2 = null;
      } else {
        resultado.registro.comentario_p1 = null;
        resultado.registro.fecha_p1 = null;
      }
    }

    return { success: true, data: resultado };

  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Guarda el comentario de un progenitor.
 */
function guardarComentarioFamilia(token, pin, comentario) {
  try {
    const auth = validarTokenYPin(token, pin);
    if (!auth.success) throw new Error(auth.error);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(APP_CONFIG.TABLAS.REGISTROS);
    const datos = sheet.getDataRange().getValues();
    
    let filaIndex = -1;
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][12] && datos[i][12].toString() === token) {
        filaIndex = i + 1;
        break;
      }
    }

    const parentIndex = auth.data.parentIndex;
    const colComentario = parentIndex === 1 ? 9 : 10; // I o J
    const colFecha = parentIndex === 1 ? 11 : 12; // K o L

    sheet.getRange(filaIndex, colComentario).setValue(comentario);
    sheet.getRange(filaIndex, colFecha).setValue(new Date());

    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Obtiene el detalle completo de un registro para el personal (staff).
 */
function obtenerDetalleRegistroStaff(idRegistro) {
  try {
    const user = obtenerUsuarioActual_();
    if (!user) throw new Error('No autorizado.');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetRegistros = ss.getSheetByName(APP_CONFIG.TABLAS.REGISTROS);
    const datosRegistros = sheetRegistros.getDataRange().getValues();
    
    let registro = null;
    for (let i = 1; i < datosRegistros.length; i++) {
      if (datosRegistros[i][0].toString() === idRegistro) {
        registro = {
          id: datosRegistros[i][0],
          id_estudiante: datosRegistros[i][1],
          fecha: datosRegistros[i][2] instanceof Date ? datosRegistros[i][2].toISOString() : datosRegistros[i][2],
          tipo: datosRegistros[i][3],
          descripcion: datosRegistros[i][4],
          docente_email: datosRegistros[i][5],
          vista_p1: datosRegistros[i][6] instanceof Date ? datosRegistros[i][6].toISOString() : datosRegistros[i][6],
          vista_p2: datosRegistros[i][7] instanceof Date ? datosRegistros[i][7].toISOString() : datosRegistros[i][7],
          comentario_p1: datosRegistros[i][8],
          comentario_p2: datosRegistros[i][9],
          fecha_p1: datosRegistros[i][10] instanceof Date ? datosRegistros[i][10].toISOString() : datosRegistros[i][10],
          fecha_p2: datosRegistros[i][11] instanceof Date ? datosRegistros[i][11].toISOString() : datosRegistros[i][11]
        };
        break;
      }
    }

    if (!registro) throw new Error('Registro no encontrado.');

    // Obtener datos del estudiante
    const sheetEstudiantes = ss.getSheetByName(APP_CONFIG.TABLAS.ESTUDIANTES);
    const datosEstudiantes = sheetEstudiantes.getDataRange().getValues();
    let estudiante = null;
    for (let i = 1; i < datosEstudiantes.length; i++) {
      if (datosEstudiantes[i][0].toString() === registro.id_estudiante.toString()) {
        estudiante = {
          nombre: datosEstudiantes[i][1],
          grupo: datosEstudiantes[i][2],
          p1_nombre: datosEstudiantes[i][3],
          p2_nombre: datosEstudiantes[i][5],
          independientes: datosEstudiantes[i][7] === true || datosEstudiantes[i][7] === 'TRUE'
        };
        break;
      }
    }

    if (!estudiante) throw new Error('Estudiante no encontrado.');

    // Verificar acceso al grupo
    if (!verificarAccesoGrupo_(user, estudiante.grupo)) {
      throw new Error('No tiene permiso para ver este registro.');
    }

    return { 
      success: true, 
      data: { 
        registro: registro, 
        estudiante: estudiante,
        esStaff: true // Para que el frontend sepa que no debe mostrar el formulario de respuesta
      } 
    };

  } catch (e) {
    return { success: false, error: e.toString() };
  }
}
function listarRegistrosFamilia(email, pin) {
  try {
    const auth = loginFamilia(email, pin);
    if (!auth.success) throw new Error(auth.error);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hijosResp = obtenerHijosFamilia(email);
    if (!hijosResp.success) throw new Error(hijosResp.error);

    const idsHijos = hijosResp.data.map(h => h.id.toString());
    const hijosMap = {};
    hijosResp.data.forEach(h => hijosMap[h.id.toString()] = { nombre: h.nombre, grupo: h.grupo });

    const sheetRegistros = ss.getSheetByName(APP_CONFIG.TABLAS.REGISTROS);
    const datos = sheetRegistros.getDataRange().getValues();
    const registros = [];

    const emailNorm = email.toLowerCase().trim();

    for (let i = 1; i < datos.length; i++) {
      const idEst = datos[i][1].toString();
      if (idsHijos.includes(idEst)) {
        // Determinar si somos P1 o P2 para este estudiante
        const sheetEst = ss.getSheetByName(APP_CONFIG.TABLAS.ESTUDIANTES);
        const datosEst = sheetEst.getDataRange().getValues();
        let parentIndex = 0;

        for (let j = 1; j < datosEst.length; j++) {
          if (datosEst[j][0].toString() === idEst) {
            if (datosEst[j][4].toLowerCase().trim() === emailNorm) parentIndex = 1;
            else if (datosEst[j][6].toLowerCase().trim() === emailNorm) parentIndex = 2;
            break;
          }
        }

        const comentarioPropio = parentIndex === 1 ? datos[i][8] : datos[i][9];
        
        registros.push({
          token: datos[i][12],
          estudiante_nombre: hijosMap[idEst].nombre,
          grupo: hijosMap[idEst].grupo,
          fecha: datos[i][2] instanceof Date ? datos[i][2].toISOString() : datos[i][2],
          tipo: datos[i][3],
          descripcion: datos[i][4],
          tiene_comentario: !!comentarioPropio
        });
      }
    }

    return { success: true, data: registros.reverse() };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

