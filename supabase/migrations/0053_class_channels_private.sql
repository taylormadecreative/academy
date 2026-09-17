-- 0053 — the class plugins' broadcast channels ('<plugin>-<room_key>', e.g. react-opil:1, board-opil:1) are
-- PRIVATE: only someone who may be in that class (ea_class_can) can join or send. Pairs with
-- `private: true` in the room's ctx.channel(). Without this, anyone holding the site's anon key could
-- post a reaction, a whiteboard stroke or a scoring cue into any room from a browser console.
create or replace function public.ea_class_key_of_topic(topic text) returns text
language sql immutable as $$ select substr(topic, position('-' in topic) + 1) $$;
drop policy if exists class_channel_read on realtime.messages;
create policy class_channel_read on realtime.messages for select to authenticated
  using (public.ea_class_can(public.ea_class_key_of_topic(realtime.topic())));
drop policy if exists class_channel_write on realtime.messages;
create policy class_channel_write on realtime.messages for insert to authenticated
  with check (public.ea_class_can(public.ea_class_key_of_topic(realtime.topic())));
