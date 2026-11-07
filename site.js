(() => {
  const button = document.querySelector('.menu-button');
  const navigation = document.querySelector('#site-navigation');
  if (button && navigation) {
    button.addEventListener('click', () => {
      const isOpen = navigation.classList.toggle('open');
      button.setAttribute('aria-expanded', String(isOpen));
    });
    navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      navigation.classList.remove('open');
      button.setAttribute('aria-expanded', 'false');
    }));
  }

  const enrollmentPage = document.querySelector('form[name="aca-interest-list"]')?.closest('.enrollment-layout');
  if (enrollmentPage) {
    const paymentStatus = new URLSearchParams(window.location.search).get('payment');
    const section = document.createElement('section');
    section.className = 'enrollment-offer section-pad';
    section.setAttribute('aria-labelledby', 'phase-one-enrollment-title');
    section.innerHTML = `
      <div class="offer-inner">
        <div class="offer-intro">
          <div>
            <p class="section-kicker">Phase One enrollment</p>
            <h2 id="phase-one-enrollment-title">A clear path from first steps to real practice.</h2>
            <p>Enroll as an ACA learner and move through a guided course built for everyday life.</p>
          </div>
          <div class="offer-course-price"><span>Phase One course price</span><strong>$149</strong></div>
        </div>
        <div class="offer-includes">
          <h3>What your enrollment includes</h3>
          <ul>
            <li>Six guided journeys and 36 lessons</li>
            <li>Video, audio, and clear written guidance</li>
            <li>Hands-on practice and a personal digital workbook</li>
            <li>Your own learner account and progress tracking</li>
          </ul>
        </div>
        <div class="purchase-notice"><strong>Before you pay</strong><p>You must be 18 or older to enroll. This is personal, time-limited program access, not lifetime access to an instructional library. First open an ordinary lesson within 24 hours of its release. Once opened, you have 120 minutes of study time. Pause and resume with your unused minutes; closing the lesson or signing out does not use the saved time. Enrollment and payment access restrictions still apply. Released workbook pages and saved answers remain separate from protected instruction. Enrollment is non-refundable for change of mind or non-use, subject to applicable legal rights. Read the <a href="/terms/">Terms</a>. For refund and cancellation information, see the <a href="/refund-policy/">Refund Policy</a>. For payment or access help, <a href="/contact/#request">contact ACA support</a>.</p></div>
        <div class="payment-options" aria-label="Phase One payment options">
          <article class="payment-card payment-card-featured">
            <p class="payment-label">Pay-in-full price</p>
            <h3>Pay once</h3>
            <p class="payment-amount">$129</p>
            <p class="payment-saving">Save $20 on the $149 course price. Every new enrollee qualifies. No special eligibility or discount code is required.</p>
            <p class="payment-note">One payment covers your Phase One enrollment.</p>
            <form method="post" action="https://checkout.aiconfidenceacademy.org/api/enrollment/phase-one/paid-in-full">
              <label class="consent"><input type="checkbox" name="termsAccepted" value="yes" required><input type="hidden" name="ageConfirmed" value="yes"><input type="hidden" name="policyVersion" value="2026-10-31"><span>I confirm that I am 18 or older. I have reviewed this option's total price and the lesson access conditions. I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Enrollment and Use</a> and <a href="/refund-policy" target="_blank" rel="noopener noreferrer">Refund Policy</a>, and acknowledge the <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span></label>
              <button class="button button-gold" type="submit">Pay $129 today</button>
            </form>
          </article>
          <article class="payment-card payment-card-installments">
            <p class="payment-label">Three weekly payments</p>
            <h3>Pay in installments</h3>
            <p class="payment-amount">$50 <span>today</span></p>
            <ol class="payment-schedule" aria-label="Installment schedule">
              <li><span>Today</span><strong>$50</strong></li>
              <li><span>In 7 days</span><strong>$50</strong></li>
              <li><span>In 14 days</span><strong>$49</strong></li>
            </ol>
            <p class="payment-total">$149 total</p>
            <details class="payment-terms"><summary>How the installments work</summary><p>Stripe handles your payment method; ACA does not store your full card number. We email a reminder two days before the later payments. If a payment fails, you have 48 hours to correct it before access pauses. Access resumes when the account is brought current; correcting a payment does not move the remaining scheduled date. Automatic payments end after the third successful payment.</p></details>
            <form method="post" action="https://checkout.aiconfidenceacademy.org/api/enrollment/phase-one/installments">
              <label class="consent"><input type="checkbox" name="termsAccepted" value="yes" required><input type="hidden" name="ageConfirmed" value="yes"><input type="hidden" name="policyVersion" value="2026-10-31"><span>I confirm that I am 18 or older. I have reviewed this option's total price and the lesson access conditions. I authorize the three payments at the amounts and due dates shown above. I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Enrollment and Use</a> and <a href="/refund-policy" target="_blank" rel="noopener noreferrer">Refund Policy</a>, and acknowledge the <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span></label>
              <button class="button button-gold" type="submit">Start with $50 today</button>
            </form>
          </article>
        </div>
      </div>`;
    enrollmentPage.before(section);
    if (paymentStatus === 'success') {
      section.insertAdjacentHTML('beforebegin', '<div class="form-confirmation" role="status"><span>Checkout submitted.</span><p>Your secure Academy access email will arrive after Stripe confirms your payment.</p></div>');
    } else if (paymentStatus === 'canceled') {
      section.insertAdjacentHTML('beforebegin', '<p class="form-error" role="status">Checkout was canceled. No new payment was completed.</p>');
    }
    const phaseTwo = document.createElement('section');
    phaseTwo.className = 'enrollment-offer section-pad';
    phaseTwo.setAttribute('aria-labelledby', 'phase-two-enrollment-title');
    phaseTwo.innerHTML = `
      <div class="offer-inner">
        <div class="offer-intro">
          <div>
            <p class="section-kicker">Phase Two enrollment</p>
            <h2 id="phase-two-enrollment-title">Capability &amp; Application</h2>
            <p>Develop, test, and explain a useful AI-supported project. You can enroll directly in Phase Two.</p>
            <p><a href="/programs/phase-two/">Learn more about Phase Two</a></p>
          </div>
          <div class="offer-course-price"><span>Phase Two course price</span><strong>$199</strong></div>
        </div>
        <p><strong>Choose how you pay.</strong> Every new enrollee can save $20 by paying in full. No special eligibility or discount code is required. Prefer installments? Choose three payments at the amounts shown.</p>
        <div class="purchase-notice"><strong>Before you pay</strong><p>You must be 18 or older to enroll. This is personal, time-limited program access, not lifetime access to an instructional library. Lesson 1 opens with your enrollment access. Later lessons release at 6 a.m. Pacific, Monday through Saturday. First open an ordinary lesson within 24 hours of release, then use 120 minutes of study time, with unused minutes preserved across pauses, browser closure, and sign-out. Saturday lesson access continues through Sunday, ending Monday at 00:00 Pacific. Enrollment and payment access restrictions still apply. Released workbook pages and saved answers remain separate from protected instruction. Enrollment is non-refundable for change of mind or non-use, subject to applicable legal rights. Read the <a href="/terms/">Terms</a> and <a href="/refund-policy/">Refund Policy</a>. For payment or access help, <a href="/contact/#request">contact ACA support</a>.</p></div>
        <div class="payment-options" aria-label="Phase Two payment options">
          <article class="payment-card payment-card-featured">
            <p class="payment-label">Pay-in-full price</p>
            <h3>Pay once</h3>
            <p class="payment-amount">$179</p>
            <p class="payment-saving">Save $20 on the $199 course price.</p>
            <p class="payment-note">One payment covers your Phase Two enrollment.</p>
            <form method="post" action="https://checkout.aiconfidenceacademy.org/api/enrollment/phase-two/paid-in-full">
              <label class="consent"><input type="checkbox" name="termsAccepted" value="yes" required><input type="hidden" name="ageConfirmed" value="yes"><input type="hidden" name="policyVersion" value="2026-10-31"><span>I confirm that I am 18 or older. I have reviewed this option's total price and the lesson access conditions. I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Enrollment and Use</a> and <a href="/refund-policy" target="_blank" rel="noopener noreferrer">Refund Policy</a>, and acknowledge the <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span></label>
              <button class="button button-gold" type="submit">Pay $179 today</button>
            </form>
          </article>
          <article class="payment-card payment-card-installments">
            <p class="payment-label">Three weekly payments</p>
            <h3>Pay in installments</h3>
            <p class="payment-amount">$67 <span>today</span></p>
            <ol class="payment-schedule" aria-label="Phase Two installment schedule">
              <li><span>Initial payment</span><strong>$67</strong></li>
              <li><span>Day 7 payment</span><strong>$66</strong></li>
              <li><span>Day 14 payment</span><strong>$66</strong></li>
            </ol>
            <p class="payment-total">$199 total</p>
            <details class="payment-terms"><summary>How the installments work</summary><p>Stripe handles your payment method; ACA does not store your full card number. We email a reminder two days before the later payments. If a payment fails, you have 48 hours to correct it before access pauses. Access resumes when the account is brought current; correcting a payment does not move the remaining scheduled date. Automatic payments end after the third successful payment.</p></details>
            <form method="post" action="https://checkout.aiconfidenceacademy.org/api/enrollment/phase-two/installments">
              <label class="consent"><input type="checkbox" name="termsAccepted" value="yes" required><input type="hidden" name="ageConfirmed" value="yes"><input type="hidden" name="policyVersion" value="2026-10-31"><span>I confirm that I am 18 or older. I have reviewed this option's total price and the lesson access conditions. I authorize the three payments at the amounts and due dates shown above. I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Enrollment and Use</a> and <a href="/refund-policy" target="_blank" rel="noopener noreferrer">Refund Policy</a>, and acknowledge the <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span></label>
              <button class="button button-gold" type="submit">Start with $67 today</button>
            </form>
          </article>
        </div>
      </div>`;
    enrollmentPage.before(phaseTwo);
  }

  const form = document.querySelector('form[name="aca-interest-list"]');
  if (!form) return;

  const interest = new URLSearchParams(window.location.search).get('interest');
  const selectedInterest = { books: 'Books & Resources', videos: 'Videos', updates: 'ACA updates' }[interest];
  if (selectedInterest) form.querySelectorAll('input[name=interest]').forEach(input=>{input.checked=input.value===selectedInterest;});

  const endpoint = 'https://ymmkodlifpxutynpjnxm.supabase.co/functions/v1/aca-interest-list';
  const submitButton = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    if (!data.getAll('interest').length) {
      const first=form.querySelector('input[name=interest]');
      first.setCustomValidity('Please select at least one interest.');first.reportValidity();
      first.onchange=()=>first.setCustomValidity('');
      form.querySelectorAll('input[name=interest]').forEach(input=>input.addEventListener('change',()=>first.setCustomValidity(''),{once:true}));
      return;
    }
    const originalLabel = submitButton?.textContent || 'Join the interest list';

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Joining…';
    }

    form.querySelector('.form-error')?.remove();

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: data.get('firstName'),
          lastName: data.get('lastName'),
          email: data.get('email'),
          interest: data.get('interest'),
          interests: data.getAll('interest'),
          consent: data.get('consent') === 'yes',
          website: data.get('website'),
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'We could not save your request. Please try again.');
      }

      const confirmation = document.createElement('div');
      confirmation.className = 'form-confirmation';
      confirmation.setAttribute('role', 'status');
      confirmation.innerHTML = '<span>Thank you.</span><p>You are on the ACA interest list.</p>';
      form.replaceWith(confirmation);
    } catch (error) {
      const message = document.createElement('p');
      message.className = 'form-error';
      message.setAttribute('role', 'alert');
      message.textContent = error instanceof Error
        ? error.message
        : 'We could not save your request. Please try again.';
      form.appendChild(message);

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
      }
    }
  });
})();

// Section destinations are separate URL views, never animated anchor jumps.
(() => {
  const destinations = {
    '/explore/': ['begin', 'everyday', 'verify', 'quick-answers', 'deeper-thoughts', 'topics', 'books', 'expressions', 'field-notes'],
    '/programs/phase-one/': ['everyday-example'],
    '/programs/phase-two/': ['business-example', 'practical-outcomes'],
    '/videos/': ['ai-and-academy', 'explore-chatgpt'],
    '/enroll/': ['interest-list', 'updates-signup'],
    '/contact/': ['request', 'automatic-help'],
    '/privacy/': ['requests', 'communications'],
    '/terms/': ['payments'],
    '/library/ai-updates/': ['provider-announcements', 'practical-guidance', 'official-sources'],
  };
  const path = value => value.replace(/\/index\.html$/, '/').replace(/\/?$/, '/');
  function destinationUrl(value) {
    const url = new URL(value, location.href);
    if (url.origin !== location.origin) return null;
    const section = url.hash.slice(1);
    if (!destinations[path(url.pathname)]?.includes(section)) return null;
    url.searchParams.set('section', section); url.hash = '';
    return url;
  }
  document.querySelectorAll('a[href]').forEach(link => {
    const url = destinationUrl(link.href);
    if (url) link.href = url.href;
  });
  // Later support results also use the same direct-view routes.
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const url = destinationUrl(link.href);
    if (url) link.href = url.href;
  });
  const current = destinationUrl(location.href) || new URL(location.href);
  const route = path(current.pathname), allowed = destinations[route];
  const selected = current.searchParams.get('section') || (route === '/library/ai-updates/' ? 'provider-announcements' : null);
  if (!selected || !allowed?.includes(selected)) return;
  const main = document.querySelector('main');
  const target = document.getElementById(selected);
  if (!main || !target || !main.contains(target)) return;
  // A form/heading destination retains its containing section and controls.
  const panel = target.matches('section, article') ? target : target.closest('section');
  if (!panel || !main.contains(panel)) return;
  if (current.href !== location.href) history.replaceState(history.state, '', current.href);
  main.classList.add('aca-focused-view');
  const style = document.createElement('style');
  style.textContent = `html{scroll-behavior:auto!important}.aca-focused-view [hidden]{display:none!important}.aca-view-navigation{max-width:1200px;margin:0 auto;padding:24px 32px 12px;color:#102d4f}.aca-view-navigation a{display:inline-block;padding:10px 14px;color:inherit;text-decoration:underline;text-underline-offset:4px}.aca-view-navigation a[aria-current=page]{background:#102d4f;color:#fffdf9;border-radius:6px}.aca-view-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.aca-focused-view{min-height:65vh}.aca-focused-view>.section-pad,.aca-focused-view>.aca-guidance-section{padding-top:24px}.aca-focused-view .hub-path{margin-top:0}.aca-view-navigation a:focus-visible{outline:3px solid #b48632;outline-offset:2px}@media(max-width:700px){.aca-view-navigation{padding:16px 18px 8px}.aca-view-navigation a{padding:10px}}`;
  document.head.append(style);
  // Retain the original DOM and its event handlers; only sibling views are hidden.
  for (let node = panel; node !== main; node = node.parentElement) {
    for (const sibling of node.parentElement.children) if (sibling !== node) sibling.hidden = true;
  }
  const navigation = document.createElement('nav');
  navigation.className = 'aca-view-navigation'; navigation.setAttribute('aria-label', 'Section navigation');
  const back = document.createElement('a');
  const home = new URL(current.href); home.searchParams.delete('section'); home.hash = '';
  back.href = route === '/library/ai-updates/' ? '/library/' : home.href;
  back.textContent = route === '/library/ai-updates/' ? '← Books & Resources' : '← Back to overview';
  navigation.append(back);
  if (route === '/library/ai-updates/') {
    const tabs = document.createElement('div'); tabs.className = 'aca-view-tabs';
    for (const [id, label] of [['provider-announcements', 'Latest updates'], ['practical-guidance', 'Practical guidance'], ['official-sources', 'Official sources']]) {
      const link = document.createElement('a'), url = new URL(current.href);
      url.searchParams.set('section', id); url.hash = ''; link.href = url.href; link.textContent = label;
      if (id === selected) link.setAttribute('aria-current', 'page');
      tabs.append(link);
    }
    navigation.append(tabs);
  }
  main.prepend(navigation);
  const heading = panel.querySelector('h1,h2,h3');
  if (heading) { heading.setAttribute('role', 'heading'); heading.setAttribute('aria-level', '1'); heading.tabIndex = -1; heading.focus({ preventScroll: true }); document.title = `${heading.textContent.trim()} | AI Confidence Academy`; }
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
})();
