drop policy enrollments_read on public.enrollments;
create policy enrollments_read on public.enrollments for select to authenticated using(private.manages(course_id) or (private.role()='student' and (student_id=auth.uid()::text or exists(select 1 from public.groups g where g.id=group_id and g.data->'studentIds' ? auth.uid()::text))));
