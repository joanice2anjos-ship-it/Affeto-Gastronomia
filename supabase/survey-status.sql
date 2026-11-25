-- Migração para o projeto Affeto que já possui responses_affeto e is_affeto_admin().
-- Execute uma vez, antes de disponibilizar o novo painel.
begin;

create table if not exists public.affeto_survey_status (
  id smallint primary key check (id = 1),
  active boolean not null default true
);

insert into public.affeto_survey_status (id, active)
values (1, true)
on conflict (id) do nothing;

alter table public.affeto_survey_status enable row level security;
revoke all on public.affeto_survey_status from public, anon, authenticated;
revoke all privileges (id, active) on table public.affeto_survey_status from public, anon, authenticated;
grant select (id, active) on public.affeto_survey_status to anon, authenticated;
grant update (active) on public.affeto_survey_status to authenticated;

drop policy if exists "Status da pesquisa pode ser consultado" on public.affeto_survey_status;
create policy "Status da pesquisa pode ser consultado"
on public.affeto_survey_status for select to anon, authenticated
using (id = 1);

drop policy if exists "Somente administradores alteram o status" on public.affeto_survey_status;
create policy "Somente administradores alteram o status"
on public.affeto_survey_status for update to authenticated
using (id = 1 and (select public.is_affeto_admin()))
with check (id = 1 and (select public.is_affeto_admin()));

drop policy if exists "Atualizacao de status exige administrador" on public.affeto_survey_status;
create policy "Atualizacao de status exige administrador"
on public.affeto_survey_status as restrictive for update to authenticated
using (id = 1 and (select public.is_affeto_admin()))
with check (id = 1 and (select public.is_affeto_admin()));

create or replace function public.affeto_require_active_survey()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  survey_active boolean;
begin
  -- A trava ordena os envios concorrentes em relação à pausa ou reativação.
  select status.active into survey_active
  from public.affeto_survey_status as status
  where status.id = 1
  for share;

  if survey_active is distinct from true then
    raise exception 'A pesquisa está temporariamente pausada.' using errcode = 'AF001';
  end if;

  return new;
end;
$$;

revoke all on function public.affeto_require_active_survey() from public, anon, authenticated;

drop trigger if exists affeto_require_active_survey on public.responses_affeto;
create trigger affeto_require_active_survey
before insert on public.responses_affeto
for each row execute function public.affeto_require_active_survey();

commit;
