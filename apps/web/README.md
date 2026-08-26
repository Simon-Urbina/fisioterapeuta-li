# apps/web/

Responsable: Samuel

Sitio público de reservas y panel administrativo, en React 19 + Vite +
Tailwind CSS v4. Desde aquí el cliente consulta disponibilidad y reserva
directo contra la API núcleo, sin pasar por n8n, porque la reserva necesita
validarse y bloquearse en una sola transacción. El panel es la vista interna
para el administrador.
