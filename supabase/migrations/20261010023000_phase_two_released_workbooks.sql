-- ACA Phase Two independent study workbook, based on the Phase One navigation/autosave pattern.
-- No Phase One tables, lesson release windows, payments or course activation modified.
create table if not exists public.aca_phase_two_workbook_definitions (
  journey_number integer primary key check (journey_number between 1 and 6),
  content jsonb not null check (jsonb_typeof(content)='object'),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
create table if not exists public.aca_phase_two_workbook_responses (
  enrollment_id uuid not null,
  learner_id uuid not null,
  journey_number integer not null check(journey_number between 1 and 6),
  answers jsonb not null default '{}'::jsonb check(jsonb_typeof(answers)='object'),
  last_page integer not null check(last_page between 1 and 6),
  revision integer not null default 0 check(revision >= 0),
  updated_at timestamptz not null default now(),
  primary key(enrollment_id,journey_number),
  constraint phase_two_workbook_member_fk foreign key(enrollment_id,learner_id)
    references public.aca_phase_two_memberships(enrollment_id,learner_id)
);
alter table public.aca_phase_two_workbook_definitions enable row level security;
alter table public.aca_phase_two_workbook_responses enable row level security;
revoke all on public.aca_phase_two_workbook_definitions, public.aca_phase_two_workbook_responses from public,anon,authenticated;
grant select on public.aca_phase_two_workbook_responses to authenticated;
create policy aca_phase_two_workbook_own_read
  on public.aca_phase_two_workbook_responses for select to authenticated
  using(learner_id=(select auth.uid()) or (select public.is_aca_curriculum_owner()));

-- Workbook reading must not open or extend a teaching session.
-- Future content never reaches the learner browser, even if page IDs are guessed.
create or replace function public.get_aca_phase_two_workbook(
  p_enrollment_id uuid, p_journey integer
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner boolean := coalesce((select public.is_aca_curriculum_owner()),false);
  v_def jsonb;
  v_allowed integer[] := '{}'::integer[];
  v_visible jsonb;
  v_saved public.aca_phase_two_workbook_responses%rowtype;
  v_fields text[] := '{}'::text[];
  v_answers jsonb;
  v_scope text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_journey not between 1 and 6 then raise exception 'Invalid journey'; end if;
  select d.content into v_def from public.aca_phase_two_workbook_definitions d where d.journey_number=p_journey;
  if not found then raise exception 'This workbook is being prepared'; end if;

  if p_enrollment_id is null and v_owner then
    select coalesce(array_agg((page->>'number')::int order by (page->>'number')::int),'{}'::int[])
      into v_allowed from jsonb_array_elements(v_def->'pages') page;
    v_scope := 'owner-review';
  else
    if p_enrollment_id is null then raise exception 'Enrollment required'; end if;
    if not exists (
      select 1 from public.aca_phase_two_memberships m
      join public.enrollments e on e.id=m.enrollment_id and e.learner_id=m.learner_id and e.course_id=m.course_id
      join public.courses c on c.id=e.course_id
      join public.aca_phase_two_cohorts coh on coh.id=m.cohort_id and coh.course_id=c.id
      where m.enrollment_id=p_enrollment_id and m.learner_id=v_uid
        and e.status in ('active','completed')
        and c.status='published' and c.code='phase-two-ai-professional-builder'
        and coh.status in ('active','closed')
        and coalesce(e.starts_at,e.enrolled_at)<=now()
        and coh.starts_monday is not null and coh.iana_timezone is not null
        and coh.release_local_time is not null
    ) then raise exception 'Workbook access requires your authorized Phase Two enrollment'; end if;
    select coalesce(array_agg((page->>'number')::integer order by (page->>'number')::integer),'{}'::integer[])
      into v_allowed
    from jsonb_array_elements(v_def->'pages') page
    join public.lessons l on l.page_id = p_journey::text || '.' || page->>'number'
    join public.course_journeys j on j.id=l.journey_id and j.journey_number=p_journey and j.status='published'
    join public.aca_phase_two_memberships m on m.enrollment_id=p_enrollment_id and m.course_id=l.course_id
    join public.aca_phase_two_cohorts coh on coh.id=m.cohort_id
    where l.status='published'
      and ((coh.starts_monday + ((p_journey-1)*7 + (page->>'number')::int-1))::timestamp
          + coh.release_local_time) at time zone coh.iana_timezone <= now();
    v_scope := v_uid::text;
    select * into v_saved from public.aca_phase_two_workbook_responses
      where enrollment_id=p_enrollment_id and learner_id=v_uid and journey_number=p_journey;
  end if;
  if cardinality(v_allowed)=0 then raise exception 'This workbook has no released lessons yet'; end if;
  select coalesce(jsonb_agg(page order by (page->>'number')::integer),'[]'::jsonb)
    into v_visible from jsonb_array_elements(v_def->'pages') page
    where (page->>'number')::integer=any(v_allowed);
  select coalesce(array_agg(block->>'id'),'{}'::text[]) into v_fields
    from jsonb_array_elements(v_visible) page,
         lateral jsonb_array_elements(page->'blocks') block
    where block->>'type'='field';
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into v_answers
    from jsonb_each(coalesce(v_saved.answers,'{}'::jsonb)) where key=any(v_fields);
  return jsonb_build_object(
    'answers',v_answers,'last_page',case when v_saved.last_page=any(v_allowed) then v_saved.last_page else v_allowed[1] end,
    'revision',coalesce(v_saved.revision,0),
    'updated_at',v_saved.updated_at,
    'allowedPages',to_jsonb(v_allowed),'scope',v_scope,
    'workbook',jsonb_set(v_def,'{pages}',v_visible)
  );
end;
$$;
revoke all on function public.get_aca_phase_two_workbook(uuid,integer) from public,anon,authenticated;
grant execute on function public.get_aca_phase_two_workbook(uuid,integer) to authenticated;

create or replace function public.save_aca_phase_two_workbook(
  p_enrollment_id uuid,p_journey integer,p_page integer,
  p_base_revision integer,p_answers jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_read jsonb;
  v_fields text[] := '{}'::text[];
  v_key text;
  v_value jsonb;
  v_record public.aca_phase_two_workbook_responses%rowtype;
begin
  if v_uid is null or p_enrollment_id is null then raise exception 'Enrollment required'; end if;
  if p_base_revision is null or p_base_revision<0 or jsonb_typeof(p_answers) is distinct from 'object'
     or octet_length(p_answers::text)>48000 then
    raise exception 'Invalid workbook revision or answer format';
  end if;
  v_read := public.get_aca_phase_two_workbook(p_enrollment_id,p_journey);
  if not (p_page=any(select array_agg(value::integer) from jsonb_array_elements_text(v_read->'allowedPages'))) then
    raise exception 'This workbook lesson has not been released';
  end if;
  select coalesce(array_agg(block->>'id'),'{}'::text[]) into v_fields
    from jsonb_array_elements(v_read->'workbook'->'pages') page,
         lateral jsonb_array_elements(page->'blocks') block
    where block->>'type'='field';
  for v_key,v_value in select key,value from jsonb_each(p_answers) loop
    if not (v_key=any(v_fields)) or jsonb_typeof(v_value)<>'string'
       or length(v_value #>> '{}')>4000 then
      raise exception 'The workbook answer is invalid or not released';
    end if;
  end loop;
  insert into public.aca_phase_two_workbook_responses
    (enrollment_id,learner_id,journey_number,last_page)
    values (p_enrollment_id,v_uid,p_journey,p_page)
    on conflict(enrollment_id,journey_number) do nothing;
  select * into v_record from public.aca_phase_two_workbook_responses
    where enrollment_id=p_enrollment_id and learner_id=v_uid and journey_number=p_journey for update;
  if not found or v_record.revision<>p_base_revision then raise exception 'Workbook changed in another session; reload before saving'; end if;
  update public.aca_phase_two_workbook_responses
    set answers=answers||p_answers,last_page=p_page,
        revision=revision+1,updated_at=now()
    where enrollment_id=p_enrollment_id and journey_number=p_journey and learner_id=v_uid
    returning * into v_record;
  return jsonb_build_object('saved_version',v_record.revision,'saved_at',v_record.updated_at);
end;
$$;
revoke all on function public.save_aca_phase_two_workbook(uuid,integer,integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_aca_phase_two_workbook(uuid,integer,integer,integer,jsonb) to authenticated;

-- Initial produced lessons only; future workbook content is added only after production.
insert into public.aca_phase_two_workbook_definitions(journey_number,content,version) values
(1,'{"key":"phase-two-journey-one","version":1,"title":"AI Confidence Academy · Phase Two Journey 1 Workbook","navigationLabel":"Journey 1 · AI Strategy and Business Opportunity","subtitle":"Permanent study, practice, and evidence companion. Released lessons only.","pageCount":6,"pages":[{"number":1,"lesson_id":"1.1","kicker":"JOURNEY ONE  /  LESSON 1.1","title":"Professional AI Judgment and Direction","blocks":[{"type":"heading","text":"The professional difference"},{"type":"text","text":"A polished AI-generated result is not automatically reliable. Professional capability means directing a useful task, checking its important claims, and explaining why the final result can be used. In Phase Two, every claim about your ability should connect to evidence you can actually show."},{"type":"text","text":"Four responsibilities remain human: purpose determines what the task must accomplish and whom it serves; context supplies authorized facts, constraints, and permissions; judgment tests whether the output meets the purpose and whether its claims are supported; accountability names the person who can approve, correct, pause, or reject the work. AI can help organize, compare, or draft. It does not inherit decision authority."},{"type":"note","title":"Study reminder","text":"AI assists. Humans verify. Name the person and outcome first. Do not confuse the speed or appearance of an AI result with dependable professional work.","theme":"gold"},{"type":"heading","text":"Fictional report: read the source"},{"type":"text","text":"Training record: 42 service requests were received; 36 were marked resolved. No response-time record and no prior-week comparison were supplied. The claim that 95% were resolved on time is not supported. The claim that performance improved is also unsupported. A dependable report preserves the verified counts and identifies what cannot be established."},{"type":"field","id":"p2-j1-1-capability","label":"Describe one professional AI capability you can demonstrate. What work sample supports it?","hint":"Give a specific action and its evidence; do not invent experience.","lines":4},{"type":"field","id":"p2-j1-1-five","label":"List five capabilities you can demonstrate and one source of evidence for each.","hint":"These are professional actions, not five product names.","lines":6},{"type":"field","id":"p2-j1-1-gaps","label":"Identify two capabilities or knowledge areas requiring development.","hint":"What practice or proof would be needed?","lines":3},{"type":"heading","text":"Try it in your own AI tool"},{"type":"text","text":"Open a general AI assistant or an approved business tool on your phone, tablet, or computer. Enter only fictional or sanitized notes. Ask it to make a short report from the 42/36 record, with no invented timing or comparison. Review the output against the record; challenge unsupported claims and request a corrected version."},{"type":"note","title":"Copyable AI request","text":"Write a short professional weekly service report using only this FICTIONAL record: 42 requests were received and 36 were marked resolved. We have no completion-time data and no comparison with an earlier period. Do not invent on-time performance or improvement. State clearly what cannot be established.","theme":"gold"},{"type":"field","id":"p2-j1-1-correction","label":"What unsupported claim did you identify, and how did you revise or withhold it?","hint":"Use the fictional record; distinguish the source from what the model suggested.","lines":4},{"type":"heading","text":"My human–AI responsibility map"},{"type":"field","id":"p2-j1-1-purpose","label":"Who is served by your recurring task? What would a useful result mean?","hint":"","lines":3},{"type":"field","id":"p2-j1-1-map","label":"Record human purpose, permitted AI support, evidence/review, final decision owner and stop condition.","hint":"Include the point where over-delegation would be unsafe.","lines":6},{"type":"field","id":"p2-j1-1-check","label":"Explain why a convincing AI report does not prove its own figures.","hint":"Name one decision that remains human.","lines":4},{"type":"note","title":"Carry the work forward","text":"Keep these answers. Lesson 1.2 will use the same person, recurring task, and project to investigate a need before choosing a tool. The continuing Project Record remains separate from this study workbook.","theme":"gold"}]},{"number":2,"lesson_id":"1.2","kicker":"JOURNEY ONE  /  LESSON 1.2","title":"Find the Need and Establish the Evidence","blocks":[{"type":"heading","text":"Begin with the person, not the product"},{"type":"text","text":"A symptom is the visible difficulty: staff repeatedly answer a question, a customer cannot find a next step, or a team keeps correcting a report. A possible cause explains why the difficulty appears. Do not treat a plausible explanation as a proven diagnosis. Naming an AI chatbot before confirming the underlying need can lead to solving the wrong problem."},{"type":"text","text":"Use the Audience-Need View: Person — who is trying to accomplish something? Situation — when and where does the need occur? Need — what result do they require? Barrier — what prevents progress? Desired result — what would success enable them to do? Describe a useful result without prescribing AI software."},{"type":"note","title":"Fictional service desk example","text":"Employees report repeated customer questions. Possibility A: approved product information is hard to find. Possibility B: policy versions conflict. Possibility C: incoming questions are routed poorly. Each hypothesis needs a different authorized check. A corrected reference sheet might work better than a chatbot.","theme":"gold"},{"type":"heading","text":"What counts as evidence?"},{"type":"text","text":"Observed facts are supported by a record or an inspection. Reported experiences are what an identified person said they encountered; they do not establish everyone''s preference. Assumptions need testing. Simulations, including this example, are for practice only. AI suggestions and imaginary interviews do not prove customer demand. Preserve the distinction in your notes."},{"type":"heading","text":"Compare three possible needs"},{"type":"field","id":"p2-j1-2-first","label":"Possible need 1: affected person, symptom, possible cause, evidence source/type and unanswered question.","hint":"Mark uncertainty explicitly.","lines":5},{"type":"field","id":"p2-j1-2-second","label":"Possible need 2: affected person, symptom, possible cause, evidence source/type and unanswered question.","hint":"This should be meaningfully different from Need 1.","lines":5},{"type":"field","id":"p2-j1-2-third","label":"Possible need 3: affected person, symptom, possible cause, evidence source/type and unanswered question.","hint":"Do not present assumptions as observation.","lines":5},{"type":"heading","text":"Practice with your own AI assistant"},{"type":"text","text":"Take the three sanitized possibilities to ChatGPT or another chosen AI tool. Ask it to distinguish symptoms, possible causes and assumptions, and to draft five neutral questions. Inspect its wording: remove leading questions, unsupported promises, invented interview findings or assumed demand."},{"type":"note","title":"Copyable AI request","text":"Help distinguish symptoms, possible causes and assumptions in these notes. Suggest five neutral questions to test the need. Do not present audience preferences as established facts. Notes: [sanitized project notes].","theme":"gold"},{"type":"field","id":"p2-j1-2-questions","label":"Write your five revised neutral stakeholder or evidence-review questions.","hint":"Avoid: Would you prefer our chatbot? Prefer: Where do you currently find the approved answer?","lines":6},{"type":"field","id":"p2-j1-2-ai-review","label":"What did you change or reject from the AI suggestions?","hint":"Identify at least one leading assumption or missing source.","lines":4},{"type":"heading","text":"Choose provisionally"},{"type":"field","id":"p2-j1-2-audience","label":"Record the person, situation, need, barrier and desired result for your chosen need.","hint":"No tool selection required.","lines":5},{"type":"field","id":"p2-j1-2-source","label":"What observation, authorized conversation or reliable source could verify this need?","hint":"If not yet collected, record what must be requested.","lines":4},{"type":"field","id":"p2-j1-2-reverse","label":"What additional evidence would change your selection?","hint":"State an explicit test that could disprove your current hypothesis.","lines":4},{"type":"field","id":"p2-j1-2-check","label":"Why doesn''t an AI-generated proposal or a suggested chatbot prove this problem exists?","hint":"Connect your answer to actual evidence and human responsibility.","lines":4},{"type":"note","title":"Carry the work forward","text":"Update the same continuing Project Record with your selected need, evidence, uncertainty, five questions and change-of-mind condition. Use this workbook as a permanent study aid; it is not a substitute for the Project Record.","theme":"gold"}]}]}'::jsonb,1)
on conflict (journey_number) do update set content=excluded.content,version=excluded.version,updated_at=now();
