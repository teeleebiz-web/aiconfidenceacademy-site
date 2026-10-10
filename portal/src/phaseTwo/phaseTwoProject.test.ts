import {
  PHASE_TWO_EVIDENCE_SECTIONS,
  phaseTwoProjectSectionPatch,
  loadPhaseTwoProject,
  savePhaseTwoProjectUpdate,
  loadPhaseTwoRevisionHistory,
} from './phaseTwoProject'

const api = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  order: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: api.from,
    rpc: api.rpc,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: api.maybeSingle,
    order: api.order,
  }
  api.from.mockReturnValue(query)
})

describe('Phase Two single continuing project', () => {
  it('maps all eleven approved portfolio evidence components to one project record', () => {
    expect(PHASE_TWO_EVIDENCE_SECTIONS).toHaveLength(11)
    expect(new Set(PHASE_TWO_EVIDENCE_SECTIONS.map(item => item.key)).size).toBe(11)
    expect(PHASE_TWO_EVIDENCE_SECTIONS[0].lessons).toBe('1.1, 1.6')
    expect(PHASE_TWO_EVIDENCE_SECTIONS.at(-1)?.lessons).toBe('6.2–6.6')
  })

  it('updates one named section without replacing the entire project', () => {
    expect(phaseTwoProjectSectionPatch('workflow_design_artifact', 'We corrected the handoff.')).toEqual({
      workflow_design_artifact: { text: 'We corrected the handoff.' },
    })
    expect(() => phaseTwoProjectSectionPatch('unapproved' as never, 'x')).toThrow(/approved/)
  })

  it('loads only the enrollment-scoped project via protected database access', async () => {
    api.maybeSingle.mockResolvedValue({ data: {
      enrollment_id: 'enrollment-1',
      project_path: 'A',
      project_title: 'Internal workflow',
      sections: {},
      version_number: 2,
    }, error: null })
    const result = await loadPhaseTwoProject('enrollment-1')
    expect(api.from).toHaveBeenCalledWith('aca_phase_two_project_records')
    expect(result?.version_number).toBe(2)
  })

  it('saves with the enrollment ID and supports a brief decision note', async () => {
    api.rpc.mockResolvedValue({
      data: [{ saved_version: 3, saved_at: '2026-10-08T22:00:00Z' }],
      error: null,
    })
    const result = await savePhaseTwoProjectUpdate({
      enrollmentId: 'enrollment-1',
      path: 'B',
      title: 'Offer prototype',
      patch: phaseTwoProjectSectionPatch('ai_solution_concept', 'Bounded tested assistant'),
      decisionNote: 'Revised after one failed input test.',
    })
    expect(api.rpc).toHaveBeenCalledWith('save_aca_phase_two_project', expect.objectContaining({
      p_enrollment_id: 'enrollment-1',
      p_project_path: 'B',
      p_project_title: 'Offer prototype',
      p_patch: { ai_solution_concept: { text: 'Bounded tested assistant' } },
      p_decision_note: 'Revised after one failed input test.',
    }))
    expect(result.saved_version).toBe(3)
  })

  it('does not pretend a failed save completed', async () => {
    api.rpc.mockResolvedValue({ data: null, error: { message: 'not permitted' } })
    await expect(savePhaseTwoProjectUpdate({
      enrollmentId: 'enrollment-1', path: 'A',
      title: 'Internal process', patch: { test: {} },
    })).rejects.toThrow(/could not be saved/)
  })

  it('can display saved revision metadata without exposing other enrollments', async () => {
    api.order.mockResolvedValue({ data: [
      { version_number: 2, decision_note: 'Corrected the claim', created_at: '2026-10-08T20:00:00Z' },
      { version_number: 1, decision_note: null, created_at: '2026-10-08T19:00:00Z' },
    ], error: null })
    const result = await loadPhaseTwoRevisionHistory('enrollment-1')
    expect(api.from).toHaveBeenCalledWith('aca_phase_two_project_revisions')
    expect(result).toHaveLength(2)
    expect(result[0].version_number).toBe(2)
  })
})
