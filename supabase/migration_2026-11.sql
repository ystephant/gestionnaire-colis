-- À exécuter UNE FOIS dans Supabase > SQL Editor (réexécutable sans risque).
-- Mêmes règles d'accès permissives que les autres tables de l'application.

-- Photos : choix de l'option « demander le prix de vente »
alter table public.user_preferences
  add column if not exists photos_vente_popup boolean not null default false;

-- SAV : suivi des demandes
create table if not exists public.sav_demandes (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  game_name     text not null,
  missing_items text default '',
  status        text not null default 'a_envoyer'
                check (status in ('a_envoyer','envoyee','relancee','recue')),
  incomplete_id text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Scores : historique des parties et groupes de joueurs
create table if not exists public.score_history (
  user_id    text not null,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table if not exists public.score_groups (
  user_id    text not null,
  id         text not null,
  name       text not null,
  players    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

do $$
declare t text;
begin
  foreach t in array array['sav_demandes','score_history','score_groups'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "acces_app" on public.%I', t);
    execute format('create policy "acces_app" on public.%I for all using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
  end loop;
end $$;
