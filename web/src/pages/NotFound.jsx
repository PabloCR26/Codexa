import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="page">
      <h2>Página no encontrada</h2>
      <p className="page-desc">La dirección que abriste no corresponde a ninguna sección.</p>
      <Link to="/">Volver a las automatizaciones</Link>
    </section>
  )
}
