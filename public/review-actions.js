async function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 5000);
}

function addJsonExportLink() {
  const actions = document.querySelector('.review-heading .actions');
  if (!actions || actions.querySelector('[data-report-json]')) return;
  const pdf = actions.querySelector('a[href$="report.pdf"]');
  if (!pdf) return;
  const reviewId = location.hash.match(/^#review\/([a-f0-9-]{36})$/)?.[1];
  if (!reviewId) return;
  const link = document.createElement('a');
  link.className = 'secondary';
  link.href = `/api/reviews/${reviewId}/report.json`;
  link.textContent = 'Export signed JSON ↓';
  link.dataset.reportJson = 'true';
  actions.insertBefore(link, pdf);
}

const reviewRoot = document.querySelector('#app');
if (reviewRoot) {
  new MutationObserver(addJsonExportLink).observe(reviewRoot, { childList: true, subtree: true });
  addJsonExportLink();
}

document.addEventListener('click', async event => {
  const sealButton = event.target.closest('[data-action="verify-seal"]');
  if (sealButton) {
    const reviewId = location.hash.match(/^#review\/([a-f0-9-]{36})$/)?.[1];
    if (!reviewId) return;
    sealButton.disabled = true;
    try {
      const response = await fetch(`/api/reviews/${reviewId}/signature`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not verify the seal.');
      await showToast(result.valid ? `Signature verified · ${result.payloadHash.slice(0, 16)}…` : result.reason);
    } catch (error) {
      await showToast(error.message);
    } finally {
      sealButton.disabled = false;
    }
  }

  const findingButton = event.target.closest('[data-action="proof"]');
  if (!findingButton) return;
  const findingId = findingButton.dataset.id;
  const reviewId = location.hash.match(/^#review\/([a-f0-9-]{36})$/)?.[1];
  if (!reviewId) return;
  setTimeout(async () => {
    const response = await fetch(`/api/reviews/${reviewId}`);
    if (!response.ok) return;
    const review = await response.json();
    const followUps = (review.followUps || []).filter(item => item.findingId === findingId);
    const content = document.querySelector('#dialog .dialog-content');
    const actions = content?.querySelector('.finding-actions');
    const questionForm = actions?.querySelector('[data-question-form]');
    if (!actions || !questionForm || !followUps.length) return;
    for (const item of followUps) {
      const article = document.createElement('article');
      article.className = 'evidence-card';
      const question = document.createElement('b');
      question.textContent = item.question;
      const answer = document.createElement('p');
      answer.textContent = item.answer;
      article.append(question, answer);
      actions.insertBefore(article, questionForm);
    }
  }, 0);
});
