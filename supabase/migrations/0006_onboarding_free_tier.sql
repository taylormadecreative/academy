-- 0006 onboarding + free tier: profile onboarding flag, product free flag,
-- the free Creator's AI Playbook product, and cover-art fixes. Idempotent.

alter table public.ea_profiles  add column if not exists onboarded_at timestamptz;
alter table public.ea_products   add column if not exists is_free boolean not null default false;

-- The free-tier ebook. PDF is uploaded to the private ea-files bucket in Task 5.
insert into public.ea_products (slug, title, type, is_free, price_cents, status, storage_path, cover_url)
values ('creators-ai-playbook', 'The Creator''s AI Playbook', 'ebook', true, 0, 'published',
        'creators-ai-playbook.pdf', '/assets/cover-creators-playbook.png')
on conflict (slug) do update set
  title        = excluded.title,
  is_free      = excluded.is_free,
  price_cents  = excluded.price_cents,
  status       = excluded.status,
  storage_path = excluded.storage_path,
  cover_url    = excluded.cover_url;

-- Cover fixes: renamed product points at old art; AI-agent gets a cache-busted name.
update public.ea_products set cover_url = '/assets/cover-money-machine.png' where slug = 'boring-money';
update public.ea_products set cover_url = '/assets/cover-ai-agent-v2.png'   where slug = 'ai-agent-ebook';
