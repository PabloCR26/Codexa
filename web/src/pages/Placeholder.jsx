// Componente base para las páginas aún no implementadas.
// Cada página indica la tarea de TAREAS.md que la desarrollará.
export default function Placeholder({ titulo, tarea, descripcion }) {
  return (
    <section className="page">
      <h2>{titulo}</h2>
      <p className="page-desc">{descripcion}</p>
      <p className="page-task">Pendiente — tarea {tarea} de TAREAS.md</p>
    </section>
  )
}
