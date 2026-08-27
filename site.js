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
