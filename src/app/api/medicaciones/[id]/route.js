import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { programarNotificaciones } from '@/lib/utils/programarNotificaciones';
import { encryptToPacked, isDataKeyConfigured } from '@/lib/crypto';

// PUT /api/medicaciones/[id] - Editar medicación
export async function PUT(request, { params }) {
  let connection;
  try {
    const { id: medicacionId } = await params;
    const body = await request.json();
    const { name, dosage, administrationRoute, durationDays, fechaInicio, fechaFin, notes, days, hours, active } = body;

    console.log(`[API] Editando medicación ${medicacionId}:`, body);

    if (!medicacionId || isNaN(parseInt(medicacionId))) {
      return NextResponse.json({ message: 'ID de medicación inválido' }, { status: 400 });
    }

    if (!name || !dosage) {
      return NextResponse.json({ 
        message: 'Los campos "name" y "dosage" son requeridos' 
      }, { status: 400 });
    }

    connection = await db.getConnection();

    // Verificar que la medicación existe
    const [medicacion] = await connection.query(
      `SELECT id, nombreMedicamento, pacienteId FROM medicaciones WHERE id = ?`,
      [medicacionId]
    );

    if (medicacion.length === 0) {
      return NextResponse.json(
        { message: 'Medicación no encontrada' },
        { status: 404 }
      );
    }

    // Cifrar campos sensibles si hay clave configurada
    const nombreCifrado = name && isDataKeyConfigured() ? encryptToPacked(name) : name;
    const dosisCifrada = dosage && isDataKeyConfigured() ? encryptToPacked(dosage) : dosage;
    const notasCifradas = notes && isDataKeyConfigured() ? encryptToPacked(notes) : notes;
    
    // Preparar los datos para la actualización
    const updateData = {
      nombreMedicamento: nombreCifrado,
      dosis: dosisCifrada,
      viaAdministracion: administrationRoute || null,
      duracionDias: durationDays || null,
      fechaInicio: fechaInicio || null,
      fechaFin: fechaFin || null,
      notas: notasCifradas || null,
      dias: Array.isArray(days) ? days.join(',') : days || null,
      horario: Array.isArray(hours) ? JSON.stringify(hours) : hours || null,
      activo: active ? 1 : 0
    };

    // Construir la consulta SQL dinámicamente
    const fields = Object.keys(updateData).filter(key => updateData[key] !== null);
    const values = fields.map(field => updateData[field]);
    const setClause = fields.map(field => `${field} = ?`).join(', ');

    const query = `UPDATE medicaciones SET ${setClause} WHERE id = ?`;
    values.push(medicacionId);

    // Actualizar la medicación
    await connection.query(query, values);

    console.log(`[API] Medicación ${medicacionId} actualizada exitosamente`);
    
    // Si se actualizaron las fechas o los horarios, reprogramar notificaciones
    const fechasCambiaron = fechaInicio !== undefined || fechaFin !== undefined;
    const horariosCambiaron = hours !== undefined;
    
    if (fechasCambiaron || horariosCambiaron) {
      try {
        // Eliminar notificaciones pendientes antiguas
        await connection.query(
          `DELETE FROM notificaciones 
           WHERE medicacionId = ? AND estado = 'pendiente' AND fechaProgramada > NOW()`,
          [medicacionId]
        );
        
        console.log(`[API] Notificaciones antiguas eliminadas para medicación ${medicacionId}`);
        
        // Reprogramar notificaciones con las nuevas fechas/horarios
        await programarNotificaciones(medicacionId);
        
        console.log(`[API] Notificaciones reprogramadas para medicación ${medicacionId}`);
      } catch (error) {
        console.error('[API] Error al reprogramar notificaciones:', error);
      }
    }

    return NextResponse.json({
      message: 'Medicación actualizada exitosamente',
      medicacionId: medicacionId,
      updatedData: updateData
    });

  } catch (error) {
    console.error('[API] Error al actualizar medicación:', error);
    console.error('[API] Stack trace:', error.stack);
    
    return NextResponse.json(
      { 
        message: 'Error al actualizar la medicación', 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// DELETE /api/medicaciones/[id] - Eliminar medicación
export async function DELETE(request, { params }) {
  let connection;
  try {
    const { id: medicacionId } = await params;

    console.log(`[API] Eliminando medicación ${medicacionId}`);

    if (!medicacionId || isNaN(parseInt(medicacionId))) {
      return NextResponse.json({ message: 'ID de medicación inválido' }, { status: 400 });
    }

    connection = await db.getConnection();

    // Verificar que la medicación existe
    const [medicacion] = await connection.query(
      `SELECT id, nombreMedicamento, pacienteId FROM medicaciones WHERE id = ?`,
      [medicacionId]
    );

    if (medicacion.length === 0) {
      return NextResponse.json(
        { message: 'Medicación no encontrada' },
        { status: 404 }
      );
    }

    // Eliminar notificaciones relacionadas
    await connection.query(
      `DELETE FROM notificaciones WHERE medicacionId = ?`,
      [medicacionId]
    );

    // Eliminar registros relacionados en historial_tomas
    await connection.query(
      `DELETE FROM historial_tomas WHERE medicacionId = ?`,
      [medicacionId]
    );

    // Eliminar la medicación
    await connection.query(
      `DELETE FROM medicaciones WHERE id = ?`,
      [medicacionId]
    );

    console.log(`[API] Medicación ${medicacionId} eliminada exitosamente`);

    return NextResponse.json({
      message: 'Medicación eliminada exitosamente',
      medicacionId: medicacionId
    });

  } catch (error) {
    console.error('[API] Error al eliminar medicación:', error);
    console.error('[API] Stack trace:', error.stack);
    
    return NextResponse.json(
      { 
        message: 'Error al eliminar la medicación', 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
