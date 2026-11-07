import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import {AcademyGuide} from './AcademyGuide'
afterEach(()=>vi.unstubAllGlobals())
it('answers from the approved source without sending the question when AI is inactive',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({enabled:false})});vi.stubGlobal('fetch',fetcher)
 render(<AcademyGuide accessToken="test"/>);await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1))
 fireEvent.change(screen.getByLabelText('Your question'),{target:{value:'I need a refund'}});fireEvent.click(screen.getByRole('button',{name:'Find guidance'}))
 expect(screen.getByText('What is the refund policy?')).toBeTruthy();expect(screen.getByText(/final and non-refundable/)).toBeTruthy();expect(fetcher).toHaveBeenCalledTimes(1)
 expect(screen.getByRole('link',{name:'Open a support case ↗'}).getAttribute('href')).toBe('/contact/#request')
})
it('requires opt-in for model matching and handles network failure with source guidance',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({enabled:true})}).mockRejectedValue(Error('offline'));vi.stubGlobal('fetch',fetcher)
 render(<AcademyGuide accessToken="test"/>);await screen.findByRole('checkbox')
 fireEvent.change(screen.getByLabelText('Your question'),{target:{value:'How do I verify an answer?'}});fireEvent.click(screen.getByRole('button',{name:'Find guidance'}))
 expect(fetcher).toHaveBeenCalledTimes(1);fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Find guidance'}))
 await screen.findByText('AI matching is unavailable. Showing the Academy’s standard guidance.')
 expect(screen.getByText('Check an AI answer before using it')).toBeTruthy();expect(fetcher).toHaveBeenCalledTimes(2)
})
it('clears the previous question and response when the signed-in identity changes',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({enabled:false})}))
 const {rerender}=render(<AcademyGuide accessToken="first"/>);fireEvent.change(screen.getByLabelText('Your question'),{target:{value:'refund'}});fireEvent.click(screen.getByRole('button',{name:'Find guidance'}));expect(screen.getByText('What is the refund policy?')).toBeTruthy()
 rerender(<AcademyGuide accessToken="second"/>);expect(screen.queryByText('What is the refund policy?')).toBeNull();expect((screen.getByLabelText('Your question') as HTMLTextAreaElement).value).toBe('')
})
