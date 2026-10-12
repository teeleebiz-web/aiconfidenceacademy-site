-- Install only existing protected Lesson 2.5 and append its Journey Two workbook page.
begin;
do $install25$
declare changed integer;
begin
 update public.lessons
 set content=jsonb_set(content,'{phase_two_production}',$lesson25${
  "production_version": "2.5-owner-review-2026-10-10",
  "approval_status": "founder_review_not_published",
  "curriculum_version": "2.0",
  "lesson_id": "2.5",
  "primary_media": "audio",
  "title": "Build a bounded working prototype",
  "learner_promise": "Build one complete narrow working sample, run a realistic normal case, lead a material revision, and save a demonstration supported by actual before-and-after evidence.",
  "pacing": [
    {
      "key": "teaching",
      "label": "Bound the working path and use BUILD",
      "minutes": 15
    },
    {
      "key": "worked_case",
      "label": "Fictional proposal outline and human review",
      "minutes": 10
    },
    {
      "key": "application",
      "label": "Baseline, actual normal run and material revision",
      "minutes": 25
    },
    {
      "key": "verification",
      "label": "Demonstrate, inspect and save the artifact",
      "minutes": 10
    }
  ],
  "outcomes": [
    "Define authorized input, expected result, review owner and completion signal for a narrow path.",
    "Use the BUILD Evidence Cycle: baseline, use AI, inspect, lead and demonstrate.",
    "Preserve a working artifact, exact request, input and actual output.",
    "Test a realistic normal case against acceptance criteria defined before the run.",
    "Make one material revision and compare actual before-and-after results.",
    "Demonstrate the working prototype and explain its scope, retained human control and uncertainty."
  ],
  "teaching": [
    {
      "heading": "Bound one complete path",
      "paragraphs": [
        "A prototype is a working sample used to learn whether a concept is useful. Continue the charter, workflow map and bounded solution concept from earlier lessons. A prompt-supported document process, approved template, small knowledge assistant using approved material or authorized sandbox can be sufficient. Choose one path you can run from input to a human-reviewed result.",
        "Define the authorized input, expected result, review owner and completion signal. Write acceptance criteria before running the sample. Keep production accounts, customer actions and consequential transactions outside an unapproved experiment."
      ],
      "think_prompt": "What small but complete path can you run today, and how will the reviewer recognize completion?"
    },
    {
      "heading": "Baseline and use AI",
      "paragraphs": [
        "Use the BUILD Evidence Cycle: baseline, use AI, inspect, lead and demonstrate. Preserve a comparable current artifact using the same input and criteria. If none exists, create a small manual baseline and label it. Record observed starting results without inventing timing or performance claims.",
        "Create the working artifact: reusable request and output template, or material needed to reproduce an authorized sandbox run. Use your own AI assistant with the approved request and sanitized project context. Preserve the exact request actually used, input, tool, date and actual output. Teaching illustrations are separate from your observed run."
      ],
      "think_prompt": "Can another authorized reviewer access the artifact and see exactly what input and request produced the result?"
    },
    {
      "heading": "Inspect and lead a material revision",
      "paragraphs": [
        "Check each important output claim against the input and each acceptance criterion against the actual result. Record met, not met or uncertain with supporting evidence. Missing information must remain visible, and human ownership must be clear.",
        "Choose one material change that addresses a finding. Preserve the original artifact and output, revise the request or template, and run the same normal input again. Retain the revised artifact, exact request and actual output. Compare using the same criteria; make only improvement claims supported by those results."
      ],
      "think_prompt": "Which observed weakness does your revision address, and what actual evidence shows whether it helped?"
    },
    {
      "heading": "Demonstrate and preserve evidence",
      "paragraphs": [
        "Show the working artifact, normal input, revised result and human review point. Explain what the prototype does, what it does not do and what remains uncertain. A description alone does not satisfy completion. One normal case does not establish behavior under errors or exception paths.",
        "Check usability, factual support and ownership. Save the working artifact, baseline, test evidence, before-and-after revision and demonstration notes in the continuing Project Record. Label simulated inputs and results. Keep unresolved findings visible and retain earlier project evidence."
      ],
      "think_prompt": "Can you demonstrate the actual path while making the sample's limits and retained approval clear?"
    }
  ],
  "worked_case": {
    "label": "A proposal outline from fictional workshop specifications",
    "setup": "FICTIONAL TRAINING EXAMPLE: The supplied brief specifies twelve participants, one ninety-minute workshop and an editable handout. It supplies no approved price, delivery date or final scope confirmation. The prompt-supported prototype organizes an outline and highlights missing information. A proposal reviewer verifies scope and prices before any real proposal is issued. The before-and-after below is a scripted teaching illustration, not an observed learner or live AI run.",
    "evidence_table": [
      {
        "claim": "A polished outline is a completed proposal.",
        "evidence": "The brief provides participant count, duration and handout, but no approved price or date.",
        "action": "Retain the supplied specifications and mark price, date and scope confirmation as unresolved."
      },
      {
        "claim": "The first illustrated outline meets all criteria.",
        "evidence": "It retains the workshop facts and leaves fees unpriced, but omits a named reviewer and explicit draft status.",
        "action": "Record the omitted control point as a failed criterion; preserve the first output."
      },
      {
        "claim": "Changing the review section is a material revision.",
        "evidence": "The revised template requires a named scope-and-price reviewer and an explicit draft-awaiting-review status.",
        "action": "Run the same normal input again and check whether the actual revised output includes both requirements."
      },
      {
        "claim": "One improved normal case proves deployment readiness.",
        "evidence": "The sample covers one normal path; error and exception behavior remain uncertain.",
        "action": "Demonstrate the bounded result and carry the saved artifact into Lesson 2.6 for further testing."
      }
    ],
    "revised_example": "SCRIPTED FICTIONAL COMPARISON — Baseline: manual outline of the supplied workshop details. First illustrated output: 12 participants; 90-minute workshop; editable handout; fees unpriced; date unconfirmed; reviewer and draft status omitted. Material revision: require an owner/status review section. Revised illustrated output: DRAFT AWAITING REVIEW. Supplied scope: 12 participants, one 90-minute workshop, editable handout. Missing information: approved price, delivery date and final scope confirmation. Review owner: proposal reviewer, responsible for scope and price verification before issue. No real proposal is issued. Use this illustration to inspect your own actual run; it is not your test evidence.",
    "demonstration_steps": [
      "Define scope, input and acceptance criteria",
      "Preserve the baseline and actual normal run",
      "Lead and inspect one material revision",
      "Demonstrate the narrow path and save its limits"
    ],
    "question": "What does the working sample produce, what evidence supports the revision, and who verifies scope and prices before a real proposal can be issued?"
  },
  "application": [
    {
      "heading": "Bound the path and preserve the baseline",
      "minutes": 7,
      "instruction": "Continue your charter, map and support concept. Define one authorized path, normal input, criteria, review owner and completion signal. Preserve the same-task baseline. Create the first reusable working request/template or authorized sandbox artifact.",
      "evidence": "Bounded path, comparable baseline and reproducible working artifact."
    },
    {
      "heading": "Run and inspect the normal case",
      "minutes": 9,
      "instruction": "Use your own AI assistant with fictional or authorized material. Preserve the exact request actually used and actual output, with tool/date/input classification. Inspect every criterion and important fact against the input. Record the evidence for met, not met or uncertain findings.",
      "evidence": "Actual first-run request/input/output and criterion-level inspection."
    },
    {
      "heading": "Revise and run the same input again",
      "minutes": 9,
      "instruction": "Lead one material change that addresses a finding. Preserve both artifact versions. Run the same normal input using the revised request/template. Save the actual revised output and compare against the same criteria. Retain unresolved findings without inventing improvement.",
      "evidence": "Material revision, actual rerun and supported before-and-after comparison."
    }
  ],
  "approved_ai_request": "Help build a minimal working sample for this authorized scope using these inputs and acceptance criteria. Flag missing information and assumptions. Keep approval with me. Project: [charter and map].",
  "responsibility_map_fields": [
    "Authorized scope and excluded actions",
    "Normal input and expected result",
    "Acceptance criteria and completion signal",
    "Human review owner and approval",
    "Actual input, request and output",
    "Material revision and observed comparison",
    "Accessible artifact, demonstration and uncertainty"
  ],
  "verification": [
    {
      "heading": "Check usability, support and ownership",
      "minutes": 3,
      "prompt": "Can the reviewer access and follow the working artifact? Check factual support against the input, every acceptance criterion and the named human approval point."
    },
    {
      "heading": "Demonstrate the complete narrow path",
      "minutes": 4,
      "prompt": "Show the working artifact, actual normal input and revised output. Explain the steps used and the completion signal checked. State what the sample does, does not do and what remains uncertain. A description alone does not satisfy completion."
    },
    {
      "heading": "Save evidence and unresolved findings",
      "minutes": 3,
      "prompt": "Save the baseline, exact requests, actual outputs, material revision, comparison and demonstration. Label fictional/simulated material. Retain earlier evidence and carry unresolved findings into Lesson 2.6."
    }
  ],
  "completion_criteria": [
    "One complete narrow path with authorized input, expected result, review owner and completion signal",
    "Acceptance criteria defined before the run and comparable baseline preserved",
    "Accessible working artifact rather than only a future-system description",
    "Exact first-run request, normal input and actual output preserved with run context",
    "Factual support and criteria inspected with supporting evidence",
    "One material revision and actual rerun using the same normal input",
    "Before-and-after comparison tied to the same criteria, with unresolved findings retained",
    "Demonstration shows actual working steps and retained human control",
    "Fictional/simulated inputs and results labelled; no deployment approval inferred",
    "Working artifact and evidence saved alongside earlier project work"
  ],
  "handoff": "Carry your working artifact, baseline, normal-run evidence and material revision into Lesson 2.6: Test Errors and Exception Paths. The next lesson opens according to its release schedule.",
  "editorial_notes": {
    "status": "Founder-review draft; course, journey and lesson remain unpublished.",
    "media": "Same approved landscape instructor and voice, four guided teaching chapters and four narrated fictional demonstrations. Founder playback acceptance remains separate.",
    "source": "ACA_Phase_Two_Six_Week_Curriculum_Master.docx v2.0, October 4 2026, Lesson 2.5.",
    "example_data": "Workshop specifications, baseline and before-and-after proposal examples are scripted fictional teaching data. Learners preserve their own actual runs; no live account is connected or deployed."
  }
}$lesson25$::jsonb,true)
 where id='948a36bb-6bd0-4c85-8d25-f93333e9bd30'
 and course_id='3e4a092a-256f-4f09-ad1b-ce63b45319a7'
 and journey_id='c6bdc7b0-ba8c-481d-9d89-9d18d71d19bc'
 and page_id='2.5' and status='draft'
 and content->'phase_two'->>'source_version'='2.0'
 and not(content ? 'phase_two_production')
 and md5(content::text)='7262dd412b0dbfb39a7db3620dc4952a';
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'Lesson 2.5 target changed or production already exists'; end if;
 update public.aca_phase_two_workbook_definitions
 set content=jsonb_set(content,'{pages}',(content->'pages')||jsonb_build_array($workbook25${
  "number": 5,
  "lesson_id": "2.5",
  "kicker": "JOURNEY TWO / LESSON 2.5",
  "title": "Build a Bounded Working Prototype",
  "blocks": [
    {
      "type": "heading",
      "text": "Bound one complete path"
    },
    {
      "type": "text",
      "text": "A prototype is a working sample used to learn whether a concept is useful. Continue the charter, workflow map and bounded solution concept from earlier lessons. A prompt-supported document process, approved template, small knowledge assistant using approved material or authorized sandbox can be sufficient. Choose one path you can run from input to a human-reviewed result."
    },
    {
      "type": "text",
      "text": "Define the authorized input, expected result, review owner and completion signal. Write acceptance criteria before running the sample. Keep production accounts, customer actions and consequential transactions outside an unapproved experiment."
    },
    {
      "type": "heading",
      "text": "Baseline and use AI"
    },
    {
      "type": "text",
      "text": "Use the BUILD Evidence Cycle: baseline, use AI, inspect, lead and demonstrate. Preserve a comparable current artifact using the same input and criteria. If none exists, create a small manual baseline and label it. Record observed starting results without inventing timing or performance claims."
    },
    {
      "type": "text",
      "text": "Create the working artifact: reusable request and output template, or material needed to reproduce an authorized sandbox run. Use your own AI assistant with the approved request and sanitized project context. Preserve the exact request actually used, input, tool, date and actual output. Teaching illustrations are separate from your observed run."
    },
    {
      "type": "heading",
      "text": "Inspect and lead a material revision"
    },
    {
      "type": "text",
      "text": "Check each important output claim against the input and each acceptance criterion against the actual result. Record met, not met or uncertain with supporting evidence. Missing information must remain visible, and human ownership must be clear."
    },
    {
      "type": "text",
      "text": "Choose one material change that addresses a finding. Preserve the original artifact and output, revise the request or template, and run the same normal input again. Retain the revised artifact, exact request and actual output. Compare using the same criteria; make only improvement claims supported by those results."
    },
    {
      "type": "heading",
      "text": "Demonstrate and preserve evidence"
    },
    {
      "type": "text",
      "text": "Show the working artifact, normal input, revised result and human review point. Explain what the prototype does, what it does not do and what remains uncertain. A description alone does not satisfy completion. One normal case does not establish behavior under errors or exception paths."
    },
    {
      "type": "text",
      "text": "Check usability, factual support and ownership. Save the working artifact, baseline, test evidence, before-and-after revision and demonstration notes in the continuing Project Record. Label simulated inputs and results. Keep unresolved findings visible and retain earlier project evidence."
    },
    {
      "type": "heading",
      "text": "A proposal outline from fictional workshop specifications"
    },
    {
      "type": "text",
      "text": "FICTIONAL TRAINING EXAMPLE: The supplied brief specifies twelve participants, one ninety-minute workshop and an editable handout. It supplies no approved price, delivery date or final scope confirmation. The prompt-supported prototype organizes an outline and highlights missing information. A proposal reviewer verifies scope and prices before any real proposal is issued. The before-and-after below is a scripted teaching illustration, not an observed learner or live AI run."
    },
    {
      "type": "note",
      "theme": "gold",
      "title": "Fictional before-and-after illustration",
      "text": "SCRIPTED FICTIONAL COMPARISON — Baseline: manual outline of the supplied workshop details. First illustrated output: 12 participants; 90-minute workshop; editable handout; fees unpriced; date unconfirmed; reviewer and draft status omitted. Material revision: require an owner/status review section. Revised illustrated output: DRAFT AWAITING REVIEW. Supplied scope: 12 participants, one 90-minute workshop, editable handout. Missing information: approved price, delivery date and final scope confirmation. Review owner: proposal reviewer, responsible for scope and price verification before issue. No real proposal is issued. Use this illustration to inspect your own actual run; it is not your test evidence."
    },
    {
      "type": "heading",
      "text": "Practice with your own AI assistant"
    },
    {
      "type": "note",
      "theme": "gold",
      "title": "Approved prototype request",
      "text": "Help build a minimal working sample for this authorized scope using these inputs and acceptance criteria. Flag missing information and assumptions. Keep approval with me. Project: [charter and map]."
    },
    {
      "type": "field",
      "id": "p2-j2-5-workflow",
      "label": "Existing project charter and workflow map",
      "hint": "",
      "lines": 4
    },
    {
      "type": "field",
      "id": "p2-j2-5-concept",
      "label": "Bounded solution concept carried from Lesson 2.4",
      "hint": "",
      "lines": 4
    },
    {
      "type": "field",
      "id": "p2-j2-5-scope",
      "label": "One narrow path — allowed actions and excluded actions",
      "hint": "",
      "lines": 4
    },
    {
      "type": "field",
      "id": "p2-j2-5-inputs",
      "label": "Normal-case input — fictional or authorized material",
      "hint": "",
      "lines": 4
    },
    {
      "type": "field",
      "id": "p2-j2-5-criteria",
      "label": "Acceptance criteria defined before the run",
      "hint": "",
      "lines": 4
    },
    {
      "type": "field",
      "id": "p2-j2-5-owner",
      "label": "Human review owner and approval retained",
      "hint": "",
      "lines": 4
    },
    {
      "type": "field",
      "id": "p2-j2-5-completion",
      "label": "Completion signal for the reviewed result",
      "hint": "",
      "lines": 4
    },
    {
      "type": "field",
      "id": "p2-j2-5-baseline",
      "label": "Comparable baseline artifact and observed starting result",
      "hint": "",
      "lines": 4
    },
    {
      "type": "field",
      "id": "p2-j2-5-artifact",
      "label": "First working artifact — reusable request/template text or accessible authorized reference",
      "hint": "",
      "lines": 7
    },
    {
      "type": "field",
      "id": "p2-j2-5-runContext",
      "label": "Run context — tool, date and input classification",
      "hint": "",
      "lines": 4
    },
    {
      "type": "field",
      "id": "p2-j2-5-actualRequest",
      "label": "Exact request actually used for the first normal run",
      "hint": "",
      "lines": 4
    },
    {
      "type": "field",
      "id": "p2-j2-5-firstOutput",
      "label": "Actual first-run output",
      "hint": "Preserve the actual output from your own run, using fictional or authorized material.",
      "lines": 7
    },
    {
      "type": "field",
      "id": "p2-j2-5-inspection",
      "label": "First inspection — criterion, result and supporting evidence",
      "hint": "",
      "lines": 4
    },
    {
      "type": "field",
      "id": "p2-j2-5-revision",
      "label": "One material revision and the finding it addresses",
      "hint": "",
      "lines": 4
    },
    {
      "type": "field",
      "id": "p2-j2-5-revisedArtifact",
      "label": "Revised working artifact — text or accessible authorized reference",
      "hint": "",
      "lines": 7
    },
    {
      "type": "field",
      "id": "p2-j2-5-revisedRequest",
      "label": "Exact request actually used for the revised normal run",
      "hint": "",
      "lines": 4
    },
    {
      "type": "field",
      "id": "p2-j2-5-revisedOutput",
      "label": "Actual revised output using the same normal input",
      "hint": "Preserve the actual output from your own run, using fictional or authorized material.",
      "lines": 7
    },
    {
      "type": "field",
      "id": "p2-j2-5-comparison",
      "label": "Before-and-after comparison against the same criteria",
      "hint": "",
      "lines": 4
    },
    {
      "type": "field",
      "id": "p2-j2-5-demonstration",
      "label": "Demonstration — steps actually used, reviewed result and human control point",
      "hint": "",
      "lines": 7
    },
    {
      "type": "field",
      "id": "p2-j2-5-limits",
      "label": "What the prototype does, does not do and what remains uncertain",
      "hint": "",
      "lines": 4
    },
    {
      "type": "field",
      "id": "p2-j2-5-notes",
      "label": "Personal study notes and questions",
      "hint": "",
      "lines": 6
    },
    {
      "type": "note",
      "theme": "gold",
      "title": "Carry the working artifact into Lesson 2.6",
      "text": "Carry your working artifact, baseline, normal-run evidence and material revision into Lesson 2.6: Test Errors and Exception Paths. The next lesson opens according to its release schedule."
    }
  ]
}$workbook25$::jsonb),true),version=version+1,updated_at=now()
 where journey_number=2 and version=4 and jsonb_array_length(content->'pages')=4
 and md5((content->'pages')::text)='4a0255d58d218f200784b29531fd8da1'
 and not exists(select 1 from jsonb_array_elements(content->'pages') p where p->>'lesson_id'='2.5');
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'Journey Two workbook changed or Lesson 2.5 page already exists'; end if;
end $install25$;
commit;
