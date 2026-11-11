import { brandImage } from "@/lib/og";
import { SITE_DESCRIPTION } from "@/lib/site";

export const alt = "HRLeaf, a private notebook";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return brandImage(SITE_DESCRIPTION);
}
