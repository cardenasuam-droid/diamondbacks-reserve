-- 0058_registration_optional_category.sql
-- La inscripción de la 6a femenil ya no pregunta CATEGORÍA ni TALLA DE
-- PLAYERA (pedido del organizador, 2026-09-17): la categoría la asigna el
-- comité al aprobar (con el rating de la liga pasada como referencia, F5) y
-- la talla dejó de pedirse. shirt_size ya era nullable; aquí la categoría
-- solicitada pasa a opcional. El FK a match_categories sigue validando
-- cuando sí venga (el formulario de Reserve la sigue mandando).

alter table player_registrations
  alter column requested_category_code drop not null;
