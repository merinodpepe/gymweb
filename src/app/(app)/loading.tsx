export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="animate-pulse space-y-4">
      <div className="h-10 w-48 rounded bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 rounded-lg bg-surface" />
        ))}
      </div>
      <div className="h-72 rounded-lg bg-surface" />
    </div>
  );
}
