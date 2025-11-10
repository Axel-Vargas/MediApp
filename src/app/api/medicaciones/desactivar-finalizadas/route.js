import { NextResponse } from 'next/server';
import { desactivarMedicacionesFinalizadas } from '@/lib/utils/desactivarMedicacionesFinalizadas';

// GET /api/medicaciones/desactivar-finalizadas
export async function GET(request) {
  try {
    console.log('[API] Ejecutando desactivación de medicaciones finalizadas...');
    
    const resultado = await desactivarMedicacionesFinalizadas();
    
    return NextResponse.json({
      success: true,
      message: `${resultado.desactivadas} medicaciones desactivadas`,
      ...resultado
    });
    
  } catch (error) {
    console.error('[API] Error al desactivar medicaciones finalizadas:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Error al desactivar medicaciones finalizadas', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// POST /api/medicaciones/desactivar-finalizadas
export async function POST(request) {
  return GET(request);
}

