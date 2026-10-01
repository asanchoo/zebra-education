create index notification_reads_attempt_id_idx on public.notification_reads(attempt_id);
alter policy reads_own on public.notification_reads using(user_id=(select auth.uid())::text and (select private.role()) is not null);
