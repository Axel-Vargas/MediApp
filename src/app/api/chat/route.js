import { NextResponse } from 'next/server';
import db from '@/lib/db';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Función para normalizar el texto antes de procesarlo
function normalizeInputText(text) {
  if (!text) return '';
  
  let normalized = text.toLowerCase().trim();
  
  // Reemplazar abreviaciones comunes (orden importante: primero las más específicas)
  // Reemplazar "q " (q seguido de espacio) por "que "
  normalized = normalized.replace(/\bq\s+/g, 'que ');
  // Reemplazar "q" (q como palabra completa) por "que"
  normalized = normalized.replace(/\bq\b/g, 'que');
  
  // Reemplazar "pq" por "porque"
  normalized = normalized.replace(/\bpq\b/g, 'porque');
  normalized = normalized.replace(/\bpq\s+/g, 'porque ');
  
  // Reemplazar "pa" por "para" (solo si no es parte de otra palabra)
  normalized = normalized.replace(/\bpa\s+/g, 'para ');
  normalized = normalized.replace(/\bpa\b/g, 'para');
  
  // Reemplazar "x" por "por"
  normalized = normalized.replace(/\bx\s+/g, 'por ');
  normalized = normalized.replace(/\bx\b/g, 'por');
  
  // Reemplazar "d" por "de" (solo si es palabra completa seguida de espacio)
  normalized = normalized.replace(/\bd\s+/g, 'de ');
  
  // Normalizar nombres de medicamentos comunes
  normalized = normalized.replace(/\bacetaminofen\b/g, 'paracetamol');
  
  // Limpiar espacios múltiples
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

function detectMedicationIntent(message) {
  // Normalizar el mensaje antes de analizarlo
  const normalizedMessage = normalizeInputText(message);
  const lowerMessage = normalizedMessage.toLowerCase().trim();
  console.log('Analizando mensaje original:', message);
  console.log('Analizando mensaje normalizado:', lowerMessage);
  
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
    // Normalizar el mensaje antes de enviarlo a la API
    const normalizedMessage = normalizeInputText(message);
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mediappweb.online', 
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
                    'Si es urgente, recomienda ver a un médico. ' +
                    'Siempre proporciona una respuesta útil, incluso si la pregunta está mal escrita.'
          },
          { role: 'user', content: normalizedMessage }
        ],
        max_tokens: 150,  // Aumentado para respuestas más completas
        temperature: 0.3, 
        top_p: 0.7,      
        frequency_penalty: 0.5,  // Reducido para permitir más flexibilidad
        presence_penalty: 0.3,
        stop: ["</s>", "<s>", "[INST]", "[/INST]"]
      })
    });

    if (!response.ok) {
      console.error('Error en respuesta de OpenRouter:', response.status, response.statusText);
      throw new Error(`Error en API: ${response.status}`);
    }

    const data = await response.json();
    
    // Validar que la respuesta tenga contenido
    let aiResponse = data.choices?.[0]?.message?.content || 
                     data.choices?.[0]?.text || 
                     "Lo siento, no pude entenderte bien. ¿Podrías reformular tu pregunta?";
    
    // Limpiar la respuesta
    aiResponse = aiResponse
      .replace(/<\/s>/g, '')           
      .replace(/<s>/g, '')             
      .replace(/\[\/INST\]/g, '')      
      .replace(/\[INST\]/g, '')        
      .trim();
    
    // Si después de limpiar está vacío, devolver mensaje por defecto
    if (!aiResponse || aiResponse.length === 0) {
      aiResponse = "Lo siento, no pude generar una respuesta. Por favor, intenta reformular tu pregunta de otra manera.";
    }
    
    return aiResponse;
  } catch (error) {
    console.error('Error con OpenRouter:', error);
    return "Lo siento, hubo un problema al procesar tu pregunta. Por favor, intenta de nuevo.";
  }
}

export async function POST(request) {
  try {
    const { messages, pacienteId } = await request.json();
    
    // Validar que haya mensajes
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { text: 'Por favor, envía un mensaje válido.' },
        { status: 400 }
      );
    }
    
    const lastUserMessage = messages[messages.length - 1];
    
    // Validar que el mensaje tenga texto
    if (!lastUserMessage || !lastUserMessage.text || !lastUserMessage.text.trim()) {
      return NextResponse.json(
        { text: 'Por favor, escribe una pregunta o mensaje.' },
        { status: 400 }
      );
    }

    // Normalizar el mensaje antes de procesarlo
    const normalizedText = normalizeInputText(lastUserMessage.text);

    // 1. Consulta por medicamentos
    const intent = detectMedicationIntent(normalizedText);
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
        
        // Validar que la respuesta no esté vacía
        if (!responseText || !responseText.trim()) {
          responseText = "No se encontraron medicamentos activos registrados.";
        }
        
        return NextResponse.json({ text: responseText });
      } else {
        return NextResponse.json({ text: "No se encontraron medicamentos activos registrados." });
      }
    }

    // 2. Consulta genérica a OpenRouter
    const aiReply = await askOpenRouter(normalizedText);
    
    // Validar que la respuesta no esté vacía
    if (!aiReply || !aiReply.trim()) {
      return NextResponse.json({ 
        text: 'Lo siento, no pude generar una respuesta. Por favor, intenta reformular tu pregunta.' 
      });
    }
    
    return NextResponse.json({ text: aiReply });

  } catch (error) {
    console.error('Error en el endpoint de chat:', error);
    return NextResponse.json(
      { text: 'Lo siento, hubo un problema. Intenta de nuevo más tarde.' },
      { status: 500 }
    );
  }
}
