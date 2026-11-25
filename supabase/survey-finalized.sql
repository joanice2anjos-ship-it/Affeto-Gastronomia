-- Execute após a migração survey-status.sql da Affeto.
begin;

alter table public.affeto_survey_status
  add column if not exists finalized boolean not null default false;

-- Status existentes continuam ativos ou pausados. Finalizado implica inativo.
alter table public.affeto_survey_status
  drop constraint if exists affeto_status_consistent;
alter table public.affeto_survey_status
  add constraint affeto_status_consistent check (not (active and finalized));

grant select (finalized) on table public.affeto_survey_status to anon, authenticated;
grant update (finalized) on table public.affeto_survey_status to authenticated;

-- Substitui a função do gatilho existente, preservando o gatilho e as políticas RLS.
create or replace function public.affeto_require_active_survey()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  survey_active boolean;
  survey_finalized boolean;
begin
  select status.active, status.finalized
    into survey_active, survey_finalized
    from public.affeto_survey_status as status
    where status.id = 1
    for share;

  if survey_finalized is true then
    raise exception 'A pesquisa foi encerrada.' using errcode = 'AF002';
  end if;

  if survey_active is distinct from true then
    raise exception 'A pesquisa está temporariamente pausada.' using errcode = 'AF001';
  end if;

  return new;
end;
$$;

revoke all privileges on function public.affeto_require_active_survey()
  from public, anon, authenticated;

commit;
