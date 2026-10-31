-- Focused Phase Two release, Saturday, DST and saved-work acceptance.
-- Test data and publication changes are transaction-local and always rolled back.
-- No external provider, email, browser session, production cohort or payment call.
-- Exact release assertions require a Monday-Saturday Asia/Bangkok execution date.
begin;
set local statement_timeout = '25s';
do $$
declare
  u uuid := gen_random_uuid(); stranger uuid := gen_random_uuid();
  e uuid := gen_random_uuid(); co uuid := gen_random_uuid(); c uuid; j uuid;
  weekday_lesson uuid; release_lesson uuid; saturday_lesson uuid;
  local_now timestamp := now() at time zone 'Asia/Bangkok';
  local_day integer := extract(isodow from now() at time zone 'Asia/Bangkok');
  cohort_monday date; released_monday date;
  ordinary_deadline timestamptz; weekend_deadline timestamptz;
  first_window record; result record; context_row record;
  workbook jsonb; field_id text; denied boolean;
begin
  assert local_day between 1 and 6, 'Run exact daily-release acceptance Monday-Saturday in Asia/Bangkok';
  assert local_now::time > time '00:00:02' and local_now::time < time '23:59:58', 'Avoid test fixture midnight rollover';
  cohort_monday := date_trunc('week',local_now)::date;
  released_monday := cohort_monday - case when local_day < 5 then 7 else 0 end;
  select id into strict c from public.courses where code='phase-two-ai-professional-builder';
  select id into strict j from public.course_journeys where course_id=c and journey_number=1;
  select id into strict weekday_lesson from public.lessons where course_id=c and page_id='1.5';
  select id into strict saturday_lesson from public.lessons where course_id=c and page_id='1.6';
  select id into strict release_lesson from public.lessons where course_id=c and page_id='1.'||local_day;

  insert into auth.users(id,email,raw_user_meta_data) values
    (u,'aca-p2-timing-'||u||'@example.com','{}'),
    (stranger,'aca-p2-timing-'||stranger||'@example.com','{}');
  insert into public.profiles(id,account_status) values(u,'active'),(stranger,'active') on conflict(id) do nothing;
  -- MVCC keeps these unpublished production records unchanged for other sessions.
  update public.courses set status='published' where id=c;
  update public.course_journeys set status='published' where id=j;
  update public.lessons set status='published' where id in (weekday_lesson,saturday_lesson,release_lesson);
  insert into public.enrollments(id,learner_id,course_id,status,enrolled_at,starts_at,access_expires_at)
    values(e,u,c,'active',now()-interval '60 days',now()-interval '60 days',now()+interval '42 days');
  insert into public.aca_phase_two_cohorts(id,course_id,cohort_code,starts_monday,iana_timezone,release_local_time,status)
    values(co,c,'p2-timing-acceptance-'||co,released_monday,'Asia/Bangkok','00:00','active');
  insert into public.aca_phase_two_memberships(enrollment_id,learner_id,course_id,cohort_id) values(e,u,c,co);
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);

  execute 'set local role authenticated';
  select * into strict result from public.aca_phase_two_access_status(e,weekday_lesson);
  assert result.access_status='available','Ordinary released lesson waits for first opening';
  select closes_at,remaining_seconds into strict result from public.open_aca_phase_two_lesson(e,weekday_lesson);
  ordinary_deadline := result.closes_at;
  assert ordinary_deadline=now()+interval '2 hours' and result.remaining_seconds=7200,'Ordinary first opening receives exactly two hours';
  select closes_at into strict result from public.open_aca_phase_two_lesson(e,weekday_lesson);
  assert result.closes_at=ordinary_deadline,'Reopening cannot restart the two-hour allocation';

  workbook := public.get_aca_phase_two_workbook(e,1);
  select block->>'id' into strict field_id
    from jsonb_array_elements(workbook->'workbook'->'pages') page,
         lateral jsonb_array_elements(page->'blocks') block
    where page->>'number'='5' and block->>'type'='field' limit 1;
  perform public.save_aca_phase_two_workbook(e,1,5,0,jsonb_build_object(field_id,'ACA timing acceptance before expiry'));
  perform public.save_aca_phase_two_project(e,'A','ACA timing acceptance',
    '{"timingAcceptance":{"original":"Saved before expiry","revised":"Initial revision"}}'::jsonb,null);
  execute 'reset role';
  select first_opened_at,deadline_at into strict first_window from public.aca_phase_two_lesson_windows
    where enrollment_id=e and lesson_id=weekday_lesson;
  assert first_window.deadline_at-first_window.first_opened_at=interval '2 hours','Stored window matches the returned two-hour deadline';
  update public.aca_phase_two_lesson_windows
    set first_opened_at=now()-interval '2 hours',deadline_at=now()
    where enrollment_id=e and lesson_id=weekday_lesson;
  execute 'set local role authenticated';
  select * into strict result from public.aca_phase_two_access_status(e,weekday_lesson);
  assert result.access_status='closed' and result.remaining_seconds=0,'Ordinary lesson closes at its exact deadline';
  denied:=false;
  begin perform closes_at from public.open_aca_phase_two_lesson(e,weekday_lesson);
  exception when raise_exception then denied:=true; end;
  assert denied,'Expired lesson cannot reopen';
  workbook := public.get_aca_phase_two_workbook(e,1);
  assert workbook->'answers'->>field_id='ACA timing acceptance before expiry','Workbook retains the saved answer after lesson expiry';
  perform public.save_aca_phase_two_workbook(e,1,5,1,jsonb_build_object(field_id,'ACA timing acceptance after expiry'));
  workbook := public.get_aca_phase_two_workbook(e,1);
  assert workbook->'answers'->>field_id='ACA timing acceptance after expiry','Released workbook can still be saved after lesson expiry';
  perform public.save_aca_phase_two_project(e,'A','ACA timing acceptance',
    '{"timingAcceptance":{"revised":"Revised after lesson expiry"}}'::jsonb,null);
  assert (select sections->'timingAcceptance'->>'original'='Saved before expiry'
    and sections->'timingAcceptance'->>'revised'='Revised after lesson expiry'
    and version_number=2 from public.aca_phase_two_project_records where enrollment_id=e),
    'Project revision preserves original work after lesson expiry';
  execute 'reset role';

  -- Future, exact and already-released states use the same current transaction clock.
  update public.aca_phase_two_cohorts set starts_monday=cohort_monday,
    release_local_time=(local_now+interval '1 second')::time where id=co;
  execute 'set local role authenticated';
  select * into strict result from public.aca_phase_two_access_status(e,release_lesson);
  assert result.access_status='scheduled' and result.released_at=now()+interval '1 second','One second before release remains scheduled';
  denied:=false;
  begin perform closes_at from public.open_aca_phase_two_lesson(e,release_lesson);
  exception when raise_exception then denied:=true; end;
  assert denied,'Scheduled lesson cannot open early';
  denied:=false;
  begin perform public.save_aca_phase_two_workbook(e,1,local_day,2,'{}'::jsonb);
  exception when raise_exception then denied:=true; end;
  assert denied,'Unreleased workbook page cannot be saved early';
  execute 'reset role';
  update public.aca_phase_two_cohorts set release_local_time=local_now::time where id=co;
  execute 'set local role authenticated';
  select * into strict result from public.aca_phase_two_access_status(e,release_lesson);
  assert result.released_at=now() and result.access_status in ('available','active','closed'),
    'At the exact local release instant the lesson is no longer scheduled';
  -- A prior closed ordinary fixture stays closed; release must not reset its clock.
  if release_lesson=weekday_lesson then
    assert result.access_status='closed','Release equality does not reset a previous first-open deadline';
  else
    select closes_at into strict result from public.open_aca_phase_two_lesson(e,release_lesson);
    assert result.closes_at is not null,'An unexpired lesson opens at the exact release instant';
  end if;
  workbook := public.get_aca_phase_two_workbook(e,1);
  assert (workbook->'allowedPages') @> jsonb_build_array(local_day),'Workbook releases at the same exact instant';
  execute 'reset role';
  update public.aca_phase_two_cohorts set release_local_time=(local_now-interval '1 second')::time where id=co;
  execute 'set local role authenticated';
  select * into strict result from public.aca_phase_two_access_status(e,release_lesson);
  assert result.released_at=now()-interval '1 second' and result.access_status<>'scheduled','One second after release is available under the existing lesson deadline';
  execute 'reset role';

  -- Fixed historical/future date fixtures test IANA conversion, not a launch choice.
  update public.aca_phase_two_cohorts set starts_monday='2026-10-26',iana_timezone='America/New_York',release_local_time='09:00' where id=co;
  select * into strict context_row from private.aca_phase_two_lesson_context(e,saturday_lesson);
  assert context_row.released_at=timestamptz '2026-10-31 13:00Z' and context_row.weekend_ends_at=timestamptz '2026-11-02 05:00Z'
    and context_row.weekend_ends_at-context_row.released_at=interval '40 hours','New York fall-back Saturday keeps Sunday access through local Monday midnight';
  update public.aca_phase_two_cohorts set iana_timezone='America/Los_Angeles' where id=co;
  select * into strict context_row from private.aca_phase_two_lesson_context(e,saturday_lesson);
  assert context_row.released_at=timestamptz '2026-10-31 16:00Z' and context_row.weekend_ends_at=timestamptz '2026-11-02 08:00Z'
    and context_row.weekend_ends_at-context_row.released_at=interval '40 hours','Los Angeles fall-back Saturday keeps local Monday midnight';
  update public.aca_phase_two_cohorts set iana_timezone='Asia/Bangkok' where id=co;
  select * into strict context_row from private.aca_phase_two_lesson_context(e,saturday_lesson);
  assert context_row.released_at=timestamptz '2026-10-31 02:00Z' and context_row.weekend_ends_at=timestamptz '2026-11-01 17:00Z'
    and context_row.weekend_ends_at-context_row.released_at=interval '39 hours','Bangkok Saturday uses its own local Monday boundary without DST';

  -- Exercise the naturally current weekend when the script is run Saturday.
  update public.aca_phase_two_cohorts set starts_monday=cohort_monday,iana_timezone='Asia/Bangkok',release_local_time='00:00' where id=co;
  weekend_deadline := ((cohort_monday+7)::timestamp at time zone 'Asia/Bangkok');
  execute 'set local role authenticated';
  select * into strict result from public.aca_phase_two_access_status(e,saturday_lesson);
  if local_day=6 then
    assert result.access_status='active' and result.deadline_at=weekend_deadline and result.remaining_seconds>7200,
      'Current Saturday receives the approved extended weekend rather than an ordinary two-hour window';
    select closes_at into strict result from public.open_aca_phase_two_lesson(e,saturday_lesson);
    assert result.closes_at=weekend_deadline,'Saturday opening keeps the same local Monday deadline';
  else
    assert result.access_status='scheduled','Before Saturday its extended window remains scheduled';
  end if;
  execute 'reset role';
  if local_day=6 then
    assert not exists(select 1 from public.aca_phase_two_lesson_windows where enrollment_id=e and lesson_id=saturday_lesson),
      'Saturday opening does not create an ordinary first-open window';
  end if;
  update public.aca_phase_two_cohorts set starts_monday=cohort_monday-7 where id=co;
  execute 'set local role authenticated';
  select * into strict result from public.aca_phase_two_access_status(e,saturday_lesson);
  assert result.access_status='closed' and result.remaining_seconds=0,'A past weekend window is closed';
  denied:=false;
  begin perform closes_at from public.open_aca_phase_two_lesson(e,saturday_lesson);
  exception when raise_exception then denied:=true; end;
  assert denied,'An ended Saturday window cannot reopen';
  workbook := public.get_aca_phase_two_workbook(e,1);
  assert workbook->'answers'->>field_id='ACA timing acceptance after expiry','Saved workbook survives both ordinary and weekend closure';
  execute 'reset role';

  perform set_config('request.jwt.claim.sub',stranger::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',stranger,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  denied:=false;
  begin perform public.get_aca_phase_two_workbook(e,1);
  exception when raise_exception then denied:=true; end;
  assert denied,'Another learner cannot read saved workbook data';
  assert not exists(select 1 from public.aca_phase_two_project_records where enrollment_id=e),
    'Actual learner RLS hides the other learner project';
  execute 'reset role';
end $$;
rollback;
select 'Phase Two release equality, ordinary expiry/reopen, Saturday extension, IANA DST mapping, workbook/project retention and learner isolation acceptance passed; transaction rolled back.' as result;
