// VAA Position = a Service (Skill), labelled by short name the way the
// Masterlist shows it. Client-safe (no Prisma import): shared by the profile
// editor and updateVAProfile().

// Picked when the VA's vaaPosition text matches no Service: saving keeps that
// text (and leaves positionSkillId alone) instead of clearing it.
export const KEEP_POSITION_TEXT = '__keep__'

export type PositionSkillOption = { id: string; name: string; shortName: string | null }

export function positionLabel(skill: { name: string; shortName: string | null }): string {
  return skill.shortName ?? skill.name
}

// Same normalized name/short-name match the CSV importer uses to link a
// position, so an unlinked VA whose text names a Service preselects it.
export function matchPositionSkillId(text: string | null, skills: PositionSkillOption[]): string | null {
  const needle = text?.trim().toLowerCase()
  if (!needle) return null
  const hit = skills.find((s) => s.name.trim().toLowerCase() === needle || s.shortName?.trim().toLowerCase() === needle)
  return hit?.id ?? null
}
