-- =====================================================================
--  FISIO-LI · Datos semilla
--  Carga el catálogo real tomado de la documentación de la clienta.
--  Es idempotente: puede ejecutarse varias veces sin duplicar nada.
-- =====================================================================

SET client_min_messages = warning;

-- ---------------------------------------------------------------------
-- Parámetros de negocio. Lina los ajusta desde la interfaz
-- administrativa sin que nadie ejecute una migración.
-- ---------------------------------------------------------------------

INSERT INTO catalogo.parametro (clave, valor, descripcion) VALUES
  ('horas_minimas_cancelacion',      '24',     'Horas de anticipación mínimas para cancelar sin perder el pago. La política habla de 24 a 48 horas; se toma el extremo favorable al paciente.'),
  ('horas_recomendadas_cancelacion', '48',     'Anticipación que se comunica al paciente al confirmar la cita.'),
  ('minutos_retencion_reserva',      '30',     'Tiempo que se sostiene el cupo mientras el paciente completa el pago anticipado.'),
  ('referidos_para_descuento',       '5',      'Referidos que deben agendar y asistir para activar el descuento.'),
  ('porcentaje_descuento_referidos', '10',     'Porcentaje de descuento del programa de referidos.'),
  ('abono_minimo_convenio',          '400000', 'Abono inicial mínimo para convenios con clubes y equipos.'),
  ('minutos_anticipacion_llegada',   '10',     'Minutos que se pide al paciente llegar antes de su sesión.'),
  ('horas_recordatorio_previo',      '24',     'Anticipación del recordatorio automático de la cita.')
ON CONFLICT (clave) DO NOTHING;

-- ---------------------------------------------------------------------
-- Profesional y sedes
-- ---------------------------------------------------------------------

INSERT INTO personas.profesional (nombres, apellidos, nombre_publico, telefono)
SELECT 'Lina', 'Murillo', 'La Fisioterapeuta Li', '3113981422'
WHERE NOT EXISTS (SELECT 1 FROM personas.profesional);

INSERT INTO catalogo.sede (codigo, nombre, ciudad) VALUES
  ('TUNJA',    'Sede Tunja',    'Tunja'),
  ('TURMEQUE', 'Sede Turmequé', 'Turmequé')
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------------
-- Horario de atención.
-- 7:00 a 20:00 con almuerzo de 12:00 a 14:00, lo que se representa como
-- dos franjas por día. Tunja atiende de lunes a viernes; Turmequé,
-- sábados y domingos. La regla queda en los datos, no en el código.
-- Convención de PostgreSQL: 0 = domingo, 6 = sábado.
-- ---------------------------------------------------------------------

INSERT INTO agenda.horario_atencion (profesional_id, sede_id, dia_semana, hora_inicio, hora_fin)
SELECT p.id, s.id, d.dia, f.inicio, f.fin
FROM personas.profesional p
CROSS JOIN LATERAL (SELECT id, codigo FROM catalogo.sede) s
CROSS JOIN LATERAL (VALUES (0),(1),(2),(3),(4),(5),(6)) AS d(dia)
CROSS JOIN LATERAL (VALUES ('07:00'::time,'12:00'::time), ('14:00'::time,'20:00'::time)) AS f(inicio, fin)
WHERE (   (s.codigo = 'TUNJA'    AND d.dia BETWEEN 1 AND 5)
       OR (s.codigo = 'TURMEQUE' AND d.dia IN (0, 6)))
  AND NOT EXISTS (SELECT 1 FROM agenda.horario_atencion);

-- ---------------------------------------------------------------------
-- Catálogos de la ficha del paciente
-- ---------------------------------------------------------------------

INSERT INTO catalogo.tipo_documento (codigo, nombre) VALUES
  ('CC','Cédula de ciudadanía'), ('TI','Tarjeta de identidad'),
  ('CE','Cédula de extranjería'), ('PA','Pasaporte'),
  ('PPT','Permiso por protección temporal')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO catalogo.eps (nombre, orden) VALUES
  ('Sura',1), ('Sanitas',2), ('Compensar',3), ('Nueva EPS',4), ('Salud Total',5),
  ('Capital Salud',6), ('Famisanar',7), ('Coosalud',8), ('SOS',9),
  ('PME (Fuerzas Militares/Policía)',10), ('Particular / Ninguna',11)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO catalogo.ciudad (nombre, orden) VALUES
  ('Tunja',1), ('Turmequé',2), ('Bogotá',3), ('Duitama',4),
  ('Sogamoso',5), ('Ventaquemada',6), ('Samacá',7)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO catalogo.ocupacion (nombre, orden) VALUES
  ('Sedentaria / Oficina',1), ('Deportista de alto rendimiento',2),
  ('Amateur / Recreativo',3), ('Trabajo físico pesado',4),
  ('Estudiante',5), ('Hogar',6)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO catalogo.motivo_consulta (nombre, orden) VALUES
  ('Dolor agudo / crónico',1), ('Recuperación postquirúrgica',2),
  ('Lesión deportiva / Sobrecarga muscular',3),
  ('Mantenimiento / Descarga postentrenamiento',4),
  ('Problema postural / Ergonomía',5),
  ('Disfunción articular (ATM, rodilla, hombro)',6),
  ('Condición neurológica',7)
ON CONFLICT (nombre) DO NOTHING;

-- Las banderas rojas condicionan punción seca, terapia neural y PRP.
-- El sistema alerta; la decisión clínica sigue siendo de la profesional.
INSERT INTO catalogo.antecedente (codigo, nombre, es_bandera_roja, orden) VALUES
  ('HTA',           'Hipertensión arterial',                          false, 1),
  ('DM',            'Diabetes mellitus',                              false, 2),
  ('CIRUGIA',       'Cirugías previas',                               false, 3),
  ('FRACTURA',      'Fracturas / Traumatismos previos',               false, 4),
  ('ALERGIA',       'Alergias (medicamentos, látex)',                 true,  5),
  ('COAGULACION',   'Trastornos de coagulación / Anticoagulantes',    true,  6),
  ('IMPLANTE',      'Implantes / Marcapasos / Placas metálicas',      true,  7),
  ('EMBARAZO',      'Embarazo',                                       true,  8)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO catalogo.tipo_dolor (codigo, nombre) VALUES
  ('PUNZANTE','Punzante'), ('OPRESIVO','Opresivo'), ('QUEMANTE','Quemante / Ardor'),
  ('SORDO','Sordo / Profundo'), ('PULSATIL','Pulsátil'), ('IRRADIADO','Irradiado'),
  ('NEUROPATICO','Neuropático'), ('LOCALIZADO','Localizado')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO catalogo.medio_pago (codigo, nombre, requiere_referencia) VALUES
  ('NEQUI',    'Nequi / Llave', true),
  ('EFECTIVO', 'Efectivo',      false)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO catalogo.zona_anatomica (codigo, nombre) VALUES
  ('ESPALDA_ALTA','Espalda alta'), ('ESPALDA_BAJA','Espalda baja'),
  ('MUSLOS','Muslos'), ('PIERNAS','Piernas'), ('PIES','Pies'),
  ('GLUTEOS','Glúteos'), ('MIEMBROS_SUPERIORES','Miembros superiores'),
  ('CUELLO','Cuello'), ('PECHO','Pecho'), ('ATM','Articulación temporomandibular')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO catalogo.tecnica (codigo, nombre) VALUES
  ('MANUAL','Terapia manual'), ('INSTRUMENTAL','Terapia instrumental'),
  ('VENTOSAS','Ventosas (cupping)'), ('PERCUTORA','Pistola percutora'),
  ('PRESOTERAPIA','Presoterapia'), ('TERMOTERAPIA','Termoterapia con manta térmica')
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------------
-- Portafolio de servicios
-- ---------------------------------------------------------------------

INSERT INTO catalogo.categoria_servicio (codigo, nombre, orden) VALUES
  ('REHABILITACION', 'Valoración y rehabilitación física', 1),
  ('EJERCICIO',      'Prescripción de ejercicio',          2),
  ('MODULACION',     'Modulación postejercicio / Descargas musculares', 3),
  ('ESPECIALIZADO',  'Procedimientos especializados',      4)
ON CONFLICT (codigo) DO NOTHING;

-- Los buffers son valores iniciales de trabajo. Deben confirmarse con
-- la clienta: no toma el mismo tiempo recoger después de una descarga
-- de espalda que después de una sueroterapia.
INSERT INTO catalogo.servicio
  (categoria_id, codigo, nombre, duracion_min_minutos, duracion_max_minutos,
   buffer_posterior_minutos, permite_grupal, requiere_valoracion_previa,
   requiere_consentimiento_informado, indicaciones_previas)
SELECT c.id, v.codigo, v.nombre, v.dmin, v.dmax, v.buf, v.grupal, v.valoracion, v.consent, v.indic
FROM (VALUES
  ('REHABILITACION','VALORACION','Valoración inicial',                  60, 60,15,false,false,false,
   'Usar ropa cómoda o deportiva y calzado adecuado. Llegar 5 a 10 minutos antes.'),
  ('REHABILITACION','REHAB',     'Sesión de rehabilitación / terapia física', 60, 60,15,false,true,false,
   'Ropa cómoda o deportiva, calzado adecuado, toalla personal opcional e hidratación. Llegar 5 a 10 minutos antes.'),
  ('EJERCICIO',     'EJERCICIO_IND','Prescripción de ejercicio individual',   60, 60,15,false,true,false,
   'Ropa deportiva, calzado adecuado, toalla personal opcional e hidratación. Llegar 5 a 10 minutos antes.'),
  ('EJERCICIO',     'EJERCICIO_GRP','Prescripción de ejercicio grupal',       60, 60,20,true, true,false,
   'Ropa deportiva, calzado adecuado, toalla personal opcional e hidratación. Llegar 5 a 10 minutos antes.'),
  ('MODULACION',    'DESC_ESPALDA','Descarga muscular · Espalda',            60, 60,15,false,false,false,
   'Ropa cómoda que facilite el acceso a la zona a tratar. Toalla personal opcional e hidratación.'),
  ('MODULACION',    'DESC_MMII',   'Descarga muscular · Miembros inferiores', 60, 60,15,false,false,false,
   'Ropa cómoda que facilite el acceso a la zona a tratar. Toalla personal opcional e hidratación.'),
  ('MODULACION',    'DESC_TOTAL',  'Descarga muscular · Cuerpo completo',    60, 60,20,false,false,true,
   'Ropa cómoda que facilite el acceso a las distintas zonas del cuerpo. Toalla personal opcional e hidratación.'),
  ('ESPECIALIZADO', 'PUNCION',     'Punción seca',                           60, 60,20,false,false,true,
   'Ropa holgada que permita el acceso a la zona a tratar. Puntualidad estricta.'),
  ('ESPECIALIZADO', 'NEURAL',      'Terapia neural',                         60,120,20,false,false,true,
   'Ropa holgada que permita el acceso a la zona a tratar. Puntualidad estricta.'),
  ('ESPECIALIZADO', 'PRP',         'Plasma rico en plaquetas (PRP)',         60,120,30,false,false,true,
   'Ropa holgada que permita el acceso a la zona a tratar. Puntualidad estricta.'),
  ('ESPECIALIZADO', 'SUEROTERAPIA','Sueroterapia',                           90, 90,30,false,false,true,
   'Ropa holgada que permita el acceso venoso. Puntualidad estricta.')
) AS v(cat, codigo, nombre, dmin, dmax, buf, grupal, valoracion, consent, indic)
JOIN catalogo.categoria_servicio c ON c.codigo = v.cat
ON CONFLICT (codigo) DO NOTHING;

-- Cobertura anatómica y técnicas de las descargas musculares.
INSERT INTO catalogo.servicio_zona (servicio_id, zona_id, condicionada, nota)
SELECT s.id, z.id, v.cond, v.nota
FROM (VALUES
  ('DESC_ESPALDA','ESPALDA_ALTA',false,NULL),
  ('DESC_ESPALDA','ESPALDA_BAJA',false,NULL),
  ('DESC_MMII','MUSLOS',false,NULL), ('DESC_MMII','PIERNAS',false,NULL), ('DESC_MMII','PIES',false,NULL),
  ('DESC_TOTAL','MUSLOS',false,NULL), ('DESC_TOTAL','PIERNAS',false,NULL), ('DESC_TOTAL','PIES',false,NULL),
  ('DESC_TOTAL','GLUTEOS',true,'Se incluye siempre que no haya molestia o incomodidad del paciente.'),
  ('DESC_TOTAL','ESPALDA_ALTA',false,NULL), ('DESC_TOTAL','ESPALDA_BAJA',false,NULL),
  ('DESC_TOTAL','MIEMBROS_SUPERIORES',false,NULL), ('DESC_TOTAL','CUELLO',false,NULL),
  ('DESC_TOTAL','PECHO',false,NULL)
) AS v(serv, zona, cond, nota)
JOIN catalogo.servicio s        ON s.codigo = v.serv
JOIN catalogo.zona_anatomica z  ON z.codigo = v.zona
ON CONFLICT DO NOTHING;

INSERT INTO catalogo.servicio_tecnica (servicio_id, tecnica_id)
SELECT s.id, t.id
FROM (VALUES
  ('DESC_ESPALDA','MANUAL'),('DESC_ESPALDA','INSTRUMENTAL'),('DESC_ESPALDA','VENTOSAS'),('DESC_ESPALDA','PERCUTORA'),
  ('DESC_MMII','PRESOTERAPIA'),('DESC_MMII','MANUAL'),('DESC_MMII','INSTRUMENTAL'),('DESC_MMII','PERCUTORA'),
  ('DESC_TOTAL','PRESOTERAPIA'),('DESC_TOTAL','MANUAL'),('DESC_TOTAL','INSTRUMENTAL'),
  ('DESC_TOTAL','TERMOTERAPIA'),('DESC_TOTAL','VENTOSAS'),('DESC_TOTAL','PERCUTORA')
) AS v(serv, tec)
JOIN catalogo.servicio s ON s.codigo = v.serv
JOIN catalogo.tecnica  t ON t.codigo = v.tec
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- Tarifas vigentes.
-- El valor por sesión no se carga: es una división que hace la vista.
-- ---------------------------------------------------------------------

INSERT INTO catalogo.tarifa (servicio_id, nombre, sesiones_incluidas, cupo_personas, valor_total)
SELECT s.id, v.nombre, v.sesiones, v.cupo, v.valor
FROM (VALUES
  ('VALORACION',   'Valoración inicial',            1,  1,  100000),
  ('REHAB',        'Sesión individual',             1,  1,  100000),
  ('REHAB',        'Paquete de 5 sesiones',         5,  1,  460000),
  ('REHAB',        'Paquete de 10 sesiones',       10,  1,  850000),
  ('EJERCICIO_IND','Sesión individual',             1,  1,   60000),
  ('EJERCICIO_IND','Paquete de 8 sesiones',         8,  1,  400000),
  ('EJERCICIO_IND','Paquete de 12 sesiones',       12,  1,  580000),
  ('EJERCICIO_IND','Paquete de 16 sesiones',       16,  1,  720000),
  ('EJERCICIO_IND','Paquete de 20 sesiones',       20,  1,  800000),
  ('EJERCICIO_GRP','Grupal 4 personas · 4 sesiones',  4, 4,  150000),
  ('EJERCICIO_GRP','Grupal 8 personas · 8 sesiones',  8, 8,  227000),
  ('EJERCICIO_GRP','Grupal 8 personas · 12 sesiones',12, 8,  312000),
  ('EJERCICIO_GRP','Grupal 8 personas · 16 sesiones',16, 8,  384000),
  ('EJERCICIO_GRP','Grupal 8 personas · 20 sesiones',20, 8,  440000),
  ('DESC_ESPALDA', 'Sesión individual',             1,  1,   70000),
  ('DESC_MMII',    'Sesión individual',             1,  1,   90000),
  ('DESC_TOTAL',   'Sesión individual',             1,  1,  150000),
  ('PUNCION',      'Sesión individual',             1,  1,  120000),
  ('PUNCION',      'Paquete de 5 sesiones',         5,  1,  525000),
  ('PUNCION',      'Paquete de 10 sesiones',       10,  1,  950000),
  ('NEURAL',       'Sesión individual',             1,  1,  150000),
  ('NEURAL',       'Paquete de 5 sesiones',         5,  1,  525000),
  ('NEURAL',       'Paquete de 10 sesiones',       10,  1,  950000),
  ('PRP',          'Sesión individual',             1,  1,  250000),
  ('PRP',          'Paquete de 5 sesiones',         5,  1, 1000000),
  ('PRP',          'Paquete de 10 sesiones',       10,  1, 1600000),
  ('SUEROTERAPIA', 'Sesión individual',             1,  1,  300000),
  ('SUEROTERAPIA', 'Paquete de 5 sesiones',         5,  1, 1025000),
  ('SUEROTERAPIA', 'Paquete de 10 sesiones',       10,  1, 1900000)
) AS v(serv, nombre, sesiones, cupo, valor)
JOIN catalogo.servicio s ON s.codigo = v.serv
WHERE NOT EXISTS (
    SELECT 1 FROM catalogo.tarifa t
     WHERE t.servicio_id = s.id
       AND t.sesiones_incluidas = v.sesiones
       AND t.cupo_personas = v.cupo
);
