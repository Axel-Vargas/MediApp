import React from 'react';
import '../globals.css';

const PolicyModal = ({ isOpen, onAccept, onReject }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 m-0">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] m-4 overflow-hidden">
        <div className="overflow-y-auto custom-scrollbar max-h-[90vh]">
          <div className="p-6 pr-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Política de Privacidad</h2>

            <div className="prose prose-sm max-w-none text-gray-600 mb-6 space-y-6">
              <p className="text-justify">
                Al usar esta plataforma, aceptas nuestra Política de Privacidad. Esta política describe cómo recopilamos, usamos y protegemos tu información personal en el contexto del monitoreo de tratamientos médicos.
              </p>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">1. Responsable del tratamiento de datos</h3>
                <p>
                  El responsable del tratamiento de los datos personales es el desarrollador individual de este aplicativo, quien asume el compromiso de proteger y manejar la información conforme a la legislación vigente en materia de protección de datos.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">2. Datos recopilados</h3>
                <p>Recopilamos únicamente los datos necesarios para el funcionamiento del sistema, como:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><span className="font-medium">Datos del paciente:</span> nombre, contacto, información de medicación.</li>
                  <li><span className="font-medium">Datos del familiar:</span> nombre, relación, número de teléfono, correo electrónico.</li>
                  <li><span className="font-medium">Verificación:</span> códigos de autenticación para ingreso seguro.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">3. Finalidad del tratamiento</h3>
                <p>Los datos serán utilizados exclusivamente para:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Registrar tratamientos médicos.</li>
                  <li>Generar alertas o recordatorios.</li>
                  <li>Notificar a familiares/medicos del cumplimiento del tratamiento.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">4. Notificaciones Push</h3>
                <p>
                  <span className="font-medium">Al aceptar esta política, también autorizas el envío de notificaciones push</span> para:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Recordatorios de medicación programada</li>
                  <li>Alertas cuando sea hora de tomar medicamentos</li>
                  <li>Notificaciones sobre cambios en el tratamiento</li>
                  <li>Comunicaciones importantes del sistema</li>
                </ul>
                <p className="text-sm text-gray-500 mt-2">
                  Las notificaciones push funcionan incluso cuando el navegador está cerrado y solo se envían para recordatorios médicos importantes. 
                  Puedes desactivarlas en cualquier momento desde la configuración de tu navegador o desde la aplicación.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">5. Base legal para el tratamiento</h3>
                <p>
                  El tratamiento de los datos personales se basa en el consentimiento explícito del paciente, del familiar o del profesional médico correspondiente. Este consentimiento puede ser revocado en cualquier momento mediante una solicitud escrita enviada al correo electrónico indicado en la plataforma.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">6. Derechos del titular de los datos</h3>
                <p>Conforme a la LOPDP, tienes derecho a:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Acceder a tus datos personales.</li>
                  <li>Solicitar la rectificación de datos incorrectos.</li>
                  <li>Pedir la eliminación o supresión de tu información.</li>
                  <li>Oponerte al tratamiento o solicitar su limitación.</li>
                  <li>Portar tus datos a otro responsable si así lo deseas.</li>
                </ul>
                <p>Las solicitudes pueden hacerse por correo electrónico o mediante los canales de contacto proporcionados en la aplicación.</p>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">7. Conservación de los datos</h3>
                <p>
                  Los datos se conservarán únicamente durante el tiempo necesario para cumplir con la finalidad para la que fueron recolectados, o mientras el paciente o familiar lo mantenga activo. Posteriormente, serán eliminados de forma segura.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">8. Seguridad de los datos</h3>
                <p>Se aplican medidas técnicas y organizativas para proteger la información:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Cifrado de datos sensibles.</li>
                  <li>Verificación por código temporal para familiares.</li>
                  <li>Control de acceso limitado solo a usuarios autorizados.</li>
                  <li>Notificaciones push seguras con encriptación.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">9. Divulgación a terceros</h3>
                <p>
                  No se compartirá tu información personal con terceros sin tu consentimiento, salvo en los siguientes casos:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Por requerimiento legal o judicial.</li>
                  <li>Para la atención médica, si es necesario y autorizado por el paciente o su tutor legal.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">10. Transferencias internacionales de datos</h3>
                <p>
                  En caso de uso de servicios de terceros (como almacenamiento en la nube), se garantiza que dichos servicios cumplan con estándares adecuados de protección de datos.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">11. Modificaciones a esta política</h3>
                <p>
                  Nos reservamos el derecho de modificar esta política de privacidad en cualquier momento. Los cambios serán notificados a través de la aplicación o por correo electrónico.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">12. Contacto</h3>
                <p>
                  Para cualquier consulta sobre esta política de privacidad o el tratamiento de tus datos personales, puedes contactarnos a través de los canales de comunicación proporcionados en la aplicación.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 mt-6">
              <button
                onClick={onReject}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-200 transition-colors"
              >
                Rechazar
              </button>
              <button
                onClick={onAccept}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PolicyModal;
