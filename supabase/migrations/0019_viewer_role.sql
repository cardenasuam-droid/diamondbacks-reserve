-- 0019_viewer_role.sql
-- Agrega el rol 'viewer' (administrador de SOLO LECTURA): ve los paneles de
-- organización y contenido, pero sin poder cambiar nada (la RLS de 0020 le da
-- SELECT amplio y NINGUNA escritura).
--
-- IMPORTANTE: esta migración va SOLA. Postgres no permite usar un valor de enum
-- recién creado en la misma transacción; is_viewer() y las políticas que comparan
-- role = 'viewer' viven en 0020, que se corre DESPUÉS (transacción aparte).

alter type user_role add value if not exists 'viewer';
