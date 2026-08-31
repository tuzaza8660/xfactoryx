const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const mobileMenu = document.querySelector('[data-mobile-menu]');

addEventListener('scroll', () => header.classList.toggle('scrolled', scrollY > 40), { passive: true });

menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  menuButton.classList.toggle('active', !open);
  mobileMenu.classList.toggle('open', !open);
  document.body.style.overflow = open ? '' : 'hidden';
});

mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.classList.remove('active');
  mobileMenu.classList.remove('open');
  document.body.style.overflow = '';
}));

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-visible'));
}, { threshold: 0.18 });
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

const counterObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(({ isIntersecting, target }) => {
    if (!isIntersecting) return;
    const end = Number(target.dataset.count);
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / 1100, 1);
      target.textContent = Math.round(end * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    observer.unobserve(target);
  });
}, { threshold: 0.7 });
document.querySelectorAll('[data-count]').forEach((el) => counterObserver.observe(el));

if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const heroImage = document.querySelector('.hero-image');
  addEventListener('pointermove', ({ clientX, clientY }) => {
    const x = (clientX / innerWidth - 0.5) * 12;
    const y = (clientY / innerHeight - 0.5) * 12;
    heroImage.style.translate = `${x}px ${y}px`;
  }, { passive: true });
}
