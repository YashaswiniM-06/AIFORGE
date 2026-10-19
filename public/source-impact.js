const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const display = value => value == null || value === '' ? 'Not extracted' : String(value);

function valueRows(values) {
  return values?.length ? values.map(item => `<div class="impact-value"><b>${esc(display(item.value))}</b><small>${esc(item.name || '')}${item.location ? ` · ${esc(item.location)}` : ''}</small></div>`).join('') : '<div class="impact-value empty">Not extracted in this review</div>';
}

export function sourceImpactView(revision) {
  if (revision?.kind !== 'sources') return '';
  const sources = revision.sourceDocuments || [];
  const facts = revision.changedFacts || [];
  const requirements = revision.changedRequirements || [];
  const findings = revision.affectedFindings || [];
  const decisions = revision.decisionRechecks || [];
  const status = value => value ? value.replaceAll('_', ' ') : 'not present';
  return `<section class="panel source-impact" aria-labelledby="source-impact-title"><div class="eyebrow">SOURCE CHANGE IMPACT</div><h3 id="source-impact-title">What changed, and what needs another look</h3><p class="subtle">The artwork and confirmed package geometry were retained. Checks were rerun against the updated sources.</p>
    <div class="impact-section"><h4>Updated sources</h4>${sources.length ? `<div class="impact-source-list">${sources.map(source => `<div class="impact-source"><span class="badge">${esc(source.role)}</span><b>${esc(source.beforeName && source.afterName && source.beforeName !== source.afterName ? `${source.beforeName} → ${source.afterName}` : source.name)}</b><small>${esc(source.change)}</small></div>`).join('')}</div>` : '<p class="subtle">No source file content changed.</p>'}</div>
    <div class="impact-section"><h4>Specification values</h4>${facts.length ? facts.map(item => `<article class="impact-change"><b>${esc(item.label)} <small>· ${esc(item.name)}</small></b><div class="impact-pair"><section><small>Previous</small>${valueRows(item.before)}</section><section><small>Updated</small>${valueRows(item.after)}</section></div></article>`).join('') : '<p class="subtle">No extracted specification values changed.</p>'}</div>
    <div class="impact-section"><h4>Checklist changes</h4>${requirements.length ? requirements.map(item => `<article class="impact-rule ${esc(item.change)}"><span class="impact-tag">${esc(item.change)}</span><b>${esc(item.name)}${item.before?.location || item.after?.location ? ` · ${esc(item.after?.location || item.before?.location)}` : ''}</b><div class="impact-pair">${item.before ? `<section><small>Previous requirement</small><p>${esc(item.before.text)}</p></section>` : ''}${item.after ? `<section><small>Updated requirement</small><p>${esc(item.after.text)}</p></section>` : ''}</div></article>`).join('') : '<p class="subtle">No supported checklist requirement text changed.</p>'}</div>
    <div class="impact-section"><h4>Findings affected <span class="subtle">${findings.length}</span></h4>${findings.length ? `<div class="impact-findings">${findings.map(item => `<div class="impact-finding"><div><b>${esc(item.title)}</b><small>${esc(status(item.before))} → ${esc(status(item.after))}</small></div>${item.id ? `<button type="button" class="textbutton" data-action="select-finding" data-id="${esc(item.id)}">Inspect →</button>` : ''}</div>`).join('')}</div>` : '<p class="subtle">No existing findings cite the changed sources.</p>'}</div>
    <div class="impact-section"><h4>Earlier reviewer decisions to recheck <span class="subtle">${decisions.length}</span></h4>${decisions.length ? decisions.map(item => `<div class="impact-decision"><b>${esc(item.title)}</b><p>Earlier decision: ${esc(item.disposition?.replaceAll('_', ' ') || 'recorded')} · finding was ${esc(status(item.status))}${item.currentStatus ? ` and is now ${esc(status(item.currentStatus))}` : ''}.</p>${item.note ? `<small>${esc(item.note)}</small>` : ''}${item.alreadyStale ? '<small>This decision was already marked stale before this source update.</small>' : ''}${item.currentFindingId ? `<button type="button" class="textbutton" data-action="select-finding" data-id="${esc(item.currentFindingId)}">Review current finding →</button>` : '<small>The updated checklist no longer has a direct matching finding; inspect the updated checks.</small>'}</div>`).join('') : '<p class="subtle">No earlier reviewer decisions depend on the changed source files.</p>'}</div>
  </section>`;
}
