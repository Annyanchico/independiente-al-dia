// Almacén de sesiones en memoria con expiración.
// Para producción con varias instancias, reemplazar por Redis o una base de datos
// manteniendo la misma interfaz (obtener / guardar).

export function crearAlmacenSesiones({ minutosExpiracion = 30 } = {}) {
  const sesiones = new Map();
  const ttl = minutosExpiracion * 60 * 1000;

  return {
    async obtener(usuario) {
      const s = sesiones.get(usuario);
      if (!s) return null;
      if (Date.now() - s.actualizada > ttl) {
        sesiones.delete(usuario);
        return null;
      }
      return s.valor;
    },
    async guardar(usuario, valor) {
      sesiones.set(usuario, { valor, actualizada: Date.now() });
    },
  };
}

// Evita procesar dos veces el mismo mensaje (Meta reintenta si no respondemos a tiempo).
export function crearDeduplicador({ maximo = 5000 } = {}) {
  const vistos = new Set();
  return (id) => {
    if (vistos.has(id)) return true;
    vistos.add(id);
    if (vistos.size > maximo) vistos.delete(vistos.values().next().value);
    return false;
  };
}
