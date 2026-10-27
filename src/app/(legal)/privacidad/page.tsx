export const metadata = { title: "Política de privacidad", robots: { index: true, follow: true } };

export default function PrivacyPage() {
  return (
    <>
      <h1>Política de privacidad</h1>
      <p className="text-sm text-muted">Última actualización: 21 de octubre de 2026</p>

      <p>
        Pepe Flock: Gym es una aplicación web personal, de uso privado, para llevar el registro propio de peso, pasos, carrera,
        nutrición y entrenamientos de fuerza. Está desarrollada y usada por una única persona, su titular. No ofrece
        registro de usuarios ni se presta a terceros.
      </p>

      <h2>Qué datos trata</h2>
      <ul>
        <li>Los datos que el titular introduce o importa: peso, pasos, carreras, nutrición y entrenamientos (por ejemplo, de Lyfta).</li>
        <li>
          Si el titular lo autoriza, los <strong>pasos diarios</strong> de su cuenta de Google Health. Pepe Flock: Gym solo pide
          permiso de lectura de actividad (<code>googlehealth.activity_and_fitness.readonly</code>) y no lee ni escribe ningún otro dato de Google.
        </li>
        <li>Un token de renovación de Google, guardado cifrado, para poder repetir la lectura de pasos sin volver a pedir permiso.</li>
      </ul>

      <h2>Para qué se usan</h2>
      <p>
        Exclusivamente para mostrar gráficas y estadísticas al titular dentro de la propia aplicación. Los datos no se
        venden, no se comparten con terceros, no se usan para publicidad y no se usan para entrenar modelos de
        inteligencia artificial.
      </p>

      <h2>Dónde se guardan</h2>
      <p>
        En una base de datos privada (Neon) alojada en la Unión Europea, y la aplicación se ejecuta en Vercel. Solo el
        titular puede acceder, con contraseña. Las copias de seguridad se cifran.
      </p>

      <h2>Uso de datos de Google</h2>
      <p>
        El uso y la transferencia a cualquier otra aplicación de la información recibida de las API de Google se
        ajustará a la{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">Política de datos de usuario de los servicios de API de Google</a>,
        incluidos los requisitos de uso limitado.
      </p>
      <p className="text-sm text-muted">
        Pepe Flock: Gym&apos;s use and transfer to any other app of information received from Google APIs will adhere to the Google
        API Services User Data Policy, including the Limited Use requirements.
      </p>

      <h2>Cómo borrar los datos o retirar el permiso</h2>
      <ul>
        <li>
          Desconectar Google Health desde la página <em>Importar</em> de la aplicación borra el token guardado. Puedes
          además retirar el acceso en{" "}
          <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.
        </li>
        <li>Los registros se pueden borrar desde la aplicación o pidiendo su eliminación completa a través del contacto indicado abajo.</li>
      </ul>

      <h2>Contacto</h2>
      <p>
        Para cualquier duda sobre esta política, abre una incidencia en{" "}
        <a href="https://github.com/merinodpepe/gymweb/issues">github.com/merinodpepe/gymweb/issues</a>.
      </p>
    </>
  );
}
