-- 0048 — whiteboard (spec 2026-09-16-class-features-design.md §7; plugin js/rtk-board.js).
-- Every mark on the board is one JSON op that rides the class broadcast channel AND lands here, so a
-- late joiner loads the board and it survives a reload. One board per room: board_id 'main' in the
-- class, the small group's meeting id inside a breakout. Anyone who may be in the class (ea_class_can)
-- reads and adds; a person removes their own marks (Undo); the host removes any (Clear the board).
-- No realtime here: the live path is the broadcast channel; the table is memory.
create table if not exists public.ea_class_board_ops (
  seq bigserial primary key,
  room_key text not null,
  board_id text not null default 'main' check (char_length(board_id) between 1 and 80),
  op_id text not null check (char_length(op_id) between 1 and 40),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  op jsonb not null,
  at timestamptz not null default now(),
  constraint ea_class_board_ops_op_size check (pg_column_size(op) <= 262144)   /* a stroke with its 4,000 points is under 100 KB */
);
create index if not exists ea_class_board_ops_board_idx on public.ea_class_board_ops (room_key, board_id, seq);
create unique index if not exists ea_class_board_ops_op_uidx on public.ea_class_board_ops (room_key, board_id, op_id);

alter table public.ea_class_board_ops enable row level security;

drop policy if exists class_board_read on public.ea_class_board_ops;
create policy class_board_read on public.ea_class_board_ops for select to authenticated
  using (public.ea_class_can(room_key));

/* an op is yours: the row says so and the op says so (the plugin trusts op->>'by' when it draws) */
drop policy if exists class_board_insert on public.ea_class_board_ops;
create policy class_board_insert on public.ea_class_board_ops for insert to authenticated
  with check (user_id = auth.uid()
              and op->>'by' = auth.uid()::text
              and op->>'id' = op_id
              and op->>'kind' in ('pen', 'text', 'note', 'rect', 'arrow', 'image', 'move')
              /* a picture is a file in the class bucket, never an outside address (the plugin refuses the rest too) */
              and (op->>'kind' <> 'image' or (op->>'path' ~ '^materials/[^/]+/[^/]+$' and op->>'path' !~ '\.\./'))
              and public.ea_class_can(room_key));

/* Undo takes back your own marks; Clear the board is the host's */
drop policy if exists class_board_delete on public.ea_class_board_ops;
create policy class_board_delete on public.ea_class_board_ops for delete to authenticated
  using (public.ea_class_can(room_key) and (user_id = auth.uid() or public.ea_class_is_host(room_key)));

grant select, insert, delete on public.ea_class_board_ops to authenticated;
grant usage, select on sequence public.ea_class_board_ops_seq_seq to authenticated;
revoke all on public.ea_class_board_ops from anon;
