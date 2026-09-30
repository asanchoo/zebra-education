-- ZEBRA v1. Entity envelopes keep the lesson builder's versioned block data intact.
-- Relationships are generated, indexed foreign keys. Writes only use checked RPCs.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create table public.profiles(id text primary key,data jsonb not null check(data->>'id'=id));
create table public.courses(id text primary key,data jsonb not null check(data->>'id'=id),teacher_id text generated always as(data->>'teacherId') stored references public.profiles(id));
create table public.modules(id text primary key,data jsonb not null check(data->>'id'=id),course_id text generated always as(data->>'courseId') stored references public.courses(id));
create table public.lessons(id text primary key,data jsonb not null check(data->>'id'=id),module_id text generated always as(data->>'moduleId') stored references public.modules(id),check(not(data ? 'keys')),check((data->>'attemptLimit')::int between 1 and 20));
create table public.answer_keys(lesson_id text primary key references public.lessons(id),keys jsonb not null);
create table public.groups(id text primary key,data jsonb not null check(data->>'id'=id),teacher_id text generated always as(data->>'teacherId') stored references public.profiles(id));
create table public.enrollments(id text primary key,data jsonb not null check(data->>'id'=id),course_id text generated always as(data->>'courseId') stored references public.courses(id),group_id text generated always as(data->>'groupId') stored references public.groups(id),student_id text generated always as(data->>'studentId') stored references public.profiles(id),check((data->>'groupId' is null)<>(data->>'studentId' is null)),check(data->>'mode' in('group','self')),check(data->>'mode'<>'group' or data->>'groupId' is not null));
create table public.releases(id text primary key,data jsonb not null check(data->>'id'=id),lesson_id text generated always as(data->>'lessonId') stored references public.lessons(id),group_id text generated always as(data->>'groupId') stored references public.groups(id),unique(lesson_id,group_id));
create table public.drafts(id text primary key,data jsonb not null check(data->>'id'=id),lesson_id text generated always as(data->>'lessonId') stored references public.lessons(id),student_id text generated always as(data->>'studentId') stored references public.profiles(id),unique(lesson_id,student_id));
create table public.attempts(id text primary key,data jsonb not null check(data->>'id'=id),lesson_id text generated always as(data->>'lessonId') stored references public.lessons(id),student_id text generated always as(data->>'studentId') stored references public.profiles(id),attempt_number int generated always as((data->>'number')::int) stored,unique(lesson_id,student_id,attempt_number));
create table public.extras(id text primary key,data jsonb not null check(data->>'id'=id),lesson_id text generated always as(data->>'lessonId') stored references public.lessons(id),student_id text generated always as(data->>'studentId') stored references public.profiles(id),unique(lesson_id,student_id),check((data->>'count')::int>=0));
create index on public.courses(teacher_id);create index on public.modules(course_id);create index on public.lessons(module_id);create index on public.groups(teacher_id);create index on public.enrollments(course_id);create index on public.enrollments(group_id);create index on public.enrollments(student_id);create index on public.drafts(student_id);create index on public.attempts(student_id);create index on public.extras(student_id);create index on public.releases(group_id);
create function private.role() returns text language sql stable security definer set search_path='' as $$select data->>'role' from public.profiles where id=(select auth.uid())::text and (data->>'active')::boolean$$;
create function private.enrolled(cid text) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and private.role() is not null and exists(select 1 from public.enrollments e left join public.groups g on g.id=e.group_id where e.course_id=cid and (e.student_id=auth.uid()::text or g.data->'studentIds' ? auth.uid()::text))$$;
create function private.manages(cid text) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and (private.role()='admin' or (private.role()='teacher' and exists(select 1 from public.courses where id=cid and teacher_id=auth.uid()::text)))$$;
create function private.manages_student(sid text) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and (private.role()='admin' or (private.role()='teacher' and (exists(select 1 from public.groups where teacher_id=auth.uid()::text and data->'studentIds' ? sid) or exists(select 1 from public.enrollments where student_id=sid and private.manages(course_id)))))$$;
create function private.lesson_course(lid text) returns text language sql stable security definer set search_path='' as $$select m.course_id from public.lessons l join public.modules m on m.id=l.module_id where l.id=lid and auth.uid() is not null$$;
create function private.can_open(lid text) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.lessons l join public.modules m on m.id=l.module_id where l.id=lid and (private.manages(m.course_id) or(private.role()='student' and(l.data->>'published')::boolean and exists(select 1 from public.enrollments e left join public.groups g on g.id=e.group_id where e.course_id=m.course_id and(e.student_id=auth.uid()::text or g.data->'studentIds' ? auth.uid()::text) and(e.data->>'mode'='self' or exists(select 1 from public.releases r where r.lesson_id=lid and r.group_id=g.id))))))$$;
-- Definer helpers are private, require a verified uid, and expose only predicates.
revoke all on all functions in schema private from public,anon;
grant execute on all functions in schema private to authenticated;
do $$declare tbl text;begin foreach tbl in array array['profiles','courses','modules','lessons','answer_keys','groups','enrollments','releases','drafts','attempts','extras'] loop execute format('alter table public.%I enable row level security',tbl);execute format('revoke all on public.%I from anon,authenticated',tbl);execute format('grant select on public.%I to authenticated',tbl);end loop;end$$;
create policy profiles_read on public.profiles for select to authenticated using(private.role() is not null and(id=auth.uid()::text or private.role()='admin' or private.manages_student(id) or exists(select 1 from public.courses c where c.teacher_id=profiles.id and private.enrolled(c.id))));
create policy courses_read on public.courses for select to authenticated using(private.manages(id) or private.enrolled(id));
create policy modules_read on public.modules for select to authenticated using(private.manages(course_id) or private.enrolled(course_id));
create policy lessons_read on public.lessons for select to authenticated using(private.can_open(id));
create policy keys_read on public.answer_keys for select to authenticated using(private.manages(private.lesson_course(lesson_id)));
create policy groups_read on public.groups for select to authenticated using(private.role() is not null and(private.role()='admin' or teacher_id=auth.uid()::text or data->'studentIds' ? auth.uid()::text));
create policy enrollments_read on public.enrollments for select to authenticated using(private.manages(course_id) or private.enrolled(course_id));
create policy releases_read on public.releases for select to authenticated using(private.manages(private.lesson_course(lesson_id)) or exists(select 1 from public.groups g where g.id=group_id and g.data->'studentIds' ? auth.uid()::text));
create policy drafts_read on public.drafts for select to authenticated using(private.role()='student' and student_id=auth.uid()::text);
create policy attempts_read on public.attempts for select to authenticated using((private.role()='student' and student_id=auth.uid()::text) or(private.manages(private.lesson_course(lesson_id)) and private.manages_student(student_id)));
create policy extras_read on public.extras for select to authenticated using((private.role()='student' and student_id=auth.uid()::text) or(private.manages(private.lesson_course(lesson_id)) and private.manages_student(student_id)));
-- Closed lessons have a title in the course outline, but no content or answer keys.
create function private.lesson_catalog() returns jsonb language sql stable security definer set search_path='' as $$select coalesce(jsonb_agg(case when private.can_open(l.id) then l.data else l.data||jsonb_build_object('blocks','[]'::jsonb) end),'[]') from public.lessons l join public.modules m on m.id=l.module_id where auth.uid() is not null and (private.manages(m.course_id) or(private.enrolled(m.course_id) and(l.data->>'published')::boolean))$$;
create function public.lesson_catalog() returns jsonb language sql stable security invoker set search_path='' as $$select private.lesson_catalog()$$;
create function private.save_draft(command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare lid text=command->>'lessonId';uid text=auth.uid()::text;l jsonb;d jsonb;begin if private.role()<>'student' or not private.can_open(lid) then raise exception 'FORBIDDEN';end if;select data into l from public.lessons where id=lid;if(l->>'version')::int<>(command->>'version')::int then raise exception 'LESSON_CHANGED';end if;if jsonb_typeof(command->'answers')<>'object' or pg_column_size(command)>1000000 then raise exception 'INVALID_INPUT';end if;d=jsonb_build_object('id',uid||':'||lid,'studentId',uid,'lessonId',lid,'version',(l->>'version')::int,'answers',command->'answers','updatedAt',now());insert into public.drafts(id,data) values(uid||':'||lid,d) on conflict(id) do update set data=excluded.data;return d;end$$;
create function public.save_draft(command jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.save_draft(command)$$;
create function private.submit_attempt(command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 select coalesce(now()>max((r.data->>'dueAt')::timestamptz),false) into late from public.releases r join public.enrollments e on e.group_id=r.group_id join public.groups g on g.id=e.group_id where r.lesson_id=lid and(r.data->>'homework')::boolean and g.data->'studentIds' ? uid;
 a=jsonb_build_object('id',aid,'studentId',uid,'lessonId',lid,'version',(l->>'version')::int,'number',n+1,'submittedAt',now(),'late',late,'answers',answers,'snapshot',l->'blocks','autoScore',auto_score,'autoMax',auto_max,'manualMax',manual_max,'autoResults',results,'status',case when manual_max>0 then 'pending' else 'reviewed' end);
 insert into public.attempts(id,data)values(aid,a);delete from public.drafts where student_id=uid and lesson_id=lid;return a;
 end$$;
create function public.submit_attempt(command jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.submit_attempt(command)$$;
create function private.review_attempt(command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare a jsonb;l jsonb;score numeric=(command->>'score')::numeric;aid text=command->>'attemptId';uid text;lid text;needed int;begin
 if auth.uid() is null or private.role() is null or private.role() not in('teacher','admin') then raise exception 'FORBIDDEN';end if;
 select data into a from public.attempts where id=aid for update;if a is null or not private.manages(private.lesson_course(a->>'lessonId')) or not private.manages_student(a->>'studentId') then raise exception 'FORBIDDEN';end if;
 if score<0 or score>(a->>'manualMax')::int then raise exception 'INVALID_SCORE';end if;
 if(command->>'returned')::boolean and btrim(coalesce(command->>'feedback',''))='' then raise exception 'FEEDBACK_REQUIRED';end if;
 a=a||jsonb_build_object('manualScore',score,'feedback',command->>'feedback','reviewedAt',now(),'status',case when(command->>'returned')::boolean then 'returned' else 'reviewed' end);update public.attempts set data=a where id=aid;
 if(command->>'returned')::boolean then uid=a->>'studentId';lid=a->>'lessonId';perform pg_advisory_xact_lock(hashtext(uid||lid));select data into l from public.lessons where id=lid;select greatest(0,count(*)+1-(l->>'attemptLimit')::int) into needed from public.attempts where student_id=uid and lesson_id=lid;insert into public.extras(id,data)values(uid||':'||lid,jsonb_build_object('id',uid||':'||lid,'studentId',uid,'lessonId',lid,'count',needed)) on conflict(id) do update set data=public.extras.data||jsonb_build_object('count',greatest(needed,(public.extras.data->>'count')::int));end if;return a;
 end$$;
create function public.review_attempt(command jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.review_attempt(command)$$;
create function private.save_entities(changes jsonb) returns void language plpgsql security definer set search_path='' as $$
 declare tbl text;rows jsonb;row jsonb;d jsonb;old jsonb;cid text;uid text=auth.uid()::text;rid text;role text=private.role();keys jsonb;b jsonb;ids text[];
 begin
 if uid is null or role is null or role not in('teacher','admin') then raise exception 'FORBIDDEN';end if;if pg_column_size(changes)>3000000 then raise exception 'TOO_LARGE';end if;perform pg_advisory_xact_lock(74183);
 for tbl,rows in select * from jsonb_each(changes) loop
 if tbl not in('profiles','courses','modules','lessons','groups','enrollments','releases','extras') then raise exception 'FORBIDDEN';end if;
 for row in select value from jsonb_array_elements(rows) loop
 d=row->'data';rid=row->>'id';execute format('select data from public.%I where id=$1 for update',tbl) into old using rid;
 if tbl in('profiles','groups','enrollments') and role<>'admin' then raise exception 'FORBIDDEN';end if;
 if tbl='profiles' then if rid=uid or d->>'role' not in('student','teacher','admin') or jsonb_typeof(d->'active')<>'boolean' then raise exception 'FORBIDDEN';end if;end if;
 if tbl='courses' then if old is not null and not private.manages(rid) or old is not null and d->>'teacherId'<>old->>'teacherId' or old is null and d->>'teacherId'<>uid then raise exception 'FORBIDDEN';end if;end if;
 if tbl='modules' then if not private.manages(d->>'courseId') or old is not null and old->>'courseId'<>d->>'courseId' then raise exception 'FORBIDDEN';end if;end if;
 if tbl='lessons' then select course_id into cid from public.modules where id=d->>'moduleId';if not private.manages(cid) or old is not null and old->>'moduleId'<>d->>'moduleId' then raise exception 'FORBIDDEN';end if;
 if old is not null and(d->>'version')::int<>(old->>'version')::int+1 or old is null and(d->>'version')::int<>1 then raise exception 'LESSON_CHANGED';end if;
 if(d->>'attemptLimit')::int not between 1 and 20 or(d->>'minutes')::int not between 1 and 180 or jsonb_array_length(d->'blocks')>60 then raise exception 'INVALID_LESSON';end if;
 keys=row->'keys';ids=array[]::text[];
 for b in select value from jsonb_array_elements(d->'blocks') loop
 if b->>'type' not in('text','image','audio','video','choice','gap','writing') or b->>'id'=any(ids) then raise exception 'INVALID_BLOCK';end if;ids=array_append(ids,b->>'id');
 if b ? 'points' and(b->>'points')::int not between 1 and 100 then raise exception 'INVALID_BLOCK';end if;
 if(d->>'published')::boolean then
 if btrim(coalesce(d->'title'->>'ru',''))='' or btrim(coalesce(d->'title'->>'kk',''))='' or btrim(coalesce(b->>'title',''))='' then raise exception 'LESSON_INCOMPLETE';end if;
 if b->>'type' in('choice','gap') and(coalesce(jsonb_array_length(keys->(b->>'id')->'accepted'),0)=0 or exists(select 1 from jsonb_array_elements_text(keys->(b->>'id')->'accepted') x where btrim(x)='')) then raise exception 'ANSWER_KEY';end if;
 if b->>'type'='choice' and(coalesce(jsonb_array_length(b->'options'),0)<2 or exists(select 1 from jsonb_array_elements_text(keys->(b->>'id')->'accepted') x where not(b->'options' ? x))) then raise exception 'CHOICE_KEY';end if;
 if b->>'type' in('image','audio','video') and btrim(coalesce(b->>'url',''))='' then raise exception 'MEDIA_REQUIRED';end if;end if;end loop;
 if(d->>'published')::boolean and jsonb_array_length(d->'blocks')=0 then raise exception 'LESSON_INCOMPLETE';end if;end if;
 if tbl='groups' then if not exists(select 1 from public.profiles where id=d->>'teacherId' and data->>'role' in('teacher','admin')) or exists(select 1 from jsonb_array_elements_text(d->'studentIds') x where not exists(select 1 from public.profiles where id=x and data->>'role'='student')) then raise exception 'INVALID_MEMBERS';end if;end if;
 if tbl='releases' then if coalesce((row->>'delete')::boolean,false) then d=old;end if;if not private.manages(private.lesson_course(d->>'lessonId')) or not exists(select 1 from public.groups g where id=d->>'groupId' and(role='admin' or teacher_id=uid)) or not exists(select 1 from public.enrollments where group_id=d->>'groupId' and course_id=private.lesson_course(d->>'lessonId')) then raise exception 'FORBIDDEN';end if;end if;
 if tbl='extras' then if not private.manages(private.lesson_course(d->>'lessonId')) or not private.manages_student(d->>'studentId') then raise exception 'FORBIDDEN';end if;if old is not null and(old->>'lessonId'<>d->>'lessonId' or old->>'studentId'<>d->>'studentId') then raise exception 'FORBIDDEN';end if;end if;
 if coalesce((row->>'delete')::boolean,false) then if tbl<>'releases' then raise exception 'FORBIDDEN';end if;delete from public.releases where id=rid;
 else execute format('insert into public.%I(id,data) values($1,$2) on conflict(id) do update set data=excluded.data',tbl) using rid,d;if tbl='lessons' then insert into public.answer_keys(lesson_id,keys)values(rid,keys) on conflict(lesson_id)do update set keys=excluded.keys;end if;end if;
 end loop;end loop;
 end$$;
create function public.save_entities(changes jsonb) returns void language sql security invoker set search_path='' as $$select private.save_entities(changes)$$;
revoke all on all functions in schema private from public,anon;grant execute on all functions in schema private to authenticated;
revoke all on function public.lesson_catalog(),public.save_draft(jsonb),public.submit_attempt(jsonb),public.review_attempt(jsonb),public.save_entities(jsonb) from public,anon;
grant execute on function public.lesson_catalog(),public.save_draft(jsonb),public.submit_attempt(jsonb),public.review_attempt(jsonb),public.save_entities(jsonb) to authenticated;
grant all on all tables in schema public to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('lesson-media','lesson-media',false,10485760,array['image/png','image/jpeg','image/webp','audio/mpeg','audio/wav','audio/ogg','audio/mp4']);
create policy lesson_media_read on storage.objects for select to authenticated using(bucket_id='lesson-media' and private.can_open((storage.foldername(name))[1]));
create policy lesson_media_upload on storage.objects for insert to authenticated with check(bucket_id='lesson-media' and private.role() in('teacher','admin') and (owner_id=auth.uid()::text));
