const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

export function reviewPipeline(review, activeTab = 'findings') {
  const findings = review.findings || [];
  const stale = Object.values(review.options?.staleConfirmations || {}).filter(Boolean).length;
  const unresolvedSources = Math.max(
    review.conflicts?.length || 0,
    findings.filter(item => item.key === 'source-status' && item.status === 'review').length,
    stale,
  );
  const checks = review.rules?.length || findings.filter(item => item.rule).length;
  const issueCount = review.counts?.issue || 0;
  const reviewCount = review.counts?.review || 0;
  const steps = [
    { tab: 'sources', title: 'Sources & authority', detail: `${review.documents?.length || 0} ${review.documents?.length === 1 ? 'input' : 'inputs'} · ${unresolvedSources} open ${unresolvedSources === 1 ? 'decision' : 'decisions'}`, flag: unresolvedSources ? 'review' : 'complete' },
    { tab: 'rules', title: 'Compiled checks', detail: `${checks} supported or retained ${checks === 1 ? 'check' : 'checks'}`, flag: checks ? 'complete' : 'review' },
    { tab: 'findings', title: 'Artwork verification', detail: `${issueCount} ${issueCount === 1 ? 'issue' : 'issues'} · ${reviewCount} for review`, flag: issueCount ? 'issue' : reviewCount ? 'review' : 'complete' },
    { tab: 'activity', title: 'Signed audit report', detail: review.signature ? 'Review seal created' : 'Seal is created when you export', flag: review.signature ? 'complete' : 'ready' },
  ];
  return `<nav class="review-pipeline" aria-label="Review workflow" role="list">${steps.map((step, index) => `<button type="button" role="listitem" class="pipeline-step ${step.flag} ${activeTab === step.tab ? 'active' : ''}" data-action="tab" data-tab="${step.tab}" aria-current="${activeTab === step.tab ? 'step' : 'false'}"><span class="pipeline-index">${String(index + 1).padStart(2, '0')}</span><span class="pipeline-copy"><b>${esc(step.title)}</b><small>${esc(step.detail)}</small></span>${index < steps.length - 1 ? '<span class="pipeline-arrow" aria-hidden="true">→</span>' : ''}</button>`).join('')}</nav>`;
}
