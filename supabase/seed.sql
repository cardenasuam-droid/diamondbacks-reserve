-- seed.sql
-- Datos fijos que no dependen de la temporada concreta. Idempotente.

-- ---------------------------------------------------------------------------
-- Categorías de partido (9). Las 7 no-mixtas son también categorías de ranking.
-- ---------------------------------------------------------------------------
insert into match_categories (code, name, type, sort_order) values
  ('VAR_4', '4a Varonil', 'varonil', 1),
  ('VAR_5', '5a Varonil', 'varonil', 2),
  ('VAR_6', '6a Varonil', 'varonil', 3),
  ('FEM_4', '4a Femenil', 'femenil', 4),
  ('FEM_5', '5a Femenil', 'femenil', 5),
  ('FEM_6', '6a Femenil', 'femenil', 6),
  ('FEM_7', '7a Femenil', 'femenil', 7),
  ('MIX_A', 'Mixta A',    'mixta',   8),
  ('MIX_B', 'Mixta B',    'mixta',   9)
on conflict (code) do update
  set name = excluded.name, type = excluded.type, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Reglas de elegibilidad (data-driven). La validación de alineación lee esto.
-- ---------------------------------------------------------------------------
delete from category_eligibility_rules;
insert into category_eligibility_rules
  (match_category_code, required_gender, required_player_category_code, required_count) values
  ('VAR_4', 'male',   'VAR_4', 2),
  ('VAR_5', 'male',   'VAR_5', 2),
  ('VAR_6', 'male',   'VAR_6', 2),
  ('FEM_4', 'female', 'FEM_4', 2),
  ('FEM_5', 'female', 'FEM_5', 2),
  ('FEM_6', 'female', 'FEM_6', 2),
  ('FEM_7', 'female', 'FEM_7', 2),
  ('MIX_A', 'male',   'VAR_5', 1),
  ('MIX_A', 'female', 'FEM_4', 1),
  ('MIX_B', 'male',   'VAR_6', 1),
  ('MIX_B', 'female', 'FEM_5', 1);

-- ---------------------------------------------------------------------------
-- Horarios (3)
-- ---------------------------------------------------------------------------
insert into time_blocks (label, start_time, sort_order) values
  ('18:30', '18:30', 1),
  ('19:45', '19:45', 2),
  ('21:00', '21:00', 3)
on conflict (label) do update
  set start_time = excluded.start_time, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Canchas (9)
-- ---------------------------------------------------------------------------
insert into courts (name, number) values
  ('Cancha 1', 1), ('Cancha 2', 2), ('Cancha 3', 3),
  ('Cancha 4', 4), ('Cancha 5', 5), ('Cancha 6', 6),
  ('Cancha 7', 7), ('Cancha 8', 8), ('Cancha 9', 9)
on conflict (number) do update set name = excluded.name;
