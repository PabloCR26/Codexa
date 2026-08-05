import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Automations from './pages/Automations'
import AutomationForm from './pages/AutomationForm'
import Connections from './pages/Connections'
import Executions from './pages/Executions'
import ExecutionDetail from './pages/ExecutionDetail'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'
import './Style/App.css'

// Mapa de rutas de la aplicación. Las páginas son plantillas vacías que se
// implementan en las fases 2 a 9 de TAREAS.md.
//
// Pendiente (tarea 17): envolver las rutas privadas en un componente de ruta
// protegida que redirija a /login cuando no haya sesión.
export default function App() {
  return (
    <Routes>
      {/* Rutas públicas: sin la navegación principal */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Rutas privadas: comparten la cabecera con navegación */}
      <Route element={<Layout />}>
        <Route path="/" element={<Automations />} />
        <Route path="/automations/new" element={<AutomationForm />} />
        <Route path="/automations/:id" element={<AutomationForm />} />
        <Route path="/connections" element={<Connections />} />
        <Route path="/executions" element={<Executions />} />
        <Route path="/executions/:id" element={<ExecutionDetail />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
