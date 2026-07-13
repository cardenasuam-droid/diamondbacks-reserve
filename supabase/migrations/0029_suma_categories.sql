-- 0029_suma_categories.sql — Formato "Suma" 2026 (aplicado 2026-07-05).
-- Separa categoría de RANKING (lo que un jugador ES) de categoría de PARTIDO (lo
-- que se programa/juega), que hasta ahora se confundían. Los jugadores conservan
-- su ranking (VAR_4/5/6, FEM_3-7); solo cambian las categorías de partido.
-- Nuevas categorías de partido "Suma" que combinan dos rankings:
--   Suma 9 Var = 4ª+5ª varonil · Suma 7 Fem = 3ª+4ª · Suma 13 Fem = 6ª+7ª.
-- VAR_4/FEM_3/FEM_7 dejan de ser partido suelto (siguen como ranking del jugador).

alter table match_categories add column if not exists is_ranking boolean not null default false;
alter table match_categories add column if not exists is_match   boolean not null default false;
alter table match_categories add column if not exists match_sort_order int;

-- Ranking = lo que un jugador puede SER (no cambia)
update match_categories set is_ranking = true
 where code in ('VAR_4','VAR_5','VAR_6','FEM_3','FEM_4','FEM_5','FEM_6','FEM_7');

-- Nuevas categorías de PARTIDO 'Suma' (no son ranking)
insert into match_categories (code, name, type, sort_order, is_active, is_ranking, is_match, match_sort_order) values
  ('SUMA9_VAR','Suma 9 Varonil','varonil',11,true,false,true,1),
  ('SUMA7_FEM','Suma 7 Femenil','femenil',12,true,false,true,4),
  ('SUMA13_FEM','Suma 13 Femenil','femenil',13,true,false,true,5)
on conflict (code) do nothing;

-- Las 10 categorías que SE PROGRAMAN + su orden de despliegue
update match_categories set is_match=true, match_sort_order = case code
  when 'SUMA9_VAR' then 1 when 'VAR_5' then 2 when 'VAR_6' then 3
  when 'SUMA7_FEM' then 4 when 'SUMA13_FEM' then 5 when 'FEM_4' then 6
  when 'FEM_5' then 7 when 'FEM_6' then 8 when 'MIX_A' then 9 when 'MIX_B' then 10 end
 where code in ('SUMA9_VAR','VAR_5','VAR_6','SUMA7_FEM','SUMA13_FEM','FEM_4','FEM_5','FEM_6','MIX_A','MIX_B');

-- VAR_4/FEM_3/FEM_7: ranking-only (siguen activas para el draft, no se programan)
update match_categories set is_match=false where code in ('VAR_4','FEM_3','FEM_7');

-- Cancha 3 (faltaba: la BD tenía 1,2,4..10)
insert into courts (name, number, is_active) values ('Cancha 3', 3, true) on conflict (number) do nothing;

-- Elegibilidad: quitar los partidos que desaparecen, agregar las Suma (1+1)
delete from category_eligibility_rules where match_category_code in ('VAR_4','FEM_3','FEM_7','SUMA9_VAR','SUMA7_FEM','SUMA13_FEM');
insert into category_eligibility_rules (match_category_code, required_gender, required_player_category_code, required_count) values
  ('SUMA9_VAR','male','VAR_4',1), ('SUMA9_VAR','male','VAR_5',1),
  ('SUMA7_FEM','female','FEM_3',1), ('SUMA7_FEM','female','FEM_4',1),
  ('SUMA13_FEM','female','FEM_6',1), ('SUMA13_FEM','female','FEM_7',1);

-- Draft: iterar categorías de RANKING por la bandera (no por 'no mixta'), para que
-- las 'Suma' (type varonil/femenil pero is_ranking=false) no se drafteen.
create or replace function next_draft_category(p_draft_id uuid, p_season uuid)
returns text language sql stable security definer set search_path = public as $$
  select mc.code from match_categories mc
  where mc.is_ranking
    and exists (select 1 from players p where p.season_id = p_season and p.team_id is null
                and p.is_active and not p.is_waitlisted and p.category_code = mc.code)
    and not exists (select 1 from draft_picks dp where dp.draft_id = p_draft_id and dp.category_code = mc.code)
  order by mc.sort_order limit 1;
$$;
