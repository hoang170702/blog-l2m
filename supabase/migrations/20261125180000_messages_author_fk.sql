-- Chat messages embed their author as `author:profiles!messages_user_id_fkey(...)`, but the
-- foreign key pointed at auth.users, so PostgREST found no messages -> profiles relationship
-- and every room/thread load failed. Point it at public.profiles, which shares the id and
-- cascades from auth.users, so deleting a user still deletes their messages.

alter table public.messages
  drop constraint messages_user_id_fkey,
  add constraint messages_user_id_fkey foreign key (user_id)
    references public.profiles (id) on delete cascade;
