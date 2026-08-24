# Demo Assets Control

Aplicacion web para administrar inventario de equipos demo, prestamos,
devoluciones, solicitudes publicas y trazabilidad operativa.

## Que incluye

- Inicio de sesion con Supabase.
- Dashboard con resumen de inventario, prestamos vencidos, proximas devoluciones
  y solicitudes pendientes.
- Inventario de equipos con busqueda, filtros, carga manual e importacion desde
  Excel.
- Prestamos de equipos con detalle, edicion, devolucion y generacion de PDF.
- Formulario publico para solicitar equipos.
- Historial de movimientos.

## Tecnologia

- React + TypeScript
- Vite
- Tailwind CSS
- Supabase
- jsPDF
- SheetJS para importacion de Excel
- ZXing para escaneo de codigos

## Requisitos

- Node.js 24 o superior recomendado.
- Un proyecto de Supabase configurado.
- Variables de entorno locales.

> Nota: con Node 22 la instalacion funciona, pero una dependencia de escaneo
> declara compatibilidad con Node 24 o superior.

## Configuracion inicial

1. Copiar el archivo de ejemplo:

```bash
cp .env.example .env.local
```

2. Completar `.env.local` con los datos de Supabase:

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_clave_publica
```

3. Instalar dependencias:

```bash
npm ci
```

4. Ejecutar la app en modo desarrollo:

```bash
npm run dev
```

5. Abrir la URL que muestra la terminal, normalmente:

```text
http://localhost:5173
```

## Comandos utiles

```bash
npm run dev      # abrir la app localmente
npm run build    # validar TypeScript y generar version de produccion
npm run lint     # revisar calidad basica del codigo
npm run preview  # previsualizar el build de produccion
```

## Despliegue

El proyecto incluye `vercel.json` para funcionar como una single-page app en
Vercel. En Vercel tambien hay que cargar las mismas variables de entorno:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Estado actual revisado

- El build de produccion compila correctamente.
- El lint queda preparado para validar cambios antes de publicar.
- El README original de Vite fue reemplazado por una guia especifica del
  proyecto.
