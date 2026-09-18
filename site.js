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
    section.className = 'enrollment-layout section-pad';
    section.setAttribute('aria-labelledby', 'phase-one-enrollment-title');
    section.innerHTML = `
      <div>
        <p class="section-kicker">Phase One enrollment</p>
        <h2 id="phase-one-enrollment-title">Choose the payment option that works for you.</h2>
        <p><strong>Pay in full: $129</strong></p>
        <p>One secure payment provides Phase One access.</p>
        <form method="post" action="/api/enrollment/phase-one/paid-in-full">
          <label class="consent"><input type="checkbox" required><span>I agree to the <a href="/terms" target="_blank">Terms of Service</a>, <a href="/privacy" target="_blank">Privacy Policy</a>, and <a href="/refund-policy" target="_blank">Refund Policy</a>.</span></label>
          <button class="button button-gold" type="submit">Pay $129 in full</button>
        </form>
      </div>
      <div class="interest-form">
        <p class="section-kicker">Three installments · $149 total</p>
        <h2>$50 today, $50 in 7 days, then $49 in 14 days.</h2>
        <p>Your payment method is securely handled by Stripe and authorized only for this schedule. ACA does not store your full card number.</p>
        <p>We send a reminder two days before payments two and three. If a scheduled payment fails, you receive a 48-hour correction period. Access pauses after that period if the payment remains unpaid and resumes when the account is brought current. Correcting a payment does not move the remaining scheduled date.</p>
        <p>The recurring authorization ends automatically after the third successful payment.</p>
        <form method="post" action="/api/enrollment/phase-one/installments">
          <label class="consent"><input type="checkbox" required><span>I authorize the three-payment schedule above and agree to the <a href="/terms" target="_blank">Terms of Service</a>, <a href="/privacy" target="_blank">Privacy Policy</a>, and <a href="/refund-policy" target="_blank">Refund Policy</a>.</span></label>
          <button class="button button-gold" type="submit">Start with $50 today</button>
        </form>
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
