import {render,screen} from '@testing-library/react'
import {ExternalAvailability} from './ExternalAvailability'
it('does not claim outside monitoring is active before account and delivery verification',()=>{
 render(<ExternalAvailability/>);expect(screen.getByText('Setup pending')).toBeTruthy();expect(screen.queryByRole('link')).toBeNull();expect(screen.getByText(/still need verification/)).toBeTruthy()
})
it('distinguishes verified configuration from live availability and links to independent private history',()=>{
 render(<ExternalAvailability configuration={{configured:true,website:'https://aiconfidenceacademy.org/',backend:'https://checkout.aiconfidenceacademy.org/api/health',dashboard_url:'https://app.statuscake.com/',verified_at:'2026-10-27T10:00:00Z',interval_seconds:300}}/>)
 expect(screen.getByText('External checks configured')).toBeTruthy();expect(screen.getByText('5 minutes')).toBeTruthy();expect(screen.getByRole('link',{name:/independent incident history/}).getAttribute('href')).toBe('https://app.statuscake.com/')
 expect(screen.getByText(/open that dashboard for current availability/)).toBeTruthy()
})
