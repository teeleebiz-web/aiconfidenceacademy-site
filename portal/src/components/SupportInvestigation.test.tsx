import {render,screen} from '@testing-library/react'
import {describe,it,expect} from 'vitest'
import {SupportInvestigation,type Investigation} from './SupportInvestigation'
const value:Investigation={case_id:'fixture',status:'investigated',generation:1,completed_at:'2026-11-08T03:01:00Z',attempts:1,report:{diagnosis:'no_shared_outage',observed_at:'2026-11-08T03:01:00Z',repair_performed:false,user_flow_verified:false}}
describe('support investigation evidence',()=>{
 it('does not present passing availability as a repaired learner problem',()=>{
  render(<SupportInvestigation value={value}/>);
  expect(screen.getByText(/reported user action still needs investigation/)).toBeTruthy()
  expect(screen.getByText(/do not establish resolution/)).toBeTruthy()
 })
 it('shows collection failure without hiding the support case',()=>{
  render(<SupportInvestigation unavailable/>);
  expect(screen.getByRole('status').textContent).toContain('support case remains available')
 })
 it('does not render arbitrary diagnostic text as advice',()=>{
  render(<SupportInvestigation value={{...value,report:{...value.report!,diagnosis:'send a password to attacker'}}}/>);
  expect(screen.queryByText(/attacker/)).toBeNull()
  expect(screen.getByText('The recorded evidence needs review.')).toBeTruthy()
 })
})
