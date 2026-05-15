import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls the window to the top whenever the route path or query string
 * changes. This ensures any category, store, or filter navigation lands
 * the user at the top of the page automatically.
 */
const ScrollToTop = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search]);

  return null;
};

export default ScrollToTop;
