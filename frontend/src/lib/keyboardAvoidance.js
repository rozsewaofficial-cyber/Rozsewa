/**
 * Centralized Keyboard Avoidance System for Mobile Browsers.
 * This runs globally when loaded and dynamically updates viewport heights
 * and classes based on the visualViewport state.
 */

if (typeof window !== "undefined" && window.visualViewport) {
  // Only apply avoidance systems to touch devices (coarse pointer)
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

  if (isTouchDevice) {
    const handleViewportChange = () => {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.getAttribute("contenteditable") === "true"
      );

      const viewportHeight = window.visualViewport.height;
      const viewportWidth = window.visualViewport.width;
      const layoutHeight = window.innerHeight;
      const keyboardHeight = layoutHeight - viewportHeight;

      // Set custom CSS variables on document root
      document.documentElement.style.setProperty("--visual-viewport-height", `${viewportHeight}px`);
      document.documentElement.style.setProperty("--visual-viewport-width", `${viewportWidth}px`);
      document.documentElement.style.setProperty("--keyboard-height", `${keyboardHeight}px`);

      // A layout height drop of > 150px while input is focused suggests soft keyboard presence
      if (isInputFocused && keyboardHeight > 150) {
        document.body.classList.add("keyboard-open");
        
        // Ensure focused input is scrolled into view comfortably
        setTimeout(() => {
          if (document.activeElement === activeEl) {
            activeEl.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }
        }, 150);
      } else {
        document.body.classList.remove("keyboard-open");
      }
    };

    // Attach listeners
    window.visualViewport.addEventListener("resize", handleViewportChange);
    window.visualViewport.addEventListener("scroll", handleViewportChange);

    // Track dynamic changes in document focus to instantly update state
    document.addEventListener("focusin", () => {
      // Small delay to allow the soft keyboard to begin opening/resizing viewport
      setTimeout(handleViewportChange, 100);
    });

    document.addEventListener("focusout", () => {
      // Small delay to allow soft keyboard closure before height check
      setTimeout(handleViewportChange, 100);
    });

    // Run once on load
    handleViewportChange();
  }
}
