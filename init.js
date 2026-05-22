/**
 * Inicializa la infraestructura de la Google Sheet.
 * Crea las pestañas necesarias y define los encabezados.
 */
function inicializarApp() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tablas = [
    {
      nombre: APP_CONFIG.TABLAS.USUARIOS,
      cabeceras: ['Email', 'Nombre', 'Rol', 'Estado', 'Grupos']
    },
    {
      nombre: APP_CONFIG.TABLAS.ESTUDIANTES,
      cabeceras: [
        'ID_Estudiante', 
        'Alumno_Apellidos_Nombre', 
        'Grupo', 
        'Progenitor_1_Apellidos_Nombre', 
        'Email_Progenitor_1', 
        'Progenitor_2_Apellidos_Nombre', 
        'Email_Progenitor_2',
        'Progenitores_independientes'
      ]
    },
    {
      nombre: APP_CONFIG.TABLAS.REGISTROS,
      cabeceras: [
        'ID_Registro', 
        'ID_Estudiante', 
        'Fecha', 
        'Tipo', 
        'Descripcion', 
        'Docente_Email', 
        'Vista_Progenitor_1', 
        'Vista_Progenitor_2', 
        'Comentario_Progenitor_1', 
        'Comentario_Progenitor_2', 
        'Fecha_Comentario_Progenitor_1', 
        'Fecha_Comentario_Progenitor_2', 
        'Token_Registro'
      ]
    },
    {
      nombre: APP_CONFIG.TABLAS.FAMILIAS,
      cabeceras: ['Email', 'Apellidos_Nombre', 'PIN', 'Estado']
    },
    {
      nombre: APP_CONFIG.TABLAS.GRUPOS,
      cabeceras: ['Codigo', 'Nombre']
    },
    {
      nombre: APP_CONFIG.TABLAS.AJUSTES,
      cabeceras: ['Parametro', 'Valor', 'Funcion'],
      datosIniciales: [
        ['DEBUG_USER', '', 'Email de usuario que la aplicación reconocerá como conectado.'],
        ['APP_WEBAPP_URL', '', 'URL de la webapp pública, como fallback para pruebas en modo dev.'],
        ['MAINTENANCE_MODE', 'false', 'Si es TRUE (activado) la aplicación muestra un mensaje de mantenimiento, no afecta a admins.'],
        ['APP_NAME', APP_CONFIG.NOMBRE, 'Nombre de la aplicación, se muestra en diferentes lugares de la IU.'],
        ['APP_ACCENT_COLOR', '#1d4ed8', 'Color destacado de la IU, se utiliza en botones, encabezado, etc.'],
        ['APP_LOGO_URL', '', 'URL del logotipo a mostrar en la barra de navegación.'],
        ['APP_FOOTER_LOGO_URL', '', 'URL del logotipo a mostrar en la sección de pie de página.'],
        ['APP_FOOTER_LOGO_LINK_URL', '', 'Enlace del logotipo del pie de página.'],
        ['APP_FOOTER_TEXT', 'Plataforma de comunicación centro-familias.', 'Texto bajo el logotipo, si se omite se muestra un mensaje genérico basado en APP_NAME.'],
        ['HIDE_DETAILS_IN_EMAIL', 'true', 'Indica si las notificaciones por email incluyen la anotación del docente.']
      ]
    },
    {
      nombre: APP_CONFIG.TABLAS.AUDITORIA,
      cabeceras: ['Timestamp', 'Usuario_Email', 'Accion', 'Detalles']
    }
  ];

  tablas.forEach(tabla => {
    let hoja = ss.getSheetByName(tabla.nombre);
    
    if (!hoja) {
      hoja = ss.insertSheet(tabla.nombre);
      console.log('Creada hoja: ' + tabla.nombre);
    }

    if (hoja.getLastRow() === 0) {
      hoja.getRange(1, 1, 1, tabla.cabeceras.length)
        .setValues([tabla.cabeceras])
        .setFontWeight('bold')
        .setBackground('#f3f3f3');
      
      hoja.setFrozenRows(1);

      if (tabla.datosIniciales) {
        hoja.getRange(2, 1, tabla.datosIniciales.length, tabla.datosIniciales[0].length).setValues(tabla.datosIniciales);
      }
    } else if (tabla.nombre === APP_CONFIG.TABLAS.USUARIOS) {
      // Si la hoja Usuarios ya existe, asegurar que tiene la columna Grupos (columna 5)
      if (hoja.getLastColumn() < 5) {
        hoja.getRange(1, 5).setValue('Grupos').setFontWeight('bold').setBackground('#f3f3f3');
      }
    }
  });

  const hojaUsuarios = ss.getSheetByName(APP_CONFIG.TABLAS.USUARIOS);
  const adminEmail = Session.getActiveUser().getEmail().toLowerCase().trim();
  const datosUsuarios = hojaUsuarios.getDataRange().getValues();
  let usuarioExiste = false;

  for (let i = 1; i < datosUsuarios.length; i++) {
    if (datosUsuarios[i][0].toLowerCase().trim() === adminEmail) {
      usuarioExiste = true;
      break;
    }
  }

  if (!usuarioExiste) {
    // Intentamos obtener el nombre del usuario desde sus contactos o perfil si es posible
    let adminNombre = 'Administrador Sistema';
    try {
      const contacto = ContactsApp.getContact(adminEmail);
      if (contacto && contacto.getFullName()) {
        adminNombre = contacto.getFullName();
      }
    } catch (e) { /* ignore */ }
    
    hojaUsuarios.appendRow([adminEmail, adminNombre, 'Administrador', 'Activo', '']);
  }

  console.log('Inicialización completada con éxito.');
  return { success: true, message: 'Infraestructura inicializada.' };
}
