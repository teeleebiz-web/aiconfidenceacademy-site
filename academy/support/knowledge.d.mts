export type Guidance = {id:string;title:string;words:string[];answer:string;url:string}
export const answers:Guidance[]
export const learningGuidance:Guidance[]
export const policyVersion:string
export function findAnswers(question:string):Guidance[]
export function findGuidance(question:string,topic?:string):Guidance[]
