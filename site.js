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
            <li>Hands-on practice and a personal workbook</li>
            <li>Your own learner account and progress tracking</li>
          </ul>
        </div>
        <div class="payment-options" aria-label="Phase One payment options">
          <article class="payment-card payment-card-featured">
            <p class="payment-label">One payment</p>
            <h3>Pay in full</h3>
            <p class="payment-amount">$129</p>
            <p class="payment-saving">Save $20 on the $149 course price.</p>
            <p class="payment-note">One payment covers your Phase One enrollment.</p>
            <form method="post" action="/api/enrollment/phase-one/paid-in-full">
              <label class="consent"><input type="checkbox" required><span>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>, <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>, and <a href="/refund-policy" target="_blank" rel="noopener noreferrer">Refund Policy</a>.</span></label>
              <button class="button button-gold" type="submit">Pay $129 in full</button>
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
            <form method="post" action="/api/enrollment/phase-one/installments">
              <label class="consent"><input type="checkbox" required><span>I authorize the three-payment schedule above and agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>, <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>, and <a href="/refund-policy" target="_blank" rel="noopener noreferrer">Refund Policy</a>.</span></label>
              <button class="button button-gold" type="submit">Start with $50 today</button>
            </form>
          </article>
        </div>
      </div>`;
    if (paymentStatus === 'success') {
      section.insertAdjacentHTML('afterbegin', '<div class="form-confirmation" role="status"><span>Payment received.</span><p>Check your email for your secure Academy access.</p></div>');
    } else if (paymentStatus === 'canceled') {
      section.insertAdjacentHTML('afterbegin', '<p class="form-error" role="status">Checkout was canceled. No new payment was completed.</p>');
    }
    enrollmentPage.before(section);
  }

  const form = document.querySelector('form[name="aca-interest-list"]');
  if (!form) return;

  const endpoint = 'https://ymmkodlifpxutynpjnxm.supabase.co/functions/v1/aca-interest-list';
  const submitButton = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
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
