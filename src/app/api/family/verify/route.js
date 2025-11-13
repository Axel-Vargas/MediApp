import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { decryptFromPacked, isDataKeyConfigured } from '@/lib/crypto';

export async function POST(request) {
  let connection;
  try {
    const { phone, verificationCode } = await request.json();
    
    if (!phone || !verificationCode) {
      return NextResponse.json(
        { error: 'Número de teléfono y código de verificación son requeridos' },
        { status: 400 }
      );
    }

    connection = await db.getConnection();

    // Obtener todos los familiares para buscar por teléfono y código
    const [allFamiliares] = await connection.query(
      `SELECT 
        f.id, f.nombre, f.relacion, f.email, f.telefono, 
        f.codigoVerificacion, f.verificado, f.fechaVerificacion,
        p.id as pacienteId, u.nombre as pacienteNombre, u.telefono as pacienteTelefono
       FROM familiares f
       INNER JOIN pacientes_familiares pf ON f.id = pf.familiarId
       INNER JOIN pacientes p ON pf.pacienteId = p.id
       INNER JOIN usuarios u ON p.usuarioId = u.id`
    );

    // Buscar el familiar por teléfono y código de verificación
    let familiarEncontrado = null;
    
    if (isDataKeyConfigured()) {
      for (const familiar of allFamiliares) {
        try {
          const telefonoDescifrado = decryptFromPacked(familiar.telefono) || familiar.telefono;
          const codigoDescifrado = decryptFromPacked(familiar.codigoVerificacion) || familiar.codigoVerificacion;
          
          console.log('Comparando:', {
            telefonoIngresado: phone,
            telefonoDescifrado: telefonoDescifrado,
            codigoIngresado: verificationCode,
            codigoDescifrado: codigoDescifrado
          });
          
          if (String(telefonoDescifrado) === String(phone) && String(codigoDescifrado) === String(verificationCode)) {
            familiarEncontrado = familiar;
            break;
          }
        } catch (error) {
          console.error('Error al descifrar datos del familiar:', error);
          continue;
        }
      }
    } else {
      familiarEncontrado = allFamiliares.find(f => 
        String(f.telefono) === String(phone) && String(f.codigoVerificacion) === String(verificationCode)
      );
    }

    if (!familiarEncontrado) {
      return NextResponse.json(
        { error: 'Teléfono o código de verificación incorrecto' },
        { status: 404 }
      );
    }

    const familiar = familiarEncontrado;

    // Descifrar los datos del familiar y paciente si hay clave configurada
    if (isDataKeyConfigured()) {
      try {
        familiar.nombre = decryptFromPacked(familiar.nombre) || familiar.nombre;
        familiar.email = decryptFromPacked(familiar.email) || familiar.email;
        familiar.telefono = decryptFromPacked(familiar.telefono) || familiar.telefono;
        familiar.relacion = decryptFromPacked(familiar.relacion) || familiar.relacion;
        
        familiar.pacienteNombre = decryptFromPacked(familiar.pacienteNombre) || familiar.pacienteNombre;
        familiar.pacienteTelefono = decryptFromPacked(familiar.pacienteTelefono) || familiar.pacienteTelefono;
        
        console.log('Datos descifrados para familiar:', {
          familiarNombre: familiar.nombre,
          pacienteNombre: familiar.pacienteNombre
        });
      } catch (error) {
        console.error('Error al descifrar datos del familiar:', error);
      }
    }

    // Verificar si el familiar ya está verificado
    if (!familiar.verificado) {
      await connection.query(
        'UPDATE familiares SET verificado = 1, fechaVerificacion = NOW() WHERE id = ?',
        [familiar.id]
      );
      familiar.verificado = 1;
      familiar.fechaVerificacion = new Date().toISOString();
    }

    return NextResponse.json({
      success: true,
      familiar: {
        id: familiar.id,
        nombre: familiar.nombre,
        email: familiar.email,
        telefono: familiar.telefono,
        relacion: familiar.relacion,
        paciente: {
          id: familiar.pacienteId,
          nombre: familiar.pacienteNombre,
          telefono: familiar.pacienteTelefono
        }
      }
    });

  } catch (error) {
    console.error('Error al verificar familiar:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al verificar el familiar' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en POST /api/family/verify');
      } catch (releaseError) {
        console.error('Error al liberar conexión en POST /api/family/verify:', releaseError);
      }
    }
  }
}
