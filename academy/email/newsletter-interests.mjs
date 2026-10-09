export const INTEREST_TOPICS = {
  'Videos':'ba5711cf-c68b-46fe-ba0d-50fc297826e6',
  'Phase One':'0b5ac329-8004-4e10-837c-7125e2a70f39',
  'Books & Resources':'da485e84-5171-46b4-aaca-2f8a35de2653',
  'ACA updates':'5feb0571-2f59-4214-8d91-288a07a26429',
}
export function subscriberInterests(row) {
  return [...new Set((row.interests ?? [row.interest_area]).filter(x=>Object.hasOwn(INTEREST_TOPICS,x)))]
}
export function itemInterest(item) {
  if(item.category) {
    if(!Object.hasOwn(INTEREST_TOPICS,item.category)) throw Error('Unknown announcement category')
    return item.category
  }
  if(item.kind==='video') return 'Videos'
  if(['book','resource'].includes(item.kind)) return 'Books & Resources'
  if(item.kind==='enrollment') return 'Phase One'
  if(item.kind==='note') return 'ACA updates'
  throw Error('Announcement requires an explicit category')
}
export function routeItems(items, interest) { return items.filter(item=>itemInterest(item)===interest) }
