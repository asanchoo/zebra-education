-- A two-phase account deletion keeps access closed if Auth cleanup needs retrying.
-- School content and media survive removal of the teacher who created them.
create function private.delete_school_profile(target_id text, finalize boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare actor text := auth.uid()::text; target_role text;
begin
  if actor is null or coalesce(private.role(),'') <> 'admin' or target_id = actor then
    raise exception 'FORBIDDEN';
  end if;
  select data->>'role' into target_role from public.profiles where id=target_id for update;
  if target_role is null then raise exception 'INVALID_PROFILE'; end if;
  if target_role not in ('student','teacher') then raise exception 'FORBIDDEN'; end if;
  update public.profiles set data=jsonb_set(data,'{active}','false'::jsonb) where id=target_id;
  update public.courses set data=jsonb_set(data,'{teacherId}',to_jsonb(actor)) where teacher_id=target_id;
  update public.groups set data=jsonb_set(data,'{teacherId}',to_jsonb(actor)) where teacher_id=target_id;
  update storage.objects set owner=auth.uid(), owner_id=actor
    where bucket_id='lesson-media' and (owner_id=target_id or owner::text=target_id);
  if finalize then
    -- Final cleanup is called by the application after deleting the Auth identity.
    delete from public.drafts where student_id=target_id;
    delete from public.attempts where student_id=target_id;
    delete from public.extras where student_id=target_id;
    delete from public.enrollments where student_id=target_id;
    update public.groups g set data=jsonb_set(g.data,'{studentIds}',
      coalesce((select jsonb_agg(member) from jsonb_array_elements(g.data->'studentIds') member where member <> to_jsonb(target_id)), '[]'::jsonb))
      where g.data->'studentIds' ? target_id;
    delete from public.profiles where id=target_id;
  end if;
end $$;
revoke all on function private.delete_school_profile(text,boolean) from public,anon;
grant execute on function private.delete_school_profile(text,boolean) to authenticated;
create function public.delete_school_profile(target_id text, finalize boolean default false)
returns void language sql security invoker set search_path='' as $$select private.delete_school_profile(target_id,finalize)$$;
revoke all on function public.delete_school_profile(text,boolean) from public,anon;
grant execute on function public.delete_school_profile(text,boolean) to authenticated;
