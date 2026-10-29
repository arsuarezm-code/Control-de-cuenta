# Panel de patrimonio

Panel personal para controlar cuentas, fondos y plan de pensiones, en euros.
Tus saldos y participaciones se guardan solo en el navegador de cada dispositivo (no en GitHub).
Un workflow de GitHub Actions busca cada día el valor liquidativo de los ISIN de `fondos.json`
y lo guarda en `precios.json`. Al abrir el panel, lee ese archivo y recalcula el valor de cada fondo.

## Puesta en marcha

1. Crea un repositorio **público** en GitHub (por ejemplo `panel-patrimonio`) y sube todo el contenido de esta carpeta,
   incluida la carpeta oculta `.github`.
2. En el repositorio: **Settings → Pages → Build and deployment**. En "Source" elige *Deploy from a branch*,
   rama `main`, carpeta `/ (root)`. Guarda.
3. En **Settings → Actions → General → Workflow permissions** marca *Read and write permissions* y guarda.
4. Ve a la pestaña **Actions → Actualizar precios → Run workflow**. Cuando termine, abre el registro:
   cada fondo muestra `OK` con su precio y la fuente, o un aviso con el motivo.
5. Tu panel estará en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/`.

## Cómo funciona

- `fondos.json`: lista de fondos. Para añadir uno, pon su `isin` y `nombre`. Si Yahoo no lo encuentra,
  añade `"urls": ["https://..."]` con una página que muestre el valor liquidativo, o `"yahoo": "SIMBOLO"`.
- `scripts/actualizar.mjs`: consulta primero Yahoo Finance y, si falla, las páginas indicadas.
  Descarta cambios de más del 25 % respecto al último precio por si una página se lee mal.
- `.github/workflows/actualizar.yml`: se ejecuta de lunes a viernes dos veces al día (hora UTC).
- `precios.json`: último precio y fecha de cada fondo. Si un fondo no se pudo actualizar, el panel lo avisa
  y conserva el último precio.

## Ten en cuenta

- Las fuentes son páginas de terceros. Pueden cambiar o bloquear las consultas automáticas.
  Mira el registro de la primera ejecución y, si algún fondo falla, ajusta `urls` o `yahoo` en `fondos.json`.
- Si el repositorio está inactivo 60 días, GitHub pausa los workflows programados. Se reactivan desde la pestaña Actions.
- El repositorio es público: se verán los ISIN de `fondos.json`, pero no tus importes ni participaciones.
- Cada dispositivo guarda sus propios datos. Para pasarlos de uno a otro usa "Exportar copia" e "Importar copia".
