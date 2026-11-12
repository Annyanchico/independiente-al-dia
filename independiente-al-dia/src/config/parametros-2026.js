// Parámetros normativos de seguridad social para 2026.
// Cada año (o cada vez que cambie la norma) se actualiza SOLO este archivo.
// Revisar con el equipo contable antes de publicar cambios.

export const PARAMETROS_2026 = {
  anio: 2026,

  // Salario mínimo mensual legal vigente 2026
  smmlv: 1_750_905,

  // IBC de independientes = 40% del ingreso (neto para cuenta propia,
  // valor mensualizado sin IVA para prestación de servicios)
  porcentajeIBC: 0.40,

  // Límites del IBC en número de salarios mínimos
  ibcMinimoSMMLV: 1,
  ibcMaximoSMMLV: 25,

  tarifas: {
    salud: 0.125,   // 12,5% a cargo del independiente
    pension: 0.16,  // 16% a cargo del independiente
  },

  // Fondo de Solidaridad Pensional (adicional a pensión) según IBC en SMMLV.
  // Tabla de la Ley 797 de 2003. VERIFICAR vigencia frente a la reforma
  // pensional (Ley 2381 de 2024) antes de producción.
  fondoSolidaridad: [
    { desdeSMMLV: 4, hastaSMMLV: 16, tarifa: 0.010 },
    { desdeSMMLV: 16, hastaSMMLV: 17, tarifa: 0.012 },
    { desdeSMMLV: 17, hastaSMMLV: 18, tarifa: 0.014 },
    { desdeSMMLV: 18, hastaSMMLV: 19, tarifa: 0.016 },
    { desdeSMMLV: 19, hastaSMMLV: 20, tarifa: 0.018 },
    { desdeSMMLV: 20, hastaSMMLV: Infinity, tarifa: 0.020 },
  ],

  // Riesgos laborales (ARL) por clase de riesgo. Clases IV y V las paga el contratante.
  arl: {
    I: 0.00522,
    II: 0.01044,
    III: 0.02436,
    IV: 0.0435,
    V: 0.0696,
  },
  arlPagadaPorContratante: ['IV', 'V'],

  // Caja de compensación: voluntaria para independientes
  caja: {
    completa: 0.02,  // todos los servicios
    parcial: 0.006,  // solo recreación y capacitación
  },
};
