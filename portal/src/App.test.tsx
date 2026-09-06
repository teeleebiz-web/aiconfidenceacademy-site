import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

const api = vi.hoisted(() => ({
  latest: vi.fn(),
  sign: vi.fn(),
}))

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'test-owner' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    rpc: async () => ({ data: true, error: null }),
    from: (table: string) => {
      const data = table === 'journey_introductions'
        ? [{ id: 'test-intro', media_path: null }]
        : []
      const result = Promise.resolve({ data, error: null })
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        order: () => result,
        maybeSingle: async () => ({ data: table === 'profiles'
          ? { first_name: 'Test' }
          : { id: 'test-enrollment', course_id: 'test-course' }, error: null }),
        single: api.latest,
        then: result.then.bind(result),
      }
      return query
    },
    storage: { from: () => ({ createSignedUrl: api.sign }) },
  },
}))

vi.mock('./components/Dashboard', () => ({
  Dashboard: ({ onOpenIntroduction }: { onOpenIntroduction: (item: { id: string }) => void }) => (
    <button onClick={() => onOpenIntroduction({ id: 'test-intro' })}>Open test welcome</button>
  ),
}))

vi.mock('./components/JourneyIntroductionView', () => ({
  JourneyIntroductionView: ({ introduction, mediaUrl, captionUrl }: {
    introduction: { content: { title: string } }
    mediaUrl: string | null
    captionUrl: string | null
  }) => <section><h1>{introduction.content.title}</h1><span>{mediaUrl}</span><span>{captionUrl}</span></section>,
}))

describe('saved introduction loading', () => {
  beforeEach(() => {
    api.latest.mockReset()
    api.sign.mockReset()
    api.sign.mockImplementation(async (path: string) => ({ data: { signedUrl: `https://media.example/${path}` }, error: null }))
  })

  it('loads the saved revision and newly attached media instead of the dashboard snapshot', async () => {
    api.latest.mockResolvedValue({ data: {
      id: 'test-intro', content: { title: 'Saved synthetic revision' },
      media_path: 'approved.mp4', caption_path: 'approved.vtt',
    }, error: null })
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Open test welcome' }))
    expect(await screen.findByRole('heading', { name: 'Saved synthetic revision' })).toBeTruthy()
    await waitFor(() => expect(screen.getByText('https://media.example/approved.vtt')).toBeTruthy())
    expect(api.sign).toHaveBeenCalledWith('approved.mp4', 3600)
    expect(api.sign).toHaveBeenCalledWith('approved.vtt', 3600)
  })

  it('does not request media when the saved introduction is inaccessible', async () => {
    api.latest.mockResolvedValue({ data: null, error: { message: 'Not accessible' } })
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Open test welcome' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(api.sign).not.toHaveBeenCalled()
  })
})
