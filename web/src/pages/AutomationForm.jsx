import Placeholder from './Placeholder'

// Sirve para crear (/automations/new) y para editar (/automations/:id).
export default function AutomationForm() {
  return (
    <Placeholder
      titulo="Editor de automatización"
      tarea="33 a 37"
      descripcion="Nombre y disparador, editor de acciones con plantillas {{trigger.campo}} y editor de condiciones."
    />
  )
}
