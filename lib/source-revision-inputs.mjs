const REPLACEABLE_ROLES = new Set(['spec', 'rules', 'claims']);

export async function buildSourceRevisionInputs(previousFiles, replacements, readOriginal) {
  if (!Array.isArray(replacements) || replacements.length < 1 || replacements.length > 7) {
    throw new Error('Choose one or more product specifications, checklists, or claims sources to replace.');
  }
  const existing = new Map((previousFiles || []).map(file => [file.id, file]));
  const selected = new Map();
  for (const replacement of replacements) {
    const target = existing.get(replacement.replacesFileId);
    if (!target || !REPLACEABLE_ROLES.has(target.role)) {
      throw new Error('Choose an existing product specification, checklist, or claims source to replace.');
    }
    if (selected.has(target.id)) throw new Error('Replace each source file only once per update.');
    selected.set(target.id, replacement);
  }

  return Promise.all((previousFiles || []).map(async file => {
    const replacement = selected.get(file.id);
    if (replacement) {
      if (replacement.role && replacement.role !== file.role) {
        throw new Error('A replacement must keep the source role of the selected file.');
      }
      return { name: replacement.name, role: file.role, base64: replacement.base64 };
    }
    const bytes = await readOriginal(file);
    return { name: file.name, role: file.role, base64: bytes.toString('base64') };
  }));
}
