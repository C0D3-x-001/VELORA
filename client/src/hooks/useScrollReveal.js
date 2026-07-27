import { useEffect, useRef } from "react";

export function useScrollReveal(options = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: options.threshold ?? 0.1, rootMargin: options.rootMargin ?? "0px 0px -40px 0px" }
    );

    const targets = el.querySelectorAll(".reveal, .reveal-left, .reveal-right, .reveal-scale");
    targets.forEach((t) => observer.observe(t));

    if (el.classList.contains("reveal") || el.classList.contains("reveal-left") || el.classList.contains("reveal-right") || el.classList.contains("reveal-scale")) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [options.threshold, options.rootMargin]);

  return ref;
}

export function useCountUp(target, duration = 2000, startOnMount = false) {
  const ref = useRef(null);
  const counted = useRef(false);

  useEffect(() => {
    if (!startOnMount && !ref.current) return;
    if (counted.current) return;

    const el = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !counted.current) {
            counted.current = true;
            const start = performance.now();
            const animate = (now) => {
              const progress = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              const current = Math.round(eased * target);
              if (el) el.textContent = current.toLocaleString();
              if (progress < 1) requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.5 }
    );

    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration, startOnMount]);

  return ref;
}
