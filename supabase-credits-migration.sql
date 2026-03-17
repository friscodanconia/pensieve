-- Run this in your Supabase SQL Editor
-- Adds credits system to existing profiles table

-- 1. Add credits column (default 20 for new users)
alter table profiles add column if not exists credits int default 20 not null;

-- 2. Update existing users to have 20 credits (if they had none)
update profiles set credits = 20 where credits is null;

-- 3. Update the signup trigger to include credits
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, credits)
  values (new.id, new.email, 20);
  return new;
end;
$$ language plpgsql security definer;

-- 4. Helper function: decrement credits and return remaining count
-- Called from API routes via service role key
create or replace function public.use_credit(user_id uuid)
returns int as $$
declare
  remaining int;
begin
  update profiles
  set credits = credits - 1, updated_at = now()
  where id = user_id and credits > 0
  returning credits into remaining;

  if remaining is null then
    return -1; -- no credits left
  end if;

  return remaining;
end;
$$ language plpgsql security definer;
