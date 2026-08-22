-- KidSkill Connect — a trainer can see the children they actually teach.
--
-- `children_owner` in 0001 restricts the table to the parent and the admin. That is the
-- right default, but it left the trainer unable to read the name of the child standing
-- in front of them: the Today screen and the enquiry inbox both rendered an em dash
-- where a name should be.
--
-- The fix has to widen access without turning into the thing the spec explicitly rules
-- out — a trainer-side feed of children. So visibility is not granted to trainers as a
-- role; it is granted per child, and only where the *parent* has already created the
-- relationship by sending an enquiry or by having an enrollment. A trainer with no
-- connection to a child still sees nothing, and there is no query they can write that
-- returns a list of children in general.
--
-- Withdrawn and declined enquiries are excluded on purpose: if a parent withdraws, or
-- the trainer says no, the disclosure ends with it.

create policy children_engaged_trainer on public.children for select
  using (
    exists (
      select 1 from public.enrollments e
       where e.child_id = children.id
         and e.trainer_id = auth.uid()
    )
    or exists (
      select 1 from public.enquiries q
       where q.child_id = children.id
         and q.trainer_id = auth.uid()
         and q.status in ('open', 'accepted')
    )
  );
