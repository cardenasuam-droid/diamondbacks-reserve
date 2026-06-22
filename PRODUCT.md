# Product

## Register

product

## Users

Cuatro roles de una liga de pádel por equipos (~6 equipos, ~25 jugadores c/u):
- **Jugadores**: consultan su próximo partido, rol, resultados y tabla — casi siempre en el móvil.
- **Capitanes**: arman y envían alineaciones, muchas veces **en la cancha** y contrarreloj (candado de 1 h).
- **Organizadores**: gestionan equipos/jugadores, importan CSV, validan resultados, publican el rol.
- **Web manager**: publica noticias, reglamento y avisos.
El contexto dominante es **móvil, a pie de cancha**: poca atención, prisa, a veces sol directo.

## Product Purpose

Operar una liga por equipos de principio a fin —rol, alineaciones con validación
automática, captura/validación de resultados, tabla y ranking derivados, contenido
y avisos— sin depender de hojas de cálculo ni grupos de WhatsApp. Éxito = correr
una temporada completa de forma confiable desde el teléfono.

## Brand Personality

Competitiva, premium y confiable. Identidad del escudo "Diamondbacks Reserve":
**esmeralda + oro + negro**. Voz en español: clara, directa, deportiva, sin jerga.
Tres palabras: *competitive · premium · trustworthy*.

## Anti-references

- Dashboards SaaS genéricos color crema/arena con un acento morado.
- Degradados morado→azul, **texto con degradado**, glassmorphism decorativo por defecto.
- La plantilla "hero-métrica" (número gigante + stats) y las **rejillas de tarjetas idénticas** icono+título+texto.
- Gamificación que sacrifique la **legibilidad de los datos** (marcadores, tablas).

## Design Principles

1. **Legibilidad de datos primero.** Marcadores, tablas y rol deben leerse de un vistazo en la cancha.
2. **Marca con mesura.** Esmeralda y oro como acento y momentos (líder, hero), no "todo verde y oro".
3. **Móvil-primero, usable en cancha.** Objetivos táctiles amplios, alto contraste, nada que dependa de hover.
4. **Consistencia sobre sorpresa.** Mismos componentes y vocabulario en todas las pantallas.
5. **Privacidad por defecto.** Nunca teléfono/correo en vistas públicas (RLS + UI).

## Accessibility & Inclusion

Objetivo **WCAG AA**. Soportar `prefers-reduced-motion`. No transmitir información
solo por color (el empate sin resolver lleva `*`, el ganador se ve por color **y**
marcador). Objetivos táctiles ≥44px. Diseño mobile-first; respetar safe-areas (PWA).
