# GymWeb: plan detallado (peso, carrera, nutrición, fuerza)


## 1. Contexto
App web personal para registrar peso/pasos, carreras, nutrición (solo totales diarios) y entrenos de Lyfta (pegando texto, parser regex), con estadística correcta de progresión. La BD debe ser gratuita y **no apagarse por no usarla**. `GymWeb/` solo contiene plantillas ajenas (`gymlife-v1.0.0`, `workout-master`, `zacson-v1.0.0`); el código nuevo irá en `GymWeb/app/`.

## 2. Decisión de base de datos
| Opción | ¿Se apaga? | Veredicto |
|---|---|---|
| Turso (free) | Escala a 0 tras 1 h (~500 ms) y **archiva a los 10 días sin uso; hay que desarchivar a mano** (CLI/API) | Descartada |
| Supabase (free) | Pausa el proyecto tras ~7 días de poca actividad (restaurable 90 días) | Descartada (o cron keep-alive) |
| Google Sheets | Nunca se apaga, pero sin consultas/transacciones, cuotas de API, lento | Solo export/backup |
| Cloudflare D1 | No pausa; 5M lecturas y 100k escrituras/día, 500 MB/DB | Alternativa válida |
| **Neon Postgres (free)** | Escala a 0 a los 5 min y **despierta sola** en la siguiente petición (~1 s); sin archivado | **Elegida** |

Neon: SQL real (ventanas, agregados, JSONB), 0,5 GB por proyecto (años de datos), sin mantenimiento. Para no atarse al proveedor: toda la persistencia tras interfaces (`repositories/`) con Drizzle; migrar a D1/Turso = reescribir solo esa capa.
Backup: GitHub Action mensual con `pg_dump` + export CSV desde la app.

## 3. Stack
- Next.js (App Router) + TypeScript, full-stack, desplegado en Vercel (free, sin servidor que dormir).
- Zod (esquemas = fuente de verdad de los tipos), Drizzle ORM, `@neondatabase/serverless`.
- Tailwind + shadcn/ui; Recharts (o visx) para gráficas; `simple-statistics` solo si hace falta (el resto se implementa a mano y se testea).
- Vitest para parser y estadística. Auth.js con credenciales de un único usuario (escritura protegida).
- Alternativa Python (FastAPI + Pydantic + scipy en Render): descartada por añadir un segundo despliegue.

## 4. Estructura de carpetas
```
GymWeb/app/
  src/
    domain/                      # puro, sin I/O
      schemas/ body.ts run.ts nutrition.ts workout.ts
      stats/   ewma.ts regression.ts theilSen.ts e1rm.ts volume.ts pace.ts prs.ts weeks.ts
      lyfta/   parseLyfta.ts months.es.ts
    repositories/                # interfaces + impl Drizzle (única capa con BD)
      bodyRepo.ts runRepo.ts nutritionRepo.ts workoutRepo.ts exerciseAliasRepo.ts
    services/  dashboardService.ts workoutService.ts progressService.ts nutritionService.ts
    app/
      api/ dashboard/ body/ runs/ nutrition/ workouts/ workouts/preview/ progress/[exercise]/
      (dashboard)/ page.tsx
      entrenos/ carrera/ nutricion/ importar/
    components/ kpi-card, trend-chart, set-row, exercise-card, pr-table, progress-bar, nav-sidebar, nav-bottom
  drizzle/ migraciones
  tests/ parser.test.ts e1rm.test.ts ewma.test.ts theilSen.test.ts pace.test.ts arch.test.ts
```

## 5. Modelo de datos (tablas independientes; nutrición sin FK ni join con peso)
```sql
body_log(date date PK, weight_kg numeric(5,2) NULL, steps int NULL, updated_at timestamptz);
runs(id uuid PK, date date, distance_km numeric(6,2) CHECK >0, duration_s int CHECK >0,
     elevation_gain_m int DEFAULT 0, surface text CHECK in ('treadmill','outdoor'), notes text);
nutrition_log(date date PK, kcal int, protein_g numeric(5,1), carbs_g numeric(5,1), fiber_g numeric(5,1));
workouts(id uuid PK, date timestamptz, routine_name text, duration_min int,
         total_volume_kg numeric(8,1), raw_text text, parse_warnings jsonb, UNIQUE(date, routine_name));
workout_exercises(id uuid PK, workout_id FK ON DELETE CASCADE, position int, name text,
                  canonical_name text, notes text NULL,
                  sets jsonb);  -- [{weight_kg, reps, is_warmup}]
exercise_alias(raw_name text PK, canonical_name text, muscle_group text NULL);
```
Zod espejo (resumen):
```ts
const SetSchema = z.object({ weight_kg: z.number().nonnegative(), reps: z.number().int().positive(), is_warmup: z.boolean() });
const ExerciseSchema = z.object({ name: z.string(), notes: z.string().nullable(), sets: z.array(SetSchema) });
const WorkoutSchema = z.object({ id: z.string().uuid().optional(), date: z.date(), routine_name: z.string(),
  duration_min: z.number().int(), total_volume_kg: z.number(), raw_text: z.string(), exercises: z.array(ExerciseSchema) });
const RunSchema = z.object({ date, distance_km, duration_s, elevation_gain_m, surface: z.enum(['treadmill','outdoor']) });
const BodySchema = z.object({ date, weight_kg: z.number().optional(), steps: z.number().int().optional() });
const NutritionSchema = z.object({ date, kcal, protein_g, carbs_g, fiber_g });
```
Reglas: el ritmo (min/km) es derivado = `duration_s/60/distance_km`, nunca se almacena. JSONB en `sets` para que cambiar de rutina no rompa el esquema; `exercise_alias` unifica nombres entre rutinas.

## 6. Parser Lyfta (`domain/lyfta/parseLyfta.ts`)
Firma: `parseLyfta(text: string): { workout: Workout; warnings: string[] }`. Pura y testeable. Pasos:
1. Normalizar: `\r\n→\n`, trim, colapsar líneas vacías.
2. Línea 1 = `routine_name`.
3. Línea 2 = fecha: `/^[\p{L}]+,\s*(\d{1,2}) de (\p{L}+) de (\d{4}),\s*(\d{1,2}):(\d{2})$/u`, mes por mapa `enero..diciembre → 0..11`.
4. Cabecera de resumen: `/^(?:(\d+)h\s*)?(?:(\d+)m)?\s*\|\s*([\d\s.,]+?)\s*kg\s*\|\s*(\d+)\s+Ejercicios\s*\|\s*(\d+)\s+series$/i`. Número: quitar espacios de miles (`"6 893.5"`→6893.5); si hay coma decimal convertirla. Duración → minutos.
5. Serie: `/^Serie\s+(\d+):\s*([\d.,]+)\s*kg\s*x\s*(\d+)\s*reps?(?:\s*\((Calentamiento)\))?\s*$/i` → `is_warmup = !!grupo4`.
6. Máquina de estados línea a línea tras la cabecera:
   - línea que no es serie y va seguida (tras 0..n líneas de notas) de una serie → nuevo ejercicio; la primera es el nombre, las siguientes antes de la primera serie son `notes` (se concatenan con `\n`).
   - serie → se añade al ejercicio actual; serie fuera de ejercicio → warning.
7. Checksums (warnings, no excepciones): nº ejercicios y series == cabecera; Σ(peso×reps) vs `total_volume_kg` probando con y sin calentamientos (se registra qué regla cuadra; con el ejemplo se fija la regla definitiva).
8. Se devuelve siempre `raw_text`. Endpoint `POST /api/workouts/preview` (parsea sin guardar) y `POST /api/workouts` (guarda; duplicado por `(date, routine_name)` → 409 con opción de reemplazar).
9. Tests: el ejemplo exacto (Lever Military Press, Barbell Curl con nota "barra corta, sin contar peso barra"), sin notas, decimales con coma, ejercicio sin series, cabecera sin horas, texto basura.

## 7. Estadística correcta de progresión (`domain/stats/`)
Todo son funciones puras con tests numéricos (valores a mano y contra scipy).

**7.1 e1RM**
- Series elegibles: `!is_warmup`, `1 ≤ reps ≤ 10`. (>10 reps: no fiable, se excluye del e1RM pero cuenta en volumen.)
- Epley `w·(1+r/30)`; Brzycki `w·36/(37−r)`. e1RM de la serie = media de ambas; r=1 → peso real.
- **Una observación por sesión y ejercicio = máximo e1RM de sus series elegibles** (no la media: mezclaría series de fatiga).
- Redondeo solo en presentación.

**7.2 Tendencia de fuerza por ejercicio**
- Curva: EWMA del e1RM por sesión (α≈0,3), indexada por fecha real (si hay huecos largos, el peso de la observación crece con el intervalo: `α_eff = 1−(1−α)^(Δdías/7)`).
- Pendiente (kg/semana) sobre las últimas 8-12 semanas con ≥4 sesiones: **Theil-Sen** (mediana de pendientes por pares) con IC 95 % por bootstrap (2000 remuestreos), y OLS con IC t de Student como contraste. Etiqueta: "mejora"/"empeora" solo si el IC excluye 0; si no, "sin cambio claro".
- Smallest worthwhile change: error típico = SD de las diferencias entre sesiones consecutivas tras quitar la tendencia; un salto es "real" si > 1,5× ese valor.
- PRs por rango de reps (1, 3, 5, 8, 10 RM reales) y PR de e1RM; se marca PR solo si supera estrictamente el máximo histórico anterior.
- Mínimo de datos: <3 sesiones → solo se muestran puntos, sin tendencia.

**7.3 Volumen y carga**
- Tonnage = Σ peso×reps de series de trabajo; **series efectivas por grupo muscular y semana** (semana ISO lunes-domingo; la semana en curso se marca "parcial" y no se compara con completas).
- Intensidad relativa: %e1RM de cada serie. Sin RPE en Lyfta: no se infiere cercanía al fallo.
- Ratio carga aguda:crónica (7 d / 28 d) solo orientativo y rotulado como no validado.

**7.4 Peso corporal**
- Serie cruda en puntos tenues; **EWMA tipo Hacker's Diet** (α≈0,1) con ajuste por huecos (como en 7.2); media móvil 7 d con mínimo 4 observaciones de 7.
- Tendencia = pendiente OLS de los últimos 14-28 días en kg/semana con IC 95 %; icono ↑/↓/→ solo si el IC excluye 0 y |pendiente| > 0,1 kg/sem.
- "Peso actual" = hoy; si no hay, ayer; se muestra la fecha del dato. Nunca se rellenan días sin pesaje con ceros.

**7.5 Carrera y pasos**
- Ritmo agregado = Σtiempo / Σdistancia (ponderado), **nunca media aritmética de ritmos**. Desnivel = suma. Cinta y exterior se analizan por separado (no comparables). Mejora de ritmo solo entre rodajes comparables (misma superficie, distancia ±20 %).
- Pasos: media 7 d y percentiles; los días sin dato no cuentan como 0.

**7.6 Cruces (fase final, vista aparte)**: e1RM relativo = e1RM / peso EWMA. Cualquier cruce con nutrición solo en su propia vista, nunca en el Dashboard.

## 8. Servicios y API
- `GET /api/dashboard?range=90d` → `dashboardService`: usa **solo** `bodyRepo` y `runRepo` (peso actual, EWMA, media 7 d, pendiente+IC, pasos hoy y media 7 d, resumen carreras de la semana). Test de arquitectura (`arch.test.ts`) que falla si importa `nutritionRepo`.
- `POST/PUT /api/body`, `/api/runs`, `/api/nutrition` (validación Zod en el borde).
- `POST /api/workouts/preview`, `POST /api/workouts`, `GET /api/workouts?from&to`.
- `GET /api/progress/[exercise]` → serie de e1RM por sesión, EWMA, pendiente Theil-Sen+IC, PRs.
- `GET /api/export.csv?table=` para backup manual.

## 9. Diseño (análisis de las plantillas del proyecto)
| Plantilla | Paleta | Tipografía | Aprovechable |
|---|---|---|---|
| gymlife | Negros `#0a0a0a/#151515/#252525`, texto `#c4c4c4`, acento naranja `#f36100` | Oswald + Muli | Tema oscuro, hero + tarjetas, barras de progreso, calculadora IMC |
| zacson | Azul `#1f2b7b`, rojo `#ff0000`, cian `#4cd3e3`, amarillo `#f4e700` | Oswald + Roboto Condensed | Titulares grandes, bloques de categorías sobre negro |
| workout-master | Blanco/negro, magenta `#c83660`, naranja `#f89d13` | Muli | Layout claro, cabecera sticky, aire |

Son plantillas de marketing (jQuery + Bootstrap 4, carruseles). **Decisión del usuario: el copyright de Colorlib no es un impedimento porque el uso es personal (no se redistribuye ni se revende), así que SÍ se pueden reutilizar su HTML/CSS/imágenes/iconos.** Criterio técnico: se reutilizan assets (imágenes, fuentes Flaticon, estilos de tarjetas/hero/barras) y se reimplementa la estructura en Tailwind/React en vez de copiar jQuery/Bootstrap 4 (sliders y carruseles no aportan al dashboard). Nota: el readme de las plantillas pide no quitar el crédito; si la app se publica en una URL abierta, conservar el crédito en el footer.

Sistema elegido (base gymlife):
- Oscuro por defecto (+ claro opcional): fondo `#0a0a0a`, superficies `#151515/#252525`, bordes `#363636`, texto `#c4c4c4`, cifras en blanco.
- Acento `#f36100` (CTA, EWMA, PRs). Semánticos: verde mejora, rojo `#f44336` empeora, gris sin cambio claro; siempre con icono ↑↓→ y texto, no solo color.
- Oswald (títulos y números grandes, mayúsculas con tracking) + Inter/Muli (texto/tablas, `tabular-nums`).
- Componentes: KPI (peso actual, tendencia kg/sem con IC, pasos, última carrera), gráficas con serie cruda tenue + EWMA naranja, barras de progreso para objetivos semanales, tabla de PRs, tarjeta de ejercicio con series (calentamiento atenuado).
- Layout: sidebar fija en escritorio, bottom-nav en móvil. Secciones: Dashboard, Entrenos, Carrera, Nutrición (separada), Importar Lyfta.
- "Importar Lyfta": textarea grande → "Analizar" → vista previa en tarjetas con avisos de checksum → "Guardar".
- Accesibilidad: contraste AA, foco visible, objetivos táctiles ≥44 px. Al implementar se usan las skills `frontend-ui` y `dataviz`.

## 10. Fases y checklist
1. [ ] Setup: Next.js, Neon, Drizzle, migraciones, auth, CI (tests + backup `pg_dump`).
2. [ ] Dominio: schemas Zod, repositorios, parser + tests con tu ejemplo.
3. [ ] Entrada: formularios peso/pasos, carrera, nutrición; pegado Lyfta con vista previa.
4. [ ] Dashboard (sin nutrición): peso actual, EWMA/tendencia, pasos, carreras.
5. [ ] Fuerza: e1RM, Theil-Sen, PRs, volumen semanal, alias de ejercicios.
6. [ ] Nutrición: vista independiente con medias semanales.
7. [ ] Pulido: export CSV, backup, despliegue Vercel, modo claro.

## 11. Riesgos / puntos abiertos
- Regla exacta del volumen de Lyfta (¿incluye calentamientos?): se resuelve con el checksum del primer export real.
- Cold start de Neon (~1 s tras inactividad): aceptable; se muestra skeleton.
- Nombres de ejercicio cambiantes: se gestiona con `exercise_alias` editable.
- Límites de Neon free (0,5 GB, 100 h compute/mes): holgados para uso personal.

## 12. Verificación
- `vitest`: parser (ejemplo exacto + checksums), e1RM, EWMA, Theil-Sen, ritmo ponderado, test de arquitectura.
- Manual: pegar un export real de Lyfta; revisar vista previa y guardado; dejar la app 10+ días sin usar y comprobar que la BD responde sin intervención.
- Comparar tendencias y e1RM con una hoja de cálculo con tus datos.

## 13. Fuentes
- [Turso scale to zero](https://docs.turso.tech/features/scale-to-zero), [unarchive](https://docs.turso.tech/cli/group/unarchive)
- [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Neon scale to zero](https://neon.com/docs/introduction/scale-to-zero), [límites free](https://neon.com/faqs/free-plan-limits-and-quotas)
- [Cloudflare D1 límites](https://developers.cloudflare.com/d1/platform/limits/)

## 14. Resumen de decisiones (para PLAN.json)
`db: Neon Postgres` · `framework: Next.js+TS` · `orm: Drizzle` · `validation: Zod` · `ui: Tailwind+shadcn+Recharts` · `theme: dark, accent #f36100, Oswald+Inter` · `hosting: Vercel` · `strength: e1RM best-set/session, EWMA + Theil-Sen` · `weight: EWMA α0.1 + OLS slope CI` · `pace: weighted Σt/Σd`
