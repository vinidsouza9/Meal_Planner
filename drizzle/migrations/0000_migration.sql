create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  household_size int not null default 2,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id) values (new.id) on conflict do nothing; return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  ingredients text[] not null default '{}',
  steps text,
  cook_time int not null default 30,
  is_quick boolean not null default false,
  can_repeat boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  week_start date not null,
  answers jsonb not null,
  created_at timestamptz not null default now()
);
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  week_start date not null,
  check_in_id uuid references public.check_ins(id) on delete set null,
  plan_json jsonb not null,
  locked jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create table public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  plan_id uuid not null references public.plans(id) on delete cascade unique,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);
do $$ declare t text; begin
foreach t in array array['recipes','check_ins','plans','grocery_lists'] loop
  execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  execute format('grant all on public.%I to service_role', t);
  execute format('alter table public.%I enable row level security', t);
  execute format('create policy "own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
end loop; end $$;