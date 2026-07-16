# Rollout — Draft en vivo por Realtime Broadcast (migración 0033)

Cambio de fondo para que el **draft en vivo** escale con muchos espectadores.
Reemplaza el transporte `postgres_changes` por **Broadcast desde la base de
datos**. Es un cambio **acoplado**: la migración `0033_draft_broadcast.sql` y el
cliente (`src/features/draft/useDraftRealtime.ts`) se despliegan **juntos**.

## Por qué

`postgres_changes` reevalúa las políticas RLS **por cada conexión** y reenvía
cada cambio a todos los suscriptores → no escala con espectadores. En el draft
real con tráfico alto, los eventos se retrasaban/perdían (picks que no se veían).
Broadcast emite **un** mensaje por evento al topic `draft:<draft_id>` y Realtime
lo reparte sin reevaluar RLS por conexión.

El cliente conserva la estrategia de caché eficiente (parche quirúrgico del pool +
invalidaciones ligeras con debounce) y añade una **red de seguridad**: un refetch
ligero cada 20 s que cubre cualquier mensaje perdido. Por eso, si el broadcast no
llegara a algún dispositivo, ese cliente igual se pone al día en ≤20 s.

## Aplicar

1. Aplica la migración al proyecto Supabase (`qckqjrffrarktosixzdf`, compartido
   con `padelscore-live` — esta migración solo toca objetos del draft y una
   policy de `realtime.messages`, no toca el schema `live`):
   - `supabase db push`, **o**
   - pega `supabase/migrations/0033_draft_broadcast.sql` en el SQL Editor.
2. Despliega el cliente (esta rama) a Netlify **a la vez**.

## Probar la entrega a ANÓNIMOS (hazlo fuera de horario, antes de un draft real)

El único punto que no se puede validar sin tráfico es que los **espectadores
anónimos** (sin login) reciban los broadcasts (autorización de canal privado para
`anon`, vía la policy de `0033`).

1. Aplica `0033`.
2. Abre dos clientes: **organizador** (con sesión) y **espectador anónimo**
   (ventana de incógnito, sin login) en `/draft`.
3. Con un draft de prueba, haz un pick (o reinícialo). En el espectador anónimo:
   - ✅ Correcto: el board se actualiza en **~1 s**.
   - ⚠️ Si solo cambia cada ~20 s (la red de seguridad), el broadcast **no** está
     llegando a `anon`.
4. Opcional: en la consola del espectador anónimo, en la pestaña Network/WS,
   confirma que el WebSocket de Realtime recibe mensajes `draft_change`.

### Si no llega a anónimos

- Verifica que exista la policy `"receive draft broadcasts"` en `realtime.messages`
  (la crea `0033`) y que `anon` esté en `to anon, authenticated`.
- Confirma que la función `realtime.send` existe en la instancia (Realtime al día).
- En el cliente, `supabase.realtime.setAuth(token ?? null)` adjunta el token; para
  anónimos, `null` usa la apikey. Si tu versión de `supabase-js` no cae a la apikey
  con `null`, pásale explícitamente la anon key.

## Rollback (bajo riesgo)

La rama padre (`fix/draft-live-scaling`) ya deja el draft **funcionando y
mejorado** con `postgres_changes` + debounce + parche. Como las tablas siguen en
la publicación `supabase_realtime`, **revertir solo el commit del cliente**
restaura ese comportamiento al instante, sin deshacer nada en la BD. Los triggers
de `0033` quedan emitiendo broadcasts que nadie escucha (inofensivo); se pueden
quitar en una migración posterior si se desea.
