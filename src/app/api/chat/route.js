import { NextResponse } from 'next/server';
import db from '@/lib/db';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

function detectMedicationIntent(message) {
  const lowerMessage = message.toLowerCase().trim();
  console.log('Analizando mensaje:', lowerMessage);
  
  // Detección de consulta sobre consecuencias (tiene prioridad)
  const isConsequenceQuery = /\b(qu[eé] pasa si|qu[eé] sucede si|consecuencia|peligro|riesgo|pasa si no|sucede si no)\b/i.test(lowerMessage) && 
                           /\b(no |olvido|dejo de|me salto|no tomo|olvid[oé]|salto|me olvido|dej[oó] de)/i.test(lowerMessage);
  
  if (isConsequenceQuery) {
    console.log('Consulta sobre consecuencias detectada');
    return {
      isMedicationQuery: false,
      wantsDays: false,
      wantsHours: false
    };
  }
  
  // Detección de consulta sobre medicación
  const hasMedicationWord = /\b(medicamentos?|pastillas?|medicinas?|medicación|tratamiento|medicaci[oó]n)\b/i.test(lowerMessage);
  
  // Detección de consulta sobre días (solo si hay palabras clave de días y de medicación)
  const hasDayWords = /\b(d[ií]as?|cu[aá]ndo|qué d[ií]as?|qué d[ií]a|qué día|qué días)\b/i.test(lowerMessage);
  const wantsDays = hasMedicationWord && hasDayWords;
  
  // Detección de consulta sobre horarios (solo si hay palabras clave de tiempo y de medicación)
  const hasTimeWords = /\b(horas?|a qu[eé] hora|a qué horas|cu[aá]ndo (tomar|tomo)|hora de tomar|horario)\b/i.test(lowerMessage);
  const wantsHours = hasMedicationWord && hasTimeWords;
  
  const isMedicationQuery = hasMedicationWord && !isConsequenceQuery;
  
  console.log('Intención detectada:', { 
    isMedicationQuery, 
    wantsDays, 
    wantsHours,
    isConsequenceQuery
  });
  
  return {
    isMedicationQuery,
    wantsDays,
    wantsHours
  };
}

async function getPatientMedications(pacienteId, options = {}) {
  let connection;
  try {
    connection = await db.getConnection();
    
    let query = `
      SELECT 
        m.nombreMedicamento,
        m.dosis,
        m.viaAdministracion,
        m.dias,
        m.horario,
        m.duracionDias,
        m.notas,
        m.activo,
        v.nombre as viaAdministracionNombre
      FROM medicaciones m
      LEFT JOIN vias_administracion v ON m.viaAdministracion = v.id
      WHERE m.pacienteId = ?`;
    
    const params = [pacienteId];
    
    if (options.activeOnly) {
      query += ' AND m.activo = 1';
    }
    
    query += ' ORDER BY m.nombreMedicamento';
    
    const [rows] = await connection.query(query, params);
    
    const { decryptFromPacked, isDataKeyConfigured } = await import('@/lib/crypto');
    
    // Si hay clave de cifrado configurada, descifrar los campos sensibles
    if (isDataKeyConfigured()) {
      const decryptedRows = rows.map(row => ({
        ...row,
        nombreMedicamento: decryptFromPacked(row.nombreMedicamento) || row.nombreMedicamento,
        dosis: decryptFromPacked(row.dosis) || row.dosis,
        notas: row.notas ? decryptFromPacked(row.notas) : ''
      }));
      return decryptedRows;
    } else {
      console.warn('⚠️ ADVERTENCIA: No hay clave de cifrado configurada (DATA_KEY_HEX)');
      return rows;
    }
  } catch (error) {
    console.error('Error al obtener medicamentos:', error);
    return null;
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en getPatientMedications');
      } catch (releaseError) {
        console.error('Error al liberar conexión en getPatientMedications:', releaseError);
      }
    }
  }
}

function formatMedicationsResponse(medications, options = {}) {
  if (!medications || medications.length === 0) {
    return "No tienes medicamentos registrados.";
  }

  let response = "";
  
  if (options.showDays) {
    response += "📅 *Días de medicación*\n\n";
    medications.forEach(med => {
      response += `• ${med.nombreMedicamento}: ${med.dias}\n`;
    });
  } 
  else if (options.showHours) {
    response += "⏰ *Horarios de medicación*\n\n";
    medications.forEach(med => {
      response += `• ${med.nombreMedicamento}: ${med.horario}\n`;
    });
  }
  else {
    response = "💊 *Tus medicamentos*\n\n";
    medications.forEach(med => {
      response += `• *${med.nombreMedicamento}* (${med.dosis})\n`;
      response += `  - Vía: ${med.viaAdministracionNombre || 'No especificada'}\n`;
      response += `  - Días: ${med.dias}\n`;
      response += `  - Horario: ${med.horario}\n`;
      if (med.duracionDias) response += `  - Duración: ${med.duracionDias} días\n`;
      if (med.notas) response += `  - Notas: ${med.notas}\n`;
      response += "\n";
    });
  }

  return response;
}

async function askOpenRouter(message) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://tusitio.com', 
        'X-Title': 'ChatMedico'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct',
        messages: [
          { 
            role: 'system', 
            content: 'Eres un asistente médico. Responde de forma clara y concisa (30-40 palabras máximo). ' +
                    'Solo temas médicos. Si no es sobre salud, di que solo puedes ayudar con medicina. ' +
                    'Sé directo y evita rodeos. Usa viñetas si es necesario. ' +
                    'Si es urgente, recomienda ver a un médico.'
          },
          { role: 'user', content: message }
        ],
        max_tokens: 100,  
        temperature: 0.3, 
        top_p: 0.7,      
        frequency_penalty: 0.7, 
        presence_penalty: 0.3,
        stop: ["</s>", "<s>", "[INST]", "[/INST]"]
      })
    });

    const data = await response.json();
    let aiResponse = data.choices?.[0]?.message?.content || "Lo siento, no pude entenderte bien.";
    
    // Limpiar tokens especiales de fin de secuencia
    aiResponse = aiResponse
      .replace(/<\/s>/g, '')           
      .replace(/<s>/g, '')             
      .replace(/\[\/INST\]/g, '')      
      .replace(/\[INST\]/g, '')        
      .trim();                         
    
    return aiResponse;
  } catch (error) {
    console.error('Error con OpenRouter:', error);
    return "Lo siento, hubo un problema al procesar tu pregunta.";
  }
}

export async function POST(request) {
  try {
    const { messages, pacienteId } = await request.json();
    const lastUserMessage = messages[messages.length - 1];

    // 1. Consulta por medicamentos
    const intent = detectMedicationIntent(lastUserMessage.text);
    if (intent.isMedicationQuery && pacienteId) {
      const medications = await getPatientMedications(pacienteId, { activeOnly: true });
      
      if (medications && medications.length > 0) {
        let responseText;
        
        if (intent.wantsDays) {
          responseText = formatMedicationsResponse(medications, { showDays: true });
        } 
        else if (intent.wantsHours) {
          responseText = formatMedicationsResponse(medications, { showHours: true });
        } 
        else {
          responseText = formatMedicationsResponse(medications);
        }
        
        return NextResponse.json({ text: responseText });
      } else {
        return NextResponse.json({ text: "No se encontraron medicamentos activos registrados." });
      }
    }

    // 2. Consulta genérica a OpenRouter
    const aiReply = await askOpenRouter(lastUserMessage.text);
    return NextResponse.json({ text: aiReply });

  } catch (error) {
    console.error('Error en el endpoint de chat:', error);
    return NextResponse.json(
      { error: 'Lo siento, hubo un problema. Intenta de nuevo más tarde.' },
      { status: 500 }
    );
  }
}
