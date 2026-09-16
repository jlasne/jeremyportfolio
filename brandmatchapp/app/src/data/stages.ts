/**
 * The CRM, in six words. A tag is a stage, and these are the stages. The API
 * and MCP speak the same six, so a lead moves along them from anywhere.
 */
export const STAGES = ['to contact', 'contacted', 'replied', 'in talks', 'deal', 'passed'] as const
export type Stage = (typeof STAGES)[number]
export const isStage = (t: string): t is Stage => (STAGES as readonly string[]).includes(t)
