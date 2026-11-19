-- Execute uma vez em um projeto Supabase dedicado à pesquisa.
begin;

create table public.responses_affeto (
  id uuid primary key,
  experience text not null check (experience in (
        'Excelente',
        'Muito boa',
        'Boa',
        'Regular',
        'Ainda conheço pouco para avaliar'
  )),
  frequency text not null check (frequency in (
        'Mais de uma vez por semana',
        'Cerca de uma vez por semana',
        'Algumas vezes por mês',
        'Raramente',
        'Foi minha primeira experiência'
  )),
  usage_options text[] not null check (
    coalesce(array_ndims(usage_options) = 1, false)
    and cardinality(usage_options) between 1 and 2
    and array_position(usage_options, null) is null
    and (cardinality(usage_options) = 1 or usage_options[array_lower(usage_options, 1)] <> usage_options[array_upper(usage_options, 1)])
    and usage_options <@ array[
        'Almoço buffet',
        'Cafeteria, cafés e bebidas',
        'Confeitaria funcional, bolos, cucas e cookies',
        'Pães e lanches',
        'Marmitas congeladas',
        'Produtos para levar para casa',
        'Ainda estou conhecendo as opções'
    ]
  ),
  healthy_flavor_perception text not null check (healthy_flavor_perception in (
        'A Affeto mostra que alimentação saudável pode ser muito saborosa',
        'Os produtos são saborosos e atendem bem à proposta saudável',
        'Gosto da proposta, mas alguns produtos poderiam ter mais sabor',
        'Ainda percebo diferença em relação aos produtos convencionais',
        'Ainda não experimentei o suficiente para avaliar'
  )),
  frequency_motivation text[] not null check (
    coalesce(array_ndims(frequency_motivation) = 1, false)
    and cardinality(frequency_motivation) between 1 and 2
    and array_position(frequency_motivation, null) is null
    and (cardinality(frequency_motivation) = 1 or frequency_motivation[array_lower(frequency_motivation, 1)] <> frequency_motivation[array_upper(frequency_motivation, 1)])
    and frequency_motivation <@ array[
        'Conhecer o cardápio e as opções disponíveis com antecedência',
        'Mais novidades e variedade de produtos',
        'Combos ou opções com melhor custo-benefício',
        'Programa de fidelidade ou benefícios para clientes frequentes',
        'Mais praticidade para pedidos, retirada ou delivery',
        'Mais opções de produtos prontos para levar para casa',
        'Mais informações sobre ingredientes e características dos produtos',
        'Nada específico — já consumo com a frequência que gostaria'
    ]
  ),
  suggestion text check (char_length(suggestion) <= 300),
  created_at timestamptz not null default now()
);

alter table public.responses_affeto enable row level security;

create function public.is_affeto_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' -> 'affeto_admin' = 'true'::jsonb, false);
$$;

revoke all on function public.is_affeto_admin() from public, anon, authenticated;
grant execute on function public.is_affeto_admin() to authenticated;

revoke all on public.responses_affeto from public, anon, authenticated;
grant insert (
  id, experience, frequency, usage_options, healthy_flavor_perception,
  frequency_motivation, suggestion
) on public.responses_affeto to anon;
grant select on public.responses_affeto to authenticated;

create policy "Pesquisa publica permite inserir"
on public.responses_affeto for insert to anon
with check (true);

create policy "Somente administradores leem"
on public.responses_affeto for select to authenticated
using ((select public.is_affeto_admin()));

commit;
