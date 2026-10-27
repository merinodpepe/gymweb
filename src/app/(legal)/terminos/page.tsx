export const metadata = { title: "Términos del servicio", robots: { index: true, follow: true } };

export default function TermsPage() {
  return (
    <>
      <h1>Términos del servicio</h1>
      <p className="text-sm text-muted">Última actualización: 21 de octubre de 2026</p>

      <h2>Qué es Pepe Flock: Gym</h2>
      <p>
        Pepe Flock: Gym es una aplicación personal de seguimiento de peso, pasos, carrera, nutrición y fuerza. Es de uso privado
        de su titular y no es un servicio abierto al público.
      </p>

      <h2>Uso</h2>
      <p>
        El acceso está protegido por contraseña y es solo para el titular. Cualquier otra persona que acceda sin
        autorización no tiene derecho a usar la aplicación ni sus datos.
      </p>

      <h2>Sin garantías</h2>
      <p>
        La aplicación se ofrece &ldquo;tal cual&rdquo;, sin garantía de disponibilidad ni de exactitud. Las estadísticas
        (tendencias, volumen, recomendaciones del coach) son orientativas y no constituyen asesoramiento médico,
        nutricional ni de entrenamiento.
      </p>

      <h2>Servicios de terceros</h2>
      <p>
        La aplicación puede conectarse a Lyfta y a Google Health con permiso del titular. Su uso se rige además por los
        términos de esos servicios. El tratamiento de los datos se describe en la{" "}
        <a href="/privacidad">política de privacidad</a>.
      </p>

      <h2>Cambios</h2>
      <p>Estos términos pueden actualizarse; la fecha de arriba indica la última versión.</p>

      <h2>Contacto</h2>
      <p>
        <a href="https://github.com/merinodpepe/gymweb/issues">github.com/merinodpepe/gymweb/issues</a>
      </p>
    </>
  );
}
