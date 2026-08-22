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

  const params = new URLSearchParams(window.location.search);
  const form = document.querySelector('form[name="aca-interest-list"]');
  if (form && params.get('submitted') === 'true') {
    const confirmation = document.createElement('div');
    confirmation.className = 'form-confirmation';
    confirmation.setAttribute('role', 'status');
    confirmation.innerHTML = '<span>Thank you.</span><p>You are on the ACA interest list.</p>';
    form.replaceWith(confirmation);
    window.history.replaceState({}, '', window.location.pathname);
  }
})();
