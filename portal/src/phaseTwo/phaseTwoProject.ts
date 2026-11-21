/**
 * Phase Two project record adapter.
 * A single, continually revised project follows the learner across 36 lessons.
 * Sections are the approved curriculum's evidence components, not new workbooks.
 */
import { supabase } from '../lib/supabase'

export const PHASE_TWO_EVIDENCE_SECTIONS = [
  { key: 'professional_ai_operating_model', label: 'Professional AI Operating Model', lessons: '1.1, 1.6' },
  { key: 'prompt_and_communication_evidence', label: 'Prompt and Communication Evidence', lessons: '1.4, 2.2–2.3' },
  { key: 'workflow_design_artifact', label: 'Workflow Design Artifact', lessons: '2.1, 5.4' },
  { key: 'ai_solution_concept', label: 'AI Solution Concept and working artifact', lessons: '1.5, 2.4–2.6' },
  { key: 'leadership_and_adoption_plan', label: 'Leadership and Adoption Plan', lessons: '3.1–3.6' },
  { key: 'professional_positioning_evidence', label: 'Professional Positioning Evidence', lessons: '6.1, 6.5' },
  { key: 'digital_delivery_artifact', label: 'Digital Product or Delivery Artifact', lessons: '4.1–4.6' },
  { key: 'operations_and_systems_evidence', label: 'Operations and Systems Evidence', lessons: '5.3–5.4, 5.6' },
  { key: 'governance_literacy_evidence', label: 'Governance Literacy Evidence', lessons: '3.5, 5.1–5.6' },
  { key: 'responsible_practice_statement', label: 'Responsible Practice Statement', lessons: '5.5, 6.3' },
  { key: 'capstone_integration_package', label: 'Capstone Integration Package', lessons: '6.2–6.6' },
] as const

export type PhaseTwoProjectSection = (typeof PHASE_TWO_EVIDENCE_SECTIONS)[number]['key']
export type PhaseTwoProjectPath = 'A' | 'B'
export type PhaseTwoProjectRecord = {
  enrollment_id: string
  learner_id: string
  project_path: PhaseTwoProjectPath
  project_title: string
  sections: Record<string, unknown>
  version_number: number
  updated_at: string
}

export function phaseTwoProjectSectionPatch(section: PhaseTwoProjectSection, text: string) {
  if (!PHASE_TWO_EVIDENCE_SECTIONS.some(item => item.key === section)) {
    throw new Error('An approved Phase Two evidence section is required.')
  }
  return { [section]: { text } }
}

export async function loadPhaseTwoProject(enrollmentId: string): Promise<PhaseTwoProjectRecord | null> {
  const { data, error } = await supabase
    .from('aca_phase_two_project_records')
    .select('enrollment_id, learner_id, project_path, project_title, sections, version_number, updated_at')
    .eq('enrollment_id', enrollmentId)
    .maybeSingle()
  if (error) throw new Error('The Phase Two project record could not load.')
  return data as PhaseTwoProjectRecord | null
}

export async function savePhaseTwoProjectUpdate(input: {
  enrollmentId: string
  path: PhaseTwoProjectPath
  title: string
  patch: Record<string, unknown>
  decisionNote?: string
}): Promise<{ saved_version: number; saved_at: string }> {
  const { data, error } = await supabase.rpc('save_aca_phase_two_project', {
    p_enrollment_id: input.enrollmentId,
    p_project_path: input.path,
    p_project_title: input.title,
    p_patch: input.patch,
    p_decision_note: input.decisionNote?.trim() || null,
  })
  if (error || !data?.[0]) throw new Error('Your project could not be saved. Please try again.')
  return data[0] as { saved_version: number; saved_at: string }
}

export async function loadPhaseTwoRevisionHistory(enrollmentId: string) {
  const { data, error } = await supabase.from('aca_phase_two_project_revisions')
    .select('version_number, decision_note, created_at')
    .eq('enrollment_id', enrollmentId).order('version_number', { ascending: false })
  if (error) throw new Error('The project revision history could not load.')
  return (data ?? []) as Array<{ version_number: number; decision_note: string | null; created_at: string }>
}
