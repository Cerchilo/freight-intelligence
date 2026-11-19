
(() => {
  "use strict";

  const searchInput = document.getElementById("toolSearch");
  const filterButtons = document.querySelectorAll(".filter-btn");
  const toolItems = document.querySelectorAll(".tool-item");
  const emptyState = document.getElementById("emptyState");
  const yearElement = document.getElementById("currentYear");

  let activeFilter = "all";

  // Dynamic copyright year
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  // Search and category filtering
  function filterTools() {

    const query = (searchInput?.value || "").trim().toLowerCase();

    let visibleCount = 0;

    toolItems.forEach((item) => {

      const category = item.dataset.category || "";

      const searchableText =
        (item.dataset.search || item.textContent).toLowerCase();

      const matchesCategory =
        activeFilter === "all" || category === activeFilter;

      const matchesQuery =
        !query || searchableText.includes(query);

      const isVisible = matchesCategory && matchesQuery;

      item.classList.toggle("d-none", !isVisible);

      if (isVisible) {
        visibleCount++;
      }

    });

    emptyState?.classList.toggle("d-none", visibleCount !== 0);
  }

  searchInput?.addEventListener("input", filterTools);


  // Filter button interactions
  filterButtons.forEach((button) => {

    button.addEventListener("click", () => {

      activeFilter = button.dataset.filter || "all";

      filterButtons.forEach((item) => {

        const isActive = item === button;

        item.classList.toggle("active", isActive);

        item.setAttribute("aria-pressed", String(isActive));

      });

      filterTools();

    });

    button.setAttribute(
      "aria-pressed",
      String(button.classList.contains("active"))
    );

  });


  // Scroll-triggered animations
  const revealTargets = document.querySelectorAll(
    ".section-heading, .filter-row, .tool-item, .value-section .col-lg-5, .value-card, .faq-section .section-kicker, .faq-section h2, .faq-accordion"
  );

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if ("IntersectionObserver" in window && !reducedMotion) {

    revealTargets.forEach((element, index) => {

      element.classList.add("js-reveal");

      if (element.classList.contains("value-card")) {
        element.classList.add(
          `js-reveal-delay-${(index % 3) + 1}`
        );
      }

    });

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {

        entries.forEach((entry) => {

          if (entry.isIntersecting) {

            entry.target.classList.add("is-visible");

            observer.unobserve(entry.target);

          }

        });

      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -35px 0px"
      }
    );

    revealTargets.forEach((element) => {
      revealObserver.observe(element);
    });

  }

})();
