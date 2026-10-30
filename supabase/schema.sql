-- =====================================================================
-- Signaler-DPF — schéma de la base (Supabase / PostgreSQL)
-- À coller une seule fois dans Supabase : SQL Editor > New query > Run
-- Pensez à remplacer VOTRE@ADRESSE.fr tout en bas (compte administrateur).
-- =====================================================================

-- ---------- Profils ----------------------------------------------------
-- Toute personne connectée est « agent » par défaut.
-- Les profils gestionnaire / bajc / admin sont attribués ici.
create table if not exists public.roles (
  email text primary key,
  role  text not null check (role in ('gestionnaire', 'bajc', 'admin'))
);

create or replace function public.my_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.roles where email = public.my_email()), 'agent')
$$;

-- ---------- Numérotation ----------------------------------------------
create sequence if not exists public.seq_cst;
create sequence if not exists public.seq_avt;
create sequence if not exists public.seq_pv;
create sequence if not exists public.seq_jug;

-- ---------- Constats (un dossier = une ligne) --------------------------
create table if not exists public.constats (
  id                bigint generated always as identity primary key,
  numero            text unique,
  created_at        timestamptz not null default now(),
  phase             int  not null default 2 check (phase between 1 and 6),
  statut            text not null default 'ouvert'
                    check (statut in ('ouvert', 'classe', 'regularise', 'termine')),

  -- Phase 1 : constat
  constatant_email  text not null default public.my_email(),
  constatant_nom    text,
  date_constat      date not null default current_date,
  voie_eau          text not null,
  commentaire       text,
  photos            text[] not null default '{}',
  carte             text,
  gps_lat           double precision,
  gps_lng           double precision,

  -- Phase 2 : caractérisation
  type_constat      text,
  intitule          text,
  plan_action       text,
  caracterise_par   text,
  caracterise_le    date,

  -- Phase 3 : avertissement
  avt_numero        text,
  avt_pdf           text,
  avt_date_affichage date,
  avt_photo         text,
  avt_valide_par    text,
  avt_valide_le     date,

  -- Phase 4 : COSTU
  costu_date_etab   date,
  costu_numero      text,
  costu_date_envoi  date,
  costu_envoi_valide_par text,
  costu_envoi_valide_le  date,
  costu_date_reception   date,
  costu_fin_valide_par   text,
  costu_fin_valide_le    date,

  -- Phase 5 : PV de grande voirie
  pv_numero         text,
  pv_date_visite    date,
  pv_photos         text[] not null default '{}',
  pv_projet         text,
  bajc_sollicite_le date,
  bajc_retour_le    date,
  pv_signe          text,
  pv_notification   text,
  pv_preuve_envoi   text,
  pv_date_envoi     date,
  pv_envoi_valide_par text,
  pv_envoi_valide_le  date,
  pv_date_fin_notif date,
  pv_resultat       text check (pv_resultat in ('delivre', 'non_retire')),
  pv_fin_valide_par text,
  pv_fin_valide_le  date,

  -- Phase 6 : tribunal (BAJC)
  tribunal_saisi_le date,
  tribunal_valide_par text,
  jugement_date     date,
  jugement_pdf      text,
  jugement_recu_le  date,
  jug_numero        text,
  jugement_notifie_le date,
  jugement_notif_valide_le date,

  -- Toutes phases : régularisation
  regularise_le     date,
  regularisation_commentaire text,
  regularise_par    text
);

-- Numéros CST / AVT / PV / JUG attribués automatiquement
create or replace function public.constats_numeros() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.numero := 'CST-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.seq_cst')::text, 4, '0');
    new.constatant_email := public.my_email();
    new.phase := 2;
    new.statut := 'ouvert';
  else
    new.numero := old.numero;
    new.constatant_email := old.constatant_email;
  end if;
  if new.avt_valide_le is not null and new.avt_numero is null then
    new.avt_numero := 'AVT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.seq_avt')::text, 4, '0');
  end if;
  if new.bajc_sollicite_le is not null and new.pv_numero is null then
    new.pv_numero := 'PV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.seq_pv')::text, 4, '0');
  end if;
  if new.jugement_recu_le is not null and new.jug_numero is null then
    new.jug_numero := 'JUG-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.seq_jug')::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_constats_numeros on public.constats;
create trigger trg_constats_numeros before insert or update on public.constats
for each row execute function public.constats_numeros();

-- ---------- Journal (traçabilité) --------------------------------------
create table if not exists public.journal (
  id         bigint generated always as identity primary key,
  constat_id bigint not null references public.constats(id) on delete cascade,
  at         timestamptz not null default now(),
  par        text not null default public.my_email(),
  texte      text not null
);
create index if not exists journal_constat_idx on public.journal(constat_id, at desc);

-- ---------- Sécurité (Row Level Security) -----------------------------
alter table public.roles    enable row level security;
alter table public.constats enable row level security;
alter table public.journal  enable row level security;

drop policy if exists roles_admin_all on public.roles;
create policy roles_admin_all on public.roles for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

drop policy if exists constats_insert on public.constats;
create policy constats_insert on public.constats for insert to authenticated
  with check (true);

drop policy if exists constats_select on public.constats;
create policy constats_select on public.constats for select to authenticated
  using (
    constatant_email = public.my_email()
    or public.my_role() in ('gestionnaire', 'admin')
    or (public.my_role() = 'bajc' and phase >= 5)
  );

drop policy if exists constats_update on public.constats;
create policy constats_update on public.constats for update to authenticated
  using (public.my_role() in ('gestionnaire', 'admin') or (public.my_role() = 'bajc' and phase >= 5))
  with check (public.my_role() in ('gestionnaire', 'admin') or (public.my_role() = 'bajc' and phase >= 5));

drop policy if exists journal_select on public.journal;
create policy journal_select on public.journal for select to authenticated
  using (exists (select 1 from public.constats c where c.id = constat_id));

drop policy if exists journal_insert on public.journal;
create policy journal_insert on public.journal for insert to authenticated
  with check (exists (select 1 from public.constats c where c.id = constat_id));

-- Lecture de son propre profil par l'application
grant execute on function public.my_role() to authenticated;

-- ---------- Stockage des fichiers (photos, PDF, Word) ------------------
insert into storage.buckets (id, name, public)
values ('pieces', 'pieces', false)
on conflict (id) do nothing;

drop policy if exists pieces_insert on storage.objects;
create policy pieces_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'pieces');

drop policy if exists pieces_select on storage.objects;
create policy pieces_select on storage.objects for select to authenticated
  using (bucket_id = 'pieces');

-- ---------- Premier administrateur -------------------------------------
-- Remplacez par VOTRE adresse avant de lancer le script.
insert into public.roles (email, role) values (lower('VOTRE@ADRESSE.fr'), 'admin')
on conflict (email) do update set role = excluded.role;
