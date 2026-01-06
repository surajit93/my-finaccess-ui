/* =========================================================
   LANDING PAGE SCROLL REVEAL
   Applies ONLY to index.html
========================================================= */

const sections = document.querySelectorAll(".lp-section");

const observer = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target); // STRICT: only once
      }
    });
  },
  {
    threshold: 0.25
  }
);

sections.forEach(section => observer.observe(section));
