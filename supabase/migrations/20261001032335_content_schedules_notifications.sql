create table public.notification_reads(id text primary key,data jsonb not null check(data->>'id'=id),user_id text generated always as(data->>'userId') stored references public.profiles(id) on delete cascade,attempt_id text generated always as(data->>'attemptId') stored references public.attempts(id) on delete cascade,unique(user_id,attempt_id));
alter table public.notification_reads enable row level security;
revoke all on public.notification_reads from anon,authenticated;
grant select on public.notification_reads to authenticated;
grant all on public.notification_reads to service_role;
create policy reads_own on public.notification_reads for select to authenticated using(user_id=auth.uid()::text and private.role() is not null);
create or replace function private.can_open(lid text) returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists(select 1 from public.lessons l join public.modules m on m.id=l.module_id join public.courses c on c.id=m.course_id where l.id=lid and
(private.manages(m.course_id) or (private.role()='student' and (l.data->>'published')::boolean and not coalesce((l.data->>'hidden')::boolean,false) and not coalesce((m.data->>'hidden')::boolean,false) and not coalesce((c.data->>'hidden')::boolean,false) and (l.data->>'availableAt' is null or (l.data->>'availableAt')::timestamptz<=now()) and exists(select 1 from public.enrollments e left join public.groups g on g.id=e.group_id where e.course_id=m.course_id and(e.student_id=auth.uid()::text or g.data->'studentIds' ? auth.uid()::text) and(e.data->>'mode'='self' or exists(select 1 from public.releases r where r.lesson_id=lid and r.group_id=g.id and (r.data->>'opensAt' is null or (r.data->>'opensAt')::timestamptz<=now())))))))$$;
create or replace function private.lesson_catalog() returns jsonb language sql stable security definer set search_path='' as $$select coalesce(jsonb_agg(case when private.can_open(l.id) then l.data else jsonb_set(l.data,'{blocks}','[]'::jsonb) end),'[]'::jsonb) from public.lessons l join public.modules m on m.id=l.module_id join public.courses c on c.id=m.course_id where private.manages(m.course_id) or(private.role()='student' and private.enrolled(m.course_id) and(l.data->>'published')::boolean and not coalesce((l.data->>'hidden')::boolean,false) and not coalesce((m.data->>'hidden')::boolean,false) and not coalesce((c.data->>'hidden')::boolean,false))$$;
drop policy courses_read on public.courses;
create policy courses_read on public.courses for select to authenticated using(private.manages(id) or(private.enrolled(id) and not coalesce((data->>'hidden')::boolean,false)));
drop policy modules_read on public.modules;
create policy modules_read on public.modules for select to authenticated using(private.manages(course_id) or(private.enrolled(course_id) and not coalesce((data->>'hidden')::boolean,false) and exists(select 1 from public.courses c where c.id=course_id and not coalesce((c.data->>'hidden')::boolean,false))));
create function private.read_notifications(events jsonb) returns void language plpgsql security definer set search_path='' as $$
declare uid text=auth.uid()::text; event jsonb; a jsonb; stamp text; rid text;
begin
 if uid is null or private.role() is null or jsonb_array_length(events)>100 then raise exception 'FORBIDDEN';end if;
 for event in select value from jsonb_array_elements(events) loop
 select data into a from public.attempts where id=event->>'attemptId';
 if a is null or not ((private.role()='student' and a->>'studentId'=uid and a->>'status' in('reviewed','returned')) or (private.manages(private.lesson_course(a->>'lessonId')) and private.manages_student(a->>'studentId') and a->>'status'='pending')) then raise exception 'FORBIDDEN';end if;
 stamp=coalesce(a->>'reviewedAt',a->>'submittedAt');
 if event->>'eventAt'=stamp then
 rid=uid||':'||(a->>'id');insert into public.notification_reads(id,data)values(rid,jsonb_build_object('id',rid,'userId',uid,'attemptId',a->>'id','eventAt',stamp)) on conflict(id)do update set data=excluded.data;
 end if;end loop;
end$$;
create function public.read_notifications(events jsonb) returns void language sql security invoker set search_path='' as $$select private.read_notifications(events)$$;
create function private.manage_content(kind text,target_id text,operation text) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid text; mids text[]; lids text[]; tbl text;
begin
 if private.role() is null or private.role() not in('admin','teacher') then raise exception 'FORBIDDEN';end if;
 if kind='course' then select id into cid from public.courses where id=target_id;tbl='courses';
 elsif kind='module' then select course_id into cid from public.modules where id=target_id;tbl='modules';
 elsif kind='lesson' then cid=private.lesson_course(target_id);tbl='lessons';else raise exception 'INVALID_INPUT';end if;
 if cid is null or not private.manages(cid) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtext(cid));
 if operation in('hide','show') then
 execute format('update public.%I set data=jsonb_set(data,''{hidden}'',$1)',tbl)||case when kind='lesson' then ' || jsonb_build_object(''version'',(data->>''version'')::int+1)' else '' end||' where id=$2' using to_jsonb(operation='hide'),target_id;
 return jsonb_build_object('deletedLessonIds','[]'::jsonb);
 elsif operation<>'delete' then raise exception 'INVALID_INPUT';end if;
 select coalesce(array_agg(id),array[]::text[]) into mids from public.modules where (kind='course' and course_id=target_id) or(kind='module' and id=target_id);
 select coalesce(array_agg(id),array[]::text[]) into lids from public.lessons where (kind='lesson' and id=target_id) or module_id=any(mids);
 delete from public.attempts where lesson_id=any(lids);delete from public.drafts where lesson_id=any(lids);delete from public.extras where lesson_id=any(lids);delete from public.releases where lesson_id=any(lids);delete from public.answer_keys where lesson_id=any(lids);delete from public.lessons where id=any(lids);delete from public.modules where id=any(mids);
 if kind='course' then delete from public.enrollments where course_id=target_id;delete from public.courses where id=target_id;end if;
 return jsonb_build_object('deletedLessonIds',to_jsonb(lids));
end$$;
create function public.manage_content(kind text,target_id text,operation text) returns jsonb language sql security invoker set search_path='' as $$select private.manage_content(kind,target_id,operation)$$;
-- Validate added schedule fields even when an educator calls the existing RPC directly.
alter function private.save_entities(jsonb) rename to save_entities_without_schedule;
create function private.save_entities(changes jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r jsonb; d jsonb;
begin
 if private.role() is null or private.role() not in('admin','teacher') then raise exception 'FORBIDDEN';end if;
 for r in select value from jsonb_array_elements(coalesce(changes->'releases','[]'::jsonb)) loop
 d=r->'data';if d->>'opensAt' is not null then perform (d->>'opensAt')::timestamptz;end if;
 if d->>'dueAt' is not null then perform (d->>'dueAt')::timestamptz;end if;
 if d->>'opensAt' is not null and d->>'dueAt' is not null and(d->>'dueAt')::timestamptz<=(d->>'opensAt')::timestamptz then raise exception 'INVALID_SCHEDULE';end if;end loop;
 for r in select value from jsonb_array_elements(coalesce(changes->'lessons','[]'::jsonb)) loop if r->'data'->>'availableAt' is not null then perform(r->'data'->>'availableAt')::timestamptz;end if;end loop;
 perform private.save_entities_without_schedule(changes);
end$$;
create or replace function public.save_entities(changes jsonb) returns void language sql security invoker set search_path='' as $$select private.save_entities(changes)$$;
-- Late submissions use only assignments that have actually opened. Any open assignment
-- without a deadline means this learner does not currently have a hard deadline.
create or replace function private.submit_attempt(command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
 declare lid text=command->>'lessonId';uid text=auth.uid()::text;aid text=command->>'id';l jsonb;k jsonb;b jsonb;ans text;n int;extra int;auto_score int=0;auto_max int=0;manual_max int=0;correct boolean;results jsonb='{}';answers jsonb='{}';a jsonb;late boolean=false;
 begin
 if auth.uid() is null or private.role()<>'student' or not private.can_open(lid) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtext(uid||lid));
 select data into a from public.attempts where id=aid;if found then if a->>'studentId'<>uid or a->>'lessonId'<>lid then raise exception 'ID_CONFLICT';end if;return a;end if;
 if aid !~ '^[0-9a-f-]{36}$' or jsonb_typeof(command->'answers')<>'object' or pg_column_size(command)>1000000 then raise exception 'INVALID_INPUT';end if;
 select data into l from public.lessons where id=lid for share;
 if(l->>'version')::int<>(command->>'version')::int then raise exception 'LESSON_CHANGED';end if;
 select count(*) into n from public.attempts where student_id=uid and lesson_id=lid;select coalesce((data->>'count')::int,0) into extra from public.extras where student_id=uid and lesson_id=lid;
 if n >=(l->>'attemptLimit')::int+coalesce(extra,0) then raise exception 'NO_ATTEMPTS';end if;
 select keys into k from public.answer_keys where lesson_id=lid;
 for b in select value from jsonb_array_elements(l->'blocks') loop
 if b->>'type' in('choice','gap','writing') then ans=btrim(command->'answers'->>(b->>'id'));if ans is null or ans='' then raise exception 'ANSWER_ALL';end if;answers=answers||jsonb_build_object(b->>'id',ans);
 if b->>'type'='writing' then manual_max=manual_max+coalesce((b->>'points')::int,1);else
 auto_max=auto_max+coalesce((b->>'points')::int,1);select exists(select 1 from jsonb_array_elements_text(k->(b->>'id')->'accepted') accepted where lower(regexp_replace(btrim(normalize(accepted,NFKC)),'\s+',' ','g'))=lower(regexp_replace(btrim(normalize(ans,NFKC)),'\s+',' ','g'))) into correct;
 results=results||jsonb_build_object(b->>'id',correct);if correct then auto_score=auto_score+coalesce((b->>'points')::int,1);end if;end if;end if;end loop;
 select coalesce(bool_and(r.data->>'dueAt' is not null) and now()>max((r.data->>'dueAt')::timestamptz),false) into late from public.releases r join public.enrollments e on e.group_id=r.group_id join public.groups g on g.id=e.group_id where r.lesson_id=lid and(r.data->>'homework')::boolean and g.data->'studentIds' ? uid and (r.data->>'opensAt' is null or (r.data->>'opensAt')::timestamptz<=now());
 a=jsonb_build_object('id',aid,'studentId',uid,'lessonId',lid,'version',(l->>'version')::int,'number',n+1,'submittedAt',now(),'late',late,'answers',answers,'snapshot',l->'blocks','autoScore',auto_score,'autoMax',auto_max,'manualMax',manual_max,'autoResults',results,'status',case when manual_max>0 then 'pending' else 'reviewed' end);
 insert into public.attempts(id,data)values(aid,a);delete from public.drafts where student_id=uid and lesson_id=lid;return a;
 end$$;

revoke all on function private.read_notifications(jsonb),private.manage_content(text,text,text),private.save_entities(jsonb),private.save_entities_without_schedule(jsonb) from public,anon;
grant execute on function private.read_notifications(jsonb),private.manage_content(text,text,text),private.save_entities(jsonb) to authenticated;
-- The base save implementation is reachable only through the schedule-validating wrapper.
revoke all on function private.save_entities_without_schedule(jsonb) from authenticated;
revoke all on function public.read_notifications(jsonb),public.manage_content(text,text,text) from public,anon;
grant execute on function public.read_notifications(jsonb),public.manage_content(text,text,text) to authenticated;
