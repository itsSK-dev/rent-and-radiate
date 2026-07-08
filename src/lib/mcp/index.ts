import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchProducts from "./tools/search-products";
import listMyRentals from "./tools/list-my-rentals";
import listMyWishlist from "./tools/list-my-wishlist";
import addToWishlist from "./tools/add-to-wishlist";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "rent-and-radiate-mcp",
  title: "Rent & Radiate",
  version: "0.1.0",
  instructions:
    "Tools for the Rent & Radiate fashion rental marketplace. Use search_products to browse dresses and jewellery. Use list_my_rentals, list_my_wishlist, and add_to_wishlist to act on behalf of the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchProducts, listMyRentals, listMyWishlist, addToWishlist],
});
