import { MetadataRoute } from "next";

/** HRLeaf is private: ask every crawler to stay out. Link previews still work. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
